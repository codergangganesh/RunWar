import React, { useEffect, useState } from 'react';
import { Achievement, LiveWorkoutState, PersonalRecord, UserProfile, Workout } from '../types';
import { workoutService } from '../services/workoutService';
import { formatDistance, formatDuration, formatPace, formatSpeed } from '../utils/formatters';
import { StaticRouteMap } from '../components/map/StaticRouteMap';
import { PaceChart } from '../components/charts/PaceChart';
import { SplitsTable } from '../components/workout/SplitsTable';
import { ElevationChart } from '../components/charts/ElevationChart';
import { WorkoutShareModal } from '../components/workout/WorkoutShareModal';
import confetti from 'canvas-confetti';
import { Trophy, Flame, Zap, Gauge, Timer, Mountain, Award, CheckCircle2, Share2, ArrowRight, Sparkles } from 'lucide-react';

interface WorkoutSummaryScreenProps {
  workoutState: LiveWorkoutState;
  profile: UserProfile | null;
  onSaved: (savedWorkout: Workout) => void;
  onDone: () => void;
}

export const WorkoutSummaryScreen: React.FC<WorkoutSummaryScreenProps> = ({
  workoutState,
  profile,
  onSaved,
  onDone,
}) => {
  const [title, setTitle] = useState(
    `${workoutState.type.charAt(0).toUpperCase() + workoutState.type.slice(1)} Session`
  );
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedWorkout, setSavedWorkout] = useState<Workout | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  // Trigger celebration confetti
  useEffect(() => {
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#10b981', '#84cc16', '#38bdf8', '#fbbf24'],
      });
    } catch (e) {
      // Confetti fallback
    }
  }, []);

  const handleSaveWorkout = async () => {
    if (saving || savedWorkout) return;
    setSaving(true);

    try {
      const payload: Omit<Workout, 'id' | 'created_at'> = {
        user_id: profile?.user_id || 'guest_user',
        type: workoutState.type,
        title: title.trim(),
        notes: notes.trim(),
        started_at: new Date(workoutState.startTime || Date.now() - workoutState.elapsedTime * 1000).toISOString(),
        ended_at: new Date().toISOString(),
        duration_seconds: workoutState.elapsedTime,
        distance_meters: Math.round(workoutState.distanceMeters),
        average_pace: Math.round(workoutState.averagePace),
        average_speed: Number(workoutState.averageSpeed.toFixed(2)),
        max_speed: Number(workoutState.maxSpeed.toFixed(2)),
        calories: workoutState.calories,
        elevation_gain: Math.round(workoutState.elevationGain),
        elevation_loss: Math.round(workoutState.elevationLoss),
        status: 'completed',
        route_coordinates: workoutState.coordinates,
        splits: workoutState.splits,
      };

      const result = await workoutService.saveWorkout(payload);
      setSavedWorkout(result);
      onSaved(result);
    } catch (err) {
      console.error('Error saving workout:', err);
    } finally {
      setSaving(false);
    }
  };

  const distanceUnit = profile?.distance_unit || 'km';
  const paceUnit = profile?.pace_unit || 'min_km';

  return (
    <div className="p-4 space-y-5 animate-fade-in max-w-xl md:max-w-2xl mx-auto">
      {/* Celebration Header & Share Button */}
      <div className="text-center pt-2 space-y-1 relative">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1 border border-emerald-200 dark:border-emerald-500/20">
          <Trophy size={14} />
          <span>WORKOUT COMPLETE</span>
        </div>
        <h2 className="font-display text-3xl font-black text-emerald-950 dark:text-white">Awesome Job! 🎉</h2>
        <p className="text-xs text-emerald-800/80 dark:text-slate-400">
          Your run has been measured and recorded. Review your performance below.
        </p>

        {/* Floating Story Share Trigger */}
        <div className="pt-2 flex justify-center">
          <button
            onClick={() => setShowShareModal(true)}
            className="py-2 px-4 rounded-full bg-[#00d09c] hover:bg-[#00ba8b] text-slate-950 font-black text-xs shadow-md shadow-[#00d09c]/25 flex items-center gap-1.5 active:scale-95 transition-all"
          >
            <Sparkles size={14} />
            <span>Share Story Card</span>
          </button>
        </div>
      </div>

      {/* Hero Big Stats Grid */}
      <div className="rounded-3xl bg-white dark:bg-gradient-to-b dark:from-slate-900 dark:to-slate-950 border border-emerald-100 dark:border-slate-800 p-5 shadow-md dark:shadow-2xl text-center">
        <div className="text-xs font-bold uppercase tracking-widest text-emerald-800/80 dark:text-slate-400 mb-1">
          TOTAL DISTANCE
        </div>
        <div className="flex items-baseline justify-center gap-2 mb-4">
          <span className="font-display text-6xl font-black text-emerald-950 dark:text-white">
            {formatDistance(workoutState.distanceMeters, distanceUnit)}
          </span>
          <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 uppercase">{distanceUnit}</span>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-emerald-100 dark:border-slate-800/80">
          <div>
            <div className="text-[10px] uppercase font-bold text-emerald-800/80 dark:text-slate-400 flex items-center justify-center gap-1">
              <Timer size={12} className="text-emerald-600 dark:text-emerald-400" />
              <span>DURATION</span>
            </div>
            <div className="font-mono text-lg font-bold text-emerald-950 dark:text-white mt-0.5">
              {formatDuration(workoutState.elapsedTime)}
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase font-bold text-emerald-800/80 dark:text-slate-400 flex items-center justify-center gap-1">
              <Gauge size={12} className="text-emerald-600 dark:text-emerald-400" />
              <span>AVG PACE</span>
            </div>
            <div className="font-mono text-lg font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
              {formatPace(workoutState.averagePace, paceUnit).replace(/\s\/\w+/, '')}
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase font-bold text-emerald-800/80 dark:text-slate-400 flex items-center justify-center gap-1">
              <Flame size={12} className="text-amber-600 dark:text-amber-400" />
              <span>CALORIES</span>
            </div>
            <div className="font-display text-lg font-black text-amber-600 dark:text-amber-400 mt-0.5">
              {workoutState.calories} kcal
            </div>
          </div>
        </div>
      </div>

      {/* Route Map Card */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-slate-400">
          YOUR ROUTE
        </h3>
        <StaticRouteMap coordinates={workoutState.coordinates} className="h-56 w-full" />
      </div>

      {/* Pace Chart */}
      <PaceChart splits={workoutState.splits} averagePaceSec={workoutState.averagePace} />

      {/* Elevation Profile if available */}
      {workoutState.coordinates.some((c) => c.altitude != null) && (
        <ElevationChart coordinates={workoutState.coordinates} />
      )}

      {/* Kilometer/Mile Splits Table */}
      <SplitsTable
        splits={workoutState.splits}
        averagePaceSec={workoutState.averagePace}
        distanceUnit={distanceUnit}
        paceUnit={paceUnit}
      />

      {/* Title & Notes Input Form */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800 p-4 space-y-3 shadow-sm">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-slate-400 mb-1">
            Workout Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Morning River Run"
            className="w-full px-3.5 py-2.5 rounded-xl bg-emerald-50/50 dark:bg-slate-950 border border-emerald-200 dark:border-slate-800 text-emerald-950 dark:text-white text-sm focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-slate-400 mb-1">
            Notes (Optional)
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Felt strong in the first 3 km, good weather..."
            className="w-full px-3.5 py-2.5 rounded-xl bg-emerald-50/50 dark:bg-slate-950 border border-emerald-200 dark:border-slate-800 text-emerald-950 dark:text-white text-sm focus:outline-none focus:border-emerald-500 resize-none"
          />
        </div>
      </div>

      {/* Bottom Action Buttons */}
      <div className="pt-2 pb-6 flex flex-col gap-3">
        {!savedWorkout ? (
          <button
            onClick={handleSaveWorkout}
            disabled={saving}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-lime-500 hover:from-emerald-600 hover:to-lime-600 active:scale-95 text-white dark:text-slate-950 font-black text-base shadow-md shadow-emerald-500/30 dark:shadow-glow-brand flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white dark:border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <CheckCircle2 size={18} />
                <span>Save Workout to InsForge</span>
              </>
            )}
          </button>
        ) : (
          <button
            onClick={onDone}
            className="w-full py-4 px-6 rounded-2xl bg-[#00d09c] hover:bg-[#00ba8b] text-slate-950 font-black text-base shadow-md shadow-[#00d09c]/25 flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <span>Done & View Dashboard</span>
            <ArrowRight size={18} />
          </button>
        )}
      </div>

      {/* Story Share Modal */}
      {showShareModal && (
        <WorkoutShareModal
          workout={{
            type: workoutState.type,
            title: title || 'Run Session',
            distance_meters: workoutState.distanceMeters,
            duration_seconds: workoutState.elapsedTime,
            average_pace: workoutState.averagePace,
            calories: workoutState.calories,
            elevation_gain: workoutState.elevationGain,
            route_coordinates: workoutState.coordinates,
            started_at: new Date(workoutState.startTime || Date.now()).toISOString(),
          }}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
};

