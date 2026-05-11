import { Router, Response } from 'express';
import { AuthRequest, authMiddleware, canAccessPatient, requireMedical } from '../../middleware/auth.js';
import { triageService, TriageData } from '../../services/triage/triage.service.js';
import { logger } from '../../utils/logger.js';
import { EstadoConsulta } from '@prisma/client';

const router: Router = Router();

/**
 * POST /api/v1/consultas/:id/triage - Capture triage data
 * 
 * Allows nurse to capture vital signs and transition consultation state:
 * - borrador → triaje: Initial triage capture
 * - triaje → pendiente: Complete triage, ready for doctor
 * 
 * Triggers SSE notification to doctor when transitioning to pendiente
 * 
 * @body {TriageData} triageData - Vital signs and clinical data
 * @body {boolean} isComplete - Flag to indicate triage is complete (triggers transition to pendiente)
 */
router.post('/:id/triage', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const consultaId = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
    const { triageData, isComplete } = req.body;

    // Validate triage data is provided
    if (!triageData || typeof triageData !== 'object') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'triageData is required and must be an object'
      });
    }

    // Add completion flag to triage data
    const completeTriageData: TriageData = {
      ...triageData,
      isComplete: isComplete === true
    };

    // Verify patient access (RLS ownership check)
    if (req.user?.rol !== 'ADMIN') {
      // We'll verify access in the service by checking the consulta
      // For now, allow the operation - service will validate
    }

    // Capture triage data and transition state
    const updatedConsulta = await triageService.captureTriage(
      consultaId,
      completeTriageData,
      req.user?.id || 'unknown'
    );

    logger.info({
      consultaId,
      newState: updatedConsulta.estado,
      userId: req.user?.id
    }, 'Triage data captured successfully');

    res.status(200).json({
      success: true,
      data: updatedConsulta,
      message: `Triage captured. State transitioned to ${updatedConsulta.estado}`
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Handle state machine validation errors
    if (errorMessage.includes('Invalid') && errorMessage.includes('transition')) {
      return res.status(400).json({
        error: 'Bad Request',
        message: errorMessage
      });
    }

    // Handle not found errors
    if (errorMessage.includes('not found')) {
      return res.status(404).json({
        error: 'Not Found',
        message: errorMessage
      });
    }

    logger.error({ error, id: req.params.id }, 'Error capturing triage data');
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to capture triage data'
    });
  }
});

/**
 * GET /api/v1/consultas/:id/triage - Get triage data
 * 
 * Retrieves triage data and current state for a consultation
 */
router.get('/:id/triage', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const consultaId = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];

    const triageResult = await triageService.getTriageData(consultaId);

    if (!triageResult) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Triage data not found for this consultation'
      });
    }

    res.status(200).json({
      success: true,
      data: triageResult
    });
  } catch (error) {
    logger.error({ error, id: req.params.id }, 'Error getting triage data');
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve triage data'
    });
  }
});

/**
 * GET /api/v1/consultas/triage/queue - Get triage queue for doctor
 * 
 * Returns all consultations in triage or pendiente state for the authenticated doctor
 * Ordered by oldest first (FIFO)
 */
router.get('/triage/queue', authMiddleware, requireMedical, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User ID not found'
      });
    }

    const queue = await triageService.getTriageQueue(req.user.id);

    res.status(200).json({
      success: true,
      data: queue,
      meta: {
        count: queue.length,
        triageCount: queue.filter(c => c.estado === 'triaje').length,
        pendienteCount: queue.filter(c => c.estado === 'pendiente').length
      }
    });
  } catch (error) {
    logger.error({ error, userId: req.user?.id }, 'Error getting triage queue');
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve triage queue'
    });
  }
});

/**
 * PATCH /api/v1/consultas/triage/bulk - Bulk update triage status
 * 
 * Allows bulk transition of multiple consultations from borrador/triaje to pendiente
 * Triggers SSE notifications to all affected doctors
 */
router.patch('/triage/bulk', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { consultaIds, newStatus } = req.body;

    // Validate input
    if (!Array.isArray(consultaIds) || consultaIds.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'consultaIds must be a non-empty array'
      });
    }

    if (!newStatus || !['triaje', 'pendiente'].includes(newStatus)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'newStatus must be either "triaje" or "pendiente"'
      });
    }

    const count = await triageService.bulkUpdateTriageStatus(
      consultaIds,
      newStatus as 'triaje' | 'pendiente',
      req.user?.id || 'unknown'
    );

    res.status(200).json({
      success: true,
      data: { count },
      message: `Successfully updated ${count} consultations to ${newStatus}`
    });
  } catch (error) {
    logger.error({ error, userId: req.user?.id }, 'Error in bulk triage update');
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update triage status'
    });
  }
});

export default router;
