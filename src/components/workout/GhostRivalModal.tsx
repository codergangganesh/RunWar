import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { GhostRivalConfig, UserProfile, Workout } from '../../types';
import { ghostRivalService, PRESET_GHOST_PACERS } from '../../services/ghostRivalService';
import { workoutService } from '../../services/workoutService';
import { formatDistance, formatDuration, formatPace } from '../../utils/formatters';
import {
  X,
  Swords,
  Timer,
  Trophy,
  Check,
  ChevronRight,
  Flame,
  Zap,
  Sliders,
  History,
  RotateCcw,
} from 'lucide-react';

interface GhostRivalModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile?: UserProfile | null;
  onSelectGhost?: (ghost: GhostRivalConfig | null) => void;
}

export const GhostRivalModal: React.FC<GhostRivalModalProps> = ({
  isOpen,
  onClose,
  profile,
  onSelectGhost,
}) => {
  const [activeTab, setActiveTab] = useState<'pacer' | 'history'>('pacer');
  const [activeGhost, setActiveGhost] = useState<GhostRivalConfig | null>(ghostRivalService.getActiveGhost());
  const [pastWorkouts, setPastWorkouts] = useState<Workout[]>([]);
  const [isLoadingWorkouts, setIsLoadingWorkouts] = useState(false);

  // Custom pace builder state (in seconds per km)
  const [customMinutes, setCustomMinutes] = useState(5);
  const [customSeconds, setCustomSeconds] = useState(0);

  // Right Drawer animation states
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isAnimating, setIsAnimating] = useState(false);
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const distanceUnit = profile?.distance_unit || 'km';
  const paceUnit = profile?.pace_unit || 'min_km';

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      setDragOffsetX(0);
      setActiveGhost(ghostRivalService.getActiveGhost());

      // Preload past workouts from cache
      try {
        const cached = workoutService.getCachedWorkouts();
        setPastWorkouts(cached.filter((w) => w.distance_meters > 500));
      } catch {
        setPastWorkouts([]);
      }

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });

      const origOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = origOverflow;
      };
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => {
        setIsRendered(false);
        setDragOffsetX(0);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setIsAnimating(false);
    setTimeout(() => {
      onClose();
    }, 280);
  }, [onClose]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const deltaX = e.touches[0].clientX - touchStartX.current;
    if (deltaX > 0) {
      setDragOffsetX(deltaX);
    }
  };

  const handleTouchEnd = () => {
    if (dragOffsetX > 100) {
      handleClose();
    } else {
      setDragOffsetX(0);
    }
    touchStartX.current = null;
  };

  const handleSelect = (ghost: GhostRivalConfig) => {
    ghostRivalService.setActiveGhost(ghost);
    setActiveGhost(ghost);
    if (onSelectGhost) {
      onSelectGhost(ghost);
    }
    handleClose();
  };

  const handleClear = () => {
    ghostRivalService.setActiveGhost(null);
    setActiveGhost(null);
    if (onSelectGhost) {
      onSelectGhost(null);
    }
  };

  const handleSetCustomPace = () => {
    const totalSecPerKm = customMinutes * 60 + customSeconds;
    if (totalSecPerKm <= 0) return;

    const formattedPaceStr = `${customMinutes}:${customSeconds.toString().padStart(2, '0')}`;
    const customConfig: GhostRivalConfig = {
      id: `ghost_custom_${totalSecPerKm}`,
      name: `Custom Rival (${formattedPaceStr}/km)`,
      type: 'target_pace',
      targetPaceSecondsPerKm: totalSecPerKm,
    };

    handleSelect(customConfig);
  };

  const handleSelectWorkoutPR = (workout: Workout) => {
    const ghost = ghostRivalService.createGhostFromWorkout(workout);
    handleSelect(ghost);
  };

  if (!isRendered) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-hidden select-none">
      {/* Dark Blur Backdrop */}
      <div
        onClick={handleClose}
        className={`fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity duration-300 ease-out cursor-pointer ${
          isAnimating ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Right Drawer Sliding Container */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: !isAnimating
            ? 'translateX(100%)'
            : dragOffsetX > 0
            ? `translateX(${dragOffsetX}px)`
            : 'translateX(0)',
        }}
        className="fixed inset-y-0 right-0 z-[10000] w-full max-w-md sm:max-w-lg h-[100dvh] bg-white dark:bg-slate-900 border-l border-violet-100 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden transition-transform duration-300 ease-out"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Swipe drag indicator */}
        <div className="absolute top-1/2 left-1.5 -translate-y-1/2 w-1 h-12 rounded-full bg-slate-300/60 dark:bg-slate-700/60 pointer-events-none sm:hidden" />

        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-gradient-to-r from-violet-50/50 via-white to-white dark:from-violet-950/20 dark:via-slate-900 dark:to-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-violet-500/30">
              <Swords size={18} />
            </div>
            <div>
              <h3 className="font-display font-black text-base text-slate-950 dark:text-white flex items-center gap-1.5">
                <span>Virtual Ghost Runner</span>
                <span className="text-[10px] uppercase font-black px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300">
                  Rival Mode
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Race head-to-head against a pacer or your past record
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex p-1.5 mx-4 mt-3 bg-slate-100 dark:bg-slate-950 rounded-2xl shrink-0">
          <button
            onClick={() => setActiveTab('pacer')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'pacer'
                ? 'bg-white dark:bg-slate-800 text-violet-600 dark:text-violet-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Timer size={14} />
            <span>Target Pace Rivals</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'bg-white dark:bg-slate-800 text-violet-600 dark:text-violet-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Trophy size={14} />
            <span>Race Past PR ({pastWorkouts.length})</span>
          </button>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeTab === 'pacer' && (
            <div className="space-y-4">
              {/* Custom Pace Setter Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-violet-50/70 to-indigo-50/50 dark:from-violet-950/20 dark:to-slate-900/60 border border-violet-200/80 dark:border-violet-500/30 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-violet-950 dark:text-violet-200">
                    <Sliders size={14} className="text-violet-600 dark:text-violet-400" />
                    <span>Set Custom Target Pace</span>
                  </div>
                  <span className="text-sm font-mono font-black text-violet-700 dark:text-violet-300">
                    {customMinutes}:{customSeconds.toString().padStart(2, '0')} /km
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                      Minutes
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCustomMinutes((m) => Math.max(3, m - 1))}
                        className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer active:scale-95"
                      >
                        -
                      </button>
                      <span className="flex-1 text-center font-mono font-black text-base text-slate-800 dark:text-white">
                        {customMinutes}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCustomMinutes((m) => Math.min(10, m + 1))}
                        className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer active:scale-95"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                      Seconds
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCustomSeconds((s) => Math.max(0, s - 5))}
                        className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer active:scale-95"
                      >
                        -
                      </button>
                      <span className="flex-1 text-center font-mono font-black text-base text-slate-800 dark:text-white">
                        {customSeconds.toString().padStart(2, '0')}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCustomSeconds((s) => Math.min(55, s + 5))}
                        className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer active:scale-95"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSetCustomPace}
                  className="w-full py-2.5 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-violet-600/25 active:scale-98 transition-all cursor-pointer"
                >
                  <Swords size={13} />
                  <span>Race this Custom Pace ({customMinutes}:{customSeconds.toString().padStart(2, '0')}/km)</span>
                </button>
              </div>

              {/* Preset Pacers List */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <span>Preset Benchmark Rivals</span>
                  <span>Target Pace</span>
                </div>

                {PRESET_GHOST_PACERS.map((preset) => {
                  const isCurrent = activeGhost?.id === preset.id;
                  const paceMin = Math.floor(preset.targetPaceSecondsPerKm / 60);
                  const paceSec = preset.targetPaceSecondsPerKm % 60;
                  const paceStr = `${paceMin}:${paceSec.toString().padStart(2, '0')}`;
                  const est5kSeconds = preset.targetPaceSecondsPerKm * 5;

                  return (
                    <div
                      key={preset.id}
                      onClick={() => {
                        if (isCurrent) {
                          handleClear();
                        } else {
                          handleSelect(preset);
                        }
                      }}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
                        isCurrent
                          ? 'bg-violet-50/70 dark:bg-violet-950/30 border-violet-400 dark:border-violet-500/70 shadow-sm ring-1 ring-violet-400/30 dark:ring-violet-500/20'
                          : 'bg-white dark:bg-slate-900/80 hover:bg-slate-50 dark:hover:bg-slate-800/60 border-slate-200/80 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-sm text-slate-950 dark:text-white truncate">
                            {preset.name}
                          </h4>
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                            <span className="font-mono font-bold text-violet-600 dark:text-violet-400">
                              {paceStr} /km
                            </span>
                            <span>•</span>
                            <span className="text-[11px]">
                              5K finish: {formatDuration(est5kSeconds)}
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0">
                          {isCurrent ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleClear();
                              }}
                              className="py-1.5 px-3 rounded-xl bg-violet-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-sm shadow-violet-600/25 group/btn"
                              title="Active ghost. Tap to clear"
                            >
                              <Check size={12} strokeWidth={3} className="group-hover/btn:hidden" />
                              <X size={12} strokeWidth={3} className="hidden group-hover/btn:inline-block" />
                              <span className="group-hover/btn:hidden">Selected</span>
                              <span className="hidden group-hover/btn:inline-block">Clear</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelect(preset);
                              }}
                              className="py-1.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-violet-600 hover:text-white text-slate-700 dark:text-slate-300 font-bold text-xs transition-all cursor-pointer active:scale-95"
                            >
                              Select
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-3">
              <div className="px-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <span>Select a Past Workout to Beat</span>
              </div>

              {pastWorkouts.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <Trophy size={32} className="mx-auto text-slate-300 dark:text-slate-600" />
                  <p className="text-xs font-medium">No previous workouts found yet.</p>
                  <p className="text-[11px] text-slate-500">
                    Complete your first run to race against your past PR!
                  </p>
                </div>
              ) : (
                pastWorkouts.map((workout) => {
                  const isCurrent = activeGhost?.previousWorkoutId === workout.id;
                  const dateStr = new Date(workout.started_at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  });

                  return (
                    <div
                      key={workout.id}
                      onClick={() => {
                        if (isCurrent) {
                          handleClear();
                        } else {
                          handleSelectWorkoutPR(workout);
                        }
                      }}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
                        isCurrent
                          ? 'bg-violet-50/70 dark:bg-violet-950/30 border-violet-400 dark:border-violet-500/70 shadow-sm ring-1 ring-violet-400/30 dark:ring-violet-500/20'
                          : 'bg-white dark:bg-slate-900/80 hover:bg-slate-50 dark:hover:bg-slate-800/60 border-slate-200/80 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="font-bold text-sm text-slate-950 dark:text-white truncate">
                              {workout.title || `${workout.type.toUpperCase()} Workout`}
                            </h4>
                            <span className="text-[10px] text-slate-400">{dateStr}</span>
                          </div>

                          <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                            <span className="font-black text-violet-600 dark:text-violet-400">
                              {formatDistance(workout.distance_meters, distanceUnit)}
                            </span>
                            <span>•</span>
                            <span className="font-mono">
                              {formatDuration(workout.duration_seconds)}
                            </span>
                            <span>•</span>
                            <span>{formatPace(workout.average_pace, paceUnit)}</span>
                          </div>
                        </div>

                        <div className="shrink-0">
                          {isCurrent ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleClear();
                              }}
                              className="py-1.5 px-3 rounded-xl bg-violet-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-sm shadow-violet-600/25 group/btn"
                              title="Active ghost. Tap to clear"
                            >
                              <Check size={12} strokeWidth={3} className="group-hover/btn:hidden" />
                              <X size={12} strokeWidth={3} className="hidden group-hover/btn:inline-block" />
                              <span className="group-hover/btn:hidden">Selected</span>
                              <span className="hidden group-hover/btn:inline-block">Clear</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectWorkoutPR(workout);
                              }}
                              className="py-1.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-violet-600 hover:text-white text-slate-700 dark:text-slate-300 font-bold text-xs transition-all cursor-pointer active:scale-95"
                            >
                              Select
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/30 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 shrink-0">
          <span>Head-to-head racing with live audio commentary</span>
          <button
            onClick={handleClose}
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
