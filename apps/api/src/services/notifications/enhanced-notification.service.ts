// apps/api/src/services/notifications/enhanced-notification.service.ts
/**
 * Enhanced Notification Service - Refactorizado con Canales
 *
 * Mantiene backward compatibility mientras usa el NotificationOrchestrator
 * que coordina los canales especializados.
 *
 * Canales disponibles:
 * - PushNotificationChannel: Push notifications
 * - SSENotificationChannel: Server-Sent Events
 * - WhatsAppNotificationChannel: Mensajes WhatsApp
 * - ToastNotificationChannel: Notificaciones UI
 */

import type { PrismaClient } from '@prisma/client';
import type { NotificationType, SendNotificationRequest, SendNotificationResponse } from '@galeno/shared-types';
import type { INotificationRepository } from '../../repositories/interfaces/INotificationRepository.js';
import {
  NotificationOrchestrator,
  NotificationPreferences,
  EnhancedNotificationPayload,
  getNotificationOrchestrator
} from './NotificationOrchestrator.js';

// Re-export types para backward compatibility
export type { NotificationPreferences, EnhancedNotificationPayload };
export { NotificationOrchestrator, getNotificationOrchestrator };

// EnhancedNotificationService alias para backward compatibility
// Ahora usa internamente el NotificationOrchestrator
class EnhancedNotificationService {
  private orchestrator: NotificationOrchestrator;

  constructor(
    prisma: PrismaClient,
    notificationRepo: INotificationRepository
  ) {
    this.orchestrator = new NotificationOrchestrator(prisma, notificationRepo);
  }

  /**
   * Enviar notificación
   */
  async sendNotification(input: SendNotificationRequest): Promise<SendNotificationResponse> {
    return await this.orchestrator.sendNotification(input);
  }

  /**
   * Obtener notificaciones de usuario
   */
  async getUserNotifications(userId: string, limit?: number, offset?: number) {
    return await this.orchestrator.getUserNotifications(userId, limit, offset);
  }

  /**
   * Marcar como leída
   */
  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    return await this.orchestrator.markAsRead(notificationId, userId);
  }

  /**
   * Marcar todas como leídas
   */
  async markAllAsRead(userId: string): Promise<boolean> {
    return await this.orchestrator.markAllAsRead(userId);
  }

  /**
   * Obtener conteo de no leídas
   */
  async getUnreadCount(userId: string): Promise<number> {
    return await this.orchestrator.getUnreadCount(userId);
  }

  /**
   * Obtener preferencias
   */
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    return await this.orchestrator.getPreferences(userId);
  }

  /**
   * Actualizar preferencias
   */
  async updatePreferences(userId: string, preferences: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    return await this.orchestrator.updatePreferences(userId, preferences);
  }

  /**
   * Obtener canales disponibles
   */
  async getAvailableChannels(userId: string): Promise<string[]> {
    return await this.orchestrator.getAvailableChannels(userId);
  }
}

// Singleton instance
let enhancedNotificationServiceInstance: EnhancedNotificationService | null = null;

export const getEnhancedNotificationService = (
  prismaClient?: PrismaClient,
  notificationRepo?: INotificationRepository
): EnhancedNotificationService => {
  // Usar el singleton del orchestrator si existe
  if (!enhancedNotificationServiceInstance) {
    const prisma = prismaClient || require('../../config/database.js').default;
    const repo = notificationRepo || new (require('../../repositories').PrismaNotificationRepository)(prisma);
    enhancedNotificationServiceInstance = new EnhancedNotificationService(prisma, repo);
  }
  return enhancedNotificationServiceInstance;
};

export default EnhancedNotificationService;
