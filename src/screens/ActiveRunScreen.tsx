import React, { useState, useEffect } from 'react';
import { LiveWorkoutState, SplitToastInfo, UserProfile, UserSettings, WorkoutType } from '../types';
import { gpsEngine } from '../services/gpsEngine';
import { audioCoach } from '../services/audioCoach';
import { GlanceableHUD } from '../components/workout/GlanceableHUD';
import { LiveWorkoutMap } from '../components/map/LiveWorkoutMap';
import {
  Play,
  Pause,
  Square,
  Volume2,
  VolumeX,
  Map as MapIcon,
  Layout,
  Gauge,
  Compass,
  WifiOff,
  CloudUpload,
  Flag,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { formatDistance, formatDuration, formatPace, formatPaceRaw } from '../utils/formatters';

interface ActiveRunScreenProps {
  workoutType: WorkoutType;
  profile: UserProfile | null;
  settings: UserSettings | null;
  onFinishWorkout: (workoutState: LiveWorkoutState) => void;
  onDiscardWorkout: () => void;
}

export const ActiveRunScreen: React.FC<ActiveRunScreenProps> = ({
  workoutType,
  profile,
  settings,
  onFinishWorkout,
  onDiscardWorkout,
}) => {
  const [workoutState, setWorkoutState] = useState<LiveWorkoutState>(gpsEngine.getState());
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showSplitsDrawer, setShowSplitsDrawer] = useState(false);
  const [viewMode, setViewMode] = useState<'split' | 'map'>('split');
  const [audioMuted, setAudioMuted] = useState(!audioCoach.getIsEnabled());
  const [simMode, setSimMode] = useState(gpsEngine.isSimulationMode);
  const [activeToast, setActiveToast] = useState<SplitToastInfo | null>(null);

  // Auto-dismiss kilometer split toast after 6 seconds
  useEffect(() => {
    if (workoutState.activeSplitToast) {
      setActiveToast(workoutState.activeSplitToast);
      const timer = setTimeout(() => {
        setActiveToast(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [workoutState.activeSplitToast?.timestamp]);

  // Subscribe to GPS & Engine updates
  useEffect(() => {
    gpsEngine.setOptions(
      profile?.weight || 70,
      settings?.auto_pause ?? true,
      settings?.auto_pause_threshold || 10,
      profile?.user_id
    );

    audioCoach.setConfig(
      !audioMuted && (settings?.audio_coaching ?? true),
      settings?.audio_frequency || '1km'
    );

    const unsubscribe = gpsEngine.subscribe((state) => {
      setWorkoutState(state);
    });

    if (workoutState.status === 'idle') {
      gpsEngine.startTracking(workoutType);
    }

    return () => {
      unsubscribe();
    };
  }, [workoutType, profile, settings, audioMuted]);

  const handlePauseResume = () => {
    if (workoutState.status === 'tracking') {
      gpsEngine.pauseTracking(false);
    } else if (workoutState.status === 'paused') {
      gpsEngine.resumeTracking();
    }
  };

  const handleConfirmFinish = () => {
    const finalState = gpsEngine.finishTracking();
    onFinishWorkout(finalState);
  };

  const handleToggleSimulation = () => {
    const nextMode = !simMode;
    gpsEngine.isSimulationMode = nextMode;
    setSimMode(nextMode);
    if (workoutState.status === 'tracking') {
      gpsEngine.startTracking(workoutType);
    }
  };

  const handleToggleViewMode = () => {
    setViewMode((prev) => (prev === 'split' ? 'map' : 'split'));
  };

  const isPaused = workoutState.status === 'paused';
  const distanceUnit = profile?.distance_unit || 'km';
  const paceUnit = profile?.pace_unit || 'min_km';

  // Format GPS Status
  const getGpsBadge = () => {
    const status = workoutState.gpsStatus;
    const acc = workoutState.gpsAccuracy ? Math.round(workoutState.gpsAccuracy) : null;

    if (status === 'locked') {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
          <span>GPS Locked {acc ? `(±${acc}m)` : ''}</span>
        </div>
      );
    }
    if (status === 'weak') {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400" />
          <span>GPS Weak {acc ? `(±${acc}m)` : ''}</span>
        </div>
      );
    }
    if (status === 'lost') {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-bold bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/40 animate-pulse">
          <AlertTriangle size={11} />
          <span>GPS Lost</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-bold bg-emerald-50 dark:bg-slate-800 text-emerald-800 dark:text-slate-400 border border-emerald-200 dark:border-slate-700">
        <Compass size={11} className="animate-spin" />
        <span>Acquiring GPS...</span>
      </div>
    );
  };

  // Format Sync Status
  const getNetworkBadge = () => {
    const status = workoutState.networkStatus;
    if (status === 'offline') {
      return (
        <div
          className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 border border-slate-300 dark:border-slate-700"
          title="Offline mode: points saved locally"
        >
          <WifiOff size={11} />
          <span>Offline</span>
        </div>
      );
    }
    if (status === 'syncing') {
      return (
        <div
          className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30 animate-pulse"
          title="Syncing coordinates..."
        >
          <CloudUpload size={11} />
          <span>Syncing</span>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-[100dvh] max-h-[100dvh] w-full bg-emerald-50/40 dark:bg-slate-950 text-slate-900 dark:text-white flex flex-col justify-between items-center p-3 sm:p-4 select-none relative overflow-hidden">
      <div className="w-full max-w-xl md:max-w-2xl flex flex-col flex-1 justify-between gap-2 relative h-full min-h-0">
        {/* Top Status & Controls Header */}
        <div className="flex items-center justify-between z-20 shrink-0">
          {/* GPS, Network & Sim Mode */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {getGpsBadge()}
            {getNetworkBadge()}

            <button
              onClick={handleToggleSimulation}
              className={`px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-bold border transition-all active:scale-95 ${simMode
                  ? 'bg-lime-500/20 text-lime-700 dark:text-lime-400 border-lime-500/40'
                  : 'bg-white dark:bg-slate-900 border-emerald-200 dark:border-slate-800 text-emerald-800/80 dark:text-slate-400 hover:text-emerald-950 dark:hover:text-slate-200'
                }`}
              title="Toggle realistic GPS route simulation"
            >
              {simMode ? '⚡ Sim ON' : 'Sim Mode'}
            </button>
          </div>

          {/* Voice Coach, Splits & View Switcher */}
          <div className="flex items-center gap-1.5">
            {/* Splits Drawer Trigger */}
            {workoutState.splits && workoutState.splits.length > 0 && (
              <button
                onClick={() => setShowSplitsDrawer(!showSplitsDrawer)}
                className={`p-2 rounded-xl border transition-all active:scale-95 ${showSplitsDrawer
                    ? 'bg-emerald-500 text-white dark:text-slate-950 border-emerald-500'
                    : 'bg-white dark:bg-slate-900 border-emerald-200 dark:border-slate-800 text-emerald-800 dark:text-slate-400'
                  }`}
                title="View kilometer splits"
              >
                <Flag size={15} />
              </button>
            )}

            {/* Voice Coach Toggle */}
            <button
              onClick={() => setAudioMuted(!audioMuted)}
              className={`p-2 rounded-xl border transition-all active:scale-95 ${audioMuted
                  ? 'bg-white dark:bg-slate-900 border-emerald-200 dark:border-slate-800 text-slate-400'
                  : 'bg-emerald-500 text-white dark:text-slate-950 border-emerald-500 shadow-sm shadow-emerald-500/20'
                }`}
              title={audioMuted ? 'Voice coach: Muted' : 'Voice coach: Active'}
            >
              {audioMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>

            {/* View Mode Switcher (Split View vs Fullscreen Map) */}
            <button
              onClick={handleToggleViewMode}
              className={`p-2 rounded-xl border transition-all active:scale-95 flex items-center gap-1 text-xs font-bold ${viewMode === 'map'
                  ? 'bg-emerald-500 text-white dark:text-slate-950 border-emerald-500 shadow-md'
                  : 'bg-white dark:bg-slate-900 border-emerald-200 dark:border-slate-800 text-emerald-800 dark:text-slate-300 hover:text-emerald-950 dark:hover:text-white'
                }`}
              title={viewMode === 'split' ? 'Expand to Full Map View' : 'Switch to Split View (Map + Stats)'}
              aria-label={viewMode === 'split' ? 'Expand to Full Map View' : 'Switch to Split View'}
            >
              {viewMode === 'split' ? <MapIcon size={15} /> : <Layout size={15} />}
            </button>
          </div>
        </div>

        {/* Floating Kilometer Split Milestone Toast */}
        {activeToast && (
          <div className="fixed top-14 left-4 right-4 z-50 flex justify-center pointer-events-none animate-bounce">
            <div className="bg-white/95 dark:bg-slate-900/95 border-2 border-emerald-500 rounded-2xl p-3 shadow-2xl backdrop-blur-md flex items-center gap-3 text-slate-900 dark:text-white max-w-sm w-full pointer-events-auto transition-all">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex flex-col items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                <span className="text-[10px] font-bold leading-none">KM</span>
                <span className="text-base font-black leading-none">{activeToast.kilometer}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    KM {activeToast.kilometer} Complete! 🎉
                  </span>
                  <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                    {formatDuration(activeToast.splitDuration)}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono text-sm font-black">
                    {formatPace(activeToast.splitPace, paceUnit)}
                  </span>
                  {activeToast.diffPaceSeconds !== 0 && (
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${activeToast.diffPaceSeconds < 0
                          ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                          : 'bg-amber-500/20 text-amber-700 dark:text-amber-400'
                        }`}
                    >
                      {activeToast.diffPaceSeconds < 0 ? (
                        <>
                          <TrendingUp size={9} />
                          <span>{Math.abs(activeToast.diffPaceSeconds)}s faster</span>
                        </>
                      ) : (
                        <>
                          <TrendingDown size={9} />
                          <span>+{activeToast.diffPaceSeconds}s slower</span>
                        </>
                      )}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setActiveToast(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 text-xs"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Auto-Paused Announcement Bar */}
        {workoutState.isAutoPaused && (
          <div className="shrink-0 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-semibold flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              <span>Stationary detected (Auto-paused).</span>
            </div>
            <button
              onClick={() => gpsEngine.resumeTracking()}
              className="text-[11px] font-bold text-amber-700 dark:text-amber-400 underline hover:opacity-80"
            >
              Resume Now
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col justify-between gap-2 z-10 min-h-0 w-full overflow-hidden">
          {/* Split View (Top Map + Bottom Telemetry) */}
          {viewMode === 'split' ? (
            <div className="flex-1 flex flex-col justify-between gap-2 min-h-0 w-full">
              {/* Properly Positioned Map - Fills all available space above the HUD */}
              <div className="flex-1 min-h-[160px] w-full shadow-sm rounded-2xl sm:rounded-3xl overflow-hidden border border-emerald-200/80 dark:border-slate-800">
                <LiveWorkoutMap
                  coordinates={workoutState.coordinates}
                  isTracking={workoutState.status === 'tracking'}
                  gpsAccuracy={workoutState.gpsAccuracy}
                  className="h-full w-full"
                />
              </div>

              {/* Glanceable Telemetry Cards */}
              <div className="shrink-0 w-full">
                <GlanceableHUD
                  distanceMeters={workoutState.distanceMeters}
                  durationSeconds={workoutState.elapsedTime}
                  movingTimeSeconds={workoutState.movingTime}
                  pausedTimeSeconds={workoutState.pausedTime}
                  currentPaceSec={workoutState.currentPace}
                  averagePaceSec={workoutState.averagePace}
                  calories={workoutState.calories}
                  currentSpeedKmh={workoutState.currentSpeed}
                  averageSpeedKmh={workoutState.averageSpeed}
                  elevationGainMeters={workoutState.elevationGain}
                  elevationLossMeters={workoutState.elevationLoss}
                  distanceUnit={distanceUnit}
                  paceUnit={paceUnit}
                  isPaused={isPaused}
                  isAutoPaused={workoutState.isAutoPaused}
                />
              </div>
            </div>
          ) : (
            /* Full Map View with Integrated Floating Bottom HUD */
            <div className="flex-1 w-full min-h-0 h-full relative rounded-2xl sm:rounded-3xl overflow-hidden border border-emerald-200/80 dark:border-slate-800 shadow-md">
              <LiveWorkoutMap
                coordinates={workoutState.coordinates}
                isTracking={workoutState.status === 'tracking'}
                gpsAccuracy={workoutState.gpsAccuracy}
                className="h-full w-full"
              >
                {/* Floating Telemetry Overlay inside Map */}
                <div className="absolute bottom-3 inset-x-3 z-20 p-2.5 sm:p-3 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-emerald-200/80 dark:border-slate-800 grid grid-cols-4 gap-1 text-center shadow-xl">
                  <div>
                    <div className="text-[9px] uppercase font-bold text-emerald-800/80 dark:text-slate-400">Distance</div>
                    <div className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400">
                      {formatDistance(workoutState.distanceMeters, distanceUnit, 2)} {distanceUnit}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase font-bold text-emerald-800/80 dark:text-slate-400">Time</div>
                    <div className="text-xs sm:text-sm font-mono font-bold text-emerald-950 dark:text-white">
                      {formatDuration(workoutState.movingTime > 0 ? workoutState.movingTime : workoutState.elapsedTime)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase font-bold text-emerald-800/80 dark:text-slate-400">Pace</div>
                    <div className="text-xs sm:text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {workoutState.currentPace > 0 ? formatPaceRaw(workoutState.currentPace, paceUnit) : '--:--'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase font-bold text-emerald-800/80 dark:text-slate-400">Avg Pace</div>
                    <div className="text-xs sm:text-sm font-mono font-bold text-emerald-950 dark:text-slate-200">
                      {workoutState.averagePace > 0 ? formatPaceRaw(workoutState.averagePace, paceUnit) : '--:--'}
                    </div>
                  </div>
                </div>
              </LiveWorkoutMap>
            </div>
          )}
        </div>

        {/* Splits Bottom Drawer */}
        {showSplitsDrawer && workoutState.splits && workoutState.splits.length > 0 && (
          <div className="fixed inset-x-4 bottom-24 z-30 max-h-56 overflow-y-auto rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-emerald-100 dark:border-slate-800 p-3.5 shadow-2xl animate-slide-up">
            <div className="flex items-center justify-between pb-2 border-b border-emerald-100 dark:border-slate-800 mb-2">
              <div className="flex items-center gap-1.5">
                <Flag size={14} className="text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-950 dark:text-white">Kilometer Splits</span>
              </div>
              <button
                onClick={() => setShowSplitsDrawer(false)}
                className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white p-1"
              >
                Close
              </button>
            </div>
            <div className="space-y-1">
              {workoutState.splits.map((split) => (
                <div
                  key={split.split_number}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-emerald-50/50 dark:bg-slate-950/60 border border-emerald-100 dark:border-slate-800/80 text-xs"
                >
                  <span className="font-bold text-emerald-950 dark:text-slate-300">KM {split.split_number}</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                    {formatPaceRaw(split.pace, paceUnit)} {paceUnit === 'min_mi' ? '/mi' : '/km'}
                  </span>
                  <span className="font-mono text-slate-600 dark:text-slate-400">
                    {formatDuration(split.duration_seconds)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Clean, Circular Workout Controls */}
        <div className="py-2.5 flex items-center justify-center shrink-0 z-20">
          {!isPaused ? (
            /* Circular Pause Button */
            <div className="flex flex-col items-center">
              <button
                onClick={handlePauseResume}
                className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-slate-900 dark:bg-slate-900 border-2 border-emerald-500 hover:border-emerald-400 text-emerald-400 dark:text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 active:scale-90 hover:scale-105 transition-all group"
                aria-label="Pause Workout"
              >
                <Pause size={28} fill="currentColor" className="group-hover:scale-110 transition-transform" />
              </button>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mt-1.5">
                Pause
              </span>
            </div>
          ) : (
            /* Paused: Circular Resume & Finish Buttons Side-by-Side */
            <div className="flex items-center gap-8 sm:gap-12 animate-scale-in">
              {/* Circular Resume Button */}
              <div className="flex flex-col items-center">
                <button
                  onClick={handlePauseResume}
                  className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-gradient-to-tr from-emerald-500 to-lime-400 hover:from-emerald-400 hover:to-lime-300 text-slate-950 shadow-lg shadow-emerald-500/30 flex items-center justify-center active:scale-90 hover:scale-105 transition-all group"
                  aria-label="Resume Workout"
                >
                  <Play size={28} fill="currentColor" className="ml-1 group-hover:scale-110 transition-transform" />
                </button>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mt-1.5">
                  Resume
                </span>
              </div>

              {/* Circular Finish Button */}
              <div className="flex flex-col items-center">
                <button
                  onClick={() => setShowFinishConfirm(true)}
                  className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/30 flex items-center justify-center active:scale-90 hover:scale-105 transition-all group"
                  aria-label="Finish Workout"
                >
                  <Square size={22} fill="currentColor" className="group-hover:scale-110 transition-transform" />
                </button>
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 mt-1.5">
                  Finish
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Finish Confirmation Modal */}
        {showFinishConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 dark:bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-sm rounded-3xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-emerald-200/80 dark:border-slate-800 p-6 shadow-2xl space-y-4">
              <div className="text-center space-y-1.5 pt-1">
                <h3 className="text-xl font-black text-emerald-950 dark:text-white">Finish your workout?</h3>
                <p className="text-xs text-emerald-800/80 dark:text-slate-400">
                  You've recorded{' '}
                  <strong className="text-emerald-600 dark:text-emerald-400">
                    {formatDistance(workoutState.distanceMeters, distanceUnit, 2)} {distanceUnit}
                  </strong>{' '}
                  in {formatDuration(workoutState.movingTime > 0 ? workoutState.movingTime : workoutState.elapsedTime)}.
                </p>
              </div>

              {/* Summary metrics snapshot */}
              <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-emerald-50/50 dark:bg-slate-950/80 border border-emerald-200/60 dark:border-slate-800 text-center">
                <div>
                  <div className="text-[9px] uppercase font-bold text-emerald-800/80 dark:text-slate-400">Pace</div>
                  <div className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {workoutState.averagePace > 0 ? formatPaceRaw(workoutState.averagePace, paceUnit) : '--:--'}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] uppercase font-bold text-emerald-800/80 dark:text-slate-400">Calories</div>
                  <div className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
                    {workoutState.calories} kcal
                  </div>
                </div>
                <div>
                  <div className="text-[9px] uppercase font-bold text-emerald-800/80 dark:text-slate-400">Elevation</div>
                  <div className="text-xs font-mono font-bold text-sky-600 dark:text-sky-400">
                    +{Math.round(workoutState.elevationGain)}m
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <button
                  onClick={handleConfirmFinish}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-lime-400 hover:from-emerald-600 hover:to-lime-500 active:scale-95 text-slate-950 font-black text-sm shadow-md shadow-emerald-500/25 transition-all"
                >
                  Save & View Summary
                </button>

                <button
                  onClick={() => setShowFinishConfirm(false)}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-50 dark:bg-slate-800 hover:bg-emerald-100 dark:hover:bg-slate-700 active:scale-95 text-emerald-900 dark:text-slate-200 font-semibold text-xs border border-emerald-200 dark:border-slate-700 transition-all"
                >
                  Resume Workout
                </button>

                <button
                  onClick={() => {
                    setShowFinishConfirm(false);
                    setShowDiscardConfirm(true);
                  }}
                  className="w-full py-2 text-rose-600 dark:text-rose-400 hover:underline active:scale-95 text-xs font-semibold"
                >
                  Discard Workout...
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Discard Confirmation Dialog */}
        {showDiscardConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 dark:bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-sm rounded-3xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-rose-200 dark:border-rose-500/30 p-6 shadow-2xl space-y-4">
              <div className="text-center space-y-1">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-2">
                  <AlertTriangle size={24} />
                </div>
                <h3 className="text-lg font-black text-emerald-950 dark:text-white">Discard this workout?</h3>
                <p className="text-xs text-emerald-800/80 dark:text-slate-400">
                  Are you sure you want to discard? All route coordinates and metrics from this workout will be permanently removed.
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <button
                  onClick={() => {
                    gpsEngine.discardWorkout();
                    setShowDiscardConfirm(false);
                    onDiscardWorkout();
                  }}
                  className="w-full py-3.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-black text-sm shadow-lg transition-all"
                >
                  Yes, Discard
                </button>

                <button
                  onClick={() => setShowDiscardConfirm(false)}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-50 dark:bg-slate-800 hover:bg-emerald-100 dark:hover:bg-slate-700 active:scale-95 text-emerald-900 dark:text-slate-200 font-semibold text-xs border border-emerald-200 dark:border-slate-700 transition-all"
                >
                  Cancel (Keep Workout)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
