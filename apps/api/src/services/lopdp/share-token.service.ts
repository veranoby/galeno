/**
 * ShareTokenService
 *
 * Servicio para generar y validar tokens de compartición de datos de salud
 * cumpliendo con LOPDP (Lei Orgánica de Protección de Datos Personales de Ecuador)
 *
 * Características:
 * - ShareToken JWT firmado con TTL de 15 minutos
 * - Scope: 'HISTORY_READ' para acceso de solo lectura
 * - Generación de SharedSessionID para acceso temporal
 * - Auditoría completa de cada acceso
 * - Revocación inmediata disponible
 *
 * @module services/lopdp/share-token
 */

import { PrismaClient, AuditAction, ResourceType } from '@prisma/client';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { AuditService } from '../audit/audit.service.js';
import { logger } from '../../utils/logger.js';

// ============= TYPES =============

/**
 * Payload del ShareToken JWT
 */
interface ShareTokenPayload {
  sub: string; // pacienteId (owner de los datos)
  pacienteId: string;
  pacienteNombre: string;
  doctorSolicitanteId: string;
  doctorSolicitanteNombre: string;
  scope: 'HISTORY_READ';
  permisos: SharePermissions;
  sharedSessionId: string;
  tipo: 'share_token';
  iat: number;
  exp: number;
}

/**
 * Permisos granulares para compartición de datos
 */
export interface SharePermissions {
  verConsultas: boolean;
  verDocumentos: boolean;
  verAntecedentes: boolean;
  verRecetas: boolean;
  verExamenes: boolean;
  descargarDocumentos: boolean;
  consultaIds?: string[]; // Si es limitado, IDs específicos de consultas
  documentoIds?: string[]; // Si es limitado, IDs específicos de documentos
}

/**
 * Input para generar ShareToken
 */
export interface GenerateShareTokenInput {
  pacienteId: string;
  doctorSolicitanteId: string;
  permisos: SharePermissions;
  motivoComparticion: string;
  ttlSeconds?: number; // Default: 900 (15 minutos)
}

/**
 * Respuesta de generación de ShareToken
 */
export interface ShareTokenResponse {
  success: boolean;
  token?: string;
  sharedSessionId?: string;
  expiresAt?: Date;
  qrData?: string;
  message?: string;
}

/**
 * Input para intercambiar token por sesión
 */
export interface ExchangeTokenInput {
  shareToken: string;
  doctorId: string; // Doctor que recibe el token
}

/**
 * Respuesta de intercambio de token
 */
export interface ExchangeTokenResponse {
  success: boolean;
  sharedSessionId?: string;
  expiresAt?: Date;
  permisos?: SharePermissions;
  pacienteInfo?: {
    id: string;
    nombre: string;
  };
  error?: string;
}

/**
 * Resultado de validación de token
 */
export interface ValidateTokenResult {
  valid: boolean;
  error?: string;
  payload?: ShareTokenPayload;
}

/**
 * Información de sesión compartida
 */
export interface SharedSessionInfo {
  sharedSessionId: string;
  pacienteId: string;
  doctorId: string;
  permisos: SharePermissions;
  expiresAt: Date;
  activo: boolean;
}

/**
 * Servicio para gestión de ShareTokens LOPDP
 */
class ShareTokenService {
  // TTL predeterminado: 15 minutos (900 segundos)
  private readonly DEFAULT_TTL = 900;

  // Secreto JWT desde variables de entorno
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

  // Prefijo para SharedSessionID
  private readonly SESSION_PREFIX = 'SHARED-';

  constructor(private prisma: PrismaClient) {}

  /**
   * Genera un SharedSessionID único
   */
  private generateSharedSessionId(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(8).toString('hex').toUpperCase();
    return `${this.SESSION_PREFIX}${timestamp}-${random}`;
  }

  /**
   * Genera un QR data URL para compartir el token
   */
  private async generateQRData(token: string, sharedSessionId: string): Promise<string> {
    // En producción, esto debería ser una URL completa al frontend
    const baseUrl = process.env.FRONTEND_URL || 'https://galeno.ec';
    const shareUrl = `${baseUrl}/wallet/share?token=${token}&session=${sharedSessionId}`;

    // Importar QRCode dinámicamente para evitar errores en tests
    try {
      const QRCode = (await import('qrcode')).default;
      return await QRCode.toDataURL(shareUrl, {
        width: 300,
        margin: 2,
        errorCorrectionLevel: 'M'
      });
    } catch (error) {
      logger.warn({ error }, 'Error generando QR, retornando URL plana');
      return shareUrl;
    }
  }

  /**
   * Obtiene información del paciente
   */
  private async getPatientInfo(pacienteId: string): Promise<{ id: string; nombre: string } | null> {
    const paciente = await this.prisma.paciente.findUnique({
      where: { id: pacienteId },
      include: {
        cuenta: {
          select: { nombre: true }
        }
      }
    });

    if (!paciente) {
      return null;
    }

    return {
      id: paciente.id,
      nombre: paciente.cuenta.nombre
    };
  }

  /**
   * Obtiene información del doctor
   */
  private async getDoctorInfo(doctorId: string): Promise<{ id: string; nombre: string; especialidad?: string } | null> {
    const doctor = await this.prisma.cuenta.findUnique({
      where: { id: doctorId },
      select: {
        id: true,
        nombre: true,
        especialidad: true,
        rol: true
      }
    });

    if (!doctor || doctor.rol !== 'DOCTOR') {
      return null;
    }

    return {
      id: doctor.id,
      nombre: doctor.nombre,
      especialidad: doctor.especialidad || undefined
    };
  }

  /**
   * Genera un ShareToken JWT para compartir datos de salud
   *
   * @param input - Datos para generar el token
   * @returns ShareToken JWT y metadata
   * @throws Error si el paciente o doctor no existen
   */
  async generateShareToken(input: GenerateShareTokenInput): Promise<ShareTokenResponse> {
    const {
      pacienteId,
      doctorSolicitanteId,
      permisos,
      motivoComparticion,
      ttlSeconds = this.DEFAULT_TTL
    } = input;

    try {
      // 1. Verificar que el paciente existe
      const patientInfo = await this.getPatientInfo(pacienteId);
      if (!patientInfo) {
        return {
          success: false,
          message: 'Paciente no encontrado'
        };
      }

      // 2. Verificar que el doctor solicitante existe
      const doctorSolicitante = await this.getDoctorInfo(doctorSolicitanteId);
      if (!doctorSolicitante) {
        return {
          success: false,
          message: 'Doctor solicitante no encontrado o no es válido'
        };
      }

      // 3. Verificar que existe Health Wallet activo
      const healthWallet = await this.prisma.healthWallet.findUnique({
        where: { pacienteId }
      });

      if (!healthWallet || !healthWallet.activo) {
        return {
          success: false,
          message: 'Health Wallet no encontrado o inactivo'
        };
      }

      // 4. Generar SharedSessionID
      const sharedSessionId = this.generateSharedSessionId();

      // 5. Calcular expiración
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

      // 6. Crear payload del JWT
      const payload: ShareTokenPayload = {
        sub: pacienteId,
        pacienteId,
        pacienteNombre: patientInfo.nombre,
        doctorSolicitanteId,
        doctorSolicitanteNombre: doctorSolicitante.nombre,
        scope: 'HISTORY_READ',
        permisos,
        sharedSessionId,
        tipo: 'share_token',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(expiresAt.getTime() / 1000)
      };

      // 7. Firmar token JWT
      const token = jwt.sign(payload, this.JWT_SECRET, {
        algorithm: 'HS256'
      });

      // 8. Generar QR para compartir
      const qrData = await this.generateQRData(token, sharedSessionId);

      // 9. Registrar sesión compartida en la base de datos
      await this.prisma.conexionPaciente.create({
        data: {
          pacienteId,
          doctorId: doctorSolicitanteId,
          autorizadoPor: 'paciente',
          tipoAcceso: 'LIMITADO',
          permisos: {
            ...permisos,
            sharedSessionId,
            motivoComparticion,
            tipo: 'SHARE_TOKEN'
          },
          estado: 'activa',
          fechaExpiracion: expiresAt
        }
      });

      // 10. Registrar auditoría LOPDP (Art. 14 - Consentimiento)
      await AuditService.log({
        userId: doctorSolicitanteId,
        action: AuditAction.RESOURCE_ACCESS,
        resourceType: ResourceType.PACIENTE,
        resourceId: pacienteId,
        rolUsuario: 'DOCTOR',
        metadata: {
          accion: 'GENERAR_SHARE_TOKEN',
          sharedSessionId,
          motivoComparticion,
          ttlSeconds,
          expiresAt: expiresAt.toISOString(),
          permisos,
          lopdpArticulo: 'Art. 14 - Consentimiento explícito'
        }
      });

      logger.info({
        pacienteId,
        doctorSolicitanteId,
        sharedSessionId,
        expiresAt
      }, 'ShareToken generado exitosamente');

      return {
        success: true,
        token,
        sharedSessionId,
        expiresAt,
        qrData,
        message: 'Token de compartición generado exitosamente'
      };
    } catch (error) {
      logger.error({ error }, 'Error generando ShareToken');
      return {
        success: false,
        message: 'Error al generar token de compartición'
      };
    }
  }

  /**
   * Valida un ShareToken JWT
   */
  async validateShareToken(token: string): Promise<ValidateTokenResult> {
    try {
      // 1. Verificar y decodificar el token JWT
      const payload = jwt.verify(token, this.JWT_SECRET) as ShareTokenPayload;

      // 2. Verificar tipo de token
      if (payload.tipo !== 'share_token') {
        return {
          valid: false,
          error: 'Tipo de token inválido'
        };
      }

      // 3. Verificar scope
      if (payload.scope !== 'HISTORY_READ') {
        return {
          valid: false,
          error: 'Scope de token inválido'
        };
      }

      // 4. Verificar que el paciente existe
      const patientInfo = await this.getPatientInfo(payload.pacienteId);
      if (!patientInfo) {
        return {
          valid: false,
          error: 'Paciente no encontrado'
        };
      }

      // 5. Verificar que la sesión compartida existe y está activa
      const conexion = await this.prisma.conexionPaciente.findFirst({
        where: {
          pacienteId: payload.pacienteId,
          doctorId: payload.doctorSolicitanteId,
          permisos: {
            path: ['sharedSessionId'],
            equals: payload.sharedSessionId
          }
        }
      });

      if (!conexion) {
        return {
          valid: false,
          error: 'Sesión compartida no encontrada'
        };
      }

      // 6. Verificar estado de la conexión
      if (conexion.estado === 'revocada') {
        return {
          valid: false,
          error: 'Acceso revocado por el paciente'
        };
      }

      // 7. Verificar expiración
      if (conexion.fechaExpiracion && new Date() > conexion.fechaExpiracion) {
        return {
          valid: false,
          error: 'Token expirado'
        };
      }

      return {
        valid: true,
        payload
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'TokenExpiredError') {
        return {
          valid: false,
          error: 'Token expirado'
        };
      }
      if (error instanceof Error && (error.name === 'JsonWebTokenError' || error.message.includes('invalid'))) {
        return {
          valid: false,
          error: 'Token inválido'
        };
      }
      logger.error({ error }, 'Error validando ShareToken');
      return {
        valid: false,
        error: 'Error al validar token'
      };
    }
  }

  /**
   * Intercambia un ShareToken por un SharedSessionID
   * El doctor receptor usa este endpoint para obtener acceso
   *
   * @param input - Token y doctor que recibe
   * @returns Sesión compartida activada
   */
  async exchangeToken(input: ExchangeTokenInput): Promise<ExchangeTokenResponse> {
    const { shareToken, doctorId } = input;

    try {
      // 1. Validar el token
      const validation = await this.validateShareToken(shareToken);

      if (!validation.valid) {
        return {
          success: false,
          error: validation.error
        };
      }

      const payload = validation.payload!;

      // 2. Verificar que el doctor que intercambia es el destinatario
      if (payload.doctorSolicitanteId !== doctorId) {
        // Nota: En este diseño, el doctor solicitante es quien recibe el token
        // Si hay un doctor destinatario diferente, se debería validar aquí
        return {
          success: false,
          error: 'Doctor no autorizado para este token'
        };
      }

      // 3. Obtener información del paciente
      const patientInfo = await this.getPatientInfo(payload.pacienteId);
      if (!patientInfo) {
        return {
          success: false,
          error: 'Paciente no encontrado'
        };
      }

      // 4. Verificar que la sesión existe
      const conexion = await this.prisma.conexionPaciente.findFirst({
        where: {
          pacienteId: payload.pacienteId,
          doctorId,
          permisos: {
            path: ['sharedSessionId'],
            equals: payload.sharedSessionId
          }
        }
      });

      if (!conexion) {
        return {
          success: false,
          error: 'Sesión compartida no encontrada'
        };
      }

      // 5. Registrar auditoría - Doctor recibe token (LOPDP Art. 15)
      await AuditService.log({
        userId: doctorId,
        action: AuditAction.RESOURCE_ACCESS,
        resourceType: ResourceType.PACIENTE,
        resourceId: payload.pacienteId,
        rolUsuario: 'DOCTOR',
        metadata: {
          accion: 'INTERCAMBIAR_SHARE_TOKEN',
          sharedSessionId: payload.sharedSessionId,
          tipoAcceso: 'SHARE_TOKEN',
          lopdpArticulo: 'Art. 15 - Acceso granular'
        }
      });

      logger.info({
        doctorId,
        pacienteId: payload.pacienteId,
        sharedSessionId: payload.sharedSessionId
      }, 'ShareToken intercambiado exitosamente');

      return {
        success: true,
        sharedSessionId: payload.sharedSessionId,
        expiresAt: new Date(payload.exp * 1000),
        permisos: payload.permisos,
        pacienteInfo: {
          id: payload.pacienteId,
          nombre: payload.pacienteNombre
        }
      };
    } catch (error) {
      logger.error({ error }, 'Error intercambiando ShareToken');
      return {
        success: false,
        error: 'Error al intercambiar token'
      };
    }
  }

  /**
   * Obtiene información de una sesión compartida
   */
  async getSharedSessionInfo(sharedSessionId: string, doctorId: string): Promise<SharedSessionInfo | null> {
    const conexion = await this.prisma.conexionPaciente.findFirst({
      where: {
        doctorId,
        permisos: {
          path: ['sharedSessionId'],
          equals: sharedSessionId
        }
      }
    });

    if (!conexion) {
      return null;
    }

    const permisos = conexion.permisos as any as SharePermissions;

    return {
      sharedSessionId,
      pacienteId: conexion.pacienteId,
      doctorId,
      permisos,
      expiresAt: conexion.fechaExpiracion || new Date(Date.now() + this.DEFAULT_TTL * 1000),
      activo: conexion.estado === 'activa' && (!conexion.fechaExpiracion || new Date() < conexion.fechaExpiracion)
    };
  }

  /**
   * Revoca inmediatamente un SharedSessionID
   * Implementa el derecho de revocación LOPDP (Art. 16)
   *
   * @param sharedSessionId - ID de sesión a revocar
   * @param pacienteId - ID del paciente que revoca
   * @returns Éxito de la operación
   */
  async revokeSharedSession(sharedSessionId: string, pacienteId: string): Promise<{ success: boolean; message?: string }> {
    try {
      // 1. Buscar la sesión compartida
      const conexion = await this.prisma.conexionPaciente.findFirst({
        where: {
          pacienteId,
          permisos: {
            path: ['sharedSessionId'],
            equals: sharedSessionId
          }
        }
      });

      if (!conexion) {
        return {
          success: false,
          message: 'Sesión compartida no encontrada'
        };
      }

      // 2. Revocar la sesión
      await this.prisma.conexionPaciente.update({
        where: { id: conexion.id },
        data: {
          estado: 'revocada',
          revocadaEn: new Date()
        }
      });

      // 3. Registrar auditoría - Revocación (LOPDP Art. 16)
      await AuditService.log({
        userId: pacienteId,
        action: AuditAction.RESOURCE_ACCESS,
        resourceType: ResourceType.PACIENTE,
        resourceId: pacienteId,
        rolUsuario: 'PACIENTE',
        metadata: {
          accion: 'REVOCAR_SHARE_TOKEN',
          sharedSessionId,
          doctorId: conexion.doctorId,
          lopdpArticulo: 'Art. 16 - Derecho de revocación inmediata'
        }
      });

      logger.info({
        pacienteId,
        sharedSessionId,
        doctorId: conexion.doctorId
      }, 'Sesión compartida revocada exitosamente');

      return {
        success: true,
        message: 'Acceso revocado exitosamente'
      };
    } catch (error) {
      logger.error({ error }, 'Error revocando sesión compartida');
      return {
        success: false,
        message: 'Error al revocar acceso'
      };
    }
  }

  /**
   * Obtiene el historial médico del paciente filtrado por permisos
   * Cada lectura genera log en AuditService con action: 'SHARED_READ'
   *
   * @param sharedSessionId - ID de sesión compartida
   * @param doctorId - Doctor que accede
   * @returns Historial médico filtrado
   */
  async getFilteredHistory(sharedSessionId: string, doctorId: string): Promise<{
    success: boolean;
    data?: {
      consultas?: any[];
      documentos?: any[];
      antecedentes?: any[];
      paciente?: { id: string; nombre: string };
    };
    error?: string;
  }> {
    try {
      // 1. Obtener información de la sesión
      const sessionInfo = await this.getSharedSessionInfo(sharedSessionId, doctorId);

      if (!sessionInfo || !sessionInfo.activo) {
        return {
          success: false,
          error: 'Sesión compartida inválida o expirada'
        };
      }

      const { pacienteId, permisos } = sessionInfo;

      // 2. Obtener información del paciente
      const patientInfo = await this.getPatientInfo(pacienteId);
      if (!patientInfo) {
        return {
          success: false,
          error: 'Paciente no encontrado'
        };
      }

      const result: {
        consultas?: any[];
        documentos?: any[];
        antecedentes?: any[];
        paciente: { id: string; nombre: string };
      } = {
        paciente: patientInfo
      };

      // 3. Obtener consultas si tiene permiso
      if (permisos.verConsultas) {
        const consultaWhere: any = { pacienteId };

        // Si hay consultaIds específicos, filtrar por ellos
        if (permisos.consultaIds && permisos.consultaIds.length > 0) {
          consultaWhere.id = { in: permisos.consultaIds };
        }

        result.consultas = await this.prisma.consulta.findMany({
          where: consultaWhere,
          include: {
            doctor: {
              select: {
                id: true,
                nombre: true,
                especialidad: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 50
        });
      }

      // 4. Obtener documentos si tiene permiso
      if (permisos.verDocumentos) {
        const documentoWhere: any = {
          pacienteId,
          estado: 'activo'
        };

        // Si hay documentoIds específicos, filtrar por ellos
        if (permisos.documentoIds && permisos.documentoIds.length > 0) {
          documentoWhere.id = { in: permisos.documentoIds };
        }

        result.documentos = await this.prisma.documento.findMany({
          where: documentoWhere,
          include: {
            consulta: {
              select: {
                id: true,
                motivoConsulta: true,
                createdAt: true
              }
            }
          },
          orderBy: { fechaEmision: 'desc' },
          take: 50
        });
      }

      // 5. Obtener antecedentes si tiene permiso
      if (permisos.verAntecedentes) {
        result.antecedentes = await this.prisma.antecedentePaciente.findMany({
          where: { pacienteId },
          orderBy: { fechaRegistro: 'desc' },
          take: 50
        });
      }

      // 6. Registrar auditoría - SHARED_READ (LOPDP compliance)
      await AuditService.log({
        userId: doctorId,
        action: 'SHARED_READ' as AuditAction,
        resourceType: ResourceType.PACIENTE,
        resourceId: pacienteId,
        rolUsuario: 'DOCTOR',
        metadata: {
          accion: 'LECTURA_HISTORIAL_COMPARTIDO',
          sharedSessionId,
          consultaCount: result.consultas?.length || 0,
          documentoCount: result.documentos?.length || 0,
          antecedenteCount: result.antecedentes?.length || 0,
          lopdpArticulo: 'Art. 15 - Auditoría de acceso'
        }
      });

      logger.info({
        doctorId,
        pacienteId,
        sharedSessionId,
        consultaCount: result.consultas?.length || 0,
        documentoCount: result.documentos?.length || 0
      }, 'Historial compartido accedido exitosamente');

      return {
        success: true,
        data: result
      };
    } catch (error) {
      logger.error({ error }, 'Error obteniendo historial compartido');
      return {
        success: false,
        error: 'Error al obtener historial compartido'
      };
    }
  }

  /**
   * Limpia sesiones compartidas expiradas (job periódico)
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const result = await this.prisma.conexionPaciente.updateMany({
        where: {
          estado: 'activa',
          fechaExpiracion: {
            lt: new Date()
          },
          permisos: {
            path: ['tipo'],
            equals: 'SHARE_TOKEN'
          }
        },
        data: {
          estado: 'revocada',
          revocadaEn: new Date()
        }
      });

      logger.info({ count: result.count }, 'Sesiones compartidas expiradas limpiadas');

      return result.count;
    } catch (error) {
      logger.error({ error }, 'Error limpiando sesiones expiradas');
      return 0;
    }
  }
}

export default ShareTokenService;
