import { Request, Response, NextFunction } from 'express';
import { EnhancedPermissionService } from '../services/auth/enhanced-permissions.service.js';
import { logger } from '../utils/logger.js';

/**
 * Middleware to enforce resource-level access control
 * Checks if the authenticated user has permission to access a specific resource
 */
export const requireResourceAccess = (
  resourceType: 'paciente' | 'consulta' | 'documento' | 'usuario' | 'cita', 
  resourceIdParam: string
) => {
  return async (req: Request,  res: Response,  next: NextFunction) => {
    try {
      // Extract user ID from the request (assumes auth middleware ran first)
      const userId = (req as any).user?.id;
      
      if (!userId) {
        return res.status(401).json({
          error: 'Unauthorized', 
          message: 'Authentication required for resource access check'
        });
      }

      // Extract resource ID from request parameters
      const resourceId = Array.isArray(req.params[resourceIdParam])
        ? req.params[resourceIdParam][0]
        : req.params[resourceIdParam];

      if (!resourceId) {
        return res.status(400).json({
          error: 'Bad Request', 
          message: `Resource ID parameter '${resourceIdParam}' is required`
        });
      }

      // Check if user has access to the specific resource
      const hasAccess = await EnhancedPermissionService.canAccessResource(
        userId, 
        resourceType, 
        resourceId
      );

      if (!hasAccess) {
        logger.warn({
          userId, 
          resourceType, 
          resourceId, 
          endpoint: req.originalUrl
        },  'Resource access denied');

        return res.status(403).json({
          error: 'Forbidden', 
          message: 'You do not have permission to access this resource'
        });
      }

      // If access is granted, continue
      next();
    } catch (error) {
      logger.error({
        error: error,
        userId: (req as any).user?.id,
        resourceType,
        resourceId: req.params[resourceIdParam]
      }, 'Resource access check error');
      
      return res.status(500).json({
        error: 'Internal server error', 
        message: 'Error checking resource access permissions'
      });
    }
  };
};

/**
 * Middleware to check if user has permission to perform an action on a resource
 * Combines permission checks with resource access checks
 */
export const requireResourcePermission = (
  resourceType: 'paciente' | 'consulta' | 'documento' | 'usuario' | 'cita', 
  permissionAction: 'read' | 'create' | 'update' | 'delete', 
  resourceIdParam?: string // Optional for create operations
) => {
  return async (req: Request,  res: Response,  next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      
      if (!userId) {
        return res.status(401).json({
          error: 'Unauthorized', 
          message: 'Authentication required for permission check'
        });
      }

      // Map action to permission
      const permissionMap: Record<string, Record<string, any>> = {
        paciente: {
          read: 'patient:read',
          create: 'patient:create',
          update: 'patient:update',
          delete: 'patient:delete'
        },
        consulta: {
          read: 'consultation:read',
          create: 'consultation:create',
          update: 'consultation:update',
          delete: 'consultation:delete'
        },
        documento: {
          read: 'document:read',
          create: 'document:create',
          update: 'document:update',
          delete: 'document:delete'
        },
        usuario: {
          read: 'user:read',
          create: 'user:create',
          update: 'user:update',
          delete: 'user:delete'
        },
        cita: {
          read: 'consultation:read',
          create: 'consultation:create',
          update: 'consultation:update',
          delete: 'consultation:delete'
        }
      };

      const permissionString = permissionMap[resourceType]?.[permissionAction];
      if (!permissionString) {
        return res.status(400).json({
          error: 'Bad Request', 
          message: `Invalid resource type or action: ${resourceType}/${permissionAction}`
        });
      }

      // Import Permission enum dynamically
      const { Permission } = await import('../services/auth/permissions.service.js');
      const permission = Permission[permissionString.toUpperCase().replace(/:/g,  '_') as keyof typeof Permission];
      
      if (!permission) {
        return res.status(400).json({
          error: 'Bad Request', 
          message: `Invalid permission: ${permissionString}`
        });
      }

      // Check if user has the required permission
      const { PermissionService } = await import('../services/auth/permissions.service.js');
      const hasPermission = await PermissionService.checkPermission(userId,  permission);

      if (!hasPermission) {
        return res.status(403).json({
          error: 'Forbidden', 
          message: `You do not have permission to ${permissionAction} ${resourceType}s`
        });
      }

      // For read, update, delete operations, check resource access
      if (resourceIdParam && ['read', 'update', 'delete'].includes(permissionAction)) {
        const resourceId = Array.isArray(req.params[resourceIdParam])
          ? req.params[resourceIdParam][0]
          : req.params[resourceIdParam];

        if (!resourceId) {
          return res.status(400).json({
            error: 'Bad Request', 
            message: `Resource ID parameter '${resourceIdParam}' is required for ${permissionAction} operation`
          });
        }

        // Check if user has access to the specific resource
        const hasAccess = await EnhancedPermissionService.canAccessResource(
          userId, 
          resourceType, 
          resourceId
        );

        if (!hasAccess) {
          logger.warn({
            userId, 
            resourceType, 
            resourceId, 
            permissionAction, 
            endpoint: req.originalUrl
          },  'Resource access denied');

          return res.status(403).json({
            error: 'Forbidden', 
            message: 'You do not have permission to access this resource'
          });
        }
      }

      next();
    } catch (error) {
      logger.error({
        error: error,
        userId: (req as any).user?.id,
        resourceType,
        permissionAction,
        resourceId: resourceIdParam
          ? Array.isArray(req.params[resourceIdParam])
            ? req.params[resourceIdParam][0]
            : req.params[resourceIdParam]
          : undefined
      }, 'Resource permission check error');
      
      return res.status(500).json({
        error: 'Internal server error', 
        message: 'Error checking resource permissions'
      });
    }
  };
};