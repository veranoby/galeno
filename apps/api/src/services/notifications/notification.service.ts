import { PrismaClient } from '@prisma/client';

interface NotificationPayload {
  title: string;
  body: string;
  data?: any;
}

interface SendNotificationInput {
  userId: string;
  notification: NotificationPayload;
}

/**
 * Service for managing push notifications
 */
export class NotificationService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Sends a push notification to a user
   */
  async sendNotification(input: SendNotificationInput): Promise<boolean> {
    try {
      // Store notification in database
      await this.prisma.notificacion.create({
        data: {
          userId: input.userId, 
          titulo: input.notification.title, 
          cuerpo: input.notification.body, 
          datos: input.notification.data || {}, 
          leido: false, 
          createdAt: new Date()
        }
      });

      // Send push notification (placeholder)
      await this.sendPushNotification(input.userId,  input.notification);

      return true;
    } catch (error) {
      console.error('[NotificationService] Failed to send notification:', error);
      return false;
    }
  }

  /**
   * Sends a consent request notification to a patient
   */
  async sendConsentRequest(
    userId: string, 
    notification: NotificationPayload
  ): Promise<boolean> {
    return this.sendNotification({
      userId, 
      notification: {
        ...notification, 
        data: {
          ...notification.data, 
          type: 'consent_request'
        }
      }
    });
  }

  /**
   * Sends a consent response notification to a doctor
   */
  async sendConsentResponse(
    userId: string, 
    notification: NotificationPayload
  ): Promise<boolean> {
    return this.sendNotification({
      userId, 
      notification: {
        ...notification, 
        data: {
          ...notification.data, 
          type: 'consent_response'
        }
      }
    });
  }

  /**
   * Sends a push notification through the configured provider
   */
  private async sendPushNotification(
    userId: string, 
    notification: NotificationPayload
  ): Promise<void> {
    console.log(`[NotificationService] Would send push to user ${userId}:`,  notification);

    // Also emit via SSE if user is connected
    try {
      const { sseManager } = await import('../sse/sse-manager.js');
      await sseManager.sendToUser(userId,  {
        type: 'NOTIFICATION', 
        data: notification, 
        timestamp: Date.now()
      });
    } catch (error) {
      console.debug('[NotificationService] SSE not available for user:',  userId);
    }
  }
}

// Singleton instance
let notificationServiceInstance: NotificationService | null = null;

export const getNotificationService = (prisma: PrismaClient): NotificationService => {
  if (!notificationServiceInstance) {
    notificationServiceInstance = new NotificationService(prisma);
  }
  return notificationServiceInstance;
};

export default NotificationService;
