import { HealthProvider, SyncResult } from './types';
import { HealthConnectionState } from '../../types';

const HEALTH_CONNECT_STATE_KEY = 'runwar_health_connect_state';

export class HealthConnectProvider implements HealthProvider {
  readonly providerType = 'health_connect' as const;
  readonly providerName = 'Android Health Connect';

  /**
   * Check if running in an Android container with Health Connect bridge
   */
  async checkAvailability(): Promise<boolean> {
    const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
    const hasBridge = typeof (window as any).HealthConnect !== 'undefined';
    return isAndroid && hasBridge;
  }

  /**
   * Get cached connection state
   */
  getConnectionState(): HealthConnectionState {
    try {
      const stored = localStorage.getItem(HEALTH_CONNECT_STATE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          provider: 'health_connect',
          isConnected: Boolean(parsed.isConnected),
          lastSyncAt: parsed.lastSyncAt || null,
          syncedCount: Number(parsed.syncedCount) || 0,
          status: parsed.isConnected ? 'connected' : 'disconnected',
        };
      }
    } catch (e) {
      console.warn('Error reading Health Connect state:', e);
    }

    return {
      provider: 'health_connect',
      isConnected: false,
      lastSyncAt: null,
      syncedCount: 0,
      status: 'disconnected',
    };
  }

  async connect(): Promise<{ success: boolean; error?: string }> {
    const isAvailable = await this.checkAvailability();
    if (!isAvailable) {
      return {
        success: false,
        error:
          'Health Connect is available on Android devices via native app integration. On Web/PWA, please connect via Google Health & Fit for cloud sync.',
      };
    }

    return { success: true };
  }

  async disconnect(): Promise<void> {
    localStorage.removeItem(HEALTH_CONNECT_STATE_KEY);
  }

  async syncWorkouts(): Promise<SyncResult> {
    return {
      success: false,
      importedCount: 0,
      skippedCount: 0,
      newWorkouts: [],
      error: 'Health Connect native bridge is not active on this device.',
    };
  }
}

export const healthConnectProvider = new HealthConnectProvider();
