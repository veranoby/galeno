import { Plan } from '@prisma/client';
import { logger } from '../../utils/logger';
import prisma from '../../config/database';
import AuditService from '../audit/audit.service';
import { getPlanConfig } from './config';

// Interface for plan change history
export interface PlanChangeHistory {
  id: string;
  userId: string;
  accountId: string;
  previousPlan: Plan;
  newPlan: Plan;
  reason?: string;
  createdAt: Date;
  metadata?: Record<string, any>;
}

/**
 * Service for managing plan change history
 * Uses the existing audit system to track plan changes
 */
export class PlanChangeHistoryService {
  /**
   * Log a plan change event in the audit system
   */
  static async logPlanChange(
    userId: string, 
    accountId: string, 
    previousPlan: Plan, 
    newPlan: Plan, 
    reason?: string, 
    metadata?: Record<string,  any>, 
    req?: any
  ): Promise<void> {
    try {
      // Log the plan change in the audit system
      await AuditService.log({
        userId,
        action: 'PLAN_CHANGE',
        resourceType: 'PLAN',
        resourceId: accountId,
        rolUsuario: 'DOCTOR',
        metadata: {
          previousPlan,
          newPlan,
          reason,
          ...metadata
        }
      });

      logger.info({
        event: 'plan_change_logged', 
        userId, 
        accountId, 
        previousPlan, 
        newPlan, 
        reason
      });
    } catch (error) {
      logger.error({ error,  userId,  accountId,  previousPlan,  newPlan },  'Error logging plan change');
      // Don't throw error as audit logging shouldn't break the main flow
    }
  }

  /**
   * Get plan change history for an account
   */
  static async getPlanChangeHistory(accountId: string,  limit: number = 50,  offset: number = 0): Promise<PlanChangeHistory[]> {
    try {
      // Get audit logs for plan changes related to this account
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          action: 'PLAN_CHANGE', 
          resourceId: accountId
        }, 
        orderBy: { timestamp: 'desc' }, 
        take: limit, 
        skip: offset, 
      });

      // Transform audit logs to plan change history
      const history: PlanChangeHistory[] = auditLogs.map(log => ({
        id: log.id,
        userId: log.userId,
        accountId: log.resourceId || accountId,
        previousPlan: (log.metadata as any)?.previousPlan as Plan || Plan.FREE,
        newPlan: (log.metadata as any)?.newPlan as Plan || Plan.FREE,
        reason: (log.metadata as any)?.reason as string | undefined,
        createdAt: log.timestamp,
        metadata: log.metadata as Record<string, unknown>
      }));

      return history;
    } catch (error) {
      logger.error({ error,  accountId },  'Error fetching plan change history');
      throw error;
    }
  }

  /**
   * Get plan change history for a specific user
   */
  static async getUserPlanChangeHistory(userId: string,  limit: number = 50,  offset: number = 0): Promise<PlanChangeHistory[]> {
    try {
      // Get audit logs for plan changes initiated by this user
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          userId, 
          action: 'PLAN_CHANGE'
        }, 
        orderBy: { timestamp: 'desc' }, 
        take: limit, 
        skip: offset, 
      });

      // Transform audit logs to plan change history
      const history: PlanChangeHistory[] = auditLogs.map(log => ({
        id: log.id,
        userId: log.userId,
        accountId: log.resourceId || '',
        previousPlan: (log.metadata as any)?.previousPlan as Plan || Plan.FREE,
        newPlan: (log.metadata as any)?.newPlan as Plan || Plan.FREE,
        reason: (log.metadata as any)?.reason as string | undefined,
        createdAt: log.timestamp,
        metadata: log.metadata as Record<string, unknown>
      }));

      return history;
    } catch (error) {
      logger.error({ error,  userId },  'Error fetching user plan change history');
      throw error;
    }
  }

  /**
   * Get plan change statistics for an account
   */
  static async getPlanChangeStats(accountId: string): Promise<{
    totalChanges: number;
    currentPlan: Plan;
    changeFrequency: {
      daily: number;
      weekly: number;
      monthly: number;
    };
  }> {
    try {
      // Get current plan from the account
      const account = await prisma.cuenta.findUnique({
        where: { id: accountId }, 
        select: { plan: true }
      });

      // Get total plan changes in the last year
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const totalChanges = await prisma.auditLog.count({
        where: {
          resourceId: accountId, 
          action: 'PLAN_CHANGE', 
          timestamp: {
            gte: oneYearAgo
          }
        }
      });

      // Calculate frequency stats
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const changesIn30Days = await prisma.auditLog.count({
        where: {
          resourceId: accountId, 
          action: 'PLAN_CHANGE', 
          timestamp: {
            gte: thirtyDaysAgo
          }
        }
      });

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const changesIn7Days = await prisma.auditLog.count({
        where: {
          resourceId: accountId, 
          action: 'PLAN_CHANGE', 
          timestamp: {
            gte: sevenDaysAgo
          }
        }
      });

      const changesIn24Hours = await prisma.auditLog.count({
        where: {
          resourceId: accountId, 
          action: 'PLAN_CHANGE', 
          timestamp: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      });

      return {
        totalChanges,
        currentPlan: account?.plan || Plan.FREE,
        changeFrequency: {
          daily: changesIn24Hours,
          weekly: changesIn7Days,
          monthly: changesIn30Days
        }
      };
    } catch (error) {
      logger.error({ error,  accountId },  'Error fetching plan change stats');
      throw error;
    }
  }
}