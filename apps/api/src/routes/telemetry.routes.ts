// apps/api/src/routes/telemetry.routes.ts
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { telemetryService } from '../services/telemetry/metrics.service.js';

const router: Router = Router();

/**
 * POST /telemetry/session-end
 * Recibe reporte final de calidad de la teleconsulta
 */
router.post('/session-end', 
  authMiddleware, 
  async (req: any,  res) => {
    try {
      const { 
        sessionId, 
        consultaId, 
        jitter, 
        latency, 
        packetLoss, 
        videoQuality, 
        audioQuality, 
        duration, 
        metadata 
      } = req.body;

      if (!sessionId || !duration) {
        return res.status(400).json({
          success: false, 
          error: 'Datos de sesión incompletos'
        });
      }

      await telemetryService.persistMetrics({
        sessionId,
        consultaId,
        userId: req.user.id,
        jitter: jitter || 0,
        latency: latency || 0,
        packetLoss: packetLoss || 0,
        videoQuality,
        audioQuality,
        duration,
        metadata
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({
        success: false, 
        error: error.message
      });
    }
  }
);

export default router;
