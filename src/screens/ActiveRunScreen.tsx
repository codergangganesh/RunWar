import React, { useState, useEffect } from 'react';
import { GPSCoordinate, LiveWorkoutState, SplitToastInfo, UserProfile, UserSettings, WorkoutType } from '../types';
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
  Compass,
  Wifi,
  WifiOff,
  CloudUpload,
  Flag,
  ChevronUp,
  ChevronDown,
  Sparkles,
  AlertTriangle,
  Flame,
  Zap,
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
  const [viewMode, setViewMode] = useState<'split' | 'hud' | 'map'>('split');
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
    // Configure settings
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

    // Start tracking if not already active or finished
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

  const isPaused = workoutState.status === 'paused';
  const distanceUnit = profile?.distance_unit || 'km';
  const paceUnit = profile?.pace_unit || 'min_km';

  // Format GPS Status
  const getGpsBadge = () => {
    const status = workoutState.gpsStatus;
    const acc = workoutState.gpsAccuracy ? Math.round(workoutState.gpsAccuracy) : null;

    if (status === 'locked') {
      return (
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>GPS Locked {acc ? `(±${acc}m)` : ''}</span>
        </div>
      );
    }
    if (status === 'weak') {
      return (
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span>GPS Weak {acc ? `(±${acc}m)` : ''}</span>
        </div>
      );
    }
    if (status === 'lost') {
      return (
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse">
          <AlertTriangle size={12} />
          <span>GPS Signal Lost</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
        <Compass size={12} className="animate-spin" />
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
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700"
          title="Offline mode: points saved locally in encrypted cache"
        >
          <WifiOff size={12} className="text-slate-500" />
          <span>Offline</span>
        </div>
      );
    }
    if (status === 'syncing') {
      return (
        <div
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-sky-500/15 text-sky-400 border border-sky-500/30 animate-pulse"
          title="Syncing coordinates to InsForge Postgres..."
        >
          <CloudUpload size={12} />
          <span>Syncing</span>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-white flex flex-col justify-between items-center p-3.5 sm:p-4 select-none relative overflow-x-hidden">
      <div className="w-full max-w-xl md:max-w-2xl lg:max-w-3xl flex flex-col flex-1 justify-between relative">
        {/* Top Telemetry & Controls Bar */}
        <div className="flex items-center justify-between z-20 pt-1 pb-2">
          {/* GPS & Network Status Badges */}
          <div className="flex items-center gap-2 flex-wrap">
          {getGpsBadge()}
          {getNetworkBadge()}

          {/* Test Route Simulation Toggle */}
          <button
            onClick={handleToggleSimulation}
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all ${
              simMode
                ? 'bg-lime-500/20 text-lime-400 border-lime-500/40 shadow-glow-volt'
                : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
            title="Toggle realistic GPS route simulation"
          >
            {simMode ? '⚡ Sim ON' : 'Sim Mode'}
          </button>
        </div>

        {/* View Mode, Splits, & Audio Controls */}
        <div className="flex items-center gap-2">
          {/* Splits Drawer Trigger */}
          {workoutState.splits && workoutState.splits.length > 0 && (
            <button
              onClick={() => setShowSplitsDrawer(!showSplitsDrawer)}
              className={`p-2 rounded-xl border transition-all ${
                showSplitsDrawer
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
              title="View kilometer splits"
            >
              <Flag size={16} />
            </button>
          )}

          {/* Voice Coach Toggle */}
          <button
            onClick={() => setAudioMuted(!audioMuted)}
            className={`p-2 rounded-xl border transition-all ${
              audioMuted
                ? 'bg-slate-900 border-slate-800 text-slate-500'
                : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
            }`}
            title={audioMuted ? 'Voice coach: Muted' : 'Voice coach: Active'}
          >
            {audioMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>

          {/* View Mode Toggle */}
          <button
            onClick={() => {
              const next = viewMode === 'split' ? 'map' : viewMode === 'map' ? 'hud' : 'split';
              setViewMode(next);
            }}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
            title="Toggle view mode (Split / Map / HUD)"
          >
            {viewMode === 'split' ? <Layout size={16} /> : <MapIcon size={16} />}
          </button>
        </div>
      </div>

      {/* Floating Kilometer Split Milestone Toast */}
      {activeToast && (
        <div className="fixed top-16 left-4 right-4 z-50 flex justify-center pointer-events-none animate-bounce">
          <div className="bg-[#09151f]/95 border-2 border-[#00d09c] rounded-3xl p-4 shadow-2xl backdrop-blur-md flex items-center gap-3.5 text-white max-w-sm w-full pointer-events-auto transition-all">
            <div className="w-12 h-12 rounded-2xl bg-[#00d09c]/20 border border-[#00d09c]/40 flex flex-col items-center justify-center text-[#00d09c] shrink-0">
              <span className="text-xs font-bold leading-none">KM</span>
              <span className="text-lg font-black leading-none">{activeToast.kilometer}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  Kilometer {activeToast.kilometer} Complete! 🎉
                </span>
                <span className="text-[11px] font-black text-[#00d09c]">
                  {formatDuration(activeToast.splitDuration)}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-mono text-base font-black text-white">
                  {formatPace(activeToast.splitPace, paceUnit)}
                </span>
                {activeToast.diffPaceSeconds !== 0 && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
                      activeToast.diffPaceSeconds < 0
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-amber-500/20 text-amber-400'
                    }`}
                  >
                    {activeToast.diffPaceSeconds < 0 ? (
                      <>
                        <TrendingUp size={10} />
                        <span>{Math.abs(activeToast.diffPaceSeconds)}s faster</span>
                      </>
                    ) : (
                      <>
                        <TrendingDown size={10} />
                        <span>+{activeToast.diffPaceSeconds}s slower</span>
                      </>
                    )}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => setActiveToast(null)}
              className="text-slate-400 hover:text-white p-1"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Auto-Paused Announcement Bar if active */}
      {workoutState.isAutoPaused && (
        <div className="z-20 mb-2 px-3.5 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>Stationary detected. Auto-paused (Resumes automatically when moving).</span>
          </div>
          <button
            onClick={() => gpsEngine.resumeTracking()}
            className="text-[11px] font-bold text-amber-400 underline hover:text-amber-200"
          >
            Resume Now
          </button>
        </div>
      )}

      {/* Main Content Viewport */}
      <div className="my-auto flex-1 flex flex-col justify-between gap-3 py-1 z-10">
        {/* Split View (Top Map + Bottom HUD) */}
        {viewMode === 'split' && (
          <div className="flex-1 flex flex-col gap-3">
            <div className="h-52 sm:h-64 w-full">
              <LiveWorkoutMap
                coordinates={workoutState.coordinates}
                isTracking={workoutState.status === 'tracking'}
                gpsAccuracy={workoutState.gpsAccuracy}
                className="h-full w-full"
              />
            </div>
            <div className="flex-1">
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
        )}

        {/* Full HUD View (Maximized Glanceability) */}
        {viewMode === 'hud' && (
          <div className="flex-1 flex flex-col justify-center">
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
        )}

        {/* Full Map View */}
        {viewMode === 'map' && (
          <div className="flex-1 w-full min-h-[380px] relative">
            <LiveWorkoutMap
              coordinates={workoutState.coordinates}
              isTracking={workoutState.status === 'tracking'}
              gpsAccuracy={workoutState.gpsAccuracy}
              className="h-full w-full min-h-[400px]"
            />
            {/* Overlay HUD at bottom of map */}
            <div className="absolute bottom-4 inset-x-4 z-10 p-3 rounded-2xl bg-slate-950/85 backdrop-blur-md border border-slate-800 grid grid-cols-3 text-center shadow-xl">
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Distance</div>
                <div className="text-base font-black text-emerald-400">
                  {formatDistance(workoutState.distanceMeters, distanceUnit, 2)} {distanceUnit}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Moving Time</div>
                <div className="text-base font-mono font-bold text-white">
                  {formatDuration(workoutState.movingTime > 0 ? workoutState.movingTime : workoutState.elapsedTime)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Avg Pace</div>
                <div className="text-base font-mono font-bold text-slate-200">
                  {workoutState.averagePace > 0 ? formatPaceRaw(workoutState.averagePace, paceUnit) : '--:--'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Splits Bottom Drawer */}
      {showSplitsDrawer && workoutState.splits && workoutState.splits.length > 0 && (
        <div className="fixed inset-x-4 bottom-24 z-30 max-h-60 overflow-y-auto rounded-3xl bg-slate-900/95 backdrop-blur-xl border border-slate-800 p-4 shadow-2xl animate-slide-up">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2">
            <div className="flex items-center gap-2">
              <Flag size={16} className="text-emerald-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-white">Kilometer Splits</span>
            </div>
            <button
              onClick={() => setShowSplitsDrawer(false)}
              className="text-xs text-slate-400 hover:text-white p-1"
            >
              Close
            </button>
          </div>
          <div className="space-y-1.5">
            {workoutState.splits.map((split) => (
              <div
                key={split.split_number}
                className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs"
              >
                <span className="font-bold text-slate-300">KM {split.split_number}</span>
                <span className="font-mono text-emerald-400 font-bold">
                  {formatPaceRaw(split.pace, paceUnit)} {paceUnit === 'min_mi' ? '/mi' : '/km'}
                </span>
                <span className="font-mono text-slate-400">
                  {formatDuration(split.duration_seconds)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Workout Controls */}
      <div className="pt-2 pb-3 z-20">
        {!isPaused ? (
          <button
            onClick={handlePauseResume}
            className="w-full py-4 px-6 rounded-2xl bg-slate-900 hover:bg-slate-850 active:scale-95 text-amber-400 font-black text-lg border-2 border-amber-500/40 shadow-glow-amber flex items-center justify-center gap-3 transition-all"
          >
            <Pause size={22} fill="currentColor" />
            <span>PAUSE WORKOUT</span>
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {/* Resume Button */}
            <button
              onClick={handlePauseResume}
              className="py-4 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-base shadow-glow-brand flex items-center justify-center gap-2 transition-all"
            >
              <Play size={20} fill="currentColor" />
              <span>RESUME</span>
            </button>

            {/* Finish Button */}
            <button
              onClick={() => setShowFinishConfirm(true)}
              className="py-4 px-6 rounded-2xl bg-rose-500 hover:bg-rose-400 active:scale-95 text-white font-black text-base shadow-lg flex items-center justify-center gap-2 transition-all"
            >
              <Square size={18} fill="currentColor" />
              <span>FINISH</span>
            </button>
          </div>
        )}
      </div>

      {/* Finish Confirmation Modal Sheet */}
      {showFinishConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-2">
                <Sparkles size={24} />
              </div>
              <h3 className="text-lg font-black text-white">Finish your session?</h3>
              <p className="text-xs text-slate-400">
                You've recorded{' '}
                <span className="text-emerald-400 font-bold">
                  {formatDistance(workoutState.distanceMeters, distanceUnit, 2)} {distanceUnit}
                </span>{' '}
                in {formatDuration(workoutState.movingTime > 0 ? workoutState.movingTime : workoutState.elapsedTime)}.
              </p>
            </div>

            {/* Summary metrics snapshot */}
            <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-slate-950/80 border border-slate-800 text-center">
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Pace</div>
                <div className="text-xs font-mono font-bold text-emerald-400">
                  {workoutState.averagePace > 0 ? formatPaceRaw(workoutState.averagePace, paceUnit) : '--:--'}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Calories</div>
                <div className="text-xs font-mono font-bold text-amber-400">
                  {workoutState.calories} kcal
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Elevation</div>
                <div className="text-xs font-mono font-bold text-sky-400">
                  +{Math.round(workoutState.elevationGain)}m
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 pt-2">
              <button
                onClick={handleConfirmFinish}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-lime-400 hover:from-emerald-400 hover:to-lime-300 active:scale-95 text-slate-950 font-black text-sm shadow-glow-brand transition-all"
              >
                Save & View Summary
              </button>

              <button
                onClick={() => setShowFinishConfirm(false)}
                className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-semibold text-xs border border-slate-700 transition-all"
              >
                Resume Running
              </button>

              <button
                onClick={() => {
                  setShowFinishConfirm(false);
                  setShowDiscardConfirm(true);
                }}
                className="w-full py-2.5 text-rose-400 hover:text-rose-300 active:scale-95 text-xs font-semibold"
              >
                Discard Workout...
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discard Confirmation Safety Dialog */}
      {showDiscardConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-rose-500/30 p-6 shadow-2xl space-y-4">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mb-2">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-lg font-black text-white">Discard this workout?</h3>
              <p className="text-xs text-slate-400">
                Are you sure you want to discard? All route coordinates and metrics from this run will be permanently deleted.
              </p>
            </div>

            <div className="flex flex-col gap-2.5 pt-2">
              <button
                onClick={() => {
                  gpsEngine.discardWorkout();
                  setShowDiscardConfirm(false);
                  onDiscardWorkout();
                }}
                className="w-full py-3.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-black text-sm shadow-lg transition-all"
              >
                Yes, Discard Run
              </button>

              <button
                onClick={() => setShowDiscardConfirm(false)}
                className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-semibold text-xs border border-slate-700 transition-all"
              >
                Cancel (Keep Run)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
);
};
