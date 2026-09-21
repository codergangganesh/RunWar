import React, { useState } from 'react';
import { UserProfile, Workout, WorkoutType } from '../types';
import { formatDistance, formatDuration, formatPace, formatWorkoutDate } from '../utils/formatters';
import { StaticRouteMap } from '../components/map/StaticRouteMap';
import { BottomSheet } from '../components/ui/BottomSheet';
import { Filter, ArrowUpDown, Footprints, ChevronRight, SlidersHorizontal, Check, RotateCcw } from 'lucide-react';

interface HistoryScreenProps {
  workouts: Workout[];
  profile: UserProfile | null;
  onSelectWorkout: (workout: Workout) => void;
  onStartRun: () => void;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({
  workouts,
  profile,
  onSelectWorkout,
  onStartRun,
}) => {
  const [filterType, setFilterType] = useState<WorkoutType | 'all'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'longest' | 'fastest' | 'calories'>('newest');
  const [showFilterModal, setShowFilterModal] = useState(false);

  const distanceUnit = profile?.distance_unit || 'km';
  const paceUnit = profile?.pace_unit || 'min_km';

  // Apply filters
  let filtered = workouts.filter((w) => {
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

  const totalDistanceMeters = filtered.reduce((sum, w) => sum + (w.distance_meters || 0), 0);

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

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      {/* Header & Aggregate metrics */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h2 className="font-display text-2xl font-black text-emerald-950 dark:text-white tracking-tight">
            Workout History
          </h2>
          <span className="text-xs text-emerald-800/80 dark:text-slate-400">
            {filtered.length} {filtered.length === 1 ? 'workout' : 'workouts'} ·{' '}
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
              {formatDistance(totalDistanceMeters, distanceUnit)} {distanceUnit}
            </span>
          </span>
        </div>

        {/* Filter Modal Trigger Button with tap animation */}
        <button
          onClick={() => setShowFilterModal(true)}
          className={`py-2 px-3.5 rounded-2xl border text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all ${
            filterType !== 'all' || sortBy !== 'newest'
              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-700 dark:text-emerald-400 shadow-sm shadow-emerald-500/20 dark:shadow-glow-brand'
              : 'bg-white dark:bg-slate-900 border-emerald-200 dark:border-slate-800 text-emerald-900 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-white'
          }`}
        >
          <SlidersHorizontal size={14} className="text-emerald-600 dark:text-emerald-400" />
          <span>Filter & Sort</span>
          {(filterType !== 'all' || sortBy !== 'newest') && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
          )}
        </button>
      </div>

      {/* Grid Activity Type Selector (No Horizontal Scroll) */}
      <div className="grid grid-cols-4 gap-1.5">
        {[
          { id: 'all', label: 'All', icon: '🏃‍♂️' },
          { id: 'run', label: 'Run', icon: '🏃' },
          { id: 'jog', label: 'Jog', icon: '🚶' },
          { id: 'walk', label: 'Walk', icon: '🚶‍♂️' },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setFilterType(item.id as any)}
            className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition-all ${
              filterType === item.id
                ? 'bg-emerald-500 text-white dark:text-slate-950 shadow-md shadow-emerald-500/30 dark:shadow-glow-brand font-black'
                : 'bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800 text-emerald-800 dark:text-slate-400 hover:text-emerald-950 dark:hover:text-white'
            }`}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {/* Quick Sort Status Badge */}
      <div className="flex items-center justify-between text-xs text-emerald-800/80 dark:text-slate-400 px-1">
        <span className="text-[11px] text-emerald-700/80 dark:text-slate-500">
          Showing <span className="text-emerald-950 dark:text-slate-300 font-semibold">{filterType.toUpperCase()}</span> sorted by{' '}
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{getSortLabel()}</span>
        </span>
        <button
          onClick={() => setShowFilterModal(true)}
          className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 active:scale-95"
        >
          <ArrowUpDown size={12} />
          <span>Change</span>
        </button>
      </div>

      {/* Empty State */}
      {filtered.length === 0 && (
        <div className="rounded-3xl bg-white dark:bg-slate-900/60 border border-emerald-100 dark:border-slate-800 p-8 text-center space-y-3 my-8 animate-scale-in shadow-md">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-50 dark:bg-slate-800 text-emerald-600 dark:text-slate-500 flex items-center justify-center">
            <Footprints size={24} />
          </div>
          <h3 className="text-base font-bold text-emerald-950 dark:text-white">No workouts found</h3>
          <p className="text-xs text-emerald-800/80 dark:text-slate-400 max-w-xs mx-auto">
            {filterType !== 'all'
              ? `You haven't recorded any ${filterType} sessions yet.`
              : 'You haven\'t logged any workouts yet. Start tracking your first run today!'}
          </p>
          <button
            onClick={onStartRun}
            className="mt-2 py-2.5 px-5 rounded-xl bg-emerald-500 text-white dark:text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/30 dark:shadow-glow-brand active:scale-95 transition-all"
          >
            Start a Workout
          </button>
        </div>
      )}

      {/* Workouts Card List */}
      <div className="space-y-3">
        {filtered.map((workout) => (
          <div
            key={workout.id}
            onClick={() => onSelectWorkout(workout)}
            className="rounded-3xl bg-white dark:bg-slate-900/90 border border-emerald-100 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-slate-700/80 p-4 shadow-md dark:shadow-lg transition-all active:scale-98 cursor-pointer space-y-3 group"
          >
            {/* Card Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">
                  {workout.type === 'run' ? '🏃' : workout.type === 'jog' ? '🚶' : '🚶‍♂️'}
                </span>
                <div>
                  <h4 className="text-xs font-bold text-emerald-950 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    {workout.title || `${workout.type.toUpperCase()} Run`}
                  </h4>
                  <span className="text-[10px] text-emerald-700/80 dark:text-slate-400">
                    {formatWorkoutDate(workout.started_at)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 text-emerald-700 dark:text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                <span className="text-[11px] font-semibold">Details</span>
                <ChevronRight size={15} />
              </div>
            </div>

            {/* Middle Stats Strip */}
            <div className="grid grid-cols-4 gap-2 py-2 border-y border-emerald-100 dark:border-slate-800/60 text-center">
              <div>
                <div className="text-[9px] uppercase font-bold text-emerald-800/80 dark:text-slate-400">Distance</div>
                <div className="font-display text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {formatDistance(workout.distance_meters, distanceUnit)} {distanceUnit}
                </div>
              </div>

              <div>
                <div className="text-[9px] uppercase font-bold text-emerald-800/80 dark:text-slate-400">Time</div>
                <div className="font-mono text-sm font-bold text-emerald-950 dark:text-white mt-0.5">
                  {formatDuration(workout.duration_seconds)}
                </div>
              </div>

              <div>
                <div className="text-[9px] uppercase font-bold text-emerald-800/80 dark:text-slate-400">Pace</div>
                <div className="font-mono text-sm font-bold text-emerald-900 dark:text-slate-200 mt-0.5">
                  {formatPace(workout.average_pace, paceUnit).replace(/\s\/\w+/, '')}
                </div>
              </div>

              <div>
                <div className="text-[9px] uppercase font-bold text-emerald-800/80 dark:text-slate-400">Calories</div>
                <div className="font-display text-sm font-black text-amber-600 dark:text-amber-400 mt-0.5">
                  {workout.calories}
                </div>
              </div>
            </div>

            {/* Route Map Preview Thumbnail */}
            {workout.route_coordinates && workout.route_coordinates.length > 1 && (
              <StaticRouteMap coordinates={workout.route_coordinates} className="h-28 w-full" />
            )}
          </div>
        ))}
      </div>

      {/* Smooth Bottom Sheet for Filters & Sorting */}
      <BottomSheet
        isOpen={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        title="Filter & Sort Workouts"
        icon={<SlidersHorizontal size={18} />}
      >
        {/* Activity Type Selection */}
        <div className="space-y-2">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-slate-400">
            Activity Type
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'all', label: 'All Activities', icon: '🏃‍♂️' },
              { id: 'run', label: 'Runs Only', icon: '🏃' },
              { id: 'jog', label: 'Jogs Only', icon: '🚶' },
              { id: 'walk', label: 'Walks Only', icon: '🚶‍♂️' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setFilterType(item.id as any)}
                className={`py-3 px-3 rounded-2xl text-xs font-bold flex items-center justify-between border transition-all active:scale-95 ${
                  filterType === item.id
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-700 dark:text-emerald-400 shadow-sm shadow-emerald-500/20 dark:shadow-glow-brand'
                    : 'bg-emerald-50/50 dark:bg-slate-950 border-emerald-200 dark:border-slate-800 text-emerald-800 dark:text-slate-400 hover:text-emerald-950 dark:hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </span>
                {filterType === item.id && <Check size={16} />}
              </button>
            ))}
          </div>
        </div>

        {/* Sorting Selection */}
        <div className="space-y-2">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-slate-400">
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
                className={`w-full py-3 px-4 rounded-2xl text-xs font-bold flex items-center justify-between border transition-all active:scale-98 ${
                  sortBy === sortOption.id
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-700 dark:text-emerald-400 shadow-sm shadow-emerald-500/20 dark:shadow-glow-brand'
                    : 'bg-emerald-50/50 dark:bg-slate-950 border-emerald-200 dark:border-slate-800 text-emerald-800 dark:text-slate-400 hover:text-emerald-950 dark:hover:text-white'
                }`}
              >
                <span>{sortOption.label}</span>
                {sortBy === sortOption.id && <Check size={16} />}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={() => {
              setFilterType('all');
              setSortBy('newest');
            }}
            className="py-3.5 px-4 rounded-2xl bg-emerald-100 dark:bg-slate-800 hover:bg-emerald-200 dark:hover:bg-slate-750 text-emerald-900 dark:text-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
          >
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>

          <button
            onClick={() => setShowFilterModal(false)}
            className="flex-1 py-3.5 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white dark:text-slate-950 font-black text-xs shadow-md shadow-emerald-500/30 dark:shadow-glow-brand active:scale-95 transition-all"
          >
            Apply & View {filtered.length} Runs
          </button>
        </div>
      </BottomSheet>
    </div>
  );
};
