import { insforge } from '../lib/insforge';
import { Achievement, UserAchievement, Workout } from '../types';
import { workoutService } from './workoutService';
import { toDeterministicUUID } from '../utils/uuid';

const USER_ACHIEVEMENTS_CACHE_KEY = 'runwar_cached_user_achievements';

const isGuest = (userId: string) => !userId || userId === 'guest_user' || userId === 'usr_guest_demo';

export const DEFAULT_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_run',
    name: 'First Steps',
    description: 'Complete your very first workout',
    icon: 'Footprints',
    category: 'milestones',
    requirement_type: 'workout_count',
    requirement_value: 1,
  },
  {
    id: '5k_club',
    name: '5K Finisher',
    description: 'Complete a single run of at least 5 kilometers',
    icon: 'Trophy',
    category: 'distance',
    requirement_type: 'single_distance',
    requirement_value: 5000,
  },
  {
    id: '10k_club',
    name: '10K Conqueror',
    description: 'Complete a single run of at least 10 kilometers',
    icon: 'Award',
    category: 'distance',
    requirement_type: 'single_distance',
    requirement_value: 10000,
  },
  {
    id: 'half_marathon',
    name: 'Half Marathoner',
    description: 'Complete a 21.1 km run',
    icon: 'Medal',
    category: 'distance',
    requirement_type: 'single_distance',
    requirement_value: 21097,
  },
  {
    id: 'distance_50k',
    name: 'Road Warrior',
    description: 'Accumulate 50 km in total running distance',
    icon: 'Flame',
    category: 'milestones',
    requirement_type: 'total_distance',
    requirement_value: 50000,
  },
  {
    id: 'distance_100k',
    name: 'Century Club',
    description: 'Accumulate 100 km in total running distance',
    icon: 'Crown',
    category: 'milestones',
    requirement_type: 'total_distance',
    requirement_value: 100000,
  },
  {
    id: 'workouts_10',
    name: 'Dedicated Runner',
    description: 'Complete 10 total running workouts',
    icon: 'CheckCircle2',
    category: 'consistency',
    requirement_type: 'workout_count',
    requirement_value: 10,
  },
  {
    id: 'workouts_25',
    name: 'Pavement Master',
    description: 'Complete 25 total running workouts',
    icon: 'Zap',
    category: 'consistency',
    requirement_type: 'workout_count',
    requirement_value: 25,
  },
  {
    id: 'streak_3',
    name: 'Hat-Trick Streak',
    description: 'Run 3 consecutive days in a row',
    icon: 'Sparkles',
    category: 'consistency',
    requirement_type: 'streak_days',
    requirement_value: 3,
  },
  {
    id: 'streak_7',
    name: 'Weekly Warrior',
    description: 'Run 7 consecutive days in a row',
    icon: 'Target',
    category: 'consistency',
    requirement_type: 'streak_days',
    requirement_value: 7,
  },
  {
    id: 'early_bird',
    name: 'Sunrise Runner',
    description: 'Complete a workout before 7:00 AM',
    icon: 'Sunrise',
    category: 'milestones',
    requirement_type: 'early_workout',
    requirement_value: 1,
  },
  {
    id: 'night_owl',
    name: 'Night Strider',
    description: 'Complete a workout after 8:00 PM',
    icon: 'Moon',
    category: 'milestones',
    requirement_type: 'night_workout',
    requirement_value: 1,
  },
  {
    id: 'speed_demon',
    name: 'Speed Demon',
    description: 'Achieve an average pace faster than 5:00 min/km',
    icon: 'Gauge',
    category: 'speed',
    requirement_type: 'pace_threshold',
    requirement_value: 300,
  },
  {
    id: 'calorie_burner',
    name: 'Calorie Furnace',
    description: 'Burn more than 500 estimated kcal in one workout',
    icon: 'Flame',
    category: 'milestones',
    requirement_type: 'single_calories',
    requirement_value: 500,
  },
];

function getLocalUserAchievements(): UserAchievement[] {
  try {
    const raw = localStorage.getItem(USER_ACHIEVEMENTS_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalUserAchievements(items: UserAchievement[]) {
  try {
    localStorage.setItem(USER_ACHIEVEMENTS_CACHE_KEY, JSON.stringify(items));
  } catch (e) {
    console.warn('Failed to cache user achievements:', e);
  }
}

export const achievementsService = {
  /**
   * Fetch all global achievements
   */
  async getAllAchievements(): Promise<Achievement[]> {
    try {
      const { data, error } = await insforge.database
        .from('achievements')
        .select('*');

      if (error || !data || data.length === 0) {
        return DEFAULT_ACHIEVEMENTS;
      }
      return data as Achievement[];
    } catch (err) {
      console.warn('Failed to fetch achievements, falling back to defaults:', err);
      return DEFAULT_ACHIEVEMENTS;
    }
  },

  /**
   * Fetch user's unlocked achievements
   */
  async getUserAchievements(userId: string): Promise<UserAchievement[]> {
    if (isGuest(userId)) {
      const local = getLocalUserAchievements();
      const allAch = await this.getAllAchievements();
      const map = new Map(allAch.map((a) => [a.id, a]));
      return local.map((ua) => ({
        ...ua,
        achievement: ua.achievement || map.get(ua.achievement_id),
      }));
    }

    const normalizedId = toDeterministicUUID(userId);

    try {
      const { data, error } = await insforge.database
        .from('user_achievements')
        .select('*, achievement:achievements(*)')
        .eq('user_id', normalizedId);

      if (error) throw error;
      const achievements = (data as UserAchievement[]) || [];
      saveLocalUserAchievements(achievements);
      return achievements;
    } catch (err) {
      console.warn('Failed to fetch user achievements from cloud, using cache:', err);
      const local = getLocalUserAchievements();
      const allAch = await this.getAllAchievements();
      const map = new Map(allAch.map((a) => [a.id, a]));
      return local.map((ua) => ({
        ...ua,
        achievement: ua.achievement || map.get(ua.achievement_id),
      }));
    }
  },

  /**
   * Evaluate all achievements against user workout history and unlock newly achieved badges
   */
  async checkAchievements(userId: string, latestWorkout?: Workout): Promise<Achievement[]> {
    try {
      const [allAchievements, userAchievements, workouts] = await Promise.all([
        this.getAllAchievements(),
        this.getUserAchievements(userId),
        workoutService.getWorkouts(userId),
      ]);

      const unlockedIds = new Set(userAchievements.map((ua) => ua.achievement_id));
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
            isQualified = this.calculateStreakDays(workouts) >= 3;
            break;
          case 'streak_7':
            isQualified = this.calculateStreakDays(workouts) >= 7;
            break;
          case 'early_bird':
            isQualified = workouts.some((w) => {
              const hour = new Date(w.started_at).getHours();
              return hour < 7;
            });
            break;
          case 'night_owl':
            isQualified = workouts.some((w) => {
              const hour = new Date(w.started_at).getHours();
              return hour >= 20;
            });
            break;
          case 'speed_demon':
            isQualified = workouts.some(
              (w) => w.distance_meters >= 1000 && w.average_pace > 0 && w.average_pace <= 300
            );
            break;
          case 'calorie_burner':
            isQualified = maxSingleCalories >= 500;
            break;
        }

        if (isQualified) {
          const newUA: UserAchievement = {
            id: crypto.randomUUID ? crypto.randomUUID() : `ach_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            user_id: userId,
            achievement_id: ach.id,
            unlocked_at: new Date().toISOString(),
            achievement: ach,
          };

          if (isGuest(userId)) {
            const local = getLocalUserAchievements();
            local.push(newUA);
            saveLocalUserAchievements(local);
          } else {
            try {
              await insforge.database.from('user_achievements').insert([
                {
                  user_id: userId,
                  achievement_id: ach.id,
                  unlocked_at: newUA.unlocked_at,
                },
              ]);
              const local = getLocalUserAchievements();
              local.push(newUA);
              saveLocalUserAchievements(local);
            } catch (err) {
              console.warn(`Failed to insert achievement ${ach.id} to cloud:`, err);
              const local = getLocalUserAchievements();
              local.push(newUA);
              saveLocalUserAchievements(local);
            }
          }

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

