import React, { useState } from 'react';
import { WorkoutSplit } from '../../types';
import { formatPace, formatDuration } from '../../utils/formatters';
import { Gauge, X } from 'lucide-react';

interface PaceChartProps {
  splits: WorkoutSplit[];
  averagePaceSec?: number;
  className?: string;
}

export const PaceChart: React.FC<PaceChartProps> = ({
  splits,
  averagePaceSec,
  className = 'w-full',
}) => {

  if (!splits || splits.length === 0) {
    return (
      <div
        className={`rounded-3xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800 p-6 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-xs shadow-sm ${className}`}
      >
        <Gauge size={20} className="mb-1 text-slate-400 opacity-60" />
        <span>No pace split data available</span>
      </div>
    );
  }

  const paces = splits.map((s) => s.pace);
  const minPace = Math.min(...paces);
  const maxPace = Math.max(...paces);
  const range = Math.max(30, maxPace - minPace);
  const avg = averagePaceSec || paces.reduce((a, b) => a + b, 0) / paces.length;

  return (
    <div
      className={`rounded-3xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800 p-4 sm:p-5 shadow-sm space-y-3 select-none ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Gauge size={15} />
          </div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Pace by Kilometer
          </h3>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Faster
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Slower
          </span>
        </div>
      </div>


      {/* Bar Graph */}
      <div className="flex items-end gap-1.5 sm:gap-2.5 h-28 pt-2 pb-1 px-1">
        {splits.map((split) => {
          const paceRatio = (maxPace - split.pace) / range;
          const heightPct = Math.max(25, Math.min(100, 30 + paceRatio * 70));
          const isFaster = split.pace <= avg;

          return (
            <div
              key={split.split_number}
              className="flex-1 flex flex-col items-center h-full justify-end group relative cursor-pointer"
            >
              {/* Tooltip on hover */}
              <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-slate-800/90 dark:bg-slate-700/90 text-white text-[10px] font-mono py-1 px-2 rounded-lg border border-slate-700/50 whitespace-nowrap z-20 shadow-md backdrop-blur-sm">
                <span className="font-bold text-emerald-400">Km {split.split_number}</span>: {formatPace(split.pace)}
              </div>

              <div
                style={{ height: `${heightPct}%` }}
                className={`w-full rounded-t-lg transition-all duration-300 hover:opacity-85 ${isFaster
                    ? 'bg-gradient-to-t from-emerald-600 to-emerald-400 shadow-glow-brand'
                    : 'bg-gradient-to-t from-amber-600 to-amber-400'
                  }`}
              />
              <span
                className="text-[10px] font-bold mt-1 transition-colors text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300"
              >
                {split.split_number}k
              </span>
            </div>
          );
        })}
      </div>

      {/* Average Line Indicator */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800/80">
        <span>Average Pace</span>
        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
          {formatPace(avg)}
        </span>
      </div>
    </div>
  );
};
