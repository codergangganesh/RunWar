import React from 'react';
import { Filter, ChevronDown, Check } from 'lucide-react';
import { LeaderboardEntry } from '../../services/socialService';
import { LeaderboardSkeletonRow } from './SocialSkeletons';

interface LeaderboardViewProps {
  leaderboard: LeaderboardEntry[];
  isLoading: boolean;
  category: 'distance' | 'pace' | 'territories';
  timeframe: 'week' | 'month' | 'all';
  showTimeframeMenu: boolean;
  feedFilter: string;
  onCategoryChange: (category: 'distance' | 'pace' | 'territories') => void;
  onToggleTimeframeMenu: () => void;
  onSelectTimeframe: (timeframe: 'week' | 'month' | 'all') => void;
  onOpenAthleteProfile: (athlete: any) => void;
  formatDisplayName: (name?: string | null, userId?: string | null) => string;
}

const getInitials = (name?: string) => {
  if (!name) return 'R';
  const clean = name.replace(/^@/, '').trim();
  const letters = clean.replace(/[^a-zA-Z]/g, '');
  if (!letters) return 'R';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const p1 = parts[0].replace(/[^a-zA-Z]/g, '')[0];
    const p2 = parts[1].replace(/[^a-zA-Z]/g, '')[0];
    if (p1 && p2) return `${p1}${p2}`.toUpperCase();
  }
  return letters[0].toUpperCase();
};

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
  leaderboard,
  isLoading,
  category,
  timeframe,
  showTimeframeMenu,
  feedFilter,
  onCategoryChange,
  onToggleTimeframeMenu,
  onSelectTimeframe,
  onOpenAthleteProfile,
  formatDisplayName,
}) => {
  return (
    <div className="space-y-3 pt-1">
      {/* LEADERBOARD CATEGORIES & TIMEFRAME FILTER ROW */}
      <div className="flex items-center gap-2 relative">
        {/* Category Switcher Pill Container */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-white/[0.04] rounded-2xl border border-slate-200/80 dark:border-white/[0.06] flex-1 min-w-0">
          {[
            { id: 'distance' as const, label: 'Distance' },
            { id: 'pace' as const, label: 'Pace' },
            { id: 'territories' as const, label: 'Territories' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => onCategoryChange(cat.id)}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                category === cat.id
                  ? 'bg-emerald-500 text-white shadow-xs'
                  : 'text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className="truncate">{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Timeframe Filter Dropdown Button */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={onToggleTimeframeMenu}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold border transition-all cursor-pointer ${
              timeframe !== 'all'
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                : 'bg-white dark:bg-white/[0.04] border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-white/70 hover:border-emerald-400'
            }`}
            title="Filter Timeframe"
          >
            <Filter size={13} className={timeframe !== 'all' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'} />
            <span className="truncate">
              {timeframe === 'week' ? 'Week' : timeframe === 'month' ? 'Month' : 'All'}
            </span>
            <ChevronDown size={12} className={`text-slate-400 transition-transform ${showTimeframeMenu ? 'rotate-180' : ''}`} />
          </button>

          {showTimeframeMenu && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={onToggleTimeframeMenu}
              />
              <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-xl z-40 py-1.5 text-xs animate-in fade-in zoom-in-95">
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Timeframe
                </div>
                {[
                  { id: 'week' as const, label: 'This Week' },
                  { id: 'month' as const, label: 'This Month' },
                  { id: 'all' as const, label: 'All Time' },
                ].map((tf) => (
                  <button
                    key={tf.id}
                    type="button"
                    onClick={() => onSelectTimeframe(tf.id)}
                    className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-slate-100 dark:hover:bg-white/[0.06] cursor-pointer ${
                      timeframe === tf.id
                        ? 'text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/5'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span>{tf.label}</span>
                    {timeframe === tf.id && <Check size={14} className="text-emerald-500" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* LEADERBOARD LIST */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="space-y-2">
            <LeaderboardSkeletonRow />
            <LeaderboardSkeletonRow />
            <LeaderboardSkeletonRow />
            <LeaderboardSkeletonRow />
            <LeaderboardSkeletonRow />
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500 dark:text-white/40">
            No leaderboard runners found for "{feedFilter}" filter.
          </div>
        ) : (
          leaderboard.map((entry) => (
            <div
              key={entry.userId}
              onClick={() => onOpenAthleteProfile({
                userId: entry.userId,
                userName: formatDisplayName(entry.userName, entry.userId),
                userAvatar: entry.userAvatar,
                userBadge: entry.badge,
                totalDistanceKm: entry.totalDistanceKm,
                totalRuns: entry.totalRuns,
                avgPace: entry.avgPace,
                streakDays: entry.streakDays,
                isCurrentUser: entry.isCurrentUser,
              })}
              className={`p-3.5 sm:p-4 rounded-2xl border flex items-center justify-between gap-3 transition-all cursor-pointer hover:border-emerald-400 ${
                entry.rank === 1
                  ? 'bg-amber-500/10 border-amber-500/40 shadow-sm'
                  : 'bg-white dark:bg-white/[0.04] border-slate-200/80 dark:border-white/[0.08]'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                    entry.rank === 1
                      ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                      : entry.rank === 2
                        ? 'bg-slate-300 text-slate-900 font-bold'
                        : entry.rank === 3
                          ? 'bg-amber-700 text-white font-bold'
                          : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white/60'
                  }`}
                >
                  {entry.rank}
                </div>

                <div className="relative shrink-0">
                  {entry.userAvatar ? (
                    <img
                      src={entry.userAvatar}
                      alt={entry.userName}
                      className="w-10 h-10 rounded-full object-cover border border-emerald-500/30"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-bold flex items-center justify-center border border-emerald-500/30 text-xs">
                      {getInitials(entry.userName)}
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                    <span>{formatDisplayName(entry.userName, entry.userId)}</span>
                    {entry.badge && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-normal">
                        {entry.badge}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-white/40 flex items-center gap-2 mt-0.5">
                    <span>{entry.totalRuns} runs</span>
                    <span>•</span>
                    <span>Pace {entry.avgPace}</span>
                    {entry.territoriesHeld !== undefined && entry.territoriesHeld > 0 && (
                      <>
                        <span>•</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          {entry.territoriesHeld} zone(s)
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="font-black text-sm sm:text-base text-slate-900 dark:text-white font-mono">
                  {category === 'pace'
                    ? entry.avgPace
                    : category === 'territories'
                      ? `${entry.territoriesHeld || 0} zones`
                      : `${entry.totalDistanceKm} km`}
                </div>
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  {entry.streakDays}d streak 🔥
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
