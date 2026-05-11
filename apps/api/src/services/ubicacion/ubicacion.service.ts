// apps/api/src/services/ubicacion/ubicacion.service.ts
/**
 * Service para gestión de ubicaciones y cálculo de distancias GPS
 * Implementa fórmula Haversine para cálculo preciso de distancias
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger.js';

export interface OficinaConDistancia {
  id: string;
  nombre: string;
  direccion: string;
  latitud: number;
  longitud: number;
  radio: number;
  activo: boolean;
  distancia: number;
}

export interface DoctorConUbicacion {
  id: string;
  nombre: string;
  email: string;
  oficinaId: string;
  oficinaNombre: string;
  diaSemana: string;
  horaInicio: string;
  horaFin: string;
}

export class UbicacionService {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient();
  }

  /**
   * Calcular distancia entre dos puntos usando fórmula Haversine
   * @param lat1 - Latitud punto 1
   * @param lon1 - Longitud punto 1
   * @param lat2 - Latitud punto 2
   * @param lon2 - Longitud punto 2
   * @returns Distancia en kilómetros
   */
  private calcularDistancia(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Radio de la Tierra en km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Obtener oficinas cercanas a una coordenada
   * @param lat - Latitud del usuario
   * @param lng - Longitud del usuario
   * @param radioKm - Radio de búsqueda en km (default: 10)
   * @returns Lista de oficinas con distancia
   */
  async obtenerOficinasCercanas(
    lat: number,
    lng: number,
    radioKm: number = 10
  ): Promise<OficinaConDistancia[]> {
    try {
      const oficinas = await this.prisma.oficina.findMany({
        where: { activo: true }
      });

      const oficinasConDistancia: OficinaConDistancia[] = oficinas
        .map((oficina) => ({
          id: oficina.id,
          nombre: oficina.nombre,
          direccion: oficina.direccion,
          latitud: Number(oficina.latitud),
          longitud: Number(oficina.longitud),
          radio: Number(oficina.radio),
          activo: oficina.activo,
          distancia: this.calcularDistancia(
            lat,
            lng,
            Number(oficina.latitud),
            Number(oficina.longitud)
          )
        }))
        .filter((oficina) => oficina.distancia <= radioKm)
        .sort((a, b) => a.distancia - b.distancia);

      logger.info(
        {
          lat,
          lng,
          radioKm,
          count: oficinasConDistancia.length
        },
        'Oficinas cercanas encontradas'
      );

      return oficinasConDistancia;
    } catch (error) {
      logger.error({ error }, 'Error obteniendo oficinas cercanas');
      throw error;
    }
  }

  /**
   * Obtener doctores que atienden en una oficina en un día específico
   * @param oficinaId - ID de la oficina
   * @param diaSemana - Día de la semana ('LUN', 'MAR', etc.)
   * @returns Lista de doctores con información de ubicación
   */
  async obtenerDoctoresPorOficina(
    oficinaId: string,
    diaSemana: string
  ): Promise<DoctorConUbicacion[]> {
    try {
      const ubicaciones = await this.prisma.doctorUbicacion.findMany({
        where: {
          oficinaId,
          diaSemana
        },
        include: {
          doctor: {
            select: {
              id: true,
              nombre: true,
              email: true
            }
          },
          oficina: {
            select: {
              id: true,
              nombre: true
            }
          }
        }
      });

      const doctores: DoctorConUbicacion[] = ubicaciones.map((ubicacion) => ({
        id: ubicacion.doctor.id,
        nombre: ubicacion.doctor.nombre,
        email: ubicacion.doctor.email,
        oficinaId: ubicacion.oficinaId,
        oficinaNombre: ubicacion.oficina.nombre,
        diaSemana: ubicacion.diaSemana,
        horaInicio: ubicacion.horaInicio,
        horaFin: ubicacion.horaFin
      }));

      logger.info(
        {
          oficinaId,
          diaSemana,
          count: doctores.length
        },
        'Doctores por oficina obtenidos'
      );

      return doctores;
    } catch (error) {
      logger.error({ error }, 'Error obteniendo doctores por oficina');
      throw error;
    }
  }

  /**
   * Obtener todas las oficinas activas
   * @returns Lista de oficinas
   */
  async obtenerTodasLasOficinas() {
    try {
      return await this.prisma.oficina.findMany({
        where: { activo: true },
        orderBy: { nombre: 'asc' }
      });
    } catch (error) {
      logger.error({ error }, 'Error obteniendo todas las oficinas');
      throw error;
    }
  }

  /**
   * Crear nueva oficina
   */
  async crearOficina(data: {
    nombre: string;
    direccion: string;
    latitud: number;
    longitud: number;
    radio?: number;
  }) {
    try {
      const oficina = await this.prisma.oficina.create({
        data: {
          nombre: data.nombre,
          direccion: data.direccion,
          latitud: data.latitud,
          longitud: data.longitud,
          radio: data.radio ?? 5,
          activo: true
        }
      });

      logger.info({ oficinaId: oficina.id }, 'Oficina creada exitosamente');
      return oficina;
    } catch (error) {
      logger.error({ error }, 'Error creando oficina');
      throw error;
    }
  }

  /**
   * Actualizar oficina existente
   */
  async actualizarOficina(
    id: string,
    data: {
      nombre?: string;
      direccion?: string;
      latitud?: number;
      longitud?: number;
      radio?: number;
      activo?: boolean;
    }
  ) {
    try {
      const oficina = await this.prisma.oficina.update({
        where: { id },
        data
      });

      logger.info({ oficinaId: id }, 'Oficina actualizada exitosamente');
      return oficina;
    } catch (error) {
      logger.error({ error }, 'Error actualizando oficina');
      throw error;
    }
  }

  /**
   * Eliminar oficina (lógico - set activo = false)
   */
  async eliminarOficina(id: string) {
    try {
      const oficina = await this.prisma.oficina.update({
        where: { id },
        data: { activo: false }
      });

      logger.info({ oficinaId: id }, 'Oficina eliminada (desactivada)');
      return oficina;
    } catch (error) {
      logger.error({ error }, 'Error eliminando oficina');
      throw error;
    }
  }

  /**
   * Asignar doctor a oficina
   */
  async asignarDoctorAOficina(
    doctorId: string,
    oficinaId: string,
    diaSemana: string,
    horaInicio: string,
    horaFin: string
  ) {
    try {
      const ubicacion = await this.prisma.doctorUbicacion.create({
        data: {
          doctorId,
          oficinaId,
          diaSemana,
          horaInicio,
          horaFin
        }
      });

      logger.info(
        { doctorId, oficinaId, diaSemana },
        'Doctor asignado a oficina'
      );
      return ubicacion;
    } catch (error) {
      logger.error({ error }, 'Error asignando doctor a oficina');
      throw error;
    }
  }

  /**
   * Remover doctor de oficina
   */
  async removerDoctorDeOficina(
    doctorId: string,
    oficinaId: string,
    diaSemana: string
  ) {
    try {
      await this.prisma.doctorUbicacion.deleteMany({
        where: {
          doctorId,
          oficinaId,
          diaSemana
        }
      });

      logger.info(
        { doctorId, oficinaId, diaSemana },
        'Doctor removido de oficina'
      );
    } catch (error) {
      logger.error({ error }, 'Error removiendo doctor de oficina');
      throw error;
    }
  }
}

// Export singleton
let instance: UbicacionService | null = null;

export function getUbicacionService(
  prisma?: PrismaClient
): UbicacionService {
  if (!instance) {
    instance = new UbicacionService(prisma || new PrismaClient());
  }
  return instance;
}

export default UbicacionService;
