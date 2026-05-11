/**
 * Servicio de videoconferencia Jitsi Meet
 *
 * Proporciona funcionalidades para:
 * - Generar nombres de sala seguros
 * - Crear tokens JWT para autenticación
 * - Crear y gestionar reuniones
 * - Validar acceso a reuniones
 */

import { createHmac } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { Cita } from '@prisma/client';
import prisma from '../../config/database.js';
import {
  JitsiMeetingConfig,
  JitsiMeetingResponse,
  JitsiJWTPayload,
  MeetingAccessValidation
} from './jitsi.types.js';
import { jitsiConfig, validateJitsiConfig, isJWTEabled, getJitsiBaseUrl } from '../../config/jitsi.config.js';

/**
 * Servicio de videoconferencia Jitsi
 */
export class JitsiService {
  constructor() {
    // Validar configuración al instanciar
    try {
      validateJitsiConfig();
    } catch (error) {
      console.error('Error en configuración de Jitsi:', error);
      throw error;
    }
  }

  /**
   * Generar un nombre de sala seguro usando HMAC-SHA256
   *
   * El formato es: galeno-{citaId}-{hash}
   * donde hash = HMAC-SHA256(citaId, salt)
   *
   * @param citaId - ID de la cita
   * @returns Nombre de sala encriptado
   */
  generateSecureRoomName(citaId: string): string {
    // Generar HMAC usando el salt
    const hmac = createHmac('sha256', jitsiConfig.salt);
    hmac.update(citaId);
    const hash = hmac.digest('hex').substring(0, 16); // Primeros 16 caracteres del hash

    return `galeno-${citaId}-${hash}`;
  }

  /**
   * Generar un token JWT para autenticación en Jitsi
   *
   * @param config - Configuración de la reunión
   * @param userContext - Contexto del usuario
   * @returns Token JWT firmado
   */
  private generateJitsiJWT(
    config: JitsiMeetingConfig,
    userContext: { name: string; email?: string; role: 'moderator' | 'participant' }
  ): string | undefined {
    // Si no hay configuración de JWT, retornar undefined
    if (!isJWTEabled()) {
      return undefined;
    }

    const roomName = this.generateSecureRoomName(config.citaId);
    const durationMinutes = config.duration || 30;

    const payload: JitsiJWTPayload = {
      context: {
        user: {
          name: userContext.name,
          email: userContext.email,
        },
        room: roomName,
        role: userContext.role,
      },
      app: 'galeno',
      type: 'jwt',
    };

    // Firmar con el secret de Jitsi
    return jwt.sign(payload, jitsiConfig.appSecret, {
      algorithm: 'HS256',
      expiresIn: `${durationMinutes + 30}m`,
      issuer: jitsiConfig.appId,
      audience: jitsiConfig.appId,
      subject: roomName,
    });
  }

  /**
   * Crear una nueva reunión de videoconferencia
   *
   * @param config - Configuración de la reunión
   * @returns Datos de la reunión creada
   */
  async createMeeting(config: JitsiMeetingConfig): Promise<JitsiMeetingResponse> {
    const { citaId, doctorInfo } = config;

    // Generar nombre de sala seguro
    const roomName = this.generateSecureRoomName(citaId);

    // Generar JWT para el doctor (moderador)
    const jwtToken = this.generateJitsiJWT(config, {
      name: doctorInfo?.nombre || 'Doctor',
      email: doctorInfo?.email,
      role: 'moderator',
    });

    // Calcular expiración
    const durationMinutes = config.duration || 30;
    const expiresAt = new Date(config.startTime.getTime() + (durationMinutes + 30) * 60 * 1000);

    // Construir URL de unión
    const joinUrl = `${getJitsiBaseUrl()}/${roomName}`;

    const response: JitsiMeetingResponse = {
      meetingId: citaId, // Usamos el citaId como meetingId
      roomName,
      jwtToken,
      joinUrl,
      expiresAt,
      domain: jitsiConfig.domain,
    };

    return response;
  }

  /**
   * Validar que un usuario tiene acceso a una reunión
   *
   * @param citaId - ID de la cita
   * @param userId - ID del usuario que intenta acceder
   * @param userRole - Rol del usuario (DOCTOR, ADMIN, etc.)
   * @returns Resultado de validación
   */
  async validateMeetingAccess(
    citaId: string,
    userId: string,
    userRole: string
  ): Promise<MeetingAccessValidation> {
    // Buscar la cita
    const cita = await prisma.cita.findUnique({
      where: { id: citaId },
      select: {
        id: true,
        doctorId: true,
        pacienteId: true,
        tipo: true,
        fechaHora: true,
        linkVideo: true,
        tokenAcceso: true,
      },
    });

    if (!cita) {
      return {
        valid: false,
        reason: 'Cita no encontrada',
      };
    }

    // Verificar que sea una teleconsulta
    if (cita.tipo !== 'teleconsulta') {
      return {
        valid: false,
        reason: 'La cita no es una teleconsulta',
      };
    }

    // Verificar que la reunión esté configurada
    if (!cita.linkVideo) {
      return {
        valid: false,
        reason: 'La reunión no ha sido configurada',
      };
    }

    // Verificar expiración (30 minutos después de la cita)
    const citaTime = cita.fechaHora.getTime();
    const expiresAt = citaTime + 60 * 60 * 1000; // 1 hora después
    const now = Date.now();

    if (now > expiresAt) {
      return {
        valid: false,
        reason: 'La reunión ha expirado',
      };
    }

    // Verificar que el usuario sea el doctor o el paciente
    const isDoctor = cita.doctorId === userId;
    const isPaciente = cita.pacienteId === userId;
    const isAdmin = userRole === 'ADMIN';

    if (!isDoctor && !isPaciente && !isAdmin) {
      return {
        valid: false,
        reason: 'No tienes acceso a esta reunión',
      };
    }

    return {
      valid: true,
      role: isDoctor || isAdmin ? 'moderator' : 'participant',
    };
  }

  /**
   * Finalizar una reunión
   *
   * @param citaId - ID de la cita
   * @returns void
   */
  async endMeeting(citaId: string): Promise<void> {
    // Actualizar estado de la cita si está en progreso
    await prisma.cita.update({
      where: { id: citaId },
      data: {
        estado: 'completada',
      },
    });
  }

  /**
   * Obtener información de reunión para unirse
   *
   * @param citaId - ID de la cita
   * @param userId - ID del usuario
   * @param userRole - Rol del usuario
   * @param userName - Nombre del usuario
   * @param userEmail - Email del usuario (opcional)
   * @returns Datos de la reunión
   */
  async getMeetingInfo(
    citaId: string,
    userId: string,
    userRole: string,
    userName: string,
    userEmail?: string
  ): Promise<{
    roomName: string;
    jwtToken?: string;
    joinUrl: string;
    expiresAt: Date;
    role: 'moderator' | 'participant';
  } | null> {
    // Validar acceso
    const validation = await this.validateMeetingAccess(citaId, userId, userRole);

    if (!validation.valid) {
      return null;
    }

    // Obtener cita para generar datos
    const cita = await prisma.cita.findUnique({
      where: { id: citaId },
    });

    if (!cita) {
      return null;
    }

    // Generar nombre de sala
    const roomName = this.generateSecureRoomName(citaId);

    // Generar JWT si está habilitado
    const jwtToken = isJWTEabled()
      ? this.generateJitsiJWT(
          {
            citaId,
            doctorId: cita.doctorId,
            pacienteId: cita.pacienteId,
            startTime: cita.fechaHora,
          },
          {
            name: userName,
            email: userEmail,
            role: validation.role || 'participant',
          }
        )
      : undefined;

    // Calcular expiración
    const expiresAt = new Date(cita.fechaHora.getTime() + 60 * 60 * 1000); // 1 hora

    return {
      roomName,
      jwtToken,
      joinUrl: `${getJitsiBaseUrl()}/${roomName}`,
      expiresAt,
      role: validation.role || 'participant',
    };
  }

  /**
   * Configurar una cita para teleconsulta
   *
   * @param citaId - ID de la cita
   * @param meetingData - Datos de la reunión
   * @returns Cita actualizada
   */
  async configurarCitaTeleconsulta(
    citaId: string,
    meetingData: JitsiMeetingResponse
  ): Promise<Cita> {
    return prisma.cita.update({
      where: { id: citaId },
      data: {
        linkVideo: meetingData.joinUrl,
        tokenAcceso: meetingData.jwtToken,
      },
    });
  }
}

// Exportar instancia singleton
export const jitsiService = new JitsiService();
