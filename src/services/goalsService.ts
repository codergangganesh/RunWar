import { insforge } from '../lib/insforge';
import { Goal } from '../types';

export const goalsService = {
  /**
   * Fetch user goals from InsForge
   */
  async getGoals(userId: string): Promise<Goal[]> {
    try {
      const { data, error } = await insforge.database
        .from('goals')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data as Goal[]) || [];
    } catch (err) {
      console.warn('Failed to fetch goals:', err);
      return [];
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
      status: 'active',
    };

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
    const { error } = await insforge.database
      .from('goals')
      .update({ status })
      .eq('id', goalId);

    if (error) throw error;
  },

  /**
   * Delete goal
   */
  async deleteGoal(goalId: string): Promise<void> {
    const { error } = await insforge.database
      .from('goals')
      .delete()
      .eq('id', goalId);

    if (error) throw error;
  },

  /**
   * Recalculate all active goal progress based on latest completed workouts
   */
  async updateProgress(userId: string): Promise<void> {
    try {
      const goals = await this.getGoals(userId);
      const activeGoals = goals.filter((g) => g.status === 'active');
      if (activeGoals.length === 0) return;

      // Fetch only necessary workout fields within the relevant date range
      // instead of downloading ALL workouts with full route_coordinates
      const oldestGoalStart = new Date();
      oldestGoalStart.setDate(oldestGoalStart.getDate() - 31); // Cover monthly period
      const { data: workoutsData } = await insforge.database
        .from('workouts')
        .select('started_at, distance_meters, duration_seconds')
        .eq('user_id', userId)
        .gte('started_at', oldestGoalStart.toISOString());

      const workouts = workoutsData || [];
      const now = new Date();

      for (const goal of activeGoals) {
        let currentValue = 0;

        if (goal.period === 'weekly') {
          // Calculate start of current week (Monday)
          const currentDay = now.getDay();
          const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
          const startOfWeek = new Date(now);
          startOfWeek.setDate(now.getDate() + diffToMonday);
          startOfWeek.setHours(0, 0, 0, 0);

          const weekWorkouts = workouts.filter((w) => new Date(w.started_at) >= startOfWeek);

          if (goal.goal_type === 'weekly_distance') {
            const meters = weekWorkouts.reduce((acc, w) => acc + (w.distance_meters || 0), 0);
            currentValue = Number((meters / 1000).toFixed(2)); // in km
          } else if (goal.goal_type === 'workout_count') {
            currentValue = weekWorkouts.length;
          } else if (goal.goal_type === 'duration') {
            const sec = weekWorkouts.reduce((acc, w) => acc + (w.duration_seconds || 0), 0);
            currentValue = Math.round(sec / 60); // in minutes
          }
        } else if (goal.period === 'monthly') {
          // Start of current month
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          const monthWorkouts = workouts.filter((w) => new Date(w.started_at) >= startOfMonth);

          if (goal.goal_type === 'monthly_distance') {
            const meters = monthWorkouts.reduce((acc, w) => acc + (w.distance_meters || 0), 0);
            currentValue = Number((meters / 1000).toFixed(2));
          } else if (goal.goal_type === 'workout_count') {
            currentValue = monthWorkouts.length;
          }
        } else if (goal.goal_type === 'single_run') {
          // Check maximum single run
          const maxRunMeters = workouts.reduce((max, w) => Math.max(max, w.distance_meters || 0), 0);
          currentValue = Number((maxRunMeters / 1000).toFixed(2));
        }

        const isCompleted = currentValue >= goal.target_value;

        await insforge.database
          .from('goals')
          .update({
            current_value: currentValue,
            status: isCompleted ? 'completed' : 'active',
          })
          .eq('id', goal.id);
      }
    } catch (err) {
      console.warn('Error updating goals progress:', err);
    }
  },
};
