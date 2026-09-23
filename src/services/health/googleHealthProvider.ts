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
      let script = document.querySelector('script[src*="accounts.google.com/gsi/client"]') as HTMLScriptElement;
      if (!script) {
        script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }

      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (typeof (window as any).google?.accounts?.oauth2?.initTokenClient === 'function') {
          clearInterval(interval);
          resolve(true);
        } else if (attempts > 60) {
          clearInterval(interval);
          resolve(false);
        }
      }, 50);
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

    // Await Google Identity Services script
    await this.ensureGsiLoaded();

    return new Promise((resolve) => {
      // 1. Primary: Official Google Identity Services (GIS) Token Client
      if (typeof (window as any).google?.accounts?.oauth2?.initTokenClient === 'function') {
        try {
          const client = (window as any).google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: SCOPES,
            error_callback: (err: any) => {
              console.warn('GIS error:', err);
              resolve({
                success: false,
                error: err?.message || err?.type || 'Google authentication was cancelled or encountered an error.',
              });
            },
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
          client.requestAccessToken({ prompt: 'consent' });
          return;
        } catch (e: any) {
          console.warn('GIS Token client error, falling back to popup flow:', e);
        }
      }

      // 2. Fallback: Standard OAuth 2.0 Web Popup (without COOP blocking)
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

      // Handle OAuth response redirect via postMessage
      const handleMessage = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.type === 'GOOGLE_HEALTH_OAUTH_TOKEN' && event.data?.token) {
          handled = true;
          try { popup.close(); } catch {}
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

      // Check session & local storage periodically without touching popup.closed (prevents COOP warnings)
      const tokenPollTimer = setInterval(async () => {
        try {
          const transferData = localStorage.getItem('runwar_google_fit_token_transfer');
          if (transferData) {
            localStorage.removeItem('runwar_google_fit_token_transfer');
            const parsed = JSON.parse(transferData);
            if (parsed.token && !handled) {
              handled = true;
              clearInterval(tokenPollTimer);
              window.removeEventListener('message', handleMessage);
              try { popup.close(); } catch {}

              this.setAccessToken(parsed.token, parsed.expiresIn || 3600);
              const email = await this.fetchUserEmail(parsed.token);
              this.setConnectionState({
                isConnected: true,
                status: 'connected',
                accountEmail: email,
              });
              resolve({ success: true, accountEmail: email });
              return;
            }
          }
        } catch {}

        const token = this.getAccessToken();
        if (token && !handled) {
          handled = true;
          clearInterval(tokenPollTimer);
          window.removeEventListener('message', handleMessage);
          try { popup.close(); } catch {}
          this.setConnectionState({ isConnected: true, status: 'connected' });
          resolve({ success: true });
        }
      }, 800);

      // Timeout after 3 minutes
      setTimeout(() => {
        if (!handled) {
          handled = true;
          clearInterval(tokenPollTimer);
          window.removeEventListener('message', handleMessage);
          try { popup.close(); } catch {}
          resolve({ success: false, error: 'Connection timed out or was closed. Please try again.' });
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
      // Query 365 days of history on initial sync so past sessions are imported
      const startTime = sinceDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      const endTime = new Date();

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

      // Filter all active physical sessions (Running, Walking, Jogging, Treadmill, On foot, etc.)
      const supportedActivityTypes = new Set([8, 7, 57, 58, 86, 87, 2, 1, 9, 97, 108]);
      const validSessions = sessions.filter((s) =>
        s.activityType !== undefined ? supportedActivityTypes.has(Number(s.activityType)) : true
      );

      const normalizedWorkouts: NormalizedExternalWorkout[] = [];

      // 2. Process and aggregate each session
      for (const session of validSessions) {
        const sessionStartMs = Number(session.startTimeMillis);
        const sessionEndMs = Number(session.endTimeMillis);
        const durationSec = Math.max(1, Math.round((sessionEndMs - sessionStartMs) / 1000));

        const actType = Number(session.activityType);
        let workoutType: WorkoutType = 'run';
        if (actType === 7 || actType === 87 || actType === 2) {
          workoutType = 'walk';
        } else if (actType === 57) {
          workoutType = 'jog';
        } else if (actType === 8 || actType === 58 || actType === 86) {
          workoutType = 'run';
        }

        // Check if aggregate metrics are already embedded in the session object
        let embeddedDistance = 0;
        let embeddedCalories = 0;
        let embeddedSpeed = 0;
        let embeddedSteps = 0;

        if (Array.isArray(session.aggregate)) {
          for (const agg of session.aggregate) {
            const name = (agg.metricName || '').toLowerCase();
            const fVal = typeof agg.floatValue === 'number' ? agg.floatValue : 0;
            const iVal = typeof agg.intValue === 'number' ? agg.intValue : 0;
            if (name.includes('distance')) embeddedDistance += fVal || iVal;
            else if (name.includes('calories')) embeddedCalories += fVal || iVal;
            else if (name.includes('speed')) embeddedSpeed = Math.max(embeddedSpeed, fVal);
            else if (name.includes('step_count')) embeddedSteps += iVal || fVal;
          }
        }

        // Fetch dataset metrics & GPS trackpoints for this session's time window
        const { distanceMeters, calories, speedMps, coordinates, heartRateAvg, stepCount } =
          await this.fetchSessionDataset(token, sessionStartMs, sessionEndMs);

        // Determine final distance
        let finalDistance = Math.round(distanceMeters || embeddedDistance);
        if (finalDistance <= 0 && coordinates.length >= 2) {
          finalDistance = Math.round(this.calculateRouteDistance(coordinates));
        }
        const totalSteps = stepCount || embeddedSteps;
        if (finalDistance <= 0 && totalSteps > 0) {
          const strideLength = workoutType === 'run' ? 0.95 : workoutType === 'jog' ? 0.85 : 0.75;
          finalDistance = Math.round(totalSteps * strideLength);
        }
        if (finalDistance <= 0) {
          const speedEstimateMps = workoutType === 'run' ? 2.78 : workoutType === 'jog' ? 2.08 : 1.39;
          finalDistance = Math.round(durationSec * speedEstimateMps);
        }

        // Determine final calories
        let finalCalories = Math.round(calories || embeddedCalories);
        if (finalCalories <= 0) {
          const calPerSec = workoutType === 'run' ? 0.18 : workoutType === 'jog' ? 0.13 : 0.08;
          finalCalories = Math.max(15, Math.round(durationSec * calPerSec));
        }

        // Determine speeds and pace
        const avgSpeedKmh = Number(
          (
            (finalDistance / 1000) / (durationSec / 3600) ||
            (speedMps > 0 ? speedMps * 3.6 : embeddedSpeed > 0 ? embeddedSpeed * 3.6 : 8.0)
          ).toFixed(2)
        );
        const avgPaceSec = finalDistance > 0 ? Math.round(durationSec / (finalDistance / 1000)) : 0;
        const maxSpeedKmh = Number(
          Math.max(avgSpeedKmh * 1.25, speedMps * 3.6, embeddedSpeed * 3.6).toFixed(2)
        );

        // Generate kilometer splits if route or distance available
        const splits = this.generateSplits(finalDistance, durationSec, coordinates);

        normalizedWorkouts.push({
          externalRecordId: session.id || `gfit_${sessionStartMs}`,
          sourceProvider: 'google_health',
          type: workoutType,
          title:
            session.name ||
            `Google Health ${workoutType.charAt(0).toUpperCase() + workoutType.slice(1)}`,
          startedAt: new Date(sessionStartMs).toISOString(),
          endedAt: new Date(sessionEndMs).toISOString(),
          durationSeconds: durationSec,
          distanceMeters: finalDistance,
          averagePace: avgPaceSec,
          averageSpeed: avgSpeedKmh,
          maxSpeed: maxSpeedKmh,
          calories: finalCalories,
          elevationGain: 0,
          elevationLoss: 0,
          routeCoordinates: coordinates,
          splits,
          sourceMetadata: {
            appPackageName: session.application?.packageName,
            activityType: session.activityType,
            heartRateAvg: heartRateAvg || undefined,
            stepCount: stepCount > 0 ? stepCount : undefined,
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
   * Fetch distance, calories, speed, steps, heart rate, and GPS location points for a session
   */
  private async fetchSessionDataset(
    token: string,
    startMs: number,
    endMs: number
  ): Promise<{
    distanceMeters: number;
    calories: number;
    speedMps: number;
    coordinates: GPSCoordinate[];
    heartRateAvg?: number | null;
    stepCount: number;
  }> {
    const startNanos = BigInt(startMs) * BigInt(1000000);
    const endNanos = BigInt(endMs) * BigInt(1000000);

    let distanceMeters = 0;
    let calories = 0;
    let speedMps = 0;
    let stepCount = 0;
    let heartRateSum = 0;
    let heartRateCount = 0;
    const coordinates: GPSCoordinate[] = [];

    // 1. Query aggregate endpoint with required bucketByTime
    try {
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
            { dataTypeName: 'com.google.step_count.delta' },
            { dataTypeName: 'com.google.heart_rate.bpm' },
            { dataTypeName: 'com.google.location.sample' },
          ],
          bucketByTime: { durationMillis: Math.max(60000, endMs - startMs) },
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
              const type = (ds.dataSourceId || '').toLowerCase();
              const vals = pt.value || [];

              if (type.includes('distance') && vals[0]?.fpVal) {
                distanceMeters += vals[0].fpVal;
              } else if (type.includes('calories') && vals[0]?.fpVal) {
                calories += vals[0].fpVal;
              } else if (type.includes('speed') && vals[0]?.fpVal) {
                speedMps = Math.max(speedMps, vals[0].fpVal);
              } else if (type.includes('step_count') && vals[0]?.intVal) {
                stepCount += vals[0].intVal;
              } else if (type.includes('heart_rate') && vals[0]?.fpVal) {
                heartRateSum += vals[0].fpVal;
                heartRateCount++;
              } else if (type.includes('location') && vals.length >= 2) {
                const lat = vals[0]?.fpVal;
                const lng = vals[1]?.fpVal;
                if (typeof lat === 'number' && typeof lng === 'number' && (lat !== 0 || lng !== 0)) {
                  coordinates.push({
                    latitude: lat,
                    longitude: lng,
                    altitude: vals[3]?.fpVal ?? vals[2]?.fpVal ?? 0,
                    accuracy: vals[2]?.fpVal ?? 5,
                    timestamp: Number(pt.startTimeNanos) / 1000000,
                  });
                }
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('Non-blocking dataset aggregate fetch warning:', e);
    }

    // 2. If coordinates are empty, query raw GPS location samples data source
    if (coordinates.length === 0) {
      try {
        const rawGpsUrl = `https://www.googleapis.com/fitness/v1/users/me/dataSources/derived:com.google.location.sample:com.google.android.gms:merge_location_samples/datasets/${startNanos}-${endNanos}`;
        const rawGpsRes = await fetch(rawGpsUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (rawGpsRes.ok) {
          const rawGpsData = await rawGpsRes.json();
          const points = rawGpsData.point || [];
          for (const pt of points) {
            const vals = pt.value || [];
            if (vals.length >= 2) {
              const lat = vals[0]?.fpVal;
              const lng = vals[1]?.fpVal;
              if (typeof lat === 'number' && typeof lng === 'number' && (lat !== 0 || lng !== 0)) {
                coordinates.push({
                  latitude: lat,
                  longitude: lng,
                  accuracy: vals[2]?.fpVal ?? 5,
                  altitude: vals[3]?.fpVal ?? 0,
                  timestamp: Number(pt.startTimeNanos) / 1000000,
                });
              }
            }
          }
        }
      } catch (gpsErr) {
        console.warn('Non-blocking raw GPS stream query warning:', gpsErr);
      }
    }

    const heartRateAvg = heartRateCount > 0 ? Math.round(heartRateSum / heartRateCount) : null;
    return { distanceMeters, calories, speedMps, coordinates, heartRateAvg, stepCount };
  }

  /**
   * Calculate distance between consecutive coordinates using Haversine formula
   */
  private calculateRouteDistance(coords: GPSCoordinate[]): number {
    if (!coords || coords.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < coords.length; i++) {
      const p1 = coords[i - 1];
      const p2 = coords[i];
      const R = 6371e3; // meters
      const phi1 = (p1.latitude * Math.PI) / 180;
      const phi2 = (p2.latitude * Math.PI) / 180;
      const deltaPhi = ((p2.latitude - p1.latitude) * Math.PI) / 180;
      const deltaLambda = ((p2.longitude - p1.longitude) * Math.PI) / 180;

      const a =
        Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
        Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      total += R * c;
    }
    return total;
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
      heart_rate_avg: n.sourceMetadata?.heartRateAvg || null,
      created_at: new Date().toISOString(),
    };
  }
}

export const googleHealthProvider = new GoogleHealthProvider();
