import { PrismaClient, Notificacion } from '@prisma/client';
import { NotificationMethod } from '@galeno/shared-types';
import type { NotificationType, SendNotificationRequest, SendNotificationResponse } from '@galeno/shared-types';
import { getNotificationService } from './notification.service.js';
import { sseManager } from '../sse/sse-manager.js';
import { getWhatsAppProvider, type WhatsAppProvider } from '../whatsapp/index.js';
import { logger } from '../../utils/logger.js';
import prisma from '../../config/database.js';
import { INotificationRepository, PrismaNotificationRepository } from '../../repositories';

// Local type for notification preferences (not stored in DB currently)
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

export interface EnhancedSendNotificationInput {
  userId: string;
  payload: EnhancedNotificationPayload;
}

/**
 * Enhanced service for managing notifications with multiple delivery methods:
 * - Push: For when app is closed
 * - SSE: For when app is open
 * - Toast: For immediate UI feedback (handled on frontend)
 * - WhatsApp: For appointment reminders and critical notifications
 *
 * Refactorizado para usar Repository Pattern
 */
class EnhancedNotificationService {
  private whatsappProvider: WhatsAppProvider;

  constructor(
    private prisma: PrismaClient,
    private notificationRepo: INotificationRepository
  ) {
    this.whatsappProvider = getWhatsAppProvider();
  }

  /**
   * Sends a notification using the appropriate delivery method(s)
   */
  async sendNotification(input: SendNotificationRequest): Promise<SendNotificationResponse> {
    const { userId, title, message, type, method, data } = input;

    try {
      // Determine which methods to use for delivery
      const methodsToUse = method ? [method] : [NotificationMethod.PUSH, NotificationMethod.SSE];

      const deliveredMethods: NotificationMethod[] = [];

      // Store notification in database using Repository
      const dbNotification = await this.notificationRepo.create({
        userId,
        titulo: title,
        cuerpo: message,
        tipo: type as any, // Cast from shared-types NotificationType to Prisma TipoNotificacion
        leido: false,
        datos: (data || {}) as any, // Cast to Prisma JsonValue
      });

      // Deliver via each specified method
      for (const deliveryMethod of methodsToUse) {
        const delivered = await this.deliverViaMethod(userId, {
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
      console.error('[EnhancedNotificationService] Failed to send notification:', error);
      return {
        success: false,
        notificationId: '',
        deliveredMethods: [],
        errorMessage: error instanceof Error ? error.message : 'Unknown error occurred'
      } as SendNotificationResponse;
    }
  }

  /**
   * Delivers notification via the specified method
   */
  private async deliverViaMethod(userId: string, payload: EnhancedNotificationPayload): Promise<boolean> {
    switch (payload.method) {
      case NotificationMethod.PUSH:
        return this.sendPushNotification(userId, payload);
      case NotificationMethod.SSE:
        return this.sendSSENotification(userId, payload);
      case NotificationMethod.WHATSAPP:
        return this.sendWhatsAppNotification(userId, payload);
      case NotificationMethod.TOAST:
        // Toast notifications are handled on the frontend
        // We still store them in DB for history purposes
        return true;
      default:
        // If no specific method is requested, try both push and SSE
        const pushResult = await this.sendPushNotification(userId, { ...payload, method: NotificationMethod.PUSH });
        const sseResult = await this.sendSSENotification(userId, { ...payload, method: NotificationMethod.SSE });
        return pushResult || sseResult;
    }
  }

  /**
   * Sends a push notification to a user (when app is closed)
   */
  private async sendPushNotification(userId: string, payload: EnhancedNotificationPayload): Promise<boolean> {
    try {
      // Use the existing notification service for push delivery
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
      console.error('[EnhancedNotificationService] Failed to send push notification:', error);
      return false;
    }
  }

  /**
   * Sends an SSE notification to a user (when app is open)
   */
  private async sendSSENotification(userId: string, payload: EnhancedNotificationPayload): Promise<boolean> {
    try {
      // Emit via SSE if user is connected
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

      return true;
    } catch (error) {
      console.debug('[EnhancedNotificationService] SSE not available for user:', userId, error);
      return false;
    }
  }

  /**
   * Sends a WhatsApp notification to a user
   * Falls back to Push Notification if WhatsApp fails
   */
  private async sendWhatsAppNotification(userId: string, payload: EnhancedNotificationPayload): Promise<boolean> {
    try {
      // Get user's phone number from database
      const user = await this.prisma.cuenta.findUnique({
        where: { id: userId },
        select: {
          email: true,
          nombre: true,
          // Phone number would be in a related table or user profile
          // For now, we'll need to get it from patient or doctor profile
        }
      });

      if (!user) {
        logger.warn({ userId }, 'User not found for WhatsApp notification');
        return false;
      }

      // Try to get phone number from related patient record
      const patient = await this.prisma.paciente.findFirst({
        where: { cuentaId: userId },
        select: { telefono: true }
      });

      const phoneNumber = patient?.telefono;

      if (!phoneNumber) {
        logger.warn({ userId }, 'User has no phone number for WhatsApp notification');
        // Fallback to push notification
        return this.sendPushNotification(userId, payload);
      }

      // Send WhatsApp message
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
          'WhatsApp message failed, falling back to push notification'
        );
        // Fallback to push notification
        return this.sendPushNotification(userId, payload);
      }

      // Update notification with WhatsApp messageId for tracking
      if (payload.data?.notificationId || (this as any).currentNotificationId) {
        const notificationId = payload.data?.notificationId || (this as any).currentNotificationId;
        await this.notificationRepo.update(String(notificationId), {
          datos: {
            ...(payload.data || {}),
            whatsappSid: result.messageId,
            whatsappStatus: result.status
          } as any
        });
      }

      logger.info(
        { messageId: result.messageId, userId, to: phoneNumber },
        'WhatsApp notification sent successfully'
      );

      return true;
    } catch (error) {
      logger.error({ error }, 'Failed to send WhatsApp notification');
      // Fallback to push notification on error
      return this.sendPushNotification(userId, payload);
    }
  }

  /**
   * Gets notifications for a user
   */
  async getUserNotifications(userId: string, limit: number = 50, offset: number = 0) {
    try {
      const notifications = await this.notificationRepo.findByUser(userId, {
        orderBy: { createdAt: 'desc' as const },
        limit,
        offset
      });

      return notifications.map(this.mapPrismaNotification);
    } catch (error) {
      console.error('[EnhancedNotificationService] Failed to get user notifications:', error);
      throw error;
    }
  }

  /**
   * Marks a notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    try {
      const result = await this.notificationRepo.markAsRead(notificationId, userId);
      return result !== null;
    } catch (error) {
      console.error('[EnhancedNotificationService] Failed to mark notification as read:', error);
      throw error;
    }
  }

  /**
   * Marks all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<boolean> {
    try {
      const result = await this.notificationRepo.markAllAsRead(userId);
      return result.count > 0;
    } catch (error) {
      console.error('[EnhancedNotificationService] Failed to mark all notifications as read:', error);
      throw error;
    }
  }

  /**
   * Gets unread notification count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      return await this.notificationRepo.countUnreadByUser(userId);
    } catch (error) {
      console.error('[EnhancedNotificationService] Failed to get unread count:', error);
      throw error;
    }
  }

  /**
   * Gets notification preferences for a user
   * Note: Preferences are not currently stored in DB, returns defaults
   */
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    try {
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
    } catch (error) {
      console.error('[EnhancedNotificationService] Failed to get notification preferences:', error);
      // Return default preferences if there's an error
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
  }

  /**
   * Updates notification preferences for a user
   * Note: Preferences are not currently stored in DB, this is a no-op
   */
  async updatePreferences(userId: string, preferences: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    try {
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
    } catch (error) {
      console.error('[EnhancedNotificationService] Failed to update notification preferences:', error);
      throw error;
    }
  }

  /**
   * Maps Prisma notification to our interface
   */
  private mapPrismaNotification(notification: Notificacion) {
    return {
      id: notification.id,
      userId: notification.userId,
      title: notification.titulo,
      message: notification.cuerpo,
      type: notification.tipo as NotificationType,
      method: (notification.datos as any)?.method || NotificationMethod.WHATSAPP, // Default to WhatsApp for new notifications
      read: notification.leido,
      createdAt: notification.createdAt,
      data: notification.datos as Record<string, unknown> || {}
    };
  }
}

// Singleton instance
let enhancedNotificationServiceInstance: EnhancedNotificationService | null = null;

export const getEnhancedNotificationService = (
  prismaClient?: PrismaClient,
  notificationRepo?: INotificationRepository
): EnhancedNotificationService => {
  const client = prismaClient || prisma;

  // Si se proporciona un repositorio, úsalo; si no, crea uno nuevo
  const repo = notificationRepo || new PrismaNotificationRepository(client);

  if (!enhancedNotificationServiceInstance) {
    enhancedNotificationServiceInstance = new EnhancedNotificationService(client, repo);
  }
  return enhancedNotificationServiceInstance;
};

export default EnhancedNotificationService;