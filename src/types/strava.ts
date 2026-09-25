import { HealthConnectionState, GPSCoordinate, WorkoutSplit } from './index';

export interface StravaTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // Unix timestamp in seconds
  expires_in?: number; // Lifetime in seconds
  token_type?: string;
  scope?: string;
}

export interface StravaAthlete {
  id: number;
  username?: string | null;
  firstname?: string;
  lastname?: string;
  bio?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  sex?: 'M' | 'F' | string | null;
  profile?: string | null; // Large avatar URL
  profile_medium?: string | null; // Medium avatar URL
  created_at?: string;
}

export interface StravaAuthResponse extends StravaTokens {
  athlete: StravaAthlete;
}

export interface StravaSplitMetric {
  split: number;
  distance: number; // in meters
  elapsed_time: number; // in seconds
  moving_time: number;
  elevation_difference?: number;
  average_speed?: number; // in m/s
  average_heartrate?: number;
  pace_zone?: number;
}

export interface StravaMap {
  id: string;
  summary_polyline: string | null;
  resource_state?: number;
}

export interface StravaActivitySummary {
  id: number;
  external_id?: string | null;
  upload_id?: number | null;
  athlete: { id: number; resource_state?: number };
  name: string;
  distance: number; // in meters
  moving_time: number; // in seconds
  elapsed_time: number; // in seconds
  total_elevation_gain: number; // in meters
  type: string; // 'Run', 'Walk', 'Hike', 'VirtualRun', etc.
  sport_type?: string;
  start_date: string; // ISO 8601 UTC
  start_date_local: string; // ISO 8601 local
  timezone?: string;
  start_latlng?: [number, number] | null;
  end_latlng?: [number, number] | null;
  achievement_count?: number;
  kudos_count?: number;
  comment_count?: number;
  athlete_count?: number;
  photo_count?: number;
  map?: StravaMap;
  trainer?: boolean;
  commute?: boolean;
  manual?: boolean;
  private?: boolean;
  visibility?: 'everyone' | 'followers_only' | 'only_me';
  flagged?: boolean;
  gear_id?: string | null;
  average_speed: number; // in m/s
  max_speed?: number; // in m/s
  average_cadence?: number;
  has_heartrate?: boolean;
  average_heartrate?: number;
  max_heartrate?: number;
  elev_high?: number;
  elev_low?: number;
  calories?: number;
  splits_metric?: StravaSplitMetric[];
}

export interface StravaUploadResponse {
  id: number;
  id_str: string;
  external_id: string | null;
  error: string | null;
  status: string; // 'Your activity is still being processed.', 'Your activity is ready.', etc.
  activity_id: number | null;
}

export interface StravaConnectionState extends HealthConnectionState {
  athlete?: StravaAthlete | null;
  autoUpload?: boolean;
  autoSync?: boolean;
}
