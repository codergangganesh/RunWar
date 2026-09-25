import React, { useEffect, useState, useRef, useCallback } from 'react';
import { LiveWorkoutState, UserProfile, Workout, Achievement } from '../types';
import { workoutService } from '../services/workoutService';
import { authService } from '../services/authService';
import { formatDistance, formatDuration, formatPace } from '../utils/formatters';
import { StaticRouteMap } from '../components/map/StaticRouteMap';
import { WorkoutShareModal } from '../components/workout/WorkoutShareModal';
import { AchievementCelebrationModal } from '../components/achievements/AchievementCelebrationModal';
import { WeatherBadge } from '../components/workout/WeatherBadge';
import confetti from 'canvas-confetti';
import {
  Trophy,
  Flame,
  Gauge,
  Timer,
  Clock,
  Check,
  Share2,
  Volume2,
  VolumeX,
  Map,
  Calendar,
  Footprints,
  ChevronRight,
  RotateCcw,
  ArrowRight,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  CloudSun,
  Download,
  Navigation,
  Swords,
  Medal,
} from 'lucide-react';
import { weatherService } from '../services/weatherService';
import { WeatherSnapshot } from '../types';
import { downloadFile, generateGPX } from '../utils/exportGenerators';
import { courseService } from '../services/courseService';

interface WorkoutSummaryScreenProps {
  workoutState: LiveWorkoutState | null;
  profile: UserProfile | null;
  onSaved: (savedWorkout: Workout) => void;
  onDone: () => void;
  onDoAnotherWorkout?: () => void;
  onViewDetails?: (workout: Workout) => void;
}

const MOTIVATION_QUOTES = [
  'Consistency today, stronger tomorrow!',
  'Great work! Every kilometer counts toward your goals.',
  'Your future self will thank you for today’s sweat.',
  'Patience, persistence, and perspiration make an unbeatable runner.',
  'Champions keep playing until they get it right.',
];

export const WorkoutSummaryScreen: React.FC<WorkoutSummaryScreenProps> = ({
  workoutState,
  profile,
  onSaved,
  onDone,
  onDoAnotherWorkout,
  onViewDetails,
}) => {
  const [saving, setSaving] = useState(false);
  const [savedWorkout, setSavedWorkout] = useState<Workout | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [newlyUnlockedAchievements, setNewlyUnlockedAchievements] = useState<Achievement[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [weatherData, setWeatherData] = useState<WeatherSnapshot | null>(
    workoutState?.weather || null
  );
  const [isFetchingWeather, setIsFetchingWeather] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [challengeVerdict, setChallengeVerdict] = useState<{
    challengeId: string;
    position: number;
    title: string;
    targetDistance: number;
    opponentName: string;
  } | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('runwar_last_completed_challenge');
      if (raw) {
        setChallengeVerdict(JSON.parse(raw));
        sessionStorage.removeItem('runwar_last_completed_challenge');
      }
    } catch {}
  }, []);

  const isSavingRef = useRef(false);

  const distanceUnit = profile?.distance_unit || 'km';
  const paceUnit = profile?.pace_unit || 'min_km';

  // Defensive field extraction
  const avgSpeed = workoutState?.averageSpeed != null && !isNaN(workoutState.averageSpeed) ? workoutState.averageSpeed : 0;
  const maxSpd = workoutState?.maxSpeed != null && !isNaN(workoutState.maxSpeed) ? workoutState.maxSpeed : 0;
  const distM = workoutState?.distanceMeters || 0;
  const avgPaceVal = workoutState?.averagePace || 0;
  const elapsed = workoutState?.elapsedTime || 0;
  const moving = workoutState?.movingTime || elapsed;
  const paused = workoutState?.pausedTime || 0;
  const cals = workoutState?.calories || 0;
  const elevGain = workoutState?.elevationGain || 0;
  const elevLoss = workoutState?.elevationLoss || 0;
  const coords = workoutState?.coordinates || [];
  const splitsList = workoutState?.splits || [];
  const wType = workoutState?.type || 'run';

  // Construct workout object for immediate sharing or details
  const currentWorkoutObject: Workout = savedWorkout || {
    id: workoutState?.workoutId || 'temp_workout_' + Date.now(),
    user_id: profile?.user_id || 'guest_user',
    type: wType,
    title: `${wType.charAt(0).toUpperCase() + wType.slice(1)} Session`,
    started_at: new Date(workoutState?.startTime || Date.now() - elapsed * 1000).toISOString(),
    ended_at: new Date().toISOString(),
    duration_seconds: elapsed,
    moving_duration_seconds: moving,
    paused_duration_seconds: paused,
    distance_meters: Math.round(distM),
    average_pace: Math.round(avgPaceVal),
    average_speed: Number(avgSpeed.toFixed(2)),
    max_speed: Number(maxSpd.toFixed(2)),
    calories: cals,
    elevation_gain: Math.round(elevGain),
    elevation_loss: Math.round(elevLoss),
    status: 'completed',
    route_coordinates: coords,
    splits: splitsList,
    weather: workoutState?.weather || weatherData || null,
    created_at: new Date().toISOString(),
  };

  // 1. Trigger celebration confetti on mount
  useEffect(() => {
    try {
      confetti({
        particleCount: 75,
        spread: 70,
        origin: { y: 0.55 },
        colors: ['#00d09c', '#10b981', '#34d399', '#f59e0b', '#38bdf8'],
      });
    } catch {
      // Confetti fallback
    }
  }, []);

  // 2. Auto-save workout immediately in background on mount
  const handleAutoSave = useCallback(async () => {
    if (!workoutState || isSavingRef.current || savedWorkout) return;
    isSavingRef.current = true;
    setSaving(true);

    try {
      // Robustly resolve the authentic user ID so mobile workouts always match cloud auth
      let targetUserId = profile?.user_id;
      if (!targetUserId || targetUserId === 'guest_user') {
        const cachedUser = authService.getCachedUser();
        if (cachedUser?.id && cachedUser.id !== 'guest_user') {
          targetUserId = cachedUser.id;
        } else {
          try {
            const current = await authService.getCurrentUser();
            if (current?.id && current.id !== 'guest_user') {
              targetUserId = current.id;
            }
          } catch { }
        }
      }

      const payload: Omit<Workout, 'id' | 'created_at'> & { id?: string } = {
        id: workoutState.workoutId,
        user_id: targetUserId || 'guest_user',
        type: wType,
        title: `${wType.charAt(0).toUpperCase() + wType.slice(1)} Session`,
        notes: '',
        started_at: new Date(workoutState.startTime || Date.now() - elapsed * 1000).toISOString(),
        ended_at: new Date().toISOString(),
        duration_seconds: elapsed,
        moving_duration_seconds: moving,
        paused_duration_seconds: paused,
        distance_meters: Math.round(distM),
        average_pace: Math.round(avgPaceVal),
        average_speed: Number(avgSpeed.toFixed(2)),
        max_speed: Number(maxSpd.toFixed(2)),
        calories: cals,
        elevation_gain: Math.round(elevGain),
        elevation_loss: Math.round(elevLoss),
        status: 'completed',
        route_coordinates: coords,
        splits: splitsList,
        weather: workoutState.weather || weatherData || null,
      };

      const result = await workoutService.saveWorkout(payload);
      setSavedWorkout(result.workout);
      if (result.newlyUnlockedAchievements && result.newlyUnlockedAchievements.length > 0) {
        setNewlyUnlockedAchievements(result.newlyUnlockedAchievements);
      }
      onSaved(result.workout);
    } catch (err) {
      console.error('Error auto-saving workout:', err);
    } finally {
      setSaving(false);
    }
  }, [workoutState, profile, onSaved, savedWorkout, wType, elapsed, moving, paused, distM, avgPaceVal, avgSpeed, maxSpd, cals, elevGain, elevLoss, coords, splitsList, weatherData]);

  useEffect(() => {
    handleAutoSave();
  }, [handleAutoSave]);

  // Weather auto-fetcher if not previously recorded during active run
  const fetchWorkoutWeather = useCallback(async (forceRefresh: boolean = false) => {
    if (!forceRefresh && (workoutState?.weather || savedWorkout?.weather || weatherData)) {
      return;
    }

    const coordsList = workoutState?.coordinates || [];
    let lat: number | null = null;
    let lng: number | null = null;

    if (coordsList.length > 0) {
      const lastCoord = coordsList[coordsList.length - 1];
      lat = lastCoord.latitude;
      lng = lastCoord.longitude;
    } else if (workoutState?.currentLocation) {
      lat = workoutState.currentLocation.latitude;
      lng = workoutState.currentLocation.longitude;
    }

    if (lat != null && lng != null) {
      setIsFetchingWeather(true);
      try {
        const fetched = await weatherService.getWeatherForLocation(lat, lng, forceRefresh);
        if (fetched) {
          setWeatherData(fetched);
          if (savedWorkout?.id) {
            workoutService.updateWorkoutWeather(savedWorkout.id, fetched);
          }
        }
      } catch (err) {
        console.warn('Could not fetch summary weather:', err);
      } finally {
        setIsFetchingWeather(false);
      }
    } else if (navigator.geolocation) {
      setIsFetchingWeather(true);
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const fetched = await weatherService.getWeatherForLocation(
              pos.coords.latitude,
              pos.coords.longitude,
              forceRefresh
            );
            if (fetched) {
              setWeatherData(fetched);
              if (savedWorkout?.id) {
                workoutService.updateWorkoutWeather(savedWorkout.id, fetched);
              }
            }
          } catch (e) {
            console.warn('Geolocation weather fetch error:', e);
          } finally {
            setIsFetchingWeather(false);
          }
        },
        () => setIsFetchingWeather(false),
        { timeout: 6000 }
      );
    }
  }, [workoutState, savedWorkout?.id, weatherData]);

  useEffect(() => {
    fetchWorkoutWeather(false);
  }, [fetchWorkoutWeather]);

  // 3. Audio Voice Coach Summary
  const handleVoiceRecap = () => {
    if (!('speechSynthesis' in window)) {
      alert('Voice synthesis is not supported on this device.');
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const distStr = formatDistance(distM, distanceUnit);
    const durMins = Math.floor(elapsed / 60);
    const durSecs = elapsed % 60;
    const paceStr = formatPace(avgPaceVal, paceUnit).replace(/\s\/\w+/, '');

    const text = `Workout complete! Fantastic effort! You covered ${distStr} ${distanceUnit === 'mi' ? 'miles' : 'kilometers'} in ${durMins} minutes and ${durSecs} seconds, with an average pace of ${paceStr} per ${distanceUnit === 'mi' ? 'mile' : 'kilometer'}. You burned ${cals} calories. Keep up the great consistency!`;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.05;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  // Clean up speech on unmount
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Format Date and Time
  const workoutDate = new Date(workoutState?.startTime || Date.now());
  const formattedDate = workoutDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const formattedTime = `${workoutDate.toLocaleDateString('en-US', { weekday: 'short' })}, ${workoutDate.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })}`;

  const formattedDistance = (distM / (distanceUnit === 'mi' ? 1609.34 : 1000)).toFixed(2);
  const formattedDuration = formatDuration(elapsed);
  const formattedMovingTime = formatDuration(moving);
  const formattedPace = formatPace(avgPaceVal, paceUnit).replace(/\s\/\w+/, '');

  if (!workoutState) {
    return (
      <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <p className="text-sm font-medium">No workout data found.</p>
        <button
          onClick={onDone}
          className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl font-bold text-sm shadow-md transition-all"
        >
          Back to Home
        </button>
      </div>
    );
  }

  // Handle View Details navigation
  const handleViewDetails = () => {
    if (onViewDetails) {
      onViewDetails(currentWorkoutObject);
    } else {
      onDone();
    }
  };

  // Handle Do Another Workout navigation
  const handleDoAnotherWorkout = () => {
    if (onDoAnotherWorkout) {
      onDoAnotherWorkout();
    } else {
      onDone();
    }
  };

  return (
    <div className="p-4 sm:p-5 space-y-4 animate-fade-in max-w-xl md:max-w-2xl mx-auto select-none">
      {/* 1. Branded Header Bar with Back Button */}
      <div className="flex items-center justify-between pt-1">
        {/* Back Option + RUNWAR Logo & Subtitle */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onDone}
            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 active:scale-90 transition-all shadow-2xs"
            title="Go back to Home"
            aria-label="Go back"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="w-9 h-9 rounded-full border-2 border-emerald-500 bg-white dark:bg-slate-900 flex items-center justify-center p-1 shadow-sm shrink-0">
            <img
              src="/logo.png"
              alt="RunWar"
              className="w-full h-full object-contain rounded-full"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <Footprints size={16} className="text-emerald-600 hidden group-hover:block" />
          </div>
          <div>
            <h1 className="font-display font-black text-xl tracking-tight text-slate-900 dark:text-white leading-none">
              RUNWAR
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium tracking-tight mt-0.5">
              Run. Track. Improve.
            </p>
          </div>
        </div>

        {/* Top Action Buttons (Share & Audio Voice Coach) */}
        <div className="flex items-center gap-2">
          {/* Share Button */}
          <button
            onClick={() => setShowShareModal(true)}
            className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-300 shadow-sm active:scale-90 transition-all"
            title="Share Workout Story"
            aria-label="Share Workout"
          >
            <Share2 size={17} />
          </button>

          {/* Voice Coach Recap Button */}
          <button
            onClick={handleVoiceRecap}
            className={`w-10 h-10 rounded-full border flex items-center justify-center shadow-sm active:scale-90 transition-all ${isSpeaking
              ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-500 text-emerald-600 dark:text-emerald-400 animate-pulse'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400'
              }`}
            title={isSpeaking ? 'Stop Voice Recap' : 'Voice Coach Recap'}
            aria-label="Voice Coach Recap"
          >
            {isSpeaking ? <VolumeX size={17} /> : <Volume2 size={17} />}
          </button>
        </div>
      </div>

      {/* 2. Hero Headline Section */}
      <div className="flex flex-col items-center text-center pt-2 pb-1 space-y-1.5">
        <div className="w-10 h-10 rounded-full bg-emerald-500 dark:bg-[#00d09c] text-white dark:text-slate-950 flex items-center justify-center shadow-md shadow-emerald-500/25">
          <Check size={22} strokeWidth={3.5} />
        </div>
        <h2 className="font-display text-2xl sm:text-3xl font-black text-slate-950 dark:text-white tracking-tight">
          Workout Complete!
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium max-w-xs">
          Great job! You've taken a step towards a healthier you.
        </p>
      </div>

      {/* 3. Virtual Ghost Rival Battle Verdict Card */}
      {workoutState.ghostProgress && (() => {
        const gp = workoutState.ghostProgress;
        const isVictory = gp.isRunnerAhead || gp.deltaMeters >= 0;
        const deltaM = Math.round(Math.abs(gp.deltaMeters));
        const targetPaceStr = formatPace(gp.ghostPaceSecondsPerKm, paceUnit).replace(/\s\/\w+/, '');

        return (
          <div
            className={`p-4 rounded-3xl border shadow-lg transition-all ${
              isVictory
                ? 'bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-amber-500/10 dark:from-emerald-950/40 dark:via-teal-950/20 dark:to-slate-900 border-emerald-300/80 dark:border-emerald-500/40 shadow-emerald-500/10'
                : 'bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-rose-500/10 dark:from-purple-950/40 dark:via-slate-900 dark:to-rose-950/20 border-violet-300/80 dark:border-purple-500/40 shadow-violet-500/10'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-2xl flex items-center justify-center shadow-xs ${
                    isVictory ? 'bg-amber-400/20 text-amber-500' : 'bg-violet-400/20 text-violet-400'
                  }`}
                >
                  {isVictory ? <Trophy size={19} /> : <Swords size={19} />}
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>{isVictory ? '🏆 Rival Victory!' : '⚔️ Rival Battle Complete'}</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate max-w-[170px]">
                    vs {gp.config.name}
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <div
                className={`px-3 py-1 rounded-full text-xs font-black font-mono flex items-center gap-1 ${
                  isVictory
                    ? 'bg-emerald-500 text-white shadow-xs shadow-emerald-500/30'
                    : 'bg-rose-500 text-white shadow-xs shadow-rose-500/30'
                }`}
              >
                <span>{isVictory ? `+${deltaM}m Ahead` : `-${deltaM}m Behind`}</span>
              </div>
            </div>

            {/* Split Comparison Grid */}
            <div className="grid grid-cols-3 gap-2 py-2.5 px-3 rounded-2xl bg-white/70 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800/80 text-center mb-3">
              <div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-0.5">
                  Your Pace
                </span>
                <span className="text-xs sm:text-sm font-mono font-black text-slate-900 dark:text-white">
                  {formattedPace}
                </span>
              </div>
              <div className="border-x border-slate-200/60 dark:border-slate-800/80 px-1">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-0.5">
                  Rival Pace
                </span>
                <span className="text-xs sm:text-sm font-mono font-black text-violet-600 dark:text-violet-400">
                  {targetPaceStr}
                </span>
              </div>
              <div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-0.5">
                  Net Gap
                </span>
                <span
                  className={`text-xs sm:text-sm font-mono font-black ${
                    isVictory ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {deltaM}m
                </span>
              </div>
            </div>

            {/* Race Summary message */}
            <p className="text-[11px] text-center font-semibold text-slate-600 dark:text-slate-300">
              {isVictory
                ? `🔥 Incredible speed! You pulled ahead by ${deltaM} meters and beat the rival pace.`
                : `⚡ Valiant effort! You finished ${deltaM} meters behind the ghost. Run again to claim victory!`}
            </p>
          </div>
        );
      })()}

      {/* 3.1 Run Goal Challenge Verdict Card */}
      {challengeVerdict && (
        <div
          className={`p-4 rounded-3xl border shadow-lg transition-all ${
            challengeVerdict.position === 1
              ? 'bg-gradient-to-br from-amber-500/15 via-yellow-500/10 to-emerald-500/15 dark:from-amber-950/40 dark:via-yellow-950/20 dark:to-slate-900 border-amber-300/80 dark:border-amber-500/40 shadow-amber-500/10'
              : 'bg-gradient-to-br from-indigo-500/15 via-purple-500/10 to-slate-900 border-indigo-300/80 dark:border-indigo-500/40 shadow-indigo-500/10'
          }`}
        >
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-2xl flex items-center justify-center shadow-xs ${
                  challengeVerdict.position === 1 ? 'bg-amber-400/20 text-amber-500' : 'bg-indigo-400/20 text-indigo-400'
                }`}
              >
                {challengeVerdict.position === 1 ? <Trophy size={19} /> : <Medal size={19} />}
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>{challengeVerdict.position === 1 ? 'Challenge Champion!' : 'Challenge Finisher!'}</span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate max-w-[190px]">
                  {challengeVerdict.title} • vs {challengeVerdict.opponentName}
                </p>
              </div>
            </div>

            <div
              className={`px-3 py-1 rounded-full text-xs font-black font-mono flex items-center gap-1 ${
                challengeVerdict.position === 1
                  ? 'bg-amber-500 text-white shadow-xs shadow-amber-500/30'
                  : 'bg-indigo-500 text-white shadow-xs shadow-indigo-500/30'
              }`}
            >
              <span>{challengeVerdict.position === 1 ? '1st Place' : '2nd Place'}</span>
            </div>
          </div>

          <p className="text-[12px] text-center font-semibold text-slate-700 dark:text-slate-300 bg-white/50 dark:bg-black/20 rounded-xl py-2 px-3">
            {challengeVerdict.position === 1
              ? `Outstanding! You conquered the ${(challengeVerdict.targetDistance / 1000).toFixed(0)} KM challenge and crossed the finish line first against ${challengeVerdict.opponentName}!`
              : `Great effort! You completed the ${(challengeVerdict.targetDistance / 1000).toFixed(0)} KM challenge against ${challengeVerdict.opponentName}. Every race builds grit!`}
          </p>
        </div>
      )}


      {/* 4. Your Route Map Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-extrabold text-sm sm:text-base">
            <Map size={18} className="text-emerald-600 dark:text-emerald-400" />
            <span>Your Route</span>
          </div>

          <button
            onClick={handleViewDetails}
            className="px-3.5 py-1 rounded-full border border-emerald-600/80 dark:border-emerald-400/80 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all shadow-2xs"
          >
            <span>View Details</span>
            <ArrowRight size={13} />
          </button>
        </div>

        {/* Route Map */}
        <StaticRouteMap
          coordinates={coords}
          className="h-56 sm:h-60 w-full rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800"
          interactive={true}
        />
      </div>

      {/* 5. Primary Stats Card (Total Distance & Date/Time) */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 border border-slate-100 dark:border-slate-800/80 shadow-sm flex items-center justify-between">
        {/* Total Distance */}
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-300 mb-1">
            <Footprints size={15} className="text-emerald-700 dark:text-emerald-400" />
            <span>Total Distance</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="font-display text-3xl sm:text-4xl font-black text-emerald-950 dark:text-white tracking-tight">
              {formattedDistance}
            </span>
            <span className="text-base font-extrabold text-slate-800 dark:text-slate-200">
              {distanceUnit}
            </span>
          </div>
        </div>

        {/* Date & Time */}
        <div className="text-right">
          <div className="flex items-center justify-end gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
            <Calendar size={14} className="text-emerald-600 dark:text-emerald-400" />
            <span>Date</span>
          </div>
          <div className="text-sm font-black text-slate-900 dark:text-white leading-tight">
            {formattedDate}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            {formattedTime}
          </div>
        </div>
      </div>

      {/* 6. Secondary 6 Metrics Grid */}
      <div className="space-y-2">
        {/* Row 1: Duration, Avg Pace, Calories */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 sm:p-4 border border-slate-100 dark:border-slate-800 shadow-sm grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1 mb-1">
              <Clock size={13} className="text-emerald-600 dark:text-emerald-400" />
              <span>Duration</span>
            </div>
            <div className="font-mono text-base sm:text-lg font-black text-slate-950 dark:text-white">
              {formattedDuration}
            </div>
          </div>

          <div>
            <div className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1 mb-1">
              <Gauge size={13} className="text-emerald-600 dark:text-emerald-400" />
              <span>Avg Pace</span>
            </div>
            <div className="font-mono text-base sm:text-lg font-black text-slate-950 dark:text-white">
              {formattedPace}{' '}
              <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-bold">
                /{distanceUnit}
              </span>
            </div>
          </div>

          <div>
            <div className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1 mb-1">
              <Flame size={13} className="text-amber-500" />
              <span>Calories</span>
            </div>
            <div className="font-display text-base sm:text-lg font-black text-slate-950 dark:text-white">
              {cals}{' '}
              <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-bold">
                kcal
              </span>
            </div>
          </div>
        </div>

        {/* Row 2: Moving Time, Elevation Gain, Elevation Loss */}
        <div className="bg-emerald-50/40 dark:bg-slate-950/60 rounded-2xl p-3 border border-emerald-100/70 dark:border-slate-800/80 grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1 mb-0.5">
              <Timer size={13} className="text-slate-600 dark:text-slate-400" />
              <span>Moving Time</span>
            </div>
            <div className="font-mono text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              {formattedMovingTime}
            </div>
          </div>

          <div>
            <div className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1 mb-0.5">
              <TrendingUp size={13} className="text-emerald-600 dark:text-emerald-400" />
              <span>Elevation Gain</span>
            </div>
            <div className="font-mono text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              {Math.round(elevGain)} m
            </div>
          </div>

          <div>
            <div className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1 mb-0.5">
              <TrendingDown size={13} className="text-emerald-600 dark:text-emerald-400" />
              <span>Elevation Loss</span>
            </div>
            <div className="font-mono text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              {Math.round(elevLoss)} m
            </div>
          </div>
        </div>
      </div>

      {/* 7. Motivation Banner */}
      <div
        onClick={() => setQuoteIndex((prev) => (prev + 1) % MOTIVATION_QUOTES.length)}
        className="bg-[#f0faf5] dark:bg-emerald-950/30 border border-[#cbeee0] dark:border-emerald-800/30 rounded-2xl p-3 px-4 flex items-center justify-between hover:bg-[#e6f7ef] dark:hover:bg-emerald-950/50 transition-all cursor-pointer shadow-2xs"
        title="Click for more motivation"
      >
        <div className="flex items-center gap-2.5">
          <Footprints size={17} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="text-xs sm:text-sm font-bold text-emerald-950 dark:text-emerald-200">
            {MOTIVATION_QUOTES[quoteIndex]}
          </span>
        </div>
        <ChevronRight size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
      </div>

      {/* Weather & Conditions Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-extrabold text-sm sm:text-base">
            <CloudSun size={18} className="text-emerald-600 dark:text-emerald-400" />
            <span>Weather & Conditions</span>
          </div>
          {(savedWorkout?.weather || workoutState?.weather || weatherData) && (
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Recorded during workout
            </span>
          )}
        </div>

        <WeatherBadge
          weather={savedWorkout?.weather || workoutState?.weather || weatherData}
          distanceUnit={distanceUnit}
          variant="card"
          isRefreshing={isFetchingWeather}
          onRefresh={() => fetchWorkoutWeather(true)}
        />
      </div>

      {/* Quick Export & Save Route Bar */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            const gpx = generateGPX(currentWorkoutObject);
            const datePart = (currentWorkoutObject.started_at || new Date().toISOString()).slice(0, 10);
            downloadFile(gpx, `runwar_${currentWorkoutObject.type}_${datePart}.gpx`, 'application/gpx+xml');
            setExportNotice('Exported GPX track!');
            setTimeout(() => setExportNotice(null), 3500);
          }}
          className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
        >
          <Download size={13} className="text-[#fc5200]" />
          <span>Export GPX</span>
        </button>

        {currentWorkoutObject.route_coordinates && currentWorkoutObject.route_coordinates.length > 1 && (
          <button
            onClick={() => {
              try {
                const c = courseService.createCourseFromWorkout(currentWorkoutObject);
                setExportNotice(`Saved "${c.name}" as course!`);
                setTimeout(() => setExportNotice(null), 3500);
              } catch (e: any) {
                alert(e.message || 'Could not save course.');
              }
            }}
            className="flex-1 py-2.5 px-3 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 hover:bg-cyan-100 dark:hover:bg-cyan-900/40 border border-cyan-200 dark:border-cyan-500/30 text-cyan-800 dark:text-cyan-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <Navigation size={13} className="text-cyan-500" />
            <span>Save as Course</span>
          </button>
        )}
      </div>

      {exportNotice && (
        <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-bold text-center animate-fade-in">
          ✓ {exportNotice}
        </div>
      )}

      {/* 8. Bottom Action Buttons (Side-by-Side) */}
      <div className="pt-2 pb-4 flex items-center gap-3">
        {/* Do Another Workout */}
        <button
          onClick={handleDoAnotherWorkout}
          className="flex-1 py-3.5 px-4 rounded-full bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all"
        >
          <RotateCcw size={16} className="text-slate-700 dark:text-slate-300" />
          <span>Do Another Workout</span>
        </button>

        {/* Share Workout */}
        <button
          onClick={() => setShowShareModal(true)}
          className="flex-1 py-3.5 px-4 rounded-full bg-[#00875a] hover:bg-[#00744d] dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-700/25 active:scale-95 transition-all"
        >
          <Share2 size={16} strokeWidth={2.5} />
          <span>Share Workout</span>
        </button>
      </div>

      {/* Story & Social Share Modal */}
      {showShareModal && (
        <WorkoutShareModal
          workout={currentWorkoutObject}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {/* Achievement Unlocked Celebration Popup */}
      {newlyUnlockedAchievements.length > 0 && (
        <AchievementCelebrationModal
          achievements={newlyUnlockedAchievements}
          isOpen={newlyUnlockedAchievements.length > 0}
          onClose={() => setNewlyUnlockedAchievements([])}
        />
      )}
    </div>
  );
};
