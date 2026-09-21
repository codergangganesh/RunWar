import React from 'react';
import { PersonalRecord, UserProfile, Workout } from '../types';
import { formatDistance, formatDuration, formatPace } from '../utils/formatters';
import { Trophy, Zap, Gauge, Timer, Flame, ArrowUpRight, Crown } from 'lucide-react';

interface PersonalRecordsScreenProps {
  records: PersonalRecord[];
  workouts: Workout[];
  profile: UserProfile | null;
  onSelectWorkout: (workout: Workout) => void;
}

export const PersonalRecordsScreen: React.FC<PersonalRecordsScreenProps> = ({
  records,
  workouts,
  profile,
  onSelectWorkout,
}) => {
  const prMap = new Map<string, PersonalRecord>();
  records.forEach((r) => prMap.set(r.record_type, r));

  const distanceUnit = profile?.distance_unit || 'km';
  const paceUnit = profile?.pace_unit || 'min_km';

  const prDefinitions = [
    {
      id: 'fastest_1k',
      title: 'Fastest 1 Kilometer',
      icon: Gauge,
      formatter: (val: number) => formatPace(val, paceUnit),
      subtext: 'Best 1K pace',
    },
    {
      id: 'fastest_5k',
      title: 'Fastest 5K Run',
      icon: Zap,
      formatter: (val: number) => formatPace(val, paceUnit),
      subtext: 'Average pace over 5 km',
    },
    {
      id: 'fastest_10k',
      title: 'Fastest 10K Run',
      icon: Crown,
      formatter: (val: number) => formatPace(val, paceUnit),
      subtext: 'Average pace over 10 km',
    },
    {
      id: 'longest_distance',
      title: 'Longest Single Run',
      icon: Trophy,
      formatter: (val: number) => `${formatDistance(val, distanceUnit)} ${distanceUnit}`,
      subtext: 'Greatest distance in one session',
    },
    {
      id: 'longest_duration',
      title: 'Longest Workout Duration',
      icon: Timer,
      formatter: (val: number) => formatDuration(val),
      subtext: 'Longest continuous moving time',
    },
  ];

  return (
    <div className="p-4 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="pt-1">
        <h2 className="font-display text-2xl font-black text-emerald-950 dark:text-white tracking-tight">
          Personal Records
        </h2>
        <p className="text-xs text-emerald-800/80 dark:text-slate-400 mt-0.5">
          Your all-time career benchmarks and fastest splits
        </p>
      </div>

      {/* PR Cards Grid */}
      <div className="space-y-3">
        {prDefinitions.map((def) => {
          const record = prMap.get(def.id);
          const Icon = def.icon;
          const matchingWorkout = record?.workout_id
            ? workouts.find((w) => w.id === record.workout_id)
            : null;

          return (
            <div
              key={def.id}
              className={`rounded-3xl border p-5 shadow-md dark:shadow-xl transition-all ${
                record
                  ? 'bg-white dark:bg-slate-900 border-emerald-100 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-500/50'
                  : 'bg-emerald-50/40 dark:bg-slate-900/50 border-emerald-100 dark:border-slate-800/60 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                      record
                        ? 'bg-emerald-50 dark:bg-gradient-to-tr dark:from-emerald-500/20 dark:to-lime-500/20 border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 shadow-sm'
                        : 'bg-emerald-50/50 dark:bg-slate-950 text-emerald-700/60 dark:text-slate-600'
                    }`}
                  >
                    <Icon size={22} />
                  </div>

                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800/80 dark:text-slate-400">
                      {def.title}
                    </h3>
                    {record ? (
                      <div className="font-display text-2xl font-black text-emerald-950 dark:text-white mt-0.5">
                        {def.formatter(record.value)}
                      </div>
                    ) : (
                      <div className="font-mono text-sm text-emerald-700/60 dark:text-slate-500 mt-0.5">--:--</div>
                    )}
                  </div>
                </div>

                {record && matchingWorkout && (
                  <button
                    onClick={() => onSelectWorkout(matchingWorkout)}
                    className="p-2 rounded-xl bg-emerald-50 dark:bg-slate-950 border border-emerald-200 dark:border-slate-800 text-emerald-800 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 active:scale-95 transition-all"
                    title="View workout"
                  >
                    <ArrowUpRight size={16} />
                  </button>
                )}
              </div>

              {record ? (
                <div className="flex items-center justify-between text-[11px] text-emerald-700/80 dark:text-slate-500 pt-3 border-t border-emerald-100 dark:border-slate-800/60 mt-3">
                  <span>{def.subtext}</span>
                  <span>
                    Achieved on{' '}
                    {new Date(record.achieved_at).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              ) : (
                <div className="text-[10px] text-emerald-700/60 dark:text-slate-600 pt-2 mt-2">
                  Complete workouts to unlock this personal record.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
