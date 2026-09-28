import { insforge } from '../lib/insforge';
import { UserProfile, UserSettings } from '../types';
import { firebaseAuthService } from './firebaseAuthService';
import { toDeterministicUUID, isValidUUID } from '../utils/uuid';

const PROFILE_CACHE_KEY = 'runwar_cached_profile';
const SETTINGS_CACHE_KEY = 'runwar_cached_settings';
const SESSION_USER_KEY = 'runwar_session_user';
const AUTH_TOKEN_KEY = 'runwar_auth_token';
const PKCE_VERIFIER_KEY = 'runwar_oauth_pkce_verifier';

export function normalizeUserId(id?: string | null): string {
  if (!id) return toDeterministicUUID('guest_user');
  const trimmed = id.trim();
  if (isValidUUID(trimmed)) return trimmed.toLowerCase();
  return toDeterministicUUID(trimmed);
}

export const authService = {
  /**
   * Synchronously get locally cached session user
   */
  getCachedUser(): any | null {
    try {
      const cached = localStorage.getItem(SESSION_USER_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  },

  /**
   * Save session user to local cache
   */
  setCachedUser(user: any) {
    if (!user) return;
    try {
      const rawId = user.id || user.firebase_uid || user.user_id || user.uid;
      const normalizedUser = {
        ...user,
        id: rawId && rawId !== 'guest_user' ? normalizeUserId(rawId) : (rawId || 'guest_user'),
      };
      localStorage.setItem(SESSION_USER_KEY, JSON.stringify(normalizedUser));
    } catch (e) {
      console.warn('Failed to cache session user:', e);
    }
  },

  /**
   * Clear cached user session and purge device-local user data
   */
  clearCachedUser() {
    try {
      localStorage.removeItem(SESSION_USER_KEY);
      localStorage.removeItem(PROFILE_CACHE_KEY);
      localStorage.removeItem(SETTINGS_CACHE_KEY);
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(PKCE_VERIFIER_KEY);
      localStorage.removeItem('runwar_oauth_in_progress');
      sessionStorage.removeItem('insforge_pkce_verifier');
      localStorage.removeItem('runwar_google_fit_state');
      localStorage.removeItem('runwar_google_fit_token_transfer');
      // Clear social feed and reaction caches to prevent data leakage between sessions
      localStorage.removeItem('runwar_community_posts_cache');
      localStorage.removeItem('runwar_user_reactions_cache');
      // Clear all cached workouts to prevent account pollution while keeping setup flags intact
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('runwar_cached_workouts') || k.startsWith('runwar_community_'))) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('runwar:session_expired'));
      }
    } catch (e) {
      console.warn('Failed to clear cached user:', e);
    }
  },

  /**
   * Check if profile setup has been completed for a user
   */
  isProfileSetupComplete(userId: string, profile: UserProfile | null): boolean {
    if (!userId || !profile) return false;

    // 1. Explicit database-backed completion flag (highest precedence)
    if (typeof profile.profile_completed === 'boolean') {
      return profile.profile_completed;
    }

    // 2. Legacy fallback for existing cached sessions / users
    try {
      const localFlag = localStorage.getItem(`runwar_profile_setup_done_${userId}`);
      if (localFlag === 'true') return true;
    } catch { }

    const hasUsername = typeof profile.username === 'string' && profile.username.trim().length > 0;
    if (hasUsername) {
      try {
        localStorage.setItem(`runwar_profile_setup_done_${userId}`, 'true');
      } catch { }
      return true;
    }

    return false;
  },

  /**
   * Get current authenticated user session from InsForge
   */
  async getCurrentUser() {
    try {
      const cached = this.getCachedUser();
      // If cached user is placeholder 'guest_user', clear it so it doesn't mask cloud authentication
      if (cached?.id === 'guest_user') {
        this.clearCachedUser();
      }

      // If device is completely offline, return cached user for offline workouts
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return cached && cached.id !== 'guest_user' ? cached : null;
      }

      // Re-hydrate access token onto InsForge client if cached locally
      const storedToken = localStorage.getItem(AUTH_TOKEN_KEY);
      if (storedToken && typeof (insforge as any).setAccessToken === 'function') {
        (insforge as any).setAccessToken(storedToken);
      }

      const { data, error } = await insforge.auth.getCurrentUser();
      if (!error && data) {
        const user = (data as any).user || data;
        const rawId = user?.id || user?.user_id || user?.uid;
        if (rawId && rawId !== 'guest_user') {
          const normalizedUser = {
            ...user,
            id: normalizeUserId(rawId),
          };
          this.setCachedUser(normalizedUser);
          return normalizedUser;
        }
      }

      // If online and InsForge has no session (e.g. user was deleted in InsForge or session revoked):
      // Clean up stale local cache so ghost user is not kept logged in
      if (cached && !cached.firebase_uid) {
        console.log('[RunWar Auth] User session not found on server; clearing stale local cache.');
        this.clearCachedUser();
      }

      return null;
    } catch (err: any) {
      console.warn('Error fetching current user from cloud:', err);
      // Only keep cache on network connectivity loss
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const cached = this.getCachedUser();
        return cached && cached.id !== 'guest_user' ? cached : null;
      }
      return null;
    }
  },

  /**
   * Sign up with email and password
   */
  async signUp(email: string, password: string, name: string) {
    const { data, error } = await insforge.auth.signUp({
      email,
      password,
      name,
    });
    if (error) throw error;

    if (data?.accessToken) {
      try {
        localStorage.setItem(AUTH_TOKEN_KEY, data.accessToken);
      } catch { }
    }

    // Create initial profile and settings if user was returned
    if (data?.user?.id) {
      const normalizedId = normalizeUserId(data.user.id);
      this.setCachedUser({ ...data.user, id: normalizedId });
      await this.createInitialProfile(normalizedId, name, email);
    }
    return data;
  },

  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string) {
    const { data, error } = await insforge.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    if (data?.accessToken) {
      try {
        localStorage.setItem(AUTH_TOKEN_KEY, data.accessToken);
      } catch { }
    }
    if (data?.user?.id) {
      const normalizedId = normalizeUserId(data.user.id);
      this.setCachedUser({ ...data.user, id: normalizedId });
    }
    return data;
  },

  /**
   * Sign in with Google OAuth via InsForge with reliable PKCE state persistence
   */
  async signInWithOAuth(provider: 'google' = 'google') {
    const redirectTo = window.location.origin;
    console.log('[RunWar Auth] signInWithOAuth initiating for provider:', provider, 'redirectTo:', redirectTo);

    // Call SDK with skipBrowserRedirect: true so we can guarantee PKCE verifier backup in localStorage
    const result = await insforge.auth.signInWithOAuth(provider, {
      redirectTo,
      skipBrowserRedirect: true,
      additionalParams: { prompt: 'select_account' },
    });

    if (result?.error) {
      console.error('[RunWar Auth] OAuth initiation error:', result.error);
      throw result.error;
    }

    const { url, codeVerifier } = result?.data || {};

    if (codeVerifier) {
      try {
        // Save in BOTH sessionStorage and localStorage to prevent cross-tab / privacy mode loss
        sessionStorage.setItem('insforge_pkce_verifier', codeVerifier);
        localStorage.setItem(PKCE_VERIFIER_KEY, codeVerifier);
        localStorage.setItem('runwar_oauth_in_progress', 'true');
        console.log('[RunWar Auth] Successfully cached PKCE verifier for OAuth redirect');
      } catch (e) {
        console.warn('[RunWar Auth] Failed saving verifier to storage:', e);
      }
    }

    if (url) {
      console.log('[RunWar Auth] Redirecting browser to OAuth provider URL:', url);
      window.location.href = url;
    } else {
      throw new Error('OAuth authentication URL was not returned by InsForge.');
    }

    return result?.data;
  },

  /**
   * Handle OAuth redirect callback (insforge_code or error in URL)
   */
  async handleOAuthCallback(): Promise<{ success: boolean; user?: any; error?: string }> {
    if (typeof window === 'undefined') return { success: false };

    const urlParams = new URLSearchParams(window.location.search);
    const errorParam = urlParams.get('error') || urlParams.get('error_description');
    const code = urlParams.get('insforge_code');

    console.log('[RunWar Auth] Checking OAuth callback:', {
      hasCode: !!code,
      hasError: !!errorParam,
      currentUrl: window.location.href,
    });

    // 1. Check for provider error
    if (errorParam) {
      console.error('[RunWar Auth] OAuth callback returned error:', errorParam);
      localStorage.removeItem('runwar_oauth_in_progress');
      localStorage.removeItem(PKCE_VERIFIER_KEY);
      sessionStorage.removeItem('insforge_pkce_verifier');
      try {
        sessionStorage.setItem('runwar_oauth_error', errorParam);
      } catch {}

      // Clean error param from URL
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('error');
      cleanUrl.searchParams.delete('error_description');
      cleanUrl.searchParams.delete('error_code');
      window.history.replaceState({}, document.title, cleanUrl.toString());

      return { success: false, error: errorParam };
    }

    // 2. Check for authorization code
    if (!code) {
      return { success: false };
    }

    // Retrieve PKCE verifier from sessionStorage or localStorage
    const verifier =
      sessionStorage.getItem('insforge_pkce_verifier') ||
      localStorage.getItem(PKCE_VERIFIER_KEY) ||
      undefined;

    console.log('[RunWar Auth] Exchanging OAuth authorization code. Verifier available:', !!verifier);

    try {
      const { data, error } = await insforge.auth.exchangeOAuthCode(code, verifier);

      if (error) {
        console.error('[RunWar Auth] OAuth code exchange failed:', error);
        localStorage.removeItem('runwar_oauth_in_progress');
        localStorage.removeItem(PKCE_VERIFIER_KEY);
        sessionStorage.removeItem('insforge_pkce_verifier');
        try {
          sessionStorage.setItem('runwar_oauth_error', error.message || 'OAuth code exchange failed');
        } catch {}

        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('insforge_code');
        window.history.replaceState({}, document.title, cleanUrl.toString());

        return { success: false, error: error.message || 'OAuth code exchange failed' };
      }

      console.log('[RunWar Auth] OAuth code exchange successful! User:', data?.user?.id, 'Email:', data?.user?.email);

      // Persist access token
      if (data?.accessToken) {
        try {
          localStorage.setItem(AUTH_TOKEN_KEY, data.accessToken);
        } catch { }
        if (typeof (insforge as any).setAccessToken === 'function') {
          (insforge as any).setAccessToken(data.accessToken);
        }
      }

      // Clean up verifiers and OAuth flag
      localStorage.removeItem('runwar_oauth_in_progress');
      localStorage.removeItem(PKCE_VERIFIER_KEY);
      sessionStorage.removeItem('insforge_pkce_verifier');

      // Clean code from URL bar
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('insforge_code');
      window.history.replaceState({}, document.title, cleanUrl.toString());

      if (data?.user?.id) {
        const normalizedUser = {
          ...data.user,
          id: normalizeUserId(data.user.id),
        };
        this.setCachedUser(normalizedUser);
        return { success: true, user: normalizedUser };
      }

      const currentUser = await this.getCurrentUser();
      return { success: !!currentUser, user: currentUser };
    } catch (err: any) {
      console.error('[RunWar Auth] Exception during OAuth exchange:', err);
      localStorage.removeItem('runwar_oauth_in_progress');
      localStorage.removeItem(PKCE_VERIFIER_KEY);
      sessionStorage.removeItem('insforge_pkce_verifier');

      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('insforge_code');
      window.history.replaceState({}, document.title, cleanUrl.toString());

      return { success: false, error: err?.message || 'Failed to exchange authorization code' };
    }
  },

  /**
   * Sign out from both InsForge and Firebase
   */
  async signOut() {
    try {
      await insforge.auth.signOut();
    } catch (err) {
      console.warn('Error during InsForge sign out:', err);
    }
    try {
      await firebaseAuthService.signOut();
    } catch (err) {
      console.warn('Error during Firebase sign out:', err);
    }
    try {
      // Clear external JWT token on InsForge client if present
      if (typeof (insforge as any).setAccessToken === 'function') {
        (insforge as any).setAccessToken(null);
      }
    } catch (e) {
      // ignore
    }
    try {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(PKCE_VERIFIER_KEY);
      localStorage.removeItem('runwar_oauth_in_progress');
      sessionStorage.removeItem('insforge_pkce_verifier');
    } catch { }
    this.clearCachedUser();
  },

  /**
   * Send password reset email
   */
  async sendPasswordReset(email: string) {
    const { data, error } = await insforge.auth.sendResetPasswordEmail({
      email,
    });
    if (error) throw error;
    return data;
  },

  /**
   * Send 6-digit OTP code to email via InsForge SMTP
   */
  async sendOtpToEmail(email: string, name?: string) {
    const cleanEmail = email.trim().toLowerCase();
    const displayName = name || cleanEmail.split('@')[0] || 'Runner';
    const autoPassword = `Rw_${toDeterministicUUID(cleanEmail).substring(0, 10)}!9`;

    try {
      // First attempt signUp which sends 6-digit verification code via SMTP
      const { data, error } = await insforge.auth.signUp({
        email: cleanEmail,
        password: autoPassword,
        name: displayName,
      });

      if (error) {
        const errMsg = error.message || '';
        // If account already exists, trigger resend verification or reset email
        if (errMsg.toLowerCase().includes('already') || errMsg.toLowerCase().includes('exist') || errMsg.toLowerCase().includes('registered')) {
          await insforge.auth.resendVerificationEmail({ email: cleanEmail }).catch(async () => {
            await insforge.auth.sendResetPasswordEmail({ email: cleanEmail });
          });
          return { success: true, isExisting: true };
        }
        throw error;
      }
      return { success: true, isExisting: false, user: data?.user };
    } catch (err: any) {
      // If error, try resending verification email
      try {
        const resendRes = await insforge.auth.resendVerificationEmail({ email: cleanEmail });
        if (resendRes.error) throw resendRes.error;
        return { success: true, isExisting: true };
      } catch (resendErr) {
        throw err || resendErr;
      }
    }
  },

  /**
   * Verify email with 6-digit OTP and establish active session
   */
  async verifyEmailOtp(email: string, otp: string) {
    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim();
    const autoPassword = `Rw_${toDeterministicUUID(cleanEmail).substring(0, 10)}!9`;

    // 1. Attempt official email OTP verification
    try {
      const { data, error } = await insforge.auth.verifyEmail({
        email: cleanEmail,
        otp: cleanOtp,
      });

      if (!error && (data?.user || data?.accessToken)) {
        const user: any = data.user || (await this.getCurrentUser());
        if (user) {
          const normalizedId = normalizeUserId(user.id);
          const normalizedUser = { ...user, id: normalizedId };
          this.setCachedUser(normalizedUser);

          let profile = await this.getProfile(normalizedId);
          if (!profile) {
            const userName = user.profile?.name || user.name || cleanEmail.split('@')[0] || 'Runner';
            await this.createInitialProfile(
              normalizedId,
              userName,
              cleanEmail
            );
          }
          return { user: normalizedUser, isNew: !profile };
        }
      }
    } catch (verifyErr) {
      console.warn('Verify email OTP check:', verifyErr);
    }

    // 2. If already verified or existing user, try signin
    try {
      const signInRes = await insforge.auth.signInWithPassword({
        email: cleanEmail,
        password: autoPassword,
      });
      if (signInRes.data?.user) {
        const normalizedId = normalizeUserId(signInRes.data.user.id);
        const normalizedUser = { ...signInRes.data.user, id: normalizedId };
        this.setCachedUser(normalizedUser);
        let profile = await this.getProfile(normalizedId);
        return { user: normalizedUser, isNew: !profile };
      }
    } catch (signInErr) {
      // continue to token exchange
    }

    // 3. Fallback: try exchange reset password token with the 6-digit code
    try {
      const exchangeRes = await insforge.auth.exchangeResetPasswordToken({
        email: cleanEmail,
        code: cleanOtp,
      });
      if (exchangeRes.data?.token) {
        await insforge.auth.resetPassword({
          otp: exchangeRes.data.token,
          newPassword: autoPassword,
        });
        const finalSignIn = await insforge.auth.signInWithPassword({
          email: cleanEmail,
          password: autoPassword,
        });
        if (finalSignIn.data?.user) {
          const normalizedId = normalizeUserId(finalSignIn.data.user.id);
          const normalizedUser = { ...finalSignIn.data.user, id: normalizedId };
          this.setCachedUser(normalizedUser);
          let profile = await this.getProfile(normalizedId);
          return { user: normalizedUser, isNew: !profile };
        }
      }
    } catch (exchangeErr) {
      // ignore
    }

    // 4. Final check if session is active
    const currentUser = await this.getCurrentUser();
    if (currentUser) {
      return { user: currentUser, isNew: false };
    }

    throw new Error('Invalid or expired 6-digit verification code. Please check your email and try again.');
  },

  /**
   * Verify email with 6-digit OTP
   */
  async verifyEmail(email: string, otp: string) {
    const { data, error } = await insforge.auth.verifyEmail({
      email,
      otp,
    });
    if (error) throw error;
    return data;
  },

  /**
   * Resend verification email
   */
  async resendVerificationEmail(email: string) {
    const { data, error } = await insforge.auth.resendVerificationEmail({
      email,
    });
    if (error) throw error;
    return data;
  },

  /**
   * Exchange reset password OTP token
   */
  async exchangeResetPasswordToken(email: string, code: string) {
    const { data, error } = await insforge.auth.exchangeResetPasswordToken({
      email,
      code,
    });
    if (error) throw error;
    return data;
  },

  /**
   * Reset password with token/otp
   */
  async resetPassword(params: { otp?: string; token?: string; newPassword: string }) {
    const { data, error } = await insforge.auth.resetPassword({
      otp: params.otp || params.token || '',
      newPassword: params.newPassword,
    });
    if (error) throw error;
    return data;
  },

  /**
   * Fetch user profile from database
   */
  async getProfile(userId: string): Promise<UserProfile | null> {
    if (!userId || userId === 'guest_user' || userId === 'usr_guest_demo') {
      const cachedRaw = localStorage.getItem(PROFILE_CACHE_KEY);
      if (cachedRaw) {
        try {
          return JSON.parse(cachedRaw);
        } catch {}
      }
      return null;
    }

    const normalizedId = normalizeUserId(userId);
    try {
      const { data, error } = await insforge.database
        .from('profiles')
        .select('*')
        .eq('user_id', normalizedId)
        .maybeSingle();

      if (error) {
        if (error.message && error.message.trim().length > 0) {
          console.warn('Failed to fetch profile from DB:', error.message);
        }
        // If offline or network error and we have a valid cached profile for this user, use it
        const cachedRaw = localStorage.getItem(PROFILE_CACHE_KEY);
        if (cachedRaw) {
          try {
            const cached = JSON.parse(cachedRaw);
            if (cached?.user_id === normalizedId || cached?.id === normalizedId) {
              return cached as UserProfile;
            }
          } catch {}
        }
        // Distinguish network/DB error from missing record: throw error so caller can trigger PROFILE_ERROR
        throw new Error(error.message || 'Failed to fetch user profile from cloud');
      }

      if (data) {
        const cachedRaw = localStorage.getItem(PROFILE_CACHE_KEY);
        const cachedProfile = cachedRaw ? JSON.parse(cachedRaw) : {};
        const profileWithMeta: UserProfile = {
          ...data,
          firebase_uid: cachedProfile.firebase_uid || null,
          phone_number: cachedProfile.phone_number || null,
        } as UserProfile;
        localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profileWithMeta));
        return profileWithMeta;
      }

      // data is null and error is null => Brand new user with no profile record in DB
      return null;
    } catch (err: any) {
      // Re-throw genuine network/server errors unless device is strictly offline with valid cached profile
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
      const cachedRaw = localStorage.getItem(PROFILE_CACHE_KEY);
      if (isOffline && cachedRaw) {
        try {
          const cached = JSON.parse(cachedRaw);
          if (cached?.user_id === normalizedId || cached?.id === normalizedId) {
            return cached as UserProfile;
          }
        } catch {}
      }
      throw err;
    }
  },

  /**
   * Fetch user profile from database by Firebase UID
   */
  async getProfileByFirebaseUid(firebaseUid: string): Promise<UserProfile | null> {
    const normalizedId = normalizeUserId(firebaseUid);
    return this.getProfile(normalizedId);
  },

  /**
   * Create initial profile for a phone-authenticated user
   */
  async createProfileFromPhone(
    firebaseUid: string,
    phoneNumber: string,
    name?: string
  ): Promise<UserProfile> {
    const normalizedId = normalizeUserId(firebaseUid);
    const existing = await this.getProfile(normalizedId);
    if (existing) {
      return existing;
    }

    const defaultName = name || `Runner ${phoneNumber.slice(-4)}`;

    // Database payload strictly matching public.profiles schema
    const dbPayload = {
      id: normalizedId,
      user_id: normalizedId,
      name: defaultName,
      email: null,
      age: 28,
      gender: 'unspecified',
      height: 175,
      weight: 70,
      distance_unit: 'km',
      pace_unit: 'min_km',
      weight_unit: 'kg',
      fitness_goal: 'general_fitness',
      typical_workout_type: 'run',
      avatar_url: null,
      daily_step_goal: 10000,
      profile_completed: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      await insforge.database
        .from('profiles')
        .upsert([dbPayload], { onConflict: 'user_id' });
    } catch (err) {
      console.warn('Warning creating phone profile in DB:', err);
    }

    try {
      const settings = {
        user_id: normalizedId,
        auto_pause: true,
        auto_pause_threshold: 10,
        audio_coaching: true,
        audio_frequency: '1km',
        distance_unit: 'km',
        pace_unit: 'min_km',
        weight_unit: 'kg',
        theme: 'dark',
        notifications_enabled: true,
        haptics_enabled: true,
      };
      await insforge.database
        .from('user_settings')
        .upsert([settings], { onConflict: 'user_id' });
    } catch (err) {
      console.warn('Warning creating phone user settings:', err);
    }

    const fullProfile: UserProfile = {
      ...dbPayload,
      firebase_uid: firebaseUid,
      phone_number: phoneNumber,
    } as UserProfile;

    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(fullProfile));
    return fullProfile;
  },

  /**
   * Update or create user profile
   */
  async updateProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    const isGuest = !userId || userId === 'guest_user' || userId === 'usr_guest_demo';
    if (isGuest) {
      const cachedRaw = localStorage.getItem(PROFILE_CACHE_KEY);
      const existing = cachedRaw ? JSON.parse(cachedRaw) : {};
      const updated: UserProfile = {
        ...existing,
        ...updates,
        id: userId || 'usr_guest_demo',
        user_id: userId || 'usr_guest_demo',
        updated_at: new Date().toISOString(),
      };
      localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(updated));
      return updated;
    }

    const normalizedId = normalizeUserId(userId);
    const existing = await this.getProfile(normalizedId);

    // Database payload conforming strictly to standard public.profiles table columns
    const dbPayload: any = {
      id: existing?.id || normalizedId,
      user_id: normalizedId,
      name: updates.name ?? existing?.name ?? 'Runner',
      username: updates.username ?? existing?.username ?? null,
      email: updates.email ?? existing?.email ?? null,
      age: updates.age ?? existing?.age ?? 25,
      gender: updates.gender ?? existing?.gender ?? 'unspecified',
      height: updates.height ?? existing?.height ?? 175,
      weight: updates.weight ?? existing?.weight ?? 70,
      distance_unit: updates.distance_unit ?? existing?.distance_unit ?? 'km',
      pace_unit: updates.pace_unit ?? existing?.pace_unit ?? 'min_km',
      weight_unit: updates.weight_unit ?? existing?.weight_unit ?? 'kg',
      fitness_goal: updates.fitness_goal ?? existing?.fitness_goal ?? '5k_run',
      typical_workout_type: updates.typical_workout_type ?? existing?.typical_workout_type ?? 'run',
      avatar_url: updates.avatar_url ?? existing?.avatar_url ?? null,
      daily_step_goal: updates.daily_step_goal ?? existing?.daily_step_goal ?? 10000,
      profile_completed: updates.profile_completed ?? existing?.profile_completed ?? false,
      created_at: existing?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await insforge.database
        .from('profiles')
        .upsert([dbPayload], { onConflict: 'user_id' })
        .select()
        .maybeSingle();

      if (error) {
        console.warn('Cloud DB profile upsert notice:', error);
      }
      const fullResult: UserProfile = {
        ...(data || dbPayload),
        firebase_uid: updates.firebase_uid ?? existing?.firebase_uid ?? null,
        phone_number: updates.phone_number ?? existing?.phone_number ?? null,
      } as UserProfile;

      localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(fullResult));
      return fullResult;
    } catch (err) {
      console.warn('Failed to upsert profile to DB, fallback to local cache:', err);
      const fallback: UserProfile = {
        ...dbPayload,
        firebase_uid: updates.firebase_uid ?? existing?.firebase_uid ?? null,
        phone_number: updates.phone_number ?? existing?.phone_number ?? null,
      } as UserProfile;
      localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(fallback));
      return fallback;
    }
  },

  /**
   * Create initial profile for a new user
   */
  async createInitialProfile(userId: string, name: string, email: string) {
    if (!userId || userId === 'guest_user' || userId === 'usr_guest_demo') {
      return;
    }
    const normalizedId = normalizeUserId(userId);
    try {
      const profile = {
        id: normalizedId,
        user_id: normalizedId,
        name,
        email,
        age: 28,
        height: 175,
        weight: 70,
        distance_unit: 'km',
        pace_unit: 'min_km',
        weight_unit: 'kg',
        fitness_goal: 'general_fitness',
        typical_workout_type: 'run',
        daily_step_goal: 10000,
        profile_completed: false,
      };

      await insforge.database.from('profiles').insert([profile]);

      const settings = {
        user_id: normalizedId,
        auto_pause: true,
        auto_pause_threshold: 10,
        audio_coaching: true,
        audio_frequency: '1km',
        distance_unit: 'km',
        pace_unit: 'min_km',
        weight_unit: 'kg',
        theme: 'dark',
        notifications_enabled: true,
        haptics_enabled: true,
      };

      await insforge.database.from('user_settings').insert([settings]);
    } catch (err) {
      console.warn('Error creating initial profile/settings:', err);
    }
  },

  /**
   * Get user settings
   */
  async getSettings(userId: string): Promise<UserSettings | null> {
    const normalizedId = normalizeUserId(userId);
    try {
      const { data, error } = await insforge.database
        .from('user_settings')
        .select('*')
        .eq('user_id', normalizedId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(data));
        return data as UserSettings;
      }
      return null;
    } catch (err) {
      const cached = localStorage.getItem(SETTINGS_CACHE_KEY);
      return cached ? JSON.parse(cached) : null;
    }
  },

  /**
   * Upload avatar image to InsForge storage and update profile
   */
  async uploadAvatar(userId: string, file: File): Promise<{ url: string; profile: UserProfile }> {
    const normalizedId = normalizeUserId(userId);
    const fileExt = file.name.split('.').pop() || 'jpg';
    const filePath = `user_${normalizedId}_${Date.now()}.${fileExt}`;

    // Upload to InsForge 'avatars' storage bucket
    const { data, error } = await insforge.storage
      .from('avatars')
      .upload(filePath, file);

    if (error) throw error;
    if (!data?.url) throw new Error('Upload succeeded but no URL was returned');

    // Update profile with the new avatar_url
    const updatedProfile = await this.updateProfile(normalizedId, {
      avatar_url: data.url,
    });

    return { url: data.url, profile: updatedProfile };
  },

  /**
   * Update user settings
   */
  async updateSettings(userId: string, updates: Partial<UserSettings>): Promise<UserSettings> {
    const normalizedId = normalizeUserId(userId);
    const existing = await this.getSettings(normalizedId);
    const settingsPayload: any = {
      user_id: normalizedId,
      ...(existing || {}),
      ...updates,
      updated_at: new Date().toISOString(),
    };

    try {
      let { data, error } = await insforge.database
        .from('user_settings')
        .upsert([settingsPayload], { onConflict: 'user_id' })
        .select()
        .maybeSingle();

      if (error && (String(error?.message).includes('pocket_unlock_mode') || (error as any)?.code === 'PGRST204')) {
        console.warn('Cloud DB user_settings missing pocket_unlock_mode column. Retrying without column...');
        const sanitizedPayload = { ...settingsPayload };
        delete sanitizedPayload.pocket_unlock_mode;
        const retry = await insforge.database
          .from('user_settings')
          .upsert([sanitizedPayload], { onConflict: 'user_id' })
          .select()
          .maybeSingle();
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        console.warn('Cloud DB settings upsert notice:', error);
      }
      const finalSettings = { ...settingsPayload, ...(data || {}) } as UserSettings;
      localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(finalSettings));
      return finalSettings;
    } catch (err) {
      console.warn('Failed to upsert settings to DB, fallback to local cache:', err);
      const fallback = settingsPayload as UserSettings;
      localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(fallback));
      return fallback;
    }
  },
};

