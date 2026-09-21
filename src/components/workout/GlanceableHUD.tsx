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
    <div className="flex flex-col gap-3">
      {/* Massive Distance Hero Display */}
      <div
        className={`relative overflow-hidden rounded-3xl p-5 sm:p-6 text-center border transition-all duration-300 ${
          isAutoPaused
            ? 'bg-amber-950/30 border-amber-500/40 shadow-glow-amber'
            : isPaused
            ? 'bg-slate-900/90 border-amber-500/30'
            : 'bg-gradient-to-b from-slate-900 to-slate-950 border-slate-800 shadow-xl'
        }`}
      >
        {/* Status Pill in Corner */}
        {isAutoPaused ? (
          <div className="absolute top-3 right-4 flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold uppercase tracking-wider animate-pulse border border-amber-500/30">
            <PauseCircle size={13} />
            <span>Auto-Paused</span>
          </div>
        ) : isPaused ? (
          <div className="absolute top-3 right-4 flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-wider border border-amber-500/30">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>Paused</span>
          </div>
        ) : null}

        <div className="text-[11px] font-extrabold tracking-widest uppercase text-slate-400 mb-0.5 flex items-center justify-center gap-1.5">
          <Zap size={13} className="text-emerald-400" />
          <span>DISTANCE</span>
        </div>
        <div className="flex items-baseline justify-center gap-2">
          <span className="font-display text-7xl sm:text-8xl font-black tracking-tight text-white drop-shadow-md">
            {formattedDistance}
          </span>
          <span className="text-2xl sm:text-3xl font-bold uppercase text-emerald-400 tracking-wider">
            {distanceUnit}
          </span>
        </div>
      </div>

      {/* Primary Metrics Grid (Time & Pace) */}
      <div className="grid grid-cols-2 gap-3">
        {/* Time Card with Elapsed/Moving toggle */}
        <button
          onClick={() => setTimeViewMode(timeViewMode === 'moving' ? 'elapsed' : 'moving')}
          className="rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 p-3.5 flex flex-col justify-between shadow-md text-left transition-all active:scale-[0.99]"
          title="Click to toggle Moving Time vs Total Elapsed Time"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
            <div className="flex items-center gap-1.5">
              <Timer size={14} className="text-emerald-400" />
              <span>{timeViewMode === 'moving' ? 'MOVING TIME' : 'TOTAL TIME'}</span>
            </div>
            <span className="text-[10px] text-slate-500 bg-slate-800/80 px-1.5 py-0.5 rounded">
              {timeViewMode === 'moving' ? 'active' : 'total'}
            </span>
          </div>
          <div className="font-mono text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            {formattedTime}
          </div>
          {pausedTimeSeconds > 0 && (
            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
              Paused: {formatDuration(pausedTimeSeconds)}
            </div>
          )}
        </button>

        {/* Current Pace Card */}
        <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-3.5 flex flex-col justify-between shadow-md">
          <div className="flex items-center gap-1.5 text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Gauge size={14} className="text-emerald-400" />
            <span>CURRENT PACE</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-3xl sm:text-4xl font-extrabold text-emerald-400 tracking-tight">
              {currentPaceStr}
            </span>
            <span className="text-xs font-medium text-slate-400">{paceUnitLabel}</span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
            Speed: {displaySpeed} {speedUnitLabel}
          </div>
        </div>
      </div>

      {/* Secondary Metrics Strip */}
      <div className="grid grid-cols-3 gap-2.5">
        {/* Avg Pace */}
        <div className="rounded-2xl bg-slate-900/70 border border-slate-800/80 p-3 text-center">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide flex items-center justify-center gap-1">
            <Activity size={12} className="text-slate-400" />
            <span>AVG PACE</span>
          </div>
          <div className="font-mono text-lg font-bold text-slate-100 mt-0.5">
            {avgPaceStr}
          </div>
          <div className="text-[10px] text-slate-500">{paceUnitLabel}</div>
        </div>

        {/* Calories */}
        <div className="rounded-2xl bg-slate-900/70 border border-slate-800/80 p-3 text-center">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide flex items-center justify-center gap-1">
            <Flame size={12} className="text-amber-400" />
            <span>CALORIES</span>
          </div>
          <div className="font-mono text-lg font-bold text-amber-400 mt-0.5">
            {calories}
          </div>
          <div className="text-[10px] text-slate-500">kcal</div>
        </div>

        {/* Elevation Gain & Loss */}
        <div className="rounded-2xl bg-slate-900/70 border border-slate-800/80 p-3 text-center">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide flex items-center justify-center gap-1">
            <Mountain size={12} className="text-sky-400" />
            <span>ELEVATION</span>
          </div>
          <div className="font-mono text-lg font-bold text-sky-400 mt-0.5">
            +{Math.round(elevationGainMeters)}
          </div>
          <div className="text-[10px] text-slate-500">
            {elevationLossMeters > 0 ? `-${Math.round(elevationLossMeters)}m` : 'm'}
          </div>
        </div>
      </div>
    </div>
  );
};
