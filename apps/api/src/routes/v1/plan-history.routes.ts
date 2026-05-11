import { Router } from 'express';
import { authMiddleware, requireRole } from '../../middleware/auth.js';
import { PlanChangeHistoryService } from '../../services/plan/plan-change-history.service.js';
import { logger } from '../../utils/logger.js';

const router: Router = Router();

/**
 * @openapi
 * /api/v1/plan/history:
 *   get:
 *     summary: Get plan change history
 *     tags: [Plan]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of records to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of records to skip
 *     responses:
 *       200:
 *         description: Plan change history
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 history:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PlanChangeHistory'
 *                 totalCount:
 *                   type: integer
 */
router.get('/history',  authMiddleware,  requireRole('DOCTOR',  'ADMIN'), async (req,  res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const userId = req.user!.id;

    // Get user's account ID
    const user = await (await import('../../config/database.js')).default.cuenta.findUnique({
      where: { id: userId },
      select: { id: true }
    });

    if (!user || !user.id) {
      return res.status(404).json({ error: 'User account not found' });
    }

    const history = await PlanChangeHistoryService.getPlanChangeHistory(
      user.id,
      parseInt(limit as string) || 50,
      parseInt(offset as string) || 0
    );

    // Get total count for pagination
    const totalCount = await (await import('../../config/database.js')).default.auditLog.count({
      where: {
        resourceId: user.id,
        action: 'PLAN_CHANGE'
      }
    });

    res.json({ history,  totalCount });
  } catch (error) {
    logger.error({ error },  'Error fetching plan change history');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /api/v1/plan/history/stats:
 *   get:
 *     summary: Get plan change statistics
 *     tags: [Plan]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Plan change statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalChanges:
 *                   type: number
 *                 currentPlan:
 *                   type: string
 *                 changeFrequency:
 *                   type: object
 *                   properties:
 *                     daily:
 *                       type: number
 *                     weekly:
 *                       type: number
 *                     monthly:
 *                       type: number
 */
router.get('/history/stats',  authMiddleware,  requireRole('DOCTOR',  'ADMIN'), async (req,  res) => {
  try {
    const userId = req.user!.id;

    // Get user's account ID
    const user = await (await import('../../config/database.js')).default.cuenta.findUnique({
      where: { id: userId },
      select: { id: true }
    });

    if (!user || !user.id) {
      return res.status(404).json({ error: 'User account not found' });
    }

    const stats = await PlanChangeHistoryService.getPlanChangeStats(user.id);

    res.json(stats);
  } catch (error) {
    logger.error({ error },  'Error fetching plan change stats');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;