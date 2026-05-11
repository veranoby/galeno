// apps/api/src/middleware/auth.ts
/**
 * Auth Middleware - Valida JWT y carga contexto de usuario
 *
 * Responsabilidades:
 * - Validar tokens JWT de acceso
 * - Delegar carga de usuario a UserContextService
 * - Proporcionar helpers para control de acceso
 *
 * Patrones aplicados:
 * - Middleware Pattern: Pipeline de request/response
 * - Separation of Concerns: Lógica de DB en servicio separado
 * - Single Responsibility: Solo autenticación/autorización
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import prisma from '../config/database.js';
import { verifyAccessToken, type JWTPayload } from '../services/auth.service.js';
import { UserContextService, getUserContextService } from '../services/auth/UserContextService.js';
import type { UserContext } from '../services/auth/UserContextService.js';
import { Rol } from '@prisma/client';

// ============= TYPES =============

/**
 * Extended Request with user context
 */
export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    rol: 'DOCTOR' | 'ADMIN' | 'ASISTENTE' | 'ENFERMERA' | 'PACIENTE' | 'FARMACIA';
    cuentaId?: string; // Para usuarios vinculados
  };
}

// ============= MIDDLEWARE =============

/**
 * Auth Middleware - Valida JWT y carga contexto de usuario
 *
 * Flujo:
 * 1. Valida token JWT
 * 2. Delega a UserContextService para cargar usuario
 * 3. Establece req.user con datos del usuario
 * 4. UserContextService configura RLS automáticamente
 */
export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid Authorization header'
      });
    }

    const token = authHeader.substring(7);

    // 1. Validar JWT
    let payload: JWTPayload;
    try {
      payload = verifyAccessToken(token);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid token';
      return res.status(401).json({
        error: 'Unauthorized',
        message
      });
    }

    // 2. Cargar contexto de usuario (con RLS)
    const userContextService = getUserContextService(prisma);
    const result = await userContextService.loadUserContext(payload.sub, payload.cuentaId);

    if (!result.success || !result.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: result.error || 'User not found or inactive'
      });
    }

    // 3. Establecer req.user
    req.user = {
      id: result.user.id,
      email: result.user.email,
      rol: result.user.rol,
      cuentaId: result.user.cuentaId
    };

    next();
  } catch (error) {
    logger.error({ error }, 'Auth middleware error');
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Authentication failed'
    });
  }
}

/**
 * Optional Auth Middleware - No falla si no hay token
 *
 * Útil para endpoints públicos que pueden tener contexto opcional
 */
export async function optionalAuthMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return next();

    const token = authHeader.substring(7);
    try {
      const payload = verifyAccessToken(token);
      const userContextService = getUserContextService(prisma);
      const result = await userContextService.loadUserContext(payload.sub, payload.cuentaId);

      if (result.success && result.user) {
        req.user = {
          id: result.user.id,
          email: result.user.email,
          rol: result.user.rol,
          cuentaId: result.user.cuentaId
        };
      }
    } catch { /* ignore */ }
    next();
  } catch (error) {
    next();
  }
}

// ============= ROLE-BASED ACCESS CONTROL =============

/**
 * Factory para middleware que requiere roles específicos
 *
 * @param allowedRoles - Roles permitidos
 * @returns Middleware de Express
 *
 * @example
 * router.get('/admin', requireRole('ADMIN'), handler);
 * router.get('/medical', requireRole('DOCTOR', 'ASISTENTE'), handler);
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!allowedRoles.includes(req.user.rol)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Role ${req.user.rol} not allowed`
      });
    }

    next();
  };
}

// Middlewares pre-configurados para roles comunes
export const requireAdmin = requireRole('ADMIN');
export const requireDoctor = requireRole('DOCTOR', 'ADMIN');
export const requireMedical = requireRole('DOCTOR', 'ASISTENTE', 'ENFERMERA', 'ADMIN');
export const requireDoctorOrPaciente = requireRole('DOCTOR', 'PACIENTE', 'ADMIN');

// ============= RESOURCE-BASED ACCESS CONTROL =============

/**
 * Verifica si un usuario puede acceder a un paciente específico
 *
 * Reglas de acceso:
 * - ADMIN: Acceso total
 * - PACIENTE: Solo a sus propios datos
 * - DOCTOR: A sus pacientes o los con consentimiento activo
 *
 * @deprecated Usar EnhancedPermissionService.canAccessResource en su lugar
 * @param req - Request Express con usuario autenticado
 * @param pacienteId - ID del paciente a verificar
 * @returns true si tiene acceso, false otherwise
 */
export async function canAccessPatient(req: AuthRequest, pacienteId: string): Promise<boolean> {
  if (!req.user) return false;
  if (req.user.rol === 'ADMIN') return true;

  // Patient can access their own data
  if (req.user.rol === 'PACIENTE') {
    const paciente = await prisma.paciente.findUnique({
      where: { id: pacienteId },
      select: { cuentaId: true }
    });
    return paciente?.cuentaId === req.user.id;
  }

  // Doctor can access if they own the patient or have consent
  if (req.user.rol === 'DOCTOR') {
    const paciente = await prisma.paciente.findUnique({
      where: { id: pacienteId },
      select: { cuentaId: true }
    });

    if (paciente?.cuentaId === req.user.id) return true;

    // Check for explicit consent
    const consent = await prisma.conexionPaciente.findFirst({
      where: {
        pacienteId,
        doctorId: req.user.id,
        estado: 'activa'
      }
    });
    return !!consent;
  }

  return false;
}

/**
 * Helper para verificar acceso en route handlers
 *
 * @example
 * if (!await canAccessPatient(req, pacienteId)) {
 *   return res.status(403).json({ error: 'Forbidden' });
 * }
 */
export function checkPatientAccess(req: AuthRequest, pacienteId: string) {
  return canAccessPatient(req, pacienteId);
}

// ============= EXPORTS =============

export default {
  authMiddleware,
  optionalAuthMiddleware,
  requireRole,
  requireAdmin,
  requireDoctor,
  requireMedical,
  requireDoctorOrPaciente,
  canAccessPatient,
  checkPatientAccess
};
