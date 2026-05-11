/**
 * Tipos e interfaces para el servicio de videoconferencia Jitsi Meet
 */

/**
 * Contexto de usuario para Jitsi
 */
export interface JitsiUserContext {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  role: 'moderator' | 'participant';
}

/**
 * Configuración para crear una reunión Jitsi
 */
export interface JitsiMeetingConfig {
  /** ID de la cita asociada */
  citaId: string;
  /** ID del doctor (moderador) */
  doctorId: string;
  /** ID del paciente */
  pacienteId: string;
  /** Fecha y hora de inicio de la cita */
  startTime: Date;
  /** Duración estimada en minutos (opcional) */
  duration?: number;
  /** Información del doctor */
  doctorInfo?: {
    nombre: string;
    email?: string;
    especialidad?: string;
  };
  /** Información del paciente */
  pacienteInfo?: {
    nombre: string;
    email?: string;
  };
}

/**
 * Respuesta al crear una reunión Jitsi
 */
export interface JitsiMeetingResponse {
  /** ID único de la reunión */
  meetingId: string;
  /** Nombre de la sala (encriptado) */
  roomName: string;
  /** Token JWT para autenticación (opcional) */
  jwtToken?: string;
  /** URL completa para unirse a la reunión */
  joinUrl: string;
  /** Fecha de expiración del token/reunión */
  expiresAt: Date;
  /** Dominio de Jitsi */
  domain: string;
}

/**
 * Opciones para generar JWT de Jitsi
 */
export interface JitsiJWTPayload {
  /** Contexto de la reunión */
  context: {
    /** Información del usuario */
    user: {
      /** Nombre del usuario */
      name: string;
      /** Email del usuario */
      email?: string;
      /** Avatar URL */
      avatar?: string;
    };
    /** Información de la sala */
    room: string;
    /** Rol del usuario */
    role?: string;
  };
  /** Datos adicionales de la aplicación */
  app?: string;
  /** Tipo de token */
  type?: 'link' | 'jwt';
}

/**
 * Resultado de validación de acceso a una reunión
 */
export interface MeetingAccessValidation {
  /** Si el acceso es válido */
  valid: boolean;
  /** Rol del usuario en la reunión */
  role?: 'moderator' | 'participant';
  /** Razón del rechazo (si aplica) */
  reason?: string;
}

/**
 * Opciones de configuración para el servicio Jitsi
 */
export interface JitsiServiceConfig {
  /** App ID de Jitsi (para JWT) */
  appId: string;
  /** App Secret de Jitsi (para JWT) */
  appSecret: string;
  /** Dominio de Jitsi Meet */
  domain: string;
  /** Salt para generar nombres de sala seguros */
  salt: string;
  /** Si está en modo producción */
  isProduction: boolean;
}

/**
 * Eventos de auditoría para Jitsi
 */
export type JitsiAuditEvent =
  | 'jitsi_meeting_created'
  | 'jitsi_meeting_joined'
  | 'jitsi_meeting_ended'
  | 'jitsi_meeting_access_denied';

/**
 * Datos para log de auditoría
 */
export interface JitsiAuditLogData {
  accion: JitsiAuditEvent;
  userId: string;
  userRole: string;
  citaId: string;
  meetingId?: string;
  detalles?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}
