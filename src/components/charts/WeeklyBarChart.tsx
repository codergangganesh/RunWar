import React from 'react';
import { DistanceUnit } from '../../types';

interface WeeklyBarChartProps {
  dayNames: string[];
  dailyDistanceMeters: number[];
  distanceUnit?: DistanceUnit;
  className?: string;
}

export const WeeklyBarChart: React.FC<WeeklyBarChartProps> = ({
  dayNames,
  dailyDistanceMeters,
  distanceUnit = 'km',
  className = 'w-full',
}) => {
  const maxDistance = Math.max(...dailyDistanceMeters, 1000); // at least 1km scale
  const todayDayIndex = (new Date().getDay() + 6) % 7; // Convert 0(Sun)->6, 1(Mon)->0
  const totalDistanceKm = (dailyDistanceMeters.reduce((a, b) => a + b, 0) / 1000);
  const activeDaysCount = dailyDistanceMeters.filter((m) => m > 0).length;

  return (
    <div className={`rounded-2xl bg-white dark:bg-slate-900/90 border border-emerald-100 dark:border-slate-800 p-4 shadow-md dark:shadow-lg flex flex-col justify-between min-h-[220px] sm:min-h-[250px] ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-slate-400">
            This Week's Activity
          </h3>
          <span className="text-[11px] text-emerald-700/80 dark:text-slate-500">
            {activeDaysCount} {activeDaysCount === 1 ? 'active day' : 'active days'}
          </span>
        </div>
        <div className="text-right">
          <span className="font-display text-base font-black text-emerald-600 dark:text-emerald-400">
            {totalDistanceKm.toFixed(1)} {distanceUnit}
          </span>
          <div className="text-[9px] text-emerald-700/70 dark:text-slate-500 uppercase font-semibold">total distance</div>
        </div>
      </div>

      {/* Expanded Chart Area that covers the remaining height */}
      <div className="flex-1 flex flex-col justify-end min-h-[140px] sm:min-h-[160px] pt-4 pb-1 relative">
        {/* Subtle Horizontal Reference Grid Lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-7 opacity-30">
          <div className="border-b border-dashed border-emerald-300 dark:border-slate-700 w-full" />
          <div className="border-b border-dashed border-emerald-300 dark:border-slate-700 w-full" />
          <div className="border-b border-emerald-200 dark:border-slate-800 w-full" />
        </div>

        {/* Vertical Bar Columns */}
        <div className="flex items-end justify-between gap-2.5 h-full relative z-10 px-1">
          {dayNames.map((day, idx) => {
            const meters = dailyDistanceMeters[idx] || 0;
            const km = (meters / 1000).toFixed(1);
            const heightPct = meters > 0 ? Math.max(18, Math.min(100, (meters / maxDistance) * 100)) : 4;
            const isToday = idx === todayDayIndex;
            const hasActivity = meters > 0;

            return (
              <div key={day} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                {/* Value / Tooltip Indicator */}
                {hasActivity ? (
                  <span className="text-[9px] font-mono font-bold text-emerald-700 dark:text-emerald-300 mb-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    {km}
                  </span>
                ) : (
                  <span className="text-[9px] font-mono text-transparent mb-1">-</span>
                )}

                {/* The Bar */}
                <div className="w-full flex justify-center items-end flex-1">
                  <div
                    style={{ height: `${heightPct}%` }}
                    className={`w-full max-w-[32px] rounded-t-lg transition-all duration-500 ${
                      hasActivity
                        ? isToday
                          ? 'bg-gradient-to-t from-emerald-600 to-emerald-400 shadow-md shadow-emerald-500/40 dark:shadow-glow-brand'
                          : 'bg-gradient-to-t from-emerald-600/80 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400'
                        : 'bg-emerald-100/80 dark:bg-slate-800/60'
                    }`}
                  />
                </div>

                {/* Day Label */}
                <span
                  className={`text-[11px] mt-2 transition-colors ${
                    isToday
                      ? 'text-emerald-700 dark:text-emerald-400 font-black'
                      : hasActivity
                      ? 'text-emerald-900 dark:text-slate-200 font-bold'
                      : 'text-emerald-800/60 dark:text-slate-400 font-medium'
                  }`}
                >
                  {day}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
