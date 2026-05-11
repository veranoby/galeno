// apps/api/src/events/handlers/AuditEventHandler.ts
/**
 * AuditEventHandler - Maneja eventos para auditoría
 *
 * Registra eventos de dominio importantes para:
 * - Compliance (LOPDP, etc.)
 * - Seguridad
 * - Análisis forense
 * - Reconstrucción de estado
 */

import type { PrismaClient } from '@prisma/client';
import type { GalenoDomainEvent } from '../DomainEvent.js';
import { logger } from '../../utils/logger.js';
import { AuditAction, ResourceType } from '@prisma/client';

export class AuditEventHandler {
  constructor(private prisma: PrismaClient) {}

  /**
   * Maneja eventos de login de usuario
   */
  async handleUserLoggedIn(event: Extract<GalenoDomainEvent, { eventType: 'UserLoggedIn' }>): Promise<void> {
    const { data, metadata } = event;

    await this.prisma.auditLog.create({
      data: {
        action: AuditAction.LOGIN,
        userId: data.userId,
        rolUsuario: data.rol,
        ip: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
        metadata: {
          email: data.email,
          loginMethod: data.loginMethod,
          sessionId: data.sessionId
        },
        timestamp: event.timestamp
      }
    });

    logger.info({
      userId: data.userId,
      email: data.email,
      rol: data.rol
    }, 'User login audited');
  }

  /**
   * Maneja eventos de logout de usuario
   */
  async handleUserLoggedOut(event: Extract<GalenoDomainEvent, { eventType: 'UserLoggedOut' }>): Promise<void> {
    const { data } = event;

    await this.prisma.auditLog.create({
      data: {
        action: AuditAction.LOGOUT,
        userId: data.userId,
        rolUsuario: 'UNKNOWN',
        metadata: {
          sessionId: data.sessionId,
          logoutReason: data.logoutReason
        },
        timestamp: event.timestamp
      }
    });

    logger.info({
      userId: data.userId,
      reason: data.logoutReason
    }, 'User logout audited');
  }

  /**
   * Maneja eventos de pago recibido (auditoría financiera)
   */
  async handlePaymentReceived(event: Extract<GalenoDomainEvent, { eventType: 'PaymentReceived' }>): Promise<void> {
    const { data } = event;

    await this.prisma.auditLog.create({
      data: {
        action: AuditAction.PAYMENT_ACTION,
        userId: data.cuentaId,
        rolUsuario: 'DOCTOR',
        resourceType: 'PAGO',
        resourceId: data.pagoId,
        metadata: {
          amount: data.amount,
          currency: data.currency,
          gateway: data.gateway,
          status: data.status,
          transactionId: data.transactionId,
          plan: data.plan
        },
        timestamp: event.timestamp
      }
    });

    logger.info({
      pagoId: data.pagoId,
      cuentaId: data.cuentaId,
      amount: data.amount
    }, 'Payment audited');
  }

  /**
   * Maneja eventos de consulta firmada (auditoría médica)
   */
  async handleConsultaSigned(event: Extract<GalenoDomainEvent, { eventType: 'ConsultaSigned' }>): Promise<void> {
    const { data } = event;

    await this.prisma.auditLog.create({
      data: {
        action: AuditAction.RESOURCE_CREATE,
        userId: data.doctorId,
        rolUsuario: 'DOCTOR',
        resourceType: 'CONSULTA',
        resourceId: data.consultaId,
        metadata: {
          pacienteId: data.pacienteId,
          doctorId: data.doctorId,
          signedAt: data.signedAt,
          documentUrl: data.documentUrl
        },
        timestamp: event.timestamp
      }
    });

    logger.info({
      consultaId: data.consultaId,
      doctorId: data.doctorId,
      pacienteId: data.pacienteId
    }, 'Consulta signed audited');
  }

  /**
   * Maneja eventos de usuario vinculado
   */
  async handleUserLinked(event: Extract<GalenoDomainEvent, { eventType: 'UserLinked' }>): Promise<void> {
    const { data } = event;

    await this.prisma.auditLog.create({
      data: {
        action: AuditAction.RESOURCE_CREATE,
        userId: data.doctorId,
        rolUsuario: 'DOCTOR',
        resourceType: ResourceType.USUARIO,
        resourceId: data.usuarioVinculadoId,
        metadata: {
          usuarioVinculadoId: data.usuarioVinculadoId,
          doctorId: data.doctorId,
          email: data.email,
          rol: data.rol
        },
        timestamp: event.timestamp
      }
    });

    logger.info({
      usuarioVinculadoId: data.usuarioVinculadoId,
      doctorId: data.doctorId
    }, 'User linked audited');
  }

  /**
   * Maneja eventos de error del sistema
   */
  async handleSystemError(event: Extract<GalenoDomainEvent, { eventType: 'SystemError' }>): Promise<void> {
    const { data } = event;

    await this.prisma.auditLog.create({
      data: {
        action: AuditAction.RESOURCE_CREATE,
        userId: 'SYSTEM',
        rolUsuario: 'SYSTEM',
        metadata: {
          errorType: data.errorType,
          errorMessage: data.errorMessage,
          stackTrace: data.stackTrace,
          context: data.context as Record<string, unknown>,
          severity: data.severity
        } as any,
        timestamp: event.timestamp
      }
    });

    logger.error({
      errorType: data.errorType,
      errorMessage: data.errorMessage,
      severity: data.severity
    }, 'System error audited');
  }

  /**
   * Registra todos los handlers en el EventBus
   */
  registerHandlers(eventBus: import('../EventBus.js').EventBus): void {
    eventBus.subscribe('UserLoggedIn', (event) => this.handleUserLoggedIn(event as any));
    eventBus.subscribe('UserLoggedOut', (event) => this.handleUserLoggedOut(event as any));
    eventBus.subscribe('PaymentReceived', (event) => this.handlePaymentReceived(event as any));
    eventBus.subscribe('ConsultaSigned', (event) => this.handleConsultaSigned(event as any));
    eventBus.subscribe('UserLinked', (event) => this.handleUserLinked(event as any));
    eventBus.subscribe('SystemError', (event) => this.handleSystemError(event as any));
  }
}

export default AuditEventHandler;
