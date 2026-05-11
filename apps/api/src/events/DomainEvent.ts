// apps/api/src/events/DomainEvent.ts
/**
 * Domain Events - Eventos de dominio del sistema Galeno
 *
 * Definición de eventos de negocio que fluyen a través del Event Bus.
 * Estos eventos representan hechos significativos en el dominio.
 *
 * Patrones aplicados:
 * - Domain Events: Eventos que representan cambios en el estado del negocio
 * - Strongly Typed: TypeScript types para type safety
 * - Immutable: Events son inmutables una vez publicados
 */

import type { Plan, Rol, PaymentStatus } from '@prisma/client';

// ============= BASE TYPES =============

/**
 * Base interface para todos los eventos de dominio
 */
export interface DomainEvent {
  eventType: string;
  eventId: string;
  timestamp: Date;
  version: number;
  correlationId?: string;
  causationId?: string;
  metadata?: EventMetadata;
}

export interface EventMetadata {
  userId?: string;
  cuentaId?: string;
  source: string;
  ipAddress?: string;
  userAgent?: string;
}

// ============= PAYMENT EVENTS =============

export interface PaymentReceivedEvent extends DomainEvent {
  eventType: 'PaymentReceived';
  data: {
    pagoId: string;
    cuentaId: string;
    amount: number;
    currency: string;
    gateway: 'payphone' | 'kushki' | 'stripe';
    status: PaymentStatus;
    transactionId: string;
    plan?: Plan;
  };
}

export interface PaymentFailedEvent extends DomainEvent {
  eventType: 'PaymentFailed';
  data: {
    pagoId: string;
    cuentaId: string;
    amount: number;
    gateway: 'payphone' | 'kushki' | 'stripe';
    reason: string;
    errorCode?: string;
  };
}

export interface SubscriptionCreatedEvent extends DomainEvent {
  eventType: 'SubscriptionCreated';
  data: {
    cuentaId: string;
    subscriptionId: string;
    plan: Plan;
    trialEndsAt?: Date;
  };
}

export interface SubscriptionCancelledEvent extends DomainEvent {
  eventType: 'SubscriptionCancelled';
  data: {
    cuentaId: string;
    subscriptionId: string;
    reason?: string;
    cancelAtPeriodEnd: boolean;
  };
}

// ============= CONSULTATION EVENTS =============

export interface ConsultaCreatedEvent extends DomainEvent {
  eventType: 'ConsultaCreated';
  data: {
    consultaId: string;
    pacienteId: string;
    doctorId: string;
    asistenteId?: string;
    tipo: 'presencial' | 'teleconsulta';
    motivo: string;
  };
}

export interface ConsultaSignedEvent extends DomainEvent {
  eventType: 'ConsultaSigned';
  data: {
    consultaId: string;
    pacienteId: string;
    doctorId: string;
    signedAt: Date;
    documentUrl?: string;
  };
}

export interface ConsultaCompletedEvent extends DomainEvent {
  eventType: 'ConsultaCompleted';
  data: {
    consultaId: string;
    pacienteId: string;
    doctorId: string;
    estado: string;
    duracionMinutos?: number;
  };
}

// ============= PATIENT EVENTS =============

export interface PatientRegisteredEvent extends DomainEvent {
  eventType: 'PatientRegistered';
  data: {
    pacienteId: string;
    cuentaId: string;
    nombre: string;
    email?: string;
    telefono?: string;
  };
}

export interface PatientConnectedEvent extends DomainEvent {
  eventType: 'PatientConnected';
  data: {
    pacienteId: string;
    doctorId: string;
    conexionId: string;
    consentType: 'explicit' | 'implicit';
  };
}

// ============= NOTIFICATION EVENTS =============

export interface NotificationSentEvent extends DomainEvent {
  eventType: 'NotificationSent';
  data: {
    notificationId: string;
    userId: string;
    type: string;
    channels: string[];
    title: string;
    delivered: boolean;
  };
}

export interface NotificationReadEvent extends DomainEvent {
  eventType: 'NotificationRead';
  data: {
    notificationId: string;
    userId: string;
    readAt: Date;
  };
}

// ============= USER EVENTS =============

export interface UserLoggedInEvent extends DomainEvent {
  eventType: 'UserLoggedIn';
  data: {
    userId: string;
    email: string;
    rol: Rol;
    loginMethod: 'password' | 'refresh_token';
    sessionId: string;
  };
}

export interface UserLoggedOutEvent extends DomainEvent {
  eventType: 'UserLoggedOut';
  data: {
    userId: string;
    sessionId: string;
    logoutReason?: 'user_initiated' | 'session_expired' | 'security';
  };
}

export interface UserLinkedEvent extends DomainEvent {
  eventType: 'UserLinked';
  data: {
    usuarioVinculadoId: string;
    doctorId: string;
    email: string;
    rol: Rol;
  };
}

// ============= AGENDA EVENTS =============

export interface AppointmentScheduledEvent extends DomainEvent {
  eventType: 'AppointmentScheduled';
  data: {
    citaId: string;
    pacienteId: string;
    doctorId: string;
    scheduledAt: Date;
    tipo: string;
  };
}

export interface AppointmentCancelledEvent extends DomainEvent {
  eventType: 'AppointmentCancelled';
  data: {
    citaId: string;
    pacienteId: string;
    doctorId: string;
    cancelledAt: Date;
    reason?: string;
    cancelledBy: string;
  };
}

// ============= DOCUMENT EVENTS =============

export interface DocumentGeneratedEvent extends DomainEvent {
  eventType: 'DocumentGenerated';
  data: {
    documentoId: string;
    consultaId: string;
    tipo: 'receta' | 'certificado' | 'orden' | 'incapacidad';
    generadoPor: string;
    url?: string;
  };
}

export interface DocumentSignedEvent extends DomainEvent {
  eventType: 'DocumentSigned';
  data: {
    documentoId: string;
    consultaId?: string;
    firmadoPor: string;
    signedAt: Date;
    firmaUrl?: string;
  };
}

// ============= SYSTEM EVENTS =============

export interface SystemErrorEvent extends DomainEvent {
  eventType: 'SystemError';
  data: {
    errorType: string;
    errorMessage: string;
    stackTrace?: string;
    context?: Record<string, unknown>;
    severity: 'low' | 'medium' | 'high' | 'critical';
  };
}

export interface SystemMetricEvent extends DomainEvent {
  eventType: 'SystemMetric';
  data: {
    metricName: string;
    metricValue: number;
    metricUnit: string;
    tags?: Record<string, string>;
  };
}

// ============= UNION TYPE =============

export type GalenoDomainEvent =
  | PaymentReceivedEvent
  | PaymentFailedEvent
  | SubscriptionCreatedEvent
  | SubscriptionCancelledEvent
  | ConsultaCreatedEvent
  | ConsultaSignedEvent
  | ConsultaCompletedEvent
  | PatientRegisteredEvent
  | PatientConnectedEvent
  | NotificationSentEvent
  | NotificationReadEvent
  | UserLoggedInEvent
  | UserLoggedOutEvent
  | UserLinkedEvent
  | AppointmentScheduledEvent
  | AppointmentCancelledEvent
  | DocumentGeneratedEvent
  | DocumentSignedEvent
  | SystemErrorEvent
  | SystemMetricEvent;

// ============= HELPER FUNCTIONS =============

/**
 * Crea un ID único para el evento
 */
export function createEventId(): string {
  return `evt_${Date.now()}_${crypto.randomUUID()}`;
}

/**
 * Crea un ID de correlación para relacionar eventos
 */
export function createCorrelationId(): string {
  return `corr_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Base de datos para crear eventos
 */
export function createBaseEvent(
  eventType: string,
  metadata?: EventMetadata
): Omit<DomainEvent, 'data'> {
  return {
    eventType,
    eventId: createEventId(),
    timestamp: new Date(),
    version: 1,
    correlationId: metadata?.userId ? createCorrelationId() : undefined,
    metadata,
  };
}
