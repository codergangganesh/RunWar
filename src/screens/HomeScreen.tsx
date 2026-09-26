import React, { useState, useEffect } from 'react';
import { CourseRoute, Goal, UserProfile, Workout, WorkoutType } from '../types';
import { formatDistance, formatDuration, formatPace } from '../utils/formatters';
import { formatLocalTime } from '../utils/dateUtils';
import { WeeklyBarChart } from '../components/charts/WeeklyBarChart';
import { Play, Zap, Footprints, Target, ArrowRight, Clock, Navigation, Route, Swords, Trophy, Flame } from 'lucide-react';
import { courseService } from '../services/courseService';
import { CourseModal } from '../components/workout/CourseModal';
import { ghostRivalService } from '../services/ghostRivalService';
import { GhostRivalModal } from '../components/workout/GhostRivalModal';
import { GhostRivalConfig } from '../types';
import { SocialFeedScreen } from './SocialFeedScreen';

interface HomeScreenProps {
  profile: UserProfile | null;
  isLoading?: boolean;
  todayStats: {
    totalDistanceMeters: number;
    totalDurationSeconds: number;
    totalCalories: number;
    workoutCount: number;
    avgPace: number;
    streak: { currentStreak: number; longestStreak: number };
    todayWorkouts: Workout[];
  };
  weeklyStats: {
    totalDistanceMeters: number;
    totalDurationSeconds: number;
    totalCalories: number;
    workoutCount: number;
    avgPace: number;
    dayNames: string[];
    dailyDistance: number[];
    dailyRunCounts?: number[];
  };
  workouts?: Workout[];
  activeGoals: Goal[];
  onStartRun: (type: WorkoutType) => void;
  onViewHistory: () => void;
  onViewGoals: () => void;
  onViewChallenges?: () => void;
  onViewSocialFeed?: () => void;
  onSelectWorkout: (workout: Workout) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  profile,
  isLoading = false,
  todayStats,
  weeklyStats,
  workouts,
  activeGoals,
  onStartRun,
  onViewHistory,
  onViewGoals,
  onViewChallenges,
  onViewSocialFeed,
  onSelectWorkout,
}) => {
  const [selectedActivity, setSelectedActivity] = useState<WorkoutType>(
    profile?.typical_workout_type || 'run'
  );
  const [activeCourse, setActiveCourse] = useState<CourseRoute | null>(() => courseService.getActiveCourse());
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [activeGhost, setActiveGhost] = useState<GhostRivalConfig | null>(() => ghostRivalService.getActiveGhost());
  const [showGhostModal, setShowGhostModal] = useState(false);

  useEffect(() => {
    const unsubCourse = courseService.subscribe(setActiveCourse);
    const unsubGhost = ghostRivalService.subscribe(setActiveGhost);
    return () => {
      unsubCourse();
      unsubGhost();
    };
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const greetingText = `${getGreeting()}, ${profile?.name || 'Runner'} 👋`;
  const [displayedText, setDisplayedText] = useState(() => greetingText.slice(0, 1));
  const [isTypingDone, setIsTypingDone] = useState(false);

  // Smooth typing effect without layout jump or full-text flash
  useEffect(() => {
    let i = 1;
    setDisplayedText(greetingText.slice(0, 1));
    setIsTypingDone(false);
    const timer = setInterval(() => {
      i++;
      setDisplayedText(greetingText.slice(0, i));
      if (i >= greetingText.length) {
        clearInterval(timer);
        setIsTypingDone(true);
      }
    }, 35);
    return () => clearInterval(timer);
  }, [greetingText]);

  const isFirstTimeUser = weeklyStats.workoutCount === 0 && todayStats.workoutCount === 0;
  const distanceUnit = profile?.distance_unit || 'km';
  const paceUnit = profile?.pace_unit || 'min_km';

  return (
    <div className="p-3.5 sm:p-4 space-y-3.5 animate-fade-in flex flex-col min-h-full">
      {/* Header: Single Line Welcome Greeting */}
      <div className="pt-1">
        <div className="flex items-center gap-1.5 min-w-0 h-7 sm:h-8">
          <h2 className="font-display text-lg sm:text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-700 dark:from-white dark:via-slate-100 dark:to-emerald-300 tracking-tight whitespace-nowrap truncate">
            {displayedText}
          </h2>
          <span className={`w-1.5 h-4 bg-emerald-500 dark:bg-emerald-400 rounded-full shrink-0 inline-block ${isTypingDone ? 'opacity-30' : 'animate-pulse'}`} />
        </div>
        <p className="text-[11px] sm:text-xs text-emerald-800/80 dark:text-slate-400 font-medium mt-0.5">
          Ready for your workout? Keep your momentum going!
        </p>
      </div>

      {/* Brand New User Empty State Banner */}
      {isFirstTimeUser && !isLoading && (
        <div className="rounded-2xl bg-gradient-to-br from-emerald-50 via-emerald-100/70 to-emerald-50 dark:from-emerald-950/40 dark:via-slate-900 dark:to-slate-900 border border-emerald-300/80 dark:border-emerald-500/30 p-3.5 shadow-sm dark:shadow-glow-brand relative overflow-hidden">
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Footprints size={18} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-emerald-950 dark:text-white">Start your first workout</h3>
              <p className="text-[11px] text-emerald-800 dark:text-slate-400 mt-0.5 leading-relaxed">
                Track your distance, pace, and GPS route while building your daily streaks.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Compact Today's Activity Card */}
      <div className="rounded-2xl bg-white dark:bg-slate-900/90 border border-emerald-100 dark:border-slate-800 p-3.5 shadow-md dark:shadow-xl relative overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-slate-400">
            <Zap size={13} className="text-emerald-500 dark:text-emerald-400" />
            <span>TODAY'S ACTIVITY</span>
          </div>
          <span className="text-[10px] font-medium text-emerald-700 dark:text-slate-400">
            {todayStats.workoutCount} {todayStats.workoutCount === 1 ? 'workout' : 'workouts'}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-1.5 text-center">
          <div className="bg-emerald-50/70 dark:bg-slate-950/50 p-2 rounded-xl border border-emerald-200/60 dark:border-slate-800/40">
            <div className="text-[9px] font-bold uppercase text-emerald-800/80 dark:text-slate-400">Distance</div>
            <div className="font-display text-base font-black text-emerald-950 dark:text-white mt-0.5">
              {formatDistance(todayStats.totalDistanceMeters, distanceUnit)}
            </div>
            <div className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold uppercase">{distanceUnit}</div>
          </div>

          <div className="bg-emerald-50/70 dark:bg-slate-950/50 p-2 rounded-xl border border-emerald-200/60 dark:border-slate-800/40">
            <div className="text-[9px] font-bold uppercase text-emerald-800/80 dark:text-slate-400">Time</div>
            <div className="font-mono text-base font-bold text-emerald-950 dark:text-white mt-0.5">
              {formatDuration(todayStats.totalDurationSeconds)}
            </div>
            <div className="text-[9px] text-emerald-700/80 dark:text-slate-500">duration</div>
          </div>

          <div className="bg-emerald-50/70 dark:bg-slate-950/50 p-2 rounded-xl border border-emerald-200/60 dark:border-slate-800/40">
            <div className="text-[9px] font-bold uppercase text-emerald-800/80 dark:text-slate-400">Avg Pace</div>
            <div className="font-mono text-base font-bold text-emerald-900 dark:text-slate-200 mt-0.5">
              {formatPace(todayStats.avgPace, paceUnit).replace(/\s\/\w+/, '')}
            </div>
            <div className="text-[9px] text-emerald-700/80 dark:text-slate-500">{paceUnit === 'min_mi' ? '/mi' : '/km'}</div>
          </div>

          <div className="bg-emerald-50/70 dark:bg-slate-950/50 p-2 rounded-xl border border-emerald-200/60 dark:border-slate-800/40">
            <div className="text-[9px] font-bold uppercase text-emerald-800/80 dark:text-slate-400">Calories</div>
            <div className="font-display text-base font-black text-amber-600 dark:text-amber-400 mt-0.5">
              {todayStats.totalCalories}
            </div>
            <div className="text-[9px] text-amber-700/80 dark:text-slate-500">kcal</div>
          </div>
        </div>
      </div>

      {/* QUICK START Section */}
      <div className="rounded-2xl bg-white dark:bg-gradient-to-b dark:from-slate-900/95 dark:to-slate-950 border border-emerald-100 dark:border-slate-800/90 p-3.5 shadow-md dark:shadow-xl space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-slate-400">
            QUICK START WORKOUT
          </span>

          {/* Activity Selector Pills */}
          <div className="flex items-center gap-1 p-0.5 rounded-xl bg-emerald-50 dark:bg-slate-950 border border-emerald-200 dark:border-slate-800">
            {(['run', 'jog', 'walk'] as WorkoutType[]).map((type) => (
              <button
                key={type}
                onClick={() => setSelectedActivity(type)}
                className={`py-1 px-2.5 rounded-lg text-xs font-bold capitalize transition-all active:scale-95 ${selectedActivity === type
                  ? 'bg-emerald-500 text-white dark:text-slate-950 shadow-md shadow-emerald-500/25 dark:shadow-glow-brand font-black'
                  : 'text-emerald-800 dark:text-slate-400 hover:text-emerald-950 dark:hover:text-white'
                  }`}
              >
                {type === 'run' ? '🏃 Run' : type === 'jog' ? '🚶 Jog' : '🚶‍♂️ Walk'}
              </button>
            ))}
          </div>
        </div>

        {/* Course / Route & Ghost Rival Selectors */}
        <div className="grid grid-cols-2 gap-2 pt-0.5 px-0.5">
          {/* Route Selector Pill */}
          <button
            type="button"
            onClick={() => setShowCourseModal(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer group text-left truncate ${activeCourse
              ? 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-300 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300'
              : 'bg-slate-100 dark:bg-slate-950/80 hover:bg-cyan-50 dark:hover:bg-cyan-950/30 border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300'
              }`}
          >
            <Navigation size={13} className={activeCourse ? "text-cyan-500 animate-pulse shrink-0" : "text-slate-400 group-hover:text-cyan-500 shrink-0"} />
            <span className="truncate">
              {activeCourse ? activeCourse.name : 'Route: Free'}
            </span>
          </button>

          {/* Ghost Rival Selector Pill */}
          <button
            type="button"
            onClick={() => setShowGhostModal(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer group text-left truncate ${activeGhost
              ? 'bg-violet-50 dark:bg-violet-950/40 border-violet-300 dark:border-violet-800 text-violet-700 dark:text-violet-300 shadow-2xs'
              : 'bg-slate-100 dark:bg-slate-950/80 hover:bg-violet-50 dark:hover:bg-violet-950/30 border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300'
              }`}
          >
            <Swords size={13} className={activeGhost ? "text-violet-500 animate-pulse shrink-0" : "text-slate-400 group-hover:text-violet-500 shrink-0"} />
            <span className="truncate">
              {activeGhost ? `Rival: ${activeGhost.name}` : 'Rival: Off'}
            </span>
          </button>
        </div>

        <button
          onClick={() => onStartRun(selectedActivity)}
          className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-500 hover:from-emerald-600 hover:to-emerald-500 text-white font-black text-sm shadow-md shadow-emerald-500/30 active:scale-98 flex items-center justify-center gap-2.5 transition-all cursor-pointer"
        >
          <Play size={18} fill="currentColor" />
          <span>START {selectedActivity.toUpperCase()}</span>
        </button>
      </div>

      {/* Run Goal Challenge Feature Banner */}
      {/* {onViewChallenges && (
        <div
          onClick={onViewChallenges}
          className="rounded-2xl bg-gradient-to-r from-orange-500/10 via-rose-500/10 to-amber-500/10 border border-orange-500/25 dark:border-orange-500/35 p-3.5 shadow-sm hover:border-orange-500/50 hover:shadow-md transition-all cursor-pointer group active:scale-[0.99]"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-rose-600 flex items-center justify-center text-white shadow-md shadow-orange-500/30 group-hover:scale-105 transition-transform shrink-0">
                <Trophy size={20} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-black uppercase tracking-wider text-orange-600 dark:text-orange-400">
                    Run Goal Challenge
                  </span>

                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mt-0.5 truncate">
                  Challenge a friend to a race & track live progress!
                </p>
              </div>
            </div>
          </div>
        </div>
      )} */}

      {/* War Zone Community Social Feed Dedicated Page Card */}
      {onViewSocialFeed && (
        <div
          onClick={onViewSocialFeed}
          className="rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/10 border border-emerald-500/25 dark:border-emerald-500/35 p-3.5 shadow-sm hover:border-emerald-500/50 hover:shadow-md transition-all cursor-pointer group active:scale-[0.99]"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/30 group-hover:scale-105 transition-transform shrink-0">
                <Flame size={20} className="fill-white" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    War Zone Social Feed
                  </span>

                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mt-0.5 truncate">
                  View global activity!
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Weekly Summary & Bar Chart */}
      <WeeklyBarChart
        dayNames={weeklyStats.dayNames}
        dailyDistanceMeters={weeklyStats.dailyDistance}
        dailyRunCounts={weeklyStats.dailyRunCounts}
        distanceUnit={distanceUnit}
        workouts={workouts}
        className="flex-1"
      />

      {/* Active Goal Widget */}
      {activeGoals.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-900/90 border border-emerald-100 dark:border-slate-800 p-3.5 shadow-md dark:shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-slate-400">
              <Target size={13} className="text-emerald-500 dark:text-emerald-400" />
              <span>ACTIVE GOAL</span>
            </div>
            <button
              onClick={onViewGoals}
              className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5"
            >
              <span>View All</span>
              <ArrowRight size={12} />
            </button>
          </div>

          {activeGoals.slice(0, 1).map((goal) => {
            const pct = Math.min(100, Math.round((goal.current_value / goal.target_value) * 100));
            return (
              <div key={goal.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-emerald-950 dark:text-slate-200 capitalize">
                    {goal.period} {goal.goal_type.replace('_', ' ')}
                  </span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {goal.current_value} / {goal.target_value} {goal.goal_type.includes('distance') ? 'km' : ''} ({pct}%)
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-2 w-full rounded-full bg-emerald-100 dark:bg-slate-950 overflow-hidden">
                  <div
                    style={{ width: `${pct}%` }}
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-lime-400 transition-all duration-500"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Today's Workouts List (Multiple sessions in one day) */}
      {todayStats.todayWorkouts.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-slate-400">
              Today's Sessions ({todayStats.todayWorkouts.length})
            </h3>
            <button
              onClick={onViewHistory}
              className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
            >
              View History
            </button>
          </div>

          {todayStats.todayWorkouts.map((w) => (
            <div
              key={w.id}
              onClick={() => onSelectWorkout(w)}
              className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-slate-700 active:scale-98 transition-all cursor-pointer flex items-center justify-between shadow-sm"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-lg">
                  {w.type === 'run' ? '🏃' : w.type === 'jog' ? '🚶' : '🚶‍♂️'}
                </span>
                <div>
                  <h4 className="text-xs font-bold text-emerald-950 dark:text-white capitalize">{w.title || `${w.type} Session`}</h4>
                  <div className="flex items-center gap-2 text-[10px] text-emerald-700 dark:text-slate-400 font-mono">
                    <span>{formatLocalTime(w.started_at)}</span>
                    <span>·</span>
                    <span>{formatDuration(w.duration_seconds)}</span>
                    <span>·</span>
                    <span>{formatPace(w.average_pace, paceUnit)}</span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                  {formatDistance(w.distance_meters, distanceUnit)} {distanceUnit}
                </span>
                <div className="text-[9px] text-amber-600 dark:text-amber-400 font-medium">{w.calories} kcal</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Course Route Selector Modal */}
      <CourseModal
        isOpen={showCourseModal}
        onClose={() => setShowCourseModal(false)}
        profile={profile}
        onSelectCourse={setActiveCourse}
      />

      {/* Ghost Rival Selector Modal */}
      <GhostRivalModal
        isOpen={showGhostModal}
        onClose={() => setShowGhostModal(false)}
        profile={profile}
        onSelectGhost={setActiveGhost}
      />
    </div>
  );
};
