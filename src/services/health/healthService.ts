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
   * Connect to specified health provider
   */
  async connect(type: HealthProviderType = 'google_health'): Promise<{ success: boolean; error?: string; accountEmail?: string }> {
    const provider = this.getProvider(type);
    if (!provider) {
      return { success: false, error: 'Unsupported health provider.' };
    }
    return provider.connect();
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
   * Synchronize workouts from provider with strict duplicate prevention
   */
  async sync(userId: string, type: HealthProviderType = 'google_health'): Promise<SyncResult> {
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

    try {
      // 1. Fetch raw workouts from health provider
      const result = await provider.syncWorkouts(userId);
      if (!result.success || result.newWorkouts.length === 0) {
        return result;
      }

      // 2. Fetch user's existing workouts to prevent duplicates
      const existingWorkouts = await workoutService.getWorkouts(userId, 'all', 'newest', 300);

      // Track existing external keys: (source_provider + external_record_id)
      const existingExternalKeys = new Set(
        existingWorkouts
          .filter((w) => w.source_provider && w.external_record_id)
          .map((w) => `${w.source_provider}_${w.external_record_id}`)
      );

      // Track existing timestamps (epoch ms) to prevent duplicate counting with RUNWAR native GPS runs
      const existingStartTimes = existingWorkouts.map((w) => new Date(w.started_at).getTime());

      const validNewWorkouts: Workout[] = [];
      let skippedCount = 0;

      for (const candidate of result.newWorkouts) {
        const candidateKey = `${candidate.source_provider}_${candidate.external_record_id}`;

        // A. Check for exact external record match
        if (candidate.external_record_id && existingExternalKeys.has(candidateKey)) {
          skippedCount++;
          continue;
        }

        // B. Check for overlapping workout time (within ±2 minutes of any existing run)
        const candStartTime = new Date(candidate.started_at).getTime();
        const hasTimeOverlap = existingStartTimes.some(
          (existingMs) => Math.abs(existingMs - candStartTime) < 120 * 1000
        );

        if (hasTimeOverlap) {
          skippedCount++;
          continue;
        }

        validNewWorkouts.push(candidate);
      }

      // 3. Persist valid new workouts into InsForge & local cache
      if (validNewWorkouts.length > 0) {
        await workoutService.saveImportedWorkouts(validNewWorkouts);
      }

      return {
        success: true,
        importedCount: validNewWorkouts.length,
        skippedCount,
        newWorkouts: validNewWorkouts,
      };
    } catch (err: any) {
      console.error('HealthService sync error:', err);
      return {
        success: false,
        importedCount: 0,
        skippedCount: 0,
        newWorkouts: [],
        error: err?.message || 'Failed to sync health data.',
      };
    }
  }
}

export const healthService = new HealthService();
