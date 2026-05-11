// apps/api/src/routes/v1/share.routes.ts
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest, authMiddleware } from '../../middleware/auth.js';
import { ShareService } from '../../services/lopdp/share.service.js';
import { NotificationService } from '../../services/notifications/notification.service.js';
import { logger } from '../../utils/logger.js';

const router: Router = Router();
const prisma = new PrismaClient();
const notificationService = new NotificationService(prisma);
const shareService = new ShareService(prisma, notificationService);

/**
 * POST /api/v1/share/documento
 * Compartir un documento con otro doctor
 * Requiere consentimiento explícito del paciente (conexión activa)
 */
router.post('/documento', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { documentoId, destinatarioId, motivoComparticion, temporal, fechaExpiracion } = req.body;

    // Validaciones básicas
    if (!documentoId || !destinatarioId || !motivoComparticion) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'documentoId, destinatarioId y motivoComparticion son requeridos'
      });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Usuario no autenticado'
      });
    }

    // Ejecutar compartición
    const result = await shareService.shareDocument({
      documentoId,
      destinatarioId,
      solicitanteId: userId,
      motivoComparticion,
      temporal: temporal || false,
      fechaExpiracion: fechaExpiracion ? new Date(fechaExpiracion) : undefined
    });

    if (result.success) {
      res.status(200).json(result);
    } else if (result.requiresConsent) {
      res.status(403).json({
        ...result,
        error: 'Consent Required',
        message: 'Se requiere consentimiento del paciente. Inicie una solicitud de conexión.'
      });
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    logger.error('Error en share.documento:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al compartir documento'
    });
  }
});

/**
 * POST /api/v1/share/consulta
 * Compartir una consulta completa con otro doctor
 * Requiere consentimiento explícito del paciente (conexión activa)
 */
router.post('/consulta', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { consultaId, destinatarioId, motivoComparticion, incluirDocumentos, temporal, fechaExpiracion } = req.body;

    // Validaciones básicas
    if (!consultaId || !destinatarioId || !motivoComparticion) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'consultaId, destinatarioId y motivoComparticion son requeridos'
      });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Usuario no autenticado'
      });
    }

    // Ejecutar compartición
    const result = await shareService.shareConsulta({
      consultaId,
      destinatarioId,
      solicitanteId: userId,
      motivoComparticion,
      incluirDocumentos: incluirDocumentos || false,
      temporal: temporal || false,
      fechaExpiracion: fechaExpiracion ? new Date(fechaExpiracion) : undefined
    });

    if (result.success) {
      res.status(200).json(result);
    } else if (result.requiresConsent) {
      res.status(403).json({
        ...result,
        error: 'Consent Required',
        message: 'Se requiere consentimiento del paciente. Inicie una solicitud de conexión.'
      });
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    logger.error('Error en share.consulta:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al compartir consulta'
    });
  }
});

/**
 * GET /api/v1/share/documentos/recibidos
 * Obtener documentos compartidos con el doctor actual
 */
router.get('/documentos/recibidos', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Usuario no autenticado'
      });
    }

    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit) || 50 : 50;

    const documentos = await shareService.getSharedDocuments(userId, limit);

    res.status(200).json({
      success: true,
      data: documentos,
      count: documentos.length
    });
  } catch (error) {
    logger.error('Error en share.documentos.recibidos:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al obtener documentos compartidos'
    });
  }
});

/**
 * GET /api/v1/share/consultas/recibidas
 * Obtener consultas compartidas con el doctor actual
 */
router.get('/consultas/recibidas', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Usuario no autenticado'
      });
    }

    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit) || 50 : 50;

    const consultas = await shareService.getSharedConsultas(userId, limit);

    res.status(200).json({
      success: true,
      data: consultas,
      count: consultas.length
    });
  } catch (error) {
    logger.error('Error en share.consultas.recibidas:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al obtener consultas compartidas'
    });
  }
});

/**
 * POST /api/v1/share/documento/:id/revocar
 * Revocar acceso a un documento compartido
 */
router.post('/documento/:id/revocar', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Usuario no autenticado'
      });
    }

    const result = await shareService.revokeDocumentShare(id, userId);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    logger.error('Error en share.documento.revocar:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al revocar acceso'
    });
  }
});

/**
 * POST /api/v1/share/consulta/:id/revocar
 * Revocar acceso a una consulta compartida
 */
router.post('/consulta/:id/revocar', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Usuario no autenticado'
      });
    }

    const result = await shareService.revokeConsultaShare(id, userId);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    logger.error('Error en share.consulta.revocar:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al revocar acceso'
    });
  }
});

export default router;
