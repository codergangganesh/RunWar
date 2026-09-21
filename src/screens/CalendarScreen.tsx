import React, { useState } from 'react';
import { UserProfile, Workout } from '../types';
import { formatDistance, formatDuration, formatPace } from '../utils/formatters';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Footprints, Flame, Timer } from 'lucide-react';

interface CalendarScreenProps {
  workouts: Workout[];
  profile: UserProfile | null;
  onSelectWorkout: (workout: Workout) => void;
}

export const CalendarScreen: React.FC<CalendarScreenProps> = ({
  workouts,
  profile,
  onSelectWorkout,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Days in month
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 is Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const adjustedFirstDay = (firstDayOfMonth + 6) % 7; // Convert 0(Sun)->6, 1(Mon)->0

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  // Map workouts by date YYYY-MM-DD
  const workoutsByDate = new Map<string, Workout[]>();
  workouts.forEach((w) => {
    const key = new Date(w.started_at).toISOString().split('T')[0];
    const existing = workoutsByDate.get(key) || [];
    existing.push(w);
    workoutsByDate.set(key, existing);
  });

  const selectedDateKey = selectedDate.toISOString().split('T')[0];
  const selectedDayWorkouts = workoutsByDate.get(selectedDateKey) || [];

  const distanceUnit = profile?.distance_unit || 'km';
  const paceUnit = profile?.pace_unit || 'min_km';

  return (
    <div className="p-4 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="pt-1">
        <h2 className="font-display text-2xl font-black text-emerald-950 dark:text-white tracking-tight">
          Activity Calendar
        </h2>
        <p className="text-xs text-emerald-800/80 dark:text-slate-400 mt-0.5">
          View workout consistency across the month
        </p>
      </div>

      {/* Calendar Card */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800 p-5 shadow-md dark:shadow-xl space-y-4">
        {/* Month Navigation */}
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-emerald-950 dark:text-white">
            {monthNames[month]} {year}
          </h3>
          <div className="flex items-center gap-1">
            <button
              onClick={prevMonth}
              className="p-1.5 rounded-xl bg-emerald-50 dark:bg-slate-950 border border-emerald-200 dark:border-slate-800 text-emerald-800 dark:text-slate-400 hover:text-emerald-950 dark:hover:text-white"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={nextMonth}
              className="p-1.5 rounded-xl bg-emerald-50 dark:bg-slate-950 border border-emerald-200 dark:border-slate-800 text-emerald-800 dark:text-slate-400 hover:text-emerald-950 dark:hover:text-white"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* Day Headers (Mon - Sun) */}
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-emerald-800/70 dark:text-slate-500 uppercase tracking-wider">
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
          <span>Sun</span>
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-1.5 pt-1">
          {/* Empty cells before start of month */}
          {Array.from({ length: adjustedFirstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="h-10 rounded-xl bg-emerald-50/30 dark:bg-slate-950/20" />
          ))}

          {/* Month day cells */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const dateObj = new Date(year, month, dayNum);
            const dateKey = dateObj.toISOString().split('T')[0];
            const dayWorkouts = workoutsByDate.get(dateKey) || [];
            const hasWorkouts = dayWorkouts.length > 0;
            const isSelected = selectedDateKey === dateKey;
            const isToday = new Date().toDateString() === dateObj.toDateString();

            return (
              <button
                key={dayNum}
                onClick={() => setSelectedDate(dateObj)}
                className={`h-10 rounded-xl flex flex-col items-center justify-center relative transition-all ${
                  isSelected
                    ? 'bg-emerald-500 text-white dark:text-slate-950 font-black shadow-md shadow-emerald-500/30 dark:shadow-glow-brand'
                    : hasWorkouts
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-bold'
                    : isToday
                    ? 'bg-emerald-100/60 dark:bg-slate-800 text-emerald-950 dark:text-white font-bold border border-emerald-300 dark:border-slate-700'
                    : 'bg-emerald-50/40 dark:bg-slate-950/60 text-emerald-800/80 dark:text-slate-400 hover:bg-emerald-100/50 dark:hover:bg-slate-800/50'
                }`}
              >
                <span className="text-xs">{dayNum}</span>
                {hasWorkouts && !isSelected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 mt-0.5" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Workouts List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-slate-400">
            {selectedDate.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
          </h3>
          <span className="text-xs text-emerald-700/80 dark:text-slate-500">
            {selectedDayWorkouts.length} {selectedDayWorkouts.length === 1 ? 'workout' : 'workouts'}
          </span>
        </div>

        {selectedDayWorkouts.length === 0 ? (
          <div className="rounded-2xl bg-white dark:bg-slate-900/50 border border-emerald-100 dark:border-slate-800/80 p-6 text-center text-emerald-700/80 dark:text-slate-500 text-xs shadow-sm">
            No activity logged on this day.
          </div>
        ) : (
          selectedDayWorkouts.map((w) => (
            <div
              key={w.id}
              onClick={() => onSelectWorkout(w)}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-500/50 active:scale-98 transition-all cursor-pointer flex items-center justify-between shadow-sm"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">
                  {w.type === 'run' ? '🏃' : w.type === 'jog' ? '🚶' : '🚶‍♂️'}
                </span>
                <div>
                  <h4 className="text-xs font-bold text-emerald-950 dark:text-white capitalize">{w.title || w.type}</h4>
                  <div className="flex items-center gap-2 text-[10px] text-emerald-700/80 dark:text-slate-400 font-mono mt-0.5">
                    <span>{formatDuration(w.duration_seconds)}</span>
                    <span>·</span>
                    <span>{formatPace(w.average_pace, paceUnit)}</span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <span className="font-display text-sm font-black text-emerald-600 dark:text-emerald-400">
                  {formatDistance(w.distance_meters, distanceUnit)} {distanceUnit}
                </span>
                <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">{w.calories} kcal</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
