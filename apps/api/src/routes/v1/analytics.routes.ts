/**
 * Analytics routes for teleconsulta metrics and monitoring
 *
 * Endpoints:
 * - GET /api/v1/analytics/teleconsulta - Get teleconsulta metrics dashboard data
 * - GET /api/v1/analytics/teleconsulta/sessions - Get all teleconsulta sessions
 * - GET /api/v1/analytics/teleconsulta/session/:citaId - Get specific session metrics
 * - GET /api/v1/analytics/sse/connections - Get SSE connection metrics
 * - GET /api/v1/analytics/sse/status - Get SSE connection status overview
 * - POST /api/v1/analytics/teleconsulta/start - Start teleconsulta session tracking
 * - POST /api/v1/analytics/teleconsulta/end - End teleconsulta session tracking
 * - POST /api/v1/analytics/teleconsulta/metrics - Record session metrics
 */

import { Router, Request, Response } from 'express';
import { authMiddleware, type AuthRequest } from '../../middleware/auth.js';
import { logger } from '../../utils/logger.js';
import { sseMonitoringService } from '../../services/monitoring/sse-monitoring.service.js';
import { sseRegistry } from '../../services/sse/sse-registry.js';
import { MetricsService } from '../../services/monitoring/metrics.service.js';

const router: Router = Router();

/**
 * @openapi
 * /api/v1/analytics/teleconsulta:
 *   get:
 *     summary: Get teleconsulta metrics dashboard data
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Aggregated teleconsulta metrics
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
 *                     totalActiveConnections:
 *                       type: number
 *                     totalSessions:
 *                       type: number
 *                     avgLatency:
 *                       type: number
 *                     avgJitter:
 *                       type: number
 *                     avgDuration:
 *                       type: number
 *                     totalReconnections:
 *                       type: number
 *                     silentDisconnections:
 *                       type: number
 *                     connectionQualityDistribution:
 *                       type: object
 */
router.get('/teleconsulta',
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const aggregatedMetrics = sseMonitoringService.getAggregatedMetrics();
      
      // Record metric for dashboard access
      MetricsService.incrementCounter('analytics.dashboard_accessed', {
        userId: req.user!.id,
        type: 'teleconsulta'
      });

      res.json({
        success: true,
        data: aggregatedMetrics
      });
    } catch (error) {
      logger.error({ error }, 'Error fetching teleconsulta metrics');
      MetricsService.trackError(error as Error, { endpoint: '/api/v1/analytics/teleconsulta' });
      
      res.status(500).json({
        success: false,
        error: 'Error fetching teleconsulta metrics'
      });
    }
  }
);

/**
 * @openapi
 * /api/v1/analytics/teleconsulta/sessions:
 *   get:
 *     summary: Get all teleconsulta sessions
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 50
 *         description: Maximum number of sessions to return
 *     responses:
 *       200:
 *         description: List of teleconsulta sessions
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
 */
router.get('/teleconsulta/sessions',
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const sessions = sseMonitoringService.getAllTeleconsultaSessions(limit);
      
      res.json({
        success: true,
        data: sessions
      });
    } catch (error) {
      logger.error({ error }, 'Error fetching teleconsulta sessions');
      MetricsService.trackError(error as Error, { endpoint: '/api/v1/analytics/teleconsulta/sessions' });
      
      res.status(500).json({
        success: false,
        error: 'Error fetching teleconsulta sessions'
      });
    }
  }
);

/**
 * @openapi
 * /api/v1/analytics/teleconsulta/session/:citaId:
 *   get:
 *     summary: Get specific teleconsulta session metrics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: citaId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the appointment
 *     responses:
 *       200:
 *         description: Session metrics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
router.get('/teleconsulta/session/:citaId',
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const { citaId } = req.params;
      
      // Handle case where citaId could be an array
      const sessionCitaId = Array.isArray(citaId) ? citaId[0] : citaId;
      
      if (!sessionCitaId) {
        return res.status(400).json({
          success: false,
          error: 'citaId is required'
        });
      }
      
      const session = sseMonitoringService.getTeleconsultaSession(sessionCitaId);
      
      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Session not found'
        });
      }

      res.json({
        success: true,
        data: session
      });
    } catch (error) {
      logger.error({ error }, 'Error fetching session metrics');
      MetricsService.trackError(error as Error, { endpoint: `/api/v1/analytics/teleconsulta/session/${req.params.citaId}` });
      
      res.status(500).json({
        success: false,
        error: 'Error fetching session metrics'
      });
    }
  }
);

/**
 * @openapi
 * /api/v1/analytics/sse/connections:
 *   get:
 *     summary: Get SSE connection metrics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: SSE connection metrics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
router.get('/sse/connections',
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const connections = sseMonitoringService.getAllConnectionMetrics();
      
      res.json({
        success: true,
        data: connections
      });
    } catch (error) {
      logger.error({ error }, 'Error fetching SSE connection metrics');
      MetricsService.trackError(error as Error, { endpoint: '/api/v1/analytics/sse/connections' });
      
      res.status(500).json({
        success: false,
        error: 'Error fetching SSE connection metrics'
      });
    }
  }
);

/**
 * @openapi
 * /api/v1/analytics/sse/status:
 *   get:
 *     summary: Get SSE connection status overview
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: SSE status overview
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
router.get('/sse/status',
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const activeConnections = sseRegistry.getActiveConnections();
      const connectedUsers = sseRegistry.getConnectedUsers();
      const connectionMetrics = sseMonitoringService.getAllConnectionMetrics();
      
      const healthyConnections = connectionMetrics.filter(c => !c.isSilentDisconnection).length;
      const silentDisconnections = connectionMetrics.filter(c => c.isSilentDisconnection).length;
      
      res.json({
        success: true,
        data: {
          activeConnections,
          connectedUsers,
          healthyConnections,
          silentDisconnections,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error({ error }, 'Error fetching SSE status');
      MetricsService.trackError(error as Error, { endpoint: '/api/v1/analytics/sse/status' });
      
      res.status(500).json({
        success: false,
        error: 'Error fetching SSE status'
      });
    }
  }
);

/**
 * @openapi
 * /api/v1/analytics/teleconsulta/start:
 *   post:
 *     summary: Start teleconsulta session tracking
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - citaId
 *               - pacienteId
 *             properties:
 *               citaId:
 *                 type: string
 *               pacienteId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Session tracking started
 */
router.post('/teleconsulta/start',
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const { citaId, pacienteId } = req.body;
      const doctorId = req.user!.id;

      if (!citaId || !pacienteId) {
        return res.status(400).json({
          success: false,
          error: 'citaId and pacienteId are required'
        });
      }

      sseMonitoringService.startTeleconsultaSession(citaId, doctorId, pacienteId);

      logger.info({
        event: 'teleconsulta_tracking_started',
        citaId,
        doctorId,
        pacienteId
      });

      res.status(201).json({
        success: true,
        message: 'Teleconsulta session tracking started'
      });
    } catch (error) {
      logger.error({ error }, 'Error starting teleconsulta tracking');
      MetricsService.trackError(error as Error, { endpoint: '/api/v1/analytics/teleconsulta/start' });
      
      res.status(500).json({
        success: false,
        error: 'Error starting teleconsulta tracking'
      });
    }
  }
);

/**
 * @openapi
 * /api/v1/analytics/teleconsulta/end:
 *   post:
 *     summary: End teleconsulta session tracking
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
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
 *     responses:
 *       200:
 *         description: Session tracking ended
 */
router.post('/teleconsulta/end',
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const { citaId } = req.body;

      if (!citaId) {
        return res.status(400).json({
          success: false,
          error: 'citaId is required'
        });
      }

      const session = sseMonitoringService.endTeleconsultaSession(citaId);

      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Session not found'
        });
      }

      res.json({
        success: true,
        data: session
      });
    } catch (error) {
      logger.error({ error }, 'Error ending teleconsulta tracking');
      MetricsService.trackError(error as Error, { endpoint: '/api/v1/analytics/teleconsulta/end' });
      
      res.status(500).json({
        success: false,
        error: 'Error ending teleconsulta tracking'
      });
    }
  }
);

/**
 * @openapi
 * /api/v1/analytics/teleconsulta/metrics:
 *   post:
 *     summary: Record teleconsulta session metrics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
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
 *               latency:
 *                 type: number
 *               jitter:
 *                 type: number
 *               reconnection:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Metrics recorded
 */
router.post('/teleconsulta/metrics',
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const { citaId, latency, jitter, reconnection } = req.body;
      const userId = req.user!.id;

      if (!citaId) {
        return res.status(400).json({
          success: false,
          error: 'citaId is required'
        });
      }

      if (latency !== undefined) {
        sseMonitoringService.recordLatency(citaId, latency);
      }

      if (jitter !== undefined) {
        sseMonitoringService.recordJitter(citaId, jitter);
      }

      if (reconnection) {
        sseMonitoringService.recordReconnection(userId, citaId);
      }

      res.json({
        success: true,
        message: 'Metrics recorded successfully'
      });
    } catch (error) {
      logger.error({ error }, 'Error recording teleconsulta metrics');
      MetricsService.trackError(error as Error, { endpoint: '/api/v1/analytics/teleconsulta/metrics' });
      
      res.status(500).json({
        success: false,
        error: 'Error recording teleconsulta metrics'
      });
    }
  }
);

export default router;
