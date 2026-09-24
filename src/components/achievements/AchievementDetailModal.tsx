import React, { useState } from 'react';
import { Achievement, UserAchievement } from '../../types';
import { BottomSheet } from '../ui/BottomSheet';
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
  Sunrise,
  Moon,
  Target,
  Share2,
  Check,
  Star,
} from 'lucide-react';
import { formatDistance } from '../../utils/formatters';

interface AchievementDetailModalProps {
  achievement: Achievement | null;
  userAchievement?: UserAchievement;
  progress: { current: number; max: number; pct: number };
  isOpen: boolean;
  onClose: () => void;
  distanceUnit?: 'km' | 'mi';
  isPinned?: boolean;
  onTogglePin?: (achievementId: string) => void;
}

export const AchievementDetailModal: React.FC<AchievementDetailModalProps> = ({
  achievement,
  userAchievement,
  progress,
  isOpen,
  onClose,
  distanceUnit = 'km',
  isPinned = false,
  onTogglePin,
}) => {
  const [copied, setCopied] = useState(false);

  if (!achievement) return null;

  const isUnlocked = !!userAchievement;
  const rarity = achievement.rarity || 'common';
  const xp = achievement.xp || (rarity === 'legendary' ? 500 : rarity === 'epic' ? 250 : rarity === 'rare' ? 100 : 50);

  const getIcon = (iconName: string) => {
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

  const Icon = getIcon(achievement.icon);

  // Rarity theme configuration
  const rarityConfig = {
    common: {
      label: 'COMMON',
      badgeBg: 'bg-slate-500/10 dark:bg-slate-500/20 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700',
      iconGlow: 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-200 border-slate-200 dark:border-slate-700',
      glowShadow: 'shadow-slate-500/10',
      accentColor: 'text-slate-500',
    },
    rare: {
      label: 'RARE',
      badgeBg: 'bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-300 border-sky-300 dark:border-sky-500/30',
      iconGlow: 'bg-sky-50 dark:bg-sky-950/50 text-sky-500 dark:text-sky-400 border-sky-300 dark:border-sky-500/40',
      glowShadow: 'shadow-sky-500/20 shadow-lg',
      accentColor: 'text-sky-500',
    },
    epic: {
      label: 'EPIC',
      badgeBg: 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/30',
      iconGlow: 'bg-amber-50 dark:bg-amber-950/50 text-amber-500 dark:text-amber-400 border-amber-400 dark:border-amber-500/50',
      glowShadow: 'shadow-amber-500/30 shadow-xl',
      accentColor: 'text-amber-500',
    },
    legendary: {
      label: 'LEGENDARY',
      badgeBg: 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30',
      iconGlow: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-500 dark:text-emerald-400 border-emerald-400 dark:border-emerald-400/60 animate-pulse',
      glowShadow: 'shadow-emerald-500/40 shadow-2xl',
      accentColor: 'text-emerald-500',
    },
  }[rarity];

  // Format requirement strings
  const formatRequirement = () => {
    switch (achievement.requirement_type) {
      case 'single_distance':
        return `Complete a single run of ${formatDistance(achievement.requirement_value, distanceUnit)} ${distanceUnit}`;
      case 'total_distance':
        return `Accumulate ${formatDistance(achievement.requirement_value, distanceUnit)} ${distanceUnit} in total running distance`;
      case 'workout_count':
        return `Complete ${achievement.requirement_value} total workouts`;
      case 'streak_days':
        return `Run for ${achievement.requirement_value} consecutive days`;
      case 'early_workout':
        return `Finish a workout before 7:00 AM`;
      case 'night_workout':
        return `Finish a workout after 8:00 PM`;
      case 'pace_threshold':
        return `Achieve a pace faster than 5:00 min/km in any run`;
      case 'single_calories':
        return `Burn over ${achievement.requirement_value} kcal in a single workout`;
      default:
        return achievement.description;
    }
  };

  const getRemainingMessage = () => {
    if (isUnlocked) return null;
    const remaining = Math.max(0, achievement.requirement_value - progress.current);

    switch (achievement.requirement_type) {
      case 'single_distance':
        return `Run ${formatDistance(achievement.requirement_value, distanceUnit)} ${distanceUnit} in one workout`;
      case 'total_distance':
        return `${formatDistance(remaining, distanceUnit)} ${distanceUnit} remaining to unlock`;
      case 'workout_count':
        return `${remaining} more workout${remaining === 1 ? '' : 's'} to unlock`;
      case 'streak_days':
        return `${remaining} more consecutive day${remaining === 1 ? '' : 's'} needed`;
      default:
        return `Complete this requirement to unlock`;
    }
  };

  const handleShare = async () => {
    const shareText = `🏆 I unlocked the "${achievement.name}" badge on RunWar (+${xp} XP)! 🏃‍♂️⚡\n${achievement.description}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `RunWar Achievement: ${achievement.name}`,
          text: shareText,
          url: window.location.origin,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Ignored
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div className="space-y-5 pb-4 text-center">
        {/* Holographic Badge Centerpiece */}
        <div className="flex flex-col items-center pt-2">
          <div className="relative group">
            {/* Ambient Backlight Glow */}
            <div
              className={`absolute -inset-4 rounded-full opacity-60 blur-xl pointer-events-none ${
                isUnlocked
                  ? rarity === 'legendary'
                    ? 'bg-emerald-400/40'
                    : rarity === 'epic'
                      ? 'bg-amber-400/40'
                      : rarity === 'rare'
                        ? 'bg-sky-400/40'
                        : 'bg-slate-400/30'
                  : 'bg-slate-400/10'
              }`}
            />

            {/* Badge Medallion Container */}
            <div
              className={`relative w-28 h-28 rounded-3xl border-2 flex items-center justify-center transition-all ${
                isUnlocked ? rarityConfig.iconGlow : 'bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-800 text-slate-400'
              } ${isUnlocked ? rarityConfig.glowShadow : ''}`}
            >
              {isUnlocked ? (
                <Icon size={54} className="transition-transform group-hover:scale-110 duration-200" />
              ) : (
                <div className="relative">
                  <Icon size={48} className="opacity-25" />
                  <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                    <Lock size={26} />
                  </div>
                </div>
              )}

              {/* Verified Unlocked Check Badge */}
              {isUnlocked && (
                <div className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center border-2 border-white dark:border-slate-950 shadow-md">
                  <CheckCircle2 size={16} />
                </div>
              )}
            </div>
          </div>

          {/* Rarity & XP Strip */}
          <div className="flex items-center gap-2 mt-4">
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-widest border uppercase ${rarityConfig.badgeBg}`}>
              {rarityConfig.label}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              +{xp} XP
            </span>
          </div>

          {/* Title & Description */}
          <h3 className="font-display text-2xl font-black text-emerald-950 dark:text-white mt-2">
            {achievement.name}
          </h3>
          <p className="text-xs text-emerald-800/80 dark:text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
            {achievement.description}
          </p>
        </div>

        {/* Progress & Target Section */}
        <div
          className={`rounded-2xl p-4 space-y-2 text-left border ${
            isUnlocked
              ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-500/30'
              : 'bg-slate-100 dark:bg-slate-900/90 border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-xs">
            <span className={`font-bold ${isUnlocked ? 'text-slate-950 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>
              {isUnlocked ? 'Requirement Completed' : 'Progress'}
            </span>
            <span className={`font-mono font-bold ${isUnlocked ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}`}>
              {isUnlocked ? '100%' : `${progress.pct}%`}
            </span>
          </div>

          {/* Progress Bar */}
          <div className={`h-2 w-full rounded-full overflow-hidden ${isUnlocked ? 'bg-emerald-100 dark:bg-slate-950' : 'bg-slate-200 dark:bg-slate-950'}`}>
            <div
              style={{ width: isUnlocked ? '100%' : `${progress.pct}%` }}
              className={`h-full rounded-full transition-all duration-500 ${
                isUnlocked
                  ? 'bg-gradient-to-r from-emerald-500 to-lime-400'
                  : 'bg-slate-400 dark:bg-slate-600'
              }`}
            />
          </div>

          {/* Requirement Info */}
          <p className={`text-[11px] pt-1 ${isUnlocked ? 'text-slate-700 dark:text-slate-300' : 'text-slate-500 dark:text-slate-400'}`}>
            <span className={`font-bold ${isUnlocked ? 'text-slate-950 dark:text-slate-200' : 'text-slate-700 dark:text-slate-300'}`}>Goal: </span>
            {formatRequirement()}
          </p>

          {!isUnlocked && (
            <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
              ⚡ {getRemainingMessage()}
            </p>
          )}

          {isUnlocked && userAchievement?.unlocked_at && (
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium pt-1 border-t border-emerald-200/60 dark:border-slate-800/80">
              Unlocked on {new Date(userAchievement.unlocked_at).toLocaleDateString([], {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-1">
          {isUnlocked && onTogglePin && (
            <button
              onClick={() => onTogglePin(achievement.id)}
              className={`w-full py-3 px-4 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 active:scale-98 transition-all ${
                isPinned
                  ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/30 text-amber-700 dark:text-amber-400'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-amber-300'
              }`}
            >
              <Star size={15} fill={isPinned ? 'currentColor' : 'none'} className={isPinned ? 'text-amber-500' : 'text-slate-400'} />
              <span>{isPinned ? 'Pinned to Athlete Trophy Case' : 'Pin to Profile Trophy Case (Top 3)'}</span>
            </button>
          )}

          {isUnlocked && (
            <button
              onClick={handleShare}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-500/30 flex items-center justify-center gap-2 active:scale-98 transition-all"
            >
              {copied ? <Check size={16} /> : <Share2 size={16} />}
              <span>{copied ? 'Achievement Copied to Clipboard!' : 'Share Achievement'}</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="w-full py-3 px-4 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-slate-800 text-emerald-900 dark:text-slate-300 font-bold text-xs hover:bg-emerald-50 dark:hover:bg-slate-800 active:scale-98 transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </BottomSheet>
  );
};
