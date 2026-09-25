import { insforge } from '../lib/insforge';
import { Goal } from '../types';
import { workoutService } from './workoutService';
import { toDeterministicUUID } from '../utils/uuid';

const GOALS_CACHE_KEY = 'runwar_cached_goals';

const isGuest = (userId: string) => !userId || userId === 'guest_user' || userId === 'usr_guest_demo';

function getLocalGoals(): Goal[] {
  try {
    const raw = localStorage.getItem(GOALS_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalGoals(goals: Goal[]) {
  try {
    localStorage.setItem(GOALS_CACHE_KEY, JSON.stringify(goals));
  } catch (e) {
    console.warn('Failed to cache goals:', e);
  }
}

export const goalsService = {
  /**
   * Fetch user goals from InsForge or local cache for guest
   */
  async getGoals(userId: string): Promise<Goal[]> {
    if (isGuest(userId)) {
      return getLocalGoals();
    }

    const normalizedId = toDeterministicUUID(userId);

    try {
      const { data, error } = await insforge.database
        .from('goals')
        .select('*')
        .eq('user_id', normalizedId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const goals = (data as Goal[]) || [];
      saveLocalGoals(goals);
      return goals;
    } catch (err) {
      console.warn('Failed to fetch goals from cloud, using cache:', err);
      return getLocalGoals();
    }
  },

  /**
   * Create a new fitness goal
   */
  async createGoal(goal: Omit<Goal, 'id' | 'created_at' | 'current_value'>): Promise<Goal> {
    const newGoalPayload = {
      user_id: goal.user_id,
      goal_type: goal.goal_type,
      target_value: goal.target_value,
      current_value: 0,
      period: goal.period,
      start_date: goal.start_date || new Date().toISOString(),
      end_date: goal.end_date || null,
      status: 'active' as const,
    };

    if (isGuest(goal.user_id)) {
      const savedGoal: Goal = {
        ...newGoalPayload,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
      };
      const existing = getLocalGoals();
      saveLocalGoals([savedGoal, ...existing]);
      await this.updateProgress(goal.user_id);
      return savedGoal;
    }

    const { data, error } = await insforge.database
      .from('goals')
      .insert([newGoalPayload])
      .select()
      .single();

    if (error) throw error;

    // Recalculate progress for the new goal
    const saved = data as Goal;
    await this.updateProgress(saved.user_id);
    return saved;
  },

  /**
   * Update or pause goal status
   */
  async updateGoalStatus(goalId: string, status: 'active' | 'completed' | 'paused'): Promise<void> {
    const localGoals = getLocalGoals();
    const updated = localGoals.map((g) => (g.id === goalId ? { ...g, status } : g));
    saveLocalGoals(updated);

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
    const localGoals = getLocalGoals();
    let updatedGoal: Goal | null = null;
    const updated = localGoals.map((g) => {
      if (g.id === goalId) {
        updatedGoal = { ...g, ...updates };
        return updatedGoal;
      }
      return g;
    });
    saveLocalGoals(updated);

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
    const localGoals = getLocalGoals();
    const updated = localGoals.filter((g) => g.id !== goalId);
    saveLocalGoals(updated);

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
      const goals = await this.getGoals(userId);
      const activeGoals = goals.filter((g) => g.status === 'active');
      if (activeGoals.length === 0) return;

      let workouts: any[] = [];

      if (isGuest(userId)) {
        workouts = workoutService.getCachedWorkouts();
      } else {
        const oldestGoalStart = new Date();
        oldestGoalStart.setDate(oldestGoalStart.getDate() - 31);
        try {
          const { data } = await insforge.database
            .from('workouts')
            .select('started_at, distance_meters, duration_seconds')
            .eq('user_id', userId)
            .gte('started_at', oldestGoalStart.toISOString());
          workouts = data || workoutService.getCachedWorkouts();
        } catch {
          workouts = workoutService.getCachedWorkouts();
        }
      }

      const now = new Date();
      const updatedGoals = [...goals];

      for (const goal of activeGoals) {
        let currentValue = 0;

        if (goal.period === 'weekly') {
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
          }
        } else if (goal.goal_type === 'single_run') {
          const maxRunMeters = workouts.reduce((max, w) => Math.max(max, w.distance_meters || 0), 0);
          currentValue = Number((maxRunMeters / 1000).toFixed(2));
        }

        const isCompleted = currentValue >= goal.target_value;

        // Update in-memory / local cache
        const gIdx = updatedGoals.findIndex((g) => g.id === goal.id);
        if (gIdx !== -1) {
          updatedGoals[gIdx] = {
            ...updatedGoals[gIdx],
            current_value: currentValue,
            status: isCompleted ? 'completed' : 'active',
          };
        }

        if (!isGuest(userId)) {
          await insforge.database
            .from('goals')
            .update({
              current_value: currentValue,
              status: isCompleted ? 'completed' : 'active',
            })
            .eq('id', goal.id);
        }
      }

      saveLocalGoals(updatedGoals);
    } catch (err) {
      console.warn('Error updating goals progress:', err);
    }
  },
};
