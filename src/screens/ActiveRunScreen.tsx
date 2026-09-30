import React, { useState, useEffect, useRef } from 'react';
import { LiveWorkoutState, PocketUnlockMode, SplitToastInfo, UserProfile, UserSettings, WorkoutType } from '../types';
import { gpsEngine } from '../services/gpsEngine';
import { audioCoach } from '../services/audioCoach';
import { offlineSync } from '../services/offlineSync';
import { challengeService } from '../services/challengeService';
import { Challenge, LiveChallengeProgress } from '../types';
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
  Lock,
  Unlock,
  Smartphone,
  X,
  ChevronRight,
  Sliders,
  Zap,
  Navigation,
  Route,
  Swords,
  Radio,
  Users,
} from 'lucide-react';
import { beaconService, LiveBeacon } from '../services/beaconService';
import { LiveBeaconModal } from '../components/beacon/LiveBeaconModal';
import { tetherService } from '../services/tetherService';
import { TetherSession, TetherTelemetry, TetherDelta } from '../types/tether';
import { TetherHUD } from '../components/tether/TetherHUD';
import { TetherWalkieTalkie } from '../components/tether/TetherWalkieTalkie';
import { TetherModal } from '../components/tether/TetherModal';
import { formatDistance, formatDuration, formatPace, formatPaceRaw } from '../utils/formatters';
import { WakeLockIndicator } from '../components/workout/WakeLockIndicator';
import { WeatherBadge } from '../components/workout/WeatherBadge';
import { AudioCoachModal } from '../components/workout/AudioCoachModal';
import { CourseModal } from '../components/workout/CourseModal';
import { courseService } from '../services/courseService';
import { GhostRivalModal } from '../components/workout/GhostRivalModal';
import { BottomSheet } from '../components/ui/BottomSheet';
import { ChallengeHUD } from '../components/challenge/ChallengeHUD';
import { AudioFrequency } from '../types';

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
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [showGhostModal, setShowGhostModal] = useState(false);
  const [coachFrequency, setCoachFrequency] = useState<AudioFrequency>(settings?.audio_frequency || '1km');
  const [simMode, setSimMode] = useState(gpsEngine.isSimulationMode);
  const [activeToast, setActiveToast] = useState<SplitToastInfo | null>(null);
  const [showBeaconModal, setShowBeaconModal] = useState(false);
  const [activeBeacon, setActiveBeacon] = useState<LiveBeacon | null>(() => beaconService.getActiveSession());
  const lastBeaconSyncTimeRef = useRef<number>(0);
  const [isPocketMode, setIsPocketMode] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('runwar_keep_screen_banner_dismissed') === 'true';
    } catch {
      return false;
    }
  });
  const [unlockProgress, setUnlockProgress] = useState(0);
  const unlockProgressRef = useRef<number>(0);
  const unlockTimerRef = useRef<NodeJS.Timeout | null>(null);
  const unlockStartRef = useRef<number | null>(null);
  const [sliderX, setSliderX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const sliderTrackRef = useRef<HTMLDivElement | null>(null);
  const dragStartXRef = useRef<number | null>(null);

  // ── Challenge Mode ──────────────────────────────────────────────────────
  const [activeChallenge, setActiveChallenge] = useState<Challenge | null>(null);
  const [challengeProgress, setChallengeProgress] = useState<LiveChallengeProgress | null>(null);
  const activeChallengeIdRef = useRef<string | null>(null);
  const lastPingDistanceRef = useRef<number>(0);
  const PING_INTERVAL_METERS = 50; // send update every 50m

  // ── Virtual Tether & Walkie-Talkie ──────────────────────────────────────
  const [showTetherModal, setShowTetherModal] = useState(false);
  const [activeTether, setActiveTether] = useState<TetherSession | null>(() => tetherService.getActiveSession());
  const [peerTelemetry, setPeerTelemetry] = useState<TetherTelemetry | null>(null);
  const [tetherDelta, setTetherDelta] = useState<TetherDelta | null>(null);

  useEffect(() => {
    const unsubSession = tetherService.onSessionChange((sess) => {
      setActiveTether(sess);
    });
    const unsubTelem = tetherService.onTelemetry((telemetry, delta) => {
      setPeerTelemetry(telemetry);
      setTetherDelta(delta);
    });
    const unsubDisconnect = tetherService.onPartnerDisconnected(() => {
      audioCoach.speak('Tether partner disconnected');
    });
    return () => {
      unsubSession();
      unsubTelem();
      unsubDisconnect();
    };
  }, []);

  useEffect(() => {
    if (activeTether && activeTether.status === 'active' && workoutState.status === 'tracking') {
      tetherService.updateTelemetry({
        userId: profile?.user_id || profile?.id || 'usr_self',
        distanceMeters: workoutState.distanceMeters,
        currentPaceSec: workoutState.currentPace,
        movingTimeSec: workoutState.movingTime,
        currentSpeedKmh: workoutState.currentSpeed,
        splitKm: Math.floor(workoutState.distanceMeters / 1000),
        latitude: workoutState.currentLocation?.latitude,
        longitude: workoutState.currentLocation?.longitude,
      });
    }
  }, [
    activeTether,
    workoutState.status,
    workoutState.distanceMeters,
    workoutState.currentPace,
    workoutState.movingTime,
    workoutState.currentSpeed,
    workoutState.currentLocation,
    profile,
  ]);

  const pocketUnlockMode: PocketUnlockMode =
    settings?.pocket_unlock_mode ||
    (localStorage.getItem('runwar_pocket_unlock_mode') as PocketUnlockMode) ||
    'both';

  const handleDismissBanner = () => {
    setBannerDismissed(true);
    try {
      localStorage.setItem('runwar_keep_screen_banner_dismissed', 'true');
    } catch { }
  };

  const handleUnlockTouchStart = () => {
    unlockStartRef.current = Date.now();
    setUnlockProgress(0);
    unlockProgressRef.current = 0;

    if (unlockTimerRef.current) clearInterval(unlockTimerRef.current);

    unlockTimerRef.current = setInterval(() => {
      if (!unlockStartRef.current) return;
      const elapsed = Date.now() - unlockStartRef.current;
      const progress = Math.min(100, Math.round((elapsed / 1000) * 100));
      setUnlockProgress(progress);
      unlockProgressRef.current = progress;

      if (progress >= 100) {
        if (unlockTimerRef.current) {
          clearInterval(unlockTimerRef.current);
          unlockTimerRef.current = null;
        }
        unlockStartRef.current = null;
        try {
          if ('vibrate' in navigator) navigator.vibrate([40, 40]);
        } catch { }
        setTimeout(() => {
          setUnlockProgress(0);
          unlockProgressRef.current = 0;
          setIsPocketMode(false);
        }, 150);
      }
    }, 25);
  };

  const handleUnlockTouchEnd = () => {
    if (unlockProgressRef.current < 100) {
      if (unlockTimerRef.current) {
        clearInterval(unlockTimerRef.current);
        unlockTimerRef.current = null;
      }
      unlockStartRef.current = null;
      setUnlockProgress(0);
      unlockProgressRef.current = 0;
    }
  };

  const handleSliderPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch { }
    setIsDragging(true);
    dragStartXRef.current = e.clientX;
  };

  const handleSliderPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDragging || dragStartXRef.current === null || !sliderTrackRef.current) return;
    const deltaX = e.clientX - dragStartXRef.current;
    const trackWidth = sliderTrackRef.current.clientWidth;
    const thumbWidth = 40;
    const maxSlide = Math.max(1, trackWidth - thumbWidth - 8);
    const currentX = Math.max(0, Math.min(maxSlide, deltaX));
    setSliderX(currentX);

    // If dragged >= 80% across track: unlock!
    if (currentX >= maxSlide * 0.8) {
      setIsDragging(false);
      dragStartXRef.current = null;
      setSliderX(maxSlide);
      try {
        if ('vibrate' in navigator) navigator.vibrate([40, 40]);
      } catch { }
      setTimeout(() => {
        setSliderX(0);
        setIsPocketMode(false);
      }, 150);
    }
  };

  const handleSliderPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch { }
    setIsDragging(false);
    dragStartXRef.current = null;
    setSliderX(0);
  };

  useEffect(() => {
    return () => {
      if (unlockTimerRef.current) clearInterval(unlockTimerRef.current);
    };
  }, []);

  // Auto-dismiss kilometer split toast after 8 seconds
  useEffect(() => {
    if (!activeToast) return;
    const timer = setTimeout(() => {
      setActiveToast(null);
    }, 8000);
    return () => clearTimeout(timer);
  }, [activeToast?.timestamp]);

  useEffect(() => {
    if (workoutState.activeSplitToast) {
      setActiveToast(workoutState.activeSplitToast);
    }
  }, [workoutState.activeSplitToast?.timestamp]);


  // Subscribe to GPS & Engine updates
  useEffect(() => {
    gpsEngine.setOptions(
      profile?.weight || 70,
      settings?.auto_pause ?? true,
      settings?.auto_pause_threshold || 10,
      profile?.user_id,
      (profile?.distance_unit as 'km' | 'mi') || 'km'
    );

    audioCoach.setConfig(
      !audioMuted && (settings?.audio_coaching ?? true),
      settings?.audio_frequency || '1km'
    );

    const unsubscribe = gpsEngine.subscribe((state) => {
      setWorkoutState(state);
    });

    const currentState = gpsEngine.getState();
    if (currentState.status === 'idle' || currentState.status === 'finished') {
      const backup = offlineSync.getActiveWorkoutBackup();
      if (backup && (backup.status === 'tracking' || backup.status === 'paused' || backup.engineState === 'ACTIVE' || backup.engineState === 'PAUSED')) {
        gpsEngine.restoreWorkout(backup, backup.status === 'tracking' || backup.engineState === 'ACTIVE');
      } else {
        gpsEngine.startTracking(workoutType);
      }
    }

    return () => {
      unsubscribe();
    };
  }, [workoutType, profile, settings, audioMuted]);

  // Auto-clear active course if it was deleted
  useEffect(() => {
    if (workoutState.activeCourse && workoutState.activeCourse.source !== 'preset') {
      const active = courseService.getActiveCourse();
      if (!active) {
        gpsEngine.setActiveCourse(null);
      }
    }
  }, [workoutState.activeCourse]);

  // ── Live Run Beacon Synchronization ──────────────────────────────────────
  useEffect(() => {
    if (workoutState.status !== 'tracking' && workoutState.status !== 'paused') return;

    const now = Date.now();

    // Broadcast live telemetry to InsForge every 5 seconds if active beacon exists
    const currentBeacon = beaconService.getActiveSession();
    if (currentBeacon && now - lastBeaconSyncTimeRef.current >= 5000) {
      lastBeaconSyncTimeRef.current = now;
      setActiveBeacon(currentBeacon);

      const curLoc = workoutState.currentLocation;
      const trail = (workoutState.coordinates || []).slice(-30).map((c) => ({
        latitude: c.latitude,
        longitude: c.longitude,
        speed: c.speed || 0,
        timestamp: new Date(c.timestamp || Date.now()).toISOString(),
      }));

      beaconService.updateTelemetry(currentBeacon.beacon_code, {
        current_lat: curLoc ? curLoc.latitude : currentBeacon.current_lat || undefined,
        current_lng: curLoc ? curLoc.longitude : currentBeacon.current_lng || undefined,
        current_pace: workoutState.currentPace || 0,
        total_distance_meters: workoutState.distanceMeters || 0,
        elapsed_seconds: workoutState.elapsedTime || 0,
        status: workoutState.status === 'tracking' ? 'active' : 'paused',
        route_coordinates: trail,
      });

      // Retrieve latest live cheers and status from Redis / InsForge
      beaconService.getBeaconByCode(currentBeacon.beacon_code).then((serverBeacon) => {
        if (serverBeacon) {
          setActiveBeacon(serverBeacon);
          beaconService.setActiveSession(serverBeacon);
        }
      }).catch(() => {});
    }
  }, [
    workoutState.distanceMeters,
    workoutState.elapsedTime,
    workoutState.status,
    workoutState.currentPace,
    workoutState.currentLocation,
  ]);

  // ── Load active challenge from sessionStorage on mount ──────────────────
  useEffect(() => {
    const challengeId = sessionStorage.getItem('runwar_active_challenge_id');
    if (!challengeId || !profile?.user_id) return;
    activeChallengeIdRef.current = challengeId;

    challengeService.getChallengeById(challengeId, profile.user_id).then((ch) => {
      if (ch) {
        setActiveChallenge(ch);
        const prog = challengeService.computeLiveProgress(ch, profile.user_id);
        if (prog) setChallengeProgress(prog);
        // Mark as active in DB
        challengeService.markChallengeActive(challengeId, profile.user_id).catch(() => {});
      }
    });

    // Realtime opponent updates
    const unsub = challengeService.subscribeToChallenge(challengeId, (updatedPart) => {
      setActiveChallenge((prev) => {
        if (!prev) return prev;
        const isMe = updatedPart.user_id === profile.user_id;
        const updated = {
          ...prev,
          my_participation: isMe ? updatedPart : prev.my_participation,
          opponent_participation: !isMe ? updatedPart : prev.opponent_participation,
        } as Challenge;
        const prog = challengeService.computeLiveProgress(updated, profile.user_id);
        if (prog) setChallengeProgress(prog);
        return updated;
      });
    });

    return () => { unsub(); };
  }, [profile?.user_id]);

  // ── Challenge progress ping on distance milestones ──────────────────────
  useEffect(() => {
    if (!activeChallengeIdRef.current || !profile?.user_id) return;
    const dist = workoutState.distanceMeters;
    if (dist - lastPingDistanceRef.current >= PING_INTERVAL_METERS) {
      lastPingDistanceRef.current = dist;
      challengeService.sendProgressPing(
        activeChallengeIdRef.current,
        profile.user_id,
        dist,
        workoutState.elapsedTime || 0,
        workoutState.currentPace || 0
      ).catch(() => {});

      // Also refresh live progress display
      setActiveChallenge((prev) => {
        if (!prev || !profile?.user_id) return prev;
        const myPart = prev.my_participation;
        if (!myPart) return prev;
        const updatedMyPart = {
          ...myPart,
          current_distance_meters: dist,
          current_duration_seconds: workoutState.elapsedTime || 0,
          current_pace: workoutState.currentPace || 0,
        };
        const updated = { ...prev, my_participation: updatedMyPart } as Challenge;
        const prog = challengeService.computeLiveProgress(updated, profile.user_id);
        if (prog) setChallengeProgress(prog);
        return updated;
      });
    }
  }, [workoutState.distanceMeters, profile?.user_id]);

  const handlePauseResume = () => {
    if (workoutState.status === 'tracking') {
      gpsEngine.pauseTracking(false);
    } else if (workoutState.status === 'paused') {
      gpsEngine.resumeTracking();
    }
  };

  const handleConfirmFinish = () => {
    const finalState = gpsEngine.finishTracking();
    beaconService.stopBeacon().catch(() => {});
    setActiveBeacon(null);
    tetherService.endSession().catch(() => {});
    onFinishWorkout(finalState);

    // Challenge completion – best-effort, non-blocking
    if (activeChallengeIdRef.current && profile?.user_id) {
      const challengeId = activeChallengeIdRef.current;
      const userId = profile.user_id;
      const dist = finalState.distanceMeters || 0;
      const dur = finalState.elapsedTime || 0;
      // workoutId may not be saved yet; use a placeholder that workoutService will link later
      const workoutId = finalState.workoutId || 'pending';
      challengeService.completeChallengeParticipation(challengeId, userId, dist, dur, workoutId)
        .then(({ position, challenge }) => {
          console.log(`[Challenge] Completed at position ${position}`);
          try {
            sessionStorage.setItem('runwar_last_completed_challenge', JSON.stringify({
              challengeId,
              position,
              title: challenge?.title || 'Running Challenge',
              targetDistance: challenge?.target_distance_meters || dist,
              opponentName: challenge?.opponent_profile?.username
                ? `@${challenge.opponent_profile.username}`
                : (challenge?.opponent_profile?.name || 'Opponent')
            }));
          } catch {}
        })
        .catch((err) => console.warn('[Challenge] Completion error:', err))
        .finally(() => {
          sessionStorage.removeItem('runwar_active_challenge_id');
          activeChallengeIdRef.current = null;
        });
    }
  };

  const handleToggleSimulation = () => {
    const nextMode = !simMode;
    gpsEngine.setSimulationMode(nextMode);
    setSimMode(nextMode);
  };

  const handleToggleViewMode = () => {
    setViewMode((prev) => (prev === 'split' ? 'map' : 'split'));
  };

  const isPaused = workoutState.status === 'paused';
  const distanceUnit = profile?.distance_unit || 'km';
  const paceUnit = profile?.pace_unit || 'min_km';

  // Format GPS Status (Icon only for sleek single-pill header)
  const getGpsIcon = () => {
    const status = workoutState.gpsStatus;
    const acc = workoutState.gpsAccuracy ? Math.round(workoutState.gpsAccuracy) : null;

    if (status === 'locked') {
      return (
        <div
          className="p-1.5 rounded-lg flex items-center justify-center text-emerald-600 dark:text-emerald-400"
          title={`GPS Locked (±${acc || 5}m accuracy)`}
        >
          <Compass size={14} className="text-emerald-500" />
        </div>
      );
    }
    if (status === 'weak') {
      return (
        <div
          className="p-1.5 rounded-lg flex items-center justify-center text-amber-500"
          title={`GPS Signal Weak (±${acc || 30}m accuracy)`}
        >
          <Compass size={14} className="text-amber-500" />
        </div>
      );
    }
    if (status === 'lost') {
      return (
        <div
          className="p-1.5 rounded-lg flex items-center justify-center text-rose-500"
          title="GPS Signal Lost"
        >
          <AlertTriangle size={14} className="text-rose-500" />
        </div>
      );
    }
    return (
      <div
        className="p-1.5 rounded-lg flex items-center justify-center text-slate-400"
        title="Acquiring GPS Signal..."
      >
        <Compass size={14} className="text-slate-400" />
      </div>
    );
  };

  // Format Sync Status (Icon only)
  const getNetworkIcon = () => {
    const status = workoutState.networkStatus;
    if (status === 'offline') {
      return (
        <>
          <span className="w-px h-3.5 bg-slate-200 dark:bg-slate-800 mx-0.5" />
          <div
            className="p-1.5 rounded-lg flex items-center justify-center text-slate-400"
            title="Offline mode: GPS points stored locally"
          >
            <WifiOff size={14} />
          </div>
        </>
      );
    }
    if (status === 'syncing') {
      return (
        <>
          <span className="w-px h-3.5 bg-slate-200 dark:bg-slate-800 mx-0.5" />
          <div
            className="p-1.5 rounded-lg flex items-center justify-center text-sky-500"
            title="Syncing coordinates to cloud..."
          >
            <CloudUpload size={14} />
          </div>
        </>
      );
    }
    return null;
  };

  return (
    <div className="h-[100dvh] max-h-[100dvh] w-full bg-emerald-50/40 dark:bg-slate-950 text-slate-900 dark:text-white flex flex-col justify-between items-center p-3 sm:p-4 select-none relative overflow-hidden">
      <div className="w-full max-w-xl md:max-w-2xl flex flex-col flex-1 justify-between gap-2 relative h-full min-h-0">
        {/* Top Status & Controls Header */}
        <div className="flex items-center justify-between z-20 shrink-0">
          {/* Unified Compact Status Capsule: GPS, Wake Lock & Sim Mode */}
          <div className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-white/90 dark:bg-slate-900/90 border border-emerald-200/80 dark:border-slate-800 shadow-sm backdrop-blur-md">
            {getGpsIcon()}
            <span className="w-px h-3.5 bg-slate-200 dark:bg-slate-800 mx-0.5" />
            <WakeLockIndicator iconOnly />
            <span className="w-px h-3.5 bg-slate-200 dark:bg-slate-800 mx-0.5" />
            <button
              type="button"
              onClick={handleToggleSimulation}
              className="p-1.5 rounded-lg transition-all active:scale-95 flex items-center justify-center cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              title={simMode ? 'GPS Simulation is ON (Tap to use Real GPS)' : 'GPS Simulation is OFF (Tap to enable Simulation)'}
              aria-label="Toggle GPS Simulation"
            >
              <Zap size={14} className={simMode ? 'text-amber-500 fill-amber-500' : 'text-slate-400'} />
            </button>
            {getNetworkIcon()}
          </div>

          {/* Direct Controls: Voice Coach, Course, Ghost, Beacon, Tether, Pocket Mode & View Mode */}
          <div className="flex items-center gap-1 sm:gap-1.5">
            {/* 1. Voice Coach Toggle */}
            <button
              type="button"
              onClick={() => {
                const nextMuted = audioCoach.toggleMute() ? false : true;
                setAudioMuted(nextMuted);
              }}
              className={`p-1.5 sm:p-2 rounded-xl border transition-all active:scale-95 ${
                audioMuted
                  ? 'bg-white dark:bg-slate-900 border-emerald-200 dark:border-slate-800 text-slate-400'
                  : 'bg-emerald-500 text-white dark:text-slate-950 border-emerald-500 shadow-sm shadow-emerald-500/20'
              }`}
              title={audioMuted ? 'Voice coach: Muted (tap to unmute)' : 'Voice coach: Active'}
              aria-label="Voice Coach"
            >
              {audioMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>

            {/* 2. Course / Route Navigation Trigger */}
            <button
              type="button"
              onClick={() => setShowCourseModal(true)}
              className={`p-1.5 sm:p-2 rounded-xl border transition-all active:scale-95 flex items-center gap-1 cursor-pointer ${
                workoutState.activeCourse
                  ? 'bg-orange-500 text-white dark:text-slate-950 border-orange-500 shadow-sm shadow-orange-500/25 font-bold'
                  : 'bg-white dark:bg-slate-900 border-emerald-200 dark:border-slate-800 text-slate-500 hover:text-orange-600 dark:hover:text-orange-400'
              }`}
              title={workoutState.activeCourse ? `Course: ${workoutState.activeCourse.name} (Tap to change)` : 'Select or upload GPX course to follow'}
              aria-label="Course navigation"
            >
              <Navigation size={15} className={workoutState.activeCourse ? 'animate-pulse' : ''} />
            </button>

            {/* 3. Ghost Rival Racing Mode Trigger */}
            <button
              type="button"
              onClick={() => setShowGhostModal(true)}
              className={`p-1.5 sm:p-2 rounded-xl border transition-all active:scale-95 flex items-center gap-1 cursor-pointer ${
                workoutState.ghostRival
                  ? 'bg-violet-600 text-white border-violet-500 shadow-sm shadow-violet-500/25 font-bold'
                  : 'bg-white dark:bg-slate-900 border-emerald-200 dark:border-slate-800 text-slate-500 hover:text-violet-600 dark:hover:text-violet-400'
              }`}
              title={
                workoutState.ghostRival
                  ? `Rival: ${workoutState.ghostRival.name} (Tap to change)`
                  : 'Race against a Virtual Ghost Rival'
              }
              aria-label="Ghost Rival"
            >
              <Swords size={15} className={workoutState.ghostRival ? 'animate-pulse' : ''} />
            </button>

            {/* 4. Live Run Beacon Trigger */}
            <button
              type="button"
              onClick={() => setShowBeaconModal(true)}
              className={`p-1.5 sm:p-2 rounded-xl border transition-all active:scale-95 flex items-center gap-1 cursor-pointer ${
                activeBeacon
                  ? 'bg-rose-500 text-white border-rose-400 shadow-sm shadow-rose-500/25 font-bold'
                  : 'bg-white dark:bg-slate-900 border-emerald-200 dark:border-slate-800 text-slate-500 hover:text-rose-500 dark:hover:text-rose-400'
              }`}
              title={activeBeacon ? 'Live Beacon Active (Tap to share/manage)' : 'Start Live Run Beacon'}
              aria-label="Live Run Beacon"
            >
              <Radio size={15} className={activeBeacon ? 'animate-pulse' : ''} />
            </button>

            {/* 5. Virtual Tether / Buddy Run Trigger */}
            <button
              type="button"
              onClick={() => setShowTetherModal(true)}
              className={`p-1.5 sm:p-2 rounded-xl border transition-all active:scale-95 flex items-center gap-1 cursor-pointer ${
                activeTether && activeTether.status === 'active'
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm shadow-emerald-600/25 font-bold'
                  : 'bg-white dark:bg-slate-900 border-emerald-200 dark:border-slate-800 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400'
              }`}
              title={
                activeTether && activeTether.status === 'active'
                  ? `Tethered with ${activeTether.peer?.name || 'Buddy'} (Tap to manage)`
                  : 'Start Virtual Tethered Run'
              }
              aria-label="Virtual Tether"
            >
              <Users size={15} className={activeTether && activeTether.status === 'active' ? 'animate-pulse' : ''} />
            </button>

            {/* 6. Pocket Mode Toggle */}
            <button
              type="button"
              onClick={() => setIsPocketMode(true)}
              className="p-1.5 sm:p-2 rounded-xl border transition-all active:scale-95 bg-white dark:bg-slate-900 border-emerald-200 dark:border-slate-800 text-emerald-800 dark:text-slate-300 hover:text-emerald-950 dark:hover:text-white"
              title="Pocket Mode: Lock touch & dim display"
              aria-label="Pocket Mode"
            >
              <Lock size={15} />
            </button>

            {/* 7. View Mode Switcher (Split View vs Fullscreen Map) */}
            <button
              type="button"
              onClick={handleToggleViewMode}
              className={`p-1.5 sm:p-2 rounded-xl border transition-all active:scale-95 flex items-center gap-1 text-xs font-bold ${
                viewMode === 'map'
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

        {/* Course Breadcrumb Navigation HUD Card */}
        {workoutState.activeCourse && (
          <div className="shrink-0 w-full p-2.5 sm:p-3 rounded-2xl bg-orange-50/90 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-500/40 shadow-sm animate-fade-in space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="w-6 h-6 rounded-lg bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                  <Navigation size={13} className="text-orange-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-black uppercase text-orange-700 dark:text-orange-400 tracking-wider">
                    COURSE GUIDE
                  </span>
                  <h4 className="text-xs font-bold text-slate-950 dark:text-white truncate">
                    {workoutState.activeCourse.name}
                  </h4>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-xs font-mono font-black text-orange-600 dark:text-orange-400">
                  {workoutState.courseProgress
                    ? `${formatDistance(workoutState.courseProgress.distanceRemainingMeters, distanceUnit)} left`
                    : `${formatDistance(workoutState.activeCourse.totalDistanceMeters, distanceUnit)}`}
                </span>
                <button
                  onClick={() => setShowCourseModal(true)}
                  className="p-1 rounded-lg text-slate-400 hover:text-orange-600 dark:hover:text-orange-400 transition-colors cursor-pointer"
                  title="Change course"
                >
                  <Route size={13} />
                </button>
                <button
                  onClick={() => {
                    gpsEngine.setActiveCourse(null);
                    courseService.setActiveCourse(null);
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                  title="Remove course from active run"
                >
                  <X size={13} />
                </button>
              </div>
            </div>

            {/* Course Progress Bar */}
            <div className="w-full h-1.5 rounded-full bg-slate-200/80 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-500 rounded-full"
                style={{ width: `${workoutState.courseProgress?.percentCompleted || 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Virtual Ghost Runner / Rival Mode Racing HUD Card */}
        {workoutState.ghostProgress && (
          <div className="shrink-0 w-full p-2.5 sm:p-3 rounded-2xl bg-gradient-to-r from-violet-50/95 via-purple-50/90 to-indigo-50/95 dark:from-violet-950/40 dark:via-purple-950/30 dark:to-indigo-950/40 border border-violet-200/90 dark:border-violet-500/40 shadow-sm animate-fade-in space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="w-6 h-6 rounded-lg bg-violet-500/20 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
                  <Swords size={13} className="text-violet-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-black uppercase text-violet-700 dark:text-violet-400 tracking-wider">
                      GHOST RIVAL
                    </span>
                    <span
                      className={`text-[10px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${
                        workoutState.ghostProgress.isRunnerAhead
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {workoutState.ghostProgress.isRunnerAhead ? '▲' : '▼'}{' '}
                      {Math.abs(workoutState.ghostProgress.deltaMeters)}m{' '}
                      {workoutState.ghostProgress.isRunnerAhead ? 'Ahead' : 'Behind'}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-950 dark:text-white truncate">
                    {workoutState.ghostProgress.config.name}
                  </h4>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <div className="text-right">
                  <span className="text-[9px] font-bold text-slate-400 uppercase block">Rival Pace</span>
                  <span className="text-xs font-mono font-black text-violet-600 dark:text-violet-400">
                    {formatPace(workoutState.ghostProgress.ghostPaceSecondsPerKm, paceUnit)}
                  </span>
                </div>
                <button
                  onClick={() => setShowGhostModal(true)}
                  className="p-1 rounded-lg text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 cursor-pointer"
                  title="Configure Ghost Rival"
                >
                  <Swords size={13} />
                </button>
              </div>
            </div>

            {/* Head-to-Head Racing Track Progress Visualizer */}
            <div className="relative pt-2 pb-1">
              <div className="w-full h-2 rounded-full bg-slate-200/80 dark:bg-slate-800 relative overflow-visible">
                {/* Runner Progress Fill */}
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(
                        0,
                        (workoutState.distanceMeters /
                          (workoutState.ghostProgress.config.targetDistanceMeters ||
                            Math.max(workoutState.distanceMeters, workoutState.ghostProgress.ghostDistanceMeters, 1000))) *
                          100
                      )
                    )}%`,
                  }}
                />

                {/* Ghost Runner Marker Avatar */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-500 z-10"
                  style={{
                    left: `${Math.min(
                      96,
                      Math.max(
                        4,
                        (workoutState.ghostProgress.ghostDistanceMeters /
                          (workoutState.ghostProgress.config.targetDistanceMeters ||
                            Math.max(workoutState.distanceMeters, workoutState.ghostProgress.ghostDistanceMeters, 1000))) *
                          100
                      )
                    )}%`,
                  }}
                  title={`Ghost: ${workoutState.ghostProgress.ghostDistanceMeters}m`}
                >
                  <div className="w-5 h-5 rounded-full bg-violet-600 text-white flex items-center justify-center text-[10px] shadow-md shadow-violet-600/40 ring-2 ring-white dark:ring-slate-900 animate-pulse">
                    👻
                  </div>
                </div>

                {/* User Runner Avatar */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-300 z-20"
                  style={{
                    left: `${Math.min(
                      96,
                      Math.max(
                        4,
                        (workoutState.distanceMeters /
                          (workoutState.ghostProgress.config.targetDistanceMeters ||
                            Math.max(workoutState.distanceMeters, workoutState.ghostProgress.ghostDistanceMeters, 1000))) *
                          100
                      )
                    )}%`,
                  }}
                  title={`You: ${Math.round(workoutState.distanceMeters)}m`}
                >
                  <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] shadow-md shadow-emerald-500/40 ring-2 ring-white dark:ring-slate-900">
                    🏃
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Live Running Challenge HUD */}
        {activeChallenge && challengeProgress && (
          <div className="shrink-0 animate-fade-in">
            <ChallengeHUD
              challenge={activeChallenge}
              progress={challengeProgress}
              distanceUnit={(profile?.distance_unit as 'km' | 'mi') || 'km'}
            />
          </div>
        )}

        {/* Live Virtual Tether HUD */}
        {activeTether && activeTether.status === 'active' && (
          <div className="shrink-0 animate-fade-in">
            <TetherHUD
              session={activeTether}
              peerTelemetry={peerTelemetry}
              delta={tetherDelta}
              distanceUnit={distanceUnit}
              paceUnit={paceUnit}
              onOpenModal={() => setShowTetherModal(true)}
            />
          </div>
        )}

        {/* Live Weather Snapshot Pill (if acquired) */}
        {workoutState.weather && (
          <div className="shrink-0 flex items-center justify-between w-full animate-fade-in">
            <WeatherBadge
              weather={workoutState.weather}
              distanceUnit={(profile?.distance_unit as 'km' | 'mi') || 'km'}
              variant="pill"
            />
          </div>
        )}

        {/* Keep Screen Active / Web GPS Advisory Banner */}
        {!bannerDismissed && (
          <div className="shrink-0 w-full rounded-2xl bg-white/95 dark:bg-slate-900/95 border border-emerald-200/80 dark:border-slate-800 p-2.5 sm:p-3 shadow-sm flex items-start gap-2.5 animate-fade-in">
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
              <Smartphone size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-bold text-emerald-950 dark:text-white">
                  Keep Screen Active
                </span>
                <button
                  onClick={handleDismissBanner}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded transition-colors"
                  aria-label="Dismiss notice"
                >
                  <X size={14} />
                </button>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug mt-0.5">
                Keep RunWar on-screen while running. Turning off the screen or switching apps suspends web GPS tracking.
              </p>
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={() => setIsPocketMode(true)}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <Lock size={12} />
                  <span>Pocket Mode</span>
                </button>
                <button
                  onClick={handleDismissBanner}
                  className="px-2 py-1 rounded-lg text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Milestone Split Toast - Simple, clean, standard look */}
        {activeToast && (
          <div className="fixed top-14 left-4 right-4 z-50 flex justify-center pointer-events-none animate-fade-in">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-lg flex items-center gap-3 text-slate-900 dark:text-white max-w-sm w-full pointer-events-auto transition-all">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex flex-col items-center justify-center text-emerald-700 dark:text-emerald-400 shrink-0">
                <span className="text-[9px] font-bold uppercase leading-none text-emerald-600 dark:text-emerald-500">
                  {distanceUnit === 'mi' ? 'MI' : 'KM'}
                </span>
                <span className="text-sm font-black leading-none mt-0.5">
                  {activeToast.kilometer}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {distanceUnit === 'mi' ? `Mile ${activeToast.kilometer}` : `Kilometer ${activeToast.kilometer}`}
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                    {formatDuration(activeToast.splitDuration)}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-xs">
                  <span className="font-mono text-slate-500 dark:text-slate-400">
                    {formatPace(activeToast.splitPace, paceUnit)}
                  </span>
                  {activeToast.diffPaceSeconds !== 0 && (
                    <span className={`text-[11px] font-medium ${activeToast.diffPaceSeconds < 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                      }`}>
                      {activeToast.diffPaceSeconds < 0
                        ? `(-${Math.abs(activeToast.diffPaceSeconds)}s)`
                        : `(+${activeToast.diffPaceSeconds}s)`}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setActiveToast(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 text-xs"
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
          <div className="flex-1 flex flex-col justify-between gap-2 min-h-0 w-full">
            {/* One persistent map instance preserves map style, zoom, and follow state between views. */}
            <div className={`flex-1 min-h-[160px] w-full relative rounded-2xl sm:rounded-3xl overflow-hidden border border-emerald-200/80 dark:border-slate-800 ${viewMode === 'map' ? 'shadow-md' : 'shadow-sm'}`}>
              <LiveWorkoutMap
                coordinates={workoutState.coordinates}
                currentLocation={workoutState.currentLocation}
                isTracking={workoutState.status === 'tracking'}
                gpsAccuracy={workoutState.gpsAccuracy}
                course={workoutState.activeCourse}
                courseProgress={workoutState.courseProgress}
                ghostProgress={workoutState.ghostProgress}
                distanceUnit={distanceUnit}
                className="h-full w-full"
              >
                {viewMode === 'map' && (
                  <div className="absolute bottom-3 inset-x-3 z-20 p-2.5 sm:p-3 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-emerald-200/80 dark:border-slate-800 grid grid-cols-5 gap-1 text-center shadow-xl">
                    <div><div className="text-[9px] uppercase font-bold text-emerald-800/80 dark:text-slate-400">Distance</div><div className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400">{formatDistance(workoutState.distanceMeters, distanceUnit, 2)} {distanceUnit}</div></div>
                    <div><div className="text-[9px] uppercase font-bold text-emerald-800/80 dark:text-slate-400">Steps</div><div className="text-xs sm:text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400">{Number(workoutState.steps || 0).toLocaleString()}</div></div>
                    <div><div className="text-[9px] uppercase font-bold text-emerald-800/80 dark:text-slate-400">Time</div><div className="text-xs sm:text-sm font-mono font-bold text-emerald-950 dark:text-white">{formatDuration(workoutState.movingTime > 0 ? workoutState.movingTime : workoutState.elapsedTime)}</div></div>
                    <div><div className="text-[9px] uppercase font-bold text-emerald-800/80 dark:text-slate-400">Pace</div><div className="text-xs sm:text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400">{workoutState.currentPace > 0 ? formatPaceRaw(workoutState.currentPace, paceUnit) : '--:--'}</div></div>
                    <div><div className="text-[9px] uppercase font-bold text-emerald-800/80 dark:text-slate-400">Avg Pace</div><div className="text-xs sm:text-sm font-mono font-bold text-emerald-950 dark:text-slate-200">{workoutState.averagePace > 0 ? formatPaceRaw(workoutState.averagePace, paceUnit) : '--:--'}</div></div>
                  </div>
                )}
              </LiveWorkoutMap>
            </div>

            {viewMode === 'split' && (
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
                  steps={workoutState.steps || 0}
                  cadence={workoutState.cadence || 0}
                  distanceUnit={distanceUnit}
                  paceUnit={paceUnit}
                  isPaused={isPaused}
                  isAutoPaused={workoutState.isAutoPaused}
                />
              </div>
            )}
          </div>
        </div>

        {/* Splits Bottom Sheet */}
        <BottomSheet
          isOpen={showSplitsDrawer && Boolean(workoutState.splits && workoutState.splits.length > 0)}
          onClose={() => setShowSplitsDrawer(false)}
          title="Kilometer Splits"
          icon={<Flag size={18} />}
        >
          <div className="space-y-2">
            {workoutState.splits &&
              workoutState.splits.map((split) => (
                <div
                  key={split.split_number}
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-emerald-50/60 dark:bg-slate-950/60 border border-emerald-100 dark:border-slate-800/80 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black flex items-center justify-center text-[11px]">
                      {split.split_number}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      Split {split.split_number}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                      {formatPaceRaw(split.pace, paceUnit)} {paceUnit === 'min_mi' ? '/mi' : '/km'}
                    </span>
                    <span className="font-mono text-slate-500 dark:text-slate-400">
                      {formatDuration(split.duration_seconds)}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </BottomSheet>

        {/* Walkie-Talkie Push-to-Talk Action (Active during Tether runs) */}
        {activeTether && activeTether.status === 'active' && (
          <div className="shrink-0 pb-1 z-20 animate-fade-in">
            <TetherWalkieTalkie session={activeTether} />
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
                    beaconService.stopBeacon().catch(() => {});
                    setActiveBeacon(null);
                    tetherService.endSession().catch(() => {});
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

      {/* Pocket Mode: Dual Light Mode & Dark Mode Screen */}
      {isPocketMode && (
        <div
          className="fixed inset-0 z-50 bg-slate-50 dark:bg-black text-slate-900 dark:text-white flex flex-col justify-between items-center p-6 select-none animate-fade-in touch-none transition-colors duration-200"
        >
          {/* Header: Mode Badge */}
          <div className="w-full flex items-center justify-between pt-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-emerald-600 dark:text-emerald-400 shadow-xs">
              <Lock size={13} className="text-emerald-600 dark:text-emerald-400" />
              <span>Pocket Safe Active</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse ml-0.5" />
            </div>

            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Screen Locked
            </div>
          </div>

          {/* Center: Large High-Contrast Stats */}
          <div className="w-full flex flex-col items-center justify-center my-auto space-y-6">
            {/* Distance */}
            <div className="flex flex-col items-center">
              <div className="text-5xl sm:text-6xl font-black font-mono tracking-tight text-slate-950 dark:text-white">
                {formatDistance(workoutState.distanceMeters, distanceUnit, 2)}
              </div>
              <span className="text-xs uppercase font-bold tracking-widest text-emerald-600 dark:text-emerald-400 mt-1">
                {distanceUnit === 'mi' ? 'Miles' : 'Kilometers'}
              </span>
            </div>

            {/* Time & Pace in 2 columns */}
            <div className="grid grid-cols-2 gap-4 text-center w-full max-w-xs pt-2">
              <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200/90 dark:border-slate-800 shadow-xs dark:shadow-none">
                <div className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 dark:text-slate-200">
                  {formatDuration(workoutState.movingTime > 0 ? workoutState.movingTime : workoutState.elapsedTime)}
                </div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 mt-0.5">
                  Duration
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200/90 dark:border-slate-800 shadow-xs dark:shadow-none">
                <div className="text-2xl sm:text-3xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {workoutState.currentPace > 0 ? formatPaceRaw(workoutState.currentPace, paceUnit) : '--:--'}
                </div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 mt-0.5">
                  Pace ({paceUnit === 'min_mi' ? '/mi' : '/km'})
                </div>
              </div>
            </div>

            {/* Status Notice */}
            <div className="text-center px-4">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">
                Screen stays awake to record your route continuously while preventing accidental pocket touches.
              </p>
            </div>
          </div>

          {/* Bottom: Unlock Controls according to User Preference (Hold, Swipe, or Both) */}
          <div className="w-full max-w-xs flex flex-col items-center gap-3 pb-4">
            {/* 1. Circular Hold-to-Unlock Button (Shown if mode is 'hold' or 'both') */}
            {(pocketUnlockMode === 'hold' || pocketUnlockMode === 'both') && (
              <div className="flex flex-col items-center gap-2">
                <div className="relative flex items-center justify-center">
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      handleUnlockTouchStart();
                    }}
                    onPointerUp={(e) => {
                      e.stopPropagation();
                      handleUnlockTouchEnd();
                    }}
                    onPointerLeave={handleUnlockTouchEnd}
                    onPointerCancel={handleUnlockTouchEnd}
                    className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white flex flex-col items-center justify-center shadow-xl shadow-slate-200/60 dark:shadow-2xl dark:shadow-black active:scale-95 transition-transform group cursor-pointer"
                    aria-label="Hold circle to unlock"
                  >
                    {/* Circular Progress Ring SVG */}
                    <svg
                      className="absolute -inset-2 w-[calc(100%+16px)] h-[calc(100%+16px)] -rotate-90 pointer-events-none"
                      viewBox="0 0 120 120"
                    >
                      {/* Track Ring */}
                      <circle
                        cx="60"
                        cy="60"
                        r="52"
                        className="stroke-slate-200 dark:stroke-slate-800/90"
                        strokeWidth="4"
                        fill="transparent"
                      />
                      {/* Progress Fill Ring */}
                      <circle
                        cx="60"
                        cy="60"
                        r="52"
                        className="stroke-emerald-500 dark:stroke-emerald-400 transition-all duration-75 ease-linear"
                        strokeWidth="4.5"
                        strokeDasharray={326.73}
                        strokeDashoffset={326.73 - (unlockProgress / 100) * 326.73}
                        strokeLinecap="round"
                        fill="transparent"
                      />
                    </svg>

                    {/* Inner Icon: Lock -> Unlock when 100% */}
                    {unlockProgress >= 100 ? (
                      <Unlock size={34} className="text-emerald-500 dark:text-emerald-400 scale-110 transition-transform animate-scale-in" />
                    ) : (
                      <Lock size={30} className="text-slate-700 dark:text-slate-200 group-active:scale-105 transition-transform" />
                    )}

                    {/* Live % text if holding */}
                    {unlockProgress > 0 && unlockProgress < 100 && (
                      <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 leading-none mt-1">
                        {unlockProgress}%
                      </span>
                    )}
                  </button>
                </div>

                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {unlockProgress > 0 ? 'Keep holding to unlock...' : 'Hold circle for 1s'}
                </span>
              </div>
            )}

            {/* Subtle "or" divider - shown only when BOTH options are active */}
            {pocketUnlockMode === 'both' && (
              <div className="flex items-center gap-2.5 w-full max-w-[200px] my-0.5">
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800/80" />
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">or</span>
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800/80" />
              </div>
            )}

            {/* 2. Swipe to Unlock Slider (Shown if mode is 'swipe' or 'both') */}
            {(pocketUnlockMode === 'swipe' || pocketUnlockMode === 'both') && (
              <div className="flex flex-col items-center gap-2 w-full max-w-[260px]">
                <div
                  ref={sliderTrackRef}
                  className="relative w-full h-12 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 flex items-center overflow-hidden shadow-md dark:shadow-lg select-none"
                >
                  {/* Highlight trail behind thumb */}
                  <div
                    className="absolute left-0 top-0 bottom-0 bg-emerald-500/15 dark:bg-emerald-500/20 rounded-full pointer-events-none transition-all duration-75"
                    style={{ width: `${sliderX + 40}px` }}
                  />

                  {/* Shimmer prompt */}
                  <div
                    className="absolute inset-0 flex items-center justify-center pointer-events-none text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 gap-1 transition-opacity duration-200"
                    style={{ opacity: isDragging ? Math.max(0, 1 - sliderX / 60) : 1 }}
                  >
                    <span>Swipe to unlock</span>
                    <ChevronRight size={14} className="text-emerald-500 dark:text-emerald-400 animate-pulse" />
                  </div>

                  {/* Slider thumb */}
                  <button
                    type="button"
                    onPointerDown={handleSliderPointerDown}
                    onPointerMove={handleSliderPointerMove}
                    onPointerUp={handleSliderPointerUp}
                    onPointerCancel={handleSliderPointerUp}
                    style={{
                      transform: `translateX(${sliderX}px)`,
                      transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
                    }}
                    className="relative w-10 h-10 rounded-full bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 flex items-center justify-center shadow-md active:scale-95 cursor-grab active:cursor-grabbing z-10 shrink-0"
                    aria-label="Swipe to unlock"
                  >
                    {sliderX > 140 ? (
                      <Unlock size={18} className="text-slate-950 scale-110 transition-transform" />
                    ) : (
                      <ChevronRight size={18} className="text-slate-950" strokeWidth={2.5} />
                    )}
                  </button>
                </div>
                {pocketUnlockMode === 'swipe' && (
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Slide right to unlock
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Audio & Voice Coach Customization Modal */}
      <AudioCoachModal
        isOpen={showAudioSettings}
        onClose={() => setShowAudioSettings(false)}
        frequency={coachFrequency}
        onChangeFrequency={(f) => {
          setCoachFrequency(f);
          audioCoach.setConfig(!audioMuted, f);
        }}
        isMuted={audioMuted}
        onToggleMute={() => {
          const nextMuted = audioCoach.toggleMute() ? false : true;
          setAudioMuted(nextMuted);
        }}
      />

      {/* Course Route Selector & GPX Importer Modal */}
      <CourseModal
        isOpen={showCourseModal}
        onClose={() => setShowCourseModal(false)}
        profile={profile}
        currentLat={workoutState.currentLocation?.latitude}
        currentLng={workoutState.currentLocation?.longitude}
        onSelectCourse={(course) => gpsEngine.setActiveCourse(course)}
      />

      {/* Virtual Ghost Runner / Rival Mode Modal */}
      <GhostRivalModal
        isOpen={showGhostModal}
        onClose={() => setShowGhostModal(false)}
        profile={profile}
        onSelectGhost={(ghost) => gpsEngine.setGhostRival(ghost)}
      />

      {/* Live Run Beacon Management Modal */}
      <LiveBeaconModal
        isOpen={showBeaconModal}
        onClose={() => {
          setShowBeaconModal(false);
          setActiveBeacon(beaconService.getActiveSession());
        }}
        onBeaconChange={(b) => setActiveBeacon(b)}
        profile={profile}
        currentLat={workoutState.currentLocation?.latitude}
        currentLng={workoutState.currentLocation?.longitude}
        workoutType={workoutType}
      />

      {/* Virtual Tether & Walkie-Talkie Management Modal */}
      <TetherModal
        isOpen={showTetherModal}
        onClose={() => {
          setShowTetherModal(false);
          setActiveTether(tetherService.getActiveSession());
        }}
        onSessionChange={setActiveTether}
        profile={profile}
      />
    </div>
  );
};

