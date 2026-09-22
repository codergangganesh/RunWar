import React, { useEffect, useState, useRef, useCallback } from 'react';
import { LiveWorkoutState, UserProfile, Workout } from '../types';
import { workoutService } from '../services/workoutService';
import { formatDistance, formatDuration, formatPace } from '../utils/formatters';
import { StaticRouteMap } from '../components/map/StaticRouteMap';
import { WorkoutShareModal } from '../components/workout/WorkoutShareModal';
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
} from 'lucide-react';

interface WorkoutSummaryScreenProps {
  workoutState: LiveWorkoutState;
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
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [quoteIndex, setQuoteIndex] = useState(0);

  const isSavingRef = useRef(false);

  const distanceUnit = profile?.distance_unit || 'km';
  const paceUnit = profile?.pace_unit || 'min_km';

  // Construct workout object for immediate sharing or details
  const currentWorkoutObject: Workout = savedWorkout || {
    id: 'temp_workout_' + Date.now(),
    user_id: profile?.user_id || 'guest_user',
    type: workoutState.type,
    title: `${workoutState.type.charAt(0).toUpperCase() + workoutState.type.slice(1)} Session`,
    started_at: new Date(workoutState.startTime || Date.now() - workoutState.elapsedTime * 1000).toISOString(),
    ended_at: new Date().toISOString(),
    duration_seconds: workoutState.elapsedTime,
    moving_duration_seconds: workoutState.movingTime || workoutState.elapsedTime,
    paused_duration_seconds: workoutState.pausedTime || 0,
    distance_meters: Math.round(workoutState.distanceMeters),
    average_pace: Math.round(workoutState.averagePace),
    average_speed: Number(workoutState.averageSpeed.toFixed(2)),
    max_speed: Number(workoutState.maxSpeed.toFixed(2)),
    calories: workoutState.calories,
    elevation_gain: Math.round(workoutState.elevationGain || 0),
    elevation_loss: Math.round(workoutState.elevationLoss || 0),
    status: 'completed',
    route_coordinates: workoutState.coordinates,
    splits: workoutState.splits,
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
    if (isSavingRef.current || savedWorkout) return;
    isSavingRef.current = true;
    setSaving(true);

    try {
      const payload: Omit<Workout, 'id' | 'created_at'> = {
        user_id: profile?.user_id || 'guest_user',
        type: workoutState.type,
        title: `${workoutState.type.charAt(0).toUpperCase() + workoutState.type.slice(1)} Session`,
        notes: '',
        started_at: new Date(workoutState.startTime || Date.now() - workoutState.elapsedTime * 1000).toISOString(),
        ended_at: new Date().toISOString(),
        duration_seconds: workoutState.elapsedTime,
        moving_duration_seconds: workoutState.movingTime || workoutState.elapsedTime,
        paused_duration_seconds: workoutState.pausedTime || 0,
        distance_meters: Math.round(workoutState.distanceMeters),
        average_pace: Math.round(workoutState.averagePace),
        average_speed: Number(workoutState.averageSpeed.toFixed(2)),
        max_speed: Number(workoutState.maxSpeed.toFixed(2)),
        calories: workoutState.calories,
        elevation_gain: Math.round(workoutState.elevationGain || 0),
        elevation_loss: Math.round(workoutState.elevationLoss || 0),
        status: 'completed',
        route_coordinates: workoutState.coordinates,
        splits: workoutState.splits,
      };

      const result = await workoutService.saveWorkout(payload);
      setSavedWorkout(result.workout);
      onSaved(result.workout);
    } catch (err) {
      console.error('Error auto-saving workout:', err);
    } finally {
      setSaving(false);
    }
  }, [workoutState, profile, onSaved, savedWorkout]);

  useEffect(() => {
    handleAutoSave();
  }, [handleAutoSave]);

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

    const distStr = formatDistance(workoutState.distanceMeters, distanceUnit);
    const durMins = Math.floor(workoutState.elapsedTime / 60);
    const durSecs = workoutState.elapsedTime % 60;
    const paceStr = formatPace(workoutState.averagePace, paceUnit).replace(/\s\/\w+/, '');

    const text = `Workout complete! Fantastic effort! You covered ${distStr} ${distanceUnit === 'km' ? 'kilometers' : 'miles'} in ${durMins} minutes and ${durSecs} seconds, with an average pace of ${paceStr} per ${distanceUnit === 'km' ? 'kilometer' : 'mile'}. You burned ${workoutState.calories} calories. Keep up the great consistency!`;

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
  const workoutDate = new Date(workoutState.startTime || Date.now());
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

  const formattedDistance = (workoutState.distanceMeters / (distanceUnit === 'mi' ? 1609.34 : 1000)).toFixed(2);
  const formattedDuration = formatDuration(workoutState.elapsedTime);
  const formattedMovingTime = formatDuration(workoutState.movingTime || workoutState.elapsedTime);
  const formattedPace = formatPace(workoutState.averagePace, paceUnit).replace(/\s\/\w+/, '');

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

      {/* 3. Measured & Recorded Trophy Banner */}


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
          coordinates={workoutState.coordinates}
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
              {workoutState.calories}{' '}
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
              {Math.round(workoutState.elevationGain || 0)} m
            </div>
          </div>

          <div>
            <div className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1 mb-0.5">
              <TrendingDown size={13} className="text-emerald-600 dark:text-emerald-400" />
              <span>Elevation Loss</span>
            </div>
            <div className="font-mono text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              {Math.round(workoutState.elevationLoss || 0)} m
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
    </div>
  );
};
