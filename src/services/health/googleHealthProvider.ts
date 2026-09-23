import { HealthProvider, NormalizedExternalWorkout, SyncResult } from './types';
import { HealthConnectionState, Workout, WorkoutType, GPSCoordinate, WorkoutSplit } from '../../types';

const GOOGLE_FIT_AUTH_STORAGE_KEY = 'runwar_google_fit_token';
const GOOGLE_FIT_STATE_STORAGE_KEY = 'runwar_google_fit_state';

// Google OAuth Client ID loaded strictly from environment variables (.env.local)
const GOOGLE_CLIENT_ID: string =
  (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '';

const SCOPES = [
  'https://www.googleapis.com/auth/fitness.activity.read',
  'https://www.googleapis.com/auth/fitness.location.read',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'openid',
].join(' ');

export class GoogleHealthProvider implements HealthProvider {
  readonly providerType = 'google_health' as const;
  readonly providerName = 'Google Health & Fit';

  /**
   * Check if running in browser/PWA with internet connectivity
   */
  async checkAvailability(): Promise<boolean> {
    return typeof window !== 'undefined' && navigator.onLine;
  }

  /**
   * Get cached connection state
   */
  getConnectionState(): HealthConnectionState {
    try {
      const stored = localStorage.getItem(GOOGLE_FIT_STATE_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          provider: 'google_health',
          isConnected: Boolean(parsed.isConnected),
          lastSyncAt: parsed.lastSyncAt || null,
          syncedCount: Number(parsed.syncedCount) || 0,
          accountEmail: parsed.accountEmail || null,
          status: parsed.isConnected ? 'connected' : 'disconnected',
        };
      }
    } catch (e) {
      console.warn('Error reading Google Health state:', e);
    }

    return {
      provider: 'google_health',
      isConnected: false,
      lastSyncAt: null,
      syncedCount: 0,
      status: 'disconnected',
    };
  }

  /**
   * Save connection state
   */
  private setConnectionState(state: Partial<HealthConnectionState>) {
    try {
      const current = this.getConnectionState();
      const updated = { ...current, ...state };
      localStorage.setItem(GOOGLE_FIT_STATE_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save Google Health state:', e);
    }
  }

  /**
   * Get cached access token if valid
   */
  private getAccessToken(): string | null {
    try {
      const item = sessionStorage.getItem(GOOGLE_FIT_AUTH_STORAGE_KEY);
      if (!item) return null;
      const { token, expiresAt } = JSON.parse(item);
      if (Date.now() > expiresAt) {
        sessionStorage.removeItem(GOOGLE_FIT_AUTH_STORAGE_KEY);
        return null;
      }
      return token;
    } catch {
      return null;
    }
  }

  /**
   * Save access token securely in session storage with expiry
   */
  private setAccessToken(token: string, expiresInSec: number) {
    const expiresAt = Date.now() + (expiresInSec - 60) * 1000;
    sessionStorage.setItem(
      GOOGLE_FIT_AUTH_STORAGE_KEY,
      JSON.stringify({ token, expiresAt })
    );
  }

  /**
   * Ensure Google Identity Services library is loaded
   */
  private async ensureGsiLoaded(): Promise<boolean> {
    if (typeof (window as any).google?.accounts?.oauth2?.initTokenClient === 'function') {
      return true;
    }

    return new Promise((resolve) => {
      const existing = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
      if (!existing) {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.head.appendChild(script);
      } else {
        let attempts = 0;
        const interval = setInterval(() => {
          attempts++;
          if (typeof (window as any).google?.accounts?.oauth2?.initTokenClient === 'function') {
            clearInterval(interval);
            resolve(true);
          } else if (attempts > 30) {
            clearInterval(interval);
            resolve(false);
          }
        }, 100);
      }
    });
  }

  /**
   * Authorize user via Google OAuth 2.0 Token Flow
   */
  async connect(): Promise<{ success: boolean; error?: string; accountEmail?: string }> {
    if (!GOOGLE_CLIENT_ID) {
      return {
        success: false,
        error: 'Google OAuth Client ID is missing. Please configure VITE_GOOGLE_CLIENT_ID in .env.local.',
      };
    }

    // Await Google Identity Services script if available
    await this.ensureGsiLoaded();

    return new Promise((resolve) => {
      // 1. Check if Google Identity Services (GIS) token client is available
      if (typeof (window as any).google?.accounts?.oauth2?.initTokenClient === 'function') {
        try {
          const client = (window as any).google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: SCOPES,
            callback: async (response: any) => {
              if (response.error) {
                resolve({ success: false, error: response.error_description || response.error });
                return;
              }
              if (response.access_token) {
                this.setAccessToken(response.access_token, Number(response.expires_in) || 3600);
                const email = await this.fetchUserEmail(response.access_token);
                this.setConnectionState({
                  isConnected: true,
                  status: 'connected',
                  accountEmail: email,
                });
                resolve({ success: true, accountEmail: email });
              }
            },
          });
          client.requestAccessToken();
          return;
        } catch (e: any) {
          console.warn('GIS Token client error, falling back to popup flow:', e);
        }
      }

      // 2. Fallback: Standard OAuth 2.0 Web Popup
      const redirectUri = window.location.origin;
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
        GOOGLE_CLIENT_ID
      )}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&response_type=token&scope=${encodeURIComponent(SCOPES)}&include_granted_scopes=true&prompt=consent`;

      const width = 500;
      const height = 650;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        authUrl,
        'Google Health Connection',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      if (!popup) {
        resolve({
          success: false,
          error: 'Popup was blocked by your browser. Please allow popups for Runwar and try again.',
        });
        return;
      }

      let handled = false;
      const checkTimer = setInterval(() => {
        let isClosed = false;
        try {
          isClosed = !popup || Boolean(popup.closed);
        } catch {
          // Cross-Origin-Opener-Policy safe: ignore until popup redirects back
          isClosed = false;
        }

        if (isClosed) {
          clearInterval(checkTimer);
          if (!handled) {
            const token = this.getAccessToken();
            if (token) {
              handled = true;
              this.setConnectionState({ isConnected: true, status: 'connected' });
              resolve({ success: true });
            } else {
              handled = true;
              resolve({ success: false, error: 'Connection was cancelled.' });
            }
          }
        }
      }, 1000);

      // Handle OAuth response redirect
      const handleMessage = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.type === 'GOOGLE_HEALTH_OAUTH_TOKEN' && event.data?.token) {
          handled = true;
          clearInterval(checkTimer);
          popup.close();
          window.removeEventListener('message', handleMessage);

          this.setAccessToken(event.data.token, event.data.expiresIn || 3600);
          const email = await this.fetchUserEmail(event.data.token);
          this.setConnectionState({
            isConnected: true,
            status: 'connected',
            accountEmail: email,
          });
          resolve({ success: true, accountEmail: email });
        }
      };

      window.addEventListener('message', handleMessage);

      // Timeout after 3 minutes
      setTimeout(() => {
        if (!handled) {
          handled = true;
          clearInterval(checkTimer);
          window.removeEventListener('message', handleMessage);
          if (popup && !popup.closed) popup.close();
          resolve({ success: false, error: 'Connection timed out. Please try again.' });
        }
      }, 180000);
    });
  }

  /**
   * Fetch authenticated user's email address
   */
  private async fetchUserEmail(token: string): Promise<string | undefined> {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        return data.email;
      }
    } catch {
      // ignore
    }
    return undefined;
  }

  /**
   * Disconnect and clear all tokens
   */
  async disconnect(): Promise<void> {
    const token = this.getAccessToken();
    if (token) {
      try {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
      } catch {
        // ignore revoke error
      }
    }

    sessionStorage.removeItem(GOOGLE_FIT_AUTH_STORAGE_KEY);
    this.setConnectionState({
      isConnected: false,
      status: 'disconnected',
      accountEmail: null,
    });
  }

  /**
   * Synchronize workouts from Google Health & Fitness REST API
   */
  async syncWorkouts(userId: string, sinceDate?: Date): Promise<SyncResult> {
    const token = this.getAccessToken();
    if (!token) {
      return {
        success: false,
        importedCount: 0,
        skippedCount: 0,
        newWorkouts: [],
        error: 'Google Health is not connected or your authorization session expired. Please connect again.',
      };
    }

    try {
      // Default to 60 days of history on initial sync if no sinceDate provided
      const startTime = sinceDate || new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      const endTime = new Date();

      const startTimeNanos = BigInt(startTime.getTime()) * BigInt(1000000);
      const endTimeNanos = BigInt(endTime.getTime()) * BigInt(1000000);

      // 1. Fetch fitness sessions from Google Fitness REST API
      const sessionsUrl = `https://www.googleapis.com/fitness/v1/users/me/sessions?startTime=${startTime.toISOString()}&endTime=${endTime.toISOString()}`;
      const sessionsRes = await fetch(sessionsUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!sessionsRes.ok) {
        if (sessionsRes.status === 401) {
          sessionStorage.removeItem(GOOGLE_FIT_AUTH_STORAGE_KEY);
          this.setConnectionState({ isConnected: false, status: 'disconnected' });
          return {
            success: false,
            importedCount: 0,
            skippedCount: 0,
            newWorkouts: [],
            error: 'Google authorization expired. Please click Connect to re-authorize.',
          };
        }
        throw new Error(`Google Health API error (status ${sessionsRes.status})`);
      }

      const sessionsData = await sessionsRes.json();
      const sessions: any[] = sessionsData.session || [];

      // Filter running / walking / jogging activity types
      // 8 = Running, 7 = Walking, 57 = Jogging, 58 = Running (Sand), 86 = Treadmill running, 87 = Treadmill walking
      const supportedActivityTypes = new Set([8, 7, 57, 58, 86, 87]);
      const validSessions = sessions.filter((s) => supportedActivityTypes.has(Number(s.activityType)));

      const normalizedWorkouts: NormalizedExternalWorkout[] = [];

      // 2. Process and aggregate each session
      for (const session of validSessions) {
        const sessionStartMs = Number(session.startTimeMillis);
        const sessionEndMs = Number(session.endTimeMillis);
        const durationSec = Math.max(1, Math.round((sessionEndMs - sessionStartMs) / 1000));

        let workoutType: WorkoutType = 'run';
        if (session.activityType === 7 || session.activityType === 87) {
          workoutType = 'walk';
        } else if (session.activityType === 57) {
          workoutType = 'jog';
        }

        // Fetch dataset metrics for this session's time window
        const { distanceMeters, calories, speedMps, coordinates } = await this.fetchSessionDataset(
          token,
          sessionStartMs,
          sessionEndMs
        );

        const finalDistance = Math.round(distanceMeters);
        const finalCalories = Math.round(calories);
        const avgSpeedKmh = Number(((finalDistance / 1000) / (durationSec / 3600) || speedMps * 3.6).toFixed(2));
        const avgPaceSec = finalDistance > 0 ? Math.round(durationSec / (finalDistance / 1000)) : 0;

        // Generate kilometer splits if route or distance available
        const splits = this.generateSplits(finalDistance, durationSec, coordinates);

        normalizedWorkouts.push({
          externalRecordId: session.id || `gfit_${sessionStartMs}`,
          sourceProvider: 'google_health',
          type: workoutType,
          title: session.name || `Google Health ${workoutType.charAt(0).toUpperCase() + workoutType.slice(1)}`,
          startedAt: new Date(sessionStartMs).toISOString(),
          endedAt: new Date(sessionEndMs).toISOString(),
          durationSeconds: durationSec,
          distanceMeters: finalDistance,
          averagePace: avgPaceSec,
          averageSpeed: avgSpeedKmh,
          maxSpeed: avgSpeedKmh > 0 ? Number((avgSpeedKmh * 1.25).toFixed(2)) : 0,
          calories: finalCalories > 0 ? finalCalories : Math.round(durationSec * 0.14),
          elevationGain: 0,
          elevationLoss: 0,
          routeCoordinates: coordinates,
          splits,
          sourceMetadata: {
            appPackageName: session.application?.packageName,
            activityType: session.activityType,
          },
        });
      }

      // Update sync state
      const current = this.getConnectionState();
      this.setConnectionState({
        lastSyncAt: new Date().toISOString(),
        syncedCount: current.syncedCount + normalizedWorkouts.length,
      });

      return {
        success: true,
        importedCount: normalizedWorkouts.length,
        skippedCount: 0,
        newWorkouts: normalizedWorkouts.map((n) => this.convertToWorkout(n, userId)),
      };
    } catch (err: any) {
      console.error('Google Health sync error:', err);
      return {
        success: false,
        importedCount: 0,
        skippedCount: 0,
        newWorkouts: [],
        error: err?.message || 'Failed to sync with Google Health.',
      };
    }
  }

  /**
   * Fetch distance, calories, speed, and GPS location points for a session time range
   */
  private async fetchSessionDataset(
    token: string,
    startMs: number,
    endMs: number
  ): Promise<{ distanceMeters: number; calories: number; speedMps: number; coordinates: GPSCoordinate[] }> {
    const startNanos = BigInt(startMs) * BigInt(1000000);
    const endNanos = BigInt(endMs) * BigInt(1000000);

    let distanceMeters = 0;
    let calories = 0;
    let speedMps = 0;
    const coordinates: GPSCoordinate[] = [];

    try {
      // Query dataset aggregate endpoint
      const res = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          aggregateBy: [
            { dataTypeName: 'com.google.distance.delta' },
            { dataTypeName: 'com.google.calories.expended' },
            { dataTypeName: 'com.google.speed' },
            { dataTypeName: 'com.google.location.sample' },
          ],
          startTimeMillis: startMs,
          endTimeMillis: endMs,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const buckets = data.bucket || [];

        for (const bucket of buckets) {
          const datasets = bucket.dataset || [];
          for (const ds of datasets) {
            const points = ds.point || [];
            for (const pt of points) {
              const type = ds.dataSourceId || '';
              const vals = pt.value || [];

              if (type.includes('distance') && vals[0]?.fpVal) {
                distanceMeters += vals[0].fpVal;
              } else if (type.includes('calories') && vals[0]?.fpVal) {
                calories += vals[0].fpVal;
              } else if (type.includes('speed') && vals[0]?.fpVal) {
                speedMps = Math.max(speedMps, vals[0].fpVal);
              } else if (type.includes('location') && vals.length >= 2) {
                const lat = vals[0]?.fpVal;
                const lng = vals[1]?.fpVal;
                if (typeof lat === 'number' && typeof lng === 'number' && (lat !== 0 || lng !== 0)) {
                  coordinates.push({
                    latitude: lat,
                    longitude: lng,
                    altitude: vals[2]?.fpVal || 0,
                    accuracy: vals[3]?.fpVal || 5,
                    timestamp: Number(pt.startTimeNanos) / 1000000,
                  });
                }
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('Non-blocking dataset aggregate fetch error:', e);
    }

    return { distanceMeters, calories, speedMps, coordinates };
  }

  /**
   * Generate simple kilometer splits
   */
  private generateSplits(distanceMeters: number, durationSec: number, coords: GPSCoordinate[]): WorkoutSplit[] {
    if (distanceMeters < 500) return [];
    const totalKm = Math.floor(distanceMeters / 1000);
    if (totalKm <= 0) return [];

    const avgPaceSec = Math.round(durationSec / (distanceMeters / 1000));
    const splits: WorkoutSplit[] = [];

    for (let k = 1; k <= totalKm; k++) {
      splits.push({
        split_number: k,
        distance_meters: 1000,
        duration_seconds: avgPaceSec,
        pace: avgPaceSec,
      });
    }

    const remainder = distanceMeters % 1000;
    if (remainder > 200) {
      const remSec = Math.round((remainder / 1000) * avgPaceSec);
      splits.push({
        split_number: totalKm + 1,
        distance_meters: Math.round(remainder),
        duration_seconds: remSec,
        pace: avgPaceSec,
      });
    }

    return splits;
  }

  /**
   * Convert normalized workout to internal Workout model
   */
  private convertToWorkout(n: NormalizedExternalWorkout, userId: string): Workout {
    return {
      id: crypto.randomUUID(),
      user_id: userId,
      type: n.type,
      title: n.title,
      notes: `Imported from Google Health & Fit`,
      started_at: n.startedAt,
      ended_at: n.endedAt,
      duration_seconds: n.durationSeconds,
      moving_duration_seconds: n.durationSeconds,
      paused_duration_seconds: 0,
      distance_meters: n.distanceMeters,
      average_pace: n.averagePace,
      average_speed: n.averageSpeed,
      max_speed: n.maxSpeed || n.averageSpeed,
      calories: n.calories,
      elevation_gain: n.elevationGain,
      elevation_loss: n.elevationLoss,
      status: 'completed',
      route_coordinates: n.routeCoordinates,
      splits: n.splits,
      source_provider: 'google_health',
      external_record_id: n.externalRecordId,
      created_at: new Date().toISOString(),
    };
  }
}

export const googleHealthProvider = new GoogleHealthProvider();
