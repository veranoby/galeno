import prisma from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import DoctorSearchCacheService, {
  type CacheKeyComponents,
  DoctorSearchCacheTTL
} from '../cache/doctor-search.cache.js';

export interface Location {
  lat: number;
  lng: number;
}

export interface NearbyDoctorRequest {
  patientLat: number;
  patientLng: number;
  radiusKm?: number;
  especialidad?: string;
}

export interface DoctorLocation {
  doctorId: string;
  doctorName: string;
  especialidad: string;
  oficinaName: string;
  distanciaKm: number;
  ubicacion: Location;
}

export interface UbicacionWithDetails {
  id: string;
  nombre: string;
  direccion: string;
  latitud: number | null;
  longitud: number | null;
  telefono: string | null;
  doctorName: string;
  doctorEspecialidad: string | null;
}

/**
 * Location Service - Handles geolocation operations
 * Includes Haversine formula for distance calculations
 */
export class LocationService {
  private readonly EARTH_RADIUS_KM = 6371;

  /**
   * Converts degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Calculates distance between two coordinates using Haversine formula
   * @param lat1 - Latitude of first point
   * @param lng1 - Longitude of first point
   * @param lat2 - Latitude of second point
   * @param lng2 - Longitude of second point
   * @returns Distance in kilometers
   */
  public calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return this.EARTH_RADIUS_KM * c;
  }

  /**
   * Finds nearby doctors based on patient location
   * Uses Redis cache to reduce Haversine calculations
   *
   * @param request - Search parameters including patient location and radius
   * @returns List of doctors sorted by distance
   */
  async findNearbyDoctors(
    request: NearbyDoctorRequest
  ): Promise<DoctorLocation[]> {
    const { patientLat, patientLng, radiusKm = 10, especialidad } = request;

    try {
      // Validate coordinates
      if (
        Math.abs(patientLat) > 90 ||
        Math.abs(patientLng) > 180
      ) {
        throw new Error('Invalid patient coordinates');
      }

      // Generate cache key
      const cacheParams: CacheKeyComponents = {
        latitude: patientLat,
        longitude: patientLng,
        radiusKm,
        specialty: especialidad
      };

      const cacheKey = DoctorSearchCacheService.generateCacheKey(cacheParams);

      // Try to get from cache first
      const cached = await DoctorSearchCacheService.get(cacheKey);
      if (cached) {
        logger.info(
          {
            cacheKey,
            cachedAt: cached.cachedAt,
            hitCount: cached.hitCount,
            resultCount: cached.results.length
          },
          'Cache hit for nearby doctors search'
        );
        return cached.results;
      }

      logger.debug({ cacheKey }, 'Cache miss - fetching from database');

      // Cache miss - fetch from database
      const results = await this.findNearbyDoctorsFromDatabase(request);

      // Determine optimal TTL based on result count
      const isHighTrafficArea = results.length > 10;
      const optimalTtl = DoctorSearchCacheService.determineOptimalTTL(
        results.length,
        isHighTrafficArea
      );

      // Cache the results
      await DoctorSearchCacheService.set(cacheKey, results, cacheParams, optimalTtl);

      logger.info(
        {
          cacheKey,
          ttl: optimalTtl,
          resultCount: results.length,
          isHighTrafficArea
        },
        'Cached nearby doctors search results'
      );

      return results;
    } catch (error) {
      logger.error({ error, request }, 'Error finding nearby doctors');
      throw new Error('Failed to find nearby doctors');
    }
  }

  /**
   * Internal method to fetch nearby doctors from database
   * Separated for clarity and testability
   */
  private async findNearbyDoctorsFromDatabase(
    request: NearbyDoctorRequest
  ): Promise<DoctorLocation[]> {
    const { patientLat, patientLng, radiusKm = 10, especialidad } = request;

    // Fetch all offices with location data
    const oficinas = await prisma.ubicacion.findMany({
      where: {
        latitud: { not: null },
        longitud: { not: null },
        activo: true
      },
      include: {
        doctor: {
          select: {
            id: true,
            nombre: true,
            especialidad: true
          }
        }
      }
    });

    // Calculate distances and filter by radius
    const results: DoctorLocation[] = [];

    for (const oficina of oficinas) {
      const oficinaLat = oficina.latitud?.toNumber() || 0;
      const oficinaLng = oficina.longitud?.toNumber() || 0;

      if (!oficinaLat || !oficinaLng) continue;

      const distancia = this.calculateDistance(
        patientLat,
        patientLng,
        oficinaLat,
        oficinaLng
      );

      if (distancia <= radiusKm) {
        // Apply specialty filter if provided
        if (especialidad) {
          const doctor = oficina.doctor;
          const matchesSpecialty =
            doctor.especialidad?.toLowerCase() === especialidad.toLowerCase();

          if (!matchesSpecialty) {
            continue;
          }
        }

        // oficina.doctor is a single object, not an array
        const doctor = oficina.doctor;
        results.push({
          doctorId: doctor.id,
          doctorName: doctor.nombre,
          especialidad: doctor.especialidad || 'Medicina General',
          oficinaName: oficina.nombre,
          distanciaKm: Math.round(distancia * 10) / 10,
          ubicacion: {
            lat: oficinaLat,
            lng: oficinaLng
          }
        });
      }
    }

    // Sort by distance (closest first)
    return results.sort((a, b) => a.distanciaKm - b.distanciaKm);
  }

  /**
   * Updates doctor's location
   * Note: Coordinates are NOT encrypted as they are public data
   * Invalidates cache for this doctor
   *
   * @param doctorId - Doctor's ID
   * @param oficinaId - Office ID
   * @param lat - Latitude
   * @param lng - Longitude
   * @returns Success status
   */
  async updateDoctorLocation(
    doctorId: string,
    oficinaId: string,
    lat: number,
    lng: number
  ): Promise<boolean> {
    try {
      // Validate coordinates
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        throw new Error('Invalid coordinates');
      }

      await prisma.ubicacion.update({
        where: { id: oficinaId },
        data: {
          latitud: lat,
          longitud: lng
        }
      });

      // Invalidate cache for this doctor
      await DoctorSearchCacheService.invalidateByDoctor(doctorId);

      logger.info({
        doctorId,
        oficinaId,
        action: 'update_location'
      }, 'Doctor location updated and cache invalidated');

      return true;
    } catch (error) {
      logger.error({ error, doctorId, oficinaId }, 'Error updating doctor location');
      return false;
    }
  }

  /**
   * Gets doctor's location
   * @param doctorId - Doctor's ID
   * @returns Location or null
   */
  async getDoctorLocation(doctorId: string): Promise<Location | null> {
    try {
      const ubicacion = await prisma.ubicacion.findFirst({
        where: {
          doctorId,
          activo: true
        },
        select: {
          latitud: true,
          longitud: true
        }
      });

      if (!ubicacion || !ubicacion.latitud || !ubicacion.longitud) {
        return null;
      }

      return {
        lat: ubicacion.latitud.toNumber(),
        lng: ubicacion.longitud.toNumber()
      };
    } catch (error) {
      logger.error({ error, doctorId }, 'Error getting doctor location');
      return null;
    }
  }

  /**
   * Gets all offices with doctor information
   * @returns List of offices
   */
  async getAllOffices(): Promise<UbicacionWithDetails[]> {
    try {
      const oficinas = await prisma.ubicacion.findMany({
        where: { activo: true },
        include: {
          doctor: {
            select: {
              id: true,
              nombre: true,
              especialidad: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return oficinas.map(oficina => ({
        id: oficina.id,
        nombre: oficina.nombre,
        direccion: oficina.direccion,
        latitud: oficina.latitud?.toNumber() || null,
        longitud: oficina.longitud?.toNumber() || null,
        telefono: oficina.telefono,
        doctorName: oficina.doctor.nombre,
        doctorEspecialidad: oficina.doctor.especialidad
      }));
    } catch (error) {
      logger.error({ error }, 'Error getting all offices');
      throw new Error('Failed to get offices');
    }
  }

  /**
   * Gets office by ID
   * @param officeId - Office ID
   * @returns Office details or null
   */
  async getOfficeById(officeId: string): Promise<{
    id: string;
    nombre: string;
    direccion: string;
    lat: number;
    lng: number;
    telefono: string | null;
  } | null> {
    try {
      const office = await prisma.ubicacion.findUnique({
        where: { id: officeId },
        select: {
          id: true,
          nombre: true,
          direccion: true,
          latitud: true,
          longitud: true,
          telefono: true
        }
      });

      if (!office) {
        return null;
      }

      return {
        id: office.id,
        nombre: office.nombre,
        direccion: office.direccion,
        lat: office.latitud?.toNumber() || 0,
        lng: office.longitud?.toNumber() || 0,
        telefono: office.telefono
      };
    } catch (error) {
      logger.error({ error, officeId }, 'Error getting office by ID');
      return null;
    }
  }

  /**
   * Gets decrypted coordinates for a doctor
   * @param doctorId - Doctor's ID
   * @returns Decrypted coordinates or null
   */
  async getDecryptedCoordinates(doctorId: string): Promise<Location | null> {
    return this.getDoctorLocation(doctorId);
  }

  /**
   * Sets consent for location tracking
   * Invalidates cache when consent changes
   *
   * @param doctorId - Doctor's ID
   * @param activated - Whether tracking is activated
   * @returns Success status
   */
  async setConsent(doctorId: string, activated: boolean): Promise<boolean> {
    try {
      await prisma.ubicacion.updateMany({
        where: { doctorId },
        data: {
          activo: activated
        }
      });

      // Invalidate cache when consent changes
      if (!activated) {
        await DoctorSearchCacheService.invalidateByDoctor(doctorId);
      }

      logger.info({
        doctorId,
        activated,
        action: 'set_consent'
      }, 'Location consent updated');

      return true;
    } catch (error) {
      logger.error({ error, doctorId }, 'Error setting consent');
      return false;
    }
  }
}

export default new LocationService();
