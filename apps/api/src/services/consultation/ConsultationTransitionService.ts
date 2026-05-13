import { EstadoConsulta, Rol, RolVinculado } from '@prisma/client';
import { getEventBus } from '../../events/EventBus.js';
import type { EventBus } from '../../events/EventBus.js';
import { createBaseEvent, ConsultationStatusChangedEvent } from '../../events/DomainEvent.js';
import { logger } from '../../utils/logger.js';

export class ConsultationTransitionError extends Error {
  public status: number;
  public from: string;
  public to: string;
  public reason: string;

  constructor(from: string, to: string, reason: string) {
    super(`Cannot transition consultation from ${from} to ${to}: ${reason}`);
    this.name = 'ConsultationTransitionError';
    this.status = 422;
    this.from = from;
    this.to = to;
    this.reason = reason;
  }
}

export class ConsultationTransitionService {
  constructor() {}

  /**
   * Validates and processes a state transition for a consultation
   *
   * @param consultationId - The ID of the consultation
   * @param currentStatus - The current status of the consultation
   * @param nextStatus - The status being requested
   * @param userRole - The role of the user requesting the change
   * @param doctorId - The ID of the doctor associated with the consultation
   * @param patientName - Optional name of the patient (for event broadcasting)
   *
   * @throws {ConsultationTransitionError} If the transition is illegal or unauthorized
   */
  public async transitionState(
    consultationId: string,
    currentStatus: EstadoConsulta,
    nextStatus: EstadoConsulta,
    userRole: Rol | RolVinculado | string,
    doctorId: string,
    patientName?: string
  ): Promise<void> {

    // If the state isn't actually changing, we can just return
    if (currentStatus === nextStatus) {
      return;
    }

    this.validateTransition(currentStatus, nextStatus, userRole);

    // If valid, broadcast event via EventBus
    try {
      const eventBus = getEventBus();
      const event: ConsultationStatusChangedEvent = {
        ...createBaseEvent('ConsultationStatusChanged', { userId: doctorId, source: 'ConsultationTransitionService' }),
        eventType: 'ConsultationStatusChanged',
        data: {
          consultationId,
          previousStatus: currentStatus,
          newStatus: nextStatus,
          patientName,
          doctorId,
          timestamp: new Date()
        }
      };

      await eventBus.publish(event);
      logger.info({ consultationId, currentStatus, nextStatus }, 'Consultation status changed event published');
    } catch (error) {
      logger.error({ error, consultationId }, 'Failed to publish consultation_status_changed event');
      // We don't throw here as the database transition (which should happen before or alongside this)
      // was theoretically valid, but the event broadcast failed.
    }
  }

  /**
   * Validates if a transition is legal according to business rules
   *
   * borrador     → triaje | pendiente
   * triaje       → pendiente | en_atencion   (roles: enfermera, asistente)
   * pendiente    → en_atencion
   * en_atencion  → finalizada | interconsulta
   * interconsulta→ finalizada
   * finalizada   → (terminal — no transitions)
   *
   * @throws {ConsultationTransitionError}
   */
  public validateTransition(from: EstadoConsulta, to: EstadoConsulta, userRole: string): void {
    if (from === 'finalizada') {
      throw new ConsultationTransitionError(from, to, 'finalizada is a terminal state');
    }

    const validTransitions: Record<string, string[]> = {
      borrador: ['triaje', 'pendiente'],
      triaje: ['pendiente', 'en_atencion'],
      pendiente: ['en_atencion'],
      en_atencion: ['finalizada', 'interconsulta'],
      interconsulta: ['finalizada']
    };

    const allowedNext = validTransitions[from] || [];
    if (!allowedNext.includes(to)) {
      throw new ConsultationTransitionError(from, to, `Invalid state transition`);
    }

    // Role enforcement
    if (from === 'triaje') {
       if (userRole !== 'ENFERMERA' && userRole !== 'ASISTENTE' && userRole !== 'enfermera' && userRole !== 'asistente') {
         throw new ConsultationTransitionError(from, to, 'Role is not authorized to transition from triaje');
       }
    }
  }
}
