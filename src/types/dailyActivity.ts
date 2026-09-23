export interface DailyActivityMetrics {
  date: string; // YYYY-MM-DD
  steps: number;
  stepGoal: number;
  distanceMeters: number;
  distanceKm: number;
  caloriesBurned: number;
  calorieGoal: number;
  activeMinutes: number;
  activeMinutesGoal: number;
  exerciseDaysThisWeek: number;
  targetExerciseDays: number;
  sleepDurationMinutes: number | null;
  floorsClimbed: number;
  hourlyActiveHours: number; // e.g. 1
  targetHourlyHours: number; // e.g. 9
  weightKg: number | null;
  runDistanceMeters: number;
  runDistanceKm: number;
  heartRateAvg: number | null;
  restingHeartRate: number | null;
  heartRateMin: number | null;
  heartRateMax: number | null;
  morningSteps: number;
  afternoonSteps: number;
  eveningSteps: number;
  nightSteps: number;
  peakHour: { hour: number; label: string; steps: number } | null;
  hourlyBuckets: HourlyActivityBucket[];
  weeklyHistory: DayStepSummary[];
  lastSyncedAt: string;
  source: 'google_health' | 'fitbit' | 'device_pedometer' | 'manual' | 'local_estimate';
  isGoogleConnected?: boolean;
}

export interface HourlyActivityBucket {
  hour: number; // 0-23
  label: string; // e.g. "6 AM", "12 PM"
  steps: number;
  isActive: boolean; // >= 250 steps
}

export interface DayStepSummary {
  date: string; // YYYY-MM-DD
  dayName: string; // Mon, Tue, etc.
  steps: number;
  distanceKm: number;
  calories: number;
  isCompleted: boolean;
}
