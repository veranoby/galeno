import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import locationService from '../../../services/location/location.service';
import DoctorSearchCacheService from '../../../services/cache/doctor-search.cache';
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

// Mock Prisma
const mockUbicacionFindMany = vi.fn();
const mockUbicacionUpdate = vi.fn();
const mockUbicacionUpdateMany = vi.fn();

vi.mock('../../../config/database.js', () => ({
  default: {
    ubicacion: {
      findMany: mockUbicacionFindMany,
      update: mockUbicacionUpdate,
      updateMany: mockUbicacionUpdateMany
    }
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

describe('LocationService with Caching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  const mockOffices = [
    {
      id: 'office1',
      nombre: 'Consultorio Centro',
      direccion: 'Av. Principal 123',
      latitud: -0.1807,
      longitud: -78.4678,
      telefono: '+593999999999',
      activo: true,
      doctor: {
        id: 'doc1',
        nombre: 'Dr. Juan Pérez',
        especialidad: 'Cardiología'
      }
    },
    {
      id: 'office2',
      nombre: 'Clínica Norte',
      direccion: 'Calle Secundaria 456',
      latitud: -0.1750,
      longitud: -78.4650,
      telefono: '+593999999998',
      activo: true,
      doctor: {
        id: 'doc2',
        nombre: 'Dra. María López',
        especialidad: 'Pediatría'
      }
    }
  ];

  const mockPatientLocation = {
    patientLat: -0.1807,
    patientLng: -78.4678,
    radiusKm: 5
  };

  describe('findNearbyDoctors - Cache Integration', () => {
    it('should fetch from database on cache miss and cache results', async () => {
      // Cache miss
      mockRedisGet.mockResolvedValueOnce(null);

      // Database response
      mockUbicacionFindMany.mockResolvedValueOnce(mockOffices);

      // Cache set
      mockRedisSetex.mockResolvedValueOnce('OK');

      const results = await locationService.findNearbyDoctors(mockPatientLocation);

      // Verify database was queried
      expect(mockUbicacionFindMany).toHaveBeenCalled();

      // Verify results were cached
      expect(mockRedisSetex).toHaveBeenCalled();

      // Verify results are returned
      expect(results).toHaveLength(2);
      expect(results[0].doctorId).toBe('doc1');
    });

    it('should return cached results on cache hit', async () => {
      const cachedResults: DoctorLocation[] = [
        {
          doctorId: 'doc1',
          doctorName: 'Dr. Juan Pérez',
          especialidad: 'Cardiología',
          oficinaName: 'Consultorio Centro',
          distanciaKm: 1.5,
          ubicacion: { lat: -0.1807, lng: -78.4678 }
        }
      ];

      const cachedData = {
        cachedAt: new Date().toISOString(),
        params: {
          latitude: mockPatientLocation.patientLat,
          longitude: mockPatientLocation.patientLng,
          radiusKm: mockPatientLocation.radiusKm
        },
        results: cachedResults,
        hitCount: 5
      };

      // Cache hit
      mockRedisGet.mockResolvedValueOnce(JSON.stringify(cachedData));
      mockRedisTtl.mockResolvedValueOnce(300);
      mockRedisSetex.mockResolvedValueOnce('OK');

      const results = await locationService.findNearbyDoctors(mockPatientLocation);

      // Verify database was NOT queried
      expect(mockUbicacionFindMany).not.toHaveBeenCalled();

      // Verify cached results are returned
      expect(results).toHaveLength(1);
      expect(results[0].doctorId).toBe('doc1');
    });

    it('should cache with specialty filter', async () => {
      // Cache miss
      mockRedisGet.mockResolvedValueOnce(null);

      // Database response
      mockUbicacionFindMany.mockResolvedValueOnce(mockOffices);

      // Cache set
      mockRedisSetex.mockResolvedValueOnce('OK');

      const results = await locationService.findNearbyDoctors({
        ...mockPatientLocation,
        especialidad: 'Cardiología'
      });

      // Verify cache key includes specialty
      expect(mockRedisSetex).toHaveBeenCalledWith(
        expect.stringContaining('cardiología'),
        expect.any(Number),
        expect.any(String)
      );

      expect(results).toHaveLength(1);
      expect(results[0].especialidad).toBe('Cardiología');
    });

    it('should handle Redis errors gracefully', async () => {
      // Redis error on get
      mockRedisGet.mockRejectedValueOnce(new Error('Redis connection error'));

      // Database response
      mockUbicacionFindMany.mockResolvedValueOnce(mockOffices);

      const results = await locationService.findNearbyDoctors(mockPatientLocation);

      // Should still return results from database
      expect(results).toHaveLength(2);
    });
  });

  describe('updateDoctorLocation - Cache Invalidation', () => {
    it('should invalidate cache after updating location', async () => {
      // Database update success
      mockUbicacionUpdate.mockResolvedValueOnce({});

      // Cache invalidation
      mockRedisKeys.mockResolvedValueOnce([
        'galeno:doctor_search:-0.1807:-78.4678:5'
      ]);
      mockRedisGet.mockResolvedValueOnce({
        cachedAt: new Date().toISOString(),
        params: {},
        results: [{ doctorId: 'doc1' }],
        hitCount: 0
      });
      mockRedisDel.mockResolvedValueOnce(1);

      const result = await locationService.updateDoctorLocation(
        'doc1',
        'office1',
        -0.1850,
        -78.4700
      );

      expect(result).toBe(true);
      expect(mockUbicacionUpdate).toHaveBeenCalled();
      expect(mockRedisKeys).toHaveBeenCalled();
      expect(mockRedisDel).toHaveBeenCalled();
    });

    it('should handle cache invalidation errors gracefully', async () => {
      // Database update success
      mockUbicacionUpdate.mockResolvedValueOnce({});

      // Cache invalidation error
      mockRedisKeys.mockRejectedValueOnce(new Error('Redis error'));

      const result = await locationService.updateDoctorLocation(
        'doc1',
        'office1',
        -0.1850,
        -78.4700
      );

      // Should still return success
      expect(result).toBe(true);
    });
  });

  describe('setConsent - Cache Invalidation', () => {
    it('should invalidate cache when consent is revoked', async () => {
      // Database update success
      mockUbicacionUpdateMany.mockResolvedValueOnce({});

      // Cache invalidation
      mockRedisKeys.mockResolvedValueOnce([
        'galeno:doctor_search:-0.1807:-78.4678:5'
      ]);
      mockRedisGet.mockResolvedValueOnce({
        cachedAt: new Date().toISOString(),
        params: {},
        results: [{ doctorId: 'doc1' }],
        hitCount: 0
      });
      mockRedisDel.mockResolvedValueOnce(1);

      const result = await locationService.setConsent('doc1', false);

      expect(result).toBe(true);
      expect(mockUbicacionUpdateMany).toHaveBeenCalled();
      expect(mockRedisKeys).toHaveBeenCalled();
      expect(mockRedisDel).toHaveBeenCalled();
    });

    it('should not invalidate cache when consent is activated', async () => {
      // Database update success
      mockUbicacionUpdateMany.mockResolvedValueOnce({});

      const result = await locationService.setConsent('doc1', true);

      expect(result).toBe(true);
      expect(mockUbicacionUpdateMany).toHaveBeenCalled();
      expect(mockRedisKeys).not.toHaveBeenCalled();
    });
  });

  describe('Performance Optimization Verification', () => {
    it('should reduce database queries with cache hits', async () => {
      const cachedData = {
        cachedAt: new Date().toISOString(),
        params: mockPatientLocation,
        results: [],
        hitCount: 10
      };

      // First call - cache miss
      mockRedisGet.mockResolvedValueOnce(null);
      mockUbicacionFindMany.mockResolvedValueOnce([]);
      mockRedisSetex.mockResolvedValueOnce('OK');

      await locationService.findNearbyDoctors(mockPatientLocation);

      const firstDbCalls = mockUbicacionFindMany.mock.calls.length;

      // Second call - cache hit
      mockRedisGet.mockResolvedValueOnce(JSON.stringify(cachedData));
      mockRedisTtl.mockResolvedValueOnce(300);
      mockRedisSetex.mockResolvedValueOnce('OK');

      await locationService.findNearbyDoctors(mockPatientLocation);

      const secondDbCalls = mockUbicacionFindMany.mock.calls.length;

      // Database should only be called once
      expect(firstDbCalls).toBe(1);
      expect(secondDbCalls).toBe(1); // Not incremented
    });

    it('should use optimal TTL based on result count', async () => {
      // Cache miss
      mockRedisGet.mockResolvedValueOnce(null);

      // Many results - high traffic area
      const manyOffices = Array(15).fill(mockOffices[0]);
      mockUbicacionFindMany.mockResolvedValueOnce(manyOffices);

      mockRedisSetex.mockResolvedValueOnce('OK');

      await locationService.findNearbyDoctors(mockPatientLocation);

      // Should use HIGH_TRAFFIC TTL (120 seconds)
      expect(mockRedisSetex).toHaveBeenCalledWith(
        expect.any(String),
        120, // HIGH_TRAFFIC TTL
        expect.any(String)
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle invalid coordinates', async () => {
      await expect(
        locationService.findNearbyDoctors({
          patientLat: 100, // Invalid
          patientLng: -78.4678,
          radiusKm: 5
        })
      ).rejects.toThrow('Invalid patient coordinates');
    });

    it('should handle empty results', async () => {
      // Cache miss
      mockRedisGet.mockResolvedValueOnce(null);

      // No offices in database
      mockUbicacionFindMany.mockResolvedValueOnce([]);

      mockRedisSetex.mockResolvedValueOnce('OK');

      const results = await locationService.findNearbyDoctors(mockPatientLocation);

      expect(results).toHaveLength(0);
      expect(mockRedisSetex).toHaveBeenCalled(); // Should still cache empty results
    });

    it('should filter by radius correctly', async () => {
      // Cache miss
      mockRedisGet.mockResolvedValueOnce(null);

      // Offices at different distances
      mockUbicacionFindMany.mockResolvedValueOnce([
        {
          ...mockOffices[0],
          latitud: -0.1807, // Very close
          longitud: -78.4678
        },
        {
          ...mockOffices[1],
          latitud: -1.0000, // Far away
          longitud: -78.4650
        }
      ]);

      mockRedisSetex.mockResolvedValueOnce('OK');

      const results = await locationService.findNearbyDoctors({
        patientLat: -0.1807,
        patientLng: -78.4678,
        radiusKm: 5
      });

      // Only the close office should be returned
      expect(results.length).toBeLessThan(2);
    });
  });
});
