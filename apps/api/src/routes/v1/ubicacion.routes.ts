// apps/api/src/routes/v1/ubicacion.routes.ts
/**
 * Rutas para gestión de ubicaciones y oficinas
 * GPS, cálculo de distancias, doctores por oficina
 */

import { Router, Request, Response } from 'express';
import { authMiddleware, AuthRequest } from '../../middleware/auth.js';
import { getUbicacionService } from '../../services/ubicacion/ubicacion.service.js';
import { logger } from '../../utils/logger.js';

const router: Router = Router();
const ubicacionService = getUbicacionService();

/**
 * @openapi
 * /ubicacion/oficinas/cercanas:
 *   get:
 *     summary: Get nearby offices
 *     tags: [Ubicación]
 *     parameters:
 *       - in: query
 *         name: lat
 *         required: true
 *         schema:
 *           type: number
 *       - in: query
 *         name: lng
 *         required: true
 *         schema:
 *           type: number
 *       - in: query
 *         name: radio
 *         schema:
 *           type: number
 *           default: 10
 *     responses:
 *       200:
 *         description: List of nearby offices
 */
router.get('/oficinas/cercanas', async (req: Request, res: Response) => {
  try {
    const { lat, lng, radio } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        error: 'Latitud y longitud son requeridas'
      });
    }

    const oficinas = await ubicacionService.obtenerOficinasCercanas(
      Number(lat),
      Number(lng),
      Number(radio) || 10
    );

    res.json({
      success: true,
      data: oficinas
    });
  } catch (error: any) {
    logger.error({ error }, 'Error en oficinas cercanas');
    res.status(500).json({
      success: false,
      error: error.message || 'Error interno'
    });
  }
});

/**
 * @openapi
 * /ubicacion/oficinas:
 *   get:
 *     summary: Get all active offices
 *     tags: [Ubicación]
 *     responses:
 *       200:
 *         description: List of all active offices
 */
router.get('/oficinas', async (_req: Request, res: Response) => {
  try {
    const oficinas = await ubicacionService.obtenerTodasLasOficinas();

    res.json({
      success: true,
      data: oficinas
    });
  } catch (error: any) {
    logger.error({ error }, 'Error obteniendo oficinas');
    res.status(500).json({
      success: false,
      error: error.message || 'Error interno'
    });
  }
});

/**
 * @openapi
 * /ubicacion/oficinas:
 *   post:
 *     summary: Create new office
 *     tags: [Ubicación]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *               direccion:
 *                 type: string
 *               latitud:
 *                 type: number
 *               longitud:
 *                 type: number
 *               radio:
 *                 type: number
 *     responses:
 *       201:
 *         description: Office created
 */
router.post('/oficinas', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { nombre, direccion, latitud, longitud, radio } = req.body;

    if (!nombre || !direccion || !latitud || !longitud) {
      return res.status(400).json({
        success: false,
        error: 'Nombre, dirección, latitud y longitud son requeridos'
      });
    }

    const oficina = await ubicacionService.crearOficina({
      nombre,
      direccion,
      latitud,
      longitud,
      radio
    });

    res.status(201).json({
      success: true,
      data: oficina
    });
  } catch (error: any) {
    logger.error({ error }, 'Error creando oficina');
    res.status(500).json({
      success: false,
      error: error.message || 'Error interno'
    });
  }
});

/**
 * @openapi
 * /ubicacion/oficinas/{id}:
 *   put:
 *     summary: Update office
 *     tags: [Ubicación]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *               direccion:
 *                 type: string
 *               latitud:
 *                 type: number
 *               longitud:
 *                 type: number
 *               radio:
 *                 type: number
 *               activo:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Office updated
 */
router.put('/oficinas/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = req.body;

    const oficina = await ubicacionService.actualizarOficina(id, data);

    res.json({
      success: true,
      data: oficina
    });
  } catch (error: any) {
    logger.error({ error }, 'Error actualizando oficina');
    res.status(500).json({
      success: false,
      error: error.message || 'Error interno'
    });
  }
});

/**
 * @openapi
 * /ubicacion/oficinas/{id}:
 *   delete:
 *     summary: Delete office (soft delete)
 *     tags: [Ubicación]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Office deleted
 */
router.delete('/oficinas/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    await ubicacionService.eliminarOficina(id);

    res.json({
      success: true,
      message: 'Oficina eliminada correctamente'
    });
  } catch (error: any) {
    logger.error({ error }, 'Error eliminando oficina');
    res.status(500).json({
      success: false,
      error: error.message || 'Error interno'
    });
  }
});

/**
 * @openapi
 * /ubicacion/oficinas/{id}/doctores:
 *   get:
 *     summary: Get doctors by office and day
 *     tags: [Ubicación]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: diaSemana
 *         required: true
 *         schema:
 *           type: string
 *           enum: [LUN, MAR, MIE, JUE, VIE, SAB, DOM]
 *     responses:
 *       200:
 *         description: List of doctors
 */
router.get('/oficinas/:id/doctores', async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    let { diaSemana } = req.query;

    if (!diaSemana) {
      return res.status(400).json({
        success: false,
        error: 'Día de la semana es requerido'
      });
    }

    if (Array.isArray(diaSemana)) {
      diaSemana = diaSemana[0];
    }

    const doctores = await ubicacionService.obtenerDoctoresPorOficina(
      id,
      diaSemana as string
    );

    res.json({
      success: true,
      data: doctores
    });
  } catch (error: any) {
    logger.error({ error }, 'Error obteniendo doctores por oficina');
    res.status(500).json({
      success: false,
      error: error.message || 'Error interno'
    });
  }
});

/**
 * @openapi
 * /ubicacion/doctores/asignar:
 *   post:
 *     summary: Assign doctor to office
 *     tags: [Ubicación]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               doctorId:
 *                 type: string
 *               oficinaId:
 *                 type: string
 *               diaSemana:
 *                 type: string
 *               horaInicio:
 *                 type: string
 *               horaFin:
 *                 type: string
 *     responses:
 *       201:
 *         description: Doctor assigned
 */
router.post('/doctores/asignar', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { doctorId, oficinaId, diaSemana, horaInicio, horaFin } = req.body;

    if (!doctorId || !oficinaId || !diaSemana || !horaInicio || !horaFin) {
      return res.status(400).json({
        success: false,
        error: 'Todos los campos son requeridos'
      });
    }

    const ubicacion = await ubicacionService.asignarDoctorAOficina(
      doctorId,
      oficinaId,
      diaSemana,
      horaInicio,
      horaFin
    );

    res.status(201).json({
      success: true,
      data: ubicacion
    });
  } catch (error: any) {
    logger.error({ error }, 'Error asignando doctor');
    res.status(500).json({
      success: false,
      error: error.message || 'Error interno'
    });
  }
});

/**
 * @openapi
 * /ubicacion/doctores/remover:
 *   post:
 *     summary: Remove doctor from office
 *     tags: [Ubicación]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               doctorId:
 *                 type: string
 *               oficinaId:
 *                 type: string
 *               diaSemana:
 *                 type: string
 *     responses:
 *       200:
 *         description: Doctor removed
 */
router.post('/doctores/remover', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { doctorId, oficinaId, diaSemana } = req.body;

    if (!doctorId || !oficinaId || !diaSemana) {
      return res.status(400).json({
        success: false,
        error: 'doctorId, oficinaId y diaSemana son requeridos'
      });
    }

    await ubicacionService.removerDoctorDeOficina(doctorId, oficinaId, diaSemana);

    res.json({
      success: true,
      message: 'Doctor removido correctamente'
    });
  } catch (error: any) {
    logger.error({ error }, 'Error removiendo doctor');
    res.status(500).json({
      success: false,
      error: error.message || 'Error interno'
    });
  }
});

export default router;
