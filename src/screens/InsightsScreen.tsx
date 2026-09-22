import React, { useState } from 'react';
import { UserProfile, Workout } from '../types';
import { formatDistance, formatDuration, formatPace } from '../utils/formatters';
import { TrendingUp, Flame, Timer, Zap, Calendar, Award, Footprints, ArrowUpRight, ArrowDownRight, Gauge, Filter } from 'lucide-react';

interface InsightsScreenProps {
  workouts: Workout[];
  profile: UserProfile | null;
}

type TimeFilter = '7d' | '30d' | '3m' | '6m' | '1y' | 'all';

export const InsightsScreen: React.FC<InsightsScreenProps> = ({ workouts, profile }) => {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('30d');

  const now = new Date();
  const filterCutoff = new Date();

  switch (timeFilter) {
    case '7d':
      filterCutoff.setDate(now.getDate() - 7);
      break;
    case '30d':
      filterCutoff.setDate(now.getDate() - 30);
      break;
    case '3m':
      filterCutoff.setMonth(now.getMonth() - 3);
      break;
    case '6m':
      filterCutoff.setMonth(now.getMonth() - 6);
      break;
    case '1y':
      filterCutoff.setFullYear(now.getFullYear() - 1);
      break;
    case 'all':
      filterCutoff.setFullYear(2000);
      break;
  }

  const filteredWorkouts = workouts.filter((w) => new Date(w.started_at) >= filterCutoff);

  // Compute aggregate stats
  const totalDistanceMeters = filteredWorkouts.reduce((sum, w) => sum + (w.distance_meters || 0), 0);
  const totalDurationSec = filteredWorkouts.reduce((sum, w) => sum + (w.duration_seconds || 0), 0);
  const totalCalories = filteredWorkouts.reduce((sum, w) => sum + (w.calories || 0), 0);
  const totalWorkouts = filteredWorkouts.length;
  const avgPace = totalDistanceMeters > 0 ? totalDurationSec / (totalDistanceMeters / 1000) : 0;
  const avgDistanceMeters = totalWorkouts > 0 ? totalDistanceMeters / totalWorkouts : 0;

  // Previous period comparison
  const prevCutoff = new Date(filterCutoff);
  const periodDurationMs = now.getTime() - filterCutoff.getTime();
  prevCutoff.setTime(filterCutoff.getTime() - periodDurationMs);

  const prevPeriodWorkouts = workouts.filter((w) => {
    const d = new Date(w.started_at);
    return d >= prevCutoff && d < filterCutoff;
  });
  const prevDistanceMeters = prevPeriodWorkouts.reduce((sum, w) => sum + (w.distance_meters || 0), 0);
  const distanceUnit = profile?.distance_unit || 'km';
  const paceUnit = profile?.pace_unit || 'min_km';
  const diffDistanceMeters = totalDistanceMeters - prevDistanceMeters;
  const diffDistanceConverted = distanceUnit === 'mi' ? diffDistanceMeters / 1609.34 : diffDistanceMeters / 1000;

  return (
    <div className="p-4 space-y-5 animate-fade-in">
      {/* Screen Header */}
      <div className="pt-1">
        <h2 className="font-display text-2xl font-black text-emerald-950 dark:text-white tracking-tight">
          Analytics & Insights
        </h2>
        <p className="text-xs text-emerald-800/80 dark:text-slate-400 mt-0.5">
          Track your fitness trends and progression across time
        </p>
      </div>

      {/* Grid Time Range Selector (Clean 3x2 Grid - No Horizontal Scroll) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-emerald-800/80 dark:text-slate-400 px-1">
          <span className="font-bold uppercase tracking-wider text-[10px]">TIME PERIOD</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
            {filteredWorkouts.length} sessions logged
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { id: '7d', label: '7 Days' },
            { id: '30d', label: '30 Days' },
            { id: '3m', label: '3 Months' },
            { id: '6m', label: '6 Months' },
            { id: '1y', label: '1 Year' },
            { id: 'all', label: 'All Time' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTimeFilter(tab.id as TimeFilter)}
              className={`py-2 px-2 rounded-xl text-xs font-bold transition-all text-center ${
                timeFilter === tab.id
                  ? 'bg-emerald-500 text-white dark:text-slate-950 shadow-md shadow-emerald-500/30 dark:shadow-glow-brand font-black'
                  : 'bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800 text-emerald-800 dark:text-slate-400 hover:text-emerald-950 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main KPI Card */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800 p-5 shadow-md dark:shadow-xl space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-emerald-800/80 dark:text-slate-400 tracking-wider">
              TOTAL DISTANCE ({distanceUnit.toUpperCase()})
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-display text-4xl font-black text-emerald-950 dark:text-white">
                {formatDistance(totalDistanceMeters, distanceUnit)}
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm uppercase">{distanceUnit}</span>
            </div>
          </div>

          {/* Period comparison pill */}
          {timeFilter !== 'all' && (
            <div
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                diffDistanceConverted >= 0
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30'
                  : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30'
              }`}
            >
              {diffDistanceConverted >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              <span>
                {diffDistanceConverted >= 0 ? `+${diffDistanceConverted.toFixed(1)}` : diffDistanceConverted.toFixed(1)} {distanceUnit} vs prev
              </span>
            </div>
          )}
        </div>

        {/* 4-Metric Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-emerald-100 dark:border-slate-800/80">
          <div className="bg-emerald-50/70 dark:bg-slate-950/60 p-3 rounded-2xl border border-emerald-200/60 dark:border-slate-800/60">
            <div className="text-[10px] uppercase font-bold text-emerald-800/80 dark:text-slate-400 flex items-center gap-1">
              <Timer size={12} className="text-emerald-600 dark:text-emerald-400" />
              <span>Total Time</span>
            </div>
            <div className="font-mono text-base font-bold text-emerald-950 dark:text-white mt-1">
              {formatDuration(totalDurationSec)}
            </div>
          </div>

          <div className="bg-emerald-50/70 dark:bg-slate-950/60 p-3 rounded-2xl border border-emerald-200/60 dark:border-slate-800/60">
            <div className="text-[10px] uppercase font-bold text-emerald-800/80 dark:text-slate-400 flex items-center gap-1">
              <Gauge size={12} className="text-emerald-600 dark:text-emerald-400" />
              <span>Average Pace</span>
            </div>
            <div className="font-mono text-base font-bold text-emerald-700 dark:text-emerald-400 mt-1">
              {formatPace(avgPace, paceUnit).replace(/\s\/\w+/, '')}
            </div>
          </div>

          <div className="bg-emerald-50/70 dark:bg-slate-950/60 p-3 rounded-2xl border border-emerald-200/60 dark:border-slate-800/60">
            <div className="text-[10px] uppercase font-bold text-emerald-800/80 dark:text-slate-400 flex items-center gap-1">
              <Flame size={12} className="text-amber-600 dark:text-amber-400" />
              <span>Calories</span>
            </div>
            <div className="font-display text-base font-black text-amber-600 dark:text-amber-400 mt-1">
              {totalCalories} kcal
            </div>
          </div>

          <div className="bg-emerald-50/70 dark:bg-slate-950/60 p-3 rounded-2xl border border-emerald-200/60 dark:border-slate-800/60">
            <div className="text-[10px] uppercase font-bold text-emerald-800/80 dark:text-slate-400 flex items-center gap-1">
              <Footprints size={12} className="text-sky-600 dark:text-sky-400" />
              <span>Workouts</span>
            </div>
            <div className="font-display text-base font-black text-emerald-950 dark:text-white mt-1">
              {totalWorkouts}
            </div>
          </div>
        </div>
      </div>

      {/* Distance Progression Timeline */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800 p-5 shadow-md dark:shadow-xl space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-slate-400">
          Activity Progression ({filteredWorkouts.length} Workouts)
        </h3>

        {filteredWorkouts.length === 0 ? (
          <div className="py-8 text-center text-emerald-700/80 dark:text-slate-500 text-xs">
            No workouts logged in this time range.
          </div>
        ) : (
          <div className="space-y-2 pt-1">
            {filteredWorkouts.slice(0, 8).map((w) => {
              const maxDist = Math.max(...filteredWorkouts.map((x) => x.distance_meters));
              const pct = Math.max(10, Math.min(100, (w.distance_meters / maxDist) * 100));

              return (
                <div key={w.id} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-emerald-950 dark:text-slate-300">
                      {new Date(w.started_at).toLocaleDateString([], { month: 'short', day: 'numeric' })} · {w.title || w.type}
                    </span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {formatDistance(w.distance_meters, distanceUnit)} {distanceUnit} ({formatPace(w.average_pace, paceUnit)})
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-emerald-100 dark:bg-slate-950 overflow-hidden">
                    <div
                      style={{ width: `${pct}%` }}
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-lime-400"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
