// apps/api/src/services/documento/caducidad.service.ts
/**
 * Service para gestión de caducidad automática de documentos
 * Verifica y actualiza estado de documentos expirados
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger.js';

export class DocumentoCaducidadService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Verificar y actualizar documentos caducados
   * @returns Número de documentos actualizados
   */
  async verificarCaducidad(): Promise<number> {
    try {
      const hoy = new Date();

      // Buscar documentos vigentes con fecha de expiración vencida
      const documentosCaducados = await this.prisma.documento.findMany({
        where: {
          estado: 'activo',
          fechaExpiracion: {
            lte: hoy
          }
        },
        select: {
          id: true,
          archivoNombre: true,
          fechaExpiracion: true
        }
      });

      // Actualizar estado de cada documento
      let actualizados = 0;
      for (const doc of documentosCaducados) {
        await this.prisma.documento.update({
          where: { id: doc.id },
          data: { estado: 'caducado' }
        });
        actualizados++;
        logger.info(
          { documentoId: doc.id, archivoNombre: doc.archivoNombre, fechaExpiracion: doc.fechaExpiracion },
          'Documento marcado como caducado'
        );
      }

      if (actualizados > 0) {
        logger.info(
          { count: actualizados },
          'Verificación de caducidad completada'
        );
      }

      return actualizados;
    } catch (error) {
      logger.error({ error }, 'Error verificando caducidad de documentos');
      throw error;
    }
  }

  /**
   * Obtener documentos próximos a caducar
   * @param dias - Días para considerar como "próximo a caducar"
   * @returns Lista de documentos próximos a caducar
   */
  async obtenerProximosCaducar(dias: number = 30) {
    try {
      const hoy = new Date();
      const fechaLimite = new Date(hoy);
      fechaLimite.setDate(fechaLimite.getDate() + dias);

      return await this.prisma.documento.findMany({
        where: {
          estado: 'activo',
          fechaExpiracion: {
            gte: hoy,
            lte: fechaLimite
          }
        },
        include: {
          paciente: {
            select: {
              id: true,
              nombre: true,
              email: true
            }
          }
        },
        orderBy: {
          fechaExpiracion: 'asc'
        }
      });
    } catch (error) {
      logger.error({ error }, 'Error obteniendo documentos próximos a caducar');
      throw error;
    }
  }

  /**
   * Calcular fecha de expiración según tipo de documento
   * @param tipo - Tipo de documento
   * @param fechaEmision - Fecha de emisión (default: hoy)
   * @returns Fecha de expiración calculada
   */
  calcularFechaExpiracion(
    tipo: string,
    fechaEmision: Date = new Date()
  ): Date | null {
    const fecha = new Date(fechaEmision);

    switch (tipo) {
      case 'receta':
        // Recetas: 30 días
        fecha.setDate(fecha.getDate() + 30);
        return fecha;
      case 'examen':
        // Exámenes: 1 año
        fecha.setFullYear(fecha.getFullYear() + 1);
        return fecha;
      case 'certificado':
        // Certificados: 6 meses
        fecha.setMonth(fecha.getMonth() + 6);
        return fecha;
      default:
        // Sin expiración definida
        return null;
    }
  }
}

// Export singleton para uso directo
let instance: DocumentoCaducidadService | null = null;

export function getDocumentoCaducidadService(
  prisma?: PrismaClient
): DocumentoCaducidadService {
  if (!instance) {
    instance = new DocumentoCaducidadService(prisma || new PrismaClient());
  }
  return instance;
}

export default DocumentoCaducidadService;
