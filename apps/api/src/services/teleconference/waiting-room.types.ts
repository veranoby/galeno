/**
 * Tipos e interfaces para el servicio de Sala de Espera Virtual
 */

/**
 * Estados posibles de la sala de espera
 */
export enum WaitingRoomState {
  /** Paciente está esperando admisión */
  WAITING = 'waiting',
  /** Paciente fue admitido por el doctor */
  ADMITTED = 'admitted',
  /** Paciente está en sesión activa */
  IN_SESSION = 'in-session',
  /** Sesión finalizada */
  ENDED = 'ended',
  /** Tiempo de espera expirado (15 min) */
  TIMEOUT = 'timeout',
}

/**
 * Estados válidos para transiciones
 */
export const VALID_STATE_TRANSITIONS: Record<WaitingRoomState, WaitingRoomState[]> = {
  [WaitingRoomState.WAITING]: [WaitingRoomState.ADMITTED, WaitingRoomState.TIMEOUT, WaitingRoomState.ENDED],
  [WaitingRoomState.ADMITTED]: [WaitingRoomState.IN_SESSION, WaitingRoomState.ENDED],
  [WaitingRoomState.IN_SESSION]: [WaitingRoomState.ENDED],
  [WaitingRoomState.ENDED]: [],
  [WaitingRoomState.TIMEOUT]: [WaitingRoomState.ENDED],
};

/**
 * Información de la sala de espera
 */
export interface WaitingRoom {
  /** ID único de la sala (mismo que citaId) */
  id: string;
  /** ID de la cita asociada */
  citaId: string;
  /** ID del paciente */
  pacienteId: string;
  /** ID del doctor */
  doctorId: string;
  /** Estado actual de la sala */
  estado: WaitingRoomState;
  /** Fecha de entrada del paciente */
  enteredAt: Date;
  /** Fecha de admisión (si aplica) */
  admittedAt?: Date;
  /** Fecha de inicio de sesión (si aplica) */
  sessionStartedAt?: Date;
  /** Fecha de finalización */
  endedAt?: Date;
  /** Motivo de rechazo (si aplica) */
  rejectReason?: string;
  /** Fecha de expiración (15 min después de enteredAt) */
  expiresAt: Date;
  /** Número de intentos de admisión */
  admissionAttempts: number;
}

/**
 * Datos para crear una sala de espera
 */
export interface CreateWaitingRoomData {
  /** ID de la cita */
  citaId: string;
  /** ID del paciente */
  pacienteId: string;
  /** ID del doctor */
  doctorId: string;
}

/**
 * Respuesta al crear sala de espera
 */
export interface WaitingRoomResponse {
  success: boolean;
  data?: WaitingRoom;
  error?: string;
}

/**
 * Estado actual de la sala de espera para el cliente
 */
export interface WaitingRoomStatus {
  /** Estado actual */
  estado: WaitingRoomState;
  /** Tiempo restante en segundos (si está esperando) */
  timeRemaining?: number;
  /** Tiempo transcurrido en segundos */
  timeElapsed?: number;
  /** Información del paciente */
  paciente?: {
    id: string;
    nombre: string;
  };
  /** Información del doctor */
  doctor?: {
    id: string;
    nombre: string;
  };
  /** Fecha de entrada */
  enteredAt: Date;
  /** Fecha de expiración */
  expiresAt: Date;
}

/**
 * Evento SSE para sala de espera
 */
export interface WaitingRoomSSEEvent {
  /** Tipo de evento */
  type: 'WAITING_ROOM_UPDATE' | 'WAITING_ROOM_ADMITTED' | 'WAITING_ROOM_REJECTED' | 'WAITING_ROOM_TIMEOUT';
  /** Datos del evento */
  data: {
    citaId: string;
    estado: WaitingRoomState;
    timestamp: number;
    motivo?: string;
  };
  /** ID del usuario destinatario */
  userId?: string;
}

/**
 * Resultado de validación de acceso a sala de espera
 */
export interface WaitingRoomAccessValidation {
  /** Si el acceso es válido */
  valid: boolean;
  /** Rol del usuario */
  role?: 'paciente' | 'doctor';
  /** Razón del rechazo */
  reason?: string;
}

/**
 * Configuración del servicio de sala de espera
 */
export interface WaitingRoomConfig {
  /** Tiempo máximo de espera en minutos (default: 15) */
  timeoutMinutes: number;
  /** Intervalo de cleanup en minutos (default: 5) */
  cleanupIntervalMinutes: number;
  /** Habilitar notificaciones SSE */
  enableSSE: boolean;
}

/**
 * Estadísticas de sala de espera
 */
export interface WaitingRoomStats {
  /** Total de salas activas */
  totalActive: number;
  /** Pacientes esperando */
  waiting: number;
  /** Pacientes admitidos */
  admitted: number;
  /** En sesión */
  inSession: number;
  /** Expirados por timeout */
  timeout: number;
}
