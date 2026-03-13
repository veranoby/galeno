// apps/api/src/services/notifications/channels/WhatsAppNotificationChannel.ts
/**
 * Canal para WhatsApp Notifications
 * Envía notificaciones críticas vía WhatsApp
 */

import type { NotificationType } from '@galeno/shared-types';
import { NotificationMethod } from '@galeno/shared-types';
import { PrismaClient } from '@prisma/client';
import { getWhatsAppProvider, type WhatsAppProvider } from '../../whatsapp/index.js';
import { logger } from '../../../utils/logger.js';
import type { INotificationRepository } from '../../../repositories/interfaces/INotificationRepository.js';

export interface WhatsAppNotificationPayload {
  title: string;
  message: string;
  type: NotificationType;
  data?: Record<string, unknown>;
  notificationId?: string;
}

export class WhatsAppNotificationChannel {
  private whatsappProvider: WhatsAppProvider;

  constructor(
    private prisma: PrismaClient,
    private notificationRepo: INotificationRepository
  ) {
    this.whatsappProvider = getWhatsAppProvider();
  }

  /**
   * Enviar notificación WhatsApp a un usuario
   * Con fallback automático a push si falla
   */
  async send(userId: string, payload: WhatsAppNotificationPayload, fallbackChannel?: { send: (userId: string, payload: any) => Promise<boolean> }): Promise<boolean> {
    try {
      // Obtener teléfono del usuario desde la base de datos
      const user = await this.prisma.cuenta.findUnique({
        where: { id: userId },
        select: {
          email: true,
          nombre: true
        }
      });

      if (!user) {
        logger.warn({ userId }, '[WhatsAppNotificationChannel] User not found');
        return this.tryFallback(userId, payload, fallbackChannel);
      }

      // Intentar obtener el número de teléfono del paciente
      const patient = await this.prisma.paciente.findFirst({
        where: { cuentaId: userId },
        select: { telefono: true }
      });

      const phoneNumber = patient?.telefono;

      if (!phoneNumber) {
        logger.warn({ userId }, '[WhatsAppNotificationChannel] User has no phone number');
        return this.tryFallback(userId, payload, fallbackChannel);
      }

      // Enviar mensaje WhatsApp
      const result = await this.whatsappProvider.sendMessage({
        to: phoneNumber,
        body: `${payload.title}\n\n${payload.message}`,
        metadata: {
          userId,
          notificationType: payload.type,
          ...payload.data
        }
      });

      if (result.status === 'failed') {
        logger.warn(
          { messageId: result.messageId, error: result.error },
          '[WhatsAppNotificationChannel] Message failed, using fallback'
        );
        return this.tryFallback(userId, payload, fallbackChannel);
      }

      // Actualizar notificación con WhatsApp messageId para tracking
      const notificationId = payload.notificationId;
      if (notificationId) {
        await this.notificationRepo.update(notificationId, {
          datos: {
            ...(payload.data || {}),
            whatsappSid: result.messageId,
            whatsappStatus: result.status
          } as any
        });
      }

      logger.info(
        { messageId: result.messageId, userId, to: phoneNumber },
        '[WhatsAppNotificationChannel] WhatsApp notification sent successfully'
      );

      return true;
    } catch (error) {
      logger.error({ error }, '[WhatsAppNotificationChannel] Failed to send WhatsApp notification');
      return this.tryFallback(userId, payload, fallbackChannel);
    }
  }

  /**
   * Intentar usar canal de fallback (push notification)
   */
  private async tryFallback(
    userId: string,
    payload: WhatsAppNotificationPayload,
    fallbackChannel?: { send: (userId: string, payload: any) => Promise<boolean> }
  ): Promise<boolean> {
    if (fallbackChannel) {
      logger.debug({ userId }, '[WhatsAppNotificationChannel] Using fallback channel');
      return await fallbackChannel.send(userId, {
        title: payload.title,
        message: payload.message,
        type: payload.type,
        data: payload.data
      });
    }
    return false;
  }

  /**
   * Verificar si el canal está disponible para un usuario
   */
  async isAvailable(userId: string): Promise<boolean> {
    try {
      const patient = await this.prisma.paciente.findFirst({
        where: { cuentaId: userId },
        select: { telefono: true }
      });
      return !!patient?.telefono;
    } catch {
      return false;
    }
  }

  /**
   * Obtener nombre del canal
   */
  getChannelName(): string {
    return 'whatsapp';
  }
}
