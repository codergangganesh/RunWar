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
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { AchievementDetailModal } from '../components/achievements/AchievementDetailModal';
import { formatDistance } from '../utils/formatters';

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
    if (selectedCategory === 'legendary' || selectedCategory === 'epic' || selectedCategory === 'rare' || selectedCategory === 'common') {
      return (a.rarity || 'common') === selectedCategory;
    }
    return a.category === selectedCategory;
  });

  return (
    <div className="p-4 space-y-4 animate-fade-in max-w-xl md:max-w-2xl mx-auto pb-8">
      {/* Header */}
      <div className="pt-1">
        <h2 className="font-display text-2xl font-black text-emerald-950 dark:text-white tracking-tight whitespace-nowrap">
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
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-slate-800 shadow-sm shrink-0">
            <Filter size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-transparent text-xs font-bold text-emerald-950 dark:text-slate-200 outline-none cursor-pointer pr-1"
              aria-label="Filter achievements"
            >
              <option value="all" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">All Badges</option>
              <option value="unlocked" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Unlocked ({unlockedMap.size})</option>
              <option value="locked" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">In Progress ({achievements.length - unlockedMap.size})</option>
              <option value="legendary" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Legendary Tier</option>
              <option value="epic" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Epic Tier</option>
              <option value="rare" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Rare Tier</option>
              <option value="milestones" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Milestones</option>
              <option value="distance" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Distance</option>
              <option value="consistency" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Consistency</option>
              <option value="speed" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Speed Records</option>
            </select>
          </div>
        </div>
      </div>

      {/* Runner Level & XP Strip */}
      <div className="rounded-3xl bg-gradient-to-r from-emerald-500/10 via-lime-500/10 to-teal-500/10 border border-emerald-200/80 dark:border-emerald-500/20 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-lime-400 text-slate-950 font-black text-sm flex items-center justify-center shadow-md shadow-emerald-500/30">
              L{runnerLevel}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-emerald-950 dark:text-white">{levelTitle}</span>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.2 rounded-full">
                  Level {runnerLevel}
                </span>
              </div>
              <span className="text-[11px] text-emerald-700/80 dark:text-slate-400 font-medium">
                {totalXP} Total XP Earned
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-400">
              {currentLevelProgressXP} / 250 XP
            </span>
          </div>
        </div>

        {/* Level XP Bar */}
        <div className="h-2 w-full rounded-full bg-emerald-200/50 dark:bg-slate-950 overflow-hidden mt-2.5">
          <div
            style={{ width: `${levelProgressPct}%` }}
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-lime-400 transition-all duration-500 shadow-sm"
          />
        </div>
      </div>

      {/* Next Up to Unlock Spotlight */}
      {nextUp && (
        <div
          onClick={() => setSelectedAchievement(nextUp.achievement)}
          className="rounded-3xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-slate-800 p-4 shadow-md hover:border-emerald-400 dark:hover:border-emerald-500/50 cursor-pointer active:scale-98 transition-all relative overflow-hidden group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <TrendingUp size={12} />
              <span>Closest Badge to Unlock</span>
            </span>
            <span className="text-[10px] font-bold text-slate-500 flex items-center gap-0.5 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
              <span>View Goal</span>
              <ChevronRight size={12} />
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-400/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              {React.createElement(getIconComponent(nextUp.achievement.icon), { size: 22 })}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-emerald-950 dark:text-white truncate">
                  {nextUp.achievement.name}
                </h4>
                <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {nextUp.progress.pct}%
                </span>
              </div>
              <p className="text-[11px] text-emerald-800/80 dark:text-slate-400 truncate">
                {nextUp.achievement.description}
              </p>
            </div>
          </div>

          <div className="h-1.5 w-full rounded-full bg-emerald-100 dark:bg-slate-950 overflow-hidden mt-3">
            <div
              style={{ width: `${nextUp.progress.pct}%` }}
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-lime-400"
            />
          </div>
        </div>
      )}

      {/* Badges Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800 p-8 text-center space-y-2">
          <Award size={32} className="mx-auto text-emerald-400 opacity-60" />
          <p className="text-sm font-bold text-emerald-950 dark:text-white">No badges found</p>
          <p className="text-xs text-emerald-700/80 dark:text-slate-400">Try switching your filter selection</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((ach) => {
            const isUnlocked = unlockedMap.has(ach.id);
            const unlockedInfo = unlockedMap.get(ach.id);
            const Icon = getIconComponent(ach.icon);
            const progress = getProgress(ach);
            const rarity = ach.rarity || 'common';
            const xp = ach.xp || (rarity === 'legendary' ? 500 : rarity === 'epic' ? 250 : rarity === 'rare' ? 100 : 50);

            // Completed (Unlocked) Styles
            const unlockedBorder = {
              common: 'border-slate-300 dark:border-slate-700 shadow-sm',
              rare: 'border-sky-400 dark:border-sky-500/80 shadow-[0_4px_16px_rgba(14,165,233,0.15)] ring-1 ring-sky-400/30',
              epic: 'border-amber-400 dark:border-amber-500/80 shadow-[0_4px_16px_rgba(245,158,11,0.18)] ring-1 ring-amber-400/30',
              legendary: 'border-emerald-400 dark:border-emerald-400 shadow-[0_4px_20px_rgba(16,185,129,0.22)] ring-1 ring-emerald-400/40',
            }[rarity];

            const unlockedIconStyle = {
              common: 'bg-gradient-to-tr from-slate-700 to-slate-500 dark:from-slate-700 dark:to-slate-500 text-white shadow-sm',
              rare: 'bg-gradient-to-tr from-sky-500 to-cyan-400 text-slate-950 shadow-md shadow-sky-500/30',
              epic: 'bg-gradient-to-tr from-amber-500 to-yellow-300 text-slate-950 shadow-md shadow-amber-500/30',
              legendary: 'bg-gradient-to-tr from-emerald-500 to-lime-300 text-slate-950 shadow-md shadow-emerald-500/30 animate-pulse',
            }[rarity];

            const unlockedRarityPill = {
              common: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700',
              rare: 'bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-300 border-sky-300 dark:border-sky-500/40 font-bold',
              epic: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/40 font-bold',
              legendary: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-400/60 dark:border-emerald-400/40 font-black',
            }[rarity];

            return (
              <div
                key={ach.id}
                onClick={() => setSelectedAchievement(ach)}
                className={`rounded-3xl p-4 flex flex-col justify-between gap-3 transition-all cursor-pointer active:scale-98 ${
                  isUnlocked
                    ? `bg-white dark:bg-slate-900 border-2 ${unlockedBorder} hover:shadow-xl`
                    : 'bg-slate-100/90 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 grayscale opacity-75 dark:opacity-55 hover:opacity-95 hover:grayscale-0'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Icon medallion */}
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border transition-transform ${
                      isUnlocked
                        ? unlockedIconStyle
                        : 'bg-slate-200/80 dark:bg-slate-900 border-slate-300 dark:border-slate-800 text-slate-400 dark:text-slate-600'
                    }`}
                  >
                    {isUnlocked ? <Icon size={24} /> : <Lock size={20} />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4
                        className={`text-xs font-bold truncate ${
                          isUnlocked ? 'text-slate-950 dark:text-white font-black' : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {ach.name}
                      </h4>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded-full border uppercase shrink-0 ${
                          isUnlocked
                            ? unlockedRarityPill
                            : 'bg-slate-200/70 dark:bg-slate-900 text-slate-500 dark:text-slate-500 border-slate-300 dark:border-slate-800'
                        }`}
                      >
                        {rarity}
                      </span>
                    </div>

                    <p
                      className={`text-[11px] mt-0.5 leading-tight line-clamp-2 ${
                        isUnlocked ? 'text-slate-700 dark:text-slate-300 font-medium' : 'text-slate-500 dark:text-slate-500'
                      }`}
                    >
                      {ach.description}
                    </p>
                  </div>
                </div>

                {/* Bottom card footer */}
                {!isUnlocked ? (
                  <div className="space-y-1 pt-1.5 border-t border-slate-200 dark:border-slate-800/60">
                    <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-500">
                      <span className="flex items-center gap-1 font-medium">
                        <Lock size={10} />
                        <span>Locked</span>
                      </span>
                      <span className="font-mono font-bold text-slate-600 dark:text-slate-400">{progress.pct}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-900 overflow-hidden">
                      <div
                        style={{ width: `${progress.pct}%` }}
                        className="h-full rounded-full bg-slate-400 dark:bg-slate-600"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-[10px] text-slate-600 dark:text-slate-300 pt-1.5 border-t border-slate-100 dark:border-slate-800/80">
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                      <CheckCircle2 size={13} />
                      <span>Unlocked</span>
                    </span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-500/20">
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

