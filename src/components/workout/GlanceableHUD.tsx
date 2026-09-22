import React, { useState } from 'react';
import { DistanceUnit, PaceUnit } from '../../types';
import { formatDistance, formatDuration, formatPaceRaw, formatSpeed } from '../../utils/formatters';
import { Flame, Gauge, Mountain, Timer, Zap, PauseCircle, Activity } from 'lucide-react';

interface GlanceableHUDProps {
  distanceMeters: number;
  durationSeconds: number;
  movingTimeSeconds?: number;
  pausedTimeSeconds?: number;
  currentPaceSec: number;
  averagePaceSec: number;
  calories: number;
  currentSpeedKmh: number;
  averageSpeedKmh?: number;
  elevationGainMeters: number;
  elevationLossMeters?: number;
  distanceUnit?: DistanceUnit;
  paceUnit?: PaceUnit;
  isPaused?: boolean;
  isAutoPaused?: boolean;
}

export const GlanceableHUD: React.FC<GlanceableHUDProps> = ({
  distanceMeters,
  durationSeconds,
  movingTimeSeconds = 0,
  pausedTimeSeconds = 0,
  currentPaceSec,
  averagePaceSec,
  calories,
  currentSpeedKmh,
  averageSpeedKmh = 0,
  elevationGainMeters,
  elevationLossMeters = 0,
  distanceUnit = 'km',
  paceUnit = 'min_km',
  isPaused = false,
  isAutoPaused = false,
}) => {
  const [timeViewMode, setTimeViewMode] = useState<'elapsed' | 'moving'>('moving');

  const formattedDistance = formatDistance(distanceMeters, distanceUnit, 2);
  const activeDuration = timeViewMode === 'moving' && movingTimeSeconds > 0 ? movingTimeSeconds : durationSeconds;
  const formattedTime = formatDuration(activeDuration);
  const currentPaceStr = formatPaceRaw(currentPaceSec, paceUnit);
  const avgPaceStr = formatPaceRaw(averagePaceSec, paceUnit);
  const paceUnitLabel = paceUnit === 'min_mi' ? '/mi' : '/km';
  const speedUnitLabel = distanceUnit === 'mi' ? 'mph' : 'km/h';
  const displaySpeed = formatSpeed(currentSpeedKmh, distanceUnit);

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* Compact, Professional Distance Display */}
      <div
        className={`relative overflow-hidden rounded-2xl py-2.5 px-4 text-center border transition-all duration-300 ${
          isAutoPaused
            ? 'bg-amber-500/10 border-amber-500/40'
            : isPaused
            ? 'bg-slate-900/90 border-amber-500/30'
            : 'bg-white dark:bg-slate-900/90 border-emerald-100 dark:border-slate-800/90 shadow-sm'
        }`}
      >
        {/* Status Pill in Top Corner */}
        {isAutoPaused ? (
          <div className="absolute top-2 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300 text-[10px] font-bold uppercase tracking-wider animate-pulse border border-amber-500/30">
            <PauseCircle size={10} />
            <span>Auto-Paused</span>
          </div>
        ) : isPaused ? (
          <div className="absolute top-2 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wider border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>Paused</span>
          </div>
        ) : null}

        <div className="text-[10px] font-bold tracking-widest uppercase text-emerald-800/80 dark:text-slate-400 flex items-center justify-center gap-1">
          <Zap size={11} className="text-emerald-500 dark:text-emerald-400" />
          <span>DISTANCE</span>
        </div>
        <div className="flex items-baseline justify-center gap-1 mt-0.5">
          <span className="font-display text-3xl sm:text-4xl font-black tracking-tight text-emerald-950 dark:text-white">
            {formattedDistance}
          </span>
          <span className="text-xs sm:text-sm font-bold uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">
            {distanceUnit}
          </span>
        </div>
      </div>

      {/* Primary Metrics Grid (Time & Pace) - Smaller, Simpler, Clean */}
      <div className="grid grid-cols-2 gap-2">
        {/* Moving Time Card */}
        <button
          onClick={() => setTimeViewMode(timeViewMode === 'moving' ? 'elapsed' : 'moving')}
          className="rounded-2xl bg-white dark:bg-slate-900/90 border border-emerald-100 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-slate-700 p-2.5 sm:p-3 flex flex-col justify-between shadow-sm text-left transition-all active:scale-[0.99]"
          title="Click to toggle Moving Time vs Total Elapsed Time"
        >
          <div className="flex items-center justify-between text-emerald-800/80 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">
            <div className="flex items-center gap-1">
              <Timer size={11} className="text-emerald-600 dark:text-emerald-400" />
              <span>{timeViewMode === 'moving' ? 'MOVING TIME' : 'TOTAL TIME'}</span>
            </div>
            <span className="text-[9px] text-emerald-700 dark:text-slate-400 bg-emerald-50 dark:bg-slate-800 px-1 rounded font-mono">
              {timeViewMode === 'moving' ? 'active' : 'total'}
            </span>
          </div>
          <div className="font-mono text-lg sm:text-xl font-bold text-emerald-950 dark:text-white tracking-tight">
            {formattedTime}
          </div>
          <div className="text-[9px] text-emerald-700/70 dark:text-slate-500 font-mono mt-0.5">
            {pausedTimeSeconds > 0 ? `Paused: ${formatDuration(pausedTimeSeconds)}` : 'Live tracking'}
          </div>
        </button>

        {/* Current Pace Card */}
        <div className="rounded-2xl bg-white dark:bg-slate-900/90 border border-emerald-100 dark:border-slate-800 p-2.5 sm:p-3 flex flex-col justify-between shadow-sm">
          <div className="flex items-center gap-1 text-emerald-800/80 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">
            <Gauge size={11} className="text-emerald-600 dark:text-emerald-400" />
            <span>CURRENT PACE</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">
              {currentPaceStr}
            </span>
            <span className="text-[10px] font-medium text-emerald-800/70 dark:text-slate-400">{paceUnitLabel}</span>
          </div>
          <div className="text-[9px] text-emerald-700/70 dark:text-slate-500 font-mono mt-0.5">
            Speed: {displaySpeed} {speedUnitLabel}
          </div>
        </div>
      </div>

      {/* Secondary Metrics Strip (Average Pace, Calories, Elevation) */}
      <div className="grid grid-cols-3 gap-2">
        {/* Avg Pace */}
        <div className="rounded-2xl bg-white dark:bg-slate-900/80 border border-emerald-100 dark:border-slate-800/80 p-2 text-center shadow-sm">
          <div className="text-[9px] font-bold text-emerald-800/80 dark:text-slate-400 uppercase tracking-wide flex items-center justify-center gap-0.5">
            <Activity size={10} className="text-emerald-600 dark:text-slate-400" />
            <span>AVG PACE</span>
          </div>
          <div className="font-mono text-sm sm:text-base font-bold text-emerald-950 dark:text-slate-100 mt-0.5">
            {avgPaceStr}
          </div>
          <div className="text-[9px] text-emerald-700/70 dark:text-slate-500">{paceUnitLabel}</div>
        </div>

        {/* Calories */}
        <div className="rounded-2xl bg-white dark:bg-slate-900/80 border border-emerald-100 dark:border-slate-800/80 p-2 text-center shadow-sm">
          <div className="text-[9px] font-bold text-emerald-800/80 dark:text-slate-400 uppercase tracking-wide flex items-center justify-center gap-0.5">
            <Flame size={10} className="text-amber-500" />
            <span>CALORIES</span>
          </div>
          <div className="font-mono text-sm sm:text-base font-bold text-amber-600 dark:text-amber-400 mt-0.5">
            {calories}
          </div>
          <div className="text-[9px] text-amber-700/70 dark:text-slate-500">kcal</div>
        </div>

        {/* Elevation Gain & Loss */}
        <div className="rounded-2xl bg-white dark:bg-slate-900/80 border border-emerald-100 dark:border-slate-800/80 p-2 text-center shadow-sm">
          <div className="text-[9px] font-bold text-emerald-800/80 dark:text-slate-400 uppercase tracking-wide flex items-center justify-center gap-0.5">
            <Mountain size={10} className="text-sky-500" />
            <span>ELEVATION</span>
          </div>
          <div className="font-mono text-sm sm:text-base font-bold text-sky-600 dark:text-sky-400 mt-0.5">
            +{Math.round(elevationGainMeters)}m
          </div>
          <div className="text-[9px] text-sky-700/70 dark:text-slate-500">
            {elevationLossMeters > 0 ? `-${Math.round(elevationLossMeters)}m` : 'gain'}
          </div>
        </div>
      </div>
    </div>
  );
};
