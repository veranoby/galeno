// apps/api/src/services/notifications/channels/PushNotificationChannel.ts
/**
 * Canal para Push Notifications
 * Envía notificaciones cuando la app está cerrada
 */

import type { NotificationType } from '@galeno/shared-types';
import { NotificationMethod } from '@galeno/shared-types';
import { PrismaClient } from '@prisma/client';
import { getNotificationService } from '../notification.service.js';
import { logger } from '../../../utils/logger.js';

export interface PushNotificationPayload {
  title: string;
  message: string;
  type: NotificationType;
  data?: Record<string, unknown>;
}

export class PushNotificationChannel {
  constructor(private prisma: PrismaClient) {}

  /**
   * Enviar notificación push a un usuario
   */
  async send(userId: string, payload: PushNotificationPayload): Promise<boolean> {
    try {
      const notificationService = getNotificationService(this.prisma);

      const result = await notificationService.sendNotification({
        userId,
        notification: {
          title: payload.title,
          body: payload.message,
          data: {
            ...payload.data,
            type: payload.type,
            method: NotificationMethod.PUSH
          }
        }
      });

      return result;
    } catch (error) {
      logger.error({ error, userId }, '[PushNotificationChannel] Failed to send push notification');
      return false;
    }
  }

  /**
   * Verificar si el canal está disponible
   */
  isAvailable(): boolean {
    // El canal push siempre está disponible (usa Firebase/OneSignal)
    return true;
  }

  /**
   * Obtener nombre del canal
   */
  getChannelName(): string {
    return 'push';
  }
}
