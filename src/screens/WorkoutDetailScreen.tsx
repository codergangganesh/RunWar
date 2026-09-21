import React, { useState } from 'react';
import { UserProfile, Workout } from '../types';
import { workoutService } from '../services/workoutService';
import { downloadFile, generateGPX, generateWorkoutsCSV } from '../utils/exportGenerators';
import { formatDistance, formatDuration, formatPace, formatSpeed, formatWorkoutDate } from '../utils/formatters';
import { StaticRouteMap } from '../components/map/StaticRouteMap';
import { PaceChart } from '../components/charts/PaceChart';
import { ElevationChart } from '../components/charts/ElevationChart';
import { SplitsTable } from '../components/workout/SplitsTable';
import { WorkoutShareModal } from '../components/workout/WorkoutShareModal';
import { Download, Trash2, ArrowLeft, Timer, Gauge, Flame, Mountain, Zap, Calendar, Share2, Check, Sparkles } from 'lucide-react';

interface WorkoutDetailScreenProps {
  workout: Workout;
  profile: UserProfile | null;
  onBack: () => void;
  onDeleted: (workoutId: string) => void;
}

export const WorkoutDetailScreen: React.FC<WorkoutDetailScreenProps> = ({
  workout,
  profile,
  onBack,
  onDeleted,
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exportedType, setExportedType] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await workoutService.deleteWorkout(workout.id);
      onDeleted(workout.id);
    } catch (err) {
      console.error('Failed to delete workout:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleExportGPX = () => {
    const gpxContent = generateGPX(workout);
    const filename = `runwar_${workout.type}_${workout.id.slice(0, 8)}.gpx`;
    downloadFile(gpxContent, filename, 'application/gpx+xml');
    setExportedType('GPX');
    setTimeout(() => setExportedType(null), 2500);
  };

  const handleExportCSV = () => {
    const csvContent = generateWorkoutsCSV([workout]);
    const filename = `runwar_${workout.type}_${workout.id.slice(0, 8)}.csv`;
    downloadFile(csvContent, filename, 'text/csv');
    setExportedType('CSV');
    setTimeout(() => setExportedType(null), 2500);
  };

  const distanceUnit = profile?.distance_unit || 'km';
  const paceUnit = profile?.pace_unit || 'min_km';

  return (
    <div className="p-4 space-y-5 animate-fade-in">
      {/* Top Header Card */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800 p-5 shadow-md dark:shadow-xl space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-800/80 dark:text-slate-400 font-semibold mb-1">
              <Calendar size={13} />
              <span>{formatWorkoutDate(workout.started_at)}</span>
            </div>
            <h2 className="font-display text-2xl font-black text-emerald-950 dark:text-white capitalize">
              {workout.title || `${workout.type} Workout`}
            </h2>
          </div>

          <span className="text-2xl">
            {workout.type === 'run' ? '🏃' : workout.type === 'jog' ? '🚶' : '🚶‍♂️'}
          </span>
        </div>

        {workout.notes && (
          <p className="text-xs text-emerald-900 dark:text-slate-300 bg-emerald-50/70 dark:bg-slate-950/60 p-3 rounded-2xl border border-emerald-200/60 dark:border-slate-800/80 italic">
            "{workout.notes}"
          </p>
        )}

        {/* Big Metrics Ribbon */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-emerald-100 dark:border-slate-800/80 text-center">
          <div>
            <div className="text-[10px] uppercase font-bold text-emerald-800/80 dark:text-slate-400">Distance</div>
            <div className="font-display text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
              {formatDistance(workout.distance_meters, distanceUnit)} {distanceUnit}
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase font-bold text-emerald-800/80 dark:text-slate-400">Duration</div>
            <div className="font-mono text-xl font-bold text-emerald-950 dark:text-white mt-0.5">
              {formatDuration(workout.duration_seconds)}
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase font-bold text-emerald-800/80 dark:text-slate-400">Avg Pace</div>
            <div className="font-mono text-xl font-bold text-emerald-900 dark:text-slate-200 mt-0.5">
              {formatPace(workout.average_pace, paceUnit).replace(/\s\/\w+/, '')}
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Metrics Grid */}
      <div className="grid grid-cols-3 gap-2.5 text-center">
        <div className="rounded-2xl bg-white dark:bg-slate-900/80 border border-emerald-100 dark:border-slate-800 p-3 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-emerald-800/80 dark:text-slate-400 flex items-center justify-center gap-1">
            <Flame size={12} className="text-amber-600 dark:text-amber-400" />
            <span>Calories</span>
          </div>
          <div className="font-display text-base font-black text-amber-600 dark:text-amber-400 mt-0.5">
            {workout.calories} kcal
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-900/80 border border-emerald-100 dark:border-slate-800 p-3 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-emerald-800/80 dark:text-slate-400 flex items-center justify-center gap-1">
            <Zap size={12} className="text-emerald-600 dark:text-emerald-400" />
            <span>Avg Speed</span>
          </div>
          <div className="font-mono text-base font-bold text-emerald-950 dark:text-slate-200 mt-0.5">
            {formatSpeed(workout.average_speed, distanceUnit)} {distanceUnit}/h
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-900/80 border border-emerald-100 dark:border-slate-800 p-3 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-emerald-800/80 dark:text-slate-400 flex items-center justify-center gap-1">
            <Mountain size={12} className="text-sky-600 dark:text-sky-400" />
            <span>Elevation</span>
          </div>
          <div className="font-mono text-base font-bold text-sky-600 dark:text-sky-400 mt-0.5">
            +{Math.round(workout.elevation_gain || 0)} m
          </div>
        </div>
      </div>

      {/* Full Map */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-slate-400">
          GPS Route Map
        </h3>
        <StaticRouteMap coordinates={workout.route_coordinates} className="h-64 w-full" interactive={true} />
      </div>

      {/* Pace Chart */}
      <PaceChart splits={workout.splits} averagePaceSec={workout.average_pace} />

      {/* Elevation Profile */}
      {workout.route_coordinates && workout.route_coordinates.some((c) => c.altitude != null) && (
        <ElevationChart coordinates={workout.route_coordinates} />
      )}

      {/* Splits Table */}
      <SplitsTable
        splits={workout.splits}
        averagePaceSec={workout.average_pace}
        distanceUnit={distanceUnit}
        paceUnit={paceUnit}
      />

      {/* Export & Story Card Options */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800 p-4 space-y-3 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-slate-400">
          Share & Export
        </h3>

        {/* Share Story Card Button */}
        <button
          onClick={() => setShowShareModal(true)}
          className="w-full py-3.5 px-4 rounded-2xl bg-[#00d09c] hover:bg-[#00ba8b] text-slate-950 font-black text-xs shadow-md shadow-[#00d09c]/25 flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          <Sparkles size={16} />
          <span>Generate Story Share Card</span>
        </button>

        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <button
            onClick={handleExportGPX}
            className="py-2.5 px-4 rounded-xl bg-emerald-50 dark:bg-slate-950 border border-emerald-200 dark:border-slate-800 hover:border-emerald-400 active:scale-95 text-xs font-bold text-emerald-900 dark:text-slate-200 flex items-center justify-center gap-1.5 transition-all"
          >
            {exportedType === 'GPX' ? <Check size={14} className="text-emerald-600 dark:text-emerald-400" /> : <Download size={14} />}
            <span>Export GPX</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="py-2.5 px-4 rounded-xl bg-emerald-50 dark:bg-slate-950 border border-emerald-200 dark:border-slate-800 hover:border-emerald-400 active:scale-95 text-xs font-bold text-emerald-900 dark:text-slate-200 flex items-center justify-center gap-1.5 transition-all"
          >
            {exportedType === 'CSV' ? <Check size={14} className="text-emerald-600 dark:text-emerald-400" /> : <Download size={14} />}
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Delete Workout Action */}
      <div className="pt-2 pb-6">
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full py-3.5 px-4 rounded-2xl bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 active:scale-95 text-rose-600 dark:text-rose-400 font-bold text-xs border border-rose-200 dark:border-rose-500/30 flex items-center justify-center gap-2 transition-all"
        >
          <Trash2 size={15} />
          <span>Delete This Workout</span>
        </button>
      </div>

      {/* Story Share Modal */}
      {showShareModal && (
        <WorkoutShareModal
          workout={workout}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-emerald-950/40 dark:bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-emerald-950 dark:text-white">Delete Workout?</h3>
            <p className="text-xs text-emerald-800/80 dark:text-slate-400 leading-relaxed">
              Are you sure you want to permanently delete this workout? All GPS points, splits, and records from this session will be removed from InsForge.
            </p>

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="w-full py-3 px-4 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs shadow-lg transition-all"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete Workout'}
              </button>

              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-50 dark:bg-slate-800 text-emerald-900 dark:text-slate-300 font-semibold text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
