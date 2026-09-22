export type WorkoutType = 'run' | 'jog' | 'walk';
export type UnitSystem = 'metric' | 'imperial';
export type DistanceUnit = 'km' | 'mi';
export type PaceUnit = 'min_km' | 'min_mi';
export type WeightUnit = 'kg' | 'lb';
export type ThemeMode = 'light' | 'dark' | 'system';
export type AudioFrequency = '0.5km' | '1km' | '5min' | 'off';

export type WorkoutEngineState =
  | 'IDLE'
  | 'STARTING'
  | 'ACTIVE'
  | 'PAUSED'
  | 'RESUMING'
  | 'FINISHING'
  | 'COMPLETED'
  | 'FAILED'
  | 'RECOVERING'
  | 'SYNCING';

export type GPSSignalStatus = 'searching' | 'locked' | 'weak' | 'denied' | 'lost';
export type NetworkSyncStatus = 'online' | 'offline' | 'syncing' | 'synced' | 'failed';

export interface UserProfile {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  age: number | null;
  gender: string | null;
  height: number | null; // in cm
  weight: number | null; // in kg
  distance_unit: DistanceUnit;
  pace_unit: PaceUnit;
  weight_unit: WeightUnit;
  fitness_goal: string;
  typical_workout_type: WorkoutType;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserSettings {
  id: string;
  user_id: string;
  auto_pause: boolean;
  auto_pause_threshold: number; // in seconds
  audio_coaching: boolean;
  audio_frequency: AudioFrequency;
  distance_unit: DistanceUnit;
  pace_unit: PaceUnit;
  weight_unit: WeightUnit;
  theme: ThemeMode;
  gps_accuracy_mode: 'high' | 'balanced' | 'power_save';
  notifications_enabled: boolean;
  haptics_enabled: boolean;
  updated_at: string;
}

export interface GPSCoordinate {
  latitude: number;
  longitude: number;
  altitude?: number | null;
  accuracy?: number | null;
  speed?: number | null; // in m/s
  timestamp: number; // Epoch ms
  sequence_number?: number;
  distanceFromPrevious?: number; // in meters
}

export interface WorkoutSplit {
  split_number: number;
  distance_meters: number;
  duration_seconds: number;
  pace: number; // in seconds per km (or min/km)
  speed_kmh?: number;
  elevation_diff?: number;
}

export interface WorkoutPointRecord {
  id?: string;
  workout_id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  speed: number | null;
  timestamp: string;
  sequence_number: number;
}

export interface Workout {
  id: string;
  user_id: string;
  type: WorkoutType;
  title: string | null;
  notes?: string | null;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  moving_duration_seconds?: number;
  paused_duration_seconds?: number;
  distance_meters: number;
  average_pace: number; // in seconds per km
  average_speed: number; // in km/h
  max_speed: number;
  calories: number;
  elevation_gain: number;
  elevation_loss: number;
  status: 'completed' | 'paused' | 'discarded';
  route_coordinates: GPSCoordinate[];
  splits: WorkoutSplit[];
  created_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  goal_type: 'weekly_distance' | 'monthly_distance' | 'workout_count' | 'single_run' | 'duration';
  target_value: number; // in km or count or minutes
  current_value: number;
  period: 'weekly' | 'monthly' | 'all_time';
  start_date?: string | null;
  end_date?: string | null;
  status: 'active' | 'completed' | 'paused';
  created_at: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'distance' | 'milestones' | 'consistency' | 'speed';
  requirement_type: string;
  requirement_value: number;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_id: string;
  unlocked_at: string;
  achievement?: Achievement;
}

export interface PersonalRecord {
  id: string;
  user_id: string;
  record_type: 'fastest_1k' | 'fastest_5k' | 'fastest_10k' | 'longest_distance' | 'longest_duration' | 'most_weekly_distance' | 'most_monthly_distance';
  value: number; // seconds for pace/duration, meters for distance
  workout_id: string | null;
  achieved_at: string;
}

export interface SplitToastInfo {
  kilometer: number;
  splitPace: number; // in seconds/km
  splitDuration: number; // in seconds
  diffPaceSeconds: number; // difference from previous split (negative = faster)
  timestamp: number;
}

export interface LiveWorkoutState {
  workoutId: string;
  engineState: WorkoutEngineState;
  status: 'idle' | 'countdown' | 'tracking' | 'paused' | 'finished';
  type: WorkoutType;
  startTime: number | null;
  elapsedTime: number; // total active elapsed seconds
  movingTime: number; // moving seconds when speed > 0.8 km/h
  pausedTime: number; // total paused seconds
  distanceMeters: number;
  currentPace: number; // seconds / km (rolling window)
  averagePace: number; // seconds / km
  currentSpeed: number; // km/h
  averageSpeed: number; // km/h
  maxSpeed: number;
  calories: number;
  elevationGain: number;
  elevationLoss: number;
  coordinates: GPSCoordinate[];
  splits: WorkoutSplit[];
  activeSplitToast?: SplitToastInfo | null;
  isAutoPaused: boolean;
  gpsAccuracy: number | null;
  gpsStatus: GPSSignalStatus;
  networkStatus: NetworkSyncStatus;
  lastPointTime: number | null;
  pointSequence: number;
  pendingSyncPoints: number;
  currentLocation?: GPSCoordinate | null;
}
