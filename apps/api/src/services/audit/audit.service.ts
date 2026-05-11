import { PrismaClient, AuditLog, AuditAction, ResourceType } from '@prisma/client';
import { Request } from 'express';
import prisma from '../../config/database.js';

/**
 * Service for logging audit trails
 * Records all access and modifications to sensitive patient data
 * Adheres to Prisma schema for AuditLog model
 */
export class AuditService {
  /**
   * Creates an audit log entry
   */
  static async log(input: {
    userId: string;
    action: AuditAction;
    resourceType?: ResourceType | null;
    resourceId?: string | null;
    rolUsuario: string;
    ip?: string;
    userAgent?: string;
    metadata?: any;
  }): Promise<AuditLog | void> {
    try {
      return await prisma.auditLog.create({
        data: {
          userId: input.userId,
          action: input.action,
          resourceType: input.resourceType || null,
          resourceId: input.resourceId || null,
          rolUsuario: input.rolUsuario,
          ip: input.ip || null,
          userAgent: input.userAgent || null,
          metadata: input.metadata || {},
          timestamp: new Date()
        }
      });
    } catch (error) {
      console.error('[AuditService] Failed to create log entry:', error);
    }
  }

  /**
   * Helper for resource access logging
   */
  static async logResourceAccess(
    userId: string,
    rolUsuario: string,
    resourceType: ResourceType,
    resourceId: string,
    req?: Request
  ) {
    return await this.log({
      userId,
      rolUsuario,
      action: AuditAction.RESOURCE_ACCESS,
      resourceType,
      resourceId,
      ip: req?.ip,
      userAgent: req?.headers['user-agent'] as string
    });
  }

  /**
   * Helper for resource creation logging
   */
  static async logResourceCreation(
    userId: string,
    rolUsuario: string,
    resourceType: ResourceType,
    resourceId: string,
    req?: Request
  ) {
    return await this.log({
      userId,
      rolUsuario,
      action: AuditAction.RESOURCE_CREATE,
      resourceType,
      resourceId,
      ip: req?.ip,
      userAgent: req?.headers['user-agent'] as string
    });
  }

  /**
   * Helper for resource update logging
   */
  static async logResourceUpdate(
    userId: string,
    rolUsuario: string,
    resourceType: ResourceType,
    resourceId: string,
    req: Request | undefined,
    changes: any
  ) {
    return await this.log({
      userId,
      rolUsuario,
      action: AuditAction.RESOURCE_UPDATE,
      resourceType,
      resourceId,
      metadata: { changes },
      ip: req?.ip,
      userAgent: req?.headers['user-agent'] as string
    });
  }

  /**
   * Helper for resource deletion logging
   */
  static async logResourceDeletion(
    userId: string,
    rolUsuario: string,
    resourceType: ResourceType,
    resourceId: string,
    req?: Request
  ) {
    return await this.log({
      userId,
      rolUsuario,
      action: AuditAction.RESOURCE_DELETE,
      resourceType,
      resourceId,
      ip: req?.ip,
      userAgent: req?.headers['user-agent'] as string
    });
  }

  /**
   * Generic event logging
   */
  static async logEvent(
    userId: string,
    rolUsuario: string,
    action: AuditAction,
    resourceType?: ResourceType | null,
    resourceId?: string | null,
    metadata?: any,
    req?: Request
  ) {
    return await this.log({
      userId,
      rolUsuario,
      action,
      resourceType,
      resourceId,
      metadata,
      ip: req?.ip,
      userAgent: req?.headers['user-agent'] as string
    });
  }

  /**
   * Gets audit logs for a specific user
   */
  static async getUserLogs(userId: string, limit: number = 50, offset: number = 0): Promise<AuditLog[]> {
    return await prisma.auditLog.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset
    });
  }

  /**
   * Gets audit logs for a specific resource
   */
  static async getResourceLogs(resourceType: ResourceType, resourceId: string, limit: number = 50, offset: number = 0): Promise<AuditLog[]> {
    return await prisma.auditLog.findMany({
      where: {
        resourceType,
        resourceId
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset
    });
  }

  /**
   * Gets all audit logs with filters
   */
  static async getAllLogs(filters: any, limit: number = 50, offset: number = 0): Promise<AuditLog[]> {
    return await prisma.auditLog.findMany({
      where: {
        userId: filters.userId || undefined,
        resourceType: filters.resourceType || undefined,
        action: filters.action || undefined,
        timestamp: (filters.startDate || filters.endDate) ? {
          gte: filters.startDate,
          lte: filters.endDate
        } : undefined
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset
    });
  }

  /**
   * Gets audit logs by action
   */
  static async getLogsByAction(action: AuditAction, limit: number = 50, offset: number = 0): Promise<AuditLog[]> {
    return await prisma.auditLog.findMany({
      where: { action },
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset
    });
  }

  /**
   * Cleans old audit logs
   */
  static async cleanOldLogs(retentionDays: number): Promise<number> {
    const cutOffDate = new Date();
    cutOffDate.setDate(cutOffDate.getDate() - retentionDays);

    const result = await prisma.auditLog.deleteMany({
      where: {
        timestamp: {
          lt: cutOffDate
        }
      }
    });

    return result.count;
  }
}

export default AuditService;
