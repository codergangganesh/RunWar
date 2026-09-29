/**
 * Live Run Beacon Service
 * Zero-install spectator live-tracking, battery telemetry, cheers, and emergency inactivity watchdog.
 * Persists and synchronizes via InsForge PostgreSQL (public.live_beacons).
 */

import { insforge } from '../lib/insforge';
import { toDeterministicUUID } from '../utils/uuid';
import { redisService } from './redisService';

export interface BeaconTelemetry {
  current_lat: number;
  current_lng: number;
  current_pace: number; // in seconds per km
  total_distance_meters: number;
  elapsed_seconds: number;
  status: 'active' | 'paused' | 'completed' | 'emergency';
  battery_level?: number | null;
  battery_charging?: boolean;
  route_coordinates?: Array<{
    latitude: number;
    longitude: number;
    speed?: number;
    timestamp?: string;
  }>;
  emergency_alert?: boolean;
  emergency_alert_message?: string;
}

export type BeaconDuration = '15m' | '30m' | '1h' | '2h' | 'until_ended';

export interface LiveBeacon {
  id: string;
  user_id?: string | null;
  beacon_code: string;
  runner_name: string;
  runner_avatar?: string | null;
  workout_type: string;
  status: 'active' | 'paused' | 'completed' | 'emergency';
  current_lat?: number | null;
  current_lng?: number | null;
  current_pace: number;
  total_distance_meters: number;
  elapsed_seconds: number;
  battery_level?: number | null;
  battery_charging: boolean;
  route_coordinates: Array<{
    latitude: number;
    longitude: number;
    speed?: number;
    timestamp?: string;
  }>;
  emergency_alert: boolean;
  emergency_alert_message?: string | null;
  cheers_count: number;
  duration_limit?: BeaconDuration;
  expires_at?: string | null;
  is_expired?: boolean;
  last_ping_at?: string;
  created_at: string;
  updated_at: string;
}

const ACTIVE_BEACON_STORAGE_KEY = 'runwar_active_beacon_session';

/**
 * Generate a cryptographically secure, URL-safe short code (e.g. wb_7k2m9x)
 */
export function generateBeaconCode(): string {
  const chars = '23456789abcdefghjkmnpqrstuvwxyz'; // readable base32 without ambiguous 0/O/1/I/l
  let random = '';
  const cryptoObj = typeof window !== 'undefined' ? window.crypto : null;
  if (cryptoObj && cryptoObj.getRandomValues) {
    const bytes = new Uint8Array(8);
    cryptoObj.getRandomValues(bytes);
    for (let i = 0; i < 8; i++) {
      random += chars[bytes[i] % chars.length];
    }
  } else {
    for (let i = 0; i < 8; i++) {
      random += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  return `wb_${random}`;
}

/**
 * Query device battery status safely across modern browsers
 */
export async function getDeviceBatteryStatus(): Promise<{ level: number; charging: boolean } | null> {
  try {
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      const battery = await (navigator as any).getBattery();
      return {
        level: Math.round((battery.level || 1) * 100),
        charging: Boolean(battery.charging),
      };
    }
  } catch {
    // Battery API not available or blocked by user policy
  }
  return null;
}

export const beaconService = {
  /**
   * Get active beacon session from memory / persistent cache
   */
  getActiveSession(): LiveBeacon | null {
    try {
      const raw = localStorage.getItem(ACTIVE_BEACON_STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {
      // Ignored
    }
    return null;
  },

  setActiveSession(beacon: LiveBeacon | null) {
    try {
      if (beacon) {
        localStorage.setItem(ACTIVE_BEACON_STORAGE_KEY, JSON.stringify(beacon));
      } else {
        localStorage.removeItem(ACTIVE_BEACON_STORAGE_KEY);
      }
    } catch {
      // Ignored
    }
  },

  /**
   * Create or resume an active Live Run Beacon in InsForge database
   */
  async startBeacon(params: {
    userId?: string | null;
    runnerName: string;
    runnerAvatar?: string | null;
    workoutType?: string;
    initialLat?: number;
    initialLng?: number;
    durationLimit?: BeaconDuration;
  }): Promise<LiveBeacon> {
    const active = this.getActiveSession();
    if (active && active.status !== 'completed') {
      return active;
    }

    const duration = params.durationLimit || 'until_ended';
    let expiresAt: string | null = null;
    let ttlSeconds = 7200; // default 2 hours

    if (duration === '15m') {
      expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      ttlSeconds = 15 * 60;
    } else if (duration === '30m') {
      expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      ttlSeconds = 30 * 60;
    } else if (duration === '1h') {
      expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      ttlSeconds = 60 * 60;
    } else if (duration === '2h') {
      expiresAt = new Date(Date.now() + 120 * 60 * 1000).toISOString();
      ttlSeconds = 120 * 60;
    }

    const beaconCode = generateBeaconCode();
    const battery = await getDeviceBatteryStatus();
    const normalizedUserId = params.userId ? toDeterministicUUID(params.userId) : null;

    const initialBeaconPayload = {
      beacon_code: beaconCode,
      user_id: normalizedUserId,
      runner_name: params.runnerName || 'RunWar Athlete',
      runner_avatar: params.runnerAvatar || null,
      workout_type: params.workoutType || 'run',
      status: 'active' as const,
      current_lat: params.initialLat || null,
      current_lng: params.initialLng || null,
      current_pace: 0,
      total_distance_meters: 0,
      elapsed_seconds: 0,
      battery_level: battery ? battery.level : null,
      battery_charging: battery ? battery.charging : false,
      route_coordinates: params.initialLat && params.initialLng ? [{
        latitude: params.initialLat,
        longitude: params.initialLng,
        timestamp: new Date().toISOString(),
      }] : [],
      emergency_alert: false,
      emergency_alert_message: null,
      cheers_count: 0,
      duration_limit: duration,
      expires_at: expiresAt,
      last_ping_at: new Date().toISOString(),
    };

    let createdBeacon: LiveBeacon | null = null;

    try {
      // Database inserts take an array
      const { data, error } = await insforge.database
        .from('live_beacons')
        .insert([initialBeaconPayload])
        .select()
        .single();

      if (!error && data) {
        createdBeacon = data as LiveBeacon;
      } else if (error && (error.message?.includes('duration_limit') || error.message?.includes('expires_at'))) {
        // Fallback retry if columns are not yet present in PostgreSQL schema
        const { duration_limit: _d, expires_at: _e, ...legacyPayload } = initialBeaconPayload;
        const retryRes = await insforge.database
          .from('live_beacons')
          .insert([legacyPayload])
          .select()
          .single();
        if (retryRes.data) {
          createdBeacon = {
            ...(retryRes.data as LiveBeacon),
            duration_limit: duration,
            expires_at: expiresAt,
          };
        }
      } else {
        console.warn('InsForge insert notice for live_beacons:', error?.message);
      }
    } catch (err) {
      console.warn('InsForge beacon creation exception:', err);
    }

    if (!createdBeacon) {
      // Fallback object to ensure runner experience remains seamless even on network interruption
      createdBeacon = {
        id: `beacon_local_${Date.now()}`,
        ...initialBeaconPayload,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    // Turbo: Seed live session in Redis with duration TTL
    if (createdBeacon && redisService.isConfigured()) {
      const redisKey = `runwar:beacon:${createdBeacon.beacon_code}`;
      redisService.hset(redisKey, {
        id: createdBeacon.id,
        beacon_code: createdBeacon.beacon_code,
        runner_name: createdBeacon.runner_name,
        runner_avatar: createdBeacon.runner_avatar || '',
        workout_type: createdBeacon.workout_type,
        status: createdBeacon.status,
        current_lat: createdBeacon.current_lat || 0,
        current_lng: createdBeacon.current_lng || 0,
        current_pace: createdBeacon.current_pace || 0,
        total_distance_meters: createdBeacon.total_distance_meters || 0,
        elapsed_seconds: createdBeacon.elapsed_seconds || 0,
        battery_level: createdBeacon.battery_level ?? -1,
        battery_charging: String(Boolean(createdBeacon.battery_charging)),
        cheers_count: createdBeacon.cheers_count || 0,
        duration_limit: createdBeacon.duration_limit || 'until_ended',
        expires_at: createdBeacon.expires_at || '',
        emergency_alert: 'false',
        route_coordinates: JSON.stringify(createdBeacon.route_coordinates || []),
        updated_at: createdBeacon.updated_at,
        last_ping_at: createdBeacon.last_ping_at || '',
      }).catch(() => {});
      redisService.expire(redisKey, ttlSeconds).catch(() => {});
    }

    this.setActiveSession(createdBeacon);
    return createdBeacon;
  },

  /**
   * Update real-time GPS telemetry, battery, and pace in InsForge
   */
  async updateTelemetry(beaconCode: string, telemetry: Partial<BeaconTelemetry>): Promise<void> {
    if (!beaconCode) return;

    const battery = await getDeviceBatteryStatus();
    const updates: any = {
      ...telemetry,
      last_ping_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (battery) {
      updates.battery_level = battery.level;
      updates.battery_charging = battery.charging;
    }

    // Keep active session in sync
    const current = this.getActiveSession();
    if (current && current.beacon_code === beaconCode) {
      this.setActiveSession({
        ...current,
        ...updates,
      });
    }

    // 1. Fast-Path: Push sub-millisecond in-memory telemetry to Redis
    if (redisService.isConfigured()) {
      const redisKey = `runwar:beacon:${beaconCode}`;
      const redisPayload: Record<string, any> = {
        updated_at: updates.updated_at,
        last_ping_at: updates.last_ping_at,
      };
      if (updates.current_lat != null) redisPayload.current_lat = updates.current_lat;
      if (updates.current_lng != null) redisPayload.current_lng = updates.current_lng;
      if (updates.current_pace != null) redisPayload.current_pace = updates.current_pace;
      if (updates.total_distance_meters != null) redisPayload.total_distance_meters = updates.total_distance_meters;
      if (updates.elapsed_seconds != null) redisPayload.elapsed_seconds = updates.elapsed_seconds;
      if (updates.status != null) redisPayload.status = updates.status;
      if (updates.battery_level != null) redisPayload.battery_level = updates.battery_level;
      if (updates.battery_charging != null) redisPayload.battery_charging = String(updates.battery_charging);
      if (updates.emergency_alert != null) redisPayload.emergency_alert = String(updates.emergency_alert);
      if (updates.emergency_alert_message != null) redisPayload.emergency_alert_message = updates.emergency_alert_message;
      if (Array.isArray(updates.route_coordinates)) {
        redisPayload.route_coordinates = JSON.stringify(updates.route_coordinates.slice(-100));
      }

      redisService.hset(redisKey, redisPayload).catch(() => {});
      redisService.expire(redisKey, 7200).catch(() => {});
    }

    // 2. Authoritative PostgreSQL Database Sync
    try {
      await insforge.database
        .from('live_beacons')
        .update(updates)
        .eq('beacon_code', beaconCode);
    } catch (e) {
      console.warn('Failed to push beacon telemetry update to InsForge:', e);
    }
  },

  /**
   * Fetch a live beacon by code for spectators without authentication
   */
  async getBeaconByCode(beaconCode: string): Promise<LiveBeacon | null> {
    if (!beaconCode) return null;
    const cleanCode = beaconCode.trim();

    // 1. Fast-Path: Sub-millisecond read from Redis RAM (<1ms)
    if (redisService.isConfigured()) {
      try {
        const redisData = await redisService.hgetall(`runwar:beacon:${cleanCode}`);
        if (redisData && redisData.beacon_code) {
          let routeCoords: any[] = [];
          try {
            if (redisData.route_coordinates) {
              routeCoords = JSON.parse(redisData.route_coordinates);
            }
          } catch {}

          const rawExpiresAt = redisData.expires_at || null;
          const isExpired = rawExpiresAt ? Date.now() > new Date(rawExpiresAt).getTime() : false;

          return {
            id: redisData.id || `beacon_${cleanCode}`,
            user_id: redisData.user_id || null,
            beacon_code: redisData.beacon_code,
            runner_name: redisData.runner_name || 'RunWar Athlete',
            runner_avatar: redisData.runner_avatar || null,
            workout_type: redisData.workout_type || 'run',
            status: isExpired ? 'completed' : ((redisData.status as any) || 'active'),
            current_lat: isExpired ? null : (redisData.current_lat ? Number(redisData.current_lat) : null),
            current_lng: isExpired ? null : (redisData.current_lng ? Number(redisData.current_lng) : null),
            current_pace: Number(redisData.current_pace || 0),
            total_distance_meters: Number(redisData.total_distance_meters || 0),
            elapsed_seconds: Number(redisData.elapsed_seconds || 0),
            battery_level: redisData.battery_level != null && Number(redisData.battery_level) >= 0 ? Number(redisData.battery_level) : null,
            battery_charging: redisData.battery_charging === 'true',
            route_coordinates: isExpired ? [] : routeCoords,
            emergency_alert: redisData.emergency_alert === 'true',
            emergency_alert_message: redisData.emergency_alert_message || null,
            cheers_count: Number(redisData.cheers_count || 0),
            duration_limit: (redisData.duration_limit as BeaconDuration) || 'until_ended',
            expires_at: rawExpiresAt,
            is_expired: isExpired,
            last_ping_at: redisData.last_ping_at || redisData.updated_at,
            created_at: redisData.created_at || new Date().toISOString(),
            updated_at: redisData.updated_at || new Date().toISOString(),
          };
        }
      } catch {}
    }

    // 2. Authoritative PostgreSQL Database Read
    try {
      const { data, error } = await insforge.database
        .from('live_beacons')
        .select('*')
        .eq('beacon_code', cleanCode)
        .single();

      if (!error && data) {
        const beacon = data as LiveBeacon;
        if (beacon.expires_at) {
          const expireMs = new Date(beacon.expires_at).getTime();
          if (!isNaN(expireMs) && Date.now() > expireMs) {
            return {
              ...beacon,
              status: 'completed',
              is_expired: true,
              current_lat: null,
              current_lng: null,
              route_coordinates: [],
            };
          }
        }
        return beacon;
      }
    } catch (err) {
      console.warn('InsForge getBeaconByCode exception:', err);
    }

    // 3. Check if the current user is previewing their own active session
    const local = this.getActiveSession();
    if (local && local.beacon_code === cleanCode) {
      if (local.expires_at) {
        const expireMs = new Date(local.expires_at).getTime();
        if (!isNaN(expireMs) && Date.now() > expireMs) {
          return {
            ...local,
            status: 'completed',
            is_expired: true,
            current_lat: null,
            current_lng: null,
            route_coordinates: [],
          };
        }
      }
      return local;
    }

    return null;
  },

  /**
   * Trigger or dismiss an emergency SOS alert
   */
  async setEmergencyAlert(beaconCode: string, isAlert: boolean, message?: string): Promise<void> {
    const payload = {
      emergency_alert: isAlert,
      emergency_alert_message: isAlert ? (message || 'Stationary inactivity detected (>3 minutes). Immediate assistance may be needed.') : null,
      status: isAlert ? 'emergency' as const : 'active' as const,
      updated_at: new Date().toISOString(),
    };

    if (redisService.isConfigured()) {
      redisService.hset(`runwar:beacon:${beaconCode}`, {
        emergency_alert: String(payload.emergency_alert),
        emergency_alert_message: payload.emergency_alert_message || '',
        status: payload.status,
        updated_at: payload.updated_at,
      }).catch(() => {});
    }

    const current = this.getActiveSession();
    if (current && current.beacon_code === beaconCode) {
      this.setActiveSession({
        ...current,
        ...payload,
      });
    }

    try {
      await insforge.database
        .from('live_beacons')
        .update(payload)
        .eq('beacon_code', beaconCode);
    } catch (e) {
      console.warn('Failed to update emergency alert state in InsForge:', e);
    }
  },

  async sendCheer(beaconCode: string): Promise<number> {
    if (!beaconCode) return 0;

    let redisCount: number | null = null;
    let dbCount: number | null = null;

    // 1. Fast-path: increment directly in Redis RAM
    if (redisService.isConfigured()) {
      try {
        const res = await redisService.hincrby(`runwar:beacon:${beaconCode}`, 'cheers_count', 1);
        if (typeof res === 'number') {
          redisCount = res;
        }
      } catch (err) {
        console.warn('Redis hincrby cheer error:', err);
      }
    }

    // 2. Authoritative PostgreSQL Database Sync
    try {
      const { data: rpcData, error: rpcError } = await insforge.database.rpc('increment_beacon_cheers', {
        target_beacon_code: beaconCode,
      });

      if (!rpcError && typeof rpcData === 'number') {
        dbCount = rpcData;
      }
    } catch {
      // Fallback to select and update
    }

    if (dbCount == null) {
      try {
        const { data: beacon } = await insforge.database
          .from('live_beacons')
          .select('cheers_count')
          .eq('beacon_code', beaconCode)
          .single();

        const nextCount = (beacon?.cheers_count || 0) + 1;
        await insforge.database
          .from('live_beacons')
          .update({ cheers_count: nextCount, updated_at: new Date().toISOString() })
          .eq('beacon_code', beaconCode);

        dbCount = nextCount;
      } catch (e) {
        console.warn('Failed to update cheer in InsForge DB:', e);
      }
    }

    const finalCount = Math.max(redisCount || 0, dbCount || 0, 1);

    // If local active session matches, update it too
    const current = this.getActiveSession();
    if (current && current.beacon_code === beaconCode) {
      this.setActiveSession({
        ...current,
        cheers_count: finalCount,
      });
    }

    return finalCount;
  },

  async stopBeacon(beaconCode?: string): Promise<void> {
    const targetCode = beaconCode || this.getActiveSession()?.beacon_code;
    // Immediately clear local session so UI and subsequent runs reset synchronously
    this.setActiveSession(null);

    if (!targetCode) return;

    if (redisService.isConfigured()) {
      redisService.del(`runwar:beacon:${targetCode}`).catch(() => {});
    }

    try {
      await insforge.database
        .from('live_beacons')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('beacon_code', targetCode);
    } catch (e) {
      console.warn('Failed to mark beacon completed in InsForge:', e);
    }
  },

  /**
   * Generate clean shareable spectator URLs
   */
  getShareableUrl(beaconCode: string): string {
    if (typeof window === 'undefined') return `https://runwar.app/?beacon=${beaconCode}`;
    const origin = window.location.origin;
    return `${origin}/?beacon=${encodeURIComponent(beaconCode)}`;
  },

  /**
   * Extract beacon code from current browser location
   */
  getBeaconCodeFromUrl(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      // 1. URL search param ?beacon=wb_...
      const searchParams = new URLSearchParams(window.location.search);
      const queryCode = searchParams.get('beacon') || searchParams.get('live');
      if (queryCode && queryCode.trim().length > 0) {
        return decodeURIComponent(queryCode.trim());
      }

      // 2. Hash param #beacon-wb_... or #live-wb_...
      if (window.location.hash) {
        const hash = window.location.hash;
        if (hash.startsWith('#beacon-')) {
          return decodeURIComponent(hash.replace('#beacon-', '').trim());
        }
        if (hash.startsWith('#live-')) {
          return decodeURIComponent(hash.replace('#live-', '').trim());
        }
        const qIndex = hash.indexOf('?');
        if (qIndex !== -1) {
          const hashParams = new URLSearchParams(hash.substring(qIndex));
          const hashBeacon = hashParams.get('beacon') || hashParams.get('live');
          if (hashBeacon && hashBeacon.trim().length > 0) {
            return decodeURIComponent(hashBeacon.trim());
          }
        }
      }

      // 3. Pathname /live/wb_...
      const pathname = window.location.pathname;
      if (pathname.includes('/live/')) {
        const parts = pathname.split('/live/');
        if (parts[1]) {
          const code = parts[1].split('/')[0].split('?')[0];
          if (code && code.trim().length > 0) {
            return decodeURIComponent(code.trim());
          }
        }
      }
    } catch {
      // Ignored
    }
    return null;
  }
};
