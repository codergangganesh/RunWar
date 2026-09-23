import { HealthProvider, NormalizedExternalWorkout, SyncProgressCallback, SyncResult } from './types';
import { HealthConnectionState, Workout, WorkoutType, GPSCoordinate, WorkoutSplit } from '../../types';
import { workoutService } from '../workoutService';
import { toDeterministicUUID } from '../../utils/uuid';

const GOOGLE_FIT_AUTH_STORAGE_KEY = 'runwar_google_fit_token';
const GOOGLE_FIT_STATE_STORAGE_KEY = 'runwar_google_fit_state';

// Google OAuth Client ID loaded strictly from environment variables (.env.local)
const GOOGLE_CLIENT_ID: string =
  (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '';

// InsForge backend base URL — edge functions live here
const INSFORGE_URL: string =
  (import.meta as any).env?.VITE_INSFORGE_URL || 'https://7p7ewmvi.us-east.insforge.app';
const INSFORGE_ANON_KEY: string =
  (import.meta as any).env?.VITE_INSFORGE_ANON_KEY || '';

// Backend edge function URLs hosted on InsForge
const FN_BASE =
  (import.meta as any).env?.VITE_INSFORGE_FUNCTIONS_URL ||
  'https://7p7ewmvi.function2.insforge.app';

export const FN_AUTH = `${FN_BASE}/google-fit-auth`;
export const FN_CALLBACK = `${FN_BASE}/google-fit-callback`;
export const FN_DATA = `${FN_BASE}/google-fit-data`;

const SCOPES = [
  'https://www.googleapis.com/auth/fitness.activity.read',
  'https://www.googleapis.com/auth/fitness.location.read',
  'https://www.googleapis.com/auth/fitness.body.read',
  'https://www.googleapis.com/auth/fitness.heart_rate.read',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'openid',
].join(' ');

export class GoogleHealthProvider implements HealthProvider {
  readonly providerType = 'google_health' as const;
  readonly providerName = 'Google Health & Fit';

  private memoryState: HealthConnectionState | null = null;
  private listeners = new Set<(state: HealthConnectionState) => void>();
  private isSyncingActive = false;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Subscribe to real-time health connection and sync progress updates
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
        console.warn('Error in health connection subscriber:', e);
      }
    });
  }

  public isSyncing(): boolean {
    return this.isSyncingActive;
  }

  /**
   * Check if running in browser/PWA with internet connectivity
   */
  async checkAvailability(): Promise<boolean> {
    return typeof window !== 'undefined' && navigator.onLine;
  }

  /**
   * Get cached connection state with live in-memory progress and accurate workout count
   */
  getConnectionState(): HealthConnectionState {
    if (this.memoryState) {
      return this.memoryState;
    }

    try {
      const stored = localStorage.getItem(GOOGLE_FIT_STATE_STORAGE_KEY);
      const cachedWorkouts = workoutService.getCachedWorkouts();
      const actualGoogleCount = cachedWorkouts.filter(
        (w) => w.source_provider === 'google_health'
      ).length;

      if (stored) {
        const parsed = JSON.parse(stored);
        const syncedCount = actualGoogleCount > 0 ? actualGoogleCount : (Number(parsed.syncedCount) || 0);
        return {
          provider: 'google_health',
          isConnected: Boolean(parsed.isConnected),
          lastSyncAt: parsed.lastSyncAt || null,
          syncedCount,
          accountEmail: parsed.accountEmail || null,
          status: parsed.isConnected ? 'connected' : 'disconnected',
          errorMessage: null,
          syncProgress: null,
        };
      } else if (actualGoogleCount > 0) {
        return {
          provider: 'google_health',
          isConnected: true,
          lastSyncAt: null,
          syncedCount: actualGoogleCount,
          accountEmail: null,
          status: 'connected',
          errorMessage: null,
          syncProgress: null,
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
      errorMessage: null,
      syncProgress: null,
    };
  }

  /**
   * Save connection state and broadcast to active UI subscribers
   */
  private setConnectionState(state: Partial<HealthConnectionState>) {
    try {
      const current = this.getConnectionState();
      const updated = { ...current, ...state };
      this.memoryState = updated;

      // Persist durable state to localStorage (omit transient progress)
      const durable = {
        isConnected: updated.isConnected,
        lastSyncAt: updated.lastSyncAt,
        syncedCount: updated.syncedCount,
        accountEmail: updated.accountEmail,
      };
      localStorage.setItem(GOOGLE_FIT_STATE_STORAGE_KEY, JSON.stringify(durable));
      this.notifyListeners();
    } catch (e) {
      console.warn('Failed to save Google Health state:', e);
    }
  }

  /**
   * Get cached access token if valid (checks localStorage for persistence across reloads)
   */
  public getValidAccessToken(): string | null {
    try {
      // Check localStorage first (persists across reloads)
      const item = localStorage.getItem(GOOGLE_FIT_AUTH_STORAGE_KEY);
      if (item) {
        if (item.startsWith('{')) {
          const { token, expiresAt } = JSON.parse(item);
          if (expiresAt && Date.now() > expiresAt) {
            // Token expired — clean up
            localStorage.removeItem(GOOGLE_FIT_AUTH_STORAGE_KEY);
            return null;
          }
          return token || null;
        }
        return item;
      }
      // Legacy: fall back to sessionStorage (migrate if found)
      const sessionItem = sessionStorage.getItem(GOOGLE_FIT_AUTH_STORAGE_KEY);
      if (sessionItem) {
        // Migrate to localStorage so it survives refreshes
        localStorage.setItem(GOOGLE_FIT_AUTH_STORAGE_KEY, sessionItem);
        sessionStorage.removeItem(GOOGLE_FIT_AUTH_STORAGE_KEY);
        const parsed = JSON.parse(sessionItem);
        if (parsed.expiresAt && Date.now() > parsed.expiresAt) return null;
        return parsed.token || null;
      }
    } catch {
      // ignore
    }
    return null;
  }

  private getAccessToken(): string | null {
    return this.getValidAccessToken();
  }

  /**
   * Save access token in localStorage with expiry so it survives page reloads.
   * Also schedules a silent refresh before the token expires.
   */
  private setAccessToken(token: string, expiresInSec: number) {
    const expiresAt = Date.now() + (expiresInSec - 60) * 1000;
    localStorage.setItem(
      GOOGLE_FIT_AUTH_STORAGE_KEY,
      JSON.stringify({ token, expiresAt })
    );
    // Also clear any legacy session storage entry
    try { sessionStorage.removeItem(GOOGLE_FIT_AUTH_STORAGE_KEY); } catch { }
    // Schedule automatic token refresh before this token expires
    this.scheduleTokenRefresh(expiresAt);
  }

  /**
   * Read the stored token expiry timestamp from localStorage.
   */
  private getTokenExpiresAt(): number | null {
    try {
      const item = localStorage.getItem(GOOGLE_FIT_AUTH_STORAGE_KEY);
      if (!item) return null;
      if (item.startsWith('{')) {
        const { expiresAt } = JSON.parse(item);
        return expiresAt ? Number(expiresAt) : null;
      }
    } catch { }
    return null;
  }

  /**
   * Schedule a silent background token refresh 5 minutes before the current token expires.
   * This keeps the connection alive indefinitely without user interaction.
   */
  private scheduleTokenRefresh(expiresAt: number) {
    // Clear any existing refresh timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    const refreshInMs = expiresAt - Date.now() - 5 * 60 * 1000; // 5 min before expiry
    if (refreshInMs <= 0) {
      // Already close to expiry or expired — refresh immediately
      this.silentRefresh();
      return;
    }

    this.refreshTimer = setTimeout(() => {
      this.silentRefresh();
    }, refreshInMs);
  }

  /**
   * Perform a silent token refresh using GIS without showing any UI.
   * Called automatically by the refresh timer.
   */
  private async silentRefresh(): Promise<void> {
    if (!GOOGLE_CLIENT_ID) return;

    const storedState = (() => {
      try { return JSON.parse(localStorage.getItem(GOOGLE_FIT_STATE_STORAGE_KEY) || 'null'); } catch { return null; }
    })();
    if (!storedState?.isConnected) return;

    const gsiLoaded = await this.ensureGsiLoaded().catch(() => false);
    if (!gsiLoaded) return;

    return new Promise<void>((resolve) => {
      try {
        const client = (window as any).google?.accounts?.oauth2?.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: SCOPES,
          prompt: '',
          error_callback: () => resolve(),
          callback: (response: any) => {
            if (response.access_token) {
              // setAccessToken also re-schedules the next refresh automatically
              this.setAccessToken(response.access_token, Number(response.expires_in) || 3600);
              this.setConnectionState({ isConnected: true, status: 'connected' });
            }
            resolve();
          },
        });
        if (client) {
          client.requestAccessToken({ prompt: '' });
        } else {
          resolve();
        }
      } catch {
        resolve();
      }
    });
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
   * Allow other services to update cached token directly
   */
  public setAccessTokenDirectly(token: string, expiresInSec: number) {
    this.setAccessToken(token, expiresInSec);
  }

  /**
   * Allow other services to update connection state directly
   */
  public setConnectionStateDirectly(state: Partial<HealthConnectionState>) {
    this.setConnectionState(state);
  }

  /**
   * Get active user ID for persistent cloud token association.
   * Checks session user, cached profile, and device ID in order.
   */
  public getUserId(): string {
    try {
      const raw = localStorage.getItem('runwar_session_user');
      if (raw) {
        const u = JSON.parse(raw);
        if (u?.id) return u.id;
      }
    } catch {}
    try {
      const prof = localStorage.getItem('runwar_cached_profile');
      if (prof) {
        const p = JSON.parse(prof);
        if (p?.user_id) return p.user_id;
      }
    } catch {}
    try {
      const raw = localStorage.getItem('runwar_user');
      if (raw) {
        const u = JSON.parse(raw);
        if (u?.id) return u.id;
      }
    } catch {}
    let deviceId = localStorage.getItem('runwar_device_user_id');
    if (!deviceId) {
      deviceId = 'usr_' + Math.random().toString(36).substring(2, 12);
      localStorage.setItem('runwar_device_user_id', deviceId);
    }
    return deviceId;
  }

  /**
   * Get active user email if available
   */
  public getUserEmail(): string | null {
    try {
      const raw = localStorage.getItem('runwar_session_user');
      if (raw) {
        const u = JSON.parse(raw);
        if (u?.email) return u.email;
      }
    } catch {}
    try {
      const prof = localStorage.getItem('runwar_cached_profile');
      if (prof) {
        const p = JSON.parse(prof);
        if (p?.email) return p.email;
      }
    } catch {}
    return null;
  }

  /**
   * Ensure a valid access token exists. Checks local cache first;
   * if expired or missing, requests a freshly refreshed token from InsForge backend.
   */
  public async getOrRefreshToken(): Promise<string | null> {
    const cached = this.getValidAccessToken();
    if (cached) return cached;

    try {
      const userId = this.getUserId();
      const email = this.getUserEmail();
      const devId = localStorage.getItem('runwar_device_user_id') || undefined;

      const res = await fetch(FN_DATA, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          email,
          device_id: devId,
          action: 'get_token',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.access_token) {
          this.setAccessToken(data.access_token, Number(data.expires_in) || 3600);
          this.setConnectionState({
            isConnected: true,
            status: 'connected',
            accountEmail: data.accountEmail || undefined,
          });
          return data.access_token;
        }
      }
    } catch (e) {
      console.warn('Failed to fetch/refresh token from InsForge backend:', e);
    }

    return null;
  }

  /**
   * Handle OAuth redirect parameters from URL (?google_connected=true or ?google_error=...)
   */
  public handleUrlParams(): boolean {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    if (params.get('google_connected') === 'true') {
      const email = params.get('email') || '';
      const accessToken = params.get('access_token');
      const expiresIn = Number(params.get('expires_in')) || 3600;

      if (accessToken) {
        this.setAccessToken(accessToken, expiresIn);
      }

      this.setConnectionState({
        isConnected: true,
        status: 'connected',
        accountEmail: email || null,
      });

      // Clean OAuth query parameters from URL without reloading or wiping target screen/tab
      const url = new URL(window.location.href);
      url.searchParams.delete('google_connected');
      url.searchParams.delete('email');
      url.searchParams.delete('access_token');
      url.searchParams.delete('expires_in');
      window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : ''));
      return true;
    }
    if (params.get('google_error')) {
      const err = params.get('google_error') || '';
      console.warn('[GoogleHealth] OAuth error in URL:', err);
      let humanMsg = 'Google connection failed.';
      if (err.includes('invalid_client') || err.includes('client secret')) {
        humanMsg = 'Google Client Secret is invalid. Please verify the client secret in Google Cloud Console.';
      } else if (err.includes('no_refresh_token')) {
        humanMsg = 'No refresh token received from Google. Please try connecting again.';
      } else if (err.includes('access_denied')) {
        humanMsg = 'Access was denied. Please allow fitness permissions in Google.';
      }
      this.setConnectionState({
        isConnected: false,
        status: 'error',
        errorMessage: humanMsg,
      });
      const url = new URL(window.location.href);
      url.searchParams.delete('google_error');
      window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : ''));
    }
    return false;
  }

  /**
   * Call this on app startup to restore the persistent connection.
   * - Checks incoming OAuth callback parameters
   * - Respects explicit disconnect
   * - Automatically marks connection as active if persisted in storage
   */
  public async startPersistentConnection(): Promise<boolean> {
    // 1. Process any incoming OAuth callback params
    this.handleUrlParams();

    // 2. Check stored connection state
    const storedState = (() => {
      try { return JSON.parse(localStorage.getItem(GOOGLE_FIT_STATE_STORAGE_KEY) || 'null'); } catch { return null; }
    })();

    // Respect explicit disconnect
    if (!storedState || storedState.isConnected === false) return false;

    // Tokens are safely managed in InsForge backend with auto-refresh
    this.setConnectionState({
      isConnected: true,
      status: 'connected',
      accountEmail: storedState.accountEmail || null,
    });

    // Silently fetch fresh access token in background if not in cache
    this.getOrRefreshToken().catch(() => {});

    return true;
  }

  /**
   * Silently attempt to re-obtain a Google access token if GIS client is loaded
   */
  public async tryAutoReconnect(): Promise<boolean> {
    return this.startPersistentConnection();
  }

  /**
   * Connect to Google Health via InsForge backend authorization code flow.
   * Opens Google OAuth consent screen, securely exchanges authorization code for
   * persistent refresh token in InsForge DB, and updates app state.
   */
  async connect(sourceScreen?: string): Promise<{ success: boolean; error?: string; accountEmail?: string }> {
    const userId = this.getUserId();
    const url = new URL(window.location.origin);
    if (sourceScreen === 'connected_health') {
      url.searchParams.set('screen', 'connected_health');
    } else if (sourceScreen === 'activity' || sourceScreen === 'today') {
      url.searchParams.set('tab', 'activity');
    }
    const returnUrl = url.toString();

    try {
      // 1. Get OAuth authorization URL from InsForge edge function
      const res = await fetch(`${FN_AUTH}?user_id=${encodeURIComponent(userId)}&return_url=${encodeURIComponent(returnUrl)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { success: false, error: err.error || 'Failed to initialize Google Health authorization.' };
      }

      const { url: authUrl } = await res.json();
      if (!authUrl) {
        return { success: false, error: 'No authorization URL returned from InsForge.' };
      }

      // 2. Direct redirect to Google OAuth (eliminates COOP window.closed warnings and works reliably on all devices)
      window.location.href = authUrl;

      return new Promise(() => {});
    } catch (e: any) {
      console.error('[GoogleHealth] connect error:', e);
      return { success: false, error: e?.message || 'Failed to connect Google Health.' };
    }
  }

  /**
   * Disconnect and clear tokens from backend and client.
   * Tells InsForge backend to delete the stored tokens from google_oauth_tokens table.
   */
  async disconnect(): Promise<void> {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    const userId = this.getUserId();

    // 1. Delete server-stored tokens in InsForge DB
    try {
      await fetch(FN_DATA, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, action: 'disconnect' }),
      });
    } catch (e) {
      console.warn('Backend disconnect call failed:', e);
    }

    // 2. Remove any local tokens from storage
    try { localStorage.removeItem(GOOGLE_FIT_AUTH_STORAGE_KEY); } catch {}
    try { sessionStorage.removeItem(GOOGLE_FIT_AUTH_STORAGE_KEY); } catch {}
    try { localStorage.removeItem('runwar_google_fit_token_transfer'); } catch {}

    // 3. Mark connection state disconnected
    this.memoryState = null;
    this.setConnectionState({
      isConnected: false,
      status: 'disconnected',
      accountEmail: null,
      syncProgress: null,
    });
  }


  /**
   * Synchronize workouts from Google Health & Fitness REST API with real-time progress updates
   */
  async syncWorkouts(
    userId: string,
    sinceDate?: Date,
    onProgress?: SyncProgressCallback
  ): Promise<SyncResult> {
    // 1. Concurrency lock guard: Prevent duplicate simultaneous sync requests
    if (this.isSyncingActive) {
      return {
        success: false,
        importedCount: 0,
        skippedCount: 0,
        newWorkouts: [],
        error: 'Synchronization is already in progress.',
      };
    }

    let token = this.getAccessToken();
    if (!token) {
      token = await this.getOrRefreshToken();
    }
    if (!token) {
      this.setConnectionState({
        isConnected: false,
        status: 'disconnected',
        errorMessage: 'Google Health is not connected or authorization expired.',
        syncProgress: null,
      });
      return {
        success: false,
        importedCount: 0,
        skippedCount: 0,
        newWorkouts: [],
        error: 'Google Health is not connected or your authorization session expired. Please connect again.',
      };
    }

    this.isSyncingActive = true;
    const currentState = this.getConnectionState();
    const initialSyncedCount = currentState.syncedCount || 0;
    let newlySyncedCount = 0;
    let skippedCount = 0;
    const validNewWorkouts: Workout[] = [];

    // Broadcast sync started state
    this.setConnectionState({
      status: 'syncing',
      errorMessage: null,
      syncProgress: {
        current: 0,
        total: 0,
        newlySynced: 0,
        currentTitle: 'Discovering Google Fitness activities...',
      },
    });

    if (onProgress) {
      onProgress({
        current: 0,
        total: 0,
        newlySynced: 0,
        currentTitle: 'Discovering Google Fitness activities...',
        status: 'discovering',
      });
    }

    try {
      // Query 365 days of history on initial sync so past sessions are imported
      const startTime = sinceDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      const endTime = new Date();

      // 1. Fetch fitness sessions list from Google Fitness REST API
      const sessionsUrl = `https://www.googleapis.com/fitness/v1/users/me/sessions?startTime=${startTime.toISOString()}&endTime=${endTime.toISOString()}`;
      const sessionsRes = await fetch(sessionsUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!sessionsRes.ok) {
        if (sessionsRes.status === 401) {
          sessionStorage.removeItem(GOOGLE_FIT_AUTH_STORAGE_KEY);
          this.setConnectionState({
            isConnected: false,
            status: 'disconnected',
            errorMessage: 'Google authorization expired. Please click Connect to re-authorize.',
            syncProgress: null,
          });
          this.isSyncingActive = false;
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

      const totalSessions = validSessions.length;

      if (totalSessions === 0) {
        this.setConnectionState({
          status: 'connected',
          lastSyncAt: new Date().toISOString(),
          syncProgress: null,
        });
        this.isSyncingActive = false;
        return {
          success: true,
          importedCount: 0,
          skippedCount: 0,
          newWorkouts: [],
        };
      }

      // 2. Fetch existing workouts upfront for real-time duplicate checking
      const existingWorkouts = await workoutService.getWorkouts(userId, 'all', 'newest', 500);
      const initialGoogleWorkouts = existingWorkouts.filter(
        (w) => w.source_provider === 'google_health'
      );
      const initialSyncedCount = initialGoogleWorkouts.length;

      const existingIds = new Set(existingWorkouts.map((w) => w.id));
      const existingExternalKeys = new Set(
        existingWorkouts
          .filter((w) => w.source_provider && w.external_record_id)
          .map((w) => `${w.source_provider}_${w.external_record_id}`)
      );
      const existingStartTimes = existingWorkouts
        .map((w) => new Date(w.started_at).getTime())
        .filter((t) => !isNaN(t));

      // 3. Process sessions incrementally
      for (let i = 0; i < totalSessions; i++) {
        const session = validSessions[i];
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

        const workoutTitle =
          session.name ||
          `Google Health ${workoutType.charAt(0).toUpperCase() + workoutType.slice(1)}`;

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

        const externalRecordId = session.id || `gfit_${sessionStartMs}`;
        const deterministicId = toDeterministicUUID(`${userId}_google_health_${externalRecordId}`);
        const candidateKey = `google_health_${externalRecordId}`;

        // Strict duplicate prevention check
        let isDuplicate = false;
        if (existingIds.has(deterministicId)) {
          isDuplicate = true;
        } else if (existingExternalKeys.has(candidateKey)) {
          isDuplicate = true;
        } else {
          const hasTimeMatch = existingStartTimes.some(
            (t) => Math.abs(t - sessionStartMs) < 120 * 1000
          );
          if (hasTimeMatch) {
            isDuplicate = true;
          }
        }

        if (isDuplicate) {
          skippedCount++;
          // Update progress status without incrementing newlySynced count
          this.setConnectionState({
            syncedCount: initialSyncedCount + newlySyncedCount,
            syncProgress: {
              current: i + 1,
              total: totalSessions,
              newlySynced: newlySyncedCount,
              currentTitle: `${workoutTitle} (Already Synced)`,
            },
          });

          if (onProgress) {
            onProgress({
              current: i + 1,
              total: totalSessions,
              newlySynced: newlySyncedCount,
              currentTitle: `${workoutTitle} (Already Synced)`,
              status: 'saved',
            });
          }
        } else {
          // Update progress state: Processing new session
          this.setConnectionState({
            syncProgress: {
              current: i + 1,
              total: totalSessions,
              newlySynced: newlySyncedCount,
              currentTitle: workoutTitle,
            },
          });

          if (onProgress) {
            onProgress({
              current: i + 1,
              total: totalSessions,
              newlySynced: newlySyncedCount,
              currentTitle: workoutTitle,
              status: 'processing',
            });
          }

          // Fetch dataset metrics & GPS trackpoints for this session's time window
          let distanceMeters = 0;
          let calories = 0;
          let speedMps = 0;
          let coordinates: GPSCoordinate[] = [];
          let heartRateAvg: number | null = null;
          let stepCount = 0;

          try {
            const dataset = await this.fetchSessionDataset(token, sessionStartMs, sessionEndMs);
            distanceMeters = dataset.distanceMeters;
            calories = dataset.calories;
            speedMps = dataset.speedMps;
            coordinates = dataset.coordinates;
            heartRateAvg = dataset.heartRateAvg ?? null;
            stepCount = dataset.stepCount;
          } catch (datasetErr) {
            console.warn(`Error fetching dataset for session ${session.id}:`, datasetErr);
          }

          // Optimize coordinate count if excessive (sample max 1500 points for smooth performance)
          if (coordinates.length > 1500) {
            const step = Math.ceil(coordinates.length / 1500);
            coordinates = coordinates.filter((_, idx) => idx % step === 0 || idx === coordinates.length - 1);
          }

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

          // Construct normalized workout
          const normalized: NormalizedExternalWorkout = {
            externalRecordId,
            sourceProvider: 'google_health',
            type: workoutType,
            title: workoutTitle,
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
          };

          const newWorkout = this.convertToWorkout(normalized, userId);

          // Save workout to InsForge & local storage only if genuinely unique
          try {
            const saveResult = await workoutService.saveImportedWorkouts([newWorkout]);
            if (saveResult.savedCount > 0) {
              existingIds.add(deterministicId);
              existingExternalKeys.add(candidateKey);
              existingStartTimes.push(sessionStartMs);
              validNewWorkouts.push(newWorkout);
              newlySyncedCount++;

              // Increment synced count and immediately update UI
              const updatedTotalCount = initialSyncedCount + newlySyncedCount;
              this.setConnectionState({
                syncedCount: updatedTotalCount,
                syncProgress: {
                  current: i + 1,
                  total: totalSessions,
                  newlySynced: newlySyncedCount,
                  currentTitle: workoutTitle,
                },
              });

              if (onProgress) {
                onProgress({
                  current: i + 1,
                  total: totalSessions,
                  newlySynced: newlySyncedCount,
                  currentTitle: workoutTitle,
                  status: 'saved',
                });
              }

              // Emit window event so app views update without reload
              window.dispatchEvent(
                new CustomEvent('runwar:workout_synced', { detail: newWorkout })
              );
            } else {
              skippedCount++;
            }
          } catch (saveErr) {
            console.warn(`Failed to save workout ${workoutTitle}:`, saveErr);
          }
        }
      }

      // Reconcile final count directly against actual persisted workouts
      const allFinalWorkouts = await workoutService.getWorkouts(userId, 'all', 'newest', 500);
      const finalActualCount = allFinalWorkouts.filter(
        (w) => w.source_provider === 'google_health'
      ).length;

      this.setConnectionState({
        status: 'connected',
        syncedCount: finalActualCount,
        lastSyncAt: new Date().toISOString(),
        errorMessage: null,
        syncProgress: null,
      });

      this.isSyncingActive = false;

      // Dispatch global sync completed event
      window.dispatchEvent(
        new CustomEvent('runwar:sync_completed', {
          detail: { provider: 'google_health', importedCount: newlySyncedCount, skippedCount },
        })
      );

      return {
        success: true,
        importedCount: newlySyncedCount,
        skippedCount,
        newWorkouts: validNewWorkouts,
      };
    } catch (err: any) {
      console.error('Google Health sync error:', err);
      const currentSynced = initialSyncedCount + newlySyncedCount;
      this.setConnectionState({
        status: 'error',
        syncedCount: currentSynced,
        errorMessage: err?.message || 'Failed to sync with Google Health.',
        syncProgress: null,
      });
      this.isSyncingActive = false;
      return {
        success: false,
        importedCount: newlySyncedCount,
        skippedCount: validNewWorkouts.length,
        newWorkouts: validNewWorkouts,
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

    // 1. Query aggregate endpoint for metrics (distance, calories, speed, steps, heart rate)
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
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('Non-blocking dataset aggregate fetch warning:', e);
    }

    // 2. Fetch raw GPS location trackpoints across available location data sources
    try {
      const candidateLocationSources = [
        'derived:com.google.location.sample:com.google.android.gms:merge_location_samples',
        'raw:com.google.location.sample:com.google.android.gms:',
        'derived:com.google.location.sample:com.google.android.apps.fitness:user_input',
      ];

      // Dynamically discover all active location data sources (e.g. from Google Fit, Samsung Health, Strava, Garmin, Coros)
      try {
        const dsRes = await fetch(
          'https://www.googleapis.com/fitness/v1/users/me/dataSources?dataTypeName=com.google.location.sample',
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (dsRes.ok) {
          const dsData = await dsRes.json();
          const found = (dsData.dataSource || [])
            .map((d: any) => d.dataStreamId)
            .filter((id: string) => Boolean(id));
          if (found.length > 0) {
            candidateLocationSources.unshift(...found);
          }
        }
      } catch {}

      const uniqueSources = Array.from(new Set(candidateLocationSources));
      for (const streamId of uniqueSources) {
        if (coordinates.length >= 2) break; // Found valid GPS track

        try {
          const rawGpsUrl = `https://www.googleapis.com/fitness/v1/users/me/dataSources/${encodeURIComponent(
            streamId
          )}/datasets/${startNanos}-${endNanos}`;
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
                if (
                  typeof lat === 'number' &&
                  typeof lng === 'number' &&
                  !isNaN(lat) &&
                  !isNaN(lng) &&
                  (lat !== 0 || lng !== 0)
                ) {
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
        } catch {}
      }
    } catch (gpsErr) {
      console.warn('Non-blocking GPS stream query warning:', gpsErr);
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
   * Convert normalized workout to internal Workout model with deterministic UUID
   */
  private convertToWorkout(n: NormalizedExternalWorkout, userId: string): Workout {
    const deterministicId = toDeterministicUUID(`${userId}_google_health_${n.externalRecordId}`);
    return {
      id: deterministicId,
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
