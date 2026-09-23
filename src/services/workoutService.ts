import { insforge } from '../lib/insforge';
import { Workout, WorkoutType } from '../types';
import { achievementsService } from './achievementsService';
import { recordsService } from './recordsService';
import { goalsService } from './goalsService';
import { syncQueue } from './syncQueue';
import { workoutLogger } from '../utils/workoutLogger';
import { getLocalDateKey, getStartOfLocalWeek, isSameLocalDate } from '../utils/dateUtils';

const WORKOUTS_CACHE_KEY = 'runwar_cached_workouts';

export interface SaveWorkoutResult {
  workout: Workout;
  isCloudSynced: boolean;
  message: string;
}

function normalizeWorkout(raw: any): Workout {
  const type: WorkoutType = ['run', 'jog', 'walk'].includes(raw.type) ? raw.type : 'run';
  const status: 'completed' | 'paused' | 'discarded' = ['completed', 'paused', 'discarded'].includes(raw.status)
    ? raw.status
    : 'completed';
  return {
    id: raw.id || crypto.randomUUID(),
    user_id: raw.user_id || 'guest_user',
    type,
    title: raw.title || `${type.charAt(0).toUpperCase() + type.slice(1)} Session`,
    notes: raw.notes || null,
    started_at: raw.started_at || new Date().toISOString(),
    ended_at: raw.ended_at || new Date().toISOString(),
    duration_seconds: Math.round(Number(raw.duration_seconds) || 0),
    moving_duration_seconds: Math.round(Number(raw.moving_duration_seconds) || Number(raw.duration_seconds) || 0),
    paused_duration_seconds: Math.round(Number(raw.paused_duration_seconds) || 0),
    distance_meters: Math.round(Number(raw.distance_meters) || 0),
    average_pace: Math.round(Number(raw.average_pace) || 0),
    average_speed: Number(Number(raw.average_speed || 0).toFixed(2)),
    max_speed: Number(Number(raw.max_speed || 0).toFixed(2)),
    calories: Math.round(Number(raw.calories) || 0),
    elevation_gain: Math.round(Number(raw.elevation_gain) || 0),
    elevation_loss: Math.round(Number(raw.elevation_loss) || 0),
    status,
    route_coordinates: Array.isArray(raw.route_coordinates) ? raw.route_coordinates : [],
    splits: Array.isArray(raw.splits) ? raw.splits : [],
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

    // Clean payload matching PostgreSQL workouts table schema
    const dbWorkoutPayload = {
      id: normalized.id,
      user_id: normalized.user_id,
      type: normalized.type,
      title: normalized.title,
      notes: normalized.notes || null,
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
    };

    // Guest users skip cloud sync entirely — local cache only
    const isGuestUser = normalized.user_id === 'guest_user' || normalized.user_id === 'usr_guest_demo';
    if (isGuestUser) {
      const localWorkout: Workout = {
        ...normalized,
        created_at: new Date().toISOString(),
      };
      this.addWorkoutToCache(localWorkout);
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
        created_at: new Date().toISOString(),
      };
      this.addWorkoutToCache(localWorkout);
      syncQueue.queueCompletedWorkout(newWorkoutPayload);
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
      // 1. Insert or upsert into workouts table (idempotent)
      const { data: insertedWorkout, error: workoutError } = await insforge.database
        .from('workouts')
        .upsert([dbWorkoutPayload], { onConflict: 'id' })
        .select()
        .single();

      if (workoutError) throw workoutError;
      const savedWorkout = normalizeWorkout(insertedWorkout || {
        ...newWorkoutPayload,
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

      // 4. Evaluate Goals, Achievements & Personal Records
      try {
        await Promise.allSettled([
          goalsService.updateProgress(savedWorkout.user_id),
          achievementsService.checkAchievements(savedWorkout.user_id, savedWorkout),
          recordsService.checkPersonalRecords(savedWorkout.user_id, savedWorkout),
        ]);
      } catch (e) {
        console.warn('Error evaluating badges/goals after save:', e);
      }

      // 5. Update local cache with confirmed record
      this.addWorkoutToCache(savedWorkout);
      return {
        workout: savedWorkout,
        isCloudSynced: true,
        message: 'Workout saved successfully!',
      };
    } catch (error) {
      console.error('Failed to save workout to cloud DB, falling back to local queue:', error);
      const fallbackWorkout: Workout = {
        ...normalized,
        created_at: new Date().toISOString(),
      };
      this.addWorkoutToCache(fallbackWorkout);
      syncQueue.queueCompletedWorkout(newWorkoutPayload);
      return {
        workout: fallbackWorkout,
        isCloudSynced: false,
        message: "Workout saved locally. We'll sync it when you're connected.",
      };
    }
  },

  /**
   * Fetch workouts for a user with category filtering and sorting.
   * Merges cloud and cached local workouts so no saved session is ever missed.
   */
  async getWorkouts(
    userId: string,
    filterType: WorkoutType | 'all' = 'all',
    sortBy: 'newest' | 'oldest' | 'longest' | 'fastest' | 'calories' = 'newest',
    limit: number = 100
  ): Promise<Workout[]> {
    let cloudWorkouts: Workout[] = [];

    try {
      // Guest users skip cloud fetch entirely
      if (userId && userId !== 'guest_user' && userId !== 'usr_guest_demo') {
        let query = insforge.database
          .from('workouts')
          .select('*')
          .eq('user_id', userId)
          .order('started_at', { ascending: false })
          .limit(limit);

        const { data, error } = await query;
        if (!error && data && Array.isArray(data)) {
          cloudWorkouts = data.map(normalizeWorkout);
        }
      }
    } catch (err) {
      console.warn('Cloud fetch workouts warning:', err);
    }

    // Merge cloud and cached local workouts
    const cachedWorkouts = this.getCachedWorkouts().map(normalizeWorkout);
    const map = new Map<string, Workout>();

    // Put cached first
    cachedWorkouts.forEach((w) => {
      if (!userId || w.user_id === userId || w.user_id === 'guest_user' || w.user_id === 'usr_guest_demo') {
        map.set(w.id, w);
      }
    });

    // Overlay cloud workouts (source of truth for synced records)
    cloudWorkouts.forEach((w) => {
      map.set(w.id, w);
    });

    const allWorkouts = Array.from(map.values()).filter((w) => w.status === 'completed' || !w.status);
    this.saveWorkoutsCache(allWorkouts);

    // Filter by type if requested
    let filtered = allWorkouts;
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
   * Update workout title or notes
   */
  async updateWorkout(workoutId: string, updates: { title?: string; notes?: string }): Promise<Workout> {
    const { data, error } = await insforge.database
      .from('workouts')
      .update(updates)
      .eq('id', workoutId)
      .select()
      .single();

    if (error) throw error;
    const normalized = normalizeWorkout(data);
    this.updateCachedWorkout(normalized);
    return normalized;
  },

  /**
   * Delete workout
   */
  async deleteWorkout(workoutId: string): Promise<void> {
    const { error } = await insforge.database
      .from('workouts')
      .delete()
      .eq('id', workoutId);

    if (error) throw error;
    this.removeCachedWorkout(workoutId);
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

  // Cache helpers
  getCachedWorkouts(): Workout[] {
    try {
      const data = localStorage.getItem(WORKOUTS_CACHE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveWorkoutsCache(workouts: Workout[]) {
    try {
      localStorage.setItem(WORKOUTS_CACHE_KEY, JSON.stringify(workouts));
    } catch (e) {
      console.warn('Failed to cache workouts:', e);
    }
  },

  addWorkoutToCache(workout: Workout) {
    const cached = this.getCachedWorkouts();
    const normalized = normalizeWorkout(workout);
    const updated = [normalized, ...cached.filter((w) => w.id !== normalized.id)];
    this.saveWorkoutsCache(updated);
  },

  updateCachedWorkout(workout: Workout) {
    const cached = this.getCachedWorkouts();
    const normalized = normalizeWorkout(workout);
    const updated = cached.map((w) => (w.id === normalized.id ? normalized : w));
    this.saveWorkoutsCache(updated);
  },

  removeCachedWorkout(workoutId: string) {
    const cached = this.getCachedWorkouts();
    const updated = cached.filter((w) => w.id !== workoutId);
    this.saveWorkoutsCache(updated);
  },
};
