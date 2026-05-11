import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../../middleware/auth.js';
import * as disponibilidadService from '../../services/agenda/disponibilidad-service.js';
import prisma from '../../config/database.js';
import { logger } from '../../utils/logger.js';

const router: Router = Router();

// Create availability slot
router.post('/',  authMiddleware,  async (req: AuthRequest,  res: Response) => {
  try {
    const {
      doctorId,
      ubicacionId,
      diaSemana,
      horaInicio,
      horaFin,
      duracionMinutos,
      tipo,
    } = req.body;

    // Validate required fields
    if (doctorId === undefined || diaSemana === undefined || !horaInicio || !horaFin || !duracionMinutos || !tipo) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    const disponibilidad = await disponibilidadService.crearSlot({
      doctorId, 
      ubicacionId,
      diaSemana, 
      horaInicio,
      horaFin,
      duracionMinutos,
      tipo,
    });

    res.status(201).json(disponibilidad);
  } catch (error) {
    logger.error({ error }, 'Error creating availability');
    res.status(500).json({ error: error instanceof Error ? error.message : 'Error al crear disponibilidad' });
  }
});

// Update availability slot
router.put('/:id',  authMiddleware,  async (req: AuthRequest,  res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const data = req.body;

    const disponibilidad = await disponibilidadService.actualizarSlot(id, data);

    res.json(disponibilidad);
  } catch (error) {
    logger.error({ error }, 'Error updating availability');
    res.status(500).json({ error: error instanceof Error ? error.message : 'Error al actualizar disponibilidad' });
  }
});

// Delete availability slot
router.delete('/:id',  authMiddleware,  async (req: AuthRequest,  res: Response) => {
  try {
    const { id } = req.params as { id: string };

    if (!id) {
      return res.status(400).json({ error: 'ID es obligatorio' });
    }

    const disponibilidad = await disponibilidadService.eliminarSlot(id);

    res.json({ message: 'Disponibilidad eliminada correctamente',  disponibilidad });
  } catch (error) {
    logger.error({ error }, 'Error deleting availability');
    res.status(500).json({ error: error instanceof Error ? error.message : 'Error al eliminar disponibilidad' });
  }
});

// Get availability slots by filters
router.get('/',  authMiddleware,  async (req: AuthRequest,  res: Response) => {
  try {
    const { doctorId } = req.query;

    if (!doctorId) {
      return res.status(400).json({ error: 'doctorId es requerido' });
    }

    const disponibilidades = await disponibilidadService.obtenerSlotsPorDoctor(String(doctorId));

    res.json(disponibilidades);
  } catch (error) {
    logger.error({ error }, 'Error getting availability slots');
    res.status(500).json({ error: error instanceof Error ? error.message : 'Error al obtener disponibilidades' });
  }
});

// Get specific availability slot
router.get('/:id',  authMiddleware,  async (req: AuthRequest,  res: Response) => {
  try {
    const { id } = req.params as { id: string };

    if (!id) {
      return res.status(400).json({ error: 'ID es obligatorio' });
    }

    const disponibilidad = await disponibilidadService.obtenerSlotPorId(id);

    if (!disponibilidad) {
      return res.status(404).json({ error: 'Disponibilidad no encontrada' });
    }

    res.json(disponibilidad);
  } catch (error) {
    logger.error({ error }, 'Error getting specific availability');
    res.status(500).json({ error: error instanceof Error ? error.message : 'Error al obtener disponibilidad' });
  }
});

export default router;
