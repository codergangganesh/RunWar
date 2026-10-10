import React from 'react';

/**
 * High-fidelity Skeleton Card matching the post card geometry & layout
 */
export const FeedSkeletonCard: React.FC = () => {
  return (
    <div className="bg-white dark:bg-white/[0.04] rounded-[28px] p-5 sm:p-6 shadow-sm space-y-4 border border-slate-100 dark:border-white/[0.08] backdrop-blur-md animate-pulse">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          {/* Avatar circle skeleton */}
          <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-white/10 shrink-0" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-32 sm:w-44 bg-slate-200 dark:bg-white/10 rounded-lg" />
            <div className="flex items-center gap-2">
              <div className="h-3 w-16 bg-slate-100 dark:bg-white/[0.06] rounded-full" />
              <div className="h-3 w-28 bg-slate-100 dark:bg-white/[0.06] rounded-md" />
            </div>
          </div>
        </div>
        {/* Kebab menu placeholder */}
        <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-white/[0.06] shrink-0" />
      </div>

      {/* Caption Skeleton */}
      <div className="space-y-2 pt-1">
        <div className="h-3.5 w-4/5 bg-slate-200 dark:bg-white/10 rounded-md" />
        <div className="h-3.5 w-3/5 bg-slate-100 dark:bg-white/[0.06] rounded-md" />
      </div>

      {/* Route Map / Workout HUD Box Skeleton */}
      <div className="w-full h-44 sm:h-52 rounded-2xl bg-slate-100 dark:bg-white/[0.05] relative overflow-hidden flex flex-col justify-between p-3.5 border border-slate-200/50 dark:border-white/[0.05]">
        <div className="h-5 w-24 bg-slate-200/80 dark:bg-white/10 rounded-full" />
        <div className="h-5 w-32 bg-slate-200/80 dark:bg-white/10 rounded-full self-end" />
      </div>

      {/* Metric Stat Chips Skeleton */}
      <div className="grid grid-cols-3 gap-2">
        <div className="h-10 rounded-xl bg-slate-100 dark:bg-white/[0.05]" />
        <div className="h-10 rounded-xl bg-slate-100 dark:bg-white/[0.05]" />
        <div className="h-10 rounded-xl bg-slate-100 dark:bg-white/[0.05]" />
      </div>

      {/* Footer Reaction Bar Skeleton */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/[0.06]">
        <div className="flex items-center gap-1.5">
          <div className="h-8 w-14 rounded-full bg-slate-100 dark:bg-white/[0.05]" />
          <div className="h-8 w-14 rounded-full bg-slate-100 dark:bg-white/[0.05]" />
          <div className="h-8 w-14 rounded-full bg-slate-100 dark:bg-white/[0.05]" />
        </div>
        <div className="h-8 w-20 rounded-full bg-slate-100 dark:bg-white/[0.05]" />
      </div>
    </div>
  );
};

/**
 * High-fidelity Skeleton Row matching the Leaderboard entry geometry & layout
 */
export const LeaderboardSkeletonRow: React.FC = () => {
  return (
    <div className="p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] flex items-center justify-between gap-3 animate-pulse">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Rank circle skeleton */}
        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-white/10 shrink-0" />

        {/* Avatar circle skeleton */}
        <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-white/10 shrink-0" />

        {/* Athlete Name and Subtext */}
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="h-4 w-28 sm:w-36 bg-slate-200 dark:bg-white/10 rounded-md" />
          <div className="flex items-center gap-2">
            <div className="h-3 w-16 bg-slate-100 dark:bg-white/[0.06] rounded-md" />
            <div className="h-3 w-20 bg-slate-100 dark:bg-white/[0.06] rounded-md" />
          </div>
        </div>
      </div>

      {/* Metric Stat Skeleton */}
      <div className="text-right shrink-0 space-y-1.5">
        <div className="h-5 w-16 bg-slate-200 dark:bg-white/10 rounded-md ml-auto" />
        <div className="h-3 w-12 bg-slate-100 dark:bg-white/[0.06] rounded-md ml-auto" />
      </div>
    </div>
  );
};
