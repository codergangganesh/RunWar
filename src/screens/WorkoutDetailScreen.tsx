import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { UserProfile, Workout } from '../types';
import { workoutService, normalizeWorkout } from '../services/workoutService';
import { downloadFile, generateGPX, generateTCX, generateWorkoutsCSV } from '../utils/exportGenerators';
import { formatDistance, formatDuration, formatPace, formatSpeed } from '../utils/formatters';
import { formatLocalDateFull, formatLocalTime } from '../utils/dateUtils';
import { StaticRouteMap } from '../components/map/StaticRouteMap';
import { PaceChart } from '../components/charts/PaceChart';
import { ElevationChart } from '../components/charts/ElevationChart';
import { SplitsTable } from '../components/workout/SplitsTable';
import { WorkoutShareModal } from '../components/workout/WorkoutShareModal';
import {
  Download,
  Trash2,
  Timer,
  Gauge,
  Flame,
  Zap,
  Calendar,
  Check,
  Clock,
  ArrowDownRight,
  ArrowUpRight,
  Share2,
  Heart,
} from 'lucide-react';

interface WorkoutDetailScreenProps {
  workout: Workout;
  profile: UserProfile | null;
  onBack: () => void;
  onDeleted: (workoutId: string) => void;
}

export const WorkoutDetailScreen: React.FC<WorkoutDetailScreenProps> = ({
  workout: initialWorkout,
  profile,
  onBack,
  onDeleted,
}) => {
  const [workout, setWorkout] = useState<Workout>(() => normalizeWorkout(initialWorkout));
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exportedType, setExportedType] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  // Load detailed GPS points or splits from database if needed
  useEffect(() => {
    let isMounted = true;
    const loadFullDetails = async () => {
      if (
        (!initialWorkout.route_coordinates || initialWorkout.route_coordinates.length === 0) ||
        (!initialWorkout.splits || initialWorkout.splits.length === 0)
      ) {
        const full = await workoutService.getWorkoutDetails(initialWorkout.id);
        if (isMounted && full) {
          setWorkout(full);
        }
      }
    };
    loadFullDetails();
    return () => {
      isMounted = false;
    };
  }, [initialWorkout.id]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await workoutService.deleteWorkout(workout.id);
      onDeleted(workout.id);
    } catch (err) {
      console.error('Failed to delete workout:', err);
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleExportGPX = () => {
    const gpxContent = generateGPX(workout);
    const datePart = (workout.started_at || new Date().toISOString()).slice(0, 10);
    const distPart = (workout.distance_meters / 1000).toFixed(1) + 'km';
    const filename = `runwar_${workout.type}_${datePart}_${distPart}.gpx`;
    downloadFile(gpxContent, filename, 'application/gpx+xml');
    setExportedType('GPX');
    setTimeout(() => setExportedType(null), 3000);
  };

  const handleExportTCX = () => {
    const tcxContent = generateTCX(workout);
    const datePart = (workout.started_at || new Date().toISOString()).slice(0, 10);
    const distPart = (workout.distance_meters / 1000).toFixed(1) + 'km';
    const filename = `runwar_${workout.type}_${datePart}_${distPart}.tcx`;
    downloadFile(tcxContent, filename, 'application/vnd.garmin.tcx+xml');
    setExportedType('TCX');
    setTimeout(() => setExportedType(null), 3000);
  };

  const handleExportCSV = () => {
    const csvContent = generateWorkoutsCSV([workout]);
    const datePart = (workout.started_at || new Date().toISOString()).slice(0, 10);
    const filename = `runwar_${workout.type}_${datePart}.csv`;
    downloadFile(csvContent, filename, 'text/csv');
    setExportedType('CSV');
    setTimeout(() => setExportedType(null), 3000);
  };

  const distanceUnit = profile?.distance_unit || 'km';
  const paceUnit = profile?.pace_unit || 'min_km';
  const movingTime = workout.moving_duration_seconds || workout.duration_seconds;

  return (
    <div className="p-4 sm:p-5 space-y-4 animate-fade-in max-w-xl md:max-w-2xl mx-auto select-none">
      {/* 1. Top Header Card (Small & Professional Design) */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800 p-4 sm:p-5 shadow-sm space-y-3">
        {/* Date & Activity Type Badge */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-semibold">
              <Calendar size={13} className="text-emerald-600 dark:text-emerald-400" />
              <span>{formatLocalDateFull(workout.started_at)}</span>
            </div>
            <h2 className="font-display text-2xl font-black text-slate-950 dark:text-white capitalize">
              {workout.title || `${workout.type} Session`}
            </h2>
          </div>

          <div className="flex flex-col items-end gap-1">
            <span className="text-2xl">
              {workout.type === 'run' ? '🏃' : workout.type === 'jog' ? '🚶' : '🚶‍♂️'}
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-bold text-[10px] uppercase tracking-wider">
              {workout.type}
            </span>
          </div>
        </div>

        {/* Start & End Time Stamp Pill */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700 dark:text-slate-300 bg-emerald-50/60 dark:bg-slate-950/60 px-3.5 py-2 rounded-xl border border-emerald-100/80 dark:border-slate-800/80 w-full">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Clock size={13} className="text-emerald-600 dark:text-emerald-400" />
              <span>Started: <strong className="text-slate-950 dark:text-white">{formatLocalTime(workout.started_at)}</strong></span>
            </div>
            {workout.ended_at && (
              <div className="flex items-center gap-1.5 pl-2 border-l border-emerald-200 dark:border-slate-800">
                <span>Ended: <strong className="text-slate-950 dark:text-white">{formatLocalTime(workout.ended_at)}</strong></span>
              </div>
            )}
          </div>

          {workout.source_provider && workout.source_provider !== 'runwar_gps' && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              Synced via {workout.source_provider === 'google_health' ? 'Google Health' : workout.source_provider === 'health_connect' ? 'Health Connect' : workout.source_provider === 'manual_import' ? 'File Import' : workout.source_provider}
            </span>
          )}
        </div>

        {workout.notes && (
          <p className="text-xs text-slate-700 dark:text-slate-300 bg-emerald-50/40 dark:bg-slate-950/40 p-3 rounded-2xl border border-emerald-100 dark:border-slate-800/80 italic">
            "{workout.notes}"
          </p>
        )}

        {/* 4 Primary Metric Columns */}
        <div className="grid grid-cols-4 gap-1 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-center">
          <div>
            <div className="text-[9px] uppercase font-bold text-slate-500 dark:text-slate-400">DISTANCE</div>
            <div className="font-display text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
              {formatDistance(workout.distance_meters, distanceUnit)} {distanceUnit}
            </div>
          </div>

          <div>
            <div className="text-[9px] uppercase font-bold text-slate-500 dark:text-slate-400">DURATION</div>
            <div className="font-mono text-base sm:text-lg font-bold text-slate-950 dark:text-white mt-0.5">
              {formatDuration(workout.duration_seconds)}
            </div>
          </div>

          <div>
            <div className="text-[9px] uppercase font-bold text-slate-500 dark:text-slate-400">MOVING TIME</div>
            <div className="font-mono text-base sm:text-lg font-bold text-slate-900 dark:text-slate-200 mt-0.5">
              {formatDuration(movingTime)}
            </div>
          </div>

          <div>
            <div className="text-[9px] uppercase font-bold text-slate-500 dark:text-slate-400">AVG PACE</div>
            <div className="font-mono text-base sm:text-lg font-bold text-slate-900 dark:text-slate-200 mt-0.5">
              {workout.average_pace > 0 ? formatPace(workout.average_pace, paceUnit).replace(/\s\/\w+/, '') : '--:--'}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Secondary 4-Metrics Row */}
      <div className="grid grid-cols-4 gap-2 text-center">
        {/* Calories */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3 shadow-2xs">
          <div className="text-[7px] uppercase font-bold text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1">
            <Flame size={12} className="text-amber-500" />
            <span>CALORIES</span>
          </div>
          <div className="font-display text-sm sm:text-base font-black text-amber-500 mt-0.5">
            {workout.calories} kcal
          </div>
        </div>

        {/* Avg Speed */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3 shadow-2xs">
          <div className="text-[7px] uppercase font-bold text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1">
            <Zap size={12} className="text-emerald-500" />
            <span>AVG SPEED</span>
          </div>
          <div className="font-mono text-sm sm:text-base font-bold text-slate-950 dark:text-white mt-0.5">
            {formatSpeed(workout.average_speed, distanceUnit)} {distanceUnit}/h
          </div>
        </div>

        {/* Gain */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3 shadow-2xs">
          <div className="text-[7px] uppercase font-bold text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1">
            <ArrowUpRight size={12} className="text-sky-500" />
            <span>GAIN</span>
          </div>
          <div className="font-mono text-sm sm:text-base font-bold text-sky-600 dark:text-sky-400 mt-0.5">
            +{Math.round(workout.elevation_gain || 0)} m
          </div>
        </div>

        {/* Loss */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3 shadow-2xs">
          <div className="text-[7px] uppercase font-bold text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1">
            <ArrowDownRight size={12} className="text-indigo-500" />
            <span>LOSS</span>
          </div>
          <div className="font-mono text-sm sm:text-base font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
            -{Math.round(workout.elevation_loss || 0)} m
          </div>
        </div>
      </div>

      {/* Heart Rate Strip (if recorded) */}
      {workout.heart_rate_avg != null && workout.heart_rate_avg > 0 && (
        <div className="flex items-center justify-between p-3 rounded-2xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/30 text-rose-950 dark:text-rose-200">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <Heart size={16} className="fill-rose-500 text-rose-500" />
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">Average Heart Rate</div>
              <div className="text-[11px] text-rose-900/80 dark:text-slate-300">Recorded from connected health monitor</div>
            </div>
          </div>
          <div className="font-display text-lg font-black text-rose-600 dark:text-rose-400">
            {Math.round(workout.heart_rate_avg)} <span className="text-xs font-bold text-rose-500">BPM</span>
          </div>
        </div>
      )}

      {/* 3. Full GPS Route Map */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-0.5">
          GPS Route Map
        </h3>
        <StaticRouteMap coordinates={workout.route_coordinates || []} className="h-64 w-full" interactive={true} />
      </div>

      {/* 4. Pace Chart */}
      <PaceChart splits={workout.splits || []} averagePaceSec={workout.average_pace} />

      {/* 5. Elevation Profile */}
      {workout.route_coordinates && workout.route_coordinates.some((c) => c.altitude != null) && (
        <ElevationChart coordinates={workout.route_coordinates} />
      )}

      {/* 6. Splits Table */}
      <SplitsTable
        splits={workout.splits || []}
        averagePaceSec={workout.average_pace}
        distanceUnit={distanceUnit}
        paceUnit={paceUnit}
      />

      {/* 7. Export & Share Card Options */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800 p-3.5 sm:p-4 space-y-2.5 shadow-sm">
        <div className="flex items-center justify-between px-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Share & Export
          </span>
          {exportedType && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 animate-fade-in">
              <Check size={11} strokeWidth={3} />
              <span>Downloaded {exportedType}</span>
            </span>
          )}
        </div>

        {/* Generate Story Card */}
        <button
          onClick={() => setShowShareModal(true)}
          className="w-full py-3 px-4 rounded-xl bg-[#00d09c] hover:bg-[#00ba8b] text-slate-950 font-black text-xs shadow-sm shadow-[#00d09c]/20 flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          <Share2 size={14} strokeWidth={2.5} />
          <span>Generate Story Share Card</span>
        </button>

        {/* Minimal Compact Export Toolbar */}
        <div className="flex items-center gap-1.5 pt-0.5">
          {/* GPX (Strava) */}
          <button
            onClick={handleExportGPX}
            className="flex-1 py-2 px-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/70 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 text-[11px] font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all"
            title="Download GPX for Strava, Garmin, Nike Run Club"
          >
            <Download size={12} className="text-[#fc5200] shrink-0" />
            <span>GPX</span>
            <span className="text-[8px] font-bold px-1.5 py-0.2 rounded bg-[#fc5200]/10 dark:bg-[#fc5200]/20 text-[#fc5200] dark:text-[#ff7438]">
              Strava
            </span>
          </button>

          {/* TCX (Garmin) */}
          <button
            onClick={handleExportTCX}
            className="flex-1 py-2 px-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/70 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 text-[11px] font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all"
            title="Download TCX for Garmin Connect, Polar"
          >
            <Download size={12} className="text-sky-500 shrink-0" />
            <span>TCX</span>
            <span className="text-[8px] font-bold px-1.5 py-0.2 rounded bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400">
              Garmin
            </span>
          </button>

          {/* CSV */}
          <button
            onClick={handleExportCSV}
            className="py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/70 dark:border-slate-700/60 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-[11px] font-bold flex items-center justify-center gap-1 active:scale-95 transition-all"
            title="Download CSV spreadsheet"
          >
            <Download size={12} className="shrink-0" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* 8. Delete Workout Action */}
      <div className="pt-2 pb-6 flex justify-center">
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

      {/* Centered Delete Confirmation Popup via Portal */}
      {showDeleteConfirm &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in select-none"
            onClick={() => !deleting && setShowDeleteConfirm(false)}
          >
            <div
              className="w-full max-w-xs rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4 text-center mx-auto my-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto shadow-sm">
                <Trash2 size={22} />
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Delete this workout?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  This action cannot be undone.
                </p>
              </div>

              <div className="flex items-center gap-2.5 pt-1">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs active:scale-95 transition-all shadow-md shadow-rose-600/25 disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
