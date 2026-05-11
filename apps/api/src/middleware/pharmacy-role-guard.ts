import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth.js';
import { logger } from '../utils/logger.js';

/**
 * Custom error class for pharmacy role guard errors
 */
export class PharmacyRoleGuardError extends Error {
  code: string;
  statusCode: number;

  constructor(message: string, code: string = 'FORBIDDEN', statusCode: number = 403) {
    super(message);
    this.name = 'PharmacyRoleGuardError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Pharmacy context attached to request after successful validation
 */
export interface PharmacyContext {
  pharmacyId: string;
  pharmacyEmail: string;
  cuentaId?: string;
}

/**
 * Extended AuthRequest with pharmacy context
 */
export interface PharmacyAuthRequest extends AuthRequest {
  pharmacyContext?: PharmacyContext;
}

/**
 * Pharmacy Role Guard Middleware
 * Ensures that only users with FARMACIA role can access pharmacy-specific endpoints
 * 
 * Security Features:
 * - Strict role-based access control
 * - Prevents privilege escalation
 * - Logs unauthorized access attempts
 * - Provides audit trail for pharmacy operations
 * 
 * @param req - Express request
 * @param res - Express response
 * @param next - Express next function
 */
export async function pharmacyRoleGuard(
  req: PharmacyAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Check if user is authenticated
    if (!req.user) {
      throw new PharmacyRoleGuardError(
        'Authentication required for pharmacy access',
        'UNAUTHORIZED',
        401
      );
    }

    // Strict role check - only FARMACIA role allowed
    const userRole = req.user.rol.toUpperCase();
    
    if (userRole !== 'FARMACIA') {
      logger.warn({
        userId: req.user.id,
        userEmail: req.user.email,
        userRole: req.user.rol,
        attemptedPath: req.path,
        attemptedMethod: req.method
      }, 'Unauthorized pharmacy access attempt');

      res.status(403).json({
        error: 'Forbidden',
        message: 'Access restricted to FARMACIA role only',
        requiredRole: 'FARMACIA',
        userRole: req.user.rol
      });
      return;
    }

    // Set pharmacy context for downstream handlers
    req.pharmacyContext = {
      pharmacyId: req.user.id,
      pharmacyEmail: req.user.email,
      cuentaId: req.user.cuentaId
    };

    // Log successful pharmacy access
    logger.info({
      pharmacyId: req.user.id,
      pharmacyEmail: req.user.email,
      path: req.path,
      method: req.method
    }, 'Pharmacy access granted');

    next();
  } catch (error) {
    if (error instanceof PharmacyRoleGuardError) {
      logger.warn({
        error: error.message,
        code: error.code,
        userId: (req as any).user?.id
      }, 'Pharmacy role guard error');

      res.status(error.statusCode).json({
        error: error.code,
        message: error.message
      });
      return;
    }

    logger.error({ error }, 'Pharmacy role guard unexpected error');
    res.status(500).json({
      error: 'Internal server error',
      message: 'Pharmacy access validation failed'
    });
  }
}

/**
 * Middleware factory for requiring pharmacy role
 * Can be used in combination with other permission checks
 * 
 * @returns Express middleware function
 */
export function requirePharmacyRole() {
  return pharmacyRoleGuard;
}

/**
 * Combined middleware for pharmacy + authentication
 * Use this when you need both auth and pharmacy role check
 */
export const pharmacyOnly = [pharmacyRoleGuard];

export default {
  pharmacyRoleGuard,
  requirePharmacyRole,
  pharmacyOnly,
  PharmacyRoleGuardError
};
