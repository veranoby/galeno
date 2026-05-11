import { Router } from 'express';
import { authMiddleware, requireRole } from '../../middleware/auth.js';
import { getEnhancedNotificationService } from '../../services/notifications/enhanced-notification.service.js';
import { logger } from '../../utils/logger.js';
import prisma from '../../config/database.js';
import { PrismaNotificationRepository } from '../../repositories/index.js';
import type { SendNotificationRequest } from '@galeno/shared-types';

const router: Router = Router();

// Initialize enhanced notification service with repository
const notificationRepo = new PrismaNotificationRepository(prisma);
const notificationService = getEnhancedNotificationService(prisma, notificationRepo);

/**
 * @openapi
 * /api/v1/notifications/send:
 *   post:
 *     summary: Send a notification to a user
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
 *               userId:
 *                 type: string
 *                 description: ID of the user to notify
 *               title:
 *                 type: string
 *                 description: Title of the notification
 *               message:
 *                 type: string
 *                 description: Content of the notification
 *               type:
 *                 type: string
 *                 enum: [info, success, warning, error, system]
 *                 description: Type of notification
 *               method:
 *                 type: string
 *                 enum: [push, sse, toast]
 *                 description: Delivery method for the notification
 *               data:
 *                 type: object
 *                 description: Additional data to include with the notification
 *     responses:
 *       200:
 *         description: Notification sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 notificationId:
 *                   type: string
 *                   description: ID of the created notification
 *                 deliveredMethods:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Methods through which the notification was delivered
 */
router.post('/send', authMiddleware, requireRole('DOCTOR', 'ADMIN', 'ASISTENTE', 'ENFERMERA'), async (req, res) => {
  try {
    const { userId, title, message, type, method, data }: SendNotificationRequest = req.body;
    const requestingUserId = req.user!.id;

    // Validate required fields
    if (!userId || !title || !message || !type) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, title, message, and type are required'
      });
    }

    // Authorization: Users can only send notifications to themselves or if they're admin
    const requestingUser = await prisma.cuenta.findUnique({
      where: { id: requestingUserId },
      select: { rol: true }
    });

    if (requestingUser?.rol !== 'ADMIN' && requestingUserId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to send notifications to this user'
      });
    }

    // Send the notification
    const result = await notificationService.sendNotification({
      userId,
      title,
      message,
      type,
      method,
      data
    });

    res.json(result);
  } catch (error) {
    logger.error({ error }, 'Error sending notification');
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

/**
 * @openapi
 * /api/v1/notifications:
 *   get:
 *     summary: Get user notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of notifications to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of notifications to skip
 *     responses:
 *       200:
 *         description: User notifications
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 notifications:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Notification'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     offset:
 *                       type: integer
 */
router.get('/', authMiddleware, requireRole('DOCTOR', 'ADMIN', 'ASISTENTE', 'ENFERMERA'), async (req, res) => {
  try {
    const userId = req.user!.id;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const notifications = await notificationService.getUserNotifications(userId, limit, offset);
    const total = await prisma.notificacion.count({ where: { userId } });

    res.json({
      notifications,
      meta: {
        total,
        limit,
        offset
      }
    });
  } catch (error) {
    logger.error({ error }, 'Error getting user notifications');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /api/v1/notifications/unread-count:
 *   get:
 *     summary: Get unread notification count
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread notification count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 */
router.get('/unread-count', authMiddleware, requireRole('DOCTOR', 'ADMIN', 'ASISTENTE', 'ENFERMERA'), async (req, res) => {
  try {
    const userId = req.user!.id;
    const count = await notificationService.getUnreadCount(userId);

    res.json({ count });
  } catch (error) {
    logger.error({ error }, 'Error getting unread notification count');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /api/v1/notifications/{id}/read:
 *   patch:
 *     summary: Mark a notification as read
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
 *         description: Notification marked as read
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 */
router.patch('/:id/read', authMiddleware, requireRole('DOCTOR', 'ADMIN', 'ASISTENTE', 'ENFERMERA'), async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const userId = req.user!.id;

    const success = await notificationService.markAsRead(id, userId);

    if (!success) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Error marking notification as read');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /api/v1/notifications/read-all:
 *   patch:
 *     summary: Mark all notifications as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 */
router.patch('/read-all', authMiddleware, requireRole('DOCTOR', 'ADMIN', 'ASISTENTE', 'ENFERMERA'), async (req, res) => {
  try {
    const userId = req.user!.id;

    const success = await notificationService.markAllAsRead(userId);

    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Error marking all notifications as read');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /api/v1/notifications/preferences:
 *   get:
 *     summary: Get user notification preferences
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User notification preferences
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotificationPreferences'
 */
router.get('/preferences', authMiddleware, requireRole('DOCTOR', 'ADMIN', 'ASISTENTE', 'ENFERMERA'), async (req, res) => {
  try {
    const userId = req.user!.id;

    const preferences = await notificationService.getPreferences(userId);

    res.json({ preferences });
  } catch (error) {
    logger.error({ error }, 'Error getting notification preferences');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /api/v1/notifications/preferences:
 *   put:
 *     summary: Update user notification preferences
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NotificationPreferences'
 *     responses:
 *       200:
 *         description: Notification preferences updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotificationPreferences'
 */
router.put('/preferences', authMiddleware, requireRole('DOCTOR', 'ADMIN', 'ASISTENTE', 'ENFERMERA'), async (req, res) => {
  try {
    const userId = req.user!.id;
    const preferences = req.body;

    const updatedPreferences = await notificationService.updatePreferences(userId, preferences);

    res.json({ preferences: updatedPreferences });
  } catch (error) {
    logger.error({ error }, 'Error updating notification preferences');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;