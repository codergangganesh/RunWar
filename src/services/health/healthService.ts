import { HealthProvider, HealthProviderType, SyncResult } from './types';
import { HealthConnectionState, Workout } from '../../types';
import { googleHealthProvider } from './googleHealthProvider';
import { healthConnectProvider } from './healthConnectProvider';
import { workoutService } from '../workoutService';

export class HealthService {
  private providers: Map<HealthProviderType, HealthProvider> = new Map();

  constructor() {
    this.providers.set('google_health', googleHealthProvider);
    this.providers.set('health_connect', healthConnectProvider);
  }

  /**
   * Get specific provider by type
   */
  getProvider(type: HealthProviderType): HealthProvider | undefined {
    return this.providers.get(type);
  }

  /**
   * Get primary health connection state (Google Health by default)
   */
  getPrimaryConnectionState(): HealthConnectionState {
    return googleHealthProvider.getConnectionState();
  }

  /**
   * Get active Google Fit OAuth token if valid
   */
  getGoogleAccessToken(): string | null {
    return googleHealthProvider.getValidAccessToken();
  }

  /**
   * Subscribe to real-time state and progress updates for a provider
   */
  subscribe(
    callback: (state: HealthConnectionState) => void,
    type: HealthProviderType = 'google_health'
  ): () => void {
    const provider = this.getProvider(type);
    if (provider && typeof provider.subscribe === 'function') {
      return provider.subscribe(callback);
    }
    callback(this.getPrimaryConnectionState());
    return () => {};
  }

  /**
   * Check if sync is currently in progress
   */
  isSyncing(type: HealthProviderType = 'google_health'): boolean {
    const provider = this.getProvider(type) as any;
    return Boolean(provider && typeof provider.isSyncing === 'function' && provider.isSyncing());
  }

  /**
   * Connect to specified health provider
   */
  async connect(type: HealthProviderType = 'google_health', source?: string): Promise<{ success: boolean; error?: string; accountEmail?: string }> {
    const provider = this.getProvider(type) as any;
    if (!provider) {
      return { success: false, error: 'Unsupported health provider.' };
    }
    return provider.connect(source);
  }

  /**
   * Silently re-acquire a Google token without showing a popup (uses existing consent)
   */
  async tryAutoReconnect(): Promise<boolean> {
    return googleHealthProvider.tryAutoReconnect();
  }

  /**
   * Restore persistent Google connection on app startup.
   * Uses cached token if still valid, otherwise attempts silent re-auth.
   * Also starts the automatic background refresh timer.
   */
  async startPersistentConnection(): Promise<boolean> {
    return googleHealthProvider.startPersistentConnection();
  }

  /**
   * Disconnect from health provider
   */
  async disconnect(type: HealthProviderType = 'google_health'): Promise<void> {
    const provider = this.getProvider(type);
    if (provider) {
      await provider.disconnect();
    }
  }

  /**
   * Synchronize workouts from provider with real-time incremental saving and progress
   */
  async sync(
    userId: string,
    type: HealthProviderType = 'google_health',
    onProgress?: (progress: any) => void
  ): Promise<SyncResult> {
    const provider = this.getProvider(type);
    if (!provider) {
      return {
        success: false,
        importedCount: 0,
        skippedCount: 0,
        newWorkouts: [],
        error: 'Health provider not found.',
      };
    }

    return provider.syncWorkouts(userId, undefined, onProgress);
  }
}

export const healthService = new HealthService();
