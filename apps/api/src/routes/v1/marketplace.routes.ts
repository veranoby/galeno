// apps/api/src/routes/v1/marketplace.routes.ts

import { Router, Request, Response, NextFunction } from 'express';
import { marketplaceService, ModuleType } from '../../services/marketplace/marketplace.service.js';
import { logger } from '../../utils/logger.js';

const router: Router = Router();

/**
 * Middleware para obtener usuario autenticado
 */
function getAuthenticatedUser(req: Request): string {
  const userId = (req as any).user?.id || (req as any).userId;
  if (!userId) {
    throw new Error('User not authenticated');
  }
  return userId;
}

/**
 * @openapi
 * /marketplace/modules:
 *   get:
 *     summary: Obtiene todos los módulos disponibles en el marketplace
 *     tags: [Marketplace]
 *     responses:
 *       200:
 *         description: Lista de módulos disponibles
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/MarketplaceModule'
 */
router.get('/modules', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const modules = await marketplaceService.getAllModules();
    res.json(modules);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /marketplace/modules/category/{category}:
 *   get:
 *     summary: Obtiene módulos por categoría
 *     tags: [Marketplace]
 *     parameters:
 *       - in: path
 *         name: category
 *         required: true
 *         schema:
 *           type: string
 *           enum: [communication, ai, video, migration]
 *     responses:
 *       200:
 *         description: Lista de módulos de la categoría
 */
router.get(
  '/modules/category/:category',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const category = Array.isArray(req.params.category)
        ? req.params.category[0]
        : req.params.category;
      const modules = await marketplaceService.getModulesByCategory(category);
      res.json(modules);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /marketplace/modules/{id}:
 *   get:
 *     summary: Obtiene un módulo por su ID
 *     tags: [Marketplace]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Configuración del módulo
 *       404:
 *         description: Módulo no encontrado
 */
router.get('/modules/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;
    const module = await marketplaceService.getModuleById(id);

    if (!module) {
      return res.status(404).json({ error: 'Module not found' });
    }

    res.json(module);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /marketplace/status:
 *   get:
 *     summary: Obtiene el estado de activación de módulos del usuario
 *     tags: [Marketplace]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estado de activación de módulos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ModuleActivationStatus'
 */
router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getAuthenticatedUser(req);
    const status = await marketplaceService.getModuleActivationStatus(userId);
    res.json(status);
  } catch (error: any) {
    logger.error({ event: 'marketplace_status_error', error: error.message });
    next(error);
  }
});

/**
 * @openapi
 * /marketplace/active:
 *   get:
 *     summary: Obtiene los módulos activados del usuario
 *     tags: [Marketplace]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de módulos activados
 */
router.get('/active', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getAuthenticatedUser(req);
    const activeModules = await marketplaceService.getActiveModules(userId);
    res.json(activeModules);
  } catch (error: any) {
    logger.error({ event: 'marketplace_active_error', error: error.message });
    next(error);
  }
});

/**
 * @openapi
 * /marketplace/activate:
 *   post:
 *     summary: Activa un módulo para el usuario
 *     tags: [Marketplace]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - moduleId
 *             properties:
 *               moduleId:
 *                 type: string
 *                 enum: [whatsapp-business, ia-pro, webrtc-pro, migracion-pro]
 *     responses:
 *       200:
 *         description: Módulo activado exitosamente
 *       400:
 *         description: Plan no compatible o módulo ya activado
 */
router.post('/activate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getAuthenticatedUser(req);
    const { moduleId } = req.body;

    if (!moduleId) {
      return res.status(400).json({
        error: 'Missing required field: moduleId'
      });
    }

    // Validar que moduleId sea un valor válido
    const validModuleIds = ['whatsapp-business', 'ia-pro', 'webrtc-pro', 'migracion-pro'];
    if (!validModuleIds.includes(moduleId)) {
      return res.status(400).json({
        error: `Invalid moduleId. Valid values: ${validModuleIds.join(', ')}`
      });
    }

    const result = await marketplaceService.activateModule(userId, moduleId as ModuleType);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error: any) {
    logger.error({ event: 'marketplace_activate_error', error: error.message });
    next(error);
  }
});

/**
 * @openapi
 * /marketplace/deactivate:
 *   post:
 *     summary: Desactiva un módulo para el usuario
 *     tags: [Marketplace]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - moduleId
 *             properties:
 *               moduleId:
 *                 type: string
 *                 enum: [whatsapp-business, ia-pro, webrtc-pro, migracion-pro]
 *     responses:
 *       200:
 *         description: Módulo desactivado exitosamente
 *       400:
 *         description: Módulo no está activado
 */
router.post('/deactivate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getAuthenticatedUser(req);
    const { moduleId } = req.body;

    if (!moduleId) {
      return res.status(400).json({
        error: 'Missing required field: moduleId'
      });
    }

    // Validar que moduleId sea un valor válido
    const validModuleIds = ['whatsapp-business', 'ia-pro', 'webrtc-pro', 'migracion-pro'];
    if (!validModuleIds.includes(moduleId)) {
      return res.status(400).json({
        error: `Invalid moduleId. Valid values: ${validModuleIds.join(', ')}`
      });
    }

    const result = await marketplaceService.deactivateModule(userId, moduleId as ModuleType);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error: any) {
    logger.error({ event: 'marketplace_deactivate_error', error: error.message });
    next(error);
  }
});

/**
 * @openapi
 * /marketplace/check/{moduleId}:
 *   get:
 *     summary: Verifica si un módulo está activado para el usuario
 *     tags: [Marketplace]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: moduleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Estado del módulo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 active:
 *                   type: boolean
 */
router.get(
  '/check/:moduleId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getAuthenticatedUser(req);
      const moduleId = Array.isArray(req.params.moduleId)
        ? req.params.moduleId[0]
        : req.params.moduleId;

      const isActive = await marketplaceService.isModuleActive(userId, moduleId as ModuleType);

      res.json({ active: isActive });
    } catch (error: any) {
      logger.error({ event: 'marketplace_check_error', error: error.message });
      next(error);
    }
  }
);

export default router;
