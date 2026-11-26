import { insforge } from '../lib/insforge';
import { Goal } from '../types';
import { workoutService } from './workoutService';
import { toDeterministicUUID } from '../utils/uuid';

const GOALS_CACHE_KEY_PREFIX = 'runwar_cached_goals_';

const isGuest = (userId: string) => !userId || userId === 'guest_user' || userId === 'usr_guest_demo';

function getCacheKey(userId: string): string {
  const scope = isGuest(userId) ? (userId || 'guest_user') : toDeterministicUUID(userId);
  return `${GOALS_CACHE_KEY_PREFIX}${scope}`;
}

function getLocalGoals(userId: string): Goal[] {
  try {
    const raw = localStorage.getItem(getCacheKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalGoals(userId: string, goals: Goal[]) {
  try {
    localStorage.setItem(getCacheKey(userId), JSON.stringify(goals));
  } catch (e) {
    console.warn('Failed to cache goals:', e);
  }
}

function updateCachedGoalAcrossKeys(updater: (goals: Goal[]) => Goal[]) {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(GOALS_CACHE_KEY_PREFIX)) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            localStorage.setItem(key, JSON.stringify(updater(parsed)));
          }
        }
      }
    }
  } catch {}
}

export const goalsService = {
  /**
   * Fetch user goals from InsForge or local cache for guest
   */
  async getGoals(userId: string): Promise<Goal[]> {
    if (isGuest(userId)) {
      return getLocalGoals(userId);
    }

    const normalizedId = toDeterministicUUID(userId);

    try {
      const { data, error } = await insforge.database
        .from('goals')
        .select('*')
        .eq('user_id', normalizedId)
        .order('created_at', { ascending: false });

      if (error) {
        if (error.message && error.message.trim().length > 0) {
          console.warn('Failed to fetch goals from cloud, using cache:', error.message);
        }
        return getLocalGoals(normalizedId);
      }
      const goals = (data as Goal[]) || [];
      saveLocalGoals(normalizedId, goals);
      return goals;
    } catch (err: any) {
      if (err?.message && err.message.trim().length > 0) {
        console.warn('Failed to fetch goals from cloud, using cache:', err.message);
      }
      return getLocalGoals(normalizedId);
    }
  },

  /**
   * Create a new fitness goal
   */
  async createGoal(goal: Omit<Goal, 'id' | 'created_at' | 'current_value'>): Promise<Goal> {
    const guestMode = isGuest(goal.user_id);
    const dbUserId = guestMode ? goal.user_id : toDeterministicUUID(goal.user_id);

    const newGoalPayload = {
      user_id: dbUserId,
      goal_type: goal.goal_type,
      target_value: goal.target_value,
      current_value: 0,
      period: goal.period,
      start_date: goal.start_date || new Date().toISOString(),
      end_date: goal.end_date || null,
      status: 'active' as const,
    };

    if (guestMode) {
      const savedGoal: Goal = {
        ...newGoalPayload,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
      };
      const existing = getLocalGoals(goal.user_id);
      saveLocalGoals(goal.user_id, [savedGoal, ...existing]);
      await this.updateProgress(goal.user_id);
      return savedGoal;
    }

    const { data, error } = await insforge.database
      .from('goals')
      .insert([newGoalPayload])
      .select()
      .single();

    if (error) throw error;

    const saved = data as Goal;
    const existing = getLocalGoals(dbUserId);
    saveLocalGoals(dbUserId, [saved, ...existing.filter((g) => g.id !== saved.id)]);
    await this.updateProgress(saved.user_id);
    return saved;
  },

  /**
   * Update or pause goal status
   */
  async updateGoalStatus(goalId: string, status: 'active' | 'completed' | 'paused'): Promise<void> {
    updateCachedGoalAcrossKeys((goals) => goals.map((g) => (g.id === goalId ? { ...g, status } : g)));

    try {
      await insforge.database
        .from('goals')
        .update({ status })
        .eq('id', goalId);
    } catch (err) {
      // Non-blocking for offline or guest
    }
  },

  /**
   * Update goal details (target, period, type, status)
   */
  async updateGoal(
    goalId: string,
    updates: Partial<Pick<Goal, 'goal_type' | 'target_value' | 'period' | 'status'>>
  ): Promise<Goal | null> {
    let updatedGoal: Goal | null = null;
    updateCachedGoalAcrossKeys((goals) =>
      goals.map((g) => {
        if (g.id === goalId) {
          updatedGoal = { ...g, ...updates };
          return updatedGoal;
        }
        return g;
      })
    );

    try {
      const { data, error } = await insforge.database
        .from('goals')
        .update(updates)
        .eq('id', goalId)
        .select()
        .single();
      if (!error && data) {
        updatedGoal = data as Goal;
      }
    } catch (err) {
      // Non-blocking for offline or guest
    }

    if (updatedGoal && (updatedGoal as Goal).user_id) {
      await this.updateProgress((updatedGoal as Goal).user_id);
    }
    return updatedGoal;
  },

  /**
   * Delete goal
   */
  async deleteGoal(goalId: string): Promise<void> {
    updateCachedGoalAcrossKeys((goals) => goals.filter((g) => g.id !== goalId));

    try {
      await insforge.database
        .from('goals')
        .delete()
        .eq('id', goalId);
    } catch (err) {
      // Non-blocking for offline or guest
    }
  },

  /**
   * Recalculate all active goal progress based on latest completed workouts
   */
  async updateProgress(userId: string): Promise<void> {
    try {
      const guestMode = isGuest(userId);
      const normalizedId = guestMode ? userId : toDeterministicUUID(userId);
      const goals = await this.getGoals(normalizedId);
      const activeGoals = goals.filter((g) => g.status === 'active');
      if (activeGoals.length === 0) return;

      let workouts: any[] = [];

      if (guestMode) {
        workouts = workoutService.getCachedWorkouts(userId);
      } else {
        const oldestGoalStart = new Date();
        oldestGoalStart.setDate(oldestGoalStart.getDate() - 35);
        try {
          const { data } = await insforge.database
            .from('workouts')
            .select('started_at, distance_meters, duration_seconds')
            .eq('user_id', normalizedId)
            .gte('started_at', oldestGoalStart.toISOString());
          workouts = data || workoutService.getCachedWorkouts(normalizedId);
        } catch {
          workouts = workoutService.getCachedWorkouts(normalizedId);
        }
      }

      const now = new Date();
      const updatedGoals = [...goals];

      for (const goal of activeGoals) {
        let currentValue = 0;

        if (goal.goal_type === 'single_run') {
          const periodStart = (() => {
            if (goal.period === 'monthly') {
              return new Date(now.getFullYear(), now.getMonth(), 1);
            }
            if (goal.period === 'weekly') {
              const currentDay = now.getDay();
              const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
              const s = new Date(now);
              s.setDate(now.getDate() + diffToMonday);
              s.setHours(0, 0, 0, 0);
              return s;
            }
            return new Date(0);
          })();
          const scopedWorkouts = workouts.filter((w) => new Date(w.started_at) >= periodStart);
          const maxRunMeters = scopedWorkouts.reduce((max, w) => Math.max(max, w.distance_meters || 0), 0);
          currentValue = Number((maxRunMeters / 1000).toFixed(2));
        } else if (goal.period === 'weekly') {
          const currentDay = now.getDay();
          const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
          const startOfWeek = new Date(now);
          startOfWeek.setDate(now.getDate() + diffToMonday);
          startOfWeek.setHours(0, 0, 0, 0);

          const weekWorkouts = workouts.filter((w) => new Date(w.started_at) >= startOfWeek);

          if (goal.goal_type === 'weekly_distance') {
            const meters = weekWorkouts.reduce((acc, w) => acc + (w.distance_meters || 0), 0);
            currentValue = Number((meters / 1000).toFixed(2));
          } else if (goal.goal_type === 'workout_count') {
            currentValue = weekWorkouts.length;
          } else if (goal.goal_type === 'duration') {
            const sec = weekWorkouts.reduce((acc, w) => acc + (w.duration_seconds || 0), 0);
            currentValue = Math.round(sec / 60);
          }
        } else if (goal.period === 'monthly') {
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          const monthWorkouts = workouts.filter((w) => new Date(w.started_at) >= startOfMonth);

          if (goal.goal_type === 'monthly_distance') {
            const meters = monthWorkouts.reduce((acc, w) => acc + (w.distance_meters || 0), 0);
            currentValue = Number((meters / 1000).toFixed(2));
          } else if (goal.goal_type === 'workout_count') {
            currentValue = monthWorkouts.length;
          } else if (goal.goal_type === 'duration') {
            const sec = monthWorkouts.reduce((acc, w) => acc + (w.duration_seconds || 0), 0);
            currentValue = Math.round(sec / 60);
          }
        }

        const isCompleted = currentValue >= goal.target_value;

        const gIdx = updatedGoals.findIndex((g) => g.id === goal.id);
        if (gIdx !== -1) {
          updatedGoals[gIdx] = {
            ...updatedGoals[gIdx],
            current_value: currentValue,
            status: isCompleted ? 'completed' : 'active',
          };
        }

        if (!guestMode) {
          await insforge.database
            .from('goals')
            .update({
              current_value: currentValue,
              status: isCompleted ? 'completed' : 'active',
            })
            .eq('id', goal.id);
        }
      }

      saveLocalGoals(normalizedId, updatedGoals);
    } catch (err) {
      console.warn('Error updating goals progress:', err);
    }
  },
};
