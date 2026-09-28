import React, { useState, useEffect, useCallback } from 'react';
import { UserProfile, Workout, WorkoutType } from '../types';
import { DailyActivityMetrics } from '../types/dailyActivity';
import { dailyActivityService } from '../services/health/dailyActivityService';
import { useStepCounter } from '../hooks/useStepCounter';
import { stepCounterService } from '../services/stepCounterService';
import { StepProgressRing } from '../components/activity/StepProgressRing';
import { MetricPillCard } from '../components/activity/MetricPillCard';
import { EditStepGoalModal } from '../components/activity/EditStepGoalModal';

import { authService } from '../services/authService';
import {
  Flame,
  MapPin,
  Moon,
  Footprints,
  Zap,
  Play,
  History as HistoryIcon,
  RefreshCw,
  Clock,
  Sunrise,
  Sun,
  Sunset,
  Pencil,
} from 'lucide-react';

interface DailyActivityScreenProps {
  profile: UserProfile | null;
  workouts: Workout[];
  onStartRun: (type?: WorkoutType) => void;
  onViewHistory: () => void;
  onViewStepHistory?: () => void;
  onViewInsights?: () => void;
  onOpenProfile?: () => void;
}

export const DailyActivityScreen: React.FC<DailyActivityScreenProps> = ({
  profile,
  workouts,
  onStartRun,
  onViewHistory,
  onViewStepHistory,
  onOpenProfile,
}) => {
  const userId = profile?.user_id || 'guest_user';
  const stepState = useStepCounter();

  // Load cached metrics immediately on first frame or real 0s
  const [metrics, setMetrics] = useState<DailyActivityMetrics>(() => {
    const cached = dailyActivityService.getCachedDailyMetrics(userId);
    if (cached) return cached;
    return {
      date: new Date().toISOString().split('T')[0],
      steps: 0,
      stepGoal: 10000,
      distanceMeters: 0,
      distanceKm: 0,
      caloriesBurned: 0,
      calorieGoal: 2200,
      activeMinutes: 0,
      activeMinutesGoal: 60,
      exerciseDaysThisWeek: 0,
      targetExerciseDays: 5,
      sleepDurationMinutes: null,
      floorsClimbed: 0,
      hourlyActiveHours: 0,
      targetHourlyHours: 9,
      weightKg: profile?.weight ? Number(profile.weight) : null,
      runDistanceMeters: 0,
      runDistanceKm: 0,
      heartRateAvg: null,
      restingHeartRate: null,
      heartRateMin: null,
      heartRateMax: null,
      morningSteps: 0,
      afternoonSteps: 0,
      eveningSteps: 0,
      nightSteps: 0,
      peakHour: null,
      hourlyBuckets: [],
      weeklyHistory: [],
      lastSyncedAt: new Date().toISOString(),
      source: 'device_pedometer',
      isGoogleConnected: false,
    };
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedHourlyBucket, setSelectedHourlyBucket] = useState<number | null>(null);
  const [isEditingGoal, setIsEditingGoal] = useState(false);

  const [currentStepGoal, setCurrentStepGoal] = useState<number>(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(`runwar_step_goal_${userId}`);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    }
    return profile?.daily_step_goal || 10000;
  });

  // Save new goal locally and sync with user profile
  const handleSaveGoal = async (newGoal: number) => {
    setCurrentStepGoal(newGoal);
    setMetrics((prev) => ({ ...prev, stepGoal: newGoal }));
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`runwar_step_goal_${userId}`, String(newGoal));
    }
    if (userId && userId !== 'guest_user') {
      try {
        await authService.updateProfile(userId, { daily_step_goal: newGoal });
      } catch (err) {
        console.warn('Could not sync step goal to server profile:', err);
      }
    }
  };

  // Load fresh daily metrics from local pedometer and workout records
  const refreshMetrics = useCallback(async (silent = false) => {
    if (!silent) setIsSyncing(true);
    try {
      const fresh = await dailyActivityService.getTodayMetrics(userId, workouts, profile);
      setMetrics(fresh);
    } catch (e) {
      console.warn('Failed to refresh daily metrics:', e);
    } finally {
      if (!silent) setIsSyncing(false);
    }
  }, [userId, workouts, profile]);

  // On mount or profile change: ensure ambient tracking is active and refresh metrics
  useEffect(() => {
    stepCounterService.ensureAmbientTracking();
    refreshMetrics(true).catch(() => { });
  }, [refreshMetrics]);

  // Re-sync whenever workouts change
  useEffect(() => {
    if (userId && userId !== 'guest_user') {
      refreshMetrics(true).catch(() => { });
    }
  }, [workouts.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live authoritative steps combining hardware pedometer and workout data
  const liveTodaySteps = Math.max(stepState.dailySteps, metrics.steps);

  // Stride-based live distance calculation
  const strideMeters = profile?.height ? (Number(profile.height) * 0.415) / 100 : 0.75;
  const calculatedDistanceKm = Number(((liveTodaySteps * strideMeters) / 1000).toFixed(2));
  const liveDistanceKm = Math.max(metrics.distanceKm, calculatedDistanceKm);

  // Real-time calorie calculation
  const calculatedCalories = Math.round(liveTodaySteps * 0.04);
  const liveCalories = Math.max(metrics.caloriesBurned, calculatedCalories);

  // Segment calculation including live steps delta
  const liveDelta = Math.max(0, liveTodaySteps - metrics.steps);
  const currentHour = new Date().getHours();
  const morningSteps = (metrics.morningSteps || 0) + (currentHour >= 5 && currentHour < 12 ? liveDelta : 0);
  const afternoonSteps = (metrics.afternoonSteps || 0) + (currentHour >= 12 && currentHour < 17 ? liveDelta : 0);
  const eveningSteps = (metrics.eveningSteps || 0) + (currentHour >= 17 && currentHour < 22 ? liveDelta : 0);
  const nightSteps = (metrics.nightSteps || 0) + (currentHour < 5 || currentHour >= 22 ? liveDelta : 0);

  // Live hourly buckets with current hour updated
  const liveHourlyBuckets = (metrics.hourlyBuckets || []).map((b) => {
    if (b.hour === currentHour) {
      const updatedSteps = b.steps + liveDelta;
      return { ...b, steps: updatedSteps, isActive: updatedSteps >= 250 };
    }
    return b;
  });

  // Compute maximum steps in any hour for relative bar scaling
  const maxHourlySteps = Math.max(
    500,
    ...liveHourlyBuckets.map((b) => b.steps || 0)
  );

  return (
    <div className="min-h-full bg-slate-50 dark:bg-[#121418] text-slate-900 dark:text-slate-100 p-4 sm:p-5 select-none animate-fade-in flex flex-col justify-between max-w-xl md:max-w-2xl mx-auto transition-colors duration-300 pb-12">
      <div className="space-y-4">
        {/* Top App Header */}
        <div className="flex items-center justify-between pt-1 pb-2">
          {/* Real-time Pedometer Status & Refresh */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/60 text-slate-700 dark:text-slate-300 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${stepState.currentCadence > 0 ? 'bg-emerald-400' : 'bg-cyan-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${stepState.currentCadence > 0 ? 'bg-emerald-500' : 'bg-cyan-500'}`}></span>
            </span>
            <Footprints size={15} className="text-emerald-500 shrink-0" />
            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 font-mono">
              {stepState.currentCadence > 0 ? `${stepState.currentCadence} SPM` : 'Real-Time'}
            </span>
            <button
              onClick={() => refreshMetrics(false)}
              disabled={isSyncing}
              className="ml-1 text-slate-400 hover:text-emerald-500 transition-colors cursor-pointer"
              title="Refresh activity metrics"
            >
              <RefreshCw size={11} className={isSyncing ? 'animate-spin text-emerald-500' : ''} />
            </button>
          </div>

          {/* Title */}
          <div className="text-center">
            <h1 className="text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center justify-center gap-1.5 font-display">
              <span>Today's Steps</span>
            </h1>
          </div>

          {/* Right: Previous Steps History Icon & User Profile Avatar */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onViewStepHistory?.()}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/60 text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-400 dark:hover:border-emerald-500/40 transition-all cursor-pointer shadow-xs active:scale-95"
              title="View previous steps history"
              aria-label="View previous steps history"
            >
              <HistoryIcon size={15} className="text-emerald-500 shrink-0" />
              <span className="text-[11px] font-bold hidden sm:inline">History</span>
            </button>

            {/* User Profile Avatar */}
            <button
              onClick={onOpenProfile}
              className="w-9 h-9 rounded-full overflow-hidden border-2 border-cyan-500 dark:border-cyan-400/80 shadow-md shadow-cyan-500/20 active:scale-90 transition-all flex items-center justify-center bg-slate-200 dark:bg-slate-800"
            >
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.name || 'Athlete'}
                  className="w-full h-full object-cover"
                  loading="eager"
                  decoding="async"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-tr from-cyan-500 to-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center">
                  {profile?.name?.charAt(0).toUpperCase() || 'R'}
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Main Dashboard Grid */}
        <div className="space-y-2.5">
          {/* Section 1: Hero Block - Step Ring + Symmetrical Metric Cards */}
          <div className="grid grid-cols-12 gap-2.5 items-stretch">
            {/* Left: Step Ring (With edit goal button & click-to-edit) */}
            <div
              className="relative col-span-6 sm:col-span-5 flex flex-col items-center justify-center bg-white dark:bg-[#181C22] p-2.5 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm dark:shadow-inner h-full min-h-[160px] group/card"
            >
              {/* Quick Edit Goal Icon Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingGoal(true);
                }}
                className="absolute top-2.5 right-2.5 p-1.5 rounded-xl bg-slate-100 hover:bg-emerald-100 dark:bg-slate-800/70 dark:hover:bg-emerald-950/60 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-90"
                title="Edit daily step goal"
                aria-label="Edit daily step goal"
              >
                <Pencil size={11} />
              </button>

              <StepProgressRing
                steps={liveTodaySteps}
                goal={currentStepGoal}
                size={138}
                strokeWidth={14}
                onClick={() => {
                  if (liveTodaySteps === 0) {
                    stepCounterService.simulateSteps(50);
                  }
                }}
                onEditGoal={() => setIsEditingGoal(true)}
              />
              {liveTodaySteps === 0 && (
                <button
                  type="button"
                  onClick={() => stepCounterService.simulateSteps(50)}
                  className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 hover:underline cursor-pointer"
                >
                  Tap to test +50
                </button>
              )}
            </div>

            {/* Right: Stacked 3 Symmetrical Metric Cards */}
            <div className="col-span-6 sm:col-span-7 flex flex-col justify-between gap-2 h-full">
              <MetricPillCard
                icon={<MapPin size={16} />}
                label="Distance"
                value={`${liveDistanceKm} km`}
                subtitle={metrics.runDistanceKm > 0 ? `(${metrics.runDistanceKm} km run)` : undefined}
                variant="teal"
                compact
                className="flex-1 flex items-center"
              />
              <MetricPillCard
                icon={<Flame size={16} />}
                label="Cal burned"
                value={liveCalories > 0 ? `${liveCalories.toLocaleString()} kcal` : '0 kcal'}
                variant="teal"
                compact
                className="flex-1 flex items-center"
              />
              <MetricPillCard
                icon={<Zap size={16} />}
                label="Active time"
                value={`${metrics.activeMinutes || 0} min`}
                subtitle={metrics.activeMinutesGoal > 0 ? `of ${metrics.activeMinutesGoal}m` : undefined}
                variant="teal"
                compact
                className="flex-1 flex items-center"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons: Start Workout + Workout History */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
            onClick={() => onStartRun('run')}
            className="py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
          >
            <Play size={16} fill="currentColor" />
            <span>Start</span>
          </button>

          <button
            onClick={onViewHistory}
            className="py-3 px-4 rounded-2xl bg-white hover:bg-slate-100 dark:bg-[#181C22] dark:hover:bg-[#222730] border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm cursor-pointer"
          >
            <HistoryIcon size={16} className="text-slate-500 dark:text-slate-400" />
            <span>History</span>
          </button>
        </div>


        {/* 1. Real-time 24-Hour Hourly Activity Breakdown */}
        <div className="rounded-3xl bg-white dark:bg-[#181C22] border border-slate-200/90 dark:border-slate-800/80 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-cyan-100 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                <Clock size={16} />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                  Hourly Step Distribution
                </h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  {metrics.hourlyActiveHours} of 9 active hours completed (≥250 steps/hr)
                </p>
              </div>
            </div>
            {selectedHourlyBucket !== null && liveHourlyBuckets?.[selectedHourlyBucket] && (
              <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/80 px-2 py-0.5 rounded-lg border border-cyan-200 dark:border-cyan-800/60">
                {liveHourlyBuckets[selectedHourlyBucket].label}:{' '}
                {liveHourlyBuckets[selectedHourlyBucket].steps.toLocaleString()} steps
              </span>
            )}
          </div>

          {/* Peak hour highlight if available */}
          {metrics.peakHour && metrics.peakHour.steps > 0 && (
            <div className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 flex items-center justify-between text-xs text-amber-900 dark:text-amber-300">
              <span className="flex items-center gap-1.5 font-bold">
                <span>🔥 Peak Activity:</span>
                <span className="font-normal">
                  {metrics.peakHour.label} ({metrics.peakHour.steps.toLocaleString()} steps)
                </span>
              </span>
              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                Highest Hour
              </span>
            </div>
          )}

          {/* 24-Hour Bar Visualizer */}
          <div className="h-28 flex items-end justify-between gap-1 pt-4 pb-1 px-1 bg-slate-50/80 dark:bg-slate-950/40 rounded-2xl border border-slate-100 dark:border-slate-800/40">
            {liveHourlyBuckets.map((bucket) => {
              const heightPct = Math.min(100, Math.max(8, (bucket.steps / maxHourlySteps) * 100));
              const isSelected = selectedHourlyBucket === bucket.hour;
              const isNow = new Date().getHours() === bucket.hour;

              return (
                <div
                  key={bucket.hour}
                  onMouseEnter={() => setSelectedHourlyBucket(bucket.hour)}
                  onMouseLeave={() => setSelectedHourlyBucket(null)}
                  onClick={() => setSelectedHourlyBucket(bucket.hour)}
                  className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative"
                  title={`${bucket.label}: ${bucket.steps.toLocaleString()} steps`}
                >
                  {/* Step bar */}
                  <div
                    style={{ height: `${heightPct}%` }}
                    className={`w-full rounded-t-sm transition-all duration-300 ${bucket.isActive
                      ? 'bg-gradient-to-t from-cyan-500 to-emerald-400 dark:from-cyan-400 dark:to-emerald-300 shadow-[0_0_6px_rgba(34,211,238,0.4)]'
                      : bucket.steps > 0
                        ? 'bg-slate-300 dark:bg-slate-700 hover:bg-cyan-400'
                        : 'bg-slate-200/60 dark:bg-slate-800/40'
                      } ${isSelected ? 'ring-2 ring-cyan-400 ring-offset-1 dark:ring-offset-slate-950' : ''}`}
                  />
                  {/* Current hour dot */}
                  {isNow && <span className="w-1 h-1 rounded-full bg-cyan-500 mt-1 animate-ping" />}
                </div>
              );
            })}
          </div>

          {/* Time Legend */}
          <div className="flex justify-between text-[9px] font-semibold text-slate-400 dark:text-slate-500 px-1">
            <span>12 AM</span>
            <span>6 AM</span>
            <span>12 PM</span>
            <span>6 PM</span>
            <span>11 PM</span>
          </div>
        </div>

        {/* 2. Real-time Day Segments (Morning / Afternoon / Evening / Night) */}
        <div className="grid grid-cols-4 gap-2">
          <div className="p-2.5 rounded-2xl bg-white dark:bg-[#181C22] border border-slate-200/90 dark:border-slate-800/80 flex flex-col items-center text-center shadow-sm">
            <Sunrise size={16} className="text-amber-500 mb-1" />
            <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400">Morning</span>
            <span className="text-xs font-black text-slate-900 dark:text-white mt-0.5 font-mono">
              {morningSteps.toLocaleString()}
            </span>
          </div>

          <div className="p-2.5 rounded-2xl bg-white dark:bg-[#181C22] border border-slate-200/90 dark:border-slate-800/80 flex flex-col items-center text-center shadow-sm">
            <Sun size={16} className="text-yellow-500 mb-1" />
            <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400">Afternoon</span>
            <span className="text-xs font-black text-slate-900 dark:text-white mt-0.5 font-mono">
              {afternoonSteps.toLocaleString()}
            </span>
          </div>

          <div className="p-2.5 rounded-2xl bg-white dark:bg-[#181C22] border border-slate-200/90 dark:border-slate-800/80 flex flex-col items-center text-center shadow-sm">
            <Sunset size={16} className="text-orange-500 mb-1" />
            <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400">Evening</span>
            <span className="text-xs font-black text-slate-900 dark:text-white mt-0.5 font-mono">
              {eveningSteps.toLocaleString()}
            </span>
          </div>

          <div className="p-2.5 rounded-2xl bg-white dark:bg-[#181C22] border border-slate-200/90 dark:border-slate-800/80 flex flex-col items-center text-center shadow-sm">
            <Moon size={16} className="text-indigo-400 mb-1" />
            <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400">Night</span>
            <span className="text-xs font-black text-slate-900 dark:text-white mt-0.5 font-mono">
              {nightSteps.toLocaleString()}
            </span>
          </div>
        </div>

        {/* 3. Activity Tracker Info Footer */}
        <div className="space-y-2">
          <div className="p-3 rounded-2xl bg-white dark:bg-[#181C22] border border-slate-200/90 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>
                Tracking Source:{' '}
                <strong className="text-slate-900 dark:text-slate-200">
                  {stepState.mode === 'native_sensor'
                    ? 'Device Hardware Pedometer'
                    : stepState.mode === 'device_motion'
                    ? 'Motion Accelerometer'
                    : 'Real-Time Activity Engine'}
                </strong>
              </span>
            </div>
            <button
              onClick={() => refreshMetrics(false)}
              disabled={isSyncing}
              className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer shrink-0"
            >
              <RefreshCw size={11} className={isSyncing ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Edit Step Goal Modal */}
      <EditStepGoalModal
        isOpen={isEditingGoal}
        currentGoal={currentStepGoal}
        todaySteps={liveTodaySteps}
        onSave={handleSaveGoal}
        onClose={() => setIsEditingGoal(false)}
      />


    </div>
  );
};
