import prisma from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import { Prisma } from '@prisma/client';

/**
 * Información del certificado de firma
 */
export interface CertificadoFirma {
  subject: string;
  cn: string;
  cedula: string;
  email?: string;
  issuer: string;
  serialNumber: string;
  validFrom: Date;
  validTo: Date;
}

/**
 * Resultado de la firma de consulta
 */
export interface FirmaConsultaResult {
  exito: boolean;
  mensaje: string;
  consulta?: {
    id: string;
    firmado: boolean;
    fechaFirma: Date | null;
    firmaCertificado: CertificadoFirma | null;
  };
}

/**
 * Errores específicos de firma de consultas
 */
export class FirmaConsultaError extends Error {
  constructor(
    mensaje: string,
    public code: 'ESTADO_INVALIDO' | 'YA_FIRMADA' | 'CERTIFICADO_INVALIDO' | 'SIN_PERMISO'
  ) {
    super(mensaje);
    this.name = 'FirmaConsultaError';
  }
}

/**
 * Servicio de firma para consultas médicas
 *
 * Integra firma electrónica XAdES-BES con consultas,
 * previene ediciones post-firma y valida certificados.
 */
export class ConsultaSignatureService {
  /**
   * Verifica si una consulta puede ser firmada
   */
  async puedeFirmar(consultaId: string, doctorId: string): Promise<boolean> {
    const consulta = await prisma.consulta.findUnique({
      where: { id: consultaId },
      select: { id: true, estado: true, firmado: true, doctorId: true }
    });

    if (!consulta) {
      return false;
    }

    // Solo el doctor que creó la consulta puede firmarla
    if (consulta.doctorId !== doctorId) {
      return false;
    }

    // No se puede firmar si ya está firmada
    if (consulta.firmado) {
      return false;
    }

    // Solo se puede firmar en estados finales
    return ['finalizada', 'interconsulta'].includes(consulta.estado);
  }

  /**
   * Firma una consulta médica
   *
   * @param consultaId ID de la consulta
   * @param doctorId ID del doctor que firma
   * @param xmlFirma XML de firma XAdES-BES
   * @param certificado Información del certificado usado
   * @returns Resultado de la operación
   */
  async firmarConsulta(
    consultaId: string,
    doctorId: string,
    xmlFirma: string,
    certificado: CertificadoFirma
  ): Promise<FirmaConsultaResult> {
    try {
      // Obtener consulta
      const consulta = await prisma.consulta.findUnique({
        where: { id: consultaId }
      });

      if (!consulta) {
        throw new FirmaConsultaError(
          'Consulta no encontrada',
          'SIN_PERMISO'
        );
      }

      // Verificar que el doctor sea el creador
      if (consulta.doctorId !== doctorId) {
        logger.warn({
          consultaId,
          doctorId,
          actualDoctorId: consulta.doctorId
        }, 'Intento de firma por doctor no autorizado');
        throw new FirmaConsultaError(
          'Solo el doctor que creó la consulta puede firmarla',
          'SIN_PERMISO'
        );
      }

      // Verificar que no esté ya firmada
      if (consulta.firmado) {
        throw new FirmaConsultaError(
          'La consulta ya está firmada y no puede modificarse',
          'YA_FIRMADA'
        );
      }

      // Verificar que esté en un estado que permita firma
      if (!['finalizada', 'interconsulta'].includes(consulta.estado)) {
        throw new FirmaConsultaError(
          `Solo se pueden firmar consultas en estado finalizada o interconsulta. Estado actual: ${consulta.estado}`,
          'ESTADO_INVALIDO'
        );
      }

      // Verificar vigencia del certificado
      const ahora = new Date();
      if (ahora < certificado.validFrom || ahora > certificado.validTo) {
        throw new FirmaConsultaError(
          'El certificado no está vigente',
          'CERTIFICADO_INVALIDO'
        );
      }

      // Firmar la consulta (transacción atómica)
      const consultaFirmada = await prisma.consulta.update({
        where: { id: consultaId },
        data: {
          firmado: true,
          fechaFirma: ahora,
          firmaXml: xmlFirma,
          firmaCertificado: certificado as unknown as Prisma.JsonObject
        },
        select: {
          id: true,
          firmado: true,
          fechaFirma: true,
          firmaCertificado: true
        }
      });

      logger.info({
        consultaId,
        doctorId,
        certificadoCn: certificado.cn,
        certificadoCedula: certificado.cedula
      }, 'Consulta firmada exitosamente');

      return {
        exito: true,
        mensaje: 'Consulta firmada exitosamente',
        consulta: {
          id: consultaFirmada.id,
          firmado: consultaFirmada.firmado,
          fechaFirma: consultaFirmada.fechaFirma,
          firmaCertificado: consultaFirmada.firmaCertificado as unknown as CertificadoFirma | null
        }
      };
    } catch (error) {
      if (error instanceof FirmaConsultaError) {
        throw error;
      }

      logger.error({ error, consultaId, doctorId }, 'Error al firmar consulta');
      throw new FirmaConsultaError(
        'Error al procesar la firma',
        'CERTIFICADO_INVALIDO'
      );
    }
  }

  /**
   * Verifica si una consulta puede ser editada
   * previniendo ediciones post-firma
   */
  async puedeEditarse(consultaId: string): Promise<boolean> {
    const consulta = await prisma.consulta.findUnique({
      where: { id: consultaId },
      select: { firmado: true, estado: true }
    });

    if (!consulta) {
      return false;
    }

    // Si está firmada, no se puede editar
    if (consulta.firmado) {
      return false;
    }

    // Solo estados borrador y triaje pueden editarse
    return ['borrador', 'triaje'].includes(consulta.estado);
  }

  /**
   * Valida que una actualización no viole la firma
   */
  async validarActualizacion(
    consultaId: string,
    datosActualizacion: Record<string, any>,
    userId: string
  ): Promise<{ valida: boolean; error?: string }> {
    const consulta = await prisma.consulta.findUnique({
      where: { id: consultaId },
      select: { id: true, firmado: true, estado: true, doctorId: true }
    });

    if (!consulta) {
      return { valida: false, error: 'Consulta no encontrada' };
    }

    // Verificar permisos del doctor
    if (consulta.doctorId !== userId) {
      return { valida: false, error: 'Sin permisos para modificar esta consulta' };
    }

    // Si está firmada, no permitir ningún cambio
    if (consulta.firmado) {
      return {
        valida: false,
        error: 'La consulta está firmada y no puede modificarse. Contacte al administrador si necesita realizar cambios.'
      };
    }

    // Verificar estado para edición
    if (!['borrador', 'triaje'].includes(consulta.estado)) {
      return {
        valida: false,
        error: `Las consultas en estado ${consulta.estado} no pueden modificarse directamente`
      };
    }

    // Verificar que no se esté intentando firmar sin estar en estado válido
    if (datosActualizacion.firmado === true &&
        !['finalizada', 'interconsulta'].includes(datosActualizacion.estado || consulta.estado)) {
      return {
        valida: false,
        error: 'Solo se pueden firmar consultas en estado finalizada o interconsulta'
      };
    }

    return { valida: true };
  }

  /**
   * Obtiene el historial de firma de una consulta
   */
  async obtenerHistorialFirma(consultaId: string) {
    const consulta = await prisma.consulta.findUnique({
      where: { id: consultaId },
      select: {
        id: true,
        firmado: true,
        fechaFirma: true,
        firmaCertificado: true
      }
    });

    if (!consulta) {
      return null;
    }

    if (!consulta.firmado) {
      return {
        firmada: false,
        mensaje: 'La consulta no ha sido firmada'
      };
    }

    return {
      firmada: true,
      fechaFirma: consulta.fechaFirma,
      certificado: consulta.firmaCertificado as unknown as CertificadoFirma | null
    };
  }

  /**
   * Obtiene el XML de firma de una consulta
   */
  async obtenerXmlFirma(consultaId: string, userId: string): Promise<string | null> {
    const consulta = await prisma.consulta.findUnique({
      where: { id: consultaId },
      select: { id: true, firmaXml: true, doctorId: true, cuentaId: true }
    });

    if (!consulta) {
      return null;
    }

    // Solo el doctor dueño puede descargar el XML
    if (consulta.doctorId !== userId && consulta.cuentaId !== userId) {
      logger.warn({ consultaId, userId }, 'Intento de descarga de XML por usuario no autorizado');
      return null;
    }

    return consulta.firmaXml;
  }
}

// Exportar instancia singleton
export const consultaSignatureService = new ConsultaSignatureService();
