import { Router, Request, Response } from 'express';
import { authMiddleware, AuthRequest } from '../../middleware/auth.js';
import prisma from '../../config/database.js';
import { logger } from '../../utils/logger.js';

const router: Router = Router();

/**
 * @openapi
 * /specialties:
 *   get:
 *     summary: Get all medical specialties
 *     tags: [Specialties]
 *     responses:
 *       200:
 *         description: List of medical specialties
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       nombre:
 *                         type: string
 *                       activo:
 *                         type: boolean
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const specialties = await prisma.especialidad.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
      select: {
        id: true,
        nombre: true,
        activo: true
      }
    });

    res.json({
      success: true,
      data: specialties
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching specialties');
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * @openapi
 * /specialties/doctor/{doctorId}:
 *   get:
 *     summary: Get doctor's specialties
 *     tags: [Specialties]
 *     parameters:
 *       - in: path
 *         name: doctorId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of doctor's specialties
 */
router.get('/doctor/:doctorId', async (req: Request, res: Response) => {
  try {
    const doctorId = Array.isArray(req.params.doctorId)
      ? req.params.doctorId[0]
      : req.params.doctorId;

    const doctorSpecialties = await prisma.doctorEspecialidad.findMany({
      where: {
        doctorId,
        especialidad: { activo: true }
      },
      include: {
        especialidad: {
          select: {
            id: true,
            nombre: true,
            activo: true
          }
        }
      },
      orderBy: { principal: 'desc' }
    });

    res.json({
      success: true,
      data: doctorSpecialties
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching doctor specialties');
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;
