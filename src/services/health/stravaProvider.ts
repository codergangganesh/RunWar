import {
  HealthProvider,
  NormalizedExternalWorkout,
  SyncProgressCallback,
  SyncResult,
} from './types';
import { HealthConnectionState, Workout, WorkoutSplit, GPSCoordinate } from '../../types';
import {
  StravaTokens,
  StravaAthlete,
  StravaActivitySummary,
  StravaConnectionState,
  StravaUploadResponse,
} from '../../types/strava';
import { polylineToGPSCoordinates } from './stravaPolyline';
import { workoutService } from '../workoutService';
import { toDeterministicUUID } from '../../utils/uuid';
import { insforge } from '../../lib/insforge';
import { generateGPX } from '../../utils/exportGenerators';

const STRAVA_TOKENS_STORAGE_KEY = 'runwar_strava_tokens';
const STRAVA_STATE_STORAGE_KEY = 'runwar_strava_state';

// Strava OAuth credentials from environment variables
const STRAVA_CLIENT_ID: string =
  (import.meta as any).env?.VITE_STRAVA_CLIENT_ID || '';
const STRAVA_CLIENT_SECRET: string =
  (import.meta as any).env?.VITE_STRAVA_CLIENT_SECRET || '';

// InsForge backend Edge Function URL for secure server-side token exchange
const FN_BASE =
  (import.meta as any).env?.VITE_INSFORGE_FUNCTIONS_URL ||
  'https://7p7ewmvi.function2.insforge.app';
const FN_STRAVA_AUTH = `${FN_BASE}/strava-auth`;

export class StravaProvider implements HealthProvider {
  readonly providerType = 'strava' as const;
  readonly providerName = 'Strava';

  private memoryState: StravaConnectionState | null = null;
  private listeners = new Set<(state: HealthConnectionState) => void>();
  private isSyncingActive = false;

  /**
   * Subscribe to real-time Strava connection and sync updates
   */
  public subscribe(callback: (state: HealthConnectionState) => void): () => void {
    this.listeners.add(callback);
    callback(this.getConnectionState());
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners() {
    const state = this.getConnectionState();
    this.listeners.forEach((cb) => {
      try {
        cb(state);
      } catch (e) {
        console.warn('Error in Strava subscriber callback:', e);
      }
    });
  }

  public isSyncing(): boolean {
    return this.isSyncingActive;
  }

  async checkAvailability(): Promise<boolean> {
    return typeof window !== 'undefined' && navigator.onLine;
  }

  /**
   * Get cached connection state with live count of synced Strava runs
   */
  getConnectionState(): StravaConnectionState {
    if (this.memoryState) {
      return this.memoryState;
    }

    try {
      const stored = localStorage.getItem(STRAVA_STATE_STORAGE_KEY);
      const cachedWorkouts = workoutService.getCachedWorkouts();
      const actualStravaCount = cachedWorkouts.filter(
        (w) => w.source_provider === 'strava'
      ).length;

      if (stored) {
        const parsed: StravaConnectionState = JSON.parse(stored);
        const syncedCount =
          actualStravaCount > 0 ? actualStravaCount : parsed.syncedCount || 0;
        return {
          ...parsed,
          provider: 'strava',
          syncedCount,
        };
      }
    } catch (e) {
      console.warn('Error reading stored Strava state:', e);
    }

    return {
      provider: 'strava',
      isConnected: false,
      lastSyncAt: null,
      syncedCount: 0,
      status: 'disconnected',
      autoSync: true,
      autoUpload: false,
    };
  }

  /**
   * Update and broadcast connection state
   */
  private setConnectionState(partial: Partial<StravaConnectionState>) {
    const current = this.getConnectionState();
    const updated: StravaConnectionState = {
      ...current,
      ...partial,
      provider: 'strava',
    };
    this.memoryState = updated;

    try {
      localStorage.setItem(STRAVA_STATE_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Error persisting Strava state locally:', e);
    }

    this.notifyListeners();
  }

  /**
   * Read stored tokens (localStorage cache)
   */
  public getStoredTokens(): StravaTokens | null {
    try {
      const raw = localStorage.getItem(STRAVA_TOKENS_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /**
   * Save tokens both locally and into InsForge Postgres database
   */
  public async saveTokens(
    tokens: StravaTokens,
    athlete?: StravaAthlete,
    userId?: string
  ): Promise<void> {
    try {
      localStorage.setItem(STRAVA_TOKENS_STORAGE_KEY, JSON.stringify(tokens));

      const athleteName = athlete
        ? `${athlete.firstname || ''} ${athlete.lastname || ''}`.trim()
        : null;

      this.setConnectionState({
        isConnected: true,
        status: 'connected',
        accountEmail: athleteName || athlete?.username || 'Strava Athlete',
        athlete: athlete || null,
        errorMessage: null,
      });

      // Persist to InsForge database if user is authenticated and online
      const activeUserId = userId || (insforge.auth as any)?.currentUser?.id;
      if (activeUserId && navigator.onLine) {
        const expiresAtIso = new Date(tokens.expires_at * 1000).toISOString();
        await insforge.database.from('user_integrations').upsert(
          [
            {
              user_id: activeUserId,
              provider: 'strava',
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token,
              token_expires_at: expiresAtIso,
              athlete_id: athlete ? String(athlete.id) : null,
              athlete_name: athleteName,
              athlete_profile_url: athlete?.profile || athlete?.profile_medium || null,
              scopes: tokens.scope || 'read,activity:read_all,activity:write',
              is_connected: true,
              auto_sync: true,
              updated_at: new Date().toISOString(),
            },
          ],
          { onConflict: 'user_id,provider' }
        );
      }
    } catch (err) {
      console.warn('Error saving Strava tokens:', err);
    }
  }

  /**
   * Restore connection from InsForge Database (for cross-device / fresh sessions)
   */
  public async restoreFromDatabase(userId: string): Promise<boolean> {
    if (!userId || !navigator.onLine) return false;

    try {
      const { data, error } = await insforge.database
        .from('user_integrations')
        .select('*')
        .eq('user_id', userId)
        .eq('provider', 'strava')
        .single();

      if (error || !data) return false;

      if (data.is_connected && data.access_token && data.refresh_token) {
        const expiresAtSec = data.token_expires_at
          ? Math.floor(new Date(data.token_expires_at).getTime() / 1000)
          : Math.floor(Date.now() / 1000) + 3600;

        const tokens: StravaTokens = {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_at: expiresAtSec,
          scope: data.scopes || undefined,
        };

        const athlete: StravaAthlete | undefined = data.athlete_id
          ? {
              id: Number(data.athlete_id) || 0,
              firstname: data.athlete_name || undefined,
              profile: data.athlete_profile_url || undefined,
            }
          : undefined;

        localStorage.setItem(STRAVA_TOKENS_STORAGE_KEY, JSON.stringify(tokens));

        this.setConnectionState({
          isConnected: true,
          status: 'connected',
          accountEmail: data.athlete_name || 'Strava Connected',
          lastSyncAt: data.last_synced_at || null,
          syncedCount: data.synced_count || 0,
          autoSync: data.auto_sync ?? true,
          autoUpload: data.auto_upload ?? false,
          athlete: athlete || null,
        });

        return true;
      }
    } catch (e) {
      console.warn('Failed to restore Strava integration from DB:', e);
    }
    return false;
  }

  /**
   * Retrieve a valid access token, auto-refreshing if expired
   */
  public async getValidAccessToken(userId?: string): Promise<string | null> {
    let tokens = this.getStoredTokens();

    if (!tokens && userId) {
      await this.restoreFromDatabase(userId);
      tokens = this.getStoredTokens();
    }

    if (!tokens || !tokens.access_token) return null;

    const nowSec = Math.floor(Date.now() / 1000);
    // Refresh 5 minutes before actual expiry
    if (tokens.expires_at && tokens.expires_at - nowSec < 300) {
      const refreshed = await this.refreshAccessToken(tokens.refresh_token, userId);
      return refreshed ? refreshed.access_token : null;
    }

    return tokens.access_token;
  }

  /**
   * Refresh expired access token using refresh_token
   */
  public async refreshAccessToken(
    refreshToken: string,
    userId?: string
  ): Promise<StravaTokens | null> {
    if (!refreshToken) return null;

    try {
      let freshTokens: StravaTokens | null = null;

      // 1. Try InsForge Edge Function first (production-safe with client secret hidden)
      try {
        const edgeRes = await fetch(FN_STRAVA_AUTH, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'refresh',
            refresh_token: refreshToken,
          }),
        });

        if (edgeRes.ok) {
          const json = await edgeRes.json();
          if (json.access_token) {
            freshTokens = {
              access_token: json.access_token,
              refresh_token: json.refresh_token || refreshToken,
              expires_at: json.expires_at,
              expires_in: json.expires_in,
              token_type: json.token_type,
            };
          }
        }
      } catch (edgeErr) {
        console.warn('Edge function refresh unavailable, falling back:', edgeErr);
      }

      // 2. Direct client fallback if client credentials exist in env
      if (!freshTokens && STRAVA_CLIENT_ID && STRAVA_CLIENT_SECRET) {
        const res = await fetch('https://www.strava.com/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: STRAVA_CLIENT_ID,
            client_secret: STRAVA_CLIENT_SECRET,
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
          }),
        });

        if (res.ok) {
          const json = await res.json();
          freshTokens = {
            access_token: json.access_token,
            refresh_token: json.refresh_token,
            expires_at: json.expires_at,
            expires_in: json.expires_in,
            token_type: json.token_type,
          };
        }
      }

      if (freshTokens) {
        await this.saveTokens(freshTokens, this.memoryState?.athlete || undefined, userId);
        return freshTokens;
      }
    } catch (err) {
      console.error('Failed to refresh Strava access token:', err);
      this.setConnectionState({
        status: 'error',
        errorMessage: 'Strava session expired. Please reconnect your account.',
      });
    }

    return null;
  }

  /**
   * Build the Strava OAuth 2.0 authorization URL
   */
  public getAuthorizationUrl(redirectUri?: string): string {
    const clientId = STRAVA_CLIENT_ID || '148011'; // Demo/default or env
    const redirect =
      redirectUri ||
      `${window.location.origin}/strava-callback.html`;
    const scopes = 'read,activity:read_all,activity:write';

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirect,
      approval_prompt: 'auto',
      scope: scopes,
    });

    return `https://www.strava.com/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange OAuth authorization code for tokens
   */
  public async exchangeAuthorizationCode(
    code: string,
    redirectUri?: string,
    userId?: string
  ): Promise<{ success: boolean; error?: string; athlete?: StravaAthlete }> {
    try {
      let authResponse: {
        access_token: string;
        refresh_token: string;
        expires_at: number;
        athlete?: StravaAthlete;
      } | null = null;

      // 1. Try InsForge Edge Function (Recommended for production)
      try {
        const edgeRes = await fetch(FN_STRAVA_AUTH, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'exchange',
            code,
            redirect_uri: redirectUri || `${window.location.origin}/strava-callback.html`,
          }),
        });

        if (edgeRes.ok) {
          authResponse = await edgeRes.json();
        }
      } catch (edgeErr) {
        console.warn('InsForge strava-auth edge function not reached:', edgeErr);
      }

      // 2. Direct fallback if credentials are provided in env
      if (!authResponse && STRAVA_CLIENT_ID && STRAVA_CLIENT_SECRET) {
        const res = await fetch('https://www.strava.com/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: STRAVA_CLIENT_ID,
            client_secret: STRAVA_CLIENT_SECRET,
            code,
            grant_type: 'authorization_code',
          }),
        });

        if (res.ok) {
          authResponse = await res.json();
        } else {
          const errData = await res.json().catch(() => ({}));
          return {
            success: false,
            error: errData.message || 'Strava token exchange failed.',
          };
        }
      }

      if (!authResponse || !authResponse.access_token) {
        return {
          success: false,
          error:
            'Unable to exchange Strava authorization code. Please verify your Strava Client ID & Secret.',
        };
      }

      const tokens: StravaTokens = {
        access_token: authResponse.access_token,
        refresh_token: authResponse.refresh_token,
        expires_at: authResponse.expires_at,
      };

      await this.saveTokens(tokens, authResponse.athlete, userId);

      return {
        success: true,
        athlete: authResponse.athlete,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Strava authentication failed.',
      };
    }
  }

  /**
   * Initiate Connect flow via popup or redirect
   */
  async connect(): Promise<{ success: boolean; error?: string; accountEmail?: string }> {
    if (typeof window === 'undefined') {
      return { success: false, error: 'Cannot connect outside browser.' };
    }

    const authUrl = this.getAuthorizationUrl();

    // Check if we can open a popup
    const width = 600;
    const height = 750;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      authUrl,
      'strava_oauth_popup',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`
    );

    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      // Popup blocked — redirect directly
      window.location.href = authUrl;
      return { success: false, error: 'Redirecting to Strava authorization...' };
    }

    return new Promise((resolve) => {
      this.setConnectionState({ status: 'connecting' });

      const checkInterval = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(checkInterval);
          window.removeEventListener('message', messageListener);
          const state = this.getConnectionState();
          if (state.isConnected) {
            resolve({ success: true, accountEmail: state.accountEmail || undefined });
          } else {
            this.setConnectionState({ status: 'disconnected' });
            resolve({ success: false, error: 'Strava authorization window was closed.' });
          }
        }
      }, 800);

      const messageListener = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.type === 'RUNWAR_STRAVA_AUTH_CODE' && event.data?.code) {
          clearInterval(checkInterval);
          window.removeEventListener('message', messageListener);
          if (popup && !popup.closed) popup.close();

          const result = await this.exchangeAuthorizationCode(event.data.code);
          if (result.success) {
            resolve({
              success: true,
              accountEmail: result.athlete
                ? `${result.athlete.firstname || ''} ${result.athlete.lastname || ''}`.trim()
                : 'Strava Athlete',
            });
          } else {
            resolve({ success: false, error: result.error });
          }
        }
      };

      window.addEventListener('message', messageListener);
    });
  }

  /**
   * Disconnect and clear Strava credentials, and purge all synced Strava workouts
   */
  async disconnect(userId?: string): Promise<void> {
    try {
      const activeUserId =
        userId || (insforge.auth as any)?.currentUser?.id || 'guest_user';
      const tokens = this.getStoredTokens();

      // Revoke token on Strava servers if possible and not a demo token
      if (tokens?.access_token && !tokens.access_token.startsWith('demo_')) {
        fetch(
          `https://www.strava.com/oauth/deauthorize?access_token=${encodeURIComponent(
            tokens.access_token
          )}`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${tokens.access_token}`,
              'Content-Type': 'application/json',
            },
          }
        ).catch(() => {});
      }

      // 1. Immediately wipe local Strava state and notify listeners so UI and workout queries know we are disconnected
      localStorage.removeItem(STRAVA_TOKENS_STORAGE_KEY);
      localStorage.removeItem(STRAVA_STATE_STORAGE_KEY);

      this.memoryState = {
        provider: 'strava',
        isConnected: false,
        lastSyncAt: null,
        syncedCount: 0,
        status: 'disconnected',
        autoSync: true,
        autoUpload: false,
      };
      this.notifyListeners();

      // 2. Mark disconnected in PostgreSQL DB if authenticated
      if (activeUserId && activeUserId !== 'guest_user' && navigator.onLine) {
        try {
          await insforge.database
            .from('user_integrations')
            .update({
              is_connected: false,
              access_token: null,
              refresh_token: null,
              synced_count: 0,
              last_synced_at: null,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', activeUserId)
            .eq('provider', 'strava');
        } catch (dbErr) {
          console.warn('Failed to update user_integrations on disconnect:', dbErr);
        }
      }

      // 3. Purge all Strava workouts (both demo sandbox & real) from all sections, databases, and caches
      await workoutService.deleteWorkoutsByProvider('strava', activeUserId);
    } catch (e) {
      console.warn('Error disconnecting Strava:', e);
    }
  }

  /**
   * Fetch and sync activities from Strava into RunWar
   */
  async syncWorkouts(
    userId: string,
    sinceDate?: Date,
    onProgress?: SyncProgressCallback
  ): Promise<SyncResult> {
    if (this.isSyncingActive) {
      return {
        success: false,
        importedCount: 0,
        skippedCount: 0,
        newWorkouts: [],
        error: 'A sync is already in progress.',
      };
    }

    const token = await this.getValidAccessToken(userId);
    if (!token) {
      return {
        success: false,
        importedCount: 0,
        skippedCount: 0,
        newWorkouts: [],
        error: 'Not authenticated with Strava. Please connect your account first.',
      };
    }

    this.isSyncingActive = true;
    this.setConnectionState({ status: 'syncing' });

    try {
      // Determine timestamp cutoff (default to past 90 days if not specified)
      const afterTimestamp = sinceDate
        ? Math.floor(sinceDate.getTime() / 1000)
        : Math.floor(Date.now() / 1000) - 90 * 24 * 3600;

      onProgress?.({
        current: 0,
        total: 1,
        newlySynced: 0,
        status: 'discovering',
        currentTitle: 'Fetching activities from Strava...',
      });

      // Query Strava activities
      const url = `https://www.strava.com/api/v3/athlete/activities?after=${afterTimestamp}&page=1&per_page=50`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          // Token expired, attempt refresh
          const refreshed = await this.refreshAccessToken(
            this.getStoredTokens()?.refresh_token || '',
            userId
          );
          if (!refreshed) {
            throw new Error('Strava authentication expired. Please reconnect.');
          }
          return this.syncWorkouts(userId, sinceDate, onProgress);
        }
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Strava API returned status ${res.status}`);
      }

      const activities: StravaActivitySummary[] = await res.json();

      // Filter only running, walking, and jogging activities
      const eligible = activities.filter((act) => {
        const type = (act.type || act.sport_type || '').toLowerCase();
        return (
          type.includes('run') ||
          type.includes('walk') ||
          type.includes('hike') ||
          type.includes('trail')
        );
      });

      if (eligible.length === 0) {
        this.setConnectionState({
          status: 'connected',
          lastSyncAt: new Date().toISOString(),
        });
        return {
          success: true,
          importedCount: 0,
          skippedCount: 0,
          newWorkouts: [],
        };
      }

      const normalizedWorkouts: Workout[] = [];

      for (let i = 0; i < eligible.length; i++) {
        const act = eligible[i];
        onProgress?.({
          current: i + 1,
          total: eligible.length,
          newlySynced: normalizedWorkouts.length,
          status: 'processing',
          currentTitle: act.name,
        });

        const startedAt = new Date(act.start_date).toISOString();
        const durationSec = Math.max(1, act.moving_time || act.elapsed_time || 0);
        const distanceM = act.distance || 0;
        const avgSpeedKmh = act.average_speed ? act.average_speed * 3.6 : 0;
        const maxSpeedKmh = act.max_speed ? act.max_speed * 3.6 : avgSpeedKmh;
        const avgPaceSec =
          distanceM > 0 ? (durationSec / (distanceM / 1000)) : 0;

        // Decode GPS Polyline
        const coords: GPSCoordinate[] = polylineToGPSCoordinates(
          act.map?.summary_polyline,
          startedAt,
          durationSec,
          avgSpeedKmh
        );

        // Convert splits
        const splits: WorkoutSplit[] = (act.splits_metric || []).map((s) => ({
          split_number: s.split,
          distance_meters: s.distance,
          duration_seconds: s.moving_time || s.elapsed_time,
          pace: s.distance > 0 ? (s.moving_time / (s.distance / 1000)) : avgPaceSec,
        }));

        const type: 'run' | 'jog' | 'walk' =
          act.type.toLowerCase().includes('walk') || act.type.toLowerCase().includes('hike')
            ? 'walk'
            : avgSpeedKmh > 10
            ? 'run'
            : 'jog';

        const deterministicId = toDeterministicUUID(`strava_${act.id}_${userId}`);

        const workout: Workout = {
          id: deterministicId,
          user_id: userId,
          type,
          title: act.name || 'Strava Run',
          notes: `Imported from Strava (Activity #${act.id})`,
          started_at: startedAt,
          ended_at: new Date(new Date(startedAt).getTime() + durationSec * 1000).toISOString(),
          duration_seconds: durationSec,
          moving_duration_seconds: act.moving_time || durationSec,
          paused_duration_seconds: Math.max(0, (act.elapsed_time || durationSec) - durationSec),
          distance_meters: Math.round(distanceM),
          average_pace: Math.round(avgPaceSec),
          average_speed: Number(avgSpeedKmh.toFixed(2)),
          max_speed: Number(maxSpeedKmh.toFixed(2)),
          calories: act.calories ? Math.round(act.calories) : Math.round((distanceM / 1000) * 65),
          elevation_gain: act.total_elevation_gain ? Math.round(act.total_elevation_gain) : 0,
          elevation_loss: 0,
          status: 'completed',
          route_coordinates: coords,
          splits,
          source_provider: 'strava',
          external_record_id: String(act.id),
          heart_rate_avg: act.average_heartrate ? Math.round(act.average_heartrate) : null,
          created_at: new Date().toISOString(),
        };

        normalizedWorkouts.push(workout);
      }

      // Save and deduplicate using RunWar's existing batch workout saver
      const saveResult = await workoutService.saveImportedWorkouts(normalizedWorkouts);

      // Update sync count in database and local state
      const totalStravaCount = workoutService
        .getCachedWorkouts()
        .filter((w) => w.source_provider === 'strava').length;

      this.setConnectionState({
        status: 'connected',
        lastSyncAt: new Date().toISOString(),
        syncedCount: totalStravaCount,
      });

      // Update InsForge Database
      if (userId && navigator.onLine) {
        await insforge.database
          .from('user_integrations')
          .update({
            last_synced_at: new Date().toISOString(),
            synced_count: totalStravaCount,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
          .eq('provider', 'strava');
      }

      onProgress?.({
        current: eligible.length,
        total: eligible.length,
        newlySynced: saveResult.savedCount,
        status: 'completed',
        currentTitle: 'Sync completed!',
      });

      return {
        success: true,
        importedCount: saveResult.savedCount,
        skippedCount: eligible.length - saveResult.savedCount,
        newWorkouts: normalizedWorkouts,
      };
    } catch (err: any) {
      console.error('Strava sync error:', err);
      this.setConnectionState({
        status: 'error',
        errorMessage: err?.message || 'Failed to sync with Strava.',
      });
      return {
        success: false,
        importedCount: 0,
        skippedCount: 0,
        newWorkouts: [],
        error: err?.message || 'Failed to sync workouts from Strava.',
      };
    } finally {
      this.isSyncingActive = false;
    }
  }

  /**
   * Upload / Push a RunWar GPS workout to Strava
   */
  async uploadWorkout(
    workout: Workout,
    userId?: string
  ): Promise<{ success: boolean; uploadId?: number; activityId?: number; error?: string }> {
    const token = await this.getValidAccessToken(userId);
    if (!token) {
      return { success: false, error: 'Not connected to Strava.' };
    }

    try {
      const gpxContent = generateGPX(workout);
      const gpxBlob = new Blob([gpxContent], { type: 'application/gpx+xml' });

      const formData = new FormData();
      formData.append('file', gpxBlob, `runwar_${workout.id}.gpx`);
      formData.append('name', workout.title || 'RunWar Workout');
      formData.append('description', 'Recorded with RunWar Fitness App 🏃⚡');
      formData.append('data_type', 'gpx');
      formData.append(
        'activity_type',
        workout.type === 'run' ? 'run' : workout.type === 'walk' ? 'walk' : 'run'
      );

      const res = await fetch('https://www.strava.com/api/v3/uploads', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        return {
          success: false,
          error: errJson.message || `Upload failed with status ${res.status}`,
        };
      }

      const uploadData: StravaUploadResponse = await res.json();
      return {
        success: true,
        uploadId: uploadData.id,
        activityId: uploadData.activity_id || undefined,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Failed to upload workout to Strava.',
      };
    }
  }

  /**
   * Instant Sandbox / Demo Connection for testing without real Strava API keys
   */
  async simulateDemoConnection(userId: string = 'guest_user'): Promise<{ success: boolean; importedCount: number }> {
    this.isSyncingActive = true;
    this.setConnectionState({ status: 'syncing' });

    // Artificial brief delay for realistic UI feedback
    await new Promise((resolve) => setTimeout(resolve, 600));

    const demoAthlete: StravaAthlete = {
      id: 987654,
      username: 'runner_pro',
      firstname: 'Alex',
      lastname: 'Morgan',
      city: 'San Francisco',
      country: 'United States',
      profile: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&h=120&fit=crop&crop=faces',
    };

    const dummyTokens: StravaTokens = {
      access_token: 'demo_strava_token_' + Date.now(),
      refresh_token: 'demo_strava_refresh_' + Date.now(),
      expires_at: Math.floor(Date.now() / 1000) + 21600,
    };

    // Generate realistic GPS loop
    const baseLat = 37.7749;
    const baseLng = -122.4194;
    const now = Date.now();

    const generateRoute = (pointsCount: number, radiusKm: number, startTime: number, durationSec: number): GPSCoordinate[] => {
      const stepMs = (durationSec * 1000) / pointsCount;
      const coords: GPSCoordinate[] = [];
      for (let i = 0; i < pointsCount; i++) {
        const angle = (i / pointsCount) * 2 * Math.PI;
        // loop with slight wobble
        const latOffset = (radiusKm / 111) * Math.sin(angle) + Math.sin(i * 0.5) * 0.0002;
        const lngOffset = (radiusKm / (111 * Math.cos(baseLat * (Math.PI / 180)))) * Math.cos(angle);
        coords.push({
          latitude: baseLat + latOffset,
          longitude: baseLng + lngOffset,
          altitude: 15 + Math.sin(angle * 3) * 12,
          accuracy: 4,
          speed: 3.2,
          timestamp: startTime + i * stepMs,
        });
      }
      return coords;
    };

    // Demo Workout 1: 5K Morning Run
    const run1Duration = 1480; // 24 min 40 sec
    const run1Distance = 5040; // 5.04 km
    const run1Start = new Date(now - 86400000).toISOString();
    const run1Coords = generateRoute(50, 0.8, new Date(run1Start).getTime(), run1Duration);

    const demoWorkout1: Workout = {
      id: toDeterministicUUID(`strava_demo_101_${userId}`),
      user_id: userId,
      type: 'run',
      title: 'Sunrise 5K Run',
      notes: 'Imported from Strava (Activity #10192837)',
      started_at: run1Start,
      ended_at: new Date(new Date(run1Start).getTime() + run1Duration * 1000).toISOString(),
      duration_seconds: run1Duration,
      moving_duration_seconds: run1Duration,
      paused_duration_seconds: 0,
      distance_meters: run1Distance,
      average_pace: Math.round(run1Duration / (run1Distance / 1000)), // ~293 sec/km (4:53 /km)
      average_speed: 12.26,
      max_speed: 14.8,
      calories: 345,
      elevation_gain: 36,
      elevation_loss: 34,
      status: 'completed',
      route_coordinates: run1Coords,
      splits: [
        { split_number: 1, distance_meters: 1000, duration_seconds: 298, pace: 298 },
        { split_number: 2, distance_meters: 1000, duration_seconds: 295, pace: 295 },
        { split_number: 3, distance_meters: 1000, duration_seconds: 292, pace: 292 },
        { split_number: 4, distance_meters: 1000, duration_seconds: 290, pace: 290 },
        { split_number: 5, distance_meters: 1040, duration_seconds: 305, pace: 293 },
      ],
      source_provider: 'strava',
      external_record_id: 'demo_10192837',
      heart_rate_avg: 156,
      created_at: new Date().toISOString(),
    };

    // Demo Workout 2: 8K Trail Workout
    const run2Duration = 2620; // 43 min 40 sec
    const run2Distance = 8120; // 8.12 km
    const run2Start = new Date(now - 259200000).toISOString();
    const run2Coords = generateRoute(80, 1.3, new Date(run2Start).getTime(), run2Duration);

    const demoWorkout2: Workout = {
      id: toDeterministicUUID(`strava_demo_102_${userId}`),
      user_id: userId,
      type: 'run',
      title: 'Weekend Trail Interval',
      notes: 'Imported from Strava (Activity #10248192)',
      started_at: run2Start,
      ended_at: new Date(new Date(run2Start).getTime() + run2Duration * 1000).toISOString(),
      duration_seconds: run2Duration,
      moving_duration_seconds: run2Duration,
      paused_duration_seconds: 0,
      distance_meters: run2Distance,
      average_pace: Math.round(run2Duration / (run2Distance / 1000)), // ~322 sec/km (5:22 /km)
      average_speed: 11.16,
      max_speed: 15.2,
      calories: 590,
      elevation_gain: 88,
      elevation_loss: 85,
      status: 'completed',
      route_coordinates: run2Coords,
      splits: [
        { split_number: 1, distance_meters: 1000, duration_seconds: 330, pace: 330 },
        { split_number: 2, distance_meters: 1000, duration_seconds: 325, pace: 325 },
        { split_number: 3, distance_meters: 1000, duration_seconds: 320, pace: 320 },
        { split_number: 4, distance_meters: 1000, duration_seconds: 318, pace: 318 },
        { split_number: 5, distance_meters: 1000, duration_seconds: 324, pace: 324 },
        { split_number: 6, distance_meters: 1000, duration_seconds: 322, pace: 322 },
        { split_number: 7, distance_meters: 1000, duration_seconds: 315, pace: 315 },
        { split_number: 8, distance_meters: 1120, duration_seconds: 366, pace: 326 },
      ],
      source_provider: 'strava',
      external_record_id: 'demo_10248192',
      heart_rate_avg: 162,
      created_at: new Date().toISOString(),
    };

    await workoutService.saveImportedWorkouts([demoWorkout1, demoWorkout2]);
    await this.saveTokens(dummyTokens, demoAthlete, userId);

    const totalStravaCount = workoutService
      .getCachedWorkouts()
      .filter((w) => w.source_provider === 'strava').length;

    this.setConnectionState({
      isConnected: true,
      status: 'connected',
      accountEmail: 'Alex Morgan (Demo)',
      athlete: demoAthlete,
      lastSyncAt: new Date().toISOString(),
      syncedCount: totalStravaCount,
    });

    this.isSyncingActive = false;
    return { success: true, importedCount: 2 };
  }
}

export const stravaProvider = new StravaProvider();
