import React, { useState } from 'react';
import { Achievement, UserAchievement, Workout } from '../types';
import { Award, Trophy, Sparkles, Flame, Zap, Gauge, Footprints, Medal, Crown, CheckCircle2, Lock, Filter } from 'lucide-react';

interface AchievementsScreenProps {
  achievements: Achievement[];
  userAchievements: UserAchievement[];
  workouts: Workout[];
}

export const AchievementsScreen: React.FC<AchievementsScreenProps> = ({
  achievements,
  userAchievements,
  workouts,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const unlockedMap = new Map<string, UserAchievement>();
  userAchievements.forEach((ua) => {
    unlockedMap.set(ua.achievement_id, ua);
  });

  const filtered = achievements.filter((a) => {
    if (selectedCategory === 'all') return true;
    return a.category === selectedCategory;
  });

  // Calculate user totals for progress bars
  const totalDistanceMeters = workouts.reduce((acc, w) => acc + (w.distance_meters || 0), 0);
  const totalWorkouts = workouts.length;
  const maxSingleDistanceMeters = workouts.reduce((max, w) => Math.max(max, w.distance_meters || 0), 0);

  const getIconComponent = (iconName: string) => {
    switch (iconName) {
      case 'Trophy': return Trophy;
      case 'Flame': return Flame;
      case 'Crown': return Crown;
      case 'Medal': return Medal;
      case 'Gauge': return Gauge;
      case 'Zap': return Zap;
      case 'Sparkles': return Sparkles;
      case 'Footprints':
      default:
        return Footprints;
    }
  };

  const getProgress = (achievement: Achievement): { current: number; max: number; pct: number } => {
    let current = 0;
    const max = achievement.requirement_value;

    switch (achievement.requirement_type) {
      case 'workout_count':
        current = totalWorkouts;
        break;
      case 'total_distance':
        current = totalDistanceMeters;
        break;
      case 'single_distance':
        current = maxSingleDistanceMeters;
        break;
      default:
        current = unlockedMap.has(achievement.id) ? max : 0;
        break;
    }

    const pct = Math.min(100, Math.round((current / max) * 100));
    return { current, max, pct };
  };

  return (
    <div className="p-4 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="pt-1">
        <h2 className="font-display text-2xl font-black text-emerald-950 dark:text-white tracking-tight">
          Achievements & Badges
        </h2>
        <span className="text-xs text-emerald-800/80 dark:text-slate-400">
          Unlocked{' '}
          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
            {unlockedMap.size} of {achievements.length}
          </span>{' '}
          badges
        </span>
      </div>

      {/* Grid Category Selector (Clean 3-Col & 2-Col Grid - No Horizontal Scroll) */}
      <div className="space-y-1.5">
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { id: 'all', label: 'All Badges' },
            { id: 'milestones', label: 'Milestones' },
            { id: 'distance', label: 'Distance' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedCategory(tab.id)}
              className={`py-2 px-1.5 rounded-xl text-xs font-bold transition-all text-center ${
                selectedCategory === tab.id
                  ? 'bg-emerald-500 text-white dark:text-slate-950 shadow-md shadow-emerald-500/30 dark:shadow-glow-brand font-black'
                  : 'bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800 text-emerald-800 dark:text-slate-400 hover:text-emerald-950 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { id: 'consistency', label: 'Consistency' },
            { id: 'speed', label: 'Speed Records' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedCategory(tab.id)}
              className={`py-2 px-2 rounded-xl text-xs font-bold transition-all text-center ${
                selectedCategory === tab.id
                  ? 'bg-emerald-500 text-white dark:text-slate-950 shadow-md shadow-emerald-500/30 dark:shadow-glow-brand font-black'
                  : 'bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800 text-emerald-800 dark:text-slate-400 hover:text-emerald-950 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Badges Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filtered.map((ach) => {
          const isUnlocked = unlockedMap.has(ach.id);
          const unlockedInfo = unlockedMap.get(ach.id);
          const Icon = getIconComponent(ach.icon);
          const progress = getProgress(ach);

          return (
            <div
              key={ach.id}
              className={`rounded-3xl border p-4 shadow-md dark:shadow-xl flex flex-col justify-between gap-3 transition-all ${
                isUnlocked
                  ? 'bg-emerald-50 dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/40 border-emerald-300 dark:border-emerald-500/40 shadow-sm dark:shadow-glow-brand'
                  : 'bg-white dark:bg-slate-900/60 border-emerald-100 dark:border-slate-800/80 opacity-80'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                    isUnlocked
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-600 dark:text-emerald-400 shadow-sm'
                      : 'bg-emerald-50/50 dark:bg-slate-950 border-emerald-200 dark:border-slate-800 text-emerald-700/60 dark:text-slate-600'
                  }`}
                >
                  {isUnlocked ? <Icon size={24} /> : <Lock size={20} />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-emerald-950 dark:text-white truncate">{ach.name}</h4>
                    {isUnlocked && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
                        <CheckCircle2 size={12} />
                        <span>Unlocked</span>
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-emerald-800/80 dark:text-slate-400 mt-0.5 leading-tight">
                    {ach.description}
                  </p>
                </div>
              </div>

              {/* Progress meter for locked badges */}
              {!isUnlocked ? (
                <div className="space-y-1 pt-1 border-t border-emerald-100 dark:border-slate-800/50">
                  <div className="flex items-center justify-between text-[10px] text-emerald-700/80 dark:text-slate-500">
                    <span>Progress</span>
                    <span className="font-mono">{progress.pct}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-emerald-100 dark:bg-slate-950 overflow-hidden">
                    <div
                      style={{ width: `${progress.pct}%` }}
                      className="h-full rounded-full bg-emerald-500/70"
                    />
                  </div>
                </div>
              ) : (
                <div className="text-[10px] text-emerald-700/80 dark:text-slate-500 pt-1 border-t border-emerald-100 dark:border-slate-800/50">
                  Achieved on {new Date(unlockedInfo?.unlocked_at || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
