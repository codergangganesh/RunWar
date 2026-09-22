import React from 'react';
import { DistanceUnit, PaceUnit, WorkoutSplit } from '../../types';
import { formatDistance, formatDuration, formatPace } from '../../utils/formatters';

interface SplitsTableProps {
  splits: WorkoutSplit[];
  averagePaceSec?: number;
  distanceUnit?: DistanceUnit;
  paceUnit?: PaceUnit;
}

export const SplitsTable: React.FC<SplitsTableProps> = ({
  splits,
  averagePaceSec,
  distanceUnit = 'km',
  paceUnit = 'min_km',
}) => {
  if (!splits || splits.length === 0) {
    return (
      <div className="rounded-2xl bg-slate-900/50 border border-slate-800/80 p-6 text-center text-slate-500 text-xs">
        No splits recorded yet. Complete at least 1 {distanceUnit} to generate splits.
      </div>
    );
  }

  const avg = averagePaceSec || splits.reduce((acc, s) => acc + s.pace, 0) / splits.length;

  return (
    <div className="rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-lg">
      <div className="px-4 py-3 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
          {distanceUnit === 'mi' ? 'Mile' : 'Kilometer'} Splits
        </h3>
        <span className="text-[11px] text-slate-500 font-medium">
          {splits.length} {splits.length === 1 ? 'split' : 'splits'}
        </span>
      </div>

      <div className="divide-y divide-slate-800/60">
        <div className="grid grid-cols-4 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-900/50">
          <span>Split</span>
          <span className="text-right">Distance</span>
          <span className="text-right">Time</span>
          <span className="text-right">Pace</span>
        </div>

        {splits.map((split) => {
          const isFaster = split.pace <= avg;
          const isPartial = split.distance_meters < 800 && split.split_number === splits.length;

          return (
            <div
              key={split.split_number}
              className="grid grid-cols-4 items-center px-4 py-3 text-xs font-mono hover:bg-slate-800/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-bold flex items-center justify-center">
                  {split.split_number}
                </span>
                {isPartial && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-sans">
                    Partial
                  </span>
                )}
              </div>

              <div className="text-right text-slate-300">
                {formatDistance(split.distance_meters, distanceUnit)} {distanceUnit}
              </div>

              <div className="text-right text-slate-300 font-medium">
                {formatDuration(split.duration_seconds)}
              </div>

              <div className="text-right flex items-center justify-end gap-1.5">
                <span
                  className={`font-bold ${
                    isFaster ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {formatPace(split.pace, paceUnit)}
                </span>
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isFaster ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
