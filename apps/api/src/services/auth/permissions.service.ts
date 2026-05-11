import { Plan } from '@prisma/client';
import { logger } from '../../utils/logger.js';
import prisma from '../../config/database.js';

// Define permission types
export enum Permission {
  // Patient management
  PATIENT_READ = 'patient:read',
  PATIENT_CREATE = 'patient:create',
  PATIENT_UPDATE = 'patient:update',
  PATIENT_DELETE = 'patient:delete',
  
  // Consultation management
  CONSULTATION_READ = 'consultation:read',
  CONSULTATION_CREATE = 'consultation:create',
  CONSULTATION_UPDATE = 'consultation:update',
  CONSULTATION_DELETE = 'consultation:delete',
  
  // Document management
  DOCUMENT_READ = 'document:read',
  DOCUMENT_CREATE = 'document:create',
  DOCUMENT_UPDATE = 'document:update',
  DOCUMENT_DELETE = 'document:delete',
  
  // User management
  USER_READ = 'user:read',
  USER_CREATE = 'user:create',
  USER_UPDATE = 'user:update',
  USER_DELETE = 'user:delete',
  
  // Billing management
  BILLING_READ = 'billing:read',
  BILLING_CREATE = 'billing:create',
  BILLING_UPDATE = 'billing:update',
  BILLING_DELETE = 'billing:delete',
  
  // Plan management
  PLAN_READ = 'plan:read',
  PLAN_CHANGE = 'plan:change',
  
  // Admin functions
  ADMIN_ACCESS = 'admin:access',
  SYSTEM_CONFIG = 'system:config',
}

// Define role permissions
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  ADMIN: Object.values(Permission),
  DOCTOR: [
    Permission.PATIENT_READ,
    Permission.PATIENT_CREATE,
    Permission.PATIENT_UPDATE,
    Permission.CONSULTATION_READ,
    Permission.CONSULTATION_CREATE,
    Permission.CONSULTATION_UPDATE,
    Permission.DOCUMENT_READ,
    Permission.DOCUMENT_CREATE,
    Permission.DOCUMENT_UPDATE,
    Permission.USER_READ,
    Permission.USER_CREATE,
    Permission.USER_UPDATE,
    Permission.PLAN_READ,
    Permission.PLAN_CHANGE,
  ],
  ASISTENTE: [
    Permission.PATIENT_READ,
    Permission.CONSULTATION_READ,
    Permission.DOCUMENT_READ,
    Permission.DOCUMENT_CREATE,
  ],
  ENFERMERA: [
    Permission.PATIENT_READ,
    Permission.CONSULTATION_READ,
    Permission.DOCUMENT_READ,
    Permission.DOCUMENT_CREATE,
  ],
};

// Define plan-based permissions
export const PLAN_PERMISSIONS: Record<Plan, Permission[]> = {
  FREE: [
    Permission.PATIENT_READ,
    Permission.PATIENT_CREATE,
    Permission.CONSULTATION_READ,
    Permission.DOCUMENT_READ,
  ],
  PREMIUM: [
    Permission.PATIENT_READ,
    Permission.PATIENT_CREATE,
    Permission.PATIENT_UPDATE,
    Permission.CONSULTATION_READ,
    Permission.CONSULTATION_CREATE,
    Permission.CONSULTATION_UPDATE,
    Permission.DOCUMENT_READ,
    Permission.DOCUMENT_CREATE,
    Permission.DOCUMENT_UPDATE,
    Permission.USER_READ,
    Permission.USER_CREATE,
  ],
  CLINICA_SME: Object.values(Permission),
};

export interface UserWithPermissions {
  id: string;
  email: string;
  rol: string;
  plan: Plan;
  cuentaId?: string;
  permissions: Permission[];
}

/**
 * Get user permissions based on role and plan
 */
export async function getUserPermissions(userId: string): Promise<UserWithPermissions> {
  try {
    // Get user with account information
    const user = await prisma.cuenta.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        rol: true,
        plan: true
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    const plan = user.plan || Plan.FREE;

    // Get role-based permissions
    const rolePermissions = ROLE_PERMISSIONS[user.rol] || [];

    // Get plan-based permissions
    const planPermissions = PLAN_PERMISSIONS[plan] || PLAN_PERMISSIONS.FREE;

    // Combine permissions (role permissions take precedence over plan permissions)
    const combinedPermissions = [...new Set([...rolePermissions,  ...planPermissions])];

    return {
      id: user.id,
      email: user.email,
      rol: user.rol,
      plan,
      cuentaId: user.id,
      permissions: combinedPermissions
    };
  } catch (error) {
    logger.error({ error,  userId },  'Error getting user permissions');
    throw error;
  }
}

/**
 * Check if user has a specific permission
 */
export async function hasPermission(userId: string,  permission: Permission): Promise<boolean> {
  try {
    const userPermissions = await getUserPermissions(userId);
    return userPermissions.permissions.includes(permission);
  } catch (error) {
    logger.error({ error,  userId,  permission },  'Error checking user permission');
    return false;
  }
}

/**
 * Check if user has any of the specified permissions
 */
export async function hasAnyPermission(userId: string,  permissions: Permission[]): Promise<boolean> {
  try {
    const userPermissions = await getUserPermissions(userId);
    return permissions.some(permission => userPermissions.permissions.includes(permission));
  } catch (error) {
    logger.error({ error,  userId,  permissions },  'Error checking user permissions');
    return false;
  }
}

/**
 * Check if user has all of the specified permissions
 */
export async function hasAllPermissions(userId: string,  permissions: Permission[]): Promise<boolean> {
  try {
    const userPermissions = await getUserPermissions(userId);
    return permissions.every(permission => userPermissions.permissions.includes(permission));
  } catch (error) {
    logger.error({ error,  userId,  permissions },  'Error checking user permissions');
    return false;
  }
}

/**
 * Get all permissions for a user
 */
export async function getAllPermissions(userId: string): Promise<Permission[]> {
  try {
    const userPermissions = await getUserPermissions(userId);
    return userPermissions.permissions;
  } catch (error) {
    logger.error({ error,  userId },  'Error getting all user permissions');
    return [];
  }
}

/**
 * Permission-based authorization service
 */
export class PermissionService {
  static async checkPermission(userId: string,  permission: Permission): Promise<boolean> {
    return hasPermission(userId,  permission);
  }

  static async checkAnyPermission(userId: string,  permissions: Permission[]): Promise<boolean> {
    return hasAnyPermission(userId,  permissions);
  }

  static async checkAllPermissions(userId: string,  permissions: Permission[]): Promise<boolean> {
    return hasAllPermissions(userId,  permissions);
  }

  static async getUserPermissions(userId: string): Promise<UserWithPermissions> {
    return getUserPermissions(userId);
  }

  static async getAllPermissions(userId: string): Promise<Permission[]> {
    return getAllPermissions(userId);
  }
}