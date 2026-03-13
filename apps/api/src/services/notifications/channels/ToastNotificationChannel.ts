// apps/api/src/services/notifications/channels/ToastNotificationChannel.ts
/**
 * Canal para Toast Notifications
 * Las notificaciones toast se manejan en el frontend
 * Este canal solo mantiene el registro en la base de datos
 */

import type { NotificationType } from '@galeno/shared-types';
import { NotificationMethod } from '@galeno/shared-types';

export interface ToastNotificationPayload {
  title: string;
  message: string;
  type: NotificationType;
  data?: Record<string, unknown>;
}

export class ToastNotificationChannel {
  /**
   * Las notificaciones toast se manejan en el frontend
   * Siempre retornamos true porque el registro ya se creó en la BD
   */
  async send(_userId: string, _payload: ToastNotificationPayload): Promise<boolean> {
    // Toast notifications are handled on the frontend
    // We still store them in DB for history purposes
    return true;
  }

  /**
   * El canal toast siempre está disponible (se maneja en el cliente)
   */
  isAvailable(): boolean {
    return true;
  }

  /**
   * Obtener nombre del canal
   */
  getChannelName(): string {
    return 'toast';
  }

  /**
   * Método para obtener datos de toast para el frontend
   */
  formatForFrontend(payload: ToastNotificationPayload, notificationId: string) {
    return {
      id: notificationId,
      title: payload.title,
      message: payload.message,
      type: payload.type,
      method: NotificationMethod.TOAST,
      read: false,
      createdAt: new Date(),
      data: payload.data || {}
    };
  }
}
