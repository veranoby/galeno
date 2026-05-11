// apps/api/src/constants/notifications.ts
/**
 * Constantes para el sistema de notificaciones
 *
 * Centraliza todos los magic strings y números relacionados con notificaciones
 */

// ============= NOTIFICATION TYPES =============
export const NOTIFICATION_TYPES = {
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
  SYSTEM: 'system'
} as const;

// ============= NOTIFICATION CHANNELS =============
export const NOTIFICATION_CHANNELS = {
  PUSH: 'push',
  SSE: 'sse',
  WHATSAPP: 'whatsapp',
  TOAST: 'toast',
  EMAIL: 'email'
} as const;

// ============= NOTIFICATION PRIORITIES =============
export const NOTIFICATION_PRIORITIES = {
  LOW: 1,
  NORMAL: 2,
  HIGH: 3,
  URGENT: 4
} as const;

// ============= SSE SETTINGS =============
export const SSE_SETTINGS = {
  // Timeouts en milisegundos
  CONNECTION_TIMEOUT: 10000,     // 10 segundos
  HEARTBEAT_INTERVAL: 30000,     // 30 segundos
  HEARTBEAT_TIMEOUT: 90000,      // 90 segundos

  // Headers
  CONTENT_TYPE: 'text/event-stream',
  CACHE_CONTROL: 'no-cache',
  CONNECTION: 'keep-alive',

  // Reconexión
  RECONNECT_DELAY: 1000,         // 1 segundo
  MAX_RECONNECT_ATTEMPTS: 5
} as const;

// ============= NOTIFICATION TEMPLATES =============
export const NOTIFICATION_TEMPLATES = {
  CONSULTA_CREATED: 'Nueva consulta creada',
  CONSULTA_UPDATED: 'Consulta actualizada',
  CONSULTA_SIGNED: 'Consulta firmada',
  PAYMENT_RECEIVED: 'Pago recibido',
  PAYMENT_FAILED: 'Pago fallido',
  APPOINTMENT_REMINDER: 'Recordatorio de cita',
  PRESCRIPTION_READY: 'Prescripción lista'
} as const;
