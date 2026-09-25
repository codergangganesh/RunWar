import { insforge } from '../lib/insforge';
import { Workout, WorkoutType, GPSCoordinate, WorkoutSplit, Achievement } from '../types';
import { achievementsService } from './achievementsService';
import { recordsService } from './recordsService';
import { goalsService } from './goalsService';
import { gearService } from './gearService';
import { syncQueue } from './syncQueue';
import { workoutLogger } from '../utils/workoutLogger';
import { getLocalDateKey, getStartOfLocalWeek, isSameLocalDate } from '../utils/dateUtils';
import { calculateSplits } from '../utils/calculations';
import { toDeterministicUUID } from '../utils/uuid';

const WORKOUTS_CACHE_KEY = 'runwar_cached_workouts';

/**
 * Dedicated classifier to identify fake / sandbox demo workouts.
 * Fake demo workouts MUST NEVER be displayed when a real Strava account is connected!
 */
export function isDemoWorkout(w: any): boolean {
  if (!w) return false;
  if (
    typeof w.external_record_id === 'string' &&
    (w.external_record_id.startsWith('demo_') ||
      w.external_record_id === 'demo_10192837' ||
      w.external_record_id === 'demo_10248192')
  ) {
    return true;
  }
  if (
    typeof w.id === 'string' &&
    (w.id.includes('demo_101') || w.id.includes('demo_102') || w.id.includes('strava_demo'))
  ) {
    return true;
  }
  if (w.title === 'Sunrise 5K Run' || w.title === 'Weekend Trail Interval') {
    return true;
  }
  if (
    typeof w.notes === 'string' &&
    (w.notes.includes('10192837') || w.notes.includes('10248192'))
  ) {
    return true;
  }
  return false;
}

export function isStravaWorkout(w: any): boolean {
  if (!w) return false;
  if (w.source_provider === 'strava') return true;
  if (typeof w.notes === 'string' && w.notes.toLowerCase().includes('strava')) return true;
  if (
    typeof w.external_record_id === 'string' &&
    (w.external_record_id.startsWith('demo_') ||
      w.external_record_id.startsWith('strava_') ||
      w.external_record_id === 'demo_10192837' ||
      w.external_record_id === 'demo_10248192')
  ) {
    return true;
  }
  if (
    typeof w.id === 'string' &&
    (w.id.toLowerCase().includes('strava') ||
      w.id.toLowerCase().includes('demo_101') ||
      w.id.toLowerCase().includes('demo_102'))
  ) {
    return true;
  }
  if (
    (w.title === 'Sunrise 5K Run' || w.title === 'Weekend Trail Interval') &&
    (w.notes?.includes('10192837') ||
      w.notes?.includes('10248192') ||
      w.notes?.toLowerCase().includes('strava'))
  ) {
    return true;
  }
  return false;
}

export interface SaveWorkoutResult {
  workout: Workout;
  isCloudSynced: boolean;
  message: string;
  newlyUnlockedAchievements?: Achievement[];
}

export function normalizeWorkout(raw: any): Workout {
  const type: WorkoutType = ['run', 'jog', 'walk'].includes(raw.type) ? raw.type : 'run';
  const status: 'completed' | 'paused' | 'discarded' = ['completed', 'paused', 'discarded'].includes(raw.status)
    ? raw.status
    : 'completed';

  // Robust parsing of route_coordinates (handles JSON string from PostgreSQL/localStorage)
  let route_coordinates: GPSCoordinate[] = [];
  if (Array.isArray(raw.route_coordinates)) {
    route_coordinates = raw.route_coordinates;
  } else if (typeof raw.route_coordinates === 'string' && raw.route_coordinates.trim().length > 2) {
    try {
      const parsed = JSON.parse(raw.route_coordinates);
      if (Array.isArray(parsed)) route_coordinates = parsed;
    } catch {}
  }

  // Robust parsing of splits (handles JSON string from PostgreSQL/localStorage)
  let splits: WorkoutSplit[] = [];
  if (Array.isArray(raw.splits)) {
    splits = raw.splits;
  } else if (typeof raw.splits === 'string' && raw.splits.trim().length > 2) {
    try {
      const parsed = JSON.parse(raw.splits);
      if (Array.isArray(parsed)) splits = parsed;
    } catch {}
  }

  const duration_seconds = Math.round(Number(raw.duration_seconds) || 0);
  const distance_meters = Math.round(Number(raw.distance_meters) || 0);

  // If splits is empty, auto-generate splits from coordinates or distance & duration
  if (splits.length === 0) {
    if (route_coordinates && route_coordinates.length > 1) {
      try {
        splits = calculateSplits(route_coordinates, 1000);
      } catch {}
    }

    if (splits.length === 0 && distance_meters >= 300 && duration_seconds > 0) {
      const totalKm = Math.floor(distance_meters / 1000);
      const avgPaceSec = Math.round(duration_seconds / (distance_meters / 1000));
      for (let k = 1; k <= totalKm; k++) {
        splits.push({
          split_number: k,
          distance_meters: 1000,
          duration_seconds: avgPaceSec,
          pace: avgPaceSec,
        });
      }
      const remainder = distance_meters % 1000;
      if (remainder > 150) {
        const remSec = Math.round((remainder / 1000) * avgPaceSec);
        splits.push({
          split_number: totalKm + 1,
          distance_meters: Math.round(remainder),
          duration_seconds: remSec,
          pace: avgPaceSec,
        });
      }
    }
  }

  // Calculate elevation if route coordinates contain altitude
  let elevation_gain = Math.round(Number(raw.elevation_gain) || 0);
  let elevation_loss = Math.round(Number(raw.elevation_loss) || 0);
  if (elevation_gain === 0 && elevation_loss === 0 && route_coordinates.length > 2) {
    for (let i = 1; i < route_coordinates.length; i++) {
      const prevAlt = route_coordinates[i - 1].altitude;
      const currAlt = route_coordinates[i].altitude;
      if (prevAlt != null && currAlt != null) {
        const diff = currAlt - prevAlt;
        if (diff > 0.5) elevation_gain += diff;
        else if (diff < -0.5) elevation_loss += Math.abs(diff);
      }
    }
    elevation_gain = Math.round(elevation_gain);
    elevation_loss = Math.round(elevation_loss);
  }

  // Parse weather if available or embedded in notes, and strip metadata from notes
  let weather = raw.weather || null;
  let cleanNotes = raw.notes || null;
  if (typeof cleanNotes === 'string' && cleanNotes.toLowerCase().includes('[weather:')) {
    try {
      const match = cleanNotes.match(/\[WEATHER:\s*([\s\S]*?)\]/i);
      if (match && match[1] && !weather) {
        weather = JSON.parse(match[1].trim());
      }
    } catch (e) {
      console.warn('Failed to parse weather from notes:', e);
    }
    // Strip [WEATHER:...] metadata from runner notes
    cleanNotes = cleanNotes.replace(/\[WEATHER:\s*[\s\S]*?\]/gi, '').trim();
    // Also remove leftover outer quotes if notes was only quotes wrapping metadata
    cleanNotes = cleanNotes.replace(/^["'`]+|["'`]+$/g, '').trim();
    if (cleanNotes.length === 0) {
      cleanNotes = null;
    }
  }

  return {
    id: raw.id || crypto.randomUUID(),
    user_id: raw.user_id || 'guest_user',
    type,
    title: raw.title || `${type.charAt(0).toUpperCase() + type.slice(1)} Session`,
    notes: cleanNotes,
    started_at: raw.started_at || new Date().toISOString(),
    ended_at: raw.ended_at || new Date().toISOString(),
    duration_seconds,
    moving_duration_seconds: Math.round(Number(raw.moving_duration_seconds) || duration_seconds),
    paused_duration_seconds: Math.round(Number(raw.paused_duration_seconds) || 0),
    distance_meters,
    average_pace: Math.round(Number(raw.average_pace) || (distance_meters > 0 ? duration_seconds / (distance_meters / 1000) : 0)),
    average_speed: Number(Number(raw.average_speed || (distance_meters > 0 ? (distance_meters / 1000) / (duration_seconds / 3600) : 0)).toFixed(2)),
    max_speed: Number(Number(raw.max_speed || 0).toFixed(2)),
    calories: Math.round(Number(raw.calories) || 0),
    elevation_gain,
    elevation_loss,
    status,
    route_coordinates,
    splits,
    weather,
    source_provider: raw.source_provider || 'runwar_gps',
    external_record_id: raw.external_record_id || null,
    heart_rate_avg: raw.heart_rate_avg ?? null,
    created_at: raw.created_at || new Date().toISOString(),
  };
}

export const workoutService = {
  /**
   * Save a newly finished workout to database with offline fallback and validation
   */
  async saveWorkout(
    workout: Omit<Workout, 'id' | 'created_at'> & { id?: string }
  ): Promise<SaveWorkoutResult> {
    const workoutId = workout.id || crypto.randomUUID();

    // Ensure valid workout type
    const validTypes: WorkoutType[] = ['run', 'jog', 'walk'];
    const type: WorkoutType = validTypes.includes(workout.type) ? workout.type : 'run';

    const normalized = normalizeWorkout({
      ...workout,
      id: workoutId,
      type,
    });

    const newWorkoutPayload: Omit<Workout, 'id' | 'created_at'> & { id: string } = {
      id: normalized.id,
      user_id: normalized.user_id,
      type: normalized.type,
      title: normalized.title,
      notes: normalized.notes || '',
      started_at: normalized.started_at,
      ended_at: normalized.ended_at,
      duration_seconds: normalized.duration_seconds,
      moving_duration_seconds: normalized.moving_duration_seconds,
      paused_duration_seconds: normalized.paused_duration_seconds,
      distance_meters: normalized.distance_meters,
      average_pace: normalized.average_pace,
      average_speed: normalized.average_speed,
      max_speed: normalized.max_speed,
      calories: normalized.calories,
      elevation_gain: normalized.elevation_gain,
      elevation_loss: normalized.elevation_loss,
      status: 'completed',
      route_coordinates: normalized.route_coordinates,
      splits: normalized.splits,
    };

    // If weather is present, encode it into notes as backward-compatible fallback
    let encodedNotes = normalized.notes || null;
    if (normalized.weather) {
      const weatherJson = JSON.stringify(normalized.weather);
      if (!encodedNotes) {
        encodedNotes = `[WEATHER:${weatherJson}]`;
      } else if (!encodedNotes.includes('[WEATHER:')) {
        encodedNotes = `${encodedNotes} [WEATHER:${weatherJson}]`;
      }
    }

    // Clean payload matching PostgreSQL workouts table schema
    const dbWorkoutPayload: any = {
      id: normalized.id,
      user_id: normalized.user_id,
      type: normalized.type,
      title: normalized.title,
      notes: encodedNotes,
      started_at: normalized.started_at,
      ended_at: normalized.ended_at,
      duration_seconds: normalized.duration_seconds,
      moving_duration_seconds: normalized.moving_duration_seconds,
      paused_duration_seconds: normalized.paused_duration_seconds,
      distance_meters: normalized.distance_meters,
      average_pace: normalized.average_pace,
      average_speed: normalized.average_speed,
      max_speed: normalized.max_speed,
      calories: normalized.calories,
      elevation_gain: normalized.elevation_gain,
      elevation_loss: normalized.elevation_loss,
      status: normalized.status,
      route_coordinates: normalized.route_coordinates,
      splits: normalized.splits,
      weather: normalized.weather || null,
    };

    // Re-verify if active user is authenticated in InsForge before deciding guest status
    let activeUserId = normalized.user_id;
    if (!activeUserId || activeUserId === 'guest_user' || activeUserId === 'usr_guest_demo') {
      try {
        const { data: authData } = await insforge.auth.getCurrentUser();
        const authUser = (authData as any)?.user || authData;
        if (authUser?.id) {
          activeUserId = authUser.id;
          normalized.user_id = activeUserId;
          newWorkoutPayload.user_id = activeUserId;
          dbWorkoutPayload.user_id = activeUserId;
        }
      } catch {}
    }

    // Guest users skip cloud sync entirely — local cache only
    const isGuestUser = activeUserId === 'guest_user' || activeUserId === 'usr_guest_demo';
    if (isGuestUser) {
      const localWorkout: Workout = {
        ...normalized,
        created_at: new Date().toISOString(),
      };
      this.addWorkoutToCache(localWorkout, 'guest_user');
      return {
        workout: localWorkout,
        isCloudSynced: false,
        message: 'Workout saved locally (guest mode).',
      };
    }

    if (!navigator.onLine) {
      // Local-first: immediately cache and queue for background sync
      const localWorkout: Workout = {
        ...normalized,
        user_id: activeUserId,
        created_at: new Date().toISOString(),
      };
      this.addWorkoutToCache(localWorkout, activeUserId);
      syncQueue.queueCompletedWorkout({
        ...newWorkoutPayload,
        user_id: activeUserId,
      });
      workoutLogger.log(
        'SYNC_BATCH_QUEUED',
        'info',
        { workoutId, offline: true },
        workoutId
      );
      return {
        workout: localWorkout,
        isCloudSynced: false,
        message: "Workout saved locally. We'll sync it when you're connected.",
      };
    }

    try {
      // 1. Insert or upsert into workouts table (idempotent with column fallback)
      let insertedWorkout: any = null;
      let { data, error: workoutError } = await insforge.database
        .from('workouts')
        .upsert([dbWorkoutPayload], { onConflict: 'id' })
        .select()
        .maybeSingle();

      if (workoutError && (workoutError.message?.includes('column "weather"') || workoutError.message?.includes("'weather'"))) {
        const { weather: _drop, ...fallbackPayload } = dbWorkoutPayload;
        const retryRes = await insforge.database
          .from('workouts')
          .upsert([fallbackPayload], { onConflict: 'id' })
          .select()
          .maybeSingle();
        data = retryRes.data;
        workoutError = retryRes.error;
      }

      if (workoutError) throw workoutError;
      insertedWorkout = data;

      const savedWorkout = normalizeWorkout({
        ...(insertedWorkout || newWorkoutPayload),
        weather: normalized.weather || (insertedWorkout?.weather ?? null),
        created_at: new Date().toISOString(),
      });

      // Flush queued point batches for this confirmed workout now that parent record exists
      syncQueue.flushWorkoutPoints(savedWorkout.id).catch((ptErr) => {
        console.warn('Non-blocking error flushing point batches:', ptErr);
      });

      // 2. Batch insert splits if present
      if (normalized.splits && normalized.splits.length > 0) {
        const splitsPayload = normalized.splits.map((s) => ({
          workout_id: savedWorkout.id,
          user_id: savedWorkout.user_id,
          split_number: s.split_number,
          distance_meters: s.distance_meters,
          duration_seconds: s.duration_seconds,
          pace: s.pace,
        }));

        try {
          await insforge.database.from('workout_splits').insert(splitsPayload);
        } catch (splitErr) {
          console.warn('Non-blocking error saving splits:', splitErr);
        }
      }

      // 3. GPS points: Skip bulk insert if points were already live-synced via syncQueue.
      //    Only insert here if no live batches were sent (e.g. offline-first save or recovered workout).
      const liveSyncedPointCount = syncQueue.getPendingPointsCount();
      const hasLiveSyncedPoints = liveSyncedPointCount === 0 && normalized.route_coordinates && normalized.route_coordinates.length > 0;
      if (hasLiveSyncedPoints) {
        // Check if points already exist for this workout to avoid duplicates
        try {
          const { count } = await insforge.database
            .from('workout_points')
            .select('id', { count: 'exact', head: true })
            .eq('workout_id', savedWorkout.id);

          if (!count || count === 0) {
            const chunkSize = 50;
            for (let i = 0; i < normalized.route_coordinates.length; i += chunkSize) {
              const chunk = normalized.route_coordinates.slice(i, i + chunkSize);
              const pointsPayload = chunk.map((pt, idx) => ({
                workout_id: savedWorkout.id,
                user_id: savedWorkout.user_id,
                latitude: pt.latitude,
                longitude: pt.longitude,
                altitude: pt.altitude ?? null,
                accuracy: pt.accuracy ?? null,
                speed: pt.speed ?? null,
                timestamp: new Date(pt.timestamp).toISOString(),
                sequence_number: pt.sequence_number || (i + idx + 1),
              }));

              try {
                await insforge.database.from('workout_points').insert(pointsPayload);
              } catch (ptErr) {
                console.warn('Non-blocking error saving point chunk:', ptErr);
              }
            }
          }
        } catch (checkErr) {
          console.warn('Non-blocking error checking existing points:', checkErr);
        }
      }

      // 4. Evaluate Goals, Achievements, Gear Mileage & Personal Records
      let newlyUnlocked: Achievement[] = [];
      try {
        const [goalRes, achRes, prRes, gearRes] = await Promise.allSettled([
          goalsService.updateProgress(savedWorkout.user_id),
          achievementsService.checkAchievements(savedWorkout.user_id, savedWorkout),
          recordsService.checkPersonalRecords(savedWorkout.user_id, savedWorkout),
          gearService.addDistanceToActiveGear(savedWorkout.user_id, savedWorkout.distance_meters),
        ]);

        if (achRes.status === 'fulfilled' && Array.isArray(achRes.value)) {
          newlyUnlocked = achRes.value;
        }
      } catch (e) {
        console.warn('Error evaluating badges/goals after save:', e);
      }

      // 5. Update local cache with confirmed record
      this.addWorkoutToCache(savedWorkout);
      return {
        workout: savedWorkout,
        isCloudSynced: true,
        message: 'Workout saved successfully!',
        newlyUnlockedAchievements: newlyUnlocked,
      };
    } catch (error) {
      console.error('Failed to save workout to cloud DB, falling back to local queue:', error);
      const fallbackWorkout: Workout = {
        ...normalized,
        user_id: activeUserId,
        created_at: new Date().toISOString(),
      };
      this.addWorkoutToCache(fallbackWorkout, activeUserId);
      syncQueue.queueCompletedWorkout({
        ...newWorkoutPayload,
        user_id: activeUserId,
      });

      // Attribute local gear distance
      gearService.addDistanceToActiveGear(activeUserId, fallbackWorkout.distance_meters).catch(() => {});

      return {
        workout: fallbackWorkout,
        isCloudSynced: false,
        message: "Workout saved locally. We'll sync it when you're connected.",
      };
    }
  },

  /**
   * Batch save imported workouts from external health providers (Google Health / Health Connect)
   * Safely upserts records to InsForge and local cache, evaluating goals and personal records
   */
  async saveImportedWorkouts(importedWorkouts: Workout[]): Promise<{ savedCount: number }> {
    if (!importedWorkouts || importedWorkouts.length === 0) return { savedCount: 0 };

    const normalizedList = importedWorkouts.map((w) => normalizeWorkout(w));

    // Deduplicate against existing workouts in cache to avoid re-inserting same sessions
    const cached = this.getCachedWorkouts();
    const existingIds = new Set(cached.map((w) => w.id));
    const existingExtKeys = new Set(
      cached.filter((w) => w.source_provider && w.external_record_id).map((w) => `${w.source_provider}_${w.external_record_id}`)
    );
    const existingTimes = cached.map((w) => new Date(w.started_at).getTime()).filter((t) => !isNaN(t));

    const uniqueToSave = normalizedList.filter((w) => {
      if (existingIds.has(w.id)) {
        return false;
      }
      if (w.external_record_id && existingExtKeys.has(`${w.source_provider}_${w.external_record_id}`)) {
        return false;
      }
      const wTime = new Date(w.started_at).getTime();
      return !existingTimes.some((t) => Math.abs(t - wTime) < 120 * 1000);
    });

    if (uniqueToSave.length === 0) return { savedCount: 0 };

    // 1. Update local cache immediately for instant UI feedback
    uniqueToSave.forEach((w) => this.addWorkoutToCache(w));

    // 2. Persist to InsForge database if online
    if (navigator.onLine) {
      try {
        const payloads = uniqueToSave.map((w) => ({
          id: w.id,
          user_id: w.user_id,
          type: w.type,
          title: w.title,
          notes: w.notes || null,
          started_at: w.started_at,
          ended_at: w.ended_at,
          duration_seconds: w.duration_seconds,
          moving_duration_seconds: w.moving_duration_seconds || w.duration_seconds,
          paused_duration_seconds: 0,
          distance_meters: w.distance_meters,
          average_pace: w.average_pace,
          average_speed: w.average_speed,
          max_speed: w.max_speed,
          calories: w.calories,
          elevation_gain: w.elevation_gain,
          elevation_loss: w.elevation_loss,
          status: 'completed',
          route_coordinates: w.route_coordinates,
          splits: w.splits,
          source_provider: w.source_provider || 'google_health',
          external_record_id: w.external_record_id || null,
          heart_rate_avg: w.heart_rate_avg ?? null,
        }));

        await insforge.database
          .from('workouts')
          .upsert(payloads, { onConflict: 'id' });

        // Batch save splits & points for imported workouts that contain them
        for (const w of uniqueToSave) {
          if (w.splits && w.splits.length > 0) {
            const splitsPayload = w.splits.map((s) => ({
              workout_id: w.id,
              user_id: w.user_id,
              split_number: s.split_number,
              distance_meters: s.distance_meters,
              duration_seconds: s.duration_seconds,
              pace: s.pace,
            }));
            try {
              await insforge.database.from('workout_splits').insert(splitsPayload);
            } catch {}
          }

          if (w.route_coordinates && w.route_coordinates.length > 0) {
            const chunkSize = 50;
            for (let i = 0; i < w.route_coordinates.length; i += chunkSize) {
              const chunk = w.route_coordinates.slice(i, i + chunkSize);
              const pointsPayload = chunk.map((pt, idx) => ({
                workout_id: w.id,
                user_id: w.user_id,
                latitude: pt.latitude,
                longitude: pt.longitude,
                altitude: pt.altitude ?? null,
                accuracy: pt.accuracy ?? null,
                speed: pt.speed ?? null,
                timestamp: new Date(pt.timestamp).toISOString(),
                sequence_number: pt.sequence_number || (i + idx + 1),
              }));
              try {
                await insforge.database.from('workout_points').insert(pointsPayload);
              } catch {}
            }
          }
        }
      } catch (err) {
        console.warn('Non-blocking error during cloud upsert of imported workouts:', err);
      }
    }

    // 3. Re-evaluate goals and achievements
    const userId = uniqueToSave[0]?.user_id;
    if (userId && userId !== 'guest_user') {
      try {
        await Promise.allSettled([
          goalsService.updateProgress(userId),
          recordsService.checkPersonalRecords(userId, uniqueToSave[0]),
        ]);
      } catch {
        // ignore non-blocking evaluations
      }
    }

    return { savedCount: uniqueToSave.length };
  },

  /**
   * Fetch workouts for a user with category filtering and sorting.
   * Uses InsForge Cloud DB as the authoritative single source of truth for authenticated users.
   */
  async getWorkouts(
    userId: string,
    filterType: WorkoutType | 'all' = 'all',
    sortBy: 'newest' | 'oldest' | 'longest' | 'fastest' | 'calories' = 'newest',
    limit: number = 100
  ): Promise<Workout[]> {
    let cloudWorkouts: Workout[] | null = null;
    let canonicalUserId = userId;

    if (!canonicalUserId || canonicalUserId === 'guest_user' || canonicalUserId === 'usr_guest_demo') {
      try {
        const { data: authData } = await insforge.auth.getCurrentUser();
        const authUser = (authData as any)?.user || authData;
        if (authUser?.id) {
          canonicalUserId = authUser.id;
        }
      } catch {}
    }

    const isCloudUser = Boolean(canonicalUserId && canonicalUserId !== 'guest_user' && canonicalUserId !== 'usr_guest_demo');

    // 1. Authoritative Cloud Fetch for Authenticated Users
    if (isCloudUser && navigator.onLine) {
      try {
        const { data, error } = await insforge.database
          .from('workouts')
          .select('*')
          .eq('user_id', canonicalUserId)
          .order('started_at', { ascending: false })
          .limit(limit);

        if (!error && Array.isArray(data)) {
          const deletedIds = this.getDeletedWorkoutIds();
          cloudWorkouts = data.map(normalizeWorkout).filter((w) => !deletedIds.has(w.id));
        } else if (error) {
          console.warn('Cloud fetch workouts error from InsForge:', error);
        }
      } catch (err) {
        console.warn('Cloud fetch workouts warning, falling back to cache:', err);
      }
    }

    // 2. Read User-Scoped Cache
    const deletedIds = this.getDeletedWorkoutIds();
    const userCachedWorkouts = this.getCachedWorkouts(canonicalUserId).filter(
      (w) => (!isCloudUser || w.user_id === canonicalUserId) && !deletedIds.has(w.id)
    );

    let rawMerged: Workout[];

    if (cloudWorkouts !== null) {
      // Cloud is authoritative source of truth!
      // Only merge any un-synced offline workouts for this user that are not in cloud yet
      const cloudIds = new Set(cloudWorkouts.map((w) => w.id));
      const pendingOfflineWorkouts = userCachedWorkouts.filter(
        (w) => !cloudIds.has(w.id) && !deletedIds.has(w.id)
      );

      if (pendingOfflineWorkouts.length > 0 && isCloudUser && navigator.onLine) {
        this.syncPendingWorkouts(canonicalUserId).catch(() => {});
      }

      rawMerged = [...cloudWorkouts, ...pendingOfflineWorkouts];
      // Update user-scoped cache to perfectly match authoritative DB
      this.saveWorkoutsCache(rawMerged, canonicalUserId);
    } else {
      // Offline or network fallback: Use user-scoped cache
      rawMerged = userCachedWorkouts;
    }

    // Inspect Strava connection status: is it connected, and is it a demo connection or real connection?
    try {
      const stravaTokens = typeof localStorage !== 'undefined' ? localStorage.getItem('runwar_strava_tokens') : null;
      const stravaStateRaw = typeof localStorage !== 'undefined' ? localStorage.getItem('runwar_strava_state') : null;
      let isStravaActive = false;
      let isDemoSession = false;

      if (stravaTokens) {
        try {
          const t = JSON.parse(stravaTokens);
          if (t && t.access_token) {
            isStravaActive = true;
            if (typeof t.access_token === 'string' && t.access_token.startsWith('demo_')) {
              isDemoSession = true;
            }
          }
        } catch {}
      }
      if (!isStravaActive && stravaStateRaw) {
        try {
          const s = JSON.parse(stravaStateRaw);
          if (s && s.isConnected) {
            isStravaActive = true;
            if (s.accountEmail?.includes('Demo')) {
              isDemoSession = true;
            }
          }
        } catch {}
      }

      // CRITICAL: If NOT in demo sandbox mode, NEVER return fake demo workouts!
      if (!isDemoSession) {
        const countBefore = rawMerged.length;
        rawMerged = rawMerged.filter((w) => !isDemoWorkout(w));
        if (rawMerged.length !== countBefore) {
          this.saveWorkoutsCache(rawMerged, canonicalUserId);
        }
      }

      // If Strava is completely disconnected, NEVER show any Strava workouts
      if (!isStravaActive) {
        const initialCount = rawMerged.length;
        rawMerged = rawMerged.filter((w) => !isStravaWorkout(w));
        if (rawMerged.length !== initialCount) {
          this.saveWorkoutsCache(rawMerged, canonicalUserId);
        }
      }
    } catch {}

    const seenIds = new Set<string>();
    const seenExternalKeys = new Set<string>();
    const seenTimestamps: number[] = [];
    const dedupedWorkouts: Workout[] = [];

    for (const w of rawMerged) {
      if (w.status !== 'completed' && w.status) {
        continue;
      }

      // 1. Check direct UUID
      if (seenIds.has(w.id)) continue;

      // 2. Check external record ID (Google Health, Health Connect)
      if (w.source_provider && w.external_record_id) {
        const extKey = `${w.source_provider}_${w.external_record_id}`;
        if (seenExternalKeys.has(extKey)) continue;
        seenExternalKeys.add(extKey);
      }

      // 3. Check start time overlap (only for external provider imports to prevent external duplicate sync)
      const wTime = new Date(w.started_at).getTime();
      if (!isNaN(wTime) && w.source_provider && w.source_provider !== 'runwar_gps') {
        const hasTimeMatch = seenTimestamps.some((t) => Math.abs(t - wTime) < 120 * 1000);
        if (hasTimeMatch) continue;
        seenTimestamps.push(wTime);
      }

      seenIds.add(w.id);
      dedupedWorkouts.push(w);
    }

    // Filter by type if requested
    let filtered = dedupedWorkouts;
    if (filterType !== 'all') {
      filtered = filtered.filter((w) => w.type === filterType);
    }

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'oldest') return new Date(a.started_at).getTime() - new Date(b.started_at).getTime();
      if (sortBy === 'longest') return b.distance_meters - a.distance_meters;
      if (sortBy === 'fastest') return (a.average_pace || 9999) - (b.average_pace || 9999);
      if (sortBy === 'calories') return b.calories - a.calories;
      return new Date(b.started_at).getTime() - new Date(a.started_at).getTime();
    });

    return filtered.slice(0, limit);
  },

  /**
   * Fetch full workout details including points and splits from DB if needed
   */
  async getWorkoutDetails(workoutId: string): Promise<Workout | null> {
    if (this.getDeletedWorkoutIds().has(workoutId)) {
      return null;
    }
    try {
      const { data, error } = await insforge.database
        .from('workouts')
        .select('*')
        .eq('id', workoutId)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        const cached = this.getCachedWorkouts().find((w) => w.id === workoutId);
        return cached ? normalizeWorkout(cached) : null;
      }

      const workout = normalizeWorkout(data);

      // If route_coordinates is empty, fetch high-res points from workout_points table
      if (!workout.route_coordinates || workout.route_coordinates.length === 0) {
        try {
          const { data: pointsData } = await insforge.database
            .from('workout_points')
            .select('*')
            .eq('workout_id', workoutId)
            .order('sequence_number', { ascending: true });

          if (pointsData && pointsData.length > 0) {
            workout.route_coordinates = pointsData.map((pt: any) => ({
              latitude: Number(pt.latitude),
              longitude: Number(pt.longitude),
              altitude: pt.altitude != null ? Number(pt.altitude) : null,
              accuracy: pt.accuracy != null ? Number(pt.accuracy) : null,
              speed: pt.speed != null ? Number(pt.speed) : null,
              timestamp: new Date(pt.timestamp).getTime(),
              sequence_number: Number(pt.sequence_number),
            }));
          }
        } catch (ptErr) {
          console.warn('Failed to load points for workout details:', ptErr);
        }
      }

      // If splits is empty, fetch splits from workout_splits table
      if (!workout.splits || workout.splits.length === 0) {
        try {
          const { data: splitsData } = await insforge.database
            .from('workout_splits')
            .select('*')
            .eq('workout_id', workoutId)
            .order('split_number', { ascending: true });

          if (splitsData && splitsData.length > 0) {
            workout.splits = splitsData.map((s: any) => ({
              split_number: Number(s.split_number),
              distance_meters: Math.round(Number(s.distance_meters)),
              duration_seconds: Math.round(Number(s.duration_seconds)),
              pace: Math.round(Number(s.pace)),
            }));
          }
        } catch (splitErr) {
          console.warn('Failed to load splits for workout details:', splitErr);
        }
      }

      this.updateCachedWorkout(workout);
      return workout;
    } catch (err) {
      console.warn('Error fetching workout details from DB, checking cache:', err);
      const cached = this.getCachedWorkouts().find((w) => w.id === workoutId);
      return cached ? normalizeWorkout(cached) : null;
    }
  },

  /**
   * Fetch single workout by ID
   */
  async getWorkoutById(workoutId: string): Promise<Workout | null> {
    return this.getWorkoutDetails(workoutId);
  },

  /**
   * Update workout weather snapshot in cache and cloud
   */
  async updateWorkoutWeather(workoutId: string, weather: any): Promise<void> {
    try {
      const cached = this.getCachedWorkouts().find((w) => w.id === workoutId);
      if (cached) {
        cached.weather = weather;
        this.updateCachedWorkout(cached);
      }

      try {
        await insforge.database
          .from('workouts')
          .update({ weather })
          .eq('id', workoutId);
      } catch {
        // Fallback: encode into notes if weather column not present on remote DB
        if (cached) {
          const rawNotes = cached.notes || '';
          const clean = rawNotes.replace(/\[WEATHER:\s*[\s\S]*?\]/gi, '').replace(/^["'`]+|["'`]+$/g, '').trim();
          const updatedNotes = clean ? `${clean} [WEATHER:${JSON.stringify(weather)}]` : `[WEATHER:${JSON.stringify(weather)}]`;
          await insforge.database
            .from('workouts')
            .update({ notes: updatedNotes })
            .eq('id', workoutId);
        }
      }
    } catch (e) {
      console.warn('Failed to update workout weather:', e);
    }
  },

  /**
   * Set of deleted workout IDs to prevent resurrection from sync queues or legacy caches
   */
  getDeletedWorkoutIds(): Set<string> {
    try {
      const raw = localStorage.getItem('runwar_deleted_workout_ids');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return new Set(arr);
      }
    } catch {}
    return new Set();
  },

  markWorkoutAsDeleted(workoutId: string) {
    if (!workoutId) return;
    try {
      const set = this.getDeletedWorkoutIds();
      set.add(workoutId);
      const arr = Array.from(set).slice(-300);
      localStorage.setItem('runwar_deleted_workout_ids', JSON.stringify(arr));
    } catch {}
  },

  purgeWorkoutFromAllCaches(workoutId: string, userId?: string) {
    if (!workoutId) return;
    this.removeCachedWorkout(workoutId, userId);
    this.removeCachedWorkout(workoutId);
    this.removeCachedWorkout(workoutId, 'guest_user');

    // Thoroughly scan all localStorage keys for any arrays containing this workout or batch
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('runwar_') || key === WORKOUTS_CACHE_KEY)) {
          const raw = localStorage.getItem(key);
          if (raw && (raw.startsWith('[') || raw.startsWith('{'))) {
            try {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) {
                const filtered = parsed.filter(
                  (item: any) =>
                    item?.id !== workoutId &&
                    item?.workoutId !== workoutId &&
                    item?.workout_id !== workoutId
                );
                if (filtered.length !== parsed.length) {
                  localStorage.setItem(key, JSON.stringify(filtered));
                }
              }
            } catch {}
          }
        }
      }
    } catch (e) {
      console.warn('Error purging workout from localStorage:', e);
    }
  },

  /**
   * Delete workout instantly from database and purge from all local storage pools
   */
  async deleteWorkout(workoutId: string, userId?: string): Promise<void> {
    if (!workoutId) return;

    // 1. Mark as permanently deleted to stop any background sync reactivation
    this.markWorkoutAsDeleted(workoutId);

    // 2. Resolve canonical user ID
    let canonicalUserId = userId;
    if (!canonicalUserId || canonicalUserId === 'guest_user') {
      try {
        const { data: authData } = await insforge.auth.getCurrentUser();
        const authUser = (authData as any)?.user || authData;
        if (authUser?.id) canonicalUserId = authUser.id;
      } catch {}
    }

    // 3. Purge from local storage caches immediately (0ms instant UI reflection)
    this.purgeWorkoutFromAllCaches(workoutId, canonicalUserId);

    // 4. Delete from PostgreSQL database tables
    if (navigator.onLine) {
      try {
        await insforge.database
          .from('workout_points')
          .delete()
          .eq('workout_id', workoutId);
      } catch {}

      try {
        await insforge.database
          .from('workout_splits')
          .delete()
          .eq('workout_id', workoutId);
      } catch {}

      try {
        const { error } = await insforge.database
          .from('workouts')
          .delete()
          .eq('id', workoutId);
        if (error) {
          console.warn('InsForge database delete warning:', error);
        }
      } catch (err) {
        console.warn('Error during cloud workout deletion:', err);
      }
    }

    // 5. Broadcast global events so all active screens and components update immediately
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('runwar:workout_deleted', { detail: { workoutId } })
      );
      window.dispatchEvent(new CustomEvent('runwar:sync_completed'));
    }
  },

  /**
   * Get summary activity for Today (using user's local timezone)
   * Supports multiple workouts on the same day without overwriting
   */
  async getTodayStats(userId: string) {
    const workouts = await this.getWorkouts(userId, 'all', 'newest', 100);
    const now = new Date();

    const todayWorkouts = workouts.filter((w) => {
      return isSameLocalDate(w.started_at, now);
    });

    const totalDistanceMeters = todayWorkouts.reduce((acc, w) => acc + (Number(w.distance_meters) || 0), 0);
    const totalDurationSeconds = todayWorkouts.reduce((acc, w) => acc + (Number(w.duration_seconds) || 0), 0);
    const totalCalories = todayWorkouts.reduce((acc, w) => acc + (Number(w.calories) || 0), 0);
    const workoutCount = todayWorkouts.length;
    const avgPace = totalDistanceMeters > 0 ? totalDurationSeconds / (totalDistanceMeters / 1000) : 0;

    // Calculate streak
    const streak = this.calculateStreak(workouts);

    return {
      totalDistanceMeters,
      totalDurationSeconds,
      totalCalories,
      workoutCount,
      avgPace,
      streak,
      todayWorkouts,
    };
  },

  /**
   * Get weekly metrics and Monday-Sunday breakdown in local timezone
   */
  async getWeeklyStats(userId: string) {
    const workouts = await this.getWorkouts(userId, 'all', 'newest', 150);
    const now = new Date();
    const startOfWeek = getStartOfLocalWeek(now);

    const weekWorkouts = workouts.filter((w) => {
      const workoutDate = new Date(w.started_at);
      return workoutDate >= startOfWeek;
    });

    const totalDistanceMeters = weekWorkouts.reduce((acc, w) => acc + (Number(w.distance_meters) || 0), 0);
    const totalDurationSeconds = weekWorkouts.reduce((acc, w) => acc + (Number(w.duration_seconds) || 0), 0);
    const totalCalories = weekWorkouts.reduce((acc, w) => acc + (Number(w.calories) || 0), 0);
    const workoutCount = weekWorkouts.length;
    const avgPace = totalDistanceMeters > 0 ? totalDurationSeconds / (totalDistanceMeters / 1000) : 0;

    // Daily breakdown for Mon-Sun
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dailyDistance = [0, 0, 0, 0, 0, 0, 0];
    const dailyRunCounts = [0, 0, 0, 0, 0, 0, 0];

    weekWorkouts.forEach((w) => {
      const d = new Date(w.started_at);
      const dayIndex = (d.getDay() + 6) % 7; // Convert 0(Sun)->6, 1(Mon)->0
      dailyDistance[dayIndex] += Number(w.distance_meters) || 0;
      dailyRunCounts[dayIndex] += 1;
    });

    return {
      totalDistanceMeters,
      totalDurationSeconds,
      totalCalories,
      workoutCount,
      avgPace,
      dayNames,
      dailyDistance,
      dailyRunCounts,
      longestRunMeters: weekWorkouts.reduce((max, w) => Math.max(max, Number(w.distance_meters) || 0), 0),
    };
  },

  /**
   * Streak calculation (consecutive active calendar days in local timezone)
   */
  calculateStreak(workouts: Workout[]): { currentStreak: number; longestStreak: number } {
    if (workouts.length === 0) return { currentStreak: 0, longestStreak: 0 };

    const activeDates = new Set(
      workouts.map((w) => getLocalDateKey(w.started_at)).filter(Boolean)
    );

    const sortedDates = Array.from(activeDates).sort().reverse();
    if (sortedDates.length === 0) return { currentStreak: 0, longestStreak: 0 };

    const now = new Date();
    const todayKey = getLocalDateKey(now);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = getLocalDateKey(yesterday);

    let currentStreak = 0;
    let checkDate = activeDates.has(todayKey)
      ? new Date()
      : activeDates.has(yesterdayKey)
      ? yesterday
      : null;

    if (checkDate) {
      const cursor = new Date(checkDate);
      while (true) {
        const dateKey = getLocalDateKey(cursor);
        if (activeDates.has(dateKey)) {
          currentStreak++;
          cursor.setDate(cursor.getDate() - 1);
        } else {
          break;
        }
      }
    }

    // Longest streak calculation
    let longestStreak = 0;
    let tempStreak = 0;
    const chronDates = Array.from(activeDates).sort().map((d) => new Date(`${d}T00:00:00`));

    for (let i = 0; i < chronDates.length; i++) {
      if (i === 0) {
        tempStreak = 1;
      } else {
        const diffDays = Math.round(
          (chronDates[i].getTime() - chronDates[i - 1].getTime()) / (1000 * 60 * 60 * 24)
        );
        if (diffDays === 1) {
          tempStreak++;
        } else if (diffDays > 1) {
          tempStreak = 1;
        }
      }
      longestStreak = Math.max(longestStreak, tempStreak);
    }

    return { currentStreak, longestStreak: Math.max(longestStreak, currentStreak) };
  },

  // User-scoped cache helpers
  getCacheKey(userId?: string): string {
    if (!userId || userId === 'guest_user' || userId === 'usr_guest_demo') {
      return WORKOUTS_CACHE_KEY;
    }
    return `${WORKOUTS_CACHE_KEY}_${userId}`;
  },

  getCachedWorkouts(userId?: string): Workout[] {
    try {
      const key = this.getCacheKey(userId);
      const data = localStorage.getItem(key);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          return parsed.map(normalizeWorkout);
        }
      }
      // Fallback check on base cache key for this user
      if (userId && userId !== 'guest_user') {
        const legacyData = localStorage.getItem(WORKOUTS_CACHE_KEY);
        if (legacyData) {
          const parsed = JSON.parse(legacyData);
          if (Array.isArray(parsed)) {
            const userOnly = parsed.filter((w: any) => w.user_id === userId).map(normalizeWorkout);
            if (userOnly.length > 0) {
              this.saveWorkoutsCache(userOnly, userId);
              return userOnly;
            }
          }
        }
      }
      return [];
    } catch {
      return [];
    }
  },

  saveWorkoutsCache(workouts: Workout[], userId?: string) {
    try {
      const key = this.getCacheKey(userId || workouts[0]?.user_id);
      localStorage.setItem(key, JSON.stringify(workouts));
    } catch (e) {
      console.warn('Failed to cache workouts:', e);
    }
  },

  addWorkoutToCache(workout: Workout, userId?: string) {
    const targetUserId = userId || workout.user_id;
    const cached = this.getCachedWorkouts(targetUserId);
    const normalized = normalizeWorkout(workout);
    const targetExtKey = normalized.source_provider && normalized.external_record_id
      ? `${normalized.source_provider}_${normalized.external_record_id}`
      : null;
    const targetTime = new Date(normalized.started_at).getTime();

    const filtered = cached.filter((w) => {
      if (w.id === normalized.id) return false;
      if (targetExtKey && w.source_provider && w.external_record_id && `${w.source_provider}_${w.external_record_id}` === targetExtKey) {
        return false;
      }
      const wTime = new Date(w.started_at).getTime();
      if (!isNaN(targetTime) && !isNaN(wTime) && Math.abs(wTime - targetTime) < 120 * 1000 && w.source_provider === normalized.source_provider) {
        return false;
      }
      return true;
    });

    const updated = [normalized, ...filtered];
    this.saveWorkoutsCache(updated, targetUserId);
  },

  updateCachedWorkout(workout: Workout, userId?: string) {
    const targetUserId = userId || workout.user_id;
    const cached = this.getCachedWorkouts(targetUserId);
    const normalized = normalizeWorkout(workout);
    const updated = cached.map((w) => (w.id === normalized.id ? normalized : w));
    this.saveWorkoutsCache(updated, targetUserId);
  },

  removeCachedWorkout(workoutId: string, userId?: string) {
    const cached = this.getCachedWorkouts(userId);
    const updated = cached.filter((w) => w.id !== workoutId);
    this.saveWorkoutsCache(updated, userId);
  },

  clearUserCache(userId?: string) {
    try {
      if (userId) {
        localStorage.removeItem(this.getCacheKey(userId));
      } else {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(WORKOUTS_CACHE_KEY)) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
      }
    } catch {}
  },

  /**
   * Unconditionally purge all fake sandbox demo workouts from PostgreSQL and all local caches.
   * Can be called whenever real Strava is connected, on app startup, or when unlinking demo.
   */
  async purgeDemoWorkouts(userId?: string): Promise<number> {
    let deletedCount = 0;
    const targetUserId = userId || 'guest_user';

    // 1. Delete from PostgreSQL if online
    if (navigator.onLine) {
      const candidateUserIds = Array.from(
        new Set([targetUserId, 'guest_user', 'usr_guest_demo'].filter(Boolean))
      ) as string[];

      for (const uid of candidateUserIds) {
        // Direct title matching (works 100% in PostgreSQL regardless of schema columns)
        try {
          await insforge.database
            .from('workouts')
            .delete()
            .eq('user_id', uid)
            .eq('title', 'Sunrise 5K Run');
        } catch {}

        try {
          await insforge.database
            .from('workouts')
            .delete()
            .eq('user_id', uid)
            .eq('title', 'Weekend Trail Interval');
        } catch {}

        // Match by deterministic demo UUIDs
        const demoIds = [
          toDeterministicUUID(`strava_demo_101_${uid}`),
          toDeterministicUUID(`strava_demo_102_${uid}`),
          toDeterministicUUID('strava_demo_101_guest_user'),
          toDeterministicUUID('strava_demo_102_guest_user'),
        ];
        for (const did of demoIds) {
          try {
            await insforge.database.from('workouts').delete().eq('id', did);
          } catch {}
        }
      }
    }

    // 2. Wipe from ALL localStorage caches
    const purgeKey = (key: string) => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((w: any) => !isDemoWorkout(w));
          if (filtered.length !== parsed.length) {
            localStorage.setItem(key, JSON.stringify(filtered));
            deletedCount += (parsed.length - filtered.length);
          }
        }
      } catch {}
    };

    purgeKey(this.getCacheKey(targetUserId));
    purgeKey(this.getCacheKey('guest_user'));
    purgeKey(WORKOUTS_CACHE_KEY);
    purgeKey('runwar_offline_workouts_queue');

    try {
      const allKeys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k) allKeys.push(k);
      }
      for (const k of allKeys) {
        if (k.startsWith('runwar_')) {
          purgeKey(k);
        }
      }
    } catch {}

    return deletedCount;
  },

  /**
   * Delete all workouts imported from a specific provider (e.g. 'strava' or 'google_health')
   * Purges them from InsForge database and local caches, and notifies app listeners
   */
  async deleteWorkoutsByProvider(provider: string, userId?: string): Promise<number> {
    if (provider === 'strava') {
      await this.purgeDemoWorkouts(userId);
    }
    // 1. Resolve canonical user ID from all potential sources
    let canonicalUserId = userId;
    if (!canonicalUserId || canonicalUserId === 'guest_user' || canonicalUserId === 'usr_guest_demo') {
      try {
        const { data: authData } = await insforge.auth.getCurrentUser();
        const authUser = (authData as any)?.user || authData;
        if (authUser?.id) {
          canonicalUserId = authUser.id;
        }
      } catch {}
    }
    if (!canonicalUserId || canonicalUserId === 'guest_user') {
      try {
        const rawCached = localStorage.getItem('runwar_cached_user');
        if (rawCached) {
          const parsed = JSON.parse(rawCached);
          if (parsed?.id) canonicalUserId = parsed.id;
        }
      } catch {}
    }

    let deletedCount = 0;

    // 2. Delete from PostgreSQL if online
    if (navigator.onLine) {
      const userIdsToDelete = Array.from(
        new Set([canonicalUserId, userId, 'guest_user'].filter(Boolean))
      ) as string[];

      for (const targetId of userIdsToDelete) {
        if (!targetId) continue;

        // Try deleting by source_provider
        try {
          const { data, error } = await insforge.database
            .from('workouts')
            .delete()
            .eq('user_id', targetId)
            .eq('source_provider', provider)
            .select('id');

          if (!error && Array.isArray(data)) {
            deletedCount += data.length;
          }
        } catch (err) {
          console.warn(`Error deleting ${provider} workouts from cloud by source_provider:`, err);
        }

        // If provider is strava, also delete by notes / title / deterministic IDs
        if (provider === 'strava') {
          try {
            await insforge.database
              .from('workouts')
              .delete()
              .eq('user_id', targetId)
              .ilike('notes', '%strava%');
          } catch {}

          try {
            await insforge.database
              .from('workouts')
              .delete()
              .eq('user_id', targetId)
              .ilike('title', '%Sunrise 5K Run%');
          } catch {}

          try {
            await insforge.database
              .from('workouts')
              .delete()
              .eq('user_id', targetId)
              .ilike('title', '%Weekend Trail Interval%');
          } catch {}

          // Specific demo IDs generated by toDeterministicUUID
          const demoIds = [
            toDeterministicUUID(`strava_demo_101_${targetId}`),
            toDeterministicUUID(`strava_demo_102_${targetId}`),
            toDeterministicUUID('strava_demo_101_guest_user'),
            toDeterministicUUID('strava_demo_102_guest_user'),
          ];
          for (const did of demoIds) {
            try {
              await insforge.database.from('workouts').delete().eq('id', did);
            } catch {}
          }
        }
      }
    }

    // 3. Purge from ALL LocalStorage keys
    const isTargetWorkout = (w: any): boolean => {
      if (!w) return false;
      if (w.source_provider === provider) return true;
      if (provider === 'strava' && isStravaWorkout(w)) return true;
      return false;
    };

    const purgeKey = (key: string) => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const beforeLen = parsed.length;
          const filtered = parsed.filter((w: any) => !isTargetWorkout(w));
          if (filtered.length !== beforeLen) {
            localStorage.setItem(key, JSON.stringify(filtered));
            deletedCount += (beforeLen - filtered.length);
          }
        }
      } catch {}
    };

    // Specific known cache keys
    if (canonicalUserId) purgeKey(this.getCacheKey(canonicalUserId));
    if (userId) purgeKey(this.getCacheKey(userId));
    purgeKey(this.getCacheKey('guest_user'));
    purgeKey(WORKOUTS_CACHE_KEY);
    purgeKey('runwar_offline_workouts_queue');

    // Dynamically scan every single key in localStorage to ensure zero residue
    try {
      const allKeys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k) allKeys.push(k);
      }
      for (const k of allKeys) {
        if (k.startsWith('runwar_') && (k.includes('workout') || k.includes('queue'))) {
          purgeKey(k);
        }
      }
    } catch {}

    // 4. Dispatch global custom events so all screens and memory states instantly refresh
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('runwar:workouts_purged', { detail: { provider } })
      );
      window.dispatchEvent(new CustomEvent('runwar:sync_completed'));
    }

    return deletedCount;
  },

  /**
   * Subscribe to realtime PostgreSQL changes on the workouts table for a user.
   * Ensures mobile and desktop/laptop instantly sync without manual page reloads.
   */
  subscribeToUserWorkouts(
    userId: string,
    onChange: (event: { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; workout?: Workout; id?: string }) => void
  ): () => void {
    if (!userId || userId === 'guest_user' || userId === 'usr_guest_demo') {
      return () => {};
    }

    try {
      const channelName = `workouts:${userId}`;
      if (insforge.realtime && typeof insforge.realtime.subscribe === 'function') {
        insforge.realtime.subscribe(channelName).catch(() => {});
        const handler = (msg: any) => {
          if (msg?.channel === channelName || msg?.table === 'workouts' || msg?.user_id === userId) {
            const eventType = (msg?.eventType || msg?.event || 'INSERT') as 'INSERT' | 'UPDATE' | 'DELETE';
            const record = msg?.payload?.new || msg?.payload || msg?.data;
            const workout = record ? normalizeWorkout(record) : undefined;
            onChange({
              eventType,
              workout,
              id: record?.id || msg?.id,
            });
          }
        };
        insforge.realtime.on('message', handler);
        return () => {
          try {
            insforge.realtime.off('message', handler);
            insforge.realtime.unsubscribe(channelName);
          } catch {}
        };
      }
      return () => {};
    } catch (e) {
      console.warn('Failed to subscribe to realtime workouts channel:', e);
      return () => {};
    }
  },
  /**
   * Scan local cache and offline queue for any workouts not yet in InsForge and upload them.
   * Also migrates any guest workouts recorded locally if the user is now authenticated.
   */
  async syncPendingWorkouts(userId: string): Promise<number> {
    if (!userId || userId === 'guest_user' || userId === 'usr_guest_demo' || !navigator.onLine) return 0;

    let syncedCount = 0;
    try {
      // 1. Check all local cache pools: user cache and base/guest cache
      const userCached = this.getCachedWorkouts(userId);
      const guestCached = this.getCachedWorkouts('guest_user');
      const allLocal = [...userCached, ...guestCached];

      const seenIds = new Set<string>();
      const candidateWorkouts: Workout[] = [];
      for (const w of allLocal) {
        if (!seenIds.has(w.id) && (w.status === 'completed' || !w.status)) {
          seenIds.add(w.id);
          candidateWorkouts.push(w);
        }
      }

      if (candidateWorkouts.length === 0) return 0;

      // 2. Fetch existing cloud IDs to know what is missing
      const { data: cloudList } = await insforge.database
        .from('workouts')
        .select('id')
        .eq('user_id', userId);

      const existingCloudIds = new Set((cloudList || []).map((r: any) => r.id));
      const deletedIds = this.getDeletedWorkoutIds();
      const missingWorkouts = candidateWorkouts.filter(
        (w) => !existingCloudIds.has(w.id) && !deletedIds.has(w.id)
      );

      // Immediately purge any deleted workouts that lingered in candidateWorkouts
      for (const w of candidateWorkouts) {
        if (deletedIds.has(w.id)) {
          this.purgeWorkoutFromAllCaches(w.id, userId);
        }
      }

      for (const w of missingWorkouts) {
        const payload = {
          id: w.id,
          user_id: userId,
          type: w.type,
          title: w.title,
          notes: w.notes || null,
          started_at: w.started_at,
          ended_at: w.ended_at,
          duration_seconds: w.duration_seconds,
          moving_duration_seconds: w.moving_duration_seconds || w.duration_seconds,
          paused_duration_seconds: w.paused_duration_seconds || 0,
          distance_meters: w.distance_meters,
          average_pace: w.average_pace,
          average_speed: w.average_speed,
          max_speed: w.max_speed || 0,
          calories: w.calories || 0,
          elevation_gain: w.elevation_gain || 0,
          elevation_loss: w.elevation_loss || 0,
          status: 'completed',
          route_coordinates: w.route_coordinates,
          splits: w.splits,
        };

        const { error } = await insforge.database
          .from('workouts')
          .upsert([payload], { onConflict: 'id' });

        if (!error) {
          syncedCount++;
          // Batch splits
          if (w.splits && w.splits.length > 0) {
            const splitsPayload = w.splits.map((s) => ({
              workout_id: w.id,
              user_id: userId,
              split_number: s.split_number,
              distance_meters: s.distance_meters,
              duration_seconds: s.duration_seconds,
              pace: s.pace,
            }));
            try {
              await insforge.database.from('workout_splits').insert(splitsPayload);
            } catch {}
          }
        }
      }

      // Also process the syncQueue
      await syncQueue.processWorkoutQueue();

      if (syncedCount > 0 && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('runwar:sync_completed'));
      }
    } catch (err) {
      console.warn('Error during pending workouts sync:', err);
    }
    return syncedCount;
  },
};
