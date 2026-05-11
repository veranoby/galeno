import redis from '../../config/redis.js';
import { logger } from '../../utils/logger.js';
import type { DoctorLocation } from '../location/location.service.js';

/**
 * Doctor Search Cache Configuration
 * Optimized for geospatial search results caching
 */

/**
 * Cache TTL Configuration (in seconds)
 */
export const DoctorSearchCacheTTL = {
  /** Default TTL for doctor search results - 5 minutes */
  DEFAULT: 300,

  /** Short TTL for high-traffic areas - 2 minutes */
  HIGH_TRAFFIC: 120,

  /** Extended TTL for low-traffic areas - 10 minutes */
  LOW_TRAFFIC: 600,

  /** Minimum TTL - 1 minute */
  MINIMUM: 60,

  /** Maximum TTL - 15 minutes */
  MAXIMUM: 900
} as const;

/**
 * Cache key pattern: `doctor_search:{lat}:{lng}:{radius}:{specialty?}`
 */
const CACHE_KEY_PREFIX = 'galeno:doctor_search:';

/**
 * Interface for cache key components
 */
export interface CacheKeyComponents {
  latitude: number;
  longitude: number;
  radiusKm: number;
  specialty?: string;
}

/**
 * Interface for cached search results with metadata
 */
export interface CachedSearchResult {
  /** Timestamp when the cache was created (ISO 8601) */
  cachedAt: string;

  /** Search parameters used */
  params: CacheKeyComponents;

  /** Cached doctor search results */
  results: DoctorLocation[];

  /** Cache hit count for this key */
  hitCount?: number;
}

/**
 * Doctor Search Cache Service
 * Provides caching layer for geospatial doctor searches to reduce Haversine calculations
 */
export class DoctorSearchCacheService {
  /**
   * Generates a cache key from search parameters
   * Pattern: `doctor_search:{lat}:{lng}:{radius}:{specialty?}`
   *
   * @param params - Search parameters
   * @returns Cache key string
   */
  static generateCacheKey(params: CacheKeyComponents): string {
    const { latitude, longitude, radiusKm, specialty } = params;

    // Round coordinates to 4 decimal places (~11m precision) for better cache hit rate
    const lat = latitude.toFixed(4);
    const lng = longitude.toFixed(4);
    const radius = Math.round(radiusKm);

    const keyParts = [lat, lng, radius];

    if (specialty) {
      // Normalize specialty to lowercase for consistent caching
      keyParts.push(specialty.toLowerCase().trim());
    }

    return `${CACHE_KEY_PREFIX}${keyParts.join(':')}`;
  }

  /**
   * Retrieves cached search results
   *
   * @param cacheKey - Cache key
   * @returns Cached results or null if not found/expired
   */
  static async get(cacheKey: string): Promise<CachedSearchResult | null> {
    try {
      const data = await redis.get(cacheKey);

      if (!data) {
        logger.debug({ cacheKey }, 'Cache miss');
        return null;
      }

      const cached = JSON.parse(data) as CachedSearchResult;

      // Increment hit counter for analytics
      await this.incrementHitCount(cacheKey);

      logger.debug(
        { cacheKey, cachedAt: cached.cachedAt, hitCount: cached.hitCount },
        'Cache hit'
      );

      return cached;
    } catch (error) {
      logger.error({ cacheKey, error }, 'Error retrieving cache');
      return null;
    }
  }

  /**
   * Stores search results in cache
   *
   * @param cacheKey - Cache key
   * @param results - Search results to cache
   * @param params - Original search parameters
   * @param ttl - Time to live in seconds (default: 300)
   * @returns Success status
   */
  static async set(
    cacheKey: string,
    results: DoctorLocation[],
    params: CacheKeyComponents,
    ttl: number = DoctorSearchCacheTTL.DEFAULT
  ): Promise<boolean> {
    try {
      // Validate TTL bounds
      const validTtl = Math.max(
        DoctorSearchCacheTTL.MINIMUM,
        Math.min(ttl, DoctorSearchCacheTTL.MAXIMUM)
      );

      const cachedResult: CachedSearchResult = {
        cachedAt: new Date().toISOString(),
        params,
        results,
        hitCount: 0
      };

      await redis.setex(cacheKey, validTtl, JSON.stringify(cachedResult));

      logger.info(
        {
          cacheKey,
          ttl: validTtl,
          resultCount: results.length,
          expiresAt: new Date(Date.now() + validTtl * 1000).toISOString()
        },
        'Cache set'
      );

      return true;
    } catch (error) {
      logger.error({ cacheKey, error }, 'Error setting cache');
      return false;
    }
  }

  /**
   * Invalidates cache for a specific search pattern
   *
   * @param params - Search parameters to invalidate
   * @returns Number of keys deleted
   */
  static async invalidate(params: CacheKeyComponents): Promise<number> {
    try {
      const pattern = this.generatePattern(params);
      const keys = await redis.keys(pattern);

      if (keys.length === 0) {
        logger.debug({ pattern }, 'No cache keys to invalidate');
        return 0;
      }

      await redis.del(...keys);

      logger.info(
        { pattern, deletedCount: keys.length },
        'Cache invalidated'
      );

      return keys.length;
    } catch (error) {
      logger.error({ params, error }, 'Error invalidating cache');
      return 0;
    }
  }

  /**
   * Invalidates ALL doctor search cache entries
   * Use with caution - affects all cached searches
   *
   * @returns Number of keys deleted
   */
  static async invalidateAll(): Promise<number> {
    try {
      const pattern = `${CACHE_KEY_PREFIX}*`;
      const keys = await redis.keys(pattern);

      if (keys.length === 0) {
        return 0;
      }

      await redis.del(...keys);

      logger.info(
        { deletedCount: keys.length },
        'All doctor search cache invalidated'
      );

      return keys.length;
    } catch (error) {
      logger.error({ error }, 'Error invalidating all cache');
      return 0;
    }
  }

  /**
   * Invalidates cache for a specific doctor
   * Removes all cache entries that include this doctor in results
   *
   * @param doctorId - Doctor ID to invalidate
   * @returns Estimated number of keys affected
   */
  static async invalidateByDoctor(doctorId: string): Promise<number> {
    try {
      // Scan all doctor search cache keys
      const pattern = `${CACHE_KEY_PREFIX}*`;
      const keys = await redis.keys(pattern);

      let invalidatedCount = 0;

      for (const key of keys) {
        const cached = await this.get(key);

        if (cached && cached.results.some(r => r.doctorId === doctorId)) {
          await redis.del(key);
          invalidatedCount++;
        }
      }

      if (invalidatedCount > 0) {
        logger.info(
          { doctorId, invalidatedCount },
          'Doctor-specific cache invalidated'
        );
      }

      return invalidatedCount;
    } catch (error) {
      logger.error({ doctorId, error }, 'Error invalidating doctor cache');
      return 0;
    }
  }

  /**
   * Gets cache statistics for monitoring
   *
   * @returns Cache statistics
   */
  static async getStats(): Promise<{
    totalKeys: number;
    pattern: string;
  }> {
    try {
      const pattern = `${CACHE_KEY_PREFIX}*`;
      const keys = await redis.keys(pattern);

      return {
        totalKeys: keys.length,
        pattern
      };
    } catch (error) {
      logger.error({ error }, 'Error getting cache stats');
      return {
        totalKeys: 0,
        pattern: `${CACHE_KEY_PREFIX}*`
      };
    }
  }

  /**
   * Checks if a cache key exists
   *
   * @param cacheKey - Cache key
   * @returns True if exists
   */
  static async exists(cacheKey: string): Promise<boolean> {
    try {
      const result = await redis.exists(cacheKey);
      return result === 1;
    } catch (error) {
      logger.error({ cacheKey, error }, 'Error checking cache existence');
      return false;
    }
  }

  /**
   * Gets remaining TTL for a cache key
   *
   * @param cacheKey - Cache key
   * @returns TTL in seconds, -1 if not found, -2 if expired
   */
  static async getTTL(cacheKey: string): Promise<number> {
    try {
      return await redis.ttl(cacheKey);
    } catch (error) {
      logger.error({ cacheKey, error }, 'Error getting cache TTL');
      return -1;
    }
  }

  /**
   * Increments hit counter for analytics
   *
   * @param cacheKey - Cache key
   */
  private static async incrementHitCount(cacheKey: string): Promise<void> {
    try {
      const data = await redis.get(cacheKey);
      if (data) {
        const cached = JSON.parse(data) as CachedSearchResult;
        cached.hitCount = (cached.hitCount || 0) + 1;
        const ttl = await redis.ttl(cacheKey);

        if (ttl > 0) {
          await redis.setex(cacheKey, ttl, JSON.stringify(cached));
        }
      }
    } catch (error) {
      // Silently fail - hit count is not critical
      logger.debug({ cacheKey, error }, 'Failed to increment hit count');
    }
  }

  /**
   * Generates a pattern for cache invalidation
   *
   * @param params - Search parameters
   * @returns Redis pattern string
   */
  private static generatePattern(params: CacheKeyComponents): string {
    const { latitude, longitude, radiusKm, specialty } = params;

    // Round coordinates to 4 decimal places
    const lat = latitude.toFixed(4);
    const lng = longitude.toFixed(4);
    const radius = Math.round(radiusKm);

    const patternParts = [CACHE_KEY_PREFIX, lat, lng, radius];

    if (specialty) {
      patternParts.push(specialty.toLowerCase().trim());
    } else {
      // If no specialty, match both with and without specialty
      patternParts.push('*');
    }

    return patternParts.join(':');
  }

  /**
   * Determines optimal TTL based on result count and area characteristics
   *
   * @param resultCount - Number of results
   * @param isHighTrafficArea - Whether this is a high-traffic area
   * @returns Optimal TTL in seconds
   */
  static determineOptimalTTL(resultCount: number, isHighTrafficArea = false): number {
    if (isHighTrafficArea) {
      return DoctorSearchCacheTTL.HIGH_TRAFFIC;
    }

    if (resultCount === 0) {
      // No results - cache longer to reduce DB load
      return DoctorSearchCacheTTL.LOW_TRAFFIC;
    }

    if (resultCount < 5) {
      // Low result count - likely low-traffic area
      return DoctorSearchCacheTTL.LOW_TRAFFIC;
    }

    return DoctorSearchCacheTTL.DEFAULT;
  }
}

export default DoctorSearchCacheService;
