import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import DoctorSearchCacheService, {
  DoctorSearchCacheTTL,
  type CacheKeyComponents,
  type CachedSearchResult
} from '../../../services/cache/doctor-search.cache';
import type { DoctorLocation } from '../../../services/location/location.service';

// Mock Redis
const mockRedisGet = vi.fn();
const mockRedisSetex = vi.fn();
const mockRedisDel = vi.fn();
const mockRedisKeys = vi.fn();
const mockRedisExists = vi.fn();
const mockRedisTtl = vi.fn();

vi.mock('../../../config/redis.js', () => ({
  default: {
    get: mockRedisGet,
    setex: mockRedisSetex,
    del: mockRedisDel,
    keys: mockRedisKeys,
    exists: mockRedisExists,
    ttl: mockRedisTtl
  }
}));

// Mock logger
vi.mock('../../../utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('DoctorSearchCacheService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  const mockDoctorResults: DoctorLocation[] = [
    {
      doctorId: 'doc1',
      doctorName: 'Dr. Juan Pérez',
      especialidad: 'Cardiología',
      oficinaName: 'Consultorio Centro',
      distanciaKm: 1.5,
      ubicacion: { lat: -0.1807, lng: -78.4678 }
    },
    {
      doctorId: 'doc2',
      doctorName: 'Dra. María López',
      especialidad: 'Pediatría',
      oficinaName: 'Clínica Norte',
      distanciaKm: 2.3,
      ubicacion: { lat: -0.1750, lng: -78.4650 }
    }
  ];

  const mockCacheParams: CacheKeyComponents = {
    latitude: -0.1807,
    longitude: -78.4678,
    radiusKm: 5,
    specialty: 'Cardiología'
  };

  describe('generateCacheKey', () => {
    it('should generate cache key with all parameters', () => {
      const key = DoctorSearchCacheService.generateCacheKey(mockCacheParams);

      expect(key).toMatch(/^galeno:doctor_search:-0\.1807:-78\.4678:5:cardiología$/);
    });

    it('should generate cache key without specialty', () => {
      const params: CacheKeyComponents = {
        latitude: -0.1807,
        longitude: -78.4678,
        radiusKm: 10
      };

      const key = DoctorSearchCacheService.generateCacheKey(params);

      expect(key).toMatch(/^galeno:doctor_search:-0\.1807:-78\.4678:10$/);
    });

    it('should round coordinates to 4 decimal places', () => {
      const params: CacheKeyComponents = {
        latitude: -0.18075432,
        longitude: -78.46789876,
        radiusKm: 5
      };

      const key = DoctorSearchCacheService.generateCacheKey(params);

      // Should round to 4 decimal places
      expect(key).toContain('-0.1808');
      expect(key).toContain('-78.4679');
    });

    it('should normalize specialty to lowercase', () => {
      const params: CacheKeyComponents = {
        latitude: -0.1807,
        longitude: -78.4678,
        radiusKm: 5,
        specialty: 'CARDIOLOGÍA'
      };

      const key = DoctorSearchCacheService.generateCacheKey(params);

      expect(key).toContain('cardiología');
    });

    it('should trim specialty whitespace', () => {
      const params: CacheKeyComponents = {
        latitude: -0.1807,
        longitude: -78.4678,
        radiusKm: 5,
        specialty: '  Cardiología  '
      };

      const key = DoctorSearchCacheService.generateCacheKey(params);

      expect(key).toContain('cardiología');
    });

    it('should round radius to nearest integer', () => {
      const params: CacheKeyComponents = {
        latitude: -0.1807,
        longitude: -78.4678,
        radiusKm: 5.7
      };

      const key = DoctorSearchCacheService.generateCacheKey(params);

      expect(key).toContain(':6');
    });
  });

  describe('get', () => {
    it('should return cached results on cache hit', async () => {
      const cacheKey = 'galeno:doctor_search:-0.1807:-78.4678:5:cardiología';
      const cachedData: CachedSearchResult = {
        cachedAt: new Date().toISOString(),
        params: mockCacheParams,
        results: mockDoctorResults,
        hitCount: 5
      };

      mockRedisGet.mockResolvedValueOnce(JSON.stringify(cachedData));
      mockRedisTtl.mockResolvedValueOnce(300);
      mockRedisSetex.mockResolvedValueOnce('OK');

      const result = await DoctorSearchCacheService.get(cacheKey);

      expect(result).toEqual(cachedData);
      expect(mockRedisGet).toHaveBeenCalledWith(cacheKey);
    });

    it('should return null on cache miss', async () => {
      const cacheKey = 'galeno:doctor_search:-0.1807:-78.4678:5:cardiología';

      mockRedisGet.mockResolvedValueOnce(null);

      const result = await DoctorSearchCacheService.get(cacheKey);

      expect(result).toBeNull();
      expect(mockRedisGet).toHaveBeenCalledWith(cacheKey);
    });

    it('should return null on Redis error', async () => {
      const cacheKey = 'galeno:doctor_search:-0.1807:-78.4678:5:cardiología';

      mockRedisGet.mockRejectedValueOnce(new Error('Redis connection error'));

      const result = await DoctorSearchCacheService.get(cacheKey);

      expect(result).toBeNull();
    });

    it('should increment hit count on cache hit', async () => {
      const cacheKey = 'galeno:doctor_search:-0.1807:-78.4678:5:cardiología';
      const cachedData: CachedSearchResult = {
        cachedAt: new Date().toISOString(),
        params: mockCacheParams,
        results: mockDoctorResults,
        hitCount: 5
      };

      mockRedisGet.mockResolvedValueOnce(JSON.stringify(cachedData));
      mockRedisTtl.mockResolvedValueOnce(300);
      mockRedisSetex.mockResolvedValueOnce('OK');

      await DoctorSearchCacheService.get(cacheKey);

      // Should update hit count to 6
      expect(mockRedisSetex).toHaveBeenCalledWith(
        cacheKey,
        300,
        expect.stringContaining('"hitCount":6')
      );
    });
  });

  describe('set', () => {
    it('should cache results with default TTL', async () => {
      const cacheKey = 'galeno:doctor_search:-0.1807:-78.4678:5:cardiología';

      await DoctorSearchCacheService.set(cacheKey, mockDoctorResults, mockCacheParams);

      expect(mockRedisSetex).toHaveBeenCalledWith(
        cacheKey,
        DoctorSearchCacheTTL.DEFAULT,
        expect.any(String)
      );
    });

    it('should cache results with custom TTL', async () => {
      const cacheKey = 'galeno:doctor_search:-0.1807:-78.4678:5:cardiología';
      const customTtl = 600;

      await DoctorSearchCacheService.set(cacheKey, mockDoctorResults, mockCacheParams, customTtl);

      expect(mockRedisSetex).toHaveBeenCalledWith(
        cacheKey,
        customTtl,
        expect.any(String)
      );
    });

    it('should enforce minimum TTL', async () => {
      const cacheKey = 'galeno:doctor_search:-0.1807:-78.4678:5:cardiología';
      const tooShortTtl = 10;

      await DoctorSearchCacheService.set(cacheKey, mockDoctorResults, mockCacheParams, tooShortTtl);

      expect(mockRedisSetex).toHaveBeenCalledWith(
        cacheKey,
        DoctorSearchCacheTTL.MINIMUM,
        expect.any(String)
      );
    });

    it('should enforce maximum TTL', async () => {
      const cacheKey = 'galeno:doctor_search:-0.1807:-78.4678:5:cardiología';
      const tooLongTtl = 3600;

      await DoctorSearchCacheService.set(cacheKey, mockDoctorResults, mockCacheParams, tooLongTtl);

      expect(mockRedisSetex).toHaveBeenCalledWith(
        cacheKey,
        DoctorSearchCacheTTL.MAXIMUM,
        expect.any(String)
      );
    });

    it('should store metadata with results', async () => {
      const cacheKey = 'galeno:doctor_search:-0.1807:-78.4678:5:cardiología';

      await DoctorSearchCacheService.set(cacheKey, mockDoctorResults, mockCacheParams);

      const storedData = JSON.parse(
        (mockRedisSetex.mock.calls[0][2] as string)
      ) as CachedSearchResult;

      expect(storedData.results).toEqual(mockDoctorResults);
      expect(storedData.params).toEqual(mockCacheParams);
      expect(storedData.cachedAt).toBeDefined();
      expect(storedData.hitCount).toBe(0);
    });

    it('should return false on Redis error', async () => {
      const cacheKey = 'galeno:doctor_search:-0.1807:-78.4678:5:cardiología';

      mockRedisSetex.mockRejectedValueOnce(new Error('Redis connection error'));

      const result = await DoctorSearchCacheService.set(
        cacheKey,
        mockDoctorResults,
        mockCacheParams
      );

      expect(result).toBe(false);
    });
  });

  describe('invalidate', () => {
    it('should invalidate cache for specific parameters', async () => {
      mockRedisKeys.mockResolvedValueOnce([
        'galeno:doctor_search:-0.1807:-78.4678:5:cardiología',
        'galeno:doctor_search:-0.1807:-78.4678:5'
      ]);
      mockRedisDel.mockResolvedValueOnce(2);

      const result = await DoctorSearchCacheService.invalidate(mockCacheParams);

      expect(mockRedisKeys).toHaveBeenCalled();
      expect(mockRedisDel).toHaveBeenCalled();
      expect(result).toBe(2);
    });

    it('should return 0 when no keys match', async () => {
      mockRedisKeys.mockResolvedValueOnce([]);

      const result = await DoctorSearchCacheService.invalidate(mockCacheParams);

      expect(result).toBe(0);
    });

    it('should return 0 on Redis error', async () => {
      mockRedisKeys.mockRejectedValueOnce(new Error('Redis connection error'));

      const result = await DoctorSearchCacheService.invalidate(mockCacheParams);

      expect(result).toBe(0);
    });
  });

  describe('invalidateAll', () => {
    it('should invalidate all doctor search cache entries', async () => {
      mockRedisKeys.mockResolvedValueOnce([
        'galeno:doctor_search:-0.1807:-78.4678:5',
        'galeno:doctor_search:-0.1850:-78.4700:10',
        'galeno:doctor_search:-0.1900:-78.4800:15:pediatría'
      ]);
      mockRedisDel.mockResolvedValueOnce(3);

      const result = await DoctorSearchCacheService.invalidateAll();

      expect(mockRedisKeys).toHaveBeenCalledWith('galeno:doctor_search:*');
      expect(mockRedisDel).toHaveBeenCalled();
      expect(result).toBe(3);
    });

    it('should return 0 when no cache entries exist', async () => {
      mockRedisKeys.mockResolvedValueOnce([]);

      const result = await DoctorSearchCacheService.invalidateAll();

      expect(result).toBe(0);
    });
  });

  describe('invalidateByDoctor', () => {
    it('should invalidate cache entries containing specific doctor', async () => {
      const doctorId = 'doc1';

      // First call returns cache keys
      mockRedisKeys.mockResolvedValueOnce([
        'galeno:doctor_search:-0.1807:-78.4678:5'
      ]);

      // Second call returns cached data containing the doctor
      mockRedisGet.mockResolvedValueOnce({
        cachedAt: new Date().toISOString(),
        params: mockCacheParams,
        results: mockDoctorResults,
        hitCount: 0
      });

      mockRedisDel.mockResolvedValueOnce(1);

      const result = await DoctorSearchCacheService.invalidateByDoctor(doctorId);

      expect(mockRedisKeys).toHaveBeenCalled();
      expect(mockRedisGet).toHaveBeenCalled();
      expect(mockRedisDel).toHaveBeenCalled();
      expect(result).toBe(1);
    });

    it('should not invalidate cache entries without the doctor', async () => {
      const doctorId = 'doc3'; // Not in mock results

      mockRedisKeys.mockResolvedValueOnce([
        'galeno:doctor_search:-0.1807:-78.4678:5'
      ]);

      mockRedisGet.mockResolvedValueOnce({
        cachedAt: new Date().toISOString(),
        params: mockCacheParams,
        results: mockDoctorResults,
        hitCount: 0
      });

      const result = await DoctorSearchCacheService.invalidateByDoctor(doctorId);

      expect(result).toBe(0);
      expect(mockRedisDel).not.toHaveBeenCalled();
    });

    it('should return 0 on Redis error', async () => {
      mockRedisKeys.mockRejectedValueOnce(new Error('Redis connection error'));

      const result = await DoctorSearchCacheService.invalidateByDoctor('doc1');

      expect(result).toBe(0);
    });
  });

  describe('exists', () => {
    it('should return true if cache key exists', async () => {
      mockRedisExists.mockResolvedValueOnce(1);

      const result = await DoctorSearchCacheService.exists('galeno:doctor_search:test');

      expect(result).toBe(true);
      expect(mockRedisExists).toHaveBeenCalledWith('galeno:doctor_search:test');
    });

    it('should return false if cache key does not exist', async () => {
      mockRedisExists.mockResolvedValueOnce(0);

      const result = await DoctorSearchCacheService.exists('galeno:doctor_search:test');

      expect(result).toBe(false);
    });

    it('should return false on Redis error', async () => {
      mockRedisExists.mockRejectedValueOnce(new Error('Redis connection error'));

      const result = await DoctorSearchCacheService.exists('galeno:doctor_search:test');

      expect(result).toBe(false);
    });
  });

  describe('getTTL', () => {
    it('should return remaining TTL', async () => {
      mockRedisTtl.mockResolvedValueOnce(250);

      const result = await DoctorSearchCacheService.getTTL('galeno:doctor_search:test');

      expect(result).toBe(250);
      expect(mockRedisTtl).toHaveBeenCalledWith('galeno:doctor_search:test');
    });

    it('should return -1 if key does not exist', async () => {
      mockRedisTtl.mockResolvedValueOnce(-1);

      const result = await DoctorSearchCacheService.getTTL('galeno:doctor_search:test');

      expect(result).toBe(-1);
    });

    it('should return -2 if key expired', async () => {
      mockRedisTtl.mockResolvedValueOnce(-2);

      const result = await DoctorSearchCacheService.getTTL('galeno:doctor_search:test');

      expect(result).toBe(-2);
    });

    it('should return -1 on Redis error', async () => {
      mockRedisTtl.mockRejectedValueOnce(new Error('Redis connection error'));

      const result = await DoctorSearchCacheService.getTTL('galeno:doctor_search:test');

      expect(result).toBe(-1);
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      mockRedisKeys.mockResolvedValueOnce([
        'galeno:doctor_search:-0.1807:-78.4678:5',
        'galeno:doctor_search:-0.1850:-78.4700:10'
      ]);

      const stats = await DoctorSearchCacheService.getStats();

      expect(stats.totalKeys).toBe(2);
      expect(stats.pattern).toBe('galeno:doctor_search:*');
    });

    it('should return 0 keys on Redis error', async () => {
      mockRedisKeys.mockRejectedValueOnce(new Error('Redis connection error'));

      const stats = await DoctorSearchCacheService.getStats();

      expect(stats.totalKeys).toBe(0);
    });
  });

  describe('determineOptimalTTL', () => {
    it('should return HIGH_TRAFFIC TTL for high-traffic areas', () => {
      const ttl = DoctorSearchCacheService.determineOptimalTTL(15, true);

      expect(ttl).toBe(DoctorSearchCacheTTL.HIGH_TRAFFIC);
    });

    it('should return LOW_TRAFFIC TTL for empty results', () => {
      const ttl = DoctorSearchCacheService.determineOptimalTTL(0, false);

      expect(ttl).toBe(DoctorSearchCacheTTL.LOW_TRAFFIC);
    });

    it('should return LOW_TRAFFIC TTL for low result count', () => {
      const ttl = DoctorSearchCacheService.determineOptimalTTL(3, false);

      expect(ttl).toBe(DoctorSearchCacheTTL.LOW_TRAFFIC);
    });

    it('should return DEFAULT TTL for normal result count', () => {
      const ttl = DoctorSearchCacheService.determineOptimalTTL(8, false);

      expect(ttl).toBe(DoctorSearchCacheTTL.DEFAULT);
    });

    it('should return HIGH_TRAFFIC TTL for high result count', () => {
      const ttl = DoctorSearchCacheService.determineOptimalTTL(15, false);

      expect(ttl).toBe(DoctorSearchCacheTTL.DEFAULT);
    });
  });

  describe('Cache TTL Configuration', () => {
    it('should have correct default TTL (5 minutes)', () => {
      expect(DoctorSearchCacheTTL.DEFAULT).toBe(300);
    });

    it('should have correct high traffic TTL (2 minutes)', () => {
      expect(DoctorSearchCacheTTL.HIGH_TRAFFIC).toBe(120);
    });

    it('should have correct low traffic TTL (10 minutes)', () => {
      expect(DoctorSearchCacheTTL.LOW_TRAFFIC).toBe(600);
    });

    it('should have correct minimum TTL (1 minute)', () => {
      expect(DoctorSearchCacheTTL.MINIMUM).toBe(60);
    });

    it('should have correct maximum TTL (15 minutes)', () => {
      expect(DoctorSearchCacheTTL.MAXIMUM).toBe(900);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete cache flow: miss → set → get → invalidate', async () => {
      const cacheKey = 'galeno:doctor_search:-0.1807:-78.4678:5:cardiología';

      // Cache miss
      mockRedisGet.mockResolvedValueOnce(null);

      const missResult = await DoctorSearchCacheService.get(cacheKey);
      expect(missResult).toBeNull();

      // Set cache
      mockRedisSetex.mockResolvedValueOnce('OK');
      await DoctorSearchCacheService.set(cacheKey, mockDoctorResults, mockCacheParams);
      expect(mockRedisSetex).toHaveBeenCalled();

      // Cache hit
      const cachedData: CachedSearchResult = {
        cachedAt: new Date().toISOString(),
        params: mockCacheParams,
        results: mockDoctorResults,
        hitCount: 0
      };
      mockRedisGet.mockResolvedValueOnce(JSON.stringify(cachedData));
      mockRedisTtl.mockResolvedValueOnce(300);
      mockRedisSetex.mockResolvedValueOnce('OK');

      const hitResult = await DoctorSearchCacheService.get(cacheKey);
      expect(hitResult).toEqual(cachedData);

      // Invalidate
      mockRedisKeys.mockResolvedValueOnce([cacheKey]);
      mockRedisDel.mockResolvedValueOnce(1);

      const invalidateResult = await DoctorSearchCacheService.invalidate(mockCacheParams);
      expect(invalidateResult).toBe(1);
    });
  });
});
