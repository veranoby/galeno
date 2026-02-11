import redis from '../../config/redis.js';
import { logger } from '../../utils/logger.js';

/**
 * TTL Configuration (in seconds)
 * Based on CREDENTIALS.md and application requirements
 */
export const CacheTTL = {
  // SSE Session Tokens - 24 hours (extended for doctor workday)
  SSE_SESSION: 86400,

  // IA Brain Preferences - 24 hours (learned patterns)
  IA_PREFERENCES: 86400,

  // Health Wallet Tokens - 7 days (portable access)
  HEALTH_WALLET_TOKEN: 604800,

  // JWT Refresh Tokens - 7 days
  REFRESH_TOKEN: 604800,

  // Session Cache - 1 hour
  SESSION: 3600,

  // API Response Cache - 5 minutes
  API_RESPONSE: 300,

  // Patient Data Cache - 15 minutes (privacy-sensitive)
  PATIENT_DATA: 900,

  // Doctor Availability Cache - 10 minutes
  AVAILABILITY: 600
} as const;

/**
 * Cache key prefixes for namespacing
 */
const KEY_PREFIXES = {
  SSE_SESSION: 'galeno:sse:',
  IA_PREFERENCES: 'galeno:ia:',
  HEALTH_WALLET: 'galeno:hw:',
  REFRESH_TOKEN: 'galeno:refresh:',
  SESSION: 'galeno:session:',
  API_CACHE: 'galeno:api:',
  PATIENT: 'galeno:patient:',
  AVAILABILITY: 'galeno:availability:'
} as const;

/**
 * Generic cache operations
 */
export class CacheService {
  /**
   * Get a value from cache
   */
  static async get<T>(key: string): Promise<T | null> {
    try {
      const value = await redis.get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error('Cache get error', { key, error });
      return null;
    }
  }

  /**
   * Set a value in cache with optional TTL
   */
  static async set(key: string, value: unknown, ttl?: number): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await redis.setex(key, ttl, serialized);
      } else {
        await redis.set(key, serialized);
      }
      return true;
    } catch (error) {
      logger.error('Cache set error', { key, error });
      return false;
    }
  }

  /**
   * Delete a value from cache
   */
  static async del(key: string): Promise<boolean> {
    try {
      await redis.del(key);
      return true;
    } catch (error) {
      logger.error('Cache delete error', { key, error });
      return false;
    }
  }

  /**
   * Delete multiple keys matching a pattern
   */
  static async delPattern(pattern: string): Promise<number> {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length === 0) return 0;
      await redis.del(...keys);
      return keys.length;
    } catch (error) {
      logger.error('Cache delete pattern error', { pattern, error });
      return 0;
    }
  }

  /**
   * Check if a key exists
   */
  static async exists(key: string): Promise<boolean> {
    try {
      const result = await redis.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Cache exists error', { key, error });
      return false;
    }
  }

  /**
   * Increment a counter
   */
  static async incr(key: string): Promise<number> {
    try {
      return await redis.incr(key);
    } catch (error) {
      logger.error('Cache increment error', { key, error });
      return 0;
    }
  }

  /**
   * Increment with expiry
   */
  static async incrExpiry(key: string, ttl: number): Promise<number> {
    try {
      const value = await redis.incr(key);
      if (value === 1) {
        await redis.expire(key, ttl);
      }
      return value;
    } catch (error) {
      logger.error('Cache increment expiry error', { key, error });
      return 0;
    }
  }

  /**
   * Set value only if key doesn't exist
   */
  static async setNX(key: string, value: unknown, ttl?: number): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      const result = await redis.set(key, serialized, 'NX');
      if (result === 'OK' && ttl) {
        await redis.expire(key, ttl);
      }
      return result === 'OK';
    } catch (error) {
      logger.error('Cache setNX error', { key, error });
      return false;
    }
  }

  /**
   * Get remaining TTL of a key
   */
  static async ttl(key: string): Promise<number> {
    try {
      return await redis.ttl(key);
    } catch (error) {
      logger.error('Cache TTL error', { key, error });
      return -1;
    }
  }
}

/**
 * Specialized cache helpers
 */
export class SessionCache {
  private static prefix = KEY_PREFIXES.SSE_SESSION;

  static async getSession(sessionId: string): Promise<{ doctorId: string; patientId?: string } | null> {
    return CacheService.get(`${this.prefix}${sessionId}`);
  }

  static async setSession(sessionId: string, data: { doctorId: string; patientId?: string }): Promise<boolean> {
    return CacheService.set(`${this.prefix}${sessionId}`, data, CacheTTL.SSE_SESSION);
  }

  static async deleteSession(sessionId: string): Promise<boolean> {
    return CacheService.del(`${this.prefix}${sessionId}`);
  }

  static async deleteDoctorSessions(doctorId: string): Promise<number> {
    // This requires scan, implement for production if needed
    return CacheService.delPattern(`${this.prefix}*`);
  }
}

export class IAPreferencesCache {
  private static prefix = KEY_PREFIXES.IA_PREFERENCES;

  static async getPreferences(doctorId: string): Promise<Record<string, unknown> | null> {
    return CacheService.get(`${this.prefix}${doctorId}`);
  }

  static async setPreferences(doctorId: string, preferences: Record<string, unknown>): Promise<boolean> {
    return CacheService.set(`${this.prefix}${doctorId}`, preferences, CacheTTL.IA_PREFERENCES);
  }

  static async updatePreference(doctorId: string, category: string, itemId: string, frequency: number): Promise<boolean> {
    const prefs = (await this.getPreferences(doctorId)) || {};
    if (!prefs[category]) prefs[category] = {};
    prefs[category][itemId] = frequency;
    return this.setPreferences(doctorId, prefs);
  }
}

export class HealthWalletCache {
  private static prefix = KEY_PREFIXES.HEALTH_WALLET;

  static async getToken(walletId: string): Promise<string | null> {
    return CacheService.get(`${this.prefix}token:${walletId}`);
  }

  static async setToken(walletId: string, token: string): Promise<boolean> {
    return CacheService.set(`${this.prefix}token:${walletId}`, token, CacheTTL.HEALTH_WALLET_TOKEN);
  }

  static async deleteToken(walletId: string): Promise<boolean> {
    return CacheService.del(`${this.prefix}token:${walletId}`);
  }

  static async validateToken(walletId: string, token: string): Promise<boolean> {
    const stored = await this.getToken(walletId);
    return stored === token;
  }
}

export class RefreshTokenCache {
  private static prefix = KEY_PREFIXES.REFRESH_TOKEN;

  static async get(userId: string): Promise<string | null> {
    return CacheService.get(`${this.prefix}${userId}`);
  }

  static async set(userId: string, token: string): Promise<boolean> {
    return CacheService.set(`${this.prefix}${userId}`, token, CacheTTL.REFRESH_TOKEN);
  }

  static async delete(userId: string): Promise<boolean> {
    return CacheService.del(`${this.prefix}${userId}`);
  }

  static async revokeAll(userId: string): Promise<boolean> {
    return this.delete(userId);
  }
}

export class APICache {
  private static prefix = KEY_PREFIXES.API_CACHE;

  static get(requestKey: string): Promise<unknown> {
    return CacheService.get(`${this.prefix}${requestKey}`);
  }

  set(requestKey: string, response: unknown, ttl: number = CacheTTL.API_RESPONSE): Promise<boolean> {
    return CacheService.set(`${this.prefix}${requestKey}`, response, ttl);
  }

  invalidate(pattern: string): Promise<number> {
    return CacheService.delPattern(`${this.prefix}${pattern}`);
  }
}

export class PatientCache {
  private static prefix = KEY_PREFIXES.PATIENT;

  static get(patientId: string): Promise<unknown> {
    return CacheService.get(`${this.prefix}${patientId}`);
  }

  set(patientId: string, data: unknown): Promise<boolean> {
    return CacheService.set(`${this.prefix}${patientId}`, data, CacheTTL.PATIENT_DATA);
  }

  invalidate(patientId: string): Promise<boolean> {
    return CacheService.del(`${this.prefix}${patientId}`);
  }

  invalidateAll(): Promise<number> {
    return CacheService.delPattern(`${this.prefix}*`);
  }
}

export class AvailabilityCache {
  private static prefix = KEY_PREFIXES.AVAILABILITY;

  static get(doctorId: string, date: string): Promise<unknown> {
    return CacheService.get(`${this.prefix}${doctorId}:${date}`);
  }

  set(doctorId: string, date: string, slots: unknown): Promise<boolean> {
    return CacheService.set(`${this.prefix}${doctorId}:${date}`, slots, CacheTTL.AVAILABILITY);
  }

  invalidate(doctorId: string): Promise<number> {
    return CacheService.delPattern(`${this.prefix}${doctorId}:*`);
  }
}

/**
 * Rate limiting helper
 */
export class RateLimitCache {
  static async checkLimit(identifier: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; remaining: number }> {
    const key = `galeno:ratelimit:${identifier}`;
    const current = await CacheService.incrExpiry(key, windowSeconds);

    return {
      allowed: current <= limit,
      remaining: Math.max(0, limit - current)
    };
  }
}

// Export all as default
export default {
  CacheService,
  SessionCache,
  IAPreferencesCache,
  HealthWalletCache,
  RefreshTokenCache,
  APICache,
  PatientCache,
  AvailabilityCache,
  RateLimitCache,
  CacheTTL
};
