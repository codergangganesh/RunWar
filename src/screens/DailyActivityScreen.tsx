import React, { useState, useEffect, useCallback } from 'react';
import { UserProfile, Workout, WorkoutType } from '../types';
import { DailyActivityMetrics } from '../types/dailyActivity';
import { dailyActivityService } from '../services/health/dailyActivityService';
import { healthService } from '../services/health/healthService';
import { StepProgressRing } from '../components/activity/StepProgressRing';
import { MetricPillCard } from '../components/activity/MetricPillCard';
import {
  Smartphone,
  Flame,
  MapPin,
  Dumbbell,
  Moon,
  Footprints,
  Scale,
  Zap,
  Activity,
  Play,
  History as HistoryIcon,
  RefreshCw,
  CheckCircle2,
  Clock,
  Sparkles,
  Sunrise,
  Sun,
  Sunset,
  Radio,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';

interface DailyActivityScreenProps {
  profile: UserProfile | null;
  workouts: Workout[];
  onStartRun: (type?: WorkoutType) => void;
  onViewHistory: () => void;
  onViewInsights?: () => void;
  onOpenProfile?: () => void;
}

export const DailyActivityScreen: React.FC<DailyActivityScreenProps> = ({
  profile,
  workouts,
  onStartRun,
  onViewHistory,
  onOpenProfile,
}) => {
  const userId = profile?.user_id || 'guest_user';

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
      source: 'local_estimate',
      isGoogleConnected: false,
    };
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);
  const [selectedHourlyBucket, setSelectedHourlyBucket] = useState<number | null>(null);
  const [connectionState, setConnectionState] = useState(healthService.getPrimaryConnectionState());
  const [hasGoogleToken, setHasGoogleToken] = useState(() => Boolean(healthService.getGoogleAccessToken()));

  // Listen to Google Health connection state changes
  useEffect(() => {
    const unsub = healthService.subscribe((state) => {
      setConnectionState(state);
    });
    return unsub;
  }, []);

  // Load fresh daily metrics from Google Health live API
  const refreshMetrics = useCallback(async (silent = false) => {
    if (!silent) setIsSyncing(true);
    try {
      const fresh = await dailyActivityService.getTodayMetrics(userId, workouts, profile);
      setMetrics(fresh);
      const isConnected = fresh.isGoogleConnected || fresh.source === 'google_health' || Boolean(healthService.getGoogleAccessToken()) || healthService.getPrimaryConnectionState().isConnected;
      setHasGoogleToken(isConnected);
      if (!silent) {
        setSyncToast('Live Google Health data updated!');
        setTimeout(() => setSyncToast(null), 2500);
      }
    } catch (e) {
      console.warn('Failed to refresh daily metrics:', e);
    } finally {
      if (!silent) setIsSyncing(false);
    }
  }, [userId, workouts, profile]);

  // On mount: restore persistent connection, listen for updates, then fetch metrics
  useEffect(() => {
    let cancelled = false;

    // Subscribe to real-time health connection updates
    const unsubscribe = healthService.subscribe((state) => {
      if (!cancelled) {
        setHasGoogleToken(state.isConnected);
      }
    });

    const init = async () => {
      const isConnected = healthService.getPrimaryConnectionState().isConnected || Boolean(healthService.getGoogleAccessToken());
      setHasGoogleToken(isConnected);
      if (!isConnected) {
        const ok = await healthService.startPersistentConnection().catch(() => false);
        if (!cancelled) setHasGoogleToken(ok);
      }
      if (!cancelled) {
        await refreshMetrics(true).catch(() => { });
      }
    };
    init();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-sync whenever workouts/profile change
  useEffect(() => {
    if (userId && userId !== 'guest_user') {
      refreshMetrics(true).catch(() => { });
    }
  }, [refreshMetrics]);

  // Connect Google Health directly from Today Dashboard
  const handleConnectGoogleHealth = async () => {
    setIsConnectingGoogle(true);
    try {
      const res = await healthService.connect('google_health', 'activity');
      if (res.success) {
        setSyncToast('Connected to Google Health! Streaming live data...');
        await refreshMetrics(false);
      } else if (res.error) {
        setSyncToast(res.error);
        setTimeout(() => setSyncToast(null), 3500);
      }
    } catch {
      setSyncToast('Connection failed. Please try again.');
      setTimeout(() => setSyncToast(null), 3000);
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  // isGoogleConnected: true whenever tokens exist, source is google_health, or connection is active
  const isGoogleConnected = hasGoogleToken || metrics.source === 'google_health' || connectionState.isConnected || metrics.isGoogleConnected;

  // Compute maximum steps in any hour for relative bar scaling
  const maxHourlySteps = Math.max(
    500,
    ...(metrics.hourlyBuckets || []).map((b) => b.steps || 0)
  );

  return (
    <div className="min-h-full bg-slate-50 dark:bg-[#121418] text-slate-900 dark:text-slate-100 p-4 sm:p-5 select-none animate-fade-in flex flex-col justify-between max-w-xl md:max-w-2xl mx-auto transition-colors duration-300 pb-12">
      <div className="space-y-4">
        {/* Top App Header */}
        <div className="flex items-center justify-between pt-1 pb-2">
          {/* Connected Device / Google Health Sync Button */}
          <button
            onClick={isGoogleConnected ? () => refreshMetrics(false) : handleConnectGoogleHealth}
            disabled={isSyncing || isConnectingGoogle}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/60 text-slate-700 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-400 dark:hover:border-emerald-500/40 cursor-pointer transition-all active:scale-95 shadow-sm"
            title={isGoogleConnected ? 'Sync live Google Health data' : 'Connect Google Health'}
          >
            <div className="relative">
              <Smartphone size={18} className="text-slate-700 dark:text-slate-300" />
              <span
                className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${isGoogleConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`}
              />
            </div>
            <span className="text-[10px] font-semibold hidden sm:inline text-slate-700 dark:text-slate-300">
              {isGoogleConnected ? 'Google Health Live' : 'Connect Google'}
            </span>
            <RefreshCw
              size={12}
              className={`text-slate-500 dark:text-slate-400 ${isSyncing || isConnectingGoogle ? 'animate-spin text-emerald-500 dark:text-emerald-400' : ''
                }`}
            />
          </button>

          {/* Title */}
          <div className="text-center">
            <h1 className="text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center justify-center gap-1.5 font-display">
              <span>Today</span>
            </h1>
          </div>

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
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-tr from-cyan-500 to-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center">
                {profile?.name?.charAt(0).toUpperCase() || 'R'}
              </div>
            )}
          </button>
        </div>

        {/* Sync Toast Feedback */}
        {syncToast && (
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 text-emerald-900 dark:text-emerald-300 text-xs flex items-center gap-2 animate-scale-in">
            <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{syncToast}</span>
          </div>
        )}


        {/* Main Dashboard Grid */}
        <div className="space-y-2.5">
          {/* Section 1: Hero Block - Step Ring + Symmetrical Metric Cards */}
          <div className="grid grid-cols-12 gap-2.5 items-stretch">
            {/* Left: Step Ring */}
            <div className="col-span-6 sm:col-span-5 flex flex-col items-center justify-center bg-white dark:bg-[#181C22] p-2.5 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm dark:shadow-inner h-full min-h-[160px]">
              <StepProgressRing
                steps={metrics.steps}
                goal={metrics.stepGoal}
                size={138}
                strokeWidth={14}
              />
            </div>

            {/* Right: Stacked 3 Symmetrical Metric Cards (Zero duplication, exact height match) */}
            <div className="col-span-6 sm:col-span-7 flex flex-col justify-between gap-2 h-full">
              <MetricPillCard
                icon={<MapPin size={16} />}
                label="Distance"
                value={`${metrics.distanceKm} km`}
                subtitle={metrics.runDistanceKm > 0 ? `(${metrics.runDistanceKm} km run)` : undefined}
                variant="teal"
                compact
                className="flex-1 flex items-center"
              />
              <MetricPillCard
                icon={<Flame size={16} />}
                label="Cal burned"
                value={metrics.caloriesBurned > 0 ? `${metrics.caloriesBurned.toLocaleString()} kcal` : '0 kcal'}
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

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* REAL-TIME GOOGLE HEALTH DATA STREAMS IN THE LOWER SECTION */}
        {/* ═══════════════════════════════════════════════════════════════ */}

        {/* If Google Health is NOT connected: Prominent Connect Action Banner */}
        {!isGoogleConnected && (
          <div className="rounded-3xl bg-gradient-to-br from-white via-cyan-50/30 to-emerald-50/40 dark:from-[#181C22] dark:via-[#16222b] dark:to-[#132220] border border-cyan-200/80 dark:border-cyan-800/60 p-5 shadow-md space-y-4 animate-fade-in">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-300/40 dark:border-cyan-700/50">
                <Radio size={22} className="animate-pulse" />
              </div>
              <div className="space-y-1">

                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Real-time Google Health Streams
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800/60">
                  Not Connected
                </span>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Connect your Google account to fetch real-time continuous steps, 24-hour hourly movement distribution, active minutes, and calories directly from Google Health sensors.
                </p>
              </div>
            </div>

            <button
              onClick={handleConnectGoogleHealth}
              disabled={isConnectingGoogle}
              className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25 active:scale-98 transition-all cursor-pointer"
            >
              {isConnectingGoogle ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Connecting to Google Health...</span>
                </>
              ) : (
                <>
                  <Radio size={16} />
                  <span>Connect Google Health</span>

                </>
              )}
            </button>
          </div>
        )}

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
            {selectedHourlyBucket !== null && metrics.hourlyBuckets?.[selectedHourlyBucket] && (
              <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/80 px-2 py-0.5 rounded-lg border border-cyan-200 dark:border-cyan-800/60">
                {metrics.hourlyBuckets[selectedHourlyBucket].label}:{' '}
                {metrics.hourlyBuckets[selectedHourlyBucket].steps.toLocaleString()} steps
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
            {(metrics.hourlyBuckets || []).map((bucket) => {
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
              {(metrics.morningSteps || 0).toLocaleString()}
            </span>
          </div>

          <div className="p-2.5 rounded-2xl bg-white dark:bg-[#181C22] border border-slate-200/90 dark:border-slate-800/80 flex flex-col items-center text-center shadow-sm">
            <Sun size={16} className="text-yellow-500 mb-1" />
            <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400">Afternoon</span>
            <span className="text-xs font-black text-slate-900 dark:text-white mt-0.5 font-mono">
              {(metrics.afternoonSteps || 0).toLocaleString()}
            </span>
          </div>

          <div className="p-2.5 rounded-2xl bg-white dark:bg-[#181C22] border border-slate-200/90 dark:border-slate-800/80 flex flex-col items-center text-center shadow-sm">
            <Sunset size={16} className="text-orange-500 mb-1" />
            <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400">Evening</span>
            <span className="text-xs font-black text-slate-900 dark:text-white mt-0.5 font-mono">
              {(metrics.eveningSteps || 0).toLocaleString()}
            </span>
          </div>

          <div className="p-2.5 rounded-2xl bg-white dark:bg-[#181C22] border border-slate-200/90 dark:border-slate-800/80 flex flex-col items-center text-center shadow-sm">
            <Moon size={16} className="text-indigo-400 mb-1" />
            <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400">Night</span>
            <span className="text-xs font-black text-slate-900 dark:text-white mt-0.5 font-mono">
              {(metrics.nightSteps || 0).toLocaleString()}
            </span>
          </div>
        </div>

        {/* 3. Google Health Live Sync Info Footer */}
        <div className="space-y-2">
          <div className="p-3 rounded-2xl bg-slate-100/70 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/60 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-2">

              <span>
                Source:{' '}
                <strong className="text-slate-900 dark:text-slate-200">
                  {metrics.source === 'google_health'
                    ? 'Google Health '
                    : isGoogleConnected
                      ? 'Google Fit Live Cloud Stream'
                      : 'RunWar Workouts'}
                </strong>
              </span>
            </div>
            <button
              onClick={() => refreshMetrics(false)}
              disabled={isSyncing}
              className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer shrink-0"
            >

              <span>Sync Now</span>
            </button>
          </div>

          {isGoogleConnected && (
            <div className="p-3 rounded-2xl bg-cyan-50/50 dark:bg-[#151D24] border border-cyan-200/50 dark:border-cyan-900/40 text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
              <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Radio size={13} className="text-cyan-500" />
                <span>Mobile Sync Note</span>
              </div>
              <p className="leading-relaxed text-[10px]">
                Your Android phone counts steps continuously via hardware sensors and uploads them to the Google Fit Cloud every 15–30 mins. To force an immediate cloud sync right now: open the <strong>Google Fit</strong> app on your mobile device and swipe down on the home screen to refresh.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
