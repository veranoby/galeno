import { Router } from 'express';
import { authMiddleware, requireRole } from '../../middleware/auth.js';
import { PlanLimitNotificationService } from '../../services/notifications/plan-limit-notification.service.js';
import { logger } from '../../utils/logger.js';

const router: Router = Router();

/**
 * @openapi
 * /api/v1/notifications/limits:
 *   get:
 *     summary: Get plan limit notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: acknowledged
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Whether to include acknowledged notifications
 *     responses:
 *       200:
 *         description: Plan limit notifications
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 notifications:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PlanLimitNotification'
 */
router.get('/limits',  authMiddleware,  requireRole('DOCTOR',  'ADMIN',  'ASISTENTE',  'ENFERMERA'), async (req,  res) => {
  try {
    const { acknowledged = 'false' } = req.query;
    const userId = req.user!.id;

    const notifications = await PlanLimitNotificationService.getUserNotifications(
      userId, 
      acknowledged === 'true'
    );

    res.json({ notifications });
  } catch (error) {
    logger.error({ error },  'Error fetching plan limit notifications');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /api/v1/notifications/limits/check:
 *   get:
 *     summary: Check if user is near plan limits
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Status of plan limits
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 nearLimit:
 *                   type: boolean
 *                 notifications:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PlanLimitNotification'
 */
router.get('/check',  authMiddleware,  requireRole('DOCTOR',  'ADMIN',  'ASISTENTE',  'ENFERMERA'), async (req,  res) => {
  try {
    const userId = req.user!.id;

    const notifications = await PlanLimitNotificationService.checkAndNotifyLimits(userId);
    const nearLimit = notifications.length > 0;

    res.json({ 
      nearLimit, 
      notifications 
    });
  } catch (error) {
    logger.error({ error },  'Error checking plan limits');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /api/v1/notifications/limits/{id}/acknowledge:
 *   post:
 *     summary: Acknowledge a plan limit notification
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification acknowledged
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 */
router.post('/:id/acknowledge',  authMiddleware,  requireRole('DOCTOR',  'ADMIN',  'ASISTENTE',  'ENFERMERA'), async (req,  res) => {
  try {
    const { id } = req.params as { id: string };
    const userId = req.user!.id;

    const success = await PlanLimitNotificationService.acknowledgeNotification(id,  userId);

    if (!success) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error({ error },  'Error acknowledging notification');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /api/v1/notifications/limits/acknowledge-all:
 *   post:
 *     summary: Acknowledge all notifications for a resource type
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               resourceType:
 *                 type: string
 *                 enum: [doctors, assistants, storage]
 *     responses:
 *       200:
 *         description: Notifications acknowledged
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 */
router.post('/acknowledge-all',  authMiddleware,  requireRole('DOCTOR',  'ADMIN',  'ASISTENTE',  'ENFERMERA'), async (req,  res) => {
  try {
    const { resourceType } = req.body;
    const userId = req.user!.id;

    // Validate resource type
    if (!['doctors',  'assistants',  'storage'].includes(resourceType)) {
      return res.status(400).json({ 
        error: 'Invalid resource type', 
        message: 'Resource type must be one of: doctors,  assistants,  storage'
      });
    }

    const success = await PlanLimitNotificationService.acknowledgeAllForResource(
      userId,  
      resourceType
    );

    res.json({ success: true });
  } catch (error) {
    logger.error({ error },  'Error acknowledging all notifications');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;