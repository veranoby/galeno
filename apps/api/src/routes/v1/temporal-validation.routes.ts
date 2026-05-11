/**
 * Rutas API para validación temporal del Health Wallet
 * TASK-039: Validación Health Wallet
 *
 * Estas rutas permiten el acceso temporal al historial médico
 * durante una teleconsulta, con compliance LOPDP.
 *
 * @module routes/v1/temporal-validation
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import WalletValidationService from '../../services/wallet/validation.js';
import { default as prisma } from '../../config/database.js';
import { logger } from '../../utils/logger.js';

const router: Router = Router();

// Inicializar servicio
const validationService = new WalletValidationService(prisma);

/**
 * @openapi
 * /api/v1/wallet/temporal/request:
 *   post:
 *     summary: Solicitar acceso temporal al Health Wallet
 *     description: Genera un token JWT temporal para acceder al historial del paciente durante una teleconsulta
 *     tags: [Health Wallet - Temporal Access]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - citaId
 *               - doctorId
 *               - pacienteId
 *             properties:
 *               citaId:
 *                 type: string
 *                 description: ID de la cita/teleconsulta
 *               doctorId:
 *                 type: string
 *                 description: ID del doctor que solicita acceso
 *               pacienteId:
 *                 type: string
 *                 description: ID del paciente
 *     responses:
 *       201:
 *         description: Token generado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                       description: Token JWT temporal
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *                       description: Fecha de expiración del token
 *       400:
 *         description: Error en la solicitud
 *       403:
 *         description: Sin permisos
 */
router.post('/request', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { citaId, doctorId, pacienteId } = req.body;

    // Validar parámetros requeridos
    if (!citaId || !doctorId || !pacienteId) {
      return res.status(400).json({
        success: false,
        error: 'Faltan parámetros requeridos: citaId, doctorId, pacienteId',
      });
    }

    // El usuario autenticado debe ser el doctor que solicita acceso
    const userId = (req as any).user?.id;
    if (userId !== doctorId) {
      return res.status(403).json({
        success: false,
        error: 'No puedes solicitar acceso en nombre de otro doctor',
      });
    }

    // Generar token temporal
    const result = await validationService.generateTemporalToken({
      citaId,
      doctorId,
      pacienteId,
    });

    logger.info({
      citaId,
      doctorId,
      pacienteId,
      expiresAt: result.expiresAt,
    }, 'Token temporal generado para teleconsulta');

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error({ error }, 'Error generando token temporal');
    res.status(400).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * @openapi
 * /api/v1/wallet/temporal/validate/{token}:
 *   get:
 *     summary: Validar token de acceso temporal
 *     description: Verifica si un token temporal es válido y activo
 *     tags: [Health Wallet - Temporal Access]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Token JWT a validar
 *     responses:
 *       200:
 *         description: Token válido
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     valid:
 *                       type: boolean
 *                     citaId:
 *                       type: string
 *                     doctorId:
 *                       type: string
 *                     pacienteId:
 *                       type: string
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Token inválido o expirado
 */
router.get('/validate/:token', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    // Validar que token es un string
    if (typeof token !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Token inválido'
      });
    }

    const result = await validationService.validateTemporalAccess(token);

    if (!result.valid) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error({ error }, 'Error validando token temporal');
    res.status(500).json({
      success: false,
      error: 'Error al validar token',
    });
  }
});

/**
 * @openapi
 * /api/v1/wallet/temporal/history:
 *   get:
 *     summary: Obtener historial del paciente con token temporal
 *     description: Retorna el historial médico y documentos del paciente usando un token temporal válido
 *     tags: [Health Wallet - Temporal Access]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Token JWT temporal
 *     responses:
 *       200:
 *         description: Historial obtenido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     consultas:
 *                       type: array
 *                       items:
 *                         type: object
 *                     documentos:
 *                       type: array
 *                       items:
 *                         type: object
 *                     paciente:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         nombre:
 *                           type: string
 *       400:
 *         description: Token inválido o sin permisos
 */
router.get('/history', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Token es requerido',
      });
    }

    const history = await validationService.getPatientHistoryForConsultation(token);

    logger.info({
      consultaCount: history.consultas.length,
      documentoCount: history.documentos.length,
    }, 'Historial accedido con token temporal');

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    logger.error({ error }, 'Error obteniendo historial con token temporal');
    res.status(400).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * @openapi
 * /api/v1/wallet/temporal/revoke:
 *   post:
 *     summary: Revocar acceso temporal
 *     description: Revoca el acceso temporal al Health Wallet después de finalizar la consulta
 *     tags: [Health Wallet - Temporal Access]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - citaId
 *             properties:
 *               citaId:
 *                 type: string
 *                 description: ID de la cita finalizada
 *     responses:
 *       200:
 *         description: Acceso revocado exitosamente
 *       400:
 *         description: Error al revocar acceso
 */
router.post('/revoke', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { citaId } = req.body;

    if (!citaId) {
      return res.status(400).json({
        success: false,
        error: 'citaId es requerido',
      });
    }

    await validationService.revokeAccessAfterConsultation(citaId);

    logger.info({ citaId }, 'Acceso temporal revocado');

    res.json({
      success: true,
      message: 'Acceso temporal revocado exitosamente',
    });
  } catch (error) {
    logger.error({ error }, 'Error revocando acceso temporal');
    res.status(400).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * @openapi
 * /api/v1/wallet/temporal/documents:
 *   get:
 *     summary: Listar documentos del paciente con token temporal
 *     description: Retorna la lista de documentos del paciente usando un token temporal válido
 *     tags: [Health Wallet - Temporal Access]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Token JWT temporal
 *     responses:
 *       200:
 *         description: Documentos obtenidos exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       tipo:
 *                         type: string
 *                       fechaEmision:
 *                         type: string
 *                         format: date-time
 *                       consultaId:
 *                         type: string
 *       400:
 *         description: Token inválido o sin permisos
 */
router.get('/documents', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Token es requerido',
      });
    }

    // Obtener historial completo y extraer solo documentos
    const history = await validationService.getPatientHistoryForConsultation(token);

    // Transformar documentos para incluir URLs de descarga
    const documentos = history.documentos.map((doc: any) => ({
      id: doc.id,
      tipo: doc.tipo,
      fechaEmision: doc.fechaEmision,
      consultaId: doc.consulta?.id,
      consultaMotivo: doc.consulta?.motivoConsulta,
      // URL para descarga on-demand
      downloadUrl: `/api/v1/storage/download/${doc.id}`,
      viewUrl: `/api/v1/storage/view/${doc.id}`,
    }));

    logger.info({
      documentoCount: documentos.length,
    }, 'Documentos listados con token temporal');

    res.json({
      success: true,
      data: documentos,
    });
  } catch (error) {
    logger.error({ error }, 'Error obteniendo documentos con token temporal');
    res.status(400).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * @openapi
 * /api/v1/wallet/temporal/check/{citaId}:
 *   get:
 *     summary: Verificar si hay una conexión temporal activa para una cita
 *     description: Retorna true si existe una conexión temporal activa para la cita especificada
 *     tags: [Health Wallet - Temporal Access]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: citaId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la cita
 *     responses:
 *       200:
 *         description: Estado de la conexión temporal
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     hasActiveConnection:
 *                       type: boolean
 */
router.get('/check/:citaId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { citaId } = req.params;

    // Validar que citaId es un string
    if (typeof citaId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'citaId inválido'
      });
    }

    const hasActiveConnection = await validationService.hasActiveTemporalConnection(citaId);

    res.json({
      success: true,
      data: {
        hasActiveConnection,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Error verificando conexión temporal');
    res.status(500).json({
      success: false,
      error: 'Error al verificar conexión temporal',
    });
  }
});

export default router;
