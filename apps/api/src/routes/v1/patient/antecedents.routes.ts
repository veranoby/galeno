import { Router, Response } from 'express';
import { AuthRequest, authMiddleware, canAccessPatient } from '../../../middleware/auth.js';
import { logger } from '../../../utils/logger.js';
import antecedentsService from '../../../services/patient/antecedents.service.js';

const router: Router = Router();

/**
 * @openapi
 * /api/v1/patient/{pacienteId}/antecedentes:
 *   get:
 *     summary: Listar antecedentes de un paciente
 *     tags: [Antecedentes]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pacienteId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: string
 *           enum: [personal, familiar, medicamento, habito, alergia]
 *     responses:
 *       200:
 *         description: Lista de antecedentes
 */
router.get('/:pacienteId/antecedentes',  authMiddleware,  async (req: AuthRequest,  res: Response) => {
  try {
    const pacienteId = Array.isArray(req.params.pacienteId)
      ? req.params.pacienteId[0]
      : req.params.pacienteId;

    const { tipo } = req.query;

    // Verificar acceso al paciente
    const hasAccess = await canAccessPatient(req,  pacienteId);

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Forbidden', 
        message: 'No tienes permisos para acceder a este paciente'
      });
    }

    const antecedentes = await antecedentsService.findAll(
      pacienteId, 
      tipo as any
    );

    res.json({ data: antecedentes });
  } catch (error) {
    const pacienteId = typeof req.params.pacienteId === 'string' ? req.params.pacienteId : req.params.pacienteId?.[0];
    logger.error({ error,  pacienteId },  'Error al listar antecedentes');
    res.status(500).json({
      error: 'Internal server error', 
      message: 'Error al listar antecedentes'
    });
  }
});

/**
 * @openapi
 * /api/v1/patient/{pacienteId}/antecedentes/resumen:
 *   get:
 *     summary: Obtener resumen de antecedentes por tipo
 *     tags: [Antecedentes]
 *     security:
 *       - BearerAuth: []
 */
router.get('/:pacienteId/antecedentes/resumen',  authMiddleware,  async (req: AuthRequest,  res: Response) => {
  try {
    const pacienteId = Array.isArray(req.params.pacienteId)
      ? req.params.pacienteId[0]
      : req.params.pacienteId;

    const hasAccess = await canAccessPatient(req,  pacienteId);

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Forbidden', 
        message: 'No tienes permisos para acceder a este paciente'
      });
    }

    const resumen = await antecedentsService.getResumen(pacienteId);

    res.json({ data: resumen });
  } catch (error) {
    const pacienteId = typeof req.params.pacienteId === 'string' ? req.params.pacienteId : req.params.pacienteId?.[0];
    logger.error({ error,  pacienteId },  'Error al obtener resumen');
    res.status(500).json({
      error: 'Internal server error', 
      message: 'Error al obtener resumen'
    });
  }
});

/**
 * @openapi
 * /api/v1/patient/{pacienteId}/antecedentes/search:
 *   get:
 *     summary: Buscar antecedentes por texto
 *     tags: [Antecedentes]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 */
router.get('/:pacienteId/antecedentes/search',  authMiddleware,  async (req: AuthRequest,  res: Response) => {
  try {
    const pacienteId = Array.isArray(req.params.pacienteId)
      ? req.params.pacienteId[0]
      : req.params.pacienteId;

    const { q } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({
        error: 'Bad Request', 
        message: 'Query parameter "q" is required'
      });
    }

    const hasAccess = await canAccessPatient(req,  pacienteId);

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Forbidden', 
        message: 'No tienes permisos para acceder a este paciente'
      });
    }

    const resultados = await antecedentsService.search(pacienteId,  q);

    res.json({ data: resultados });
  } catch (error) {
    logger.error({ error,  query: req.query.q },  'Error al buscar antecedentes');
    res.status(500).json({
      error: 'Internal server error', 
      message: 'Error al buscar antecedentes'
    });
  }
});

/**
 * @openapi
 * /api/v1/patient/{pacienteId}/antecedentes/{id}:
 *   get:
 *     summary: Obtener un antecedente por ID
 *     tags: [Antecedentes]
 *     security:
 *       - BearerAuth: []
 */
router.get('/:pacienteId/antecedentes/:id',  authMiddleware,  async (req: AuthRequest,  res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const antecedenteId = Array.isArray(id) ? id[0] : id;

    const antecedente = await antecedentsService.findOne(antecedenteId);

    // Verificar acceso al paciente
    const hasAccess = await canAccessPatient(req,  antecedente.pacienteId);

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Forbidden', 
        message: 'No tienes permisos para acceder a este paciente'
      });
    }

    res.json({ data: antecedente });
  } catch (error: any) {
    if (error.message === 'Antecedente no encontrado') {
      return res.status(404).json({
        error: 'Not found', 
        message: 'Antecedente no encontrado'
      });
    }

    logger.error({ error,  id: req.params.id },  'Error al obtener antecedente');
    res.status(500).json({
      error: 'Internal server error', 
      message: 'Error al obtener antecedente'
    });
  }
});

/**
 * @openapi
 * /api/v1/patient/{pacienteId}/antecedentes:
 *   post:
 *     summary: Crear un nuevo antecedente
 *     tags: [Antecedentes]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tipo
 *               - detalle
 *             properties:
 *               tipo:
 *                 type: string
 *                 enum: [personal, familiar, medicamento, habito, alergia]
 *               categoria:
 *                 type: string
 *               detalle:
 *                 type: string
 *               grado:
 *                 type: string
 *               registradoPor:
 *                 type: string
 *                 enum: [paciente, enfermera, doctor]
 *     responses:
 *       201:
 *         description: Antecedente creado
 */
router.post('/:pacienteId/antecedentes',  authMiddleware,  async (req: AuthRequest,  res: Response) => {
  try {
    const pacienteId = Array.isArray(req.params.pacienteId)
      ? req.params.pacienteId[0]
      : req.params.pacienteId;

    const { tipo, categoria, detalle, grado, registradoPor } = req.body;

    if (!tipo || !detalle) {
      return res.status(400).json({
        error: 'Bad Request', 
        message: 'tipo y detalle son requeridos'
      });
    }

    // Verificar acceso al paciente
    const hasAccess = await canAccessPatient(req,  pacienteId);

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Forbidden', 
        message: 'No tienes permisos para acceder a este paciente'
      });
    }

    const antecedente = await antecedentsService.create({
      pacienteId, 
      tipo, 
      categoria, 
      detalle, 
      grado, 
      registradoPor
    });

    res.status(201).json({ data: antecedente });
  } catch (error: any) {
    if (error.message === 'Paciente no encontrado') {
      return res.status(404).json({
        error: 'Not found', 
        message: 'Paciente no encontrado'
      });
    }

    if (error.message.includes('requerido') || error.message.includes('inválida')) {
      return res.status(400).json({
        error: 'Bad Request', 
        message: error.message
      });
    }

    logger.error({ error,  body: req.body },  'Error al crear antecedente');
    res.status(500).json({
      error: 'Internal server error', 
      message: 'Error al crear antecedente'
    });
  }
});

/**
 * @openapi
 * /api/v1/patient/{pacienteId}/antecedentes/{id}:
 *   put:
 *     summary: Actualizar un antecedente
 *     tags: [Antecedentes]
 *     security:
 *       - BearerAuth: []
 */
router.put('/:pacienteId/antecedentes/:id',  authMiddleware,  async (req: AuthRequest,  res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const antecedenteId = Array.isArray(id) ? id[0] : id;

    // Verificar que existe y obtener acceso
    const existente = await antecedentsService.findOne(antecedenteId);

    const hasAccess = await canAccessPatient(req,  existente.pacienteId);

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Forbidden', 
        message: 'No tienes permisos para acceder a este paciente'
      });
    }

    const { tipo, categoria, detalle, grado } = req.body;

    const antecedente = await antecedentsService.update(antecedenteId,  {
      tipo, 
      categoria, 
      detalle, 
      grado
    });

    res.json({ data: antecedente });
  } catch (error: any) {
    if (error.message === 'Antecedente no encontrado') {
      return res.status(404).json({
        error: 'Not found', 
        message: 'Antecedente no encontrado'
      });
    }

    if (error.message.includes('requerido') || error.message.includes('inválida')) {
      return res.status(400).json({
        error: 'Bad Request', 
        message: error.message
      });
    }

    logger.error({ error,  id: req.params.id },  'Error al actualizar antecedente');
    res.status(500).json({
      error: 'Internal server error', 
      message: 'Error al actualizar antecedente'
    });
  }
});

/**
 * @openapi
 * /api/v1/patient/{pacienteId}/antecedentes/{id}:
 *   delete:
 *     summary: Eliminar un antecedente
 *     tags: [Antecedentes]
 *     security:
 *       - BearerAuth: []
 */
router.delete('/:pacienteId/antecedentes/:id',  authMiddleware,  async (req: AuthRequest,  res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const antecedenteId = Array.isArray(id) ? id[0] : id;

    // Verificar que existe
    const existente = await antecedentsService.findOne(antecedenteId);

    const hasAccess = await canAccessPatient(req,  existente.pacienteId);

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Forbidden', 
        message: 'No tienes permisos para acceder a este paciente'
      });
    }

    await antecedentsService.delete(antecedenteId);

    res.status(204).send();
  } catch (error: any) {
    if (error.message === 'Antecedente no encontrado') {
      return res.status(404).json({
        error: 'Not found', 
        message: 'Antecedente no encontrado'
      });
    }

    logger.error({ error,  id: req.params.id },  'Error al eliminar antecedente');
    res.status(500).json({
      error: 'Internal server error', 
      message: 'Error al eliminar antecedente'
    });
  }
});

export default router;
