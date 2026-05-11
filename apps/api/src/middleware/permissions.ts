import { Request, Response, NextFunction } from 'express';
import { Permission, PermissionService } from '../services/auth/permissions.service.js';
import { logger } from '../utils/logger.js';

/**
 * Granular permission middleware
 * Checks if the authenticated user has the required permission(s)
 */
export const requirePermission = (...requiredPermissions: Permission[]) => {
  return async (req: Request,  res: Response,  next: NextFunction) => {
    try {
      // Extract user ID from the request (assumes auth middleware ran first)
      const userId = (req as any).user?.id;
      
      if (!userId) {
        return res.status(401).json({
          error: 'Unauthorized', 
          message: 'Authentication required for permission check'
        });
      }

      // Check if user has all required permissions
      const hasAll = await PermissionService.checkAllPermissions(userId,  requiredPermissions);
      
      if (!hasAll) {
        // Get user's permissions for error details
        const userPermissions = await PermissionService.getUserPermissions(userId);
        
        const missingPermissions = requiredPermissions.filter(
          perm => !userPermissions.permissions.includes(perm)
        );
        
        logger.warn({
          userId, 
          missingPermissions, 
          userPermissions: userPermissions.permissions
        },  'Permission denied');
        
        return res.status(403).json({
          error: 'Forbidden', 
          message: 'Insufficient permissions', 
          requiredPermissions, 
          missingPermissions
        });
      }

      // If all permissions are granted, continue
      next();
    } catch (error) {
      logger.error({ error: error,  userId: (req as any).user?.id }, 'Permission check error');
      return res.status(500).json({
        error: 'Internal server error', 
        message: 'Error checking permissions'
      });
    }
  };
};

/**
 * Middleware to check if user has any of the required permissions (OR logic)
 */
export const requireAnyPermission = (...requiredPermissions: Permission[]) => {
  return async (req: Request,  res: Response,  next: NextFunction) => {
    try {
      // Extract user ID from the request (assumes auth middleware ran first)
      const userId = (req as any).user?.id;
      
      if (!userId) {
        return res.status(401).json({
          error: 'Unauthorized', 
          message: 'Authentication required for permission check'
        });
      }

      // Check if user has any of the required permissions
      const hasAny = await PermissionService.checkAnyPermission(userId,  requiredPermissions);
      
      if (!hasAny) {
        // Get user's permissions for error details
        const userPermissions = await PermissionService.getUserPermissions(userId);
        
        logger.warn({
          userId, 
          requiredPermissions, 
          userPermissions: userPermissions.permissions
        },  'Permission denied (any check)');
        
        return res.status(403).json({
          error: 'Forbidden', 
          message: 'Insufficient permissions - requires at least one of the specified permissions', 
          requiredPermissions
        });
      }

      // If any permission is granted, continue
      next();
    } catch (error) {
      logger.error({ error: error,  userId: (req as any).user?.id }, 'Permission check error');
      return res.status(500).json({
        error: 'Internal server error', 
        message: 'Error checking permissions'
      });
    }
  };
};

/**
 * Middleware to check specific resource ownership in addition to permissions
 * This is useful for endpoints that need to verify both permissions and ownership
 */
export const requireResourcePermission = (
  resourceType: 'patient' | 'consulta' | 'documento', 
  permission: Permission, 
  resourceIdParam: string
) => {
  return async (req: Request,  res: Response,  next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const resourceId = req.params[resourceIdParam];

      if (!userId) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required'
        });
      }

      // Ensure resourceId is a string, not an array
      if (!resourceId || typeof resourceId !== 'string') {
        return res.status(400).json({
          error: 'Bad Request',
          message: `Resource ID parameter '${resourceIdParam}' is required and must be a string`
        });
      }

      // First, check if user has the required permission
      const hasPermission = await PermissionService.checkPermission(userId,  permission);
      if (!hasPermission) {
        return res.status(403).json({
          error: 'Forbidden', 
          message: 'Insufficient permissions for this action'
        });
      }

      // Then, check if user owns the resource (or has admin rights)
      const user = await PermissionService.getUserPermissions(userId);
      
      // Admins can access any resource
      if (user.rol === 'ADMIN') {
        return next();
      }

      // For other roles, check ownership based on resource type
      let ownsResource = false;
      
      switch (resourceType) {
        case 'patient':
          // Check if patient belongs to user's account
          const patient = await (await import('../config/database.js')).default.paciente.findUnique({
            where: { id: resourceId }, 
            select: { cuentaId: true }
          });
          
          ownsResource = patient?.cuentaId === user.cuentaId;
          break;
          
        case 'consulta':
          // Check if consulta belongs to user's patients or user is the doctor
          const consulta = await (await import('../config/database.js')).default.consulta.findUnique({
            where: { id: resourceId },
            select: {
              pacienteId: true,
              doctorId: true
            }
          });

          // Get the paciente to check cuentaId
          const paciente = consulta?.pacienteId
            ? await (await import('../config/database.js')).default.paciente.findUnique({
                where: { id: consulta.pacienteId },
                select: { cuentaId: true }
              })
            : null;

          ownsResource = (
            paciente?.cuentaId === user.cuentaId ||
            consulta?.doctorId === user.id
          );
          break;

        case 'documento':
          // Check if documento was created by user or belongs to user's resources
          const documento = await (await import('../config/database.js')).default.documento.findUnique({
            where: { id: resourceId },
            select: {
              pacienteId: true,
              consultaId: true
            }
          });

          // Check if documento belongs to user's patients
          const docPaciente = documento?.pacienteId
            ? await (await import('../config/database.js')).default.paciente.findUnique({
                where: { id: documento.pacienteId },
                select: { cuentaId: true }
              })
            : null;

          // Check if documento belongs to user's consultas
          const docConsulta = documento?.consultaId
            ? await (await import('../config/database.js')).default.consulta.findUnique({
                where: { id: documento.consultaId },
                select: { doctorId: true }
              })
            : null;

          ownsResource = (
            docPaciente?.cuentaId === user.cuentaId ||
            docConsulta?.doctorId === user.id
          );
          break;
          
        default:
          return res.status(400).json({
            error: 'Bad Request', 
            message: `Unsupported resource type: ${resourceType}`
          });
      }

      if (!ownsResource) {
        return res.status(403).json({
          error: 'Forbidden', 
          message: 'You do not have access to this resource'
        });
      }

      next();
    } catch (error) {
      logger.error({
        error: error,
        userId: (req as any).user?.id,
        resourceId: req.params[resourceIdParam]
      }, 'Resource permission check error');
      return res.status(500).json({
        error: 'Internal server error', 
        message: 'Error checking resource permissions'
      });
    }
  };
};