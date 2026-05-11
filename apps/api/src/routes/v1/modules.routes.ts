// apps/api/src/routes/v1/modules.routes.ts

import { Router, Request, Response, NextFunction } from 'express';
import { moduleService } from '../../services/module/module.service.js';
import { logger } from '../../utils/logger.js';

const router: Router = Router();

/**
 * @openapi
 * /modules:
 *   get:
 *     summary: Obtiene todos los módulos disponibles
 *     tags: [Modules]
 *     responses:
 *       200:
 *         description: Lista de módulos disponibles
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ModuleConfig'
 */
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const modules = await moduleService.getAllModules();
    res.json(modules);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /modules/specialty/{specialty}:
 *   get:
 *     summary: Obtiene módulos por especialidad
 *     tags: [Modules]
 *     parameters:
 *       - in: path
 *         name: specialty
 *         required: true
 *         schema:
 *           type: string
 *           enum: [odontologia, oftalmologia, pediatria, cardiologia, dermatologia, traumatologia, ginecologia, general]
 *     responses:
 *       200:
 *         description: Lista de módulos de la especialidad
 */
router.get(
  '/specialty/:specialty',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const specialty = Array.isArray(req.params.specialty)
        ? req.params.specialty[0]
        : req.params.specialty;
      const modules = await moduleService.getModulesBySpecialty(
        specialty as any
      );
      res.json(modules);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /modules/{id}:
 *   get:
 *     summary: Obtiene un módulo por su ID
 *     tags: [Modules]
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
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;
    const module = await moduleService.getModuleById(id);

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
 * /modules/data:
 *   post:
 *     summary: Guarda datos de un módulo para un paciente
 *     tags: [Module Data]
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
 *               - pacienteId
 *               - datos
 *             properties:
 *               moduleId:
 *                 type: string
 *               pacienteId:
 *                 type: string
 *               consultaId:
 *                 type: string
 *               datos:
 *                 type: object
 *     responses:
 *       201:
 *         description: Datos guardados exitosamente
 *       400:
 *         description: Datos inválidos
 */
router.post('/data', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { moduleId, pacienteId, consultaId, datos } = req.body;

    if (!moduleId || !pacienteId || !datos) {
      return res.status(400).json({
        error: 'Missing required fields: moduleId, pacienteId, datos'
      });
    }

    // Validar datos del módulo
    const isValid = moduleService.validateModuleData(moduleId, datos);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid module data' });
    }

    const moduleData = await moduleService.saveModuleData({
      moduleId,
      pacienteId,
      consultaId,
      datos,
    });

    res.status(201).json(moduleData);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /modules/data/{moduleId}/{pacienteId}:
 *   get:
 *     summary: Obtiene datos de un módulo para un paciente
 *     tags: [Module Data]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: moduleId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: pacienteId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: consultaId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Datos del módulo
 *       404:
 *         description: Datos no encontrados
 */
router.get(
  '/data/:moduleId/:pacienteId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const moduleId = Array.isArray(req.params.moduleId)
        ? req.params.moduleId[0]
        : req.params.moduleId;
      const pacienteId = Array.isArray(req.params.pacienteId)
        ? req.params.pacienteId[0]
        : req.params.pacienteId;
      const { consultaId } = req.query;

      const moduleData = await moduleService.getModuleData(
        moduleId,
        pacienteId,
        consultaId as string | undefined
      );

      if (!moduleData) {
        return res.status(404).json({ error: 'Module data not found' });
      }

      res.json(moduleData);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /modules/data/patient/{pacienteId}:
 *   get:
 *     summary: Lista todos los datos de módulos de un paciente
 *     tags: [Module Data]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pacienteId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de datos de módulos
 */
router.get(
  '/data/patient/:pacienteId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const pacienteId = Array.isArray(req.params.pacienteId)
        ? req.params.pacienteId[0]
        : req.params.pacienteId;
      const moduleDataList = await moduleService.listPatientModuleData(pacienteId);
      res.json(moduleDataList);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /modules/data/{id}:
 *   delete:
 *     summary: Elimina datos de un módulo
 *     tags: [Module Data]
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
 *         description: Datos eliminados
 *       404:
 *         description: Datos no encontrados
 */
router.delete('/data/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;
    const deleted = await moduleService.deleteModuleData(id);

    if (!deleted) {
      return res.status(404).json({ error: 'Module data not found' });
    }

    res.json({ message: 'Module data deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
