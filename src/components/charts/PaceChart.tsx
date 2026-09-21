import React from 'react';
import { WorkoutSplit } from '../../types';
import { formatPace } from '../../utils/formatters';

interface PaceChartProps {
  splits: WorkoutSplit[];
  averagePaceSec?: number;
  className?: string;
}

export const PaceChart: React.FC<PaceChartProps> = ({
  splits,
  averagePaceSec,
  className = 'h-44 w-full',
}) => {
  if (!splits || splits.length === 0) {
    return (
      <div className={`rounded-2xl bg-slate-900/50 border border-slate-800/80 p-6 flex items-center justify-center text-slate-500 text-xs ${className}`}>
        No pace split data available
      </div>
    );
  }

  const paces = splits.map((s) => s.pace);
  const minPace = Math.min(...paces);
  const maxPace = Math.max(...paces);
  const range = Math.max(30, maxPace - minPace);
  const avg = averagePaceSec || paces.reduce((a, b) => a + b, 0) / paces.length;

  return (
    <div className={`rounded-2xl bg-slate-900/90 border border-slate-800 p-4 shadow-lg flex flex-col justify-between ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
          Pace by Kilometer
        </h3>
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" /> Faster
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-amber-500 inline-block" /> Slower
          </span>
        </div>
      </div>

      {/* Bar graph representation */}
      <div className="flex items-end gap-2.5 h-28 pt-2 pb-1 px-1">
        {splits.map((split) => {
          // Normalized bar height percentage (invert since lower pace = faster = taller bar)
          const paceRatio = (maxPace - split.pace) / range;
          const heightPct = Math.max(25, Math.min(100, 30 + paceRatio * 70));
          const isFaster = split.pace <= avg;

          return (
            <div key={split.split_number} className="flex-1 flex flex-col items-center h-full justify-end group relative">
              {/* Tooltip on hover */}
              <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-slate-800 text-white text-[10px] font-mono py-1 px-2 rounded border border-slate-700 whitespace-nowrap z-20 shadow-md">
                Km {split.split_number}: {formatPace(split.pace)}
              </div>

              <div
                style={{ height: `${heightPct}%` }}
                className={`w-full rounded-t-lg transition-all duration-300 ${
                  isFaster
                    ? 'bg-gradient-to-t from-emerald-600 to-emerald-400 shadow-glow-brand'
                    : 'bg-gradient-to-t from-amber-600 to-amber-400'
                }`}
              />
              <span className="text-[10px] font-bold text-slate-400 mt-1">
                {split.split_number}k
              </span>
            </div>
          );
        })}
      </div>

      {/* Average line indicator */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
        <span>Average Pace</span>
        <span className="font-mono font-bold text-emerald-400">{formatPace(avg)}</span>
      </div>
    </div>
  );
};
