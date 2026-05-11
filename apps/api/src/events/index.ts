// apps/api/src/events/index.ts
/**
 * Módulo de Eventos - Barrel export
 *
 * Proporciona acceso a:
 * - Domain Events (tipos de eventos)
 * - EventBus (implementación Redis Pub/Sub)
 * - Event Handlers (procesadores de eventos)
 */

// Domain Events
export type {
  DomainEvent,
  EventMetadata,
  PaymentReceivedEvent,
  PaymentFailedEvent,
  SubscriptionCreatedEvent,
  SubscriptionCancelledEvent,
  ConsultaCreatedEvent,
  ConsultaSignedEvent,
  ConsultaCompletedEvent,
  PatientRegisteredEvent,
  PatientConnectedEvent,
  NotificationSentEvent,
  NotificationReadEvent,
  UserLoggedInEvent,
  UserLoggedOutEvent,
  UserLinkedEvent,
  AppointmentScheduledEvent,
  AppointmentCancelledEvent,
  DocumentGeneratedEvent,
  DocumentSignedEvent,
  SystemErrorEvent,
  SystemMetricEvent,
  GalenoDomainEvent
} from './DomainEvent.js';

export {
  createEventId,
  createCorrelationId,
  createBaseEvent
} from './DomainEvent.js';

// EventBus
export {
  EventBus,
  getEventBus,
  resetEventBus
} from './EventBus.js';

export type {
  EventPattern,
  EventHandler,
  EventSubscription
} from './EventBus.js';

// Event Handlers
export { NotificationEventHandler } from './handlers/NotificationEventHandler.js';
export { AuditEventHandler } from './handlers/AuditEventHandler.js';
export { AnalyticsEventHandler } from './handlers/AnalyticsEventHandler.js';
