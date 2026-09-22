import { insforge } from '../lib/insforge';
import { UserProfile, UserSettings } from '../types';

const PROFILE_CACHE_KEY = 'runwar_cached_profile';
const SETTINGS_CACHE_KEY = 'runwar_cached_settings';

export const authService = {
  /**
   * Get current authenticated user session
   */
  async getCurrentUser() {
    try {
      const { data, error } = await insforge.auth.getCurrentUser();
      if (error || !data) return null;
      return (data as any).user || data;
    } catch (err) {
      console.warn('Error fetching current user:', err);
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
    
    // Create initial profile and settings if user was returned
    if (data?.user?.id) {
      await this.createInitialProfile(data.user.id, name, email);
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
   * Sign out
   */
  async signOut() {
    try {
      await insforge.auth.signOut();
    } catch (err) {
      console.warn('Error during sign out:', err);
    }
    localStorage.removeItem(PROFILE_CACHE_KEY);
    localStorage.removeItem(SETTINGS_CACHE_KEY);
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
   * Fetch user profile from database
   */
  async getProfile(userId: string): Promise<UserProfile | null> {
    try {
      const { data, error } = await insforge.database
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(data));
        return data as UserProfile;
      }
      return null;
    } catch (err) {
      console.warn('Failed to fetch profile from DB, checking cache:', err);
      const cached = localStorage.getItem(PROFILE_CACHE_KEY);
      return cached ? JSON.parse(cached) : null;
    }
  },

  /**
   * Update or create user profile
   */
  async updateProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    const existing = await this.getProfile(userId);
    const profilePayload: any = {
      id: existing?.id || userId,
      user_id: userId,
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
        .upsert([profilePayload], { onConflict: 'user_id' })
        .select()
        .maybeSingle();

      if (error) {
        console.warn('Cloud DB profile upsert warning:', error);
      }
      const result = (data || profilePayload) as UserProfile;
      localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(result));
      return result;
    } catch (err) {
      console.warn('Failed to upsert profile to DB, fallback to local cache:', err);
      const fallback = profilePayload as UserProfile;
      localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(fallback));
      return fallback;
    }
  },

  /**
   * Create initial profile for a new user
   */
  async createInitialProfile(userId: string, name: string, email: string) {
    try {
      const profile = {
        id: userId,
        user_id: userId,
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
        user_id: userId,
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
    try {
      const { data, error } = await insforge.database
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
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
    const fileExt = file.name.split('.').pop() || 'jpg';
    const filePath = `user_${userId}_${Date.now()}.${fileExt}`;
    
    // Upload to InsForge 'avatars' storage bucket
    const { data, error } = await insforge.storage
      .from('avatars')
      .upload(filePath, file);

    if (error) throw error;
    if (!data?.url) throw new Error('Upload succeeded but no URL was returned');

    // Update profile with the new avatar_url
    const updatedProfile = await this.updateProfile(userId, {
      avatar_url: data.url,
    });

    return { url: data.url, profile: updatedProfile };
  },

  /**
   * Update user settings
   */
  async updateSettings(userId: string, updates: Partial<UserSettings>): Promise<UserSettings> {
    const existing = await this.getSettings(userId);
    const settingsPayload: any = {
      user_id: userId,
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
        console.warn('Cloud DB settings upsert warning:', error);
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
