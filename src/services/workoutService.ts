import { insforge } from '../lib/insforge';
import { Workout, WorkoutType } from '../types';
import { achievementsService } from './achievementsService';
import { recordsService } from './recordsService';
import { goalsService } from './goalsService';
import { syncQueue } from './syncQueue';
import { workoutLogger } from '../utils/workoutLogger';

const WORKOUTS_CACHE_KEY = 'runwar_cached_workouts';

export const workoutService = {
  /**
   * Save a newly finished workout to InsForge database with offline fallback
   */
  async saveWorkout(workout: Omit<Workout, 'id' | 'created_at'> & { id?: string }): Promise<Workout> {
    const workoutId = workout.id || crypto.randomUUID();

    const newWorkoutPayload = {
      id: workoutId,
      user_id: workout.user_id,
      type: workout.type,
      title: workout.title || `${workout.type.charAt(0).toUpperCase() + workout.type.slice(1)} Workout`,
      notes: workout.notes || '',
      started_at: workout.started_at,
      ended_at: workout.ended_at,
      duration_seconds: workout.duration_seconds,
      moving_duration_seconds: workout.moving_duration_seconds || workout.duration_seconds,
      paused_duration_seconds: workout.paused_duration_seconds || 0,
      distance_meters: workout.distance_meters,
      average_pace: workout.average_pace,
      average_speed: workout.average_speed,
      max_speed: workout.max_speed || 0,
      calories: workout.calories,
      elevation_gain: workout.elevation_gain || 0,
      elevation_loss: workout.elevation_loss || 0,
      status: workout.status || 'completed',
      route_coordinates: workout.route_coordinates || [],
      splits: workout.splits || [],
    };

    if (!navigator.onLine) {
      // Local-first: immediately cache and queue for background sync
      const localWorkout: Workout = {
        ...newWorkoutPayload,
        created_at: new Date().toISOString(),
      };
      this.addWorkoutToCache(localWorkout);
      syncQueue.queueCompletedWorkout(newWorkoutPayload);
      workoutLogger.log('SYNC_BATCH_QUEUED', 'info', {
        workoutId,
        offline: true,
      }, workoutId);
      return localWorkout;
    }

    try {
      // 1. Insert into workouts table (with upsert/idempotency)
      const { data: insertedWorkout, error: workoutError } = await insforge.database
        .from('workouts')
        .insert([newWorkoutPayload])
        .select()
        .single();

      if (workoutError) throw workoutError;
      const savedWorkout = insertedWorkout as Workout;

      // 2. Batch insert splits if any
      if (workout.splits && workout.splits.length > 0) {
        const splitsPayload = workout.splits.map((s) => ({
          workout_id: savedWorkout.id,
          user_id: savedWorkout.user_id,
          split_number: s.split_number,
          distance_meters: s.distance_meters,
          duration_seconds: s.duration_seconds,
          pace: s.pace,
        }));

        await insforge.database.from('workout_splits').insert(splitsPayload);
      }

      // 3. Batch insert GPS points (in chunks of 50 to prevent packet overflow)
      if (workout.route_coordinates && workout.route_coordinates.length > 0) {
        const chunkSize = 50;
        for (let i = 0; i < workout.route_coordinates.length; i += chunkSize) {
          const chunk = workout.route_coordinates.slice(i, i + chunkSize);
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

          await insforge.database.from('workout_points').insert(pointsPayload);
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

      // Update local cache
      this.addWorkoutToCache(savedWorkout);
      return savedWorkout;
    } catch (error) {
      console.error('Failed to save workout to cloud DB, falling back to local queue:', error);
      const fallbackWorkout: Workout = {
        ...newWorkoutPayload,
        created_at: new Date().toISOString(),
      };
      this.addWorkoutToCache(fallbackWorkout);
      syncQueue.queueCompletedWorkout(newWorkoutPayload);
      return fallbackWorkout;
    }
  },

  /**
   * Fetch workouts for a user with optional filtering and sorting
   */
  async getWorkouts(
    userId: string,
    filterType: WorkoutType | 'all' = 'all',
    sortBy: 'newest' | 'oldest' | 'longest' | 'fastest' | 'calories' = 'newest',
    limit: number = 50
  ): Promise<Workout[]> {
    try {
      let query = insforge.database
        .from('workouts')
        .select('*')
        .eq('user_id', userId);

      if (filterType !== 'all') {
        query = query.eq('type', filterType);
      }

      switch (sortBy) {
        case 'oldest':
          query = query.order('started_at', { ascending: true });
          break;
        case 'longest':
          query = query.order('distance_meters', { ascending: false });
          break;
        case 'fastest':
          query = query.order('average_pace', { ascending: true });
          break;
        case 'calories':
          query = query.order('calories', { ascending: false });
          break;
        case 'newest':
        default:
          query = query.order('started_at', { ascending: false });
          break;
      }

      query = query.limit(limit);

      const { data, error } = await query;
      if (error) throw error;

      if (data) {
        this.saveWorkoutsCache(data as Workout[]);
        return data as Workout[];
      }
      return [];
    } catch (err) {
      console.warn('Failed to fetch workouts from DB, using cached workouts:', err);
      const cached = this.getCachedWorkouts();
      let filtered = cached.filter((w) => w.user_id === userId);
      if (filterType !== 'all') {
        filtered = filtered.filter((w) => w.type === filterType);
      }
      return filtered;
    }
  },

  /**
   * Fetch single workout by ID
   */
  async getWorkoutById(workoutId: string): Promise<Workout | null> {
    try {
      const { data, error } = await insforge.database
        .from('workouts')
        .select('*')
        .eq('id', workoutId)
        .single();

      if (error) throw error;
      return data as Workout;
    } catch (err) {
      const cached = this.getCachedWorkouts().find((w) => w.id === workoutId);
      return cached || null;
    }
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
    this.updateCachedWorkout(data as Workout);
    return data as Workout;
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
   * Get summary activity for Today
   */
  async getTodayStats(userId: string) {
    const workouts = await this.getWorkouts(userId, 'all', 'newest', 100);
    const todayStr = new Date().toDateString();

    const todayWorkouts = workouts.filter((w) => {
      return new Date(w.started_at).toDateString() === todayStr;
    });

    const totalDistanceMeters = todayWorkouts.reduce((acc, w) => acc + (w.distance_meters || 0), 0);
    const totalDurationSeconds = todayWorkouts.reduce((acc, w) => acc + (w.duration_seconds || 0), 0);
    const totalCalories = todayWorkouts.reduce((acc, w) => acc + (w.calories || 0), 0);
    const workoutCount = todayWorkouts.length;
    const avgPace = totalDistanceMeters > 0 ? (totalDurationSeconds / (totalDistanceMeters / 1000)) : 0;

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
   * Get weekly metrics and Monday-Sunday breakdown
   */
  async getWeeklyStats(userId: string) {
    const workouts = await this.getWorkouts(userId, 'all', 'newest', 150);
    const now = new Date();
    
    // Start of current week (Monday)
    const currentDay = now.getDay(); // 0 is Sunday, 1 is Mon...
    const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() + diffToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    const weekWorkouts = workouts.filter((w) => {
      const workoutDate = new Date(w.started_at);
      return workoutDate >= startOfWeek;
    });

    const totalDistanceMeters = weekWorkouts.reduce((acc, w) => acc + (w.distance_meters || 0), 0);
    const totalDurationSeconds = weekWorkouts.reduce((acc, w) => acc + (w.duration_seconds || 0), 0);
    const totalCalories = weekWorkouts.reduce((acc, w) => acc + (w.calories || 0), 0);
    const workoutCount = weekWorkouts.length;
    const avgPace = totalDistanceMeters > 0 ? (totalDurationSeconds / (totalDistanceMeters / 1000)) : 0;

    // Daily breakdown for Mon-Sun
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dailyDistance = [0, 0, 0, 0, 0, 0, 0];

    weekWorkouts.forEach((w) => {
      const d = new Date(w.started_at);
      const dayIndex = (d.getDay() + 6) % 7; // Convert 0(Sun)->6, 1(Mon)->0
      dailyDistance[dayIndex] += w.distance_meters;
    });

    return {
      totalDistanceMeters,
      totalDurationSeconds,
      totalCalories,
      workoutCount,
      avgPace,
      dayNames,
      dailyDistance,
      longestRunMeters: weekWorkouts.reduce((max, w) => Math.max(max, w.distance_meters), 0),
    };
  },

  /**
   * Streak calculation (consecutive active days)
   */
  calculateStreak(workouts: Workout[]): { currentStreak: number; longestStreak: number } {
    if (workouts.length === 0) return { currentStreak: 0, longestStreak: 0 };

    const activeDates = new Set(
      workouts.map((w) => new Date(w.started_at).toISOString().split('T')[0])
    );

    const sortedDates = Array.from(activeDates).sort().reverse();
    if (sortedDates.length === 0) return { currentStreak: 0, longestStreak: 0 };

    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    let currentStreak = 0;
    let checkDate = activeDates.has(todayStr) ? new Date() : activeDates.has(yesterdayStr) ? yesterday : null;

    if (checkDate) {
      while (true) {
        const dateStr = checkDate.toISOString().split('T')[0];
        if (activeDates.has(dateStr)) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    // Longest streak calculation
    let longestStreak = 0;
    let tempStreak = 0;
    const chronDates = Array.from(activeDates).sort().map((d) => new Date(d));

    for (let i = 0; i < chronDates.length; i++) {
      if (i === 0) {
        tempStreak = 1;
      } else {
        const diffDays = Math.round(
          (chronDates[i].getTime() - chronDates[i - 1].getTime()) / (1000 * 60 * 60 * 24)
        );
        if (diffDays === 1) {
          tempStreak++;
        } else {
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
    const updated = [workout, ...cached.filter((w) => w.id !== workout.id)];
    this.saveWorkoutsCache(updated);
  },

  updateCachedWorkout(workout: Workout) {
    const cached = this.getCachedWorkouts();
    const updated = cached.map((w) => (w.id === workout.id ? workout : w));
    this.saveWorkoutsCache(updated);
  },

  removeCachedWorkout(workoutId: string) {
    const cached = this.getCachedWorkouts();
    const updated = cached.filter((w) => w.id !== workoutId);
    this.saveWorkoutsCache(updated);
  },
};
