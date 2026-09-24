import React, { useState } from 'react';
import { Achievement, UserAchievement, UserProfile, Workout } from '../types';
import {
  Award,
  Trophy,
  Sparkles,
  Flame,
  Zap,
  Gauge,
  Footprints,
  Medal,
  Crown,
  CheckCircle2,
  Lock,
  Filter,
  Sunrise,
  Moon,
  Target,
} from 'lucide-react';
import { AchievementDetailModal } from '../components/achievements/AchievementDetailModal';

interface AchievementsScreenProps {
  achievements: Achievement[];
  userAchievements: UserAchievement[];
  workouts: Workout[];
  profile?: UserProfile | null;
  onUpdateProfile?: (updated: UserProfile) => void;
}

export const AchievementsScreen: React.FC<AchievementsScreenProps> = ({
  achievements,
  userAchievements,
  workouts,
  profile,
  onUpdateProfile,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
    return profile?.pinned_achievements || ['first_run', '5k_club', 'streak_3'];
  });

  const handleTogglePin = (achId: string) => {
    let next: string[];
    if (pinnedIds.includes(achId)) {
      next = pinnedIds.filter((id) => id !== achId);
    } else {
      if (pinnedIds.length >= 3) {
        next = [...pinnedIds.slice(1), achId];
      } else {
        next = [...pinnedIds, achId];
      }
    }
    setPinnedIds(next);
    if (profile) {
      const updated = { ...profile, pinned_achievements: next };
      if (onUpdateProfile) onUpdateProfile(updated);
      try {
        localStorage.setItem('runwar_cached_profile', JSON.stringify(updated));
      } catch {}
    }
  };

  const distanceUnit = profile?.distance_unit || 'km';

  const unlockedMap = new Map<string, UserAchievement>();
  userAchievements.forEach((ua) => {
    unlockedMap.set(ua.achievement_id, ua);
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
      case 'Sunrise': return Sunrise;
      case 'Moon': return Moon;
      case 'Target': return Target;
      case 'CheckCircle2': return CheckCircle2;
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

  // Calculate total XP and Runner Level
  const totalXP = Array.from(unlockedMap.values()).reduce((sum, ua) => {
    const ach = achievements.find((a) => a.id === ua.achievement_id);
    const xp = ach?.xp || (ach?.rarity === 'legendary' ? 500 : ach?.rarity === 'epic' ? 250 : ach?.rarity === 'rare' ? 100 : 50);
    return sum + xp;
  }, 0);

  const runnerLevel = Math.floor(totalXP / 250) + 1;
  const currentLevelProgressXP = totalXP % 250;
  const levelProgressPct = Math.min(100, Math.round((currentLevelProgressXP / 250) * 100));

  const levelTitles = [
    'Rookie Stride',
    'Pace Pioneer',
    'Endurance Master',
    'Marathon Veteran',
    'Titan Runner',
    'Legendary Athlete',
  ];
  const levelTitle = levelTitles[Math.min(runnerLevel - 1, levelTitles.length - 1)];

  // Next up to unlock
  const nextUp = achievements
    .filter((a) => !unlockedMap.has(a.id))
    .map((a) => ({ achievement: a, progress: getProgress(a) }))
    .filter((item) => item.progress.pct > 0 && item.progress.pct < 100)
    .sort((a, b) => b.progress.pct - a.progress.pct)[0];

  // Filtering
  const filtered = achievements.filter((a) => {
    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'unlocked') return unlockedMap.has(a.id);
    if (selectedCategory === 'locked') return !unlockedMap.has(a.id);
    if (selectedCategory === 'speed') return a.category === 'speed';
    if (selectedCategory === 'endurance') {
      return a.category === 'distance' || a.category === 'milestones' || a.category === 'consistency';
    }
    return a.category === selectedCategory;
  });

  return (
    <div className="p-4 space-y-4 animate-fade-in max-w-xl md:max-w-2xl mx-auto pb-8">
      {/* Header */}
      <div className="pt-1">
        <h2 className="font-display text-xl sm:text-2xl font-black text-emerald-950 dark:text-white tracking-tight whitespace-nowrap">
          Achievements & Badges
        </h2>
        <div className="flex items-center justify-between gap-2 mt-1">
          <p className="text-xs text-emerald-800/80 dark:text-slate-400">
            Unlocked{' '}
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
              {unlockedMap.size} of {achievements.length}
            </span>{' '}
            badges
          </p>

          {/* Filter Dropdown at Right Corner */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-slate-800 shadow-sm shrink-0">
            <Filter size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-transparent text-xs font-bold text-emerald-950 dark:text-slate-200 outline-none cursor-pointer pr-1"
              aria-label="Filter achievements"
            >
              <option value="all" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                All Badges
              </option>
              <option value="speed" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                Speed & Splits
              </option>
              <option value="endurance" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                Endurance & Power
              </option>
              <option value="unlocked" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                Unlocked ({unlockedMap.size})
              </option>
              <option value="locked" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                In Progress ({achievements.length - unlockedMap.size})
              </option>
            </select>
          </div>
        </div>
      </div>

      {/* Runner Level & XP Strip (Compact & Clean) */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 sm:p-3.5 shadow-xs space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-7 h-7 rounded-lg bg-emerald-500 text-white dark:text-slate-950 font-black text-xs flex items-center justify-center shrink-0">
              L{runnerLevel}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-900 dark:text-white truncate">{levelTitle}</span>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded-full shrink-0">
                  Level {runnerLevel}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                {totalXP} Total XP Earned
              </span>
            </div>
          </div>

          <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-400 shrink-0">
            {currentLevelProgressXP} / 250 XP
          </span>
        </div>

        {/* Level XP Bar */}
        <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div
            style={{ width: `${levelProgressPct}%` }}
            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
          />
        </div>
      </div>

      {/* Next Up to Unlock Spotlight (Compact Strip) */}
      {nextUp && (
        <div
          onClick={() => setSelectedAchievement(nextUp.achievement)}
          className="rounded-2xl bg-emerald-50/50 dark:bg-slate-900/60 border border-emerald-200/70 dark:border-slate-800 p-2.5 sm:p-3 hover:border-emerald-400 dark:hover:border-emerald-500/40 cursor-pointer active:scale-98 transition-all flex items-center justify-between gap-2.5"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              {React.createElement(getIconComponent(nextUp.achievement.icon), { size: 16 })}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 shrink-0">
                  Next Goal
                </span>
                <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {nextUp.achievement.name}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {nextUp.achievement.description}
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
              {nextUp.progress.pct}%
            </span>
          </div>
        </div>
      )}

      {/* Badges Grid (Compact & Simple) */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 text-center space-y-1.5">
          <Award size={24} className="mx-auto text-slate-400" />
          <p className="text-xs font-bold text-slate-900 dark:text-white">No badges found</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Try switching your filter selection</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
          {filtered.map((ach) => {
            const isUnlocked = unlockedMap.has(ach.id);
            const Icon = getIconComponent(ach.icon);
            const progress = getProgress(ach);
            const rarity = ach.rarity || 'common';
            const xp = ach.xp || (rarity === 'legendary' ? 500 : rarity === 'epic' ? 250 : rarity === 'rare' ? 100 : 50);

            return (
              <div
                key={ach.id}
                onClick={() => setSelectedAchievement(ach)}
                className={`rounded-2xl p-3 border transition-all cursor-pointer active:scale-98 flex flex-col justify-between gap-2.5 ${
                  isUnlocked
                    ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-400/80 shadow-xs'
                    : 'bg-slate-50/70 dark:bg-slate-900/50 border-slate-200/60 dark:border-slate-800/50 opacity-75 hover:opacity-100'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                      isUnlocked
                        ? rarity === 'legendary'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                          : rarity === 'epic'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                          : rarity === 'rare'
                          ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    {isUnlocked ? <Icon size={18} /> : <Lock size={15} />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4
                        className={`text-xs font-bold truncate ${
                          isUnlocked ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {ach.name}
                      </h4>
                      <span className="text-[9px] font-mono font-medium text-slate-400 dark:text-slate-500 capitalize shrink-0">
                        {rarity}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                      {ach.description}
                    </p>
                  </div>
                </div>

                {/* Bottom Status / Progress */}
                {!isUnlocked ? (
                  <div className="space-y-1 pt-1.5 border-t border-slate-100 dark:border-slate-800/60">
                    <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <Lock size={10} />
                        <span>In Progress</span>
                      </span>
                      <span className="font-mono font-medium">{progress.pct}%</span>
                    </div>
                    <div className="h-1 w-full rounded-full bg-slate-200/80 dark:bg-slate-800 overflow-hidden">
                      <div
                        style={{ width: `${progress.pct}%` }}
                        className="h-full rounded-full bg-slate-400 dark:bg-slate-500"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-slate-100 dark:border-slate-800/60">
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                      <CheckCircle2 size={12} />
                      <span>Unlocked</span>
                    </span>
                    <span className="font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      +{xp} XP
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Interactive Achievement Detail & Social Share Modal */}
      {selectedAchievement && (
        <AchievementDetailModal
          isOpen={!!selectedAchievement}
          onClose={() => setSelectedAchievement(null)}
          achievement={selectedAchievement}
          userAchievement={unlockedMap.get(selectedAchievement.id)}
          progress={getProgress(selectedAchievement)}
          distanceUnit={distanceUnit}
          isPinned={pinnedIds.includes(selectedAchievement.id)}
          onTogglePin={handleTogglePin}
        />
      )}
    </div>
  );
};

