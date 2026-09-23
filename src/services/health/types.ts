import { Workout, HealthProviderType, HealthConnectionState, GPSCoordinate, WorkoutSplit } from '../../types';

export type { HealthProviderType, HealthConnectionState };

export interface NormalizedExternalWorkout {
  externalRecordId: string;
  sourceProvider: HealthProviderType;
  type: 'run' | 'jog' | 'walk';
  title: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  distanceMeters: number;
  averagePace: number; // in seconds/km
  averageSpeed: number; // in km/h
  maxSpeed?: number;
  calories: number;
  elevationGain: number;
  elevationLoss: number;
  routeCoordinates: GPSCoordinate[];
  splits: WorkoutSplit[];
  heartRateAvg?: number | null;
  sourceMetadata?: Record<string, any>;
}

export interface SyncResult {
  success: boolean;
  importedCount: number;
  skippedCount: number;
  newWorkouts: Workout[];
  error?: string;
}

export type SyncProgressCallback = (progress: {
  current: number;
  total: number;
  newlySynced: number;
  currentTitle?: string;
  status: 'discovering' | 'processing' | 'saved' | 'completed' | 'error';
}) => void;

export interface HealthProvider {
  readonly providerType: HealthProviderType;
  readonly providerName: string;
  checkAvailability(): Promise<boolean>;
  connect(): Promise<{ success: boolean; error?: string; accountEmail?: string }>;
  disconnect(): Promise<void>;
  getConnectionState(): HealthConnectionState;
  subscribe?(callback: (state: HealthConnectionState) => void): () => void;
  syncWorkouts(
    userId: string,
    sinceDate?: Date,
    onProgress?: SyncProgressCallback
  ): Promise<SyncResult>;
}
