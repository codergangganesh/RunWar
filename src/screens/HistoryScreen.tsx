import React, { useState, useEffect } from 'react';
import { UserProfile, Workout, WorkoutType } from '../types';
import { formatDistance, formatDuration, formatPace, formatWorkoutDate } from '../utils/formatters';
import { RouteThumbnail } from '../components/map/RouteThumbnail';
import { BottomSheet } from '../components/ui/BottomSheet';
import {
  ArrowUpDown,
  Footprints,
  ChevronRight,
  SlidersHorizontal,
  Check,
  RotateCcw,
  RefreshCw,
  AlertCircle,
  Heart,
} from 'lucide-react';

interface HistoryScreenProps {
  workouts: Workout[];
  profile: UserProfile | null;
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => Promise<void>;
  onSelectWorkout: (workout: Workout) => void;
  onStartRun: () => void;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({
  workouts,
  profile,
  isLoading = false,
  error = null,
  onRefresh,
  onSelectWorkout,
  onStartRun,
}) => {
  const [filterType, setFilterType] = useState<WorkoutType | 'all'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'longest' | 'fastest' | 'calories'>('newest');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const [displayCount, setDisplayCount] = useState(10);

  useEffect(() => {
    setDisplayCount(10);
  }, [filterType, sortBy]);

  const distanceUnit = profile?.distance_unit || 'km';
  const paceUnit = profile?.pace_unit || 'min_km';

  // Deduplicate workouts by ID, external key, and start timestamp for safety
  const seenIds = new Set<string>();
  const seenExtKeys = new Set<string>();
  const seenTimes: number[] = [];
  const uniqueWorkouts: Workout[] = [];

  for (const w of workouts) {
    if (seenIds.has(w.id)) continue;
    if (w.source_provider && w.external_record_id) {
      const extKey = `${w.source_provider}_${w.external_record_id}`;
      if (seenExtKeys.has(extKey)) continue;
      seenExtKeys.add(extKey);
    }
    const t = new Date(w.started_at).getTime();
    if (!isNaN(t)) {
      if (seenTimes.some((st) => Math.abs(st - t) < 120 * 1000)) continue;
      seenTimes.push(t);
    }
    seenIds.add(w.id);
    uniqueWorkouts.push(w);
  }

  // Category counts
  const countAll = uniqueWorkouts.length;
  const countRun = uniqueWorkouts.filter((w) => w.type === 'run').length;
  const countJog = uniqueWorkouts.filter((w) => w.type === 'jog').length;
  const countWalk = uniqueWorkouts.filter((w) => w.type === 'walk').length;

  // Apply filters
  let filtered = uniqueWorkouts.filter((w) => {
    if (filterType !== 'all' && w.type !== filterType) return false;
    return true;
  });

  // Apply sorting
  filtered.sort((a, b) => {
    if (sortBy === 'oldest') return new Date(a.started_at).getTime() - new Date(b.started_at).getTime();
    if (sortBy === 'longest') return b.distance_meters - a.distance_meters;
    if (sortBy === 'fastest') return (a.average_pace || 9999) - (b.average_pace || 9999);
    if (sortBy === 'calories') return b.calories - a.calories;
    return new Date(b.started_at).getTime() - new Date(a.started_at).getTime();
  });

  const totalDistanceMeters = filtered.reduce((sum, w) => sum + (Number(w.distance_meters) || 0), 0);

  const getSortLabel = () => {
    switch (sortBy) {
      case 'newest': return 'Newest First';
      case 'oldest': return 'Oldest First';
      case 'longest': return 'Longest Dist';
      case 'fastest': return 'Fastest Pace';
      case 'calories': return 'Most Calories';
      default: return 'Newest First';
    }
  };

  const handleRefreshClick = async () => {
    if (onRefresh && !isManualRefreshing) {
      setIsManualRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsManualRefreshing(false);
      }
    }
  };

  const visibleWorkouts = filtered.slice(0, displayCount);

  return (
    <div className="p-3.5 sm:p-4 space-y-3.5 animate-fade-in max-w-xl md:max-w-2xl mx-auto">
      {/* Header & Aggregate metrics */}
      <div className="flex items-center justify-between pt-0.5">
        <div>
          <h2 className="font-display text-xl sm:text-2xl font-black text-emerald-950 dark:text-white tracking-tight">
            Workout History
          </h2>
          <span className="text-[11px] sm:text-xs text-emerald-800/80 dark:text-slate-400">
            {filtered.length} {filtered.length === 1 ? 'workout' : 'workouts'} ·{' '}
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
              {formatDistance(totalDistanceMeters, distanceUnit)} {distanceUnit}
            </span>
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Refresh Button */}
          {onRefresh && (
            <button
              onClick={handleRefreshClick}
              disabled={isLoading || isManualRefreshing}
              className="p-2 rounded-xl border bg-white dark:bg-slate-900 border-emerald-200 dark:border-slate-800 text-emerald-800 dark:text-slate-300 hover:text-emerald-950 dark:hover:text-white active:scale-95 transition-all disabled:opacity-50"
              title="Refresh workouts"
            >
              <RefreshCw size={14} className={isLoading || isManualRefreshing ? 'animate-spin text-emerald-500' : ''} />
            </button>
          )}

          {/* Filter Modal Trigger Button */}
          <button
            onClick={() => setShowFilterModal(true)}
            className={`py-1.5 px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all ${filterType !== 'all' || sortBy !== 'newest'
                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-700 dark:text-emerald-400 shadow-sm shadow-emerald-500/20'
                : 'bg-white dark:bg-slate-900 border-emerald-200 dark:border-slate-800 text-emerald-900 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-white'
              }`}
          >
            <SlidersHorizontal size={13} className="text-emerald-600 dark:text-emerald-400" />
            <span>Filter</span>
            {(filterType !== 'all' || sortBy !== 'newest') && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
            )}
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 flex items-center justify-between gap-2 text-xs text-rose-900 dark:text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} className="text-rose-600 dark:text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          {onRefresh && (
            <button
              onClick={handleRefreshClick}
              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] shrink-0"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Sleek, Compact Category Selector Bar */}
      <div className="p-1 rounded-2xl bg-emerald-50/80 dark:bg-slate-900 border border-emerald-200/70 dark:border-slate-800 flex items-center gap-1 shadow-sm">
        {[
          { id: 'all', label: 'All', icon: '🏃‍♂️', count: countAll },
          { id: 'run', label: 'Run', icon: '🏃', count: countRun },
          { id: 'jog', label: 'Jog', icon: '🚶', count: countJog },
          { id: 'walk', label: 'Walk', icon: '🚶‍♂️', count: countWalk },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setFilterType(item.id as any)}
            className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 ${filterType === item.id
                ? 'bg-emerald-500 text-white dark:text-slate-950 shadow-md shadow-emerald-500/25 font-black'
                : 'text-emerald-800/80 dark:text-slate-400 hover:text-emerald-950 dark:hover:text-white'
              }`}
          >
            <span className="text-xs">{item.icon}</span>
            <span className="capitalize text-[11px] sm:text-xs">{item.label}</span>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${filterType === item.id
                  ? 'bg-white/25 dark:bg-slate-950/30 text-white dark:text-slate-950 font-black'
                  : 'bg-emerald-100/70 dark:bg-slate-800 text-emerald-700 dark:text-slate-400'
                }`}
            >
              {item.count}
            </span>
          </button>
        ))}
      </div>

      {/* Quick Sort Status Badge */}
      <div className="flex items-center justify-between text-[11px] text-emerald-800/80 dark:text-slate-400 px-1">
        <span>
          Showing <strong className="text-emerald-950 dark:text-slate-300 uppercase">{filterType}</strong> ·{' '}
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{getSortLabel()}</span>
        </span>
        <button
          onClick={() => setShowFilterModal(true)}
          className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 active:scale-95"
        >
          <ArrowUpDown size={11} />
          <span>Sort</span>
        </button>
      </div>

      {/* Loading Skeleton */}
      {isLoading && workouts.length === 0 && (
        <div className="space-y-2.5 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-2xl bg-white dark:bg-slate-900/90 border border-emerald-100 dark:border-slate-800 p-3.5 h-28 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <div className="h-3.5 w-28 bg-emerald-100 dark:bg-slate-800 rounded-lg" />
                <div className="h-3.5 w-14 bg-emerald-100 dark:bg-slate-800 rounded-lg" />
              </div>
              <div className="grid grid-cols-4 gap-2 py-1">
                {[1, 2, 3, 4].map((j) => (
                  <div key={j} className="h-6 bg-emerald-50 dark:bg-slate-950 rounded-lg" />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filtered.length === 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-900/60 border border-emerald-100 dark:border-slate-800 p-6 text-center space-y-2.5 my-4 animate-scale-in shadow-sm">
          <div className="w-10 h-10 mx-auto rounded-xl bg-emerald-50 dark:bg-slate-800 text-emerald-600 dark:text-slate-500 flex items-center justify-center">
            <Footprints size={20} />
          </div>
          <h3 className="text-sm font-bold text-emerald-950 dark:text-white">
            {filterType !== 'all' ? `No ${filterType} workouts yet` : 'No workouts yet'}
          </h3>
          <p className="text-[11px] text-emerald-800/80 dark:text-slate-400 max-w-xs mx-auto">
            {filterType !== 'all'
              ? `You haven't recorded any ${filterType} sessions yet. Start tracking your first one!`
              : "You haven't logged any workouts yet. Start tracking your first activity today!"}
          </p>
          <button
            onClick={onStartRun}
            className="mt-1 py-2 px-4 rounded-xl bg-emerald-500 text-white dark:text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/30 active:scale-95 transition-all"
          >
            Start a Workout
          </button>
        </div>
      )}

      {/* Workouts Card List (Neat, Compact Styling) */}
      <div className="space-y-2.5">
        {visibleWorkouts.map((workout) => (
          <div
            key={workout.id}
            onClick={() => onSelectWorkout(workout)}
            className="rounded-2xl bg-white dark:bg-slate-900/90 border border-emerald-100 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-slate-700/80 p-3.5 shadow-sm dark:shadow-md transition-all active:scale-98 cursor-pointer space-y-2.5 group"
          >
            {/* Card Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">
                  {workout.type === 'run' ? '🏃' : workout.type === 'jog' ? '🚶' : '🚶‍♂️'}
                </span>
                <div>
                  <h4 className="text-xs font-bold text-emerald-950 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors capitalize">
                    {workout.title || `${workout.type} Session`}
                  </h4>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-emerald-700/80 dark:text-slate-400 font-medium">
                      {formatWorkoutDate(workout.started_at)}
                    </span>
                    {workout.source_provider && workout.source_provider !== 'runwar_gps' && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        {workout.source_provider === 'google_health'
                          ? 'Google Health'
                          : workout.source_provider === 'health_connect'
                            ? 'Health Connect'
                            : workout.source_provider === 'manual_import'
                              ? 'File Import'
                              : workout.source_provider}
                      </span>
                    )}
                    {workout.heart_rate_avg && workout.heart_rate_avg > 0 && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                        <Heart size={9} className="fill-current text-rose-500" />
                        {workout.heart_rate_avg} bpm
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 text-emerald-700 dark:text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                <span className="text-[10px] font-bold uppercase tracking-wider">Details</span>
                <ChevronRight size={14} />
              </div>
            </div>

            {/* Middle Stats Strip */}
            <div className="grid grid-cols-4 gap-1.5 py-1.5 border-y border-emerald-100/70 dark:border-slate-800/60 text-center bg-emerald-50/30 dark:bg-slate-950/30 rounded-xl px-1">
              <div>
                <div className="text-[8px] uppercase font-bold text-emerald-800/80 dark:text-slate-400">Distance</div>
                <div className="font-display text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {formatDistance(workout.distance_meters, distanceUnit)} {distanceUnit}
                </div>
              </div>

              <div>
                <div className="text-[8px] uppercase font-bold text-emerald-800/80 dark:text-slate-400">Time</div>
                <div className="font-mono text-xs sm:text-sm font-bold text-emerald-950 dark:text-white mt-0.5">
                  {formatDuration(workout.duration_seconds)}
                </div>
              </div>

              <div>
                <div className="text-[8px] uppercase font-bold text-emerald-800/80 dark:text-slate-400">Pace</div>
                <div className="font-mono text-xs sm:text-sm font-bold text-emerald-900 dark:text-slate-200 mt-0.5">
                  {formatPace(workout.average_pace, paceUnit).replace(/\s\/\w+/, '')}
                </div>
              </div>

              <div>
                <div className="text-[8px] uppercase font-bold text-emerald-800/80 dark:text-slate-400">Calories</div>
                <div className="font-display text-xs sm:text-sm font-black text-amber-600 dark:text-amber-400 mt-0.5">
                  {workout.calories}
                </div>
              </div>
            </div>

            {/* Route Map Preview Thumbnail */}
            {workout.route_coordinates && workout.route_coordinates.length > 1 && (
              <RouteThumbnail coordinates={workout.route_coordinates} className="h-24 w-full rounded-xl" />
            )}
          </div>
        ))}
      </div>

      {/* Load More Button */}
      {displayCount < filtered.length && (
        <button
          onClick={() => setDisplayCount((prev) => prev + 10)}
          className="w-full mt-4 py-3.5 rounded-2xl bg-emerald-50/80 hover:bg-emerald-100 dark:bg-slate-900 border border-emerald-200 dark:border-slate-800 text-emerald-800 dark:text-emerald-400 font-bold text-sm shadow-sm active:scale-98 transition-all"
        >
          Load More Activity
        </button>
      )}

      {/* Smooth Bottom Sheet for Filters & Sorting */}
      <BottomSheet
        isOpen={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        title="Filter & Sort Workouts"
        icon={<SlidersHorizontal size={18} />}
      >
        {/* Activity Type Selection */}
        <div className="space-y-2">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            Activity Type
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'all', label: 'All Activities', icon: '🏃‍♂️', count: countAll },
              { id: 'run', label: 'Runs Only', icon: '🏃', count: countRun },
              { id: 'jog', label: 'Jogs Only', icon: '🚶', count: countJog },
              { id: 'walk', label: 'Walks Only', icon: '🚶‍♂️', count: countWalk },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setFilterType(item.id as any)}
                className={`py-3 px-3 rounded-2xl text-xs font-bold flex items-center justify-between border transition-all active:scale-95 ${filterType === item.id
                    ? 'bg-emerald-500 text-white dark:text-slate-950 border-emerald-500 shadow-md shadow-emerald-500/25 font-black'
                    : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-400'
                  }`}
              >
                <span className="flex items-center gap-2">
                  <span className="text-base">{item.icon}</span>
                  <span>{item.label}</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${filterType === item.id
                        ? 'bg-white/25 dark:bg-slate-950/30 text-white dark:text-slate-950'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                  >
                    {item.count}
                  </span>
                  {filterType === item.id && <Check size={16} strokeWidth={3} />}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Sorting Selection */}
        <div className="space-y-2">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            Sort Order
          </label>
          <div className="space-y-1.5">
            {[
              { id: 'newest', label: 'Newest First (Recent Dates)' },
              { id: 'oldest', label: 'Oldest First' },
              { id: 'longest', label: 'Longest Distance' },
              { id: 'fastest', label: 'Fastest Average Pace' },
              { id: 'calories', label: 'Highest Calories Burned' },
            ].map((sortOption) => (
              <button
                key={sortOption.id}
                onClick={() => setSortBy(sortOption.id as any)}
                className={`w-full py-3 px-4 rounded-2xl text-xs font-bold flex items-center justify-between border transition-all active:scale-98 ${sortBy === sortOption.id
                    ? 'bg-emerald-500 text-white dark:text-slate-950 border-emerald-500 shadow-md shadow-emerald-500/25 font-black'
                    : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-400'
                  }`}
              >
                <span>{sortOption.label}</span>
                {sortBy === sortOption.id && <Check size={16} strokeWidth={3} />}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2.5 pt-2">
          <button
            onClick={() => {
              setFilterType('all');
              setSortBy('newest');
            }}
            className="py-3 px-4 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
          >
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>

          <button
            onClick={() => setShowFilterModal(false)}
            className="flex-1 py-3 px-4 rounded-2xl bg-[#00875a] hover:bg-[#00744d] dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-black text-xs shadow-lg shadow-emerald-700/25 active:scale-95 transition-all"
          >
            Apply & View {filtered.length} Workouts
          </button>
        </div>
      </BottomSheet>
    </div>
  );
};
