// apps/api/src/services/notifications/channels/SSENotificationChannel.ts
/**
 * Canal para Server-Sent Events (SSE)
 * Envía notificaciones cuando la app está abierta
 */

import type { NotificationType } from '@galeno/shared-types';
import { NotificationMethod } from '@galeno/shared-types';
import { sseManager } from '../../sse/sse-manager.js';
import { logger } from '../../../utils/logger.js';

export interface SSENotificationPayload {
  title: string;
  message: string;
  type: NotificationType;
  data?: Record<string, unknown>;
}

export class SSENotificationChannel {
  /**
   * Enviar notificación SSE a un usuario
   */
  async send(userId: string, payload: SSENotificationPayload): Promise<boolean> {
    try {
      // Emitir vía SSE si el usuario está conectado
      await sseManager.sendToUser(userId, {
        type: 'NOTIFICATION',
        data: {
          id: `sse-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          userId,
          title: payload.title,
          message: payload.message,
          type: payload.type,
          method: NotificationMethod.SSE,
          read: false,
          createdAt: new Date(),
          data: payload.data
        },
        timestamp: Date.now()
      });

      logger.debug({ userId }, '[SSENotificationChannel] SSE notification sent');
      return true;
    } catch (error) {
      logger.debug({ userId, error }, '[SSENotificationChannel] SSE not available for user');
      return false;
    }
  }

  /**
   * Verificar si el canal está disponible para un usuario
   */
  async isAvailable(userId: string): Promise<boolean> {
    try {
      // Verificar si el usuario tiene conexiones SSE activas
      return sseManager.hasUserConnection(userId);
    } catch {
      return false;
    }
  }

  /**
   * Obtener nombre del canal
   */
  getChannelName(): string {
    return 'sse';
  }
}
