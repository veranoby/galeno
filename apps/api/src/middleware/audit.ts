import { Request, Response, NextFunction } from 'express';
import { AuditAction, ResourceType } from '@prisma/client';
import AuditService from '../services/audit/audit.service.js';
import { logger } from '../utils/logger.js';

/**
 * Audit middleware for critical resource access
 */
export const auditResourceAccess = (resourceType: ResourceType,  idParam: string) => {
  return async (req: Request,  res: Response,  next: NextFunction) => {
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.rol || 'UNKNOWN';
    const resourceId = req.params[idParam];

    if (userId && resourceId) {
      try {
        await AuditService.logResourceAccess(userId,  userRole,  resourceType,  resourceId as string, req);
      } catch (error) {
        logger.error({ error,  userId,  resourceId,  resourceType },  'Error logging resource access');
        // Don't fail the request if audit logging fails
      }
    }

    next();
  };
};

/**
 * Audit middleware for resource creation
 */
export const auditResourceCreation = (resourceType: ResourceType,  idParam: string) => {
  return async (req: Request,  res: Response,  next: NextFunction) => {
    // Monkey-patch the response's send method to capture the created resource ID
    const originalSend = res.send;
    res.send = function(body: any) {
      try {
        // Parse the response body to get the created resource ID
        let parsedBody;
        if (typeof body === 'string') {
          try {
            parsedBody = JSON.parse(body);
          } catch {
            parsedBody = body;
          }
        } else {
          parsedBody = body;
        }

        const userId = (req as any).user?.id;
        const userRole = (req as any).user?.rol || 'UNKNOWN';
        let resourceId;

        // Try to extract resource ID from response
        if (parsedBody && typeof parsedBody === 'object') {
          if (parsedBody.id) {
            resourceId = parsedBody.id;
          } else if (parsedBody.data && parsedBody.data.id) {
            resourceId = parsedBody.data.id;
          }
        }

        if (userId && resourceId) {
          AuditService.logResourceCreation(userId,  userRole,  resourceType,  resourceId as string, req).catch(error => {
            logger.error({ error,  userId,  resourceId,  resourceType },  'Error logging resource creation');
          });
        }
      } catch (error) {
        logger.error({ error },  'Error in auditResourceCreation middleware');
      }

      return originalSend.call(this,  body);
    };

    next();
  };
};

/**
 * Audit middleware for resource updates
 */
export const auditResourceUpdate = (resourceType: ResourceType,  idParam: string) => {
  return async (req: Request,  res: Response,  next: NextFunction) => {
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.rol || 'UNKNOWN';
    const resourceId = req.params[idParam];

    // Capture the original send method to log after response
    const originalSend = res.send;
    res.send = function(body: any) {
      try {
        if (userId && resourceId) {
          // Extract changes from request body
          const changes = { ...req.body };
          // Remove sensitive fields from changes log
          delete changes.password;
          delete changes.token;

          AuditService.logResourceUpdate(userId,  userRole,  resourceType,  resourceId as string, req,  changes).catch(error => {
            logger.error({ error,  userId,  resourceId,  resourceType },  'Error logging resource update');
          });
        }
      } catch (error) {
        logger.error({ error },  'Error in auditResourceUpdate middleware');
      }

      return originalSend.call(this,  body);
    };

    next();
  };
};

/**
 * Audit middleware for resource deletions
 */
export const auditResourceDeletion = (resourceType: ResourceType,  idParam: string) => {
  return async (req: Request,  res: Response,  next: NextFunction) => {
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.rol || 'UNKNOWN';
    const resourceId = req.params[idParam];

    // Capture the original send method to log after response
    const originalSend = res.send;
    res.send = function(body: any) {
      try {
        if (userId && resourceId) {
          AuditService.logResourceDeletion(userId,  userRole,  resourceType,  resourceId as string, req).catch(error => {
            logger.error({ error,  userId,  resourceId,  resourceType },  'Error logging resource deletion');
          });
        }
      } catch (error) {
        logger.error({ error },  'Error in auditResourceDeletion middleware');
      }

      return originalSend.call(this,  body);
    };

    next();
  };
};

/**
 * Audit middleware for general actions
 */
export const auditAction = (action: AuditAction,  resourceType?: ResourceType,  idParam?: string) => {
  return async (req: Request,  res: Response,  next: NextFunction) => {
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.rol || 'UNKNOWN';
    const resourceId = idParam ? req.params[idParam] : undefined;

    // Capture the original send method to log after response
    const originalSend = res.send;
    res.send = function(body: any) {
      try {
        if (userId) {
          AuditService.logEvent(userId,  userRole,  action,  resourceType,  resourceId as string, undefined, req).catch(error => {
            logger.error({ error,  userId,  action,  resourceId },  'Error logging action');
          });
        }
      } catch (error) {
        logger.error({ error },  'Error in auditAction middleware');
      }

      return originalSend.call(this,  body);
    };

    next();
  };
};

/**
 * Specialized audit middleware for login events
 */
export const auditLogin = () => {
  return async (req: Request,  res: Response,  next: NextFunction) => {
    // Capture the original send method to log after successful login
    const originalSend = res.send;
    res.send = function(body: any) {
      try {
        let parsedBody;
        if (typeof body === 'string') {
          try {
            parsedBody = JSON.parse(body);
          } catch {
            parsedBody = body;
          }
        } else {
          parsedBody = body;
        }

        // Check if login was successful (typically has a token or user object)
        if (parsedBody && (parsedBody.token || parsedBody.user || parsedBody.tokens)) {
          const userId = (req as any).user?.id || parsedBody.user?.id || parsedBody.data?.user?.id;
          const userRole = (req as any).user?.rol || parsedBody.user?.rol || parsedBody.data?.user?.rol || 'UNKNOWN';
          
          if (userId) {
            AuditService.logEvent(userId,  userRole,  AuditAction.LOGIN,  undefined,  undefined,  undefined,  req).catch(error => {
              logger.error({ error,  userId },  'Error logging login');
            });
          }
        }
      } catch (error) {
        logger.error({ error },  'Error in auditLogin middleware');
      }

      return originalSend.call(this,  body);
    };

    next();
  };
};

/**
 * Specialized audit middleware for logout events
 */
export const auditLogout = () => {
  return async (req: Request,  res: Response,  next: NextFunction) => {
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.rol || 'UNKNOWN';

    // Capture the original send method to log after response
    const originalSend = res.send;
    res.send = function(body: any) {
      try {
        if (userId) {
          AuditService.logEvent(userId,  userRole,  AuditAction.LOGOUT,  undefined,  undefined,  undefined,  req).catch(error => {
            logger.error({ error,  userId },  'Error logging logout');
          });
        }
      } catch (error) {
        logger.error({ error },  'Error in auditLogout middleware');
      }

      return originalSend.call(this,  body);
    };

    next();
  };
};