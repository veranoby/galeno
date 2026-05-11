// apps/api/src/services/notifications/NotificationOrchestrator.ts
/**
 * Orquestador de Canales de Notificación
 * Coordina todos los canales y mantiene backward compatibility
 */

import type { PrismaClient } from '@prisma/client';
import type { NotificationType, SendNotificationRequest, SendNotificationResponse } from '@galeno/shared-types';
import { NotificationMethod } from '@galeno/shared-types';
import type { INotificationRepository } from '../../repositories/interfaces/INotificationRepository.js';
import type { Notificacion } from '@prisma/client';

// Canales de notificación
import { PushNotificationChannel } from './channels/PushNotificationChannel.js';
import { SSENotificationChannel } from './channels/SSENotificationChannel.js';
import { WhatsAppNotificationChannel } from './channels/WhatsAppNotificationChannel.js';
import { ToastNotificationChannel } from './channels/ToastNotificationChannel.js';

// Interfaces exportadas
export interface NotificationPreferences {
  pushEnabled: boolean;
  sseEnabled: boolean;
  toastEnabled: boolean;
  whatsappEnabled: boolean;
  methods: NotificationMethod[];
}

export interface EnhancedNotificationPayload {
  title: string;
  message: string;
  type: NotificationType;
  method?: NotificationMethod;
  data?: Record<string, unknown>;
}

/**
 * NotificationOrchestrator - Coordinador de canales de notificación
 *
 * Mantiene backward compatibility con EnhancedNotificationService
 * mientras delega a canales especializados.
 */
export class NotificationOrchestrator {
  private pushChannel: PushNotificationChannel;
  private sseChannel: SSENotificationChannel;
  private whatsappChannel: WhatsAppNotificationChannel;
  private toastChannel: ToastNotificationChannel;

  constructor(
    private prisma: PrismaClient,
    private notificationRepo: INotificationRepository
  ) {
    this.pushChannel = new PushNotificationChannel(prisma);
    this.sseChannel = new SSENotificationChannel();
    this.whatsappChannel = new WhatsAppNotificationChannel(prisma, notificationRepo);
    this.toastChannel = new ToastNotificationChannel();
  }

  /**
   * Enviar notificación usando el método apropiado
   * Backward compatibility: sendNotification del EnhancedNotificationService
   */
  async sendNotification(input: SendNotificationRequest): Promise<SendNotificationResponse> {
    const { userId, title, message, type, method, data } = input;

    try {
      // Determinar qué métodos usar
      const methodsToUse = method ? [method] : [NotificationMethod.PUSH, NotificationMethod.SSE];

      const deliveredMethods: NotificationMethod[] = [];

      // Guardar notificación en base de datos
      const dbNotification = await this.notificationRepo.create({
        usuario: { connect: { id: userId } },
        titulo: title,
        cuerpo: message,
        tipo: type as any,
        leido: false,
        datos: (data || {}) as any
      });

      // Entregar por cada método especificado
      for (const deliveryMethod of methodsToUse) {
        const delivered = await this.deliverViaChannel(userId, {
          title,
          message,
          type,
          method: deliveryMethod,
          data: {
            ...data,
            notificationId: dbNotification.id
          }
        });

        if (delivered) {
          deliveredMethods.push(deliveryMethod);
        }
      }

      return {
        success: deliveredMethods.length > 0,
        notificationId: dbNotification.id,
        deliveredMethods
      };
    } catch (error) {
      console.error('[NotificationOrchestrator] Failed to send notification:', error);
      return {
        success: false,
        notificationId: '',
        deliveredMethods: [],
        errorMessage: error instanceof Error ? error.message : 'Unknown error occurred'
      } as SendNotificationResponse;
    }
  }

  /**
   * Entregar notificación vía un canal específico
   */
  private async deliverViaChannel(
    userId: string,
    payload: EnhancedNotificationPayload & { notificationId?: string }
  ): Promise<boolean> {
    switch (payload.method) {
      case NotificationMethod.PUSH:
        return await this.pushChannel.send(userId, payload);

      case NotificationMethod.SSE:
        return await this.sseChannel.send(userId, payload);

      case NotificationMethod.WHATSAPP:
        return await this.whatsappChannel.send(userId, payload, {
          send: (uid, p) => this.pushChannel.send(uid, p) // Fallback a push
        });

      case NotificationMethod.TOAST:
        return await this.toastChannel.send(userId, payload);

      default:
        // Si no se especifica método, intentar push y SSE
        const [pushResult, sseResult] = await Promise.all([
          this.pushChannel.send(userId, payload),
          this.sseChannel.send(userId, payload)
        ]);
        return pushResult || sseResult;
    }
  }

  /**
   * Obtener notificaciones de un usuario
   */
  async getUserNotifications(userId: string, limit: number = 50, offset: number = 0) {
    try {
      const notifications = await this.notificationRepo.findByUser(userId, {
        orderBy: { createdAt: 'desc' },
        limit,
        offset
      });

      return notifications.map(this.mapPrismaNotification);
    } catch (error) {
      console.error('[NotificationOrchestrator] Failed to get user notifications:', error);
      throw error;
    }
  }

  /**
   * Marcar notificación como leída
   */
  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    try {
      const result = await this.notificationRepo.markAsRead(notificationId, userId);
      return result !== null;
    } catch (error) {
      console.error('[NotificationOrchestrator] Failed to mark notification as read:', error);
      throw error;
    }
  }

  /**
   * Marcar todas las notificaciones como leídas
   */
  async markAllAsRead(userId: string): Promise<boolean> {
    try {
      const result = await this.notificationRepo.markAllAsRead(userId);
      return result.count > 0;
    } catch (error) {
      console.error('[NotificationOrchestrator] Failed to mark all notifications as read:', error);
      throw error;
    }
  }

  /**
   * Obtener conteo de notificaciones no leídas
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      return await this.notificationRepo.countUnreadByUser(userId);
    } catch (error) {
      console.error('[NotificationOrchestrator] Failed to get unread count:', error);
      throw error;
    }
  }

  /**
   * Obtener preferencias de notificación
   */
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    // Return default preferences (preferences not stored in DB currently)
    return {
      pushEnabled: true,
      sseEnabled: true,
      toastEnabled: true,
      whatsappEnabled: true,
      methods: [
        NotificationMethod.PUSH,
        NotificationMethod.SSE,
        NotificationMethod.TOAST,
        NotificationMethod.WHATSAPP
      ]
    };
  }

  /**
   * Actualizar preferencias de notificación
   */
  async updatePreferences(userId: string, preferences: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    // Preferences not stored in DB currently, just return the merged preferences
    return {
      pushEnabled: preferences.pushEnabled ?? true,
      sseEnabled: preferences.sseEnabled ?? true,
      toastEnabled: preferences.toastEnabled ?? true,
      whatsappEnabled: preferences.whatsappEnabled ?? true,
      methods: preferences.methods ?? [
        NotificationMethod.PUSH,
        NotificationMethod.SSE,
        NotificationMethod.TOAST,
        NotificationMethod.WHATSAPP
      ]
    };
  }

  /**
   * Mapea notificación de Prisma a interfaz
   */
  private mapPrismaNotification(notification: Notificacion) {
    return {
      id: notification.id,
      userId: notification.userId,
      title: notification.titulo,
      message: notification.cuerpo,
      type: notification.tipo as NotificationType,
      method: (notification.datos as any)?.method || NotificationMethod.WHATSAPP,
      read: notification.leido,
      createdAt: notification.createdAt,
      data: notification.datos as Record<string, unknown> || {}
    };
  }

  /**
   * Obtener canales disponibles para un usuario
   */
  async getAvailableChannels(userId: string): Promise<string[]> {
    const channels: string[] = [];

    // Push siempre disponible
    if (this.pushChannel.isAvailable()) {
      channels.push(this.pushChannel.getChannelName());
    }

    // SSE si usuario tiene conexión activa
    if (await this.sseChannel.isAvailable(userId)) {
      channels.push(this.sseChannel.getChannelName());
    }

    // WhatsApp si usuario tiene teléfono
    if (await this.whatsappChannel.isAvailable(userId)) {
      channels.push(this.whatsappChannel.getChannelName());
    }

    // Toast siempre disponible
    if (this.toastChannel.isAvailable()) {
      channels.push(this.toastChannel.getChannelName());
    }

    return channels;
  }
}

// Singleton instance
let orchestratorInstance: NotificationOrchestrator | null = null;

export function getNotificationOrchestrator(
  prismaClient?: PrismaClient,
  notificationRepo?: INotificationRepository
): NotificationOrchestrator {
  const prisma = prismaClient || require('../../config/database.js').default;
  const repo = notificationRepo || new (require('../../repositories').PrismaNotificationRepository)(prisma);

  if (!orchestratorInstance) {
    orchestratorInstance = new NotificationOrchestrator(prisma, repo);
  }
  return orchestratorInstance;
}

export default NotificationOrchestrator;
