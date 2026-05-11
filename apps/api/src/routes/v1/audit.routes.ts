import { Router } from 'express';
import { authMiddleware, requireRole } from '../../middleware/auth.js';
import { AuditService } from '../../services/audit/audit.service.js';
import { AuditAction, ResourceType } from '@prisma/client';
import { logger } from '../../utils/logger.js';
import prisma from '../../config/database.js';

const router: Router = Router();

/**
 * @openapi
 * /api/v1/audit/logs:
 *   get:
 *     summary: Get audit logs
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by user ID
 *       - in: query
 *         name: resourceType
 *         schema:
 *           type: string
 *           enum: [paciente, consulta, documento, usuario, plan, pago]
 *         description: Filter by resource type
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *           enum: [login, logout, resource_access, resource_create, resource_update, resource_delete, permission_change, role_change, plan_change, payment_action]
 *         description: Filter by action type
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by start date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by end date
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
 *         description: Audit logs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 logs:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AuditLog'
 *                 totalCount:
 *                   type: integer
 */
router.get('/logs',  
  authMiddleware,  
  requireRole('ADMIN'), 
  async (req,  res) => {
    try {
      const {
        userId,
        resourceType,
        action,
        startDate,
        endDate,
        limit = 50,
        offset = 0
      } = req.query;

      const filters: any = {};
      if (userId) filters.userId = userId as string;
      if (resourceType) filters.resourceType = resourceType as ResourceType;
      if (action) filters.action = action as AuditAction;
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);

      const logs = await AuditService.getAllLogs(
        filters, 
        parseInt(limit as string) || 50,
        parseInt(offset as string) || 0
      );

      // Get total count for pagination
      const totalCount = await prisma.auditLog.count({
        where: {
          userId: filters.userId || undefined, 
          resourceType: filters.resourceType || undefined, 
          action: filters.action || undefined, 
          timestamp: filters.startDate || filters.endDate ? {
            gte: filters.startDate, 
            lte: filters.endDate
          } : undefined
        }
      });

      res.json({ logs,  totalCount });
    } catch (error) {
      logger.error({ error },  'Error fetching audit logs');
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * @openapi
 * /api/v1/audit/user/{id}:
 *   get:
 *     summary: Get audit logs for a specific user
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
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
 *         description: User audit logs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 logs:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AuditLog'
 */
router.get('/user/:id',
  authMiddleware,
  requireRole('ADMIN'),
  async (req,  res) => {
    try {
      const { id } = req.params;

      if (typeof id !== 'string') {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      const { limit = 50, offset = 0 } = req.query;

      const logs = await AuditService.getUserLogs(
        id,
        parseInt(limit as string) || 50,
        parseInt(offset as string) || 0
      );

      res.json({ logs });
    } catch (error) {
      const userId = req.params.id;
      if (typeof userId === 'string') {
        logger.error({ error, userId }, 'Error fetching user audit logs');
      } else {
        logger.error({ error }, 'Error fetching user audit logs');
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * @openapi
 * /api/v1/audit/resource/{type}/{id}:
 *   get:
 *     summary: Get audit logs for a specific resource
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [paciente, consulta, documento, usuario, plan, pago]
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
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
 *         description: Resource audit logs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 logs:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AuditLog'
 */
router.get('/resource/:type/:id',
  authMiddleware,
  requireRole('ADMIN'),
  async (req,  res) => {
    try {
      const { type, id } = req.params;

      if (typeof type !== 'string' || typeof id !== 'string') {
        return res.status(400).json({ error: 'Invalid parameters' });
      }

      const { limit = 50, offset = 0 } = req.query;

      if (!Object.values(ResourceType).includes(type as ResourceType)) {
        return res.status(400).json({
          error: 'Invalid resource type',
          message: `Resource type must be one of: ${Object.values(ResourceType).join(',  ')}`
        });
      }

      const logs = await AuditService.getResourceLogs(
        type as ResourceType,
        id,
        parseInt(limit as string) || 50,
        parseInt(offset as string) || 0
      );

      res.json({ logs });
    } catch (error) {
      const resourceType = req.params.type;
      const resourceId = req.params.id;
      logger.error({ error,  resourceType,  resourceId },  'Error fetching resource audit logs');
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * @openapi
 * /api/v1/audit/action/{action}:
 *   get:
 *     summary: Get audit logs for a specific action
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: action
 *         required: true
 *         schema:
 *           type: string
 *           enum: [login, logout, resource_access, resource_create, resource_update, resource_delete, permission_change, role_change, plan_change, payment_action]
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
 *         description: Action audit logs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 logs:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AuditLog'
 */
router.get('/action/:action',  
  authMiddleware,  
  requireRole('ADMIN'), 
  async (req,  res) => {
    try {
      const { action } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      if (!Object.values(AuditAction).includes(action as AuditAction)) {
        return res.status(400).json({ 
          error: 'Invalid action type', 
          message: `Action must be one of: ${Object.values(AuditAction).join(',  ')}` 
        });
      }

      const logs = await AuditService.getLogsByAction(
        action as AuditAction, 
        parseInt(limit as string) || 50,
        parseInt(offset as string) || 0
      );

      res.json({ logs });
    } catch (error) {
      logger.error({ error,  action: req.params.action },  'Error fetching action audit logs');
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * @openapi
 * /api/v1/audit/cleanup:
 *   post:
 *     summary: Clean old audit logs
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               retentionDays:
 *                 type: integer
 *                 default: 90
 *                 description: Number of days to retain logs
 *     responses:
 *       200:
 *         description: Cleanup result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 deletedCount:
 *                   type: integer
 *                   description: Number of logs deleted
 */
router.post('/cleanup',  
  authMiddleware,  
  requireRole('ADMIN'), 
  async (req,  res) => {
    try {
      const { retentionDays = 90 } = req.body;

      const deletedCount = await AuditService.cleanOldLogs(retentionDays);

      logger.info({ 
        event: 'audit_cleanup',  
        retentionDays,  
        deletedCount 
      });

      res.json({ deletedCount });
    } catch (error) {
      logger.error({ error },  'Error cleaning audit logs');
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;