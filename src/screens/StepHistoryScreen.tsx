import React, { useState, useEffect, useCallback } from 'react';
import { UserProfile, Workout, WorkoutType } from '../types';
import { DayStepSummary } from '../types/dailyActivity';
import { dailyActivityService } from '../services/health/dailyActivityService';
import { useStepCounter } from '../hooks/useStepCounter';
import {
  ArrowLeft,
  Footprints,
  Flame,
  MapPin,
  Trophy,
  CheckCircle2,
  Calendar,
  TrendingUp,
  Award,
  Play,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

interface StepHistoryScreenProps {
  workouts: Workout[];
  profile: UserProfile | null;
  onBack: () => void;
  onStartRun?: (type?: WorkoutType) => void;
}

export const StepHistoryScreen: React.FC<StepHistoryScreenProps> = ({
  workouts,
  profile,
  onBack,
  onStartRun,
}) => {
  const userId = profile?.user_id || 'guest_user';
  const stepState = useStepCounter();

  const [history, setHistory] = useState<DayStepSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'achieved' | 'active'>('all');

  const stepGoal =
    profile?.daily_step_goal ||
    (typeof localStorage !== 'undefined' && Number(localStorage.getItem(`runwar_step_goal_${userId}`))) ||
    10000;

  // Load 14-day history from dailyActivityService and local storage
  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const metrics = await dailyActivityService.getTodayMetrics(userId, workouts, profile);
      if (metrics.weeklyHistory && metrics.weeklyHistory.length > 0) {
        setHistory(metrics.weeklyHistory);
      }
    } catch (e) {
      console.warn('Failed to load step history:', e);
    } finally {
      setIsLoading(false);
    }
  }, [userId, workouts, profile]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Synchronize today's latest live steps into the history
  const liveTodaySteps = Math.max(stepState.dailySteps, 0);
  const displayHistory = history.map((day, idx) => {
    if (idx === history.length - 1) {
      const todayCombined = Math.max(day.steps, liveTodaySteps);
      return {
        ...day,
        steps: todayCombined,
        isCompleted: todayCombined >= stepGoal,
      };
    }
    return {
      ...day,
      isCompleted: day.steps >= stepGoal,
    };
  });

  // Filtered history list
  const filteredHistory = displayHistory.filter((d) => {
    if (filter === 'achieved') return d.steps >= stepGoal;
    if (filter === 'active') return d.steps > 0;
    return true;
  });

  // Calculate summary metrics
  const totalSteps = displayHistory.reduce((sum, d) => sum + d.steps, 0);
  const avgSteps = displayHistory.length > 0 ? Math.round(totalSteps / displayHistory.length) : 0;
  const bestDay = displayHistory.reduce(
    (max, d) => (d.steps > max.steps ? d : max),
    displayHistory[0] || { steps: 0, date: '', dayName: '' }
  );
  const goalsHitCount = displayHistory.filter((d) => d.steps >= stepGoal).length;
  const maxStepsInHistory = Math.max(stepGoal * 1.15, ...displayHistory.map((d) => d.steps), 1000);

  // Format date helper (e.g. "Today", "Yesterday", or "Sep 26")
  const formatDayLabel = (dateStr: string, idx: number) => {
    if (idx === displayHistory.length - 1) return 'Today';
    if (idx === displayHistory.length - 2) return 'Yesterday';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[parseInt(parts[1], 10) - 1] || parts[1];
      const day = parseInt(parts[2], 10);
      return `${month} ${day}`;
    }
    return dateStr;
  };

  return (
    <div className="min-h-full bg-slate-50 dark:bg-[#121418] text-slate-900 dark:text-slate-100 p-4 sm:p-5 select-none animate-fade-in flex flex-col justify-between max-w-xl md:max-w-2xl mx-auto transition-colors duration-300 pb-16">
      <div className="space-y-4">
        {/* Top Header with Back Navigation */}
        <div className="flex items-center justify-between pt-1 pb-2">
          {/* Back to Steps button */}
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-white dark:bg-[#181C22] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-400 dark:hover:border-emerald-500/40 transition-all cursor-pointer shadow-xs active:scale-95"
            title="Back to Today's Steps"
          >
            <ArrowLeft size={16} className="text-emerald-500 shrink-0" />
            <span className="text-xs font-bold font-display">Steps</span>
          </button>

          {/* Page Title */}
          <div className="text-center">
            <h1 className="text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center justify-center gap-1.5 font-display">
              <span>Step History</span>
            </h1>
          </div>

          {/* Refresh button */}
          <button
            onClick={loadHistory}
            disabled={isLoading}
            className="w-9 h-9 rounded-2xl bg-white dark:bg-[#181C22] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 flex items-center justify-center cursor-pointer transition-all shadow-xs active:scale-95"
            title="Refresh history"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin text-emerald-500' : ''} />
          </button>
        </div>

        {/* 4 Summary Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="p-3 rounded-2xl bg-white dark:bg-[#181C22] border border-slate-200/90 dark:border-slate-800/80 flex flex-col items-center text-center shadow-xs">
            <Footprints size={17} className="text-emerald-500 mb-1" />
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Steps
            </span>
            <span className="text-sm font-black text-slate-900 dark:text-white mt-0.5 font-mono">
              {totalSteps.toLocaleString()}
            </span>
            <span className="text-[9px] text-slate-400">Past 14 Days</span>
          </div>

          <div className="p-3 rounded-2xl bg-white dark:bg-[#181C22] border border-slate-200/90 dark:border-slate-800/80 flex flex-col items-center text-center shadow-xs">
            <TrendingUp size={17} className="text-cyan-500 mb-1" />
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Daily Average
            </span>
            <span className="text-sm font-black text-slate-900 dark:text-white mt-0.5 font-mono">
              {avgSteps.toLocaleString()}
            </span>
            <span className="text-[9px] text-slate-400">steps / day</span>
          </div>

          <div className="p-3 rounded-2xl bg-white dark:bg-[#181C22] border border-slate-200/90 dark:border-slate-800/80 flex flex-col items-center text-center shadow-xs">
            <Trophy size={17} className="text-amber-500 mb-1" />
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Best Day
            </span>
            <span className="text-sm font-black text-amber-600 dark:text-amber-400 mt-0.5 font-mono">
              {bestDay.steps.toLocaleString()}
            </span>
            <span className="text-[9px] text-slate-400">{bestDay.dayName || 'Day'}</span>
          </div>

          <div className="p-3 rounded-2xl bg-white dark:bg-[#181C22] border border-slate-200/90 dark:border-slate-800/80 flex flex-col items-center text-center shadow-xs">
            <Award size={17} className="text-purple-500 mb-1" />
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Goals Hit
            </span>
            <span className="text-sm font-black text-purple-600 dark:text-purple-400 mt-0.5 font-mono">
              {goalsHitCount} / {displayHistory.length}
            </span>
            <span className="text-[9px] text-slate-400">Target: {stepGoal.toLocaleString()}</span>
          </div>
        </div>

        {/* 14-Day Visualizer Bar Chart */}
        <div className="rounded-3xl bg-white dark:bg-[#181C22] border border-slate-200/90 dark:border-slate-800/80 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Calendar size={15} />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                  14-Day Step Activity
                </h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Target goal: {stepGoal.toLocaleString()} steps/day
                </p>
              </div>
            </div>

            {selectedDayIndex !== null && displayHistory[selectedDayIndex] && (
              <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/80 px-2 py-0.5 rounded-lg border border-cyan-200 dark:border-cyan-800/60 font-mono">
                {formatDayLabel(displayHistory[selectedDayIndex].date, selectedDayIndex)}:{' '}
                {displayHistory[selectedDayIndex].steps.toLocaleString()}
              </span>
            )}
          </div>

          {/* Interactive Bars */}
          <div className="h-32 flex items-end justify-between gap-1 pt-4 pb-1 px-1 bg-slate-50/80 dark:bg-slate-950/40 rounded-2xl border border-slate-100 dark:border-slate-800/40 relative">
            {/* Target Goal Benchmark Line */}
            <div
              style={{ bottom: `${Math.min(95, (stepGoal / maxStepsInHistory) * 100)}%` }}
              className="absolute left-0 right-0 border-b border-dashed border-emerald-400/40 pointer-events-none z-10"
              title={`Goal: ${stepGoal.toLocaleString()} steps`}
            />

            {displayHistory.map((d, idx) => {
              const heightPct = Math.min(100, Math.max(6, (d.steps / maxStepsInHistory) * 100));
              const isSelected = selectedDayIndex === idx;
              const isGoalHit = d.steps >= stepGoal;
              const isToday = idx === displayHistory.length - 1;

              return (
                <div
                  key={d.date}
                  onMouseEnter={() => setSelectedDayIndex(idx)}
                  onMouseLeave={() => setSelectedDayIndex(null)}
                  onClick={() => setSelectedDayIndex(idx)}
                  className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative"
                  title={`${d.date} (${d.dayName}): ${d.steps.toLocaleString()} steps`}
                >
                  <div
                    style={{ height: `${heightPct}%` }}
                    className={`w-full rounded-t-sm transition-all duration-300 ${
                      isGoalHit
                        ? 'bg-gradient-to-t from-emerald-500 to-teal-400 dark:from-emerald-400 dark:to-teal-300 shadow-[0_0_6px_rgba(16,185,129,0.35)]'
                        : d.steps > 0
                        ? 'bg-cyan-500/80 dark:bg-cyan-400/70 hover:bg-cyan-400'
                        : 'bg-slate-200/60 dark:bg-slate-800/40'
                    } ${isSelected ? 'ring-2 ring-cyan-400 ring-offset-1 dark:ring-offset-slate-950' : ''}`}
                  />
                  <span className={`text-[8px] font-semibold mt-1 truncate max-w-full ${isToday ? 'text-emerald-500 font-bold' : 'text-slate-400'}`}>
                    {isToday ? 'Now' : d.dayName.slice(0, 1)}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 px-1">
            <span>14 Days Ago</span>
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="w-2 h-0.5 bg-emerald-400 inline-block"></span> Goal Line ({stepGoal.toLocaleString()})
            </span>
            <span>Today</span>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white dark:bg-[#181C22] border border-slate-200/90 dark:border-slate-800/80">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filter === 'all'
                  ? 'bg-emerald-500 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All ({displayHistory.length})
            </button>
            <button
              onClick={() => setFilter('achieved')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filter === 'achieved'
                  ? 'bg-emerald-500 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Goal Hit ({goalsHitCount})
            </button>
            <button
              onClick={() => setFilter('active')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filter === 'active'
                  ? 'bg-emerald-500 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Active ({displayHistory.filter((d) => d.steps > 0).length})
            </button>
          </div>
        </div>

        {/* Chronological Day-by-Day Logs List (Today first) */}
        <div className="space-y-2">
          {[...filteredHistory].reverse().map((d, revIdx) => {
            const actualIdx = displayHistory.length - 1 - revIdx;
            const isGoalHit = d.steps >= stepGoal;
            const pct = Math.min(100, Math.round((d.steps / Math.max(1, stepGoal)) * 100));

            return (
              <div
                key={d.date}
                className="p-3 rounded-2xl bg-white dark:bg-[#181C22] border border-slate-200/90 dark:border-slate-800/80 flex items-center justify-between gap-3 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
              >
                {/* Left: Date Icon & Info */}
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs ${
                      isGoalHit
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 shadow-xs'
                        : d.steps > 0
                        ? 'bg-cyan-100/70 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                    }`}
                  >
                    {isGoalHit ? <CheckCircle2 size={18} /> : <Footprints size={17} />}
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>{formatDayLabel(d.date, actualIdx)}</span>
                      <span className="text-[10px] font-normal text-slate-400">({d.dayName})</span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">{d.date}</div>
                  </div>
                </div>

                {/* Middle: Distance and Calories */}
                <div className="hidden sm:flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <MapPin size={13} className="text-teal-500" />
                    <span>{d.distanceKm} km</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Flame size={13} className="text-orange-500" />
                    <span>{d.calories} kcal</span>
                  </span>
                </div>

                {/* Right: Step Count & Achievement Badge */}
                <div className="text-right">
                  <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white font-mono">
                    {d.steps.toLocaleString()}
                  </div>
                  <div className="text-[10px] font-semibold">
                    {isGoalHit ? (
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center justify-end gap-0.5">
                        <Sparkles size={10} />
                        <span>Goal Reached</span>
                      </span>
                    ) : (
                      <span className="text-slate-400">{pct}% of goal</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Action: Start Run/Walk */}
        {onStartRun && (
          <div className="pt-2">
            <button
              onClick={() => onStartRun('run')}
              className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
            >
              <Play size={16} fill="currentColor" />
              <span>Start Activity Session</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
