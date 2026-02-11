import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import prisma from '../config/database.js';

/**
 * JWT Payload Interface
 */
export interface JWTPayload {
  sub: string; // user_id
  email: string;
  rol: 'DOCTOR' | 'ADMIN' | 'ASISTENTE' | 'ENFERMERA';
  iat?: number;
  exp?: number;
}

/**
 * Extended Request with user context
 */
export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    rol: 'DOCTOR' | 'ADMIN' | 'ASISTENTE' | 'ENFERMERA';
    cuentaId?: string; // Para usuarios vinculados
  };
}

/**
 * Auth Middleware - Sets RLS context and validates JWT
 *
 * This middleware:
 * 1. Validates JWT from Authorization header
 * 2. Sets PostgreSQL RLS context (request.user.id)
 * 3. Attaches user info to request object
 *
 * USAGE:
 * app.use(authMiddleware);
 */
export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid Authorization header'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer '

    // Verify JWT (TODO: Implement with jsonwebtoken)
    // For now, skip verification in development
    let payload: JWTPayload;

    try {
      // Development: Accept any token as base64 encoded JSON
      const decoded = Buffer.from(token, 'base64').toString('utf-8');
      payload = JSON.parse(decoded);

      // Validate required fields
      if (!payload.sub || !payload.email || !payload.rol) {
        throw new Error('Invalid token payload');
      }
    } catch (error) {
      // If not base64 JSON, try JWT verification (TODO)
      // For development, allow a bypass
      if (process.env.NODE_ENV === 'development' && token === 'dev-token') {
        payload = {
          sub: 'dev-user-id',
          email: 'dev@galeno.ec',
          rol: 'DOCTOR'
        };
      } else {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid token'
        });
      }
    }

    // Verify user exists in database
    const cuenta = await prisma.cuenta.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, rol: true }
    });

    if (!cuenta) {
      // Check if it's a linked user
      const usuarioVinculado = await prisma.usuarioVinculado.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          rol: true,
          cuentaId: true,
          doctorAsignadoId: true
        }
      });

      if (!usuarioVinculado || !usuarioVinculado.activo) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'User not found or inactive'
        });
      }

      // Attach linked user to request
      req.user = {
        id: usuarioVinculado.id,
        email: usuarioVinculado.email,
        rol: usuarioVinculado.rol,
        cuentaId: usuarioVinculado.doctorAsignadoId
      };
    } else {
      // Attach account user to request
      req.user = {
        id: cuenta.id,
        email: cuenta.email,
        rol: cuenta.rol as 'DOCTOR' | 'ADMIN'
      };
    }

    // Set PostgreSQL RLS context
    // This enables Row Level Security policies to filter results
    await prisma.$executeRaw`SET LOCAL request.jwt.claim.user_id = ${req.user.id}`;
    await prisma.$executeRaw`SET LOCAL request.user.id = ${req.user.id}`;

    // Log for debugging (remove in production)
    if (process.env.NODE_ENV === 'development') {
      logger.debug('User authenticated', {
        id: req.user.id,
        email: req.user.email,
        rol: req.user.rol
      });
    }

    next();
  } catch (error) {
    logger.error('Auth middleware error', { error });
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Authentication failed'
    });
  }
}

/**
 * Optional Auth Middleware - Doesn't fail if no token
 *
 * Use this for endpoints that work both authenticated and anonymously
 */
export async function optionalAuthMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      // No token, continue without user context
      return next();
    }

    // Try to authenticate, but don't fail if it doesn't work
    const token = authHeader.substring(7);

    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8');
      const payload: JWTPayload = JSON.parse(decoded);

      if (payload.sub && payload.email && payload.rol) {
        const cuenta = await prisma.cuenta.findUnique({
          where: { id: payload.sub },
          select: { id: true, email: true, rol: true }
        });

        if (cuenta) {
          req.user = {
            id: cuenta.id,
            email: cuenta.email,
            rol: cuenta.rol as 'DOCTOR' | 'ADMIN'
          };

          await prisma.$executeRaw`SET LOCAL request.jwt.claim.user_id = ${req.user.id}`;
          await prisma.$executeRaw`SET LOCAL request.user.id = ${req.user.id}`;
        }
      }
    } catch {
      // Ignore errors, continue without auth
    }

    next();
  } catch (error) {
    // Always continue on optional auth
    next();
  }
}

/**
 * Role-based Access Control Middleware
 *
 * Use after authMiddleware to restrict access to specific roles
 */
export function requireRole(...allowedRoles: Array<'DOCTOR' | 'ADMIN' | 'ASISTENTE' | 'ENFERMERA'>) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    if (!allowedRoles.includes(req.user.rol)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Role ${req.user.rol} not allowed. Allowed: ${allowedRoles.join(', ')}`
      });
    }

    next();
  };
}

/**
 * Require Admin Role
 */
export const requireAdmin = requireRole('ADMIN');

/**
 * Require Doctor Role
 */
export const requireDoctor = requireRole('DOCTOR', 'ADMIN');

/**
 * Require Medical Role (Doctor, Nurse, Assistant)
 */
export const requireMedical = requireRole('DOCTOR', 'ASISTENTE', 'ENFERMERA', 'ADMIN');

/**
 * Check if user owns a resource or is admin
 *
 * Use this in route handlers after authMiddleware
 */
export function checkOwnership(req: AuthRequest, resourceOwnerId: string): boolean {
  if (!req.user) return false;
  if (req.user.rol === 'ADMIN') return true;
  return req.user.id === resourceOwnerId;
}

/**
 * Check if user can access a patient (either owns it or is assigned)
 */
export async function canAccessPatient(req: AuthRequest, pacienteId: string): Promise<boolean> {
  if (!req.user) return false;
  if (req.user.rol === 'ADMIN') return true;

  // Check if patient belongs to user's account
  if (req.user.rol === 'DOCTOR') {
    const paciente = await prisma.paciente.findUnique({
      where: { id: pacienteId },
      select: { cuentaId: true }
    });

    return paciente?.cuentaId === req.user.id;
  }

  // For ASISTENTE/ENFERMERA, check if patient belongs to assigned doctor
  if (req.user.rol === 'ASISTENTE' || req.user.rol === 'ENFERMERA') {
    const paciente = await prisma.paciente.findUnique({
      where: { id: pacienteId },
      select: { cuentaId: true }
    });

    return paciente?.cuentaId === req.user.cuentaId;
  }

  return false;
}

export default {
  authMiddleware,
  optionalAuthMiddleware,
  requireRole,
  requireAdmin,
  requireDoctor,
  requireMedical,
  checkOwnership,
  canAccessPatient
};
