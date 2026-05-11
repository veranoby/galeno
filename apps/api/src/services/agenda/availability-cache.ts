// apps/api/src/services/agenda/availability-cache.ts
import redis from '../../config/redis.js';
import { SlotDisponibilidad } from '@prisma/client';
import { logger } from '../../utils/logger.js';

export class AvailabilityCache {
  private static readonly CACHE_PREFIX = 'availability:';
  private static readonly DEFAULT_TTL = 300; // 5 minutes

  /**
   * Get cached availability slots for a doctor on a specific date
   */
  static async getSlots(doctorId: string,  date: Date): Promise<SlotDisponibilidad[] | null> {
    const cacheKey = `${this.CACHE_PREFIX}slots:${doctorId}:${date.toISOString().split('T')[0]}`;
    
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const slots = JSON.parse(cached);
        logger.debug(`Cache HIT for availability slots: ${cacheKey}`);
        return slots;
      }
      logger.debug(`Cache MISS for availability slots: ${cacheKey}`);
      return null;
    } catch (error) {
      logger.error('Error getting cached availability slots:', error);
      return null;
    }
  }

  /**
   * Cache availability slots for a doctor on a specific date
   */
  static async setSlots(doctorId: string,  date: Date,  slots: SlotDisponibilidad[],  ttl: number = this.DEFAULT_TTL): Promise<void> {
    const cacheKey = `${this.CACHE_PREFIX}slots:${doctorId}:${date.toISOString().split('T')[0]}`;
    
    try {
      await redis.setex(cacheKey,  ttl,  JSON.stringify(slots));
      logger.debug(`Cached availability slots: ${cacheKey} for ${ttl}s`);
    } catch (error) {
      logger.error('Error caching availability slots:', error);
    }
  }

  /**
   * Invalidate cached availability slots for a doctor
   */
  static async invalidateSlots(doctorId: string,  date?: Date): Promise<void> {
    let pattern: string;
    if (date) {
      pattern = `${this.CACHE_PREFIX}slots:${doctorId}:${date.toISOString().split('T')[0]}*`;
    } else {
      pattern = `${this.CACHE_PREFIX}slots:${doctorId}:*`;
    }

    try {
      // Find and delete all matching keys
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
        logger.info(`Invalidated availability cache for pattern: ${pattern} (${keys.length} keys)`);
      }
    } catch (error) {
      logger.error('Error invalidating availability cache:', error);
    }
  }

  /**
   * Get cached available time slots for a doctor on a specific date
   */
  static async getAvailableSlots(doctorId: string,  date: Date): Promise<any[] | null> {
    const cacheKey = `${this.CACHE_PREFIX}available:${doctorId}:${date.toISOString().split('T')[0]}`;
    
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const slots = JSON.parse(cached);
        logger.debug(`Cache HIT for available slots: ${cacheKey}`);
        return slots;
      }
      logger.debug(`Cache MISS for available slots: ${cacheKey}`);
      return null;
    } catch (error) {
      logger.error('Error getting cached available slots:', error);
      return null;
    }
  }

  /**
   * Cache available time slots for a doctor on a specific date
   */
  static async setAvailableSlots(doctorId: string,  date: Date,  slots: any[],  ttl: number = this.DEFAULT_TTL): Promise<void> {
    const cacheKey = `${this.CACHE_PREFIX}available:${doctorId}:${date.toISOString().split('T')[0]}`;
    
    try {
      await redis.setex(cacheKey,  ttl,  JSON.stringify(slots));
      logger.debug(`Cached available slots: ${cacheKey} for ${ttl}s`);
    } catch (error) {
      logger.error('Error caching available slots:', error);
    }
  }

  /**
   * Invalidate cached available time slots for a doctor
   */
  static async invalidateAvailableSlots(doctorId: string,  date?: Date): Promise<void> {
    let pattern: string;
    if (date) {
      pattern = `${this.CACHE_PREFIX}available:${doctorId}:${date.toISOString().split('T')[0]}*`;
    } else {
      pattern = `${this.CACHE_PREFIX}available:${doctorId}:*`;
    }

    try {
      // Find and delete all matching keys
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
        logger.info(`Invalidated available slots cache for pattern: ${pattern} (${keys.length} keys)`);
      }
    } catch (error) {
      logger.error('Error invalidating available slots cache:', error);
    }
  }

  /**
   * Clear all availability-related cache for a doctor
   */
  static async clearDoctorCache(doctorId: string): Promise<void> {
    const patterns = [
      `${this.CACHE_PREFIX}slots:${doctorId}:*`,
      `${this.CACHE_PREFIX}available:${doctorId}:*`
    ];

    for (const pattern of patterns) {
      try {
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
          await redis.del(...keys);
          logger.info(`Cleared availability cache for doctor ${doctorId}: ${keys.length} keys`);
        }
      } catch (error) {
        logger.error(`Error clearing availability cache for doctor ${doctorId}:`, error);
      }
    }
  }
}