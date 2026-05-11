// apps/api/src/constants/events.ts
/**
 * Constantes para el sistema de eventos
 *
 * Centraliza todos los magic strings y números relacionados con eventos
 */

// ============= EVENT CHANNELS =============
export const EVENT_CHANNELS = {
  NOTIFICATIONS: 'notifications',
  TRIAGE_UPDATES: 'triage_updates',
  PAYMENTS: 'payments',
  CONSULTAS: 'consultas',
  AUDIT: 'audit'
} as const;

// ============= EVENT TYPES =============
export const EVENT_TYPES = {
  // Payment Events
  PAYMENT_RECEIVED: 'PaymentReceived',
  PAYMENT_FAILED: 'PaymentFailed',
  PAYMENT_REFUNDED: 'PaymentRefunded',

  // Consulta Events
  CONSULTA_CREATED: 'ConsultaCreated',
  CONSULTA_UPDATED: 'ConsultaUpdated',
  CONSULTA_COMPLETED: 'ConsultaCompleted',
  CONSULTA_SIGNED: 'ConsultaSigned',

  // Patient Events
  PATIENT_CONNECTED: 'PatientConnected',
  PATIENT_DISCONNECTED: 'PatientDisconnected',

  // User Events
  USER_LOGGED_IN: 'UserLoggedIn',
  USER_LOGGED_OUT: 'UserLoggedOut',

  // System Events
  SYSTEM_METRIC: 'SystemMetric'
} as const;

// ============= EVENT PRIORITIES =============
export const EVENT_PRIORITIES = {
  LOW: 1,
  NORMAL: 2,
  HIGH: 3,
  CRITICAL: 4
} as const;

// ============= EVENT TTL (Time To Live) =============
export const EVENT_TTL = {
  NOTIFICATIONS: 7 * 24 * 60 * 60, // 7 días en segundos
  AUDIT: 30 * 24 * 60 * 60,       // 30 días en segundos
  METRICS: 7 * 24 * 60 * 60,       // 7 días en segundos
  TEMPORAL: 24 * 60 * 60           // 24 horas en segundos
} as const;
