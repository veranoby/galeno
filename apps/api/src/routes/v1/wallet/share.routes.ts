/**
 * Wallet Share Routes
 *
 * Rutas para compartir datos de salud cumpliendo LOPDP
 * Implementa el protocolo ShareToken con JWT firmado
 *
 * Endpoints:
 * - POST /api/v1/wallet/share/generate-token - Genera ShareToken (paciente)
 * - POST /api/v1/wallet/share/exchange-token - Intercambia token por sesión (doctor)
 * - GET  /api/v1/wallet/share/session - Obtiene información de sesión
 * - GET  /api/v1/wallet/share/history - Obtiene historial compartido
 * - POST /api/v1/wallet/share/revoke - Revoca acceso (paciente)
 *
 * @module routes/v1/wallet/share
 */

import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../../../middleware/auth.js';
import {
  shareTokenAuthMiddleware,
  requireSharePermissions,
  requireShareResourceAccess,
  ShareTokenRequest
} from '../../../middleware/share-token-auth.js';
import ShareTokenService from '../../../services/lopdp/share-token.service.js';
import { AuditService } from '../../../services/audit/audit.service.js';
import { AuditAction, ResourceType } from '@prisma/client';
import prisma from '../../../config/database.js';

const router: Router = Router();

// Initialize service
const shareTokenService = new ShareTokenService(prisma);

/**
 * @route POST /api/v1/wallet/share/generate-token
 * @description Genera un ShareToken para compartir datos de salud
 * @access Paciente (requiere autenticación)
 *
 * @body {string} doctorSolicitanteId - ID del doctor que recibirá acceso
 * @body {object} permisos - Permisos granulares
 * @body {string} motivoComparticion - Motivo de la compartición
 * @body {number} ttlSeconds - TTL del token en segundos (default: 900)
 */
router.post('/generate-token', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { doctorSolicitanteId, permisos, motivoComparticion, ttlSeconds } = req.body;

    // Validaciones básicas
    if (!doctorSolicitanteId) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'doctorSolicitanteId es requerido'
      });
    }

    if (!permisos) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'permisos es requerido'
      });
    }

    if (!motivoComparticion) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'motivoComparticion es requerido'
      });
    }

    // Obtener pacienteId del usuario autenticado
    // Asumimos que el usuario es el paciente o tiene representación legal
    const paciente = await prisma.paciente.findFirst({
      where: { cuentaId: userId }
    });

    if (!paciente) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'No autorizado: solo el paciente puede generar tokens de compartición'
      });
    }

    // Generar ShareToken
    const result = await shareTokenService.generateShareToken({
      pacienteId: paciente.id,
      doctorSolicitanteId,
      permisos: {
        verConsultas: permisos.verConsultas || false,
        verDocumentos: permisos.verDocumentos || false,
        verAntecedentes: permisos.verAntecedentes || false,
        verRecetas: permisos.verRecetas || false,
        verExamenes: permisos.verExamenes || false,
        descargarDocumentos: permisos.descargarDocumentos || false,
        consultaIds: permisos.consultaIds,
        documentoIds: permisos.documentoIds
      },
      motivoComparticion,
      ttlSeconds
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: result.message
      });
    }

    res.status(201).json({
      success: true,
      data: {
        token: result.token,
        sharedSessionId: result.sharedSessionId,
        expiresAt: result.expiresAt,
        qrData: result.qrData
      },
      message: result.message
    });
  } catch (error) {
    console.error('[ShareToken] Error generating token:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al generar token de compartición'
    });
  }
});

/**
 * @route POST /api/v1/wallet/share/exchange-token
 * @description Intercambia un ShareToken por un SharedSessionID
 * @access Doctor (requiere autenticación)
 *
 * @body {string} shareToken - ShareToken JWT recibido del paciente
 */
router.post('/exchange-token', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const doctorId = req.user!.id;
    const { shareToken } = req.body;

    if (!shareToken) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'shareToken es requerido'
      });
    }

    // Intercambiar token por sesión
    const result = await shareTokenService.exchangeToken({
      shareToken,
      doctorId
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: result.error
      });
    }

    res.status(200).json({
      success: true,
      data: {
        sharedSessionId: result.sharedSessionId,
        expiresAt: result.expiresAt,
        permisos: result.permisos,
        pacienteInfo: result.pacienteInfo
      },
      message: 'Token intercambiado exitosamente'
    });
  } catch (error) {
    console.error('[ShareToken] Error exchanging token:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al intercambiar token'
    });
  }
});

/**
 * @route GET /api/v1/wallet/share/session
 * @description Obtiene información de la sesión compartida actual
 * @access Doctor con sesión compartida activa
 *
 * @header {string} X-Shared-Session-ID - ID de sesión compartida
 */
router.get('/session', authMiddleware, shareTokenAuthMiddleware, async (req: ShareTokenRequest, res: Response) => {
  try {
    const session = req.sharedSession!;

    res.status(200).json({
      success: true,
      data: {
        sharedSessionId: session.sharedSessionId,
        pacienteId: session.pacienteId,
        doctorId: session.doctorId,
        permisos: session.permisos,
        expiresAt: session.expiresAt,
        activo: session.activo
      }
    });
  } catch (error) {
    console.error('[ShareToken] Error getting session info:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al obtener información de sesión'
    });
  }
});

/**
 * @route GET /api/v1/wallet/share/history
 * @description Obtiene el historial médico compartido filtrado por permisos
 * @access Doctor con sesión compartida activa
 *
 * @header {string} X-Shared-Session-ID - ID de sesión compartida
 */
router.get('/history', authMiddleware, shareTokenAuthMiddleware, async (req: ShareTokenRequest, res: Response) => {
  try {
    const session = req.sharedSession!;

    const result = await shareTokenService.getFilteredHistory(
      session.sharedSessionId,
      session.doctorId
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: result.error
      });
    }

    res.status(200).json({
      success: true,
      data: result.data
    });
  } catch (error) {
    console.error('[ShareToken] Error getting history:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al obtener historial compartido'
    });
  }
});

/**
 * @route GET /api/v1/wallet/share/history/consultas
 * @description Obtiene consultas compartidas
 * @access Doctor con permiso verConsultas
 */
router.get(
  '/history/consultas',
  authMiddleware,
  shareTokenAuthMiddleware,
  requireSharePermissions('verConsultas'),
  requireShareResourceAccess('consulta'),
  async (req: ShareTokenRequest, res: Response) => {
    try {
      const session = req.sharedSession!;

      const result = await shareTokenService.getFilteredHistory(
        session.sharedSessionId,
        session.doctorId
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: result.error
        });
      }

      res.status(200).json({
        success: true,
        data: {
          consultas: result.data?.consultas || []
        }
      });
    } catch (error) {
      console.error('[ShareToken] Error getting consultas:', error);
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Error al obtener consultas'
      });
    }
  }
);

/**
 * @route GET /api/v1/wallet/share/history/documentos
 * @description Obtiene documentos compartidos
 * @access Doctor con permiso verDocumentos
 */
router.get(
  '/history/documentos',
  authMiddleware,
  shareTokenAuthMiddleware,
  requireSharePermissions('verDocumentos'),
  requireShareResourceAccess('documento'),
  async (req: ShareTokenRequest, res: Response) => {
    try {
      const session = req.sharedSession!;

      const result = await shareTokenService.getFilteredHistory(
        session.sharedSessionId,
        session.doctorId
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: result.error
        });
      }

      res.status(200).json({
        success: true,
        data: {
          documentos: result.data?.documentos || []
        }
      });
    } catch (error) {
      console.error('[ShareToken] Error getting documentos:', error);
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Error al obtener documentos'
      });
    }
  }
);

/**
 * @route GET /api/v1/wallet/share/history/antecedentes
 * @description Obtiene antecedentes compartidos
 * @access Doctor con permiso verAntecedentes
 */
router.get(
  '/history/antecedentes',
  authMiddleware,
  shareTokenAuthMiddleware,
  requireSharePermissions('verAntecedentes'),
  requireShareResourceAccess('antecedente'),
  async (req: ShareTokenRequest, res: Response) => {
    try {
      const session = req.sharedSession!;

      const result = await shareTokenService.getFilteredHistory(
        session.sharedSessionId,
        session.doctorId
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: result.error
        });
      }

      res.status(200).json({
        success: true,
        data: {
          antecedentes: result.data?.antecedentes || []
        }
      });
    } catch (error) {
      console.error('[ShareToken] Error getting antecedentes:', error);
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Error al obtener antecedentes'
      });
    }
  }
);

/**
 * @route POST /api/v1/wallet/share/revoke
 * @description Revoca inmediatamente una sesión compartida
 * @access Paciente (dueño de los datos)
 *
 * @body {string} sharedSessionId - ID de sesión a revocar
 */
router.post('/revoke', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { sharedSessionId } = req.body;

    if (!sharedSessionId) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'sharedSessionId es requerido'
      });
    }

    // Obtener pacienteId del usuario autenticado
    const paciente = await prisma.paciente.findFirst({
      where: { cuentaId: userId }
    });

    if (!paciente) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'No autorizado: solo el paciente puede revocar acceso'
      });
    }

    // Revocar sesión
    const result = await shareTokenService.revokeSharedSession(sharedSessionId, paciente.id);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: result.message
      });
    }

    res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error('[ShareToken] Error revoking session:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al revocar acceso'
    });
  }
});

/**
 * @route GET /api/v1/wallet/share/sessions
 * @description Obtiene todas las sesiones compartidas activas del paciente
 * @access Paciente (dueño de los datos)
 */
router.get('/sessions', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Obtener pacienteId del usuario autenticado
    const paciente = await prisma.paciente.findFirst({
      where: { cuentaId: userId }
    });

    if (!paciente) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'No autorizado'
      });
    }

    // Obtener sesiones compartidas
    const sesiones = await prisma.conexionPaciente.findMany({
      where: {
        pacienteId: paciente.id,
        estado: 'activa',
        permisos: {
          path: ['tipo'],
          equals: 'SHARE_TOKEN'
        }
      },
      include: {
        doctor: {
          select: {
            id: true,
            nombre: true,
            especialidad: true
          }
        }
      },
      orderBy: {
        fechaAutorizacion: 'desc'
      }
    });

    // Transformar datos
    const sesionesTransformadas = sesiones.map(sesion => ({
      sharedSessionId: (sesion.permisos as any).sharedSessionId,
      doctorId: sesion.doctorId,
      doctorNombre: sesion.doctor.nombre,
      doctorEspecialidad: sesion.doctor.especialidad,
      permisos: {
        verConsultas: (sesion.permisos as any).verConsultas,
        verDocumentos: (sesion.permisos as any).verDocumentos,
        verAntecedentes: (sesion.permisos as any).verAntecedentes,
        verRecetas: (sesion.permisos as any).verRecetas,
        verExamenes: (sesion.permisos as any).verExamenes,
        descargarDocumentos: (sesion.permisos as any).descargarDocumentos
      },
      expiresAt: sesion.fechaExpiracion,
      createdAt: sesion.fechaAutorizacion
    }));

    res.status(200).json({
      success: true,
      data: sesionesTransformadas
    });
  } catch (error) {
    console.error('[ShareToken] Error getting sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al obtener sesiones compartidas'
    });
  }
});

export default router;
