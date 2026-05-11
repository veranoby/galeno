// apps/api/src/events/handlers/NotificationEventHandler.ts
/**
 * NotificationEventHandler - Maneja eventos para enviar notificaciones
 *
 * Procesa eventos de dominio y genera notificaciones apropiadas:
 * - Pago recibido → Notificar al usuario
 * - Consulta creada → Notificar al paciente
 * - Usuario vinculado → Notificar al doctor
 * - etc.
 */

import type { PrismaClient } from '@prisma/client';
import type { GalenoDomainEvent } from '../DomainEvent.js';
import type { INotificationRepository } from '../../repositories/interfaces/INotificationRepository.js';
import type { NotificationOrchestrator } from '../../services/notifications/NotificationOrchestrator.js';
import { NotificationType } from '@galeno/shared-types';

export class NotificationEventHandler {
  constructor(
    private prisma: PrismaClient,
    private notificationRepo: INotificationRepository,
    private notificationOrchestrator: NotificationOrchestrator
  ) {}

  /**
   * Maneja eventos de pago recibido
   */
  async handlePaymentReceived(event: Extract<GalenoDomainEvent, { eventType: 'PaymentReceived' }>): Promise<void> {
    const { data, metadata } = event;

    await this.notificationOrchestrator.sendNotification({
      userId: data.cuentaId,
      title: 'Pago recibido exitosamente',
      message: `Tu pago de $${data.amount} ${data.currency} ha sido procesado.`,
      type: NotificationType.SUCCESS,
      data: {
        pagoId: data.pagoId,
        transactionId: data.transactionId,
        amount: data.amount
      }
    });
  }

  /**
   * Maneja eventos de pago fallido
   */
  async handlePaymentFailed(event: Extract<GalenoDomainEvent, { eventType: 'PaymentFailed' }>): Promise<void> {
    const { data } = event;

    await this.notificationOrchestrator.sendNotification({
      userId: data.cuentaId,
      title: 'Pago fallido',
      message: `Tu pago de $${data.amount} no pudo ser procesado. ${data.reason}`,
      type: NotificationType.ERROR,
      data: {
        pagoId: data.pagoId,
        reason: data.reason,
        errorCode: data.errorCode
      }
    });
  }

  /**
   * Maneja eventos de consulta creada
   */
  async handleConsultaCreated(event: Extract<GalenoDomainEvent, { eventType: 'ConsultaCreated' }>): Promise<void> {
    const { data } = event;

    // Notificar al paciente
    await this.notificationOrchestrator.sendNotification({
      userId: data.pacienteId,
      title: 'Nueva consulta agendada',
      message: `Tu consulta ha sido agendada correctamente.`,
      type: NotificationType.INFO,
      data: {
        consultaId: data.consultaId,
        tipo: data.tipo,
        motivo: data.motivo
      }
    });
  }

  /**
   * Maneja eventos de consulta firmada
   */
  async handleConsultaSigned(event: Extract<GalenoDomainEvent, { eventType: 'ConsultaSigned' }>): Promise<void> {
    const { data } = event;

    await this.notificationOrchestrator.sendNotification({
      userId: data.pacienteId,
      title: 'Consulta completada',
      message: 'Tu consulta ha sido finalizada y está disponible en tu historial.',
      type: NotificationType.SUCCESS,
      data: {
        consultaId: data.consultaId,
        signedAt: data.signedAt,
        documentUrl: data.documentUrl
      }
    });
  }

  /**
   * Maneja eventos de paciente conectado
   */
  async handlePatientConnected(event: Extract<GalenoDomainEvent, { eventType: 'PatientConnected' }>): Promise<void> {
    const { data } = event;

    await this.notificationOrchestrator.sendNotification({
      userId: data.doctorId,
      title: 'Nuevo paciente conectado',
      message: `Un paciente ha sido conectado a tu cuenta.`,
      type: NotificationType.INFO,
      data: {
        pacienteId: data.pacienteId,
        conexionId: data.conexionId
      }
    });
  }

  /**
   * Maneja eventos de cita agendada
   */
  async handleAppointmentScheduled(event: Extract<GalenoDomainEvent, { eventType: 'AppointmentScheduled' }>): Promise<void> {
    const { data } = event;

    await this.notificationOrchestrator.sendNotification({
      userId: data.pacienteId,
      title: 'Cita confirmada',
      message: `Tu cita ha sido confirmada para el ${new Date(data.scheduledAt).toLocaleDateString()}.`,
      type: NotificationType.SUCCESS,
      data: {
        citaId: data.citaId,
        scheduledAt: data.scheduledAt,
        tipo: data.tipo
      }
    });
  }

  /**
   * Maneja eventos de cita cancelada
   */
  async handleAppointmentCancelled(event: Extract<GalenoDomainEvent, { eventType: 'AppointmentCancelled' }>): Promise<void> {
    const { data } = event;

    await this.notificationOrchestrator.sendNotification({
      userId: data.pacienteId,
      title: 'Cita cancelada',
      message: `Tu cita ha sido cancelada.${data.reason ? ` Motivo: ${data.reason}` : ''}`,
      type: NotificationType.WARNING,
      data: {
        citaId: data.citaId,
        cancelledAt: data.cancelledAt,
        reason: data.reason
      }
    });
  }

  /**
   * Registra todos los handlers en el EventBus
   */
  registerHandlers(eventBus: import('../EventBus.js').EventBus): void {
    eventBus.subscribe('PaymentReceived', (event) => this.handlePaymentReceived(event as any));
    eventBus.subscribe('PaymentFailed', (event) => this.handlePaymentFailed(event as any));
    eventBus.subscribe('ConsultaCreated', (event) => this.handleConsultaCreated(event as any));
    eventBus.subscribe('ConsultaSigned', (event) => this.handleConsultaSigned(event as any));
    eventBus.subscribe('PatientConnected', (event) => this.handlePatientConnected(event as any));
    eventBus.subscribe('AppointmentScheduled', (event) => this.handleAppointmentScheduled(event as any));
    eventBus.subscribe('AppointmentCancelled', (event) => this.handleAppointmentCancelled(event as any));
  }
}

export default NotificationEventHandler;
