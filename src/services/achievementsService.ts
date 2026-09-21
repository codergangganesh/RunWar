import { insforge } from '../lib/insforge';
import { Achievement, UserAchievement, Workout } from '../types';

export const achievementsService = {
  /**
   * Fetch all global achievements
   */
  async getAllAchievements(): Promise<Achievement[]> {
    try {
      const { data, error } = await insforge.database
        .from('achievements')
        .select('*');

      if (error) throw error;
      return (data as Achievement[]) || [];
    } catch (err) {
      console.warn('Failed to fetch achievements:', err);
      return [];
    }
  },

  /**
   * Fetch user's unlocked achievements
   */
  async getUserAchievements(userId: string): Promise<UserAchievement[]> {
    try {
      const { data, error } = await insforge.database
        .from('user_achievements')
        .select('*, achievement:achievements(*)')
        .eq('user_id', userId);

      if (error) throw error;
      return (data as UserAchievement[]) || [];
    } catch (err) {
      console.warn('Failed to fetch user achievements:', err);
      return [];
    }
  },

  /**
   * Evaluate all achievements against user workout history and unlock newly achieved badges
   */
  async checkAchievements(userId: string, latestWorkout?: Workout): Promise<Achievement[]> {
    try {
      const [allAchievements, userAchievements, workoutsData] = await Promise.all([
        this.getAllAchievements(),
        this.getUserAchievements(userId),
        insforge.database.from('workouts').select('*').eq('user_id', userId),
      ]);

      const unlockedIds = new Set(userAchievements.map((ua) => ua.achievement_id));
      const workouts: Workout[] = workoutsData.data || [];
      const newlyUnlocked: Achievement[] = [];

      // Metrics calculation
      const totalDistanceMeters = workouts.reduce((sum, w) => sum + (w.distance_meters || 0), 0);
      const totalWorkoutsCount = workouts.length;
      const maxSingleDistanceMeters = workouts.reduce((max, w) => Math.max(max, w.distance_meters || 0), 0);
      const maxSingleCalories = workouts.reduce((max, w) => Math.max(max, w.calories || 0), 0);

      // Check each achievement
      for (const ach of allAchievements) {
        if (unlockedIds.has(ach.id)) continue;

        let isQualified = false;

        switch (ach.id) {
          case 'first_run':
            isQualified = totalWorkoutsCount >= 1;
            break;
          case '5k_club':
            isQualified = maxSingleDistanceMeters >= 5000;
            break;
          case '10k_club':
            isQualified = maxSingleDistanceMeters >= 10000;
            break;
          case 'half_marathon':
            isQualified = maxSingleDistanceMeters >= 21097;
            break;
          case 'distance_50k':
            isQualified = totalDistanceMeters >= 50000;
            break;
          case 'distance_100k':
            isQualified = totalDistanceMeters >= 100000;
            break;
          case 'workouts_10':
            isQualified = totalWorkoutsCount >= 10;
            break;
          case 'workouts_25':
            isQualified = totalWorkoutsCount >= 25;
            break;
          case 'streak_3':
            // Check if streak >= 3
            isQualified = this.calculateStreakDays(workouts) >= 3;
            break;
          case 'streak_7':
            isQualified = this.calculateStreakDays(workouts) >= 7;
            break;
          case 'early_bird':
            // Check if any workout started before 7 AM
            isQualified = workouts.some((w) => {
              const hour = new Date(w.started_at).getHours();
              return hour < 7;
            });
            break;
          case 'night_owl':
            // Check if any workout started after 8 PM (20:00)
            isQualified = workouts.some((w) => {
              const hour = new Date(w.started_at).getHours();
              return hour >= 20;
            });
            break;
          case 'speed_demon':
            // Average pace faster than 5:00 min/km (300 sec/km) for at least 1km
            isQualified = workouts.some(
              (w) => w.distance_meters >= 1000 && w.average_pace > 0 && w.average_pace <= 300
            );
            break;
          case 'calorie_burner':
            isQualified = maxSingleCalories >= 500;
            break;
        }

        if (isQualified) {
          // Unlock achievement in database
          await insforge.database.from('user_achievements').insert([
            {
              user_id: userId,
              achievement_id: ach.id,
              unlocked_at: new Date().toISOString(),
            },
          ]);

          newlyUnlocked.push(ach);
        }
      }

      return newlyUnlocked;
    } catch (err) {
      console.warn('Error checking achievements:', err);
      return [];
    }
  },

  calculateStreakDays(workouts: Workout[]): number {
    const dates = new Set(workouts.map((w) => new Date(w.started_at).toISOString().split('T')[0]));
    let maxStreak = 0;
    let current = 0;
    const sorted = Array.from(dates).sort().map((d) => new Date(d));

    for (let i = 0; i < sorted.length; i++) {
      if (i === 0) current = 1;
      else {
        const diff = Math.round((sorted[i].getTime() - sorted[i - 1].getTime()) / (1000 * 60 * 60 * 24));
        if (diff === 1) current++;
        else current = 1;
      }
      maxStreak = Math.max(maxStreak, current);
    }
    return maxStreak;
  },
};
