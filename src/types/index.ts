export type WorkoutType = 'run' | 'jog' | 'walk';
export type UnitSystem = 'metric' | 'imperial';
export type DistanceUnit = 'km' | 'mi';
export type PaceUnit = 'min_km' | 'min_mi';
export type WeightUnit = 'kg' | 'lb';
export type ThemeMode = 'light' | 'dark' | 'system';
export type AudioFrequency = '0.5km' | '1km' | '5min' | 'off';
export type PocketUnlockMode = 'both' | 'hold' | 'swipe';

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
  firebase_uid?: string | null;
  phone_number?: string | null;
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
  pinned_achievements?: string[];
  created_at: string;
  updated_at: string;
}

export interface GearItem {
  id: string;
  user_id: string;
  name: string;
  brand: string;
  model: string;
  max_distance_meters: number; // e.g. 500,000 for 500km
  current_distance_meters: number;
  is_active: boolean;
  image_url?: string | null;
  notes?: string;
  created_at: string;
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
  pocket_unlock_mode?: PocketUnlockMode;
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

export type HealthProviderType = 'runwar_gps' | 'google_health' | 'health_connect' | 'strava' | 'manual_import';

export interface HealthConnectionState {
  provider: HealthProviderType;
  isConnected: boolean;
  lastSyncAt: string | null;
  syncedCount: number;
  accountEmail?: string | null;
  status: 'disconnected' | 'connecting' | 'connected' | 'syncing' | 'error';
  errorMessage?: string | null;
  syncProgress?: {
    current: number;
    total: number;
    newlySynced: number;
    currentTitle?: string;
  } | null;
}

export interface WeatherSnapshot {
  temperature: number; // in Celsius
  apparentTemperature?: number; // "feels like" in Celsius
  conditionText: string; // e.g. "Sunny", "Partly Cloudy", "Light Rain"
  conditionCode: number; // WMO code
  icon: string; // 'sun' | 'cloud-sun' | 'cloud' | 'cloud-rain' | 'cloud-lightning' | 'cloud-snow' | 'wind'
  humidity: number; // percentage
  windSpeedKmh: number; // km/h
  windDirectionDegrees?: number;
  isDay: boolean;
  timestamp: number;
}

export interface AudioCoachConfig {
  isEnabled: boolean;
  frequency: AudioFrequency;
  voiceURI?: string | null;
  rate: number; // 0.8 - 1.5, default 1.05
  pitch: number; // 0.8 - 1.2, default 1.0
  volume: number; // 0.0 - 1.0, default 1.0
  enableSoundEffects: boolean; // audio chimes & bells
  enableHaptics: boolean; // vibrational cues
}

export interface WakeLockStatus {
  isSupported: boolean;
  isActive: boolean;
  error?: string | null;
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
  weather?: WeatherSnapshot | null;
  source_provider?: HealthProviderType;
  external_record_id?: string | null;
  heart_rate_avg?: number | null;
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
  rarity?: 'common' | 'rare' | 'epic' | 'legendary';
  xp?: number;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_id: string;
  unlocked_at: string;
  achievement?: Achievement;
}

export type PersonalRecordType =
  | 'fastest_1k'
  | 'fastest_1mi'
  | 'fastest_3k'
  | 'fastest_5k'
  | 'fastest_10k'
  | 'fastest_half_marathon'
  | 'longest_distance'
  | 'longest_duration'
  | 'highest_elevation'
  | 'most_calories'
  | 'max_speed'
  | 'most_weekly_distance'
  | 'most_monthly_distance';

export interface PersonalRecord {
  id: string;
  user_id: string;
  record_type: PersonalRecordType | string;
  value: number; // seconds for pace/duration, meters for distance/elevation, calories, etc.
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

export interface CoursePoint {
  latitude: number;
  longitude: number;
  altitude?: number | null;
  distanceFromStartMeters: number;
}

export interface CourseWaypoint {
  name: string;
  latitude: number;
  longitude: number;
  type?: string;
  description?: string;
}

export interface CourseRoute {
  id: string;
  name: string;
  description?: string;
  totalDistanceMeters: number;
  elevationGainMeters: number;
  elevationLossMeters: number;
  points: CoursePoint[];
  waypoints?: CourseWaypoint[];
  createdAt: string;
  source: 'imported_gpx' | 'saved_workout' | 'preset';
  originalFileName?: string;
}

export interface CourseNavProgress {
  courseId: string;
  courseName: string;
  totalDistanceMeters: number;
  distanceRemainingMeters: number;
  percentCompleted: number;
  offCourseDistanceMeters: number;
  isOffCourse: boolean;
  closestPointIndex: number;
  nearestCoursePoint: CoursePoint;
  bearingToCourseDegrees?: number;
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
  weather?: WeatherSnapshot | null;
  activeCourse?: CourseRoute | null;
  courseProgress?: CourseNavProgress | null;
  ghostRival?: GhostRivalConfig | null;
  ghostProgress?: GhostRivalProgress | null;
}

export type GhostRivalType = 'target_pace' | 'previous_workout';

export interface GhostRivalConfig {
  id: string;
  name: string;
  type: GhostRivalType;
  targetPaceSecondsPerKm: number; // e.g. 300 for 5:00 min/km
  targetDistanceMeters?: number; // optional target distance, e.g. 5000
  previousWorkoutId?: string;
  previousWorkoutTitle?: string;
  previousWorkoutDate?: string;
  previousCoordinates?: GPSCoordinate[];
}

export interface GhostRivalProgress {
  config: GhostRivalConfig;
  ghostDistanceMeters: number;
  runnerDistanceMeters: number;
  deltaMeters: number; // positive = runner ahead, negative = ghost ahead
  deltaSeconds: number; // estimated seconds ahead or behind
  isRunnerAhead: boolean;
  ghostPaceSecondsPerKm: number;
  ghostCoordinate?: GPSCoordinate | null; // calculated marker on map
  percentCompleted?: number; // if targetDistanceMeters is set
}

