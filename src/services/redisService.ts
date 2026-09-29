/**
 * RunWar High-Speed Serverless Redis Client
 * Provides sub-millisecond in-memory caching for live runner telemetry, spectator pins, and cheers.
 * Built with native HTTP REST (Upstash compatible) — zero Node sockets, zero bundle bloat.
 * 100% Graceful Fallback: If Redis is unconfigured or offline, all calls safely return null/empty.
 */

interface RedisResponse<T = any> {
  result?: T;
  error?: string;
}

const REDIS_REST_URL = (import.meta.env.VITE_UPSTASH_REDIS_REST_URL || '').replace(/\/$/, '');
const REDIS_REST_TOKEN = import.meta.env.VITE_UPSTASH_REDIS_REST_TOKEN || '';

export const redisService = {
  /**
   * Check whether Redis credentials are provided in the environment
   */
  isConfigured(): boolean {
    return Boolean(REDIS_REST_URL && REDIS_REST_TOKEN);
  },

  /**
   * Execute raw Redis command via Upstash REST endpoint with 1.5s timeout
   */
  async execute<T = any>(command: any[]): Promise<T | null> {
    if (!this.isConfigured()) return null;

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 1500) : null;

    try {
      const response = await fetch(`${REDIS_REST_URL}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${REDIS_REST_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(command),
        signal: controller?.signal,
      });

      if (!response.ok) {
        return null;
      }

      const data: RedisResponse<T> = await response.json();
      return data.result ?? null;
    } catch {
      // Non-blocking: network timeout or offline
      return null;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  },

  /**
   * Set a key with string value and optional TTL in seconds
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    const cmd: any[] = ['SET', key, value];
    if (ttlSeconds && ttlSeconds > 0) {
      cmd.push('EX', ttlSeconds);
    }
    const res = await this.execute<string>(cmd);
    return res === 'OK';
  },

  /**
   * Get a string value by key
   */
  async get(key: string): Promise<string | null> {
    return this.execute<string>(['GET', key]);
  },

  /**
   * Store a key-value map as a Redis Hash
   */
  async hset(key: string, fields: Record<string, string | number | boolean>): Promise<boolean> {
    const entries = Object.entries(fields);
    if (entries.length === 0) return false;

    const flat: any[] = ['HSET', key];
    entries.forEach(([f, v]) => {
      flat.push(f);
      flat.push(typeof v === 'object' ? JSON.stringify(v) : String(v));
    });

    const res = await this.execute<number>(flat);
    return res !== null;
  },

  /**
   * Retrieve all fields and values from a Redis Hash
   */
  async hgetall(key: string): Promise<Record<string, string> | null> {
    const raw = await this.execute<string[] | Record<string, string>>(['HGETALL', key]);
    if (!raw) return null;

    // Upstash returns array of [field1, val1, field2, val2, ...] or key-value object
    if (!Array.isArray(raw)) {
      return raw as Record<string, string>;
    }

    const result: Record<string, string> = {};
    for (let i = 0; i < raw.length; i += 2) {
      const field = raw[i];
      const val = raw[i + 1];
      if (field != null && val != null) {
        result[field] = val;
      }
    }
    return result;
  },

  /**
   * Atomically increment a numeric field in a Redis Hash (ideal for live cheers)
   */
  async hincrby(key: string, field: string, increment: number = 1): Promise<number | null> {
    return this.execute<number>(['HINCRBY', key, field, increment]);
  },

  /**
   * Set key expiration time in seconds
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    const res = await this.execute<number>(['EXPIRE', key, seconds]);
    return res === 1;
  },

  /**
   * Delete one or more keys
   */
  async del(key: string): Promise<boolean> {
    const res = await this.execute<number>(['DEL', key]);
    return res != null && res > 0;
  },
};
