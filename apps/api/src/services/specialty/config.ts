/**
 * Specialty Configuration Service
 * Galeno - Ecuador Health 360
 *
 * Provides cached access to specialty configurations with
 * Zod validation and type-safe operations
 */

import { PrismaClient } from '@prisma/client';
import { CacheService } from '../cache/redis.js';
import { logger } from '../../utils/logger.js';
import {
  parseSpecialtyJson,
  type SpecialtyConfig,
  type SpecialtyTools,
  type ToolConfig,
  type EspecialidadWithConfig
} from './types.js';

// ============= CONSTANTS =============

const CACHE_PREFIX = 'galeno:specialty:';
const CACHE_TTL = 3600; // 1 hour

const prisma = new PrismaClient();

// ============= MEMORY CACHE =============

/**
 * In-memory cache for fast access (fallback when Redis is unavailable)
 */
const memoryCache = new Map<string, { data: SpecialtyConfig; expiry: number }>();

function getFromMemoryCache(key: string): SpecialtyConfig | null {
  const cached = memoryCache.get(key);
  if (!cached) return null;
  if (Date.now() > cached.expiry) {
    memoryCache.delete(key);
    return null;
  }
  return cached.data;
}

function setMemoryCache(key: string, data: SpecialtyConfig, ttlSeconds: number): void {
  memoryCache.set(key, {
    data,
    expiry: Date.now() + (ttlSeconds * 1000)
  });
}

function invalidateMemoryCache(key: string): void {
  memoryCache.delete(key);
}

// ============= SERVICE FUNCTIONS =============

/**
 * Get specialty configuration by ID with caching
 */
export async function getSpecialtyConfig(specialtyId: string): Promise<SpecialtyConfig | null> {
  const cacheKey = `${CACHE_PREFIX}config:${specialtyId}`;

  // Try memory cache first
  const memoryCached = getFromMemoryCache(cacheKey);
  if (memoryCached) {
    logger.debug({ specialtyId }, 'Specialty config retrieved from memory cache');
    return memoryCached;
  }

  // Try Redis cache
  try {
    const redisCached = await CacheService.get<SpecialtyConfig>(cacheKey);
    if (redisCached) {
      logger.debug({ specialtyId }, 'Specialty config retrieved from Redis cache');
      setMemoryCache(cacheKey, redisCached, CACHE_TTL);
      return redisCached;
    }
  } catch (error) {
    logger.warn({ specialtyId, error }, 'Redis cache unavailable, falling back to database');
  }

  // Fetch from database
  try {
    const especialidad = await prisma.especialidad.findUnique({
      where: { id: specialtyId }
    });

    if (!especialidad) {
      logger.warn({ specialtyId }, 'Specialty not found');
      return null;
    }

    const config = parseSpecialtyJson(especialidad.herramientas);

    // Cache the result
    setMemoryCache(cacheKey, config, CACHE_TTL);
    try {
      await CacheService.set(cacheKey, config, CACHE_TTL);
    } catch (cacheError) {
      logger.warn({ specialtyId, cacheError }, 'Failed to cache in Redis');
    }

    logger.debug({ specialtyId }, 'Specialty config retrieved from database');
    return config;
  } catch (error) {
    logger.error({ specialtyId, error }, 'Error fetching specialty config');
    return null;
  }
}

/**
 * Get specialty configuration by short name
 */
export async function getSpecialtyConfigByShortName(shortName: string): Promise<SpecialtyConfig | null> {
  const cacheKey = `${CACHE_PREFIX}short:${shortName}`;

  // Try memory cache first
  const memoryCached = getFromMemoryCache(cacheKey);
  if (memoryCached) {
    logger.debug({ shortName }, 'Specialty config retrieved from memory cache (by short name)');
    return memoryCached;
  }

  // Fetch from database
  try {
    const especialidad = await prisma.especialidad.findUnique({
      where: { nombreCorto: shortName }
    });

    if (!especialidad) {
      logger.warn({ shortName }, 'Specialty not found by short name');
      return null;
    }

    const config = parseSpecialtyJson(especialidad.herramientas);

    // Cache with both keys
    const idCacheKey = `${CACHE_PREFIX}config:${especialidad.id}`;
    setMemoryCache(cacheKey, config, CACHE_TTL);
    setMemoryCache(idCacheKey, config, CACHE_TTL);

    try {
      await Promise.all([
        CacheService.set(cacheKey, config, CACHE_TTL),
        CacheService.set(idCacheKey, config, CACHE_TTL)
      ]);
    } catch (cacheError) {
      logger.warn({ shortName, cacheError }, 'Failed to cache in Redis');
    }

    logger.debug({ shortName }, 'Specialty config retrieved from database (by short name)');
    return config;
  } catch (error) {
    logger.error({ shortName, error }, 'Error fetching specialty config by short name');
    return null;
  }
}

/**
 * Get all active specialties with their configurations
 */
export async function getAllActiveSpecialties(): Promise<EspecialidadWithConfig[]> {
  const cacheKey = `${CACHE_PREFIX}all:active`;

  // Try memory cache first
  const memoryCached = getFromMemoryCache(cacheKey) as EspecialidadWithConfig[] | null;
  if (memoryCached) {
    logger.debug('All active specialties retrieved from memory cache');
    return memoryCached;
  }

  try {
    const especialidades = await prisma.especialidad.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' }
    });

    const result = especialidades.map(esp => ({
      ...esp,
      herramientasParsed: parseSpecialtyJson(esp.herramientas)
    }));

    setMemoryCache(cacheKey, result as unknown as SpecialtyConfig, CACHE_TTL);

    try {
      await CacheService.set(cacheKey, result, CACHE_TTL);
    } catch (cacheError) {
      logger.warn({ cacheError }, 'Failed to cache all specialties in Redis');
    }

    logger.debug({ count: result.length }, 'All active specialties retrieved from database');
    return result;
  } catch (error) {
    logger.error({ error }, 'Error fetching all active specialties');
    return [];
  }
}

/**
 * Get tools configuration for a specialty
 */
export async function getSpecialtyTools(specialtyId: string): Promise<SpecialtyTools> {
  const config = await getSpecialtyConfig(specialtyId);
  return config?.tools ?? [];
}

/**
 * Get a specific tool configuration by ID
 */
export async function getToolConfig(specialtyId: string, toolId: string): Promise<ToolConfig | null> {
  const config = await getSpecialtyConfig(specialtyId);
  if (!config) return null;

  const tool = config.tools.find(t => t.id === toolId);
  return tool ?? null;
}

/**
 * Check if a feature is enabled for a specialty
 */
export async function isFeatureEnabled(
  specialtyId: string,
  feature: keyof NonNullable<SpecialtyConfig['features']>
): Promise<boolean> {
  const config = await getSpecialtyConfig(specialtyId);
  if (!config?.features) return false;

  return config.features[feature] ?? false;
}

/**
 * Invalidate cache for a specific specialty
 */
export async function invalidateSpecialtyCache(specialtyId: string): Promise<void> {
  const cacheKey = `${CACHE_PREFIX}config:${specialtyId}`;

  invalidateMemoryCache(cacheKey);

  try {
    await CacheService.del(cacheKey);
    await CacheService.delPattern(`${CACHE_PREFIX}short:*`);
    logger.debug({ specialtyId }, 'Specialty cache invalidated');
  } catch (error) {
    logger.error({ specialtyId, error }, 'Error invalidating specialty cache');
  }
}

/**
 * Invalidate all specialty caches
 */
export async function invalidateAllSpecialtyCaches(): Promise<void> {
  memoryCache.clear();

  try {
    await CacheService.delPattern(`${CACHE_PREFIX}*`);
    logger.debug('All specialty caches invalidated');
  } catch (error) {
    logger.error({ error }, 'Error invalidating all specialty caches');
  }
}

/**
 * Get specialty by doctor ID (primary specialty)
 */
export async function getDoctorPrimarySpecialty(doctorId: string): Promise<SpecialtyConfig | null> {
  const cacheKey = `${CACHE_PREFIX}doctor:${doctorId}:primary`;

  // Try memory cache first
  const memoryCached = getFromMemoryCache(cacheKey);
  if (memoryCached) {
    logger.debug({ doctorId }, 'Doctor primary specialty retrieved from memory cache');
    return memoryCached;
  }

  try {
    const doctorEspecialidad = await prisma.doctorEspecialidad.findFirst({
      where: {
        doctorId,
        principal: true
      },
      include: {
        especialidad: true
      }
    });

    if (!doctorEspecialidad) {
      logger.warn({ doctorId }, 'No primary specialty found for doctor');
      return null;
    }

    const config = parseSpecialtyJson(doctorEspecialidad.especialidad.herramientas);

    setMemoryCache(cacheKey, config, CACHE_TTL);
    try {
      await CacheService.set(cacheKey, config, CACHE_TTL);
    } catch (cacheError) {
      logger.warn({ doctorId, cacheError }, 'Failed to cache doctor specialty in Redis');
    }

    logger.debug({ doctorId }, 'Doctor primary specialty retrieved from database');
    return config;
  } catch (error) {
    logger.error({ doctorId, error }, 'Error fetching doctor primary specialty');
    return null;
  }
}

/**
 * Get all specialties for a doctor
 */
export async function getDoctorSpecialties(doctorId: string): Promise<SpecialtyConfig[]> {
  try {
    const doctorEspecialidades = await prisma.doctorEspecialidad.findMany({
      where: { doctorId },
      include: {
        especialidad: true
      },
      orderBy: { principal: 'desc' }
    });

    return doctorEspecialidades.map(de => parseSpecialtyJson(de.especialidad.herramientas));
  } catch (error) {
    logger.error({ doctorId, error }, 'Error fetching doctor specialties');
    return [];
  }
}

// ============= EXPORT =============

export default {
  getSpecialtyConfig,
  getSpecialtyConfigByShortName,
  getAllActiveSpecialties,
  getSpecialtyTools,
  getToolConfig,
  isFeatureEnabled,
  invalidateSpecialtyCache,
  invalidateAllSpecialtyCaches,
  getDoctorPrimarySpecialty,
  getDoctorSpecialties
};
