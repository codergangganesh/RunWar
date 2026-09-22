import React from 'react';
import { LiveWorkoutState } from '../../types';
import { formatDistance, formatDuration, formatPace } from '../../utils/formatters';
import { AlertCircle, Play, CheckCircle2, Trash2 } from 'lucide-react';

interface RecoveryModalProps {
  backup: LiveWorkoutState;
  onResume: () => void;
  onFinish: () => void;
  onDiscard: () => void;
}

export const RecoveryModal: React.FC<RecoveryModalProps> = ({
  backup,
  onResume,
  onFinish,
  onDiscard,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-500 dark:text-amber-400 flex items-center justify-center">
            <AlertCircle size={28} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Active Workout Found</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Your previous {backup.type} session was recovered.
            </p>
          </div>
        </div>

        {/* Quick summary of recovered run */}
        <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-center">
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Distance</div>
            <div className="text-sm font-bold text-emerald-500 dark:text-emerald-400">
              {formatDistance(backup.distanceMeters, 'km')} km
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Time</div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              {formatDuration(backup.elapsedTime)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Avg Pace</div>
            <div className="text-sm font-bold text-slate-600 dark:text-slate-300">
              {formatPace(backup.averagePace)}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2.5 mt-2">
          <button
            onClick={onResume}
            className="w-full py-3.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-white dark:text-slate-950 font-bold text-sm shadow-glow-brand flex items-center justify-center gap-2 transition-all"
          >
            <Play size={18} fill="currentColor" />
            <span>Resume Workout</span>
          </button>

          <button
            onClick={onFinish}
            className="w-full py-3 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 text-slate-900 dark:text-white font-semibold text-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2 transition-all"
          >
            <CheckCircle2 size={18} className="text-emerald-500 dark:text-emerald-400" />
            <span>Finish & Save</span>
          </button>

          <button
            onClick={onDiscard}
            className="w-full py-2.5 px-4 rounded-xl text-rose-500 dark:text-rose-400 hover:bg-rose-500/10 active:scale-95 font-medium text-xs flex items-center justify-center gap-1.5 transition-all"
          >
            <Trash2 size={14} />
            <span>Discard Session</span>
          </button>
        </div>
      </div>
    </div>
  );
};
