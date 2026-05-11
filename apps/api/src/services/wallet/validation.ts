/**
 * WalletValidationService
 *
 * Servicio de validación temporal del Health Wallet para teleconsultas.
 * Implementa el TASK-039: Validación Health Wallet
 *
 * Características:
 * - Token JWT con expiración temporal
 * - Validación de permisos LOPDP
 * - Audit trail completo
 * - Revocación automática post-consulta
 *
 * @module services/wallet/validation
 */

import { PrismaClient, AuditAction, ResourceType } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { AuditService } from '../audit/audit.service';
import { logger } from '../../utils/logger.js';

// Interfaz para el payload del token temporal
interface TemporalTokenPayload {
  citaId: string;
  doctorId: string;
  pacienteId: string;
  tipo: 'temporal_wallet_access';
  iat: number;
  exp: number;
}

// Interfaz para la respuesta de validación
interface ValidationResult {
  valid: boolean;
  error?: string;
  citaId?: string;
  doctorId?: string;
  pacienteId?: string;
  expiresAt?: Date;
}

// Interfaz para el historial del paciente
interface PatientHistory {
  consultas: any[];
  documentos: any[];
  paciente: {
    id: string;
    nombre: string;
  };
}

/**
 * Servicio de validación temporal del Health Wallet
 */
class WalletValidationService {
  // Duración predeterminada del token (2 horas + margen)
  private readonly DEFAULT_TOKEN_DURATION = 2 * 60 * 60; // 2 horas en segundos

  // Secreto JWT desde variables de entorno
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

  constructor(private prisma: PrismaClient) {}

  /**
   * Genera un token JWT temporal para acceso al Health Wallet durante una teleconsulta
   *
   * @param input - Datos para generar el token
   * @returns Token JWT y fecha de expiración
   * @throws Error si la cita no existe o no es una teleconsulta
   */
  async generateTemporalToken(input: {
    citaId: string;
    doctorId: string;
    pacienteId: string;
  }): Promise<{ token: string; expiresAt: Date }> {
    const { citaId, doctorId, pacienteId } = input;

    // 1. Verificar que la cita existe y es una teleconsulta
    const cita = await this.prisma.cita.findUnique({
      where: { id: citaId },
      include: {
        doctor: true,
        paciente: true,
      },
    });

    if (!cita) {
      throw new Error('Cita no encontrada');
    }

    if (cita.tipo !== 'teleconsulta') {
      throw new Error('La cita debe ser una teleconsulta');
    }

    // 2. Verificar que el paciente tiene Health Wallet activo
    const healthWallet = await this.prisma.healthWallet.findUnique({
      where: { pacienteId },
    });

    if (!healthWallet || !healthWallet.activo) {
      throw new Error('Health Wallet no encontrado o inactivo');
    }

    // 3. Verificar o crear conexión temporal
    let conexion = await this.prisma.conexionPaciente.findFirst({
      where: {
        pacienteId,
        doctorId,
        permisos: {
          path: ['temporal'],
          equals: true,
        },
      },
    });

    const expiresAt = new Date(Date.now() + this.DEFAULT_TOKEN_DURATION * 1000);

    if (!conexion) {
      // Crear nueva conexión temporal
      conexion = await this.prisma.conexionPaciente.create({
        data: {
          pacienteId,
          doctorId,
          autorizadoPor: 'paciente',
          tipoAcceso: 'LIMITADO',
          permisos: {
            temporal: true,
            citaId,
            verHistorial: true,
            verDocumentos: true,
          },
          fechaExpiracion: expiresAt,
          estado: 'activa',
        },
      });

      logger.info({
        citaId,
        doctorId,
        pacienteId,
        conexionId: conexion.id,
      }, 'Conexión temporal creada para teleconsulta');
    } else {
      // Actualizar conexión existente
      conexion = await this.prisma.conexionPaciente.update({
        where: { id: conexion.id },
        data: {
          fechaExpiracion: expiresAt,
          estado: 'activa',
          revocadaEn: null,
        },
      });

      logger.info({
        citaId,
        doctorId,
        pacienteId,
        conexionId: conexion.id,
      }, 'Conexión temporal actualizada para teleconsulta');
    }

    // 4. Generar token JWT
    const payload: TemporalTokenPayload = {
      citaId,
      doctorId,
      pacienteId,
      tipo: 'temporal_wallet_access',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.DEFAULT_TOKEN_DURATION,
    };

    const token = jwt.sign(payload, this.JWT_SECRET, {
      algorithm: 'HS256',
    });

    // 5. Registrar audit log LOPDP
    await AuditService.log({
      userId: doctorId,
      action: 'TEMPORAL_ACCESS_GRANTED' as AuditAction,
      resourceType: 'HEALTH_WALLET' as ResourceType,
      resourceId: healthWallet.id,
      rolUsuario: 'DOCTOR',
      metadata: {
        citaId,
        pacienteId,
        conexionId: conexion.id,
        expiresAt: expiresAt.toISOString(),
        accessType: 'temporal_teleconsulta',
      }
    });

    return {
      token,
      expiresAt,
    };
  }

  /**
   * Valida un token de acceso temporal
   *
   * @param token - Token JWT a validar
   * @returns Resultado de la validación
   */
  async validateTemporalAccess(token: string): Promise<ValidationResult> {
    try {
      // 1. Verificar y decodificar el token JWT
      const payload = jwt.verify(token, this.JWT_SECRET) as TemporalTokenPayload;

      if (payload.tipo !== 'temporal_wallet_access') {
        return {
          valid: false,
          error: 'Tipo de token inválido',
        };
      }

      // 2. Verificar que la cita sigue válida
      const cita = await this.prisma.cita.findUnique({
        where: { id: payload.citaId },
      });

      if (!cita) {
        return {
          valid: false,
          error: 'Cita no encontrada',
        };
      }

      // Verificar que la consulta no ha finalizado
      if (cita.estado === 'completada' || cita.estado === 'cancelada') {
        return {
          valid: false,
          error: 'La consulta ya finalizó',
        };
      }

      // 3. Verificar que la conexión temporal sigue activa
      const conexion = await this.prisma.conexionPaciente.findFirst({
        where: {
          pacienteId: payload.pacienteId,
          doctorId: payload.doctorId,
          permisos: {
            path: ['temporal'],
            equals: true,
          },
        },
      });

      if (!conexion) {
        return {
          valid: false,
          error: 'Conexión temporal no encontrada',
        };
      }

      if (conexion.estado === 'revocada') {
        return {
          valid: false,
          error: 'Acceso revocado',
        };
      }

      // Verificar expiración de la conexión
      if (conexion.fechaExpiracion && new Date() > conexion.fechaExpiracion) {
        return {
          valid: false,
          error: 'Conexión expirada',
        };
      }

      // 4. Registrar acceso (LOPDP compliance)
      await AuditService.log({
        userId: payload.doctorId,
        action: 'TEMPORAL_ACCESS_VALIDATED' as AuditAction,
        resourceType: 'HEALTH_WALLET' as ResourceType,
        resourceId: payload.pacienteId,
        rolUsuario: 'DOCTOR',
        metadata: {
          citaId: payload.citaId,
          validatedAt: new Date().toISOString(),
        }
      });

      return {
        valid: true,
        citaId: payload.citaId,
        doctorId: payload.doctorId,
        pacienteId: payload.pacienteId,
        expiresAt: new Date(payload.exp * 1000),
      };
    } catch (error) {
      // Verificar errores JWT por nombre en lugar de instanceof para mejor compatibilidad con tests
      if (error instanceof Error && error.name === 'TokenExpiredError') {
        return {
          valid: false,
          error: 'Token expirado',
        };
      }
      if (error instanceof Error && (error.name === 'JsonWebTokenError' || error.message === 'Invalid token')) {
        return {
          valid: false,
          error: 'Token inválido',
        };
      }
      logger.error({ error }, 'Error validando token temporal');
      return {
        valid: false,
        error: 'Error al validar token',
      };
    }
  }

  /**
   * Revoca el acceso temporal después de que finaliza la consulta
   *
   * @param citaId - ID de la cita
   */
  async revokeAccessAfterConsultation(citaId: string): Promise<void> {
    // 1. Obtener la cita
    const cita = await this.prisma.cita.findUnique({
      where: { id: citaId },
    });

    if (!cita) {
      logger.warn({ citaId }, 'Cita no encontrada al revocar acceso');
      return;
    }

    // 2. Buscar la conexión temporal
    const conexion = await this.prisma.conexionPaciente.findFirst({
      where: {
        pacienteId: cita.pacienteId,
        doctorId: cita.doctorId,
        permisos: {
          path: ['temporal'],
          equals: true,
        },
        estado: 'activa',
      },
    });

    if (!conexion) {
      logger.info({ citaId }, 'No hay conexión temporal para revocar');
      return;
    }

    // 3. Revocar la conexión
    await this.prisma.conexionPaciente.update({
      where: { id: conexion.id },
      data: {
        estado: 'revocada',
        revocadaEn: new Date(),
      },
    });

    // 4. Registrar revocación (LOPDP compliance)
    await AuditService.log({
      userId: cita.doctorId,
      action: 'TEMPORAL_ACCESS_REVOKED' as AuditAction,
      resourceType: 'HEALTH_WALLET' as ResourceType,
      resourceId: cita.pacienteId,
      rolUsuario: 'DOCTOR',
      metadata: {
        citaId,
        conexionId: conexion.id,
        reason: 'consulta_finalizada',
        revokedAt: new Date().toISOString(),
      }
    });

    logger.info({
      citaId,
      conexionId: conexion.id,
      pacienteId: cita.pacienteId,
      doctorId: cita.doctorId,
    }, 'Acceso temporal revocado después de consulta');
  }

  /**
   * Obtiene el historial médico del paciente para la teleconsulta
   *
   * @param token - Token JWT de acceso temporal
   * @returns Historial médico del paciente
   * @throws Error si el token no es válido o no tiene permisos
   */
  async getPatientHistoryForConsultation(token: string): Promise<PatientHistory> {
    // 1. Validar el token
    const validation = await this.validateTemporalAccess(token);

    if (!validation.valid) {
      throw new Error(`Token inválido: ${validation.error}`);
    }

    const { citaId, doctorId, pacienteId } = validation;

    // 2. Obtener la conexión para verificar permisos
    const conexion = await this.prisma.conexionPaciente.findFirst({
      where: {
        pacienteId,
        doctorId,
        permisos: {
          path: ['temporal'],
          equals: true,
        },
      },
    });

    if (!conexion) {
      throw new Error('Conexión no encontrada');
    }

    // Verificar permisos específicos
    const permisos = conexion.permisos as any;
    if (!permisos.verHistorial) {
      throw new Error('Sin permisos para ver el historial');
    }

    // 3. Construir query según tipo de acceso
    const consultaWhere: any = {
      pacienteId,
    };

    // Si el acceso es LIMITADO y tiene consultaIds específicas
    if (
      conexion.tipoAcceso === 'LIMITADO' &&
      permisos.consultaIds &&
      Array.isArray(permisos.consultaIds)
    ) {
      consultaWhere.id = { in: permisos.consultaIds };
    }

    // 4. Obtener consultas del paciente
    const consultas = await this.prisma.consulta.findMany({
      where: consultaWhere,
      include: {
        doctor: {
          select: {
            id: true,
            nombre: true,
            especialidad: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50, // Limitar a las últimas 50 consultas
    });

    // 5. Obtener documentos del paciente
    const documentos = await this.prisma.documento.findMany({
      where: {
        pacienteId,
        estado: 'activo',
      },
      include: {
        consulta: {
          select: {
            id: true,
            createdAt: true,
            motivoConsulta: true,
          },
        },
      },
      orderBy: {
        fechaEmision: 'desc',
      },
      take: 50,
    });

    // 6. Obtener datos básicos del paciente
    const paciente = await this.prisma.paciente.findUnique({
      where: { id: pacienteId },
      select: {
        id: true,
        nombre: true,
      },
    });

    if (!paciente) {
      throw new Error('Paciente no encontrado');
    }

    // 7. Registrar acceso al historial (LOPDP compliance)
    await AuditService.log({
      userId: doctorId,
      action: 'PATIENT_HISTORY_ACCESSED' as AuditAction,
      resourceType: 'HEALTH_WALLET' as ResourceType,
      resourceId: pacienteId,
      rolUsuario: 'DOCTOR',
      metadata: {
        citaId,
        consultaCount: consultas.length,
        documentoCount: documentos.length,
        accessType: 'temporal_teleconsulta',
        accessedAt: new Date().toISOString(),
      }
    });

    logger.info({
      citaId,
      doctorId,
      pacienteId,
      consultaCount: consultas.length,
      documentoCount: documentos.length,
    }, 'Historial accedido temporalmente para teleconsulta');

    return {
      consultas,
      documentos,
      paciente,
    };
  }

  /**
   * Verifica si una conexión temporal está activa para una cita
   *
   * @param citaId - ID de la cita
   * @returns true si hay una conexión temporal activa
   */
  async hasActiveTemporalConnection(citaId: string): Promise<boolean> {
    const cita = await this.prisma.cita.findUnique({
      where: { id: citaId },
    });

    if (!cita) {
      return false;
    }

    const conexion = await this.prisma.conexionPaciente.findFirst({
      where: {
        pacienteId: cita.pacienteId,
        doctorId: cita.doctorId,
        permisos: {
          path: ['temporal'],
          equals: true,
        },
        estado: 'activa',
      },
    });

    return !!conexion;
  }
}

export default WalletValidationService;
