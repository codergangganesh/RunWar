import React from 'react';
import { Footprints, Activity, ShieldCheck, Cpu } from 'lucide-react';
import { StepTrackingMode } from '../../types/stepCounter';

interface StepMetricCardProps {
  steps: number;
  cadence?: number;
  mode?: StepTrackingMode;
  isCompact?: boolean;
  className?: string;
}

export const StepMetricCard: React.FC<StepMetricCardProps> = ({
  steps = 0,
  cadence = 0,
  mode = 'device_motion',
  isCompact = false,
  className = '',
}) => {
  const formattedSteps = Number(steps || 0).toLocaleString();

  const getModeLabel = () => {
    switch (mode) {
      case 'native_sensor':
        return 'Hardware';
      case 'device_motion':
        return 'Motion';
      default:
        return 'Calibrated';
    }
  };

  if (isCompact) {
    return (
      <div
        className={`rounded-2xl bg-white dark:bg-slate-900/80 border border-emerald-100 dark:border-slate-800/80 p-2 text-center shadow-sm ${className}`}
        title={`Step Tracking Mode: ${getModeLabel()}`}
      >
        <div className="text-[9px] font-bold text-emerald-800/80 dark:text-slate-400 uppercase tracking-wide flex items-center justify-center gap-0.5">
          <Footprints size={10} className="text-emerald-500" />
          <span>STEPS</span>
        </div>
        <div className="font-mono text-sm sm:text-base font-bold text-emerald-950 dark:text-slate-100 mt-0.5">
          {formattedSteps}
        </div>
        <div className="text-[9px] text-emerald-700/70 dark:text-slate-500">
          {cadence > 0 ? `${cadence} spm` : 'steps'}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl bg-white dark:bg-slate-900/90 border border-emerald-100 dark:border-slate-800 p-2.5 sm:p-3 flex flex-col justify-between shadow-sm transition-all ${className}`}
    >
      <div className="flex items-center justify-between text-emerald-800/80 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">
        <div className="flex items-center gap-1">
          <Footprints size={11} className="text-emerald-500" />
          <span>SESSION STEPS</span>
        </div>
        <div className="flex items-center gap-1 text-[9px] text-emerald-700 dark:text-slate-400 bg-emerald-50 dark:bg-slate-800 px-1.5 py-0.2 rounded font-mono">
          <Cpu size={9} className="text-emerald-500" />
          <span>{getModeLabel()}</span>
        </div>
      </div>

      <div className="flex items-baseline gap-1 mt-0.5">
        <span className="font-mono text-lg sm:text-xl font-bold text-emerald-950 dark:text-white tracking-tight">
          {formattedSteps}
        </span>
        <span className="text-[10px] font-medium text-emerald-800/70 dark:text-slate-400">
          steps
        </span>
      </div>

      <div className="flex items-center justify-between text-[9px] text-emerald-700/70 dark:text-slate-500 font-mono mt-0.5">
        <div className="flex items-center gap-1">
          <Activity size={9} className="text-emerald-600 dark:text-emerald-400" />
          <span>{cadence > 0 ? `${cadence} SPM` : 'Cadence: --'}</span>
        </div>
        <span className="text-[8px] opacity-75">Live pedometer</span>
      </div>
    </div>
  );
};
