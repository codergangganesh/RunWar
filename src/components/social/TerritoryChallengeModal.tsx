import React from 'react';
import { X } from 'lucide-react';

interface ChallengeSectorData {
  name: string;
  commander: string;
  pace: string;
  km: string;
  streak?: number;
  difficulty?: string;
  elevationM?: number;
  bountyXp?: number;
  isUnderSiege?: boolean;
  circuitType?: number;
  coordinates?: any[];
  splitsTarget?: { km: number; pace: string }[];
  isRealUserWorkout?: boolean;
}

interface TerritoryChallengeModalProps {
  sector: ChallengeSectorData | null;
  onClose: () => void;
  onLaunchChallenge: () => void;
}

export const TerritoryChallengeModal: React.FC<TerritoryChallengeModalProps> = ({
  sector,
  onClose,
  onLaunchChallenge,
}) => {
  if (!sector) return null;

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-end justify-center select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Bottom Sheet Drawer */}
      <div className="relative z-10 w-full max-w-lg bg-white dark:bg-[#0f0f1a] text-slate-900 dark:text-white border-t border-x border-slate-200 dark:border-white/10 rounded-t-[32px] shadow-2xl p-5 sm:p-6 space-y-4 max-h-[85vh] overflow-y-auto animate-slide-up">
        {/* Grab Handle */}
        <div className="flex flex-col items-center -mt-1 pb-1 cursor-grab">
          <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-white/20" />
        </div>

        {/* Header: Title, Distance & Close Button */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white truncate">
                {sector.name}
              </h3>
              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 shrink-0">
                {sector.km}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-white/60 mt-1">
              Commander: <span className="font-semibold text-slate-800 dark:text-slate-200">{sector.commander}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Clean Minimal Target Pace Info */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-white/50 font-medium">Commander Pace</span>
            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
              {sector.pace}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200/60 dark:border-white/[0.06]">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5">
              <span>Target to Win:</span>
            </span>
            <span className="font-mono font-extrabold text-sm text-emerald-600 dark:text-emerald-400">
              &lt; {sector.pace}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onLaunchChallenge}
            className="flex-1 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold shadow-md shadow-emerald-500/20 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>Launch Run</span>
          </button>
        </div>
      </div>
    </div>
  );
};
