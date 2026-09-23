import { insforge } from '../lib/insforge';
import { UserProfile, UserSettings } from '../types';
import { firebaseAuthService } from './firebaseAuthService';
import { toDeterministicUUID } from '../utils/uuid';

const PROFILE_CACHE_KEY = 'runwar_cached_profile';
const SETTINGS_CACHE_KEY = 'runwar_cached_settings';
const SESSION_USER_KEY = 'runwar_session_user';

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
      const normalizedUser = {
        ...user,
        id: toDeterministicUUID(user.id || user.firebase_uid || 'guest_user'),
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
      localStorage.removeItem('runwar_google_fit_state');
      localStorage.removeItem('runwar_google_fit_token_transfer');
      // Clear all cached workouts to prevent account pollution
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('runwar_cached_workouts') || k.startsWith('runwar_profile_setup_done_'))) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      console.warn('Failed to clear cached user:', e);
    }
  },

  /**
   * Get current authenticated user session from InsForge
   */
  async getCurrentUser() {
    try {
      const { data, error } = await insforge.auth.getCurrentUser();
      if (!error && data) {
        const user = (data as any).user || data;
        if (user?.id) {
          const normalizedUser = {
            ...user,
            id: toDeterministicUUID(user.id),
          };
          this.setCachedUser(normalizedUser);
          return normalizedUser;
        }
        return user;
      }
      return this.getCachedUser();
    } catch (err) {
      console.warn('Error fetching current user from cloud, checking local cache:', err);
      return this.getCachedUser();
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
    
    // Create initial profile and settings if user was returned
    if (data?.user?.id) {
      const normalizedId = toDeterministicUUID(data.user.id);
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
    if (data?.user?.id) {
      const normalizedId = toDeterministicUUID(data.user.id);
      this.setCachedUser({ ...data.user, id: normalizedId });
    }
    return data;
  },

  /**
   * Sign in with Google OAuth via InsForge
   */
  async signInWithOAuth(provider: 'google' = 'google') {
    const redirectTo = window.location.origin;
    const result = await insforge.auth.signInWithOAuth(provider, {
      redirectTo,
    });
    if (result?.error) throw result.error;
    return result?.data;
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
          const normalizedId = toDeterministicUUID(user.id);
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
        const normalizedId = toDeterministicUUID(signInRes.data.user.id);
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
          const normalizedId = toDeterministicUUID(finalSignIn.data.user.id);
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
    const normalizedId = toDeterministicUUID(userId);
    try {
      const { data, error } = await insforge.database
        .from('profiles')
        .select('*')
        .eq('user_id', normalizedId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        const cached = localStorage.getItem(PROFILE_CACHE_KEY);
        const cachedProfile = cached ? JSON.parse(cached) : {};
        const profileWithMeta: UserProfile = {
          ...data,
          firebase_uid: cachedProfile.firebase_uid || null,
          phone_number: cachedProfile.phone_number || null,
        } as UserProfile;
        localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profileWithMeta));
        return profileWithMeta;
      }
      return null;
    } catch (err) {
      console.warn('Failed to fetch profile from DB, checking cache:', err);
      const cached = localStorage.getItem(PROFILE_CACHE_KEY);
      return cached ? JSON.parse(cached) : null;
    }
  },

  /**
   * Fetch user profile from database by Firebase UID
   */
  async getProfileByFirebaseUid(firebaseUid: string): Promise<UserProfile | null> {
    const normalizedId = toDeterministicUUID(firebaseUid);
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
    const normalizedId = toDeterministicUUID(firebaseUid);
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
    const normalizedId = toDeterministicUUID(userId);
    const existing = await this.getProfile(normalizedId);

    // Database payload conforming strictly to standard public.profiles table columns
    const dbPayload: any = {
      id: existing?.id || normalizedId,
      user_id: normalizedId,
      name: updates.name ?? existing?.name ?? 'Runner',
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
    const normalizedId = toDeterministicUUID(userId);
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
    const normalizedId = toDeterministicUUID(userId);
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
    const normalizedId = toDeterministicUUID(userId);
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
    const normalizedId = toDeterministicUUID(userId);
    const existing = await this.getSettings(normalizedId);
    const settingsPayload: any = {
      user_id: normalizedId,
      ...(existing || {}),
      ...updates,
      updated_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await insforge.database
        .from('user_settings')
        .upsert([settingsPayload], { onConflict: 'user_id' })
        .select()
        .maybeSingle();

      if (error) {
        console.warn('Cloud DB settings upsert notice:', error);
      }
      const finalSettings = (data || settingsPayload) as UserSettings;
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

