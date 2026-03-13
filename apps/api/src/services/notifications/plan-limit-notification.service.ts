import { Plan, PlanLimitNotificationType, ResourceLimitType } from '@prisma/client';
import { logger } from '../../utils/logger.js';
import prisma from '../../config/database.js';
import { PlanValidationService } from '../plan/validation.js';
import { getPlanConfig } from '../plan/config.js';

// Notification interface
export interface PlanLimitNotification {
  id: string;
  userId: string;
  accountId: string;
  notificationType: PlanLimitNotificationType;
  resourceType: ResourceLimitType;
  currentValue: number;
  limitValue: number;
  percentageUsed: number;
  acknowledged: boolean;
  createdAt: Date;
  acknowledgedAt?: Date;
}

/**
 * Service for managing plan limit notifications
 */
export class PlanLimitNotificationService {
  private static readonly WARNING_THRESHOLD = 80;  // Percentage at which to show warning
  private static readonly ALERT_THRESHOLD = 95;    // Percentage at which to show alert

  /**
   * Check if user is approaching or exceeding plan limits and create notifications
   */
  static async checkAndNotifyLimits(userId: string): Promise<PlanLimitNotification[]> {
    try {
      const notifications: PlanLimitNotification[] = [];

      // Get user's account information
      const user = await prisma.cuenta.findUnique({
        where: { id: userId },
        select: {
          id: true,
          rol: true,
          plan: true,
          maxDoctores: true,
          maxAsistentes: true
        }
      });

      if (!user) {
        throw new Error('User not found');
      }

      const accountId = user.id;
      const plan = user.plan || Plan.FREE;

      // Check doctors limit
      const doctorsNotification = await this.checkDoctorsLimit(accountId, userId, plan);
      if (doctorsNotification) {
        notifications.push(doctorsNotification);
      }

      // Check assistants limit
      const assistantsNotification = await this.checkAssistantsLimit(accountId, userId, plan);
      if (assistantsNotification) {
        notifications.push(assistantsNotification);
      }

      // Check storage limit
      const storageNotification = await this.checkStorageLimit(accountId, userId, plan);
      if (storageNotification) {
        notifications.push(storageNotification);
      }

      return notifications;
    } catch (error) {
      logger.error({ error,  userId },  'Error checking plan limit notifications');
      throw error;
    }
  }

  /**
   * Check doctors limit and create notification if needed
   */
  private static async checkDoctorsLimit(accountId: string, userId: string, plan: Plan): Promise<PlanLimitNotification | null> {
    // Count current doctors - simplified: each account is one doctor
    // In a multi-doctor setup, you would count associated doctor accounts
    const currentDoctorsCount = 1; // The account itself represents 1 doctor

    // Get plan configuration
    const config = getPlanConfig(plan);
    const maxDoctors = config.limites.maxDoctores;

    const percentageUsed = (currentDoctorsCount / maxDoctors) * 100;

    // Determine notification type based on threshold
    let notificationType: PlanLimitNotificationType | null = null;
    
    if (percentageUsed >= this.ALERT_THRESHOLD && percentageUsed < 100) {
      notificationType = PlanLimitNotificationType.ALERT_AT_LIMIT;
    } else if (percentageUsed >= 100) {
      notificationType = PlanLimitNotificationType.BLOCK_EXCEED_LIMIT;
    } else if (percentageUsed >= this.WARNING_THRESHOLD) {
      notificationType = PlanLimitNotificationType.WARNING_NEAR_LIMIT;
    }

    if (notificationType) {
      return this.createNotification({
        userId, 
        accountId, 
        notificationType, 
        resourceType: ResourceLimitType.doctors, 
        currentValue: currentDoctorsCount, 
        limitValue: maxDoctors, 
        percentageUsed
      });
    }

    return null;
  }

  /**
   * Check assistants limit and create notification if needed
   */
  private static async checkAssistantsLimit(accountId: string, userId: string, plan: Plan): Promise<PlanLimitNotification | null> {
    // Count current assistants - simplified: not implemented in current schema
    // Assistants would be counted from CuentaVinculada or similar model
    const currentAssistantsCount = 0;

    // Get plan configuration
    const config = getPlanConfig(plan);
    const maxAssistants = config.limites.maxAsistentes;

    const percentageUsed = (currentAssistantsCount / maxAssistants) * 100;

    // Determine notification type based on threshold
    let notificationType: PlanLimitNotificationType | null = null;
    
    if (percentageUsed >= this.ALERT_THRESHOLD && percentageUsed < 100) {
      notificationType = PlanLimitNotificationType.ALERT_AT_LIMIT;
    } else if (percentageUsed >= 100) {
      notificationType = PlanLimitNotificationType.BLOCK_EXCEED_LIMIT;
    } else if (percentageUsed >= this.WARNING_THRESHOLD) {
      notificationType = PlanLimitNotificationType.WARNING_NEAR_LIMIT;
    }

    if (notificationType) {
      return this.createNotification({
        userId, 
        accountId, 
        notificationType, 
        resourceType: ResourceLimitType.assistants, 
        currentValue: currentAssistantsCount, 
        limitValue: maxAssistants, 
        percentageUsed
      });
    }

    return null;
  }

  /**
   * Check storage limit and create notification if needed
   */
  private static async checkStorageLimit(accountId: string, userId: string, plan: Plan): Promise<PlanLimitNotification | null> {
    // Calculate current storage usage - simplified: only counting documents with archivoSize
    const documentos = await prisma.documento.findMany({
      where: {
        archivoSize: { not: null }
      },
      select: {
        archivoSize: true
      },
      take: 1000 // Limit for performance
    });

    const currentUsageBytes = documentos.reduce((sum, doc) => sum + (doc.archivoSize || 0), 0);
    const currentUsageMB = currentUsageBytes / (1024 * 1024); // Convert to MB

    // Get plan configuration
    const config = getPlanConfig(plan);
    const maxStorageMB = config.limites.maxAlmacenamientoMB;

    const percentageUsed = (currentUsageMB / maxStorageMB) * 100;

    // Determine notification type based on threshold
    let notificationType: PlanLimitNotificationType | null = null;
    
    if (percentageUsed >= this.ALERT_THRESHOLD && percentageUsed < 100) {
      notificationType = PlanLimitNotificationType.ALERT_AT_LIMIT;
    } else if (percentageUsed >= 100) {
      notificationType = PlanLimitNotificationType.BLOCK_EXCEED_LIMIT;
    } else if (percentageUsed >= this.WARNING_THRESHOLD) {
      notificationType = PlanLimitNotificationType.WARNING_NEAR_LIMIT;
    }

    if (notificationType) {
      return this.createNotification({
        userId, 
        accountId, 
        notificationType, 
        resourceType: ResourceLimitType.storage, 
        currentValue: parseFloat(currentUsageMB.toFixed(2)),
        limitValue: maxStorageMB,
        percentageUsed
      });
    }

    return null;
  }

  /**
   * Create a notification in the database
   */
  private static async createNotification(notificationData: {
    userId: string;
    accountId: string;
    notificationType: PlanLimitNotificationType;
    resourceType: ResourceLimitType;
    currentValue: number;
    limitValue: number;
    percentageUsed: number;
  }): Promise<PlanLimitNotification> {
    // Check if a similar notification already exists and hasn't been acknowledged
    const existingNotification = await prisma.planLimitNotification.findFirst({
      where: {
        userId: notificationData.userId, 
        resourceType: notificationData.resourceType, 
        acknowledged: false
      }, 
      orderBy: { createdAt: 'desc' }
    });

    // If a similar notification exists and is recent (less than 24 hours), don't create a new one
    if (existingNotification) {
      const timeDiff = Math.abs(new Date().getTime() - existingNotification.createdAt.getTime());
      const hoursDiff = Math.floor(timeDiff / (1000 * 60 * 60));
      
      if (hoursDiff < 24) {
        return existingNotification as PlanLimitNotification;
      }
    }

    // Create new notification
    const notification = await prisma.planLimitNotification.create({
      data: {
        userId: notificationData.userId, 
        accountId: notificationData.accountId, 
        notificationType: notificationData.notificationType, 
        resourceType: notificationData.resourceType, 
        currentValue: notificationData.currentValue, 
        limitValue: notificationData.limitValue, 
        percentageUsed: notificationData.percentageUsed, 
        acknowledged: false
      }
    });

    logger.info({
      event: 'plan_limit_notification_created', 
      userId: notificationData.userId, 
      notificationType: notificationData.notificationType, 
      resourceType: notificationData.resourceType, 
      percentageUsed: notificationData.percentageUsed
    });

    return notification as PlanLimitNotification;
  }

  /**
   * Get notifications for a user
   */
  static async getUserNotifications(userId: string,  acknowledged: boolean = false): Promise<PlanLimitNotification[]> {
    try {
      const notifications = await prisma.planLimitNotification.findMany({
        where: {
          userId, 
          acknowledged
        }, 
        orderBy: { createdAt: 'desc' }
      });

      return notifications as PlanLimitNotification[];
    } catch (error) {
      logger.error({ error,  userId },  'Error fetching user notifications');
      throw error;
    }
  }

  /**
   * Acknowledge a notification
   */
  static async acknowledgeNotification(notificationId: string,  userId: string): Promise<boolean> {
    try {
      const result = await prisma.planLimitNotification.updateMany({
        where: {
          id: notificationId, 
          userId
        }, 
        data: {
          acknowledged: true, 
          acknowledgedAt: new Date()
        }
      });

      return result.count > 0;
    } catch (error) {
      logger.error({ error,  notificationId,  userId },  'Error acknowledging notification');
      throw error;
    }
  }

  /**
   * Acknowledge all notifications for a user and resource type
   */
  static async acknowledgeAllForResource(userId: string,  resourceType: ResourceLimitType): Promise<boolean> {
    try {
      const result = await prisma.planLimitNotification.updateMany({
        where: {
          userId, 
          resourceType, 
          acknowledged: false
        }, 
        data: {
          acknowledged: true, 
          acknowledgedAt: new Date()
        }
      });

      return result.count > 0;
    } catch (error) {
      logger.error({ error,  userId,  resourceType },  'Error acknowledging all notifications for resource');
      throw error;
    }
  }

  /**
   * Check if a user is near or at their plan limits
   */
  static async isNearLimit(userId: string): Promise<boolean> {
    try {
      const notifications = await this.checkAndNotifyLimits(userId);
      return notifications.length > 0;
    } catch (error) {
      logger.error({ error,  userId },  'Error checking if user is near limit');
      return false;
    }
  }
}