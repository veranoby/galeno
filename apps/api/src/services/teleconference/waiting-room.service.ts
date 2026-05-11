/**
 * Servicio de Sala de Espera Virtual para Teleconsultas
 *
 * Gestiona el flujo de espera de pacientes antes de ingresar a la videollamada.
 * - Control de estados (waiting, admitted, in-session, ended, timeout)
 * - Notificaciones SSE en tiempo real
 * - Auto-expiración por timeout (15 min)
 * - Cleanup periódico de salas expiradas
 */

import {
  WaitingRoom,
  WaitingRoomState,
  CreateWaitingRoomData,
  WaitingRoomStatus,
  WaitingRoomSSEEvent,
  WaitingRoomAccessValidation,
  WaitingRoomConfig,
  VALID_STATE_TRANSITIONS,
} from './waiting-room.types.js';
import { sseManager } from '../sse/sse-manager.js';
import { logger } from '../../utils/logger.js';
import prisma from '../../config/database.js';
import { obtenerCitaPorId } from '../agenda/cita-service.js';

/**
 * Configuración por defecto
 */
const DEFAULT_CONFIG: WaitingRoomConfig = {
  timeoutMinutes: 15,
  cleanupIntervalMinutes: 5,
  enableSSE: true,
};

/**
 * Store en memoria para salas de espera activas
 * Key: citaId, Value: WaitingRoom
 */
const waitingRooms = new Map<string, WaitingRoom>();

/**
 * Intervalo de cleanup
 */
let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Servicio de Sala de Espera
 */
export class WaitingRoomService {
  private config: WaitingRoomConfig;
  private initialized = false;

  constructor(config: Partial<WaitingRoomConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Inicializar el servicio con cleanup periódico
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('WaitingRoomService ya está inicializado');
      return;
    }

    // Iniciar cleanup periódico
    this.startCleanupInterval();
    this.initialized = true;

    logger.info(
      {
        timeoutMinutes: this.config.timeoutMinutes,
        cleanupIntervalMinutes: this.config.cleanupIntervalMinutes,
      },
      'WaitingRoomService inicializado'
    );
  }

  /**
   * Detener el servicio
   */
  async shutdown(): Promise<void> {
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
      cleanupInterval = null;
    }
    this.initialized = false;
    logger.info('WaitingRoomService detenido');
  }

  /**
   * Iniciar intervalo de cleanup
   */
  private startCleanupInterval(): void {
    const intervalMs = this.config.cleanupIntervalMinutes * 60 * 1000;

    cleanupInterval = setInterval(async () => {
      try {
        const expiredCount = await this.checkTimeout();
        if (expiredCount > 0) {
          logger.info({ expiredCount }, `Cleanup: ${expiredCount} salas expiradas`);
        }
      } catch (error) {
        logger.error({ error }, 'Error en cleanup de salas de espera');
      }
    }, intervalMs);

    logger.info(
      { intervalMs },
      'Cleanup interval iniciado para WaitingRoomService'
    );
  }

  /**
   * Crear una nueva sala de espera
   */
  async createWaitingRoom(data: CreateWaitingRoomData): Promise<WaitingRoom> {
    const { citaId, pacienteId, doctorId } = data;

    // Verificar si ya existe una sala para esta cita
    const existingRoom = waitingRooms.get(citaId);
    if (existingRoom) {
      if (existingRoom.estado === WaitingRoomState.IN_SESSION) {
        throw new Error('La consulta ya está en sesión activa');
      }
      if (existingRoom.estado === WaitingRoomState.ADMITTED) {
        throw new Error('El paciente ya fue admitido');
      }
      // Si está waiting o timeout, permitir reutilizar
    }

    // Verificar que la cita existe y es teleconsulta
    const cita = await obtenerCitaPorId(citaId);
    if (!cita) {
      throw new Error('Cita no encontrada');
    }

    if (cita.tipo !== 'teleconsulta') {
      throw new Error('La cita no es una teleconsulta');
    }

    // Verificar que el paciente pertenece a la cita
    if (cita.pacienteId !== pacienteId) {
      throw new Error('El paciente no corresponde a esta cita');
    }

    // Verificar que el doctor pertenece a la cita
    if (cita.doctorId !== doctorId) {
      throw new Error('El doctor no corresponde a esta cita');
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.timeoutMinutes * 60 * 1000);

    const waitingRoom: WaitingRoom = {
      id: citaId,
      citaId,
      pacienteId,
      doctorId,
      estado: WaitingRoomState.WAITING,
      enteredAt: now,
      expiresAt,
      admissionAttempts: 0,
    };

    waitingRooms.set(citaId, waitingRoom);

    logger.info(
      {
        citaId,
        pacienteId,
        doctorId,
        expiresAt,
      },
      'Sala de espera creada'
    );

    // Enviar notificación SSE al doctor
    await this.notifyDoctor(citaId, doctorId, {
      type: 'WAITING_ROOM_UPDATE',
      data: {
        citaId,
        estado: WaitingRoomState.WAITING,
        timestamp: Date.now(),
      },
    });

    return waitingRoom;
  }

  /**
   * Obtener estado de la sala de espera
   */
  getWaitingRoomStatus(citaId: string): WaitingRoomStatus | null {
    const room = waitingRooms.get(citaId);
    if (!room) {
      return null;
    }

    const now = new Date();
    const timeElapsed = Math.floor((now.getTime() - room.enteredAt.getTime()) / 1000);
    const timeRemaining = Math.max(0, Math.floor((room.expiresAt.getTime() - now.getTime()) / 1000));

    return {
      estado: room.estado,
      timeRemaining: room.estado === WaitingRoomState.WAITING ? timeRemaining : undefined,
      timeElapsed,
      enteredAt: room.enteredAt,
      expiresAt: room.expiresAt,
    };
  }

  /**
   * Obtener sala de espera completa (para doctor)
   */
  getWaitingRoom(citaId: string): WaitingRoom | null {
    return waitingRooms.get(citaId) || null;
  }

  /**
   * Admitir paciente en la consulta
   */
  async admitPatient(citaId: string, doctorId: string): Promise<WaitingRoom> {
    const room = waitingRooms.get(citaId);

    if (!room) {
      throw new Error('No hay sala de espera activa para esta cita');
    }

    // Verificar que el doctor es el correcto
    if (room.doctorId !== doctorId) {
      throw new Error('No autorizado: el doctor no corresponde a esta cita');
    }

    // Verificar transición válida
    if (!this.isValidTransition(room.estado, WaitingRoomState.ADMITTED)) {
      throw new Error(`No se puede admitir desde el estado ${room.estado}`);
    }

    // Actualizar estado
    room.estado = WaitingRoomState.ADMITTED;
    room.admittedAt = new Date();
    room.admissionAttempts += 1;

    waitingRooms.set(citaId, room);

    logger.info(
      {
        citaId,
        doctorId,
        pacienteId: room.pacienteId,
      },
      'Paciente admitido en sala de espera'
    );

    // Enviar notificación SSE al paciente
    await this.notifyPatient(citaId, room.pacienteId, {
      type: 'WAITING_ROOM_ADMITTED',
      data: {
        citaId,
        estado: WaitingRoomState.ADMITTED,
        timestamp: Date.now(),
      },
    });

    // Actualizar estado de la cita
    await this.updateCitaEstado(citaId, 'en_progreso');

    return room;
  }

  /**
   * Rechazar paciente de la sala de espera
   */
  async rejectPatient(
    citaId: string,
    doctorId: string,
    reason?: string
  ): Promise<WaitingRoom> {
    const room = waitingRooms.get(citaId);

    if (!room) {
      throw new Error('No hay sala de espera activa para esta cita');
    }

    // Verificar que el doctor es el correcto
    if (room.doctorId !== doctorId) {
      throw new Error('No autorizado: el doctor no corresponde a esta cita');
    }

    // Verificar transición válida
    if (!this.isValidTransition(room.estado, WaitingRoomState.ENDED)) {
      throw new Error(`No se puede rechazar desde el estado ${room.estado}`);
    }

    // Actualizar estado
    room.estado = WaitingRoomState.ENDED;
    room.endedAt = new Date();
    room.rejectReason = reason;

    waitingRooms.set(citaId, room);

    logger.info(
      {
        citaId,
        doctorId,
        pacienteId: room.pacienteId,
        reason,
      },
      'Paciente rechazado en sala de espera'
    );

    // Enviar notificación SSE al paciente
    await this.notifyPatient(citaId, room.pacienteId, {
      type: 'WAITING_ROOM_REJECTED',
      data: {
        citaId,
        estado: WaitingRoomState.ENDED,
        timestamp: Date.now(),
        motivo: reason,
      },
    });

    // Actualizar estado de la cita
    await this.updateCitaEstado(citaId, 'cancelada');

    return room;
  }

  /**
   * Finalizar sesión de consulta
   */
  async endSession(citaId: string, doctorId: string): Promise<WaitingRoom> {
    const room = waitingRooms.get(citaId);

    if (!room) {
      throw new Error('No hay sala de espera activa para esta cita');
    }

    // Verificar que el doctor es el correcto
    if (room.doctorId !== doctorId) {
      throw new Error('No autorizado: el doctor no corresponde a esta cita');
    }

    // Verificar transición válida
    if (!this.isValidTransition(room.estado, WaitingRoomState.ENDED)) {
      throw new Error(`No se puede finalizar desde el estado ${room.estado}`);
    }

    // Actualizar estado
    room.estado = WaitingRoomState.ENDED;
    room.endedAt = new Date();

    waitingRooms.set(citaId, room);

    logger.info(
      {
        citaId,
        doctorId,
        pacienteId: room.pacienteId,
      },
      'Sesión de consulta finalizada'
    );

    // Enviar notificación SSE a ambos
    await this.notifyPatient(citaId, room.pacienteId, {
      type: 'WAITING_ROOM_UPDATE',
      data: {
        citaId,
        estado: WaitingRoomState.ENDED,
        timestamp: Date.now(),
      },
    });

    await this.notifyDoctor(citaId, room.doctorId, {
      type: 'WAITING_ROOM_UPDATE',
      data: {
        citaId,
        estado: WaitingRoomState.ENDED,
        timestamp: Date.now(),
      },
    });

    // Actualizar estado de la cita
    await this.updateCitaEstado(citaId, 'completada');

    return room;
  }

  /**
   * Iniciar sesión (después de admitir)
   */
  async startSession(citaId: string, doctorId: string): Promise<WaitingRoom> {
    const room = waitingRooms.get(citaId);

    if (!room) {
      throw new Error('No hay sala de espera activa para esta cita');
    }

    // Verificar que el doctor es el correcto
    if (room.doctorId !== doctorId) {
      throw new Error('No autorizado: el doctor no corresponde a esta cita');
    }

    // Verificar transición válida
    if (!this.isValidTransition(room.estado, WaitingRoomState.IN_SESSION)) {
      throw new Error(`No se puede iniciar sesión desde el estado ${room.estado}`);
    }

    // Actualizar estado
    room.estado = WaitingRoomState.IN_SESSION;
    room.sessionStartedAt = new Date();

    waitingRooms.set(citaId, room);

    logger.info(
      {
        citaId,
        doctorId,
        pacienteId: room.pacienteId,
      },
      'Sesión de consulta iniciada'
    );

    return room;
  }

  /**
   * Verificar y expirar salas por timeout
   * @returns Número de salas expiradas
   */
  async checkTimeout(): Promise<number> {
    const now = new Date();
    let expiredCount = 0;

    for (const [citaId, room] of Array.from(waitingRooms.entries())) {
      // Solo verificar salas en estado waiting
      if (room.estado !== WaitingRoomState.WAITING) {
        continue;
      }

      // Verificar si expiró
      if (now > room.expiresAt) {
        room.estado = WaitingRoomState.TIMEOUT;
        room.endedAt = now;
        waitingRooms.set(citaId, room);

        expiredCount++;

        logger.info(
          {
            citaId,
            pacienteId: room.pacienteId,
            timeElapsed: Math.floor((now.getTime() - room.enteredAt.getTime()) / 1000),
          },
          'Sala de espera expirada por timeout'
        );

        // Enviar notificación SSE al paciente
        await this.notifyPatient(citaId, room.pacienteId, {
          type: 'WAITING_ROOM_TIMEOUT',
          data: {
            citaId,
            estado: WaitingRoomState.TIMEOUT,
            timestamp: Date.now(),
          },
        });

        // Actualizar estado de la cita
        await this.updateCitaEstado(citaId, 'no_presento');
      }
    }

    return expiredCount;
  }

  /**
   * Validar acceso a sala de espera
   */
  async validateAccess(
    citaId: string,
    userId: string,
    userRole: string
  ): Promise<WaitingRoomAccessValidation> {
    const room = waitingRooms.get(citaId);

    if (!room) {
      // Verificar si la cita existe
      const cita = await obtenerCitaPorId(citaId);
      if (!cita) {
        return {
          valid: false,
          reason: 'Cita no encontrada',
        };
      }

      // Si no hay sala pero la cita existe, permitir acceso para crearla
      if (cita.pacienteId === userId || cita.doctorId === userId) {
        return {
          valid: true,
          role: cita.pacienteId === userId ? 'paciente' : 'doctor',
        };
      }

      return {
        valid: false,
        reason: 'No tienes acceso a esta cita',
      };
    }

    // Verificar si la sala está activa
    if (room.estado === WaitingRoomState.ENDED) {
      return {
        valid: false,
        reason: 'La sesión ha finalizado',
      };
    }

    // Verificar si expiró
    if (room.estado === WaitingRoomState.TIMEOUT) {
      return {
        valid: false,
        reason: 'El tiempo de espera ha expirado',
      };
    }

    // Verificar permisos
    const isDoctor = room.doctorId === userId;
    const isPaciente = room.pacienteId === userId;
    const isAdmin = userRole === 'ADMIN';

    if (!isDoctor && !isPaciente && !isAdmin) {
      return {
        valid: false,
        reason: 'No tienes acceso a esta sala de espera',
      };
    }

    return {
      valid: true,
      role: isDoctor || isAdmin ? 'doctor' : 'paciente',
    };
  }

  /**
   * Verificar si una transición de estado es válida
   */
  private isValidTransition(from: WaitingRoomState, to: WaitingRoomState): boolean {
    const validTransitions = VALID_STATE_TRANSITIONS[from];
    return validTransitions?.includes(to) ?? false;
  }

  /**
   * Notificar al doctor vía SSE
   */
  private async notifyDoctor(
    citaId: string,
    doctorId: string,
    event: WaitingRoomSSEEvent
  ): Promise<void> {
    if (!this.config.enableSSE) {
      return;
    }

    try {
      await sseManager.sendToUser(doctorId, {
        type: event.type,
        data: event.data,
        timestamp: Date.now(),
        userId: doctorId,
      });
    } catch (error) {
      logger.error({ error, doctorId, citaId }, 'Error al notificar doctor vía SSE');
    }
  }

  /**
   * Notificar al paciente vía SSE
   */
  private async notifyPatient(
    citaId: string,
    pacienteId: string,
    event: WaitingRoomSSEEvent
  ): Promise<void> {
    if (!this.config.enableSSE) {
      return;
    }

    try {
      await sseManager.sendToUser(pacienteId, {
        type: event.type,
        data: event.data,
        timestamp: Date.now(),
        userId: pacienteId,
      });
    } catch (error) {
      logger.error({ error, pacienteId, citaId }, 'Error al notificar paciente vía SSE');
    }
  }

  /**
   * Actualizar estado de la cita en base de datos
   */
  private async updateCitaEstado(
    citaId: string,
    estado: 'en_progreso' | 'completada' | 'cancelada' | 'no_presento'
  ): Promise<void> {
    try {
      await prisma.cita.update({
        where: { id: citaId },
        data: { estado },
      });
    } catch (error) {
      logger.error({ error, citaId }, 'Error al actualizar estado de cita');
      // No lanzar error para no afectar el flujo principal
    }
  }

  /**
   * Obtener estadísticas de salas de espera
   */
  getStats(): { stats: Record<string, number>; total: number } {
    const stats = {
      [WaitingRoomState.WAITING]: 0,
      [WaitingRoomState.ADMITTED]: 0,
      [WaitingRoomState.IN_SESSION]: 0,
      [WaitingRoomState.ENDED]: 0,
      [WaitingRoomState.TIMEOUT]: 0,
    };

    for (const room of Array.from(waitingRooms.values())) {
      stats[room.estado]++;
    }

    return {
      stats,
      total: waitingRooms.size,
    };
  }

  /**
   * Obtener salas activas para un doctor
   */
  getActiveRoomsForDoctor(doctorId: string): WaitingRoom[] {
    const rooms: WaitingRoom[] = [];
    for (const room of Array.from(waitingRooms.values())) {
      if (room.doctorId === doctorId && room.estado !== WaitingRoomState.ENDED) {
        rooms.push(room);
      }
    }
    return rooms;
  }
}

// Exportar instancia singleton
export const waitingRoomService = new WaitingRoomService();
