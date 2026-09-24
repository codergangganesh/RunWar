import React, { useState } from 'react';
import { PersonalRecord, UserProfile, Workout } from '../types';
import { formatDistance, formatDuration, formatPace } from '../utils/formatters';
import { recordsService } from '../services/recordsService';
import {
  Trophy,
  Zap,
  Gauge,
  Timer,
  Flame,
  ArrowUpRight,
  Crown,
  Mountain,
  RefreshCw,
  Award,
  Footprints,
  Sparkles,
  CheckCircle2,
  Filter,
} from 'lucide-react';

interface PersonalRecordsScreenProps {
  records: PersonalRecord[];
  workouts: Workout[];
  profile: UserProfile | null;
  onSelectWorkout: (workout: Workout) => void;
  onRefreshRecords?: () => Promise<void>;
}

export const PersonalRecordsScreen: React.FC<PersonalRecordsScreenProps> = ({
  records,
  workouts,
  profile,
  onSelectWorkout,
  onRefreshRecords,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [recalcSuccess, setRecalcSuccess] = useState<string | null>(null);

  const prMap = new Map<string, PersonalRecord>();
  records.forEach((r) => prMap.set(r.record_type, r));

  const distanceUnit = profile?.distance_unit || 'km';
  const paceUnit = profile?.pace_unit || 'min_km';

  const prDefinitions = [
    // Speed & Benchmark Records
    {
      id: 'fastest_1k',
      title: 'Fastest 1 Kilometer',
      category: 'speed',
      icon: Gauge,
      badgeColor: 'from-amber-400 to-orange-500',
      formatter: (val: number) => formatPace(val, paceUnit),
      subtext: 'Best 1K split pace',
    },
    {
      id: 'fastest_1mi',
      title: 'Fastest 1 Mile',
      category: 'speed',
      icon: Zap,
      badgeColor: 'from-yellow-400 to-amber-500',
      formatter: (val: number) => formatPace(val, paceUnit),
      subtext: 'Best pace over 1.61 km',
    },
    {
      id: 'fastest_3k',
      title: 'Fastest 3K Run',
      category: 'speed',
      icon: Flame,
      badgeColor: 'from-rose-400 to-red-500',
      formatter: (val: number) => formatPace(val, paceUnit),
      subtext: 'Best tempo pace over 3 km',
    },
    {
      id: 'fastest_5k',
      title: 'Fastest 5K Run',
      category: 'speed',
      icon: Trophy,
      badgeColor: 'from-emerald-400 to-teal-500',
      formatter: (val: number) => formatPace(val, paceUnit),
      subtext: 'Average pace over 5 km',
    },
    {
      id: 'fastest_10k',
      title: 'Fastest 10K Run',
      category: 'speed',
      icon: Crown,
      badgeColor: 'from-purple-400 to-indigo-500',
      formatter: (val: number) => formatPace(val, paceUnit),
      subtext: 'Average pace over 10 km',
    },
    {
      id: 'fastest_half_marathon',
      title: 'Half Marathon (21.1 km)',
      category: 'speed',
      icon: Award,
      badgeColor: 'from-blue-400 to-indigo-600',
      formatter: (val: number) => formatPace(val, paceUnit),
      subtext: 'Best half-marathon pace',
    },

    // Endurance & Strength Records
    {
      id: 'longest_distance',
      title: 'Longest Single Run',
      category: 'endurance',
      icon: Footprints,
      badgeColor: 'from-teal-400 to-emerald-600',
      formatter: (val: number) => `${formatDistance(val, distanceUnit)} ${distanceUnit}`,
      subtext: 'Greatest distance in one session',
    },
    {
      id: 'longest_duration',
      title: 'Longest Workout Duration',
      category: 'endurance',
      icon: Timer,
      badgeColor: 'from-sky-400 to-blue-500',
      formatter: (val: number) => formatDuration(val),
      subtext: 'Longest continuous moving time',
    },
    {
      id: 'highest_elevation',
      title: 'Highest Elevation Gain',
      category: 'endurance',
      icon: Mountain,
      badgeColor: 'from-emerald-500 to-green-600',
      formatter: (val: number) => `${Math.round(val)} m`,
      subtext: 'Most vertical ascent climbed',
    },
    {
      id: 'most_calories',
      title: 'Most Calories Burned',
      category: 'endurance',
      icon: Flame,
      badgeColor: 'from-orange-500 to-rose-600',
      formatter: (val: number) => `${Math.round(val)} kcal`,
      subtext: 'Peak workout calorie burn',
    },
    {
      id: 'max_speed',
      title: 'Peak GPS Speed',
      category: 'endurance',
      icon: Gauge,
      badgeColor: 'from-cyan-400 to-blue-600',
      formatter: (val: number) => `${Number(val).toFixed(1)} km/h`,
      subtext: 'Highest instantaneous speed recorded',
    },
  ];

  const filteredDefs = prDefinitions.filter((def) => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'speed') return def.category === 'speed';
    if (selectedFilter === 'endurance') return def.category === 'endurance';
    if (selectedFilter === 'unlocked') return prMap.has(def.id);
    if (selectedFilter === 'locked') return !prMap.has(def.id);
    return def.id === selectedFilter;
  });

  const unlockedCount = prDefinitions.filter((d) => prMap.has(d.id)).length;
  const totalCount = prDefinitions.length;
  const unlockPercentage = Math.round((unlockedCount / totalCount) * 100);

  const benchmarkDistances: Record<string, number> = {
    fastest_1k: 1000,
    fastest_1mi: 1609.34,
    fastest_3k: 3000,
    fastest_5k: 5000,
    fastest_10k: 10000,
    fastest_half_marathon: 21097.5,
  };

  const maxSingleDistanceMeters = workouts.reduce((max, w) => Math.max(max, w.distance_meters || 0), 0);

  const handleRecalculate = async () => {
    if (!profile?.user_id || isRecalculating) return;
    setIsRecalculating(true);
    setRecalcSuccess(null);

    try {
      await recordsService.recalculateAllPRs(profile.user_id, workouts);
      if (onRefreshRecords) {
        await onRefreshRecords();
      }
      setRecalcSuccess(`Successfully recalculated records across ${workouts.length} workouts!`);
      setTimeout(() => setRecalcSuccess(null), 3500);
    } catch (err: any) {
      console.warn('Error recalculating PRs:', err);
    } finally {
      setIsRecalculating(false);
    }
  };

  return (
    <div className="p-4 space-y-4 animate-fade-in max-w-xl md:max-w-2xl mx-auto">
      {/* Header with Title and Actions (Simple Dropdown + Refresh Icon) */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="min-w-0">
          <h2 className="font-display text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight whitespace-nowrap">
            Personal Records
          </h2>
          <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 mt-0.5 truncate font-medium">
            Career milestones & bests
          </p>
        </div>

        {/* Right Corner Controls: Simple Dropdown + Refresh Icon */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <Filter size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <select
              value={selectedFilter}
              onChange={(e) => setSelectedFilter(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-900 dark:text-slate-200 outline-none cursor-pointer pr-1"
              aria-label="Filter personal records"
            >
              <option value="all" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                All Records
              </option>
              <option value="speed" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                Speed & Splits
              </option>
              <option value="endurance" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                Endurance & Power
              </option>
              <option value="unlocked" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                Unlocked ({unlockedCount})
              </option>
              <option value="locked" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                In Progress ({totalCount - unlockedCount})
              </option>
            </select>
          </div>

          <button
            onClick={handleRecalculate}
            disabled={isRecalculating || workouts.length === 0}
            className="p-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-400 text-slate-700 dark:text-slate-300 active:scale-95 transition-all shadow-sm disabled:opacity-50 flex items-center justify-center shrink-0 cursor-pointer"
            title="Scan historical workouts to recalculate records"
          >
            <RefreshCw
              size={14}
              className={isRecalculating ? 'animate-spin text-emerald-500' : 'text-slate-600 dark:text-slate-400'}
            />
          </button>
        </div>
      </div>

      {/* Recalculate Banner Notification */}
      {recalcSuccess && (
        <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 text-emerald-900 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-fade-in shadow-2xs">
          <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{recalcSuccess}</span>
        </div>
      )}

      {/* Trophy Progress Summary Card */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-emerald-200/90 dark:border-slate-800 p-4 sm:p-5 shadow-sm relative overflow-hidden">
        {/* Subtle Watermark Background Icon */}
        <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-10 dark:opacity-15 pointer-events-none text-emerald-600 dark:text-emerald-400">
          <Trophy size={140} />
        </div>

        <div className="relative z-10 flex items-center justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider">
              <Trophy size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Career Showcase</span>
            </div>
            <div className="font-display text-2xl sm:text-3xl font-black text-slate-900 dark:text-white truncate">
              {unlockedCount} of {totalCount} Records
            </div>
            <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 font-medium max-w-xs">
              {unlockedCount === totalCount
                ? 'All-time legend! You have unlocked every personal record category!'
                : `Keep pushing your boundaries to unlock the remaining ${totalCount - unlockedCount} personal records.`}
            </p>
          </div>

          <div className="text-center bg-emerald-50/90 dark:bg-slate-800 border border-emerald-200 dark:border-slate-700 px-3.5 py-2.5 rounded-2xl shrink-0 shadow-2xs">
            <span className="font-display text-2xl sm:text-3xl font-black text-emerald-950 dark:text-emerald-300 block leading-tight">
              {unlockPercentage}%
            </span>
            <span className="block text-[9px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mt-0.5">
              Completed
            </span>
          </div>
        </div>

        {/* High-Contrast Bold Progress Bar */}
        <div className="mt-4 pt-3 border-t border-emerald-100/90 dark:border-slate-800 space-y-2 relative z-10">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-900 dark:text-white">Overall Career Progress</span>
            <span className="font-mono font-bold text-xs text-emerald-800 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-500/20 px-2.5 py-0.5 rounded-lg border border-emerald-300/80 dark:border-emerald-500/30">
              {unlockedCount} / {totalCount} Records ({unlockPercentage}%)
            </span>
          </div>
          <div className="h-3.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 overflow-hidden shadow-inner p-0.5">
            <div
              style={{ width: `${unlockPercentage > 0 ? Math.max(unlockPercentage, 3) : 0}%` }}
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 dark:from-emerald-400 dark:via-teal-300 dark:to-emerald-400 transition-all duration-500 shadow-xs"
            />
          </div>
        </div>
      </div>

      {/* PR Cards Grid */}
      <div className="space-y-3">
        {filteredDefs.map((def) => {
          const record = prMap.get(def.id);
          const Icon = def.icon;
          const matchingWorkout = record?.workout_id
            ? workouts.find((w) => w.id === record.workout_id)
            : null;
          const targetMeters = benchmarkDistances[def.id];
          const qualPct = targetMeters
            ? Math.min(100, Math.round((maxSingleDistanceMeters / targetMeters) * 100))
            : 0;

          return (
            <div
              key={def.id}
              className={`rounded-3xl border p-4 sm:p-5 shadow-xs transition-all ${
                record
                  ? 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 hover:border-emerald-400/60 dark:hover:border-emerald-500/50'
                  : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                      record
                        ? `bg-gradient-to-tr ${def.badgeColor} text-white`
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300/80 dark:border-slate-700'
                    }`}
                  >
                    <Icon size={22} />
                  </div>

                  <div className="min-w-0">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 block truncate">
                      {def.title}
                    </span>
                    {record ? (
                      <div className="font-display text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                        {def.formatter(record.value)}
                      </div>
                    ) : (
                      <div className="font-mono text-sm font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                        Not unlocked yet
                      </div>
                    )}
                  </div>
                </div>

                {record && matchingWorkout && (
                  <button
                    onClick={() => onSelectWorkout(matchingWorkout)}
                    className="py-1.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200 active:scale-95 transition-all text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs"
                    title="View workout"
                  >
                    <span>View Run</span>
                    <ArrowUpRight size={14} />
                  </button>
                )}
              </div>

              {record ? (
                <div className="flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-400 pt-3 border-t border-slate-200 dark:border-slate-800/80 mt-3">
                  <span className="truncate">{def.subtext}</span>
                  <span className="shrink-0 font-bold text-slate-800 dark:text-slate-200">
                    {new Date(record.achieved_at).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              ) : targetMeters ? (
                <div className="space-y-1.5 pt-3 mt-3 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      Distance Benchmark Progress
                    </span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {formatDistance(Math.min(maxSingleDistanceMeters, targetMeters), distanceUnit)} / {formatDistance(targetMeters, distanceUnit)} {distanceUnit} ({qualPct}%)
                    </span>
                  </div>
                  {/* High contrast bold progress bar for light & dark mode */}
                  <div className="h-3.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 overflow-hidden shadow-inner p-0.5">
                    <div
                      style={{ width: `${qualPct > 0 ? Math.max(qualPct, 3) : 0}%` }}
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300 shadow-sm"
                    />
                  </div>
                  <p className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">
                    Run at least {formatDistance(targetMeters, distanceUnit)} {distanceUnit} in a single session to set this benchmark.
                  </p>
                </div>
              ) : (
                <div className="text-[11px] font-medium text-slate-600 dark:text-slate-400 pt-2.5 mt-2.5 border-t border-slate-200 dark:border-slate-800">
                  Complete any workout session to establish your personal {def.title.toLowerCase()}.
                </div>
              )}
            </div>
          );
        })}

        {filteredDefs.length === 0 && (
          <div className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 p-8 text-center bg-white dark:bg-slate-900 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 mx-auto flex items-center justify-center">
              <Trophy size={24} />
            </div>
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">
              No matching records found
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-xs mx-auto">
              {selectedFilter === 'unlocked'
                ? 'No personal records unlocked yet. Go for a run to set your first benchmark!'
                : 'All records have been unlocked! Incredible effort!'}
            </p>
            <button
              onClick={() => setSelectedFilter('all')}
              className="text-xs font-bold text-emerald-600 dark:text-emerald-400 underline active:scale-95 cursor-pointer"
            >
              Show All Records
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
