/**
 * ShareToken Auth Middleware
 *
 * Middleware para autenticación de requests usando SharedSessionID
 * Permite acceso temporal a datos de salud cumpliendo LOPDP
 *
 * @module middleware/share-token-auth
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import ShareTokenService from '../services/lopdp/share-token.service.js';
import prisma from '../config/database.js';

/**
 * Extended Request con contexto de sesión compartida
 */
export interface ShareTokenRequest extends Request {
  sharedSession?: {
    sharedSessionId: string;
    pacienteId: string;
    doctorId: string;
    permisos: {
      verConsultas: boolean;
      verDocumentos: boolean;
      verAntecedentes: boolean;
      verRecetas: boolean;
      verExamenes: boolean;
      descargarDocumentos: boolean;
      consultaIds?: string[];
      documentoIds?: string[];
    };
    expiresAt: Date;
    activo: boolean;
  };
}

/**
 * ShareToken Auth Middleware
 *
 * Valida el SharedSessionID del header y establece contexto de acceso
 * Headers requeridos:
 * - X-Shared-Session-ID: ID de sesión compartida
 *
 * @param req - Request con SharedSessionID
 * @param res - Response
 * @param next - Next middleware
 */
export async function shareTokenAuthMiddleware(
  req: ShareTokenRequest,
  res: Response,
  next: NextFunction
) {
  try {
    // 1. Obtener SharedSessionID del header
    const sharedSessionId = req.headers['x-shared-session-id'] as string;

    if (!sharedSessionId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'SharedSessionID requerido en header X-Shared-Session-ID'
      });
    }

    // 2. Obtener doctorId del contexto de autenticación principal
    // Asumimos que authMiddleware ya se ejecutó antes
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Token de autenticación requerido'
      });
    }

    // Extraer doctorId del request (establecido por authMiddleware)
    const doctorId = (req as any).user?.id;

    if (!doctorId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Usuario no autenticado'
      });
    }

    // 3. Validar sesión compartida
    const shareTokenService = new ShareTokenService(prisma);
    const sessionInfo = await shareTokenService.getSharedSessionInfo(sharedSessionId, doctorId);

    if (!sessionInfo) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Sesión compartida no encontrada'
      });
    }

    // 4. Verificar que la sesión está activa
    if (!sessionInfo.activo) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Sesión compartida expirada o revocada'
      });
    }

    // 5. Establecer contexto en el request
    req.sharedSession = {
      sharedSessionId: sessionInfo.sharedSessionId,
      pacienteId: sessionInfo.pacienteId,
      doctorId: sessionInfo.doctorId,
      permisos: sessionInfo.permisos,
      expiresAt: sessionInfo.expiresAt,
      activo: sessionInfo.activo
    };

    // 6. Establecer contexto RLS para PostgreSQL (opcional)
    await prisma.$executeRaw`SET LOCAL request.shared_session.id = ${sharedSessionId}`;
    await prisma.$executeRaw`SET LOCAL request.shared_session.paciente_id = ${sessionInfo.pacienteId}`;

    logger.debug({
      sharedSessionId,
      doctorId,
      pacienteId: sessionInfo.pacienteId
    }, 'ShareToken auth exitoso');

    next();
  } catch (error) {
    logger.error({ error }, 'Error en shareTokenAuthMiddleware');
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Error validando sesión compartida'
    });
  }
}

/**
 * Middleware para verificar permisos específicos
 *
 * @param permisosRequeridos - Lista de permisos requeridos
 * @returns Middleware function
 */
export function requireSharePermissions(...permisosRequeridos: Array<keyof ShareTokenRequest['sharedSession']['permisos']>) {
  return (req: ShareTokenRequest, res: Response, next: NextFunction) => {
    if (!req.sharedSession) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Sesión compartida no inicializada'
      });
    }

    const { permisos } = req.sharedSession;

    // Verificar cada permiso requerido
    for (const permiso of permisosRequeridos) {
      if (!permisos[permiso]) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: `Permiso '${permiso}' requerido para esta operación`
        });
      }
    }

    next();
  };
}

/**
 * Middleware para verificar acceso a recurso específico
 *
 * @param resourceType - Tipo de recurso ('consulta', 'documento', 'antecedente')
 * @param resourceId - ID del recurso
 */
export function requireShareResourceAccess(resourceType: 'consulta' | 'documento' | 'antecedente', resourceId?: string) {
  return async (req: ShareTokenRequest, res: Response, next: NextFunction) => {
    if (!req.sharedSession) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Sesión compartida no inicializada'
      });
    }

    const { permisos, pacienteId } = req.sharedSession;

    // Verificar permiso base según tipo de recurso
    switch (resourceType) {
      case 'consulta':
        if (!permisos.verConsultas) {
          return res.status(403).json({
            success: false,
            error: 'Forbidden',
            message: 'Sin permiso para ver consultas'
          });
        }

        // Verificar restricción por consultaIds específicos
        if (permisos.consultaIds && permisos.consultaIds.length > 0) {
          const id = resourceId || (req.params.id as string);
          if (id && !permisos.consultaIds.includes(id)) {
            return res.status(403).json({
              success: false,
              error: 'Forbidden',
              message: 'Acceso denegado a esta consulta específica'
            });
          }
        }
        break;

      case 'documento':
        if (!permisos.verDocumentos) {
          return res.status(403).json({
            success: false,
            error: 'Forbidden',
            message: 'Sin permiso para ver documentos'
          });
        }

        // Verificar restricción por documentoIds específicos
        if (permisos.documentoIds && permisos.documentoIds.length > 0) {
          const id = resourceId || (req.params.id as string);
          if (id && !permisos.documentoIds.includes(id)) {
            return res.status(403).json({
              success: false,
              error: 'Forbidden',
              message: 'Acceso denegado a este documento específico'
            });
          }
        }
        break;

      case 'antecedente':
        if (!permisos.verAntecedentes) {
          return res.status(403).json({
            success: false,
            error: 'Forbidden',
            message: 'Sin permiso para ver antecedentes'
          });
        }
        break;

      default:
        return res.status(500).json({
          success: false,
          error: 'Internal server error',
          message: 'Tipo de recurso inválido'
        });
    }

    next();
  };
}

export default {
  shareTokenAuthMiddleware,
  requireSharePermissions,
  requireShareResourceAccess
};
