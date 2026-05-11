import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../../middleware/auth.js';
import { ReservaService } from '../../services/agenda/reserva-service-class.js';
import prisma from '../../config/database.js';
import { logger } from '../../utils/logger.js';

const router: Router = Router();
const reservaService = new ReservaService(prisma);

// Create reservation
router.post('/',  authMiddleware,  async (req: AuthRequest,  res: Response) => {
  try {
    const {
      pacienteId,
      profesionalId,
      disponibilidadId,
      fechaCita,
      tipoCita,
      motivo,
    } = req.body;

    // Validate required fields
    if (!pacienteId || !profesionalId || !disponibilidadId || !fechaCita || !tipoCita || !motivo) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    // Validate types
    if (typeof pacienteId !== 'string' || 
        typeof profesionalId !== 'string' || 
        typeof disponibilidadId !== 'string' || 
        typeof tipoCita !== 'string' || 
        typeof motivo !== 'string') {
      return res.status(400).json({ error: 'Tipos de datos incorrectos' });
    }

    if (tipoCita !== 'presencial' && tipoCita !== 'teleconsulta') {
      return res.status(400).json({ error: 'Tipo de cita inválido' });
    }

    const reserva = await reservaService.crearReserva({
      pacienteId, 
      profesionalId, 
      disponibilidadId, 
      fechaCita: new Date(fechaCita),
      tipoCita: tipoCita as 'presencial' | 'teleconsulta',
      motivo,
    });

    res.status(201).json(reserva);
  } catch (error) {
    logger.error({ error }, 'Error creating reservation');
    res.status(500).json({ error: error instanceof Error ? error.message : 'Error al crear reserva' });
  }
});

// Confirm reservation
router.patch('/:id/confirmar',  authMiddleware,  async (req: AuthRequest,  res: Response) => {
  try {
    const { id } = req.params as { id: string };

    if (!id) {
      return res.status(400).json({ error: 'ID es obligatorio' });
    }

    const reserva = await reservaService.confirmarReserva(id);

    res.json({ message: 'Reserva confirmada correctamente',  reserva });
  } catch (error) {
    logger.error({ error }, 'Error confirming reservation');
    res.status(500).json({ error: error instanceof Error ? error.message : 'Error al confirmar reserva' });
  }
});

// Cancel reservation
router.patch('/:id/cancelar',  authMiddleware,  async (req: AuthRequest,  res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const { motivoCancelacion } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'ID es obligatorio' });
    }

    const reserva = await reservaService.cancelarReserva(id,  motivoCancelacion);

    res.json({ message: 'Reserva cancelada correctamente',  reserva });
  } catch (error) {
    logger.error({ error }, 'Error canceling reservation');
    res.status(500).json({ error: error instanceof Error ? error.message : 'Error al cancelar reserva' });
  }
});

// Get reservations by filters
router.get('/',  authMiddleware,  async (req: AuthRequest,  res: Response) => {
  try {
    const { pacienteId, profesionalId, fechaDesde, fechaHasta, estado } = req.query;

    const filter: any = {};
    
    if (pacienteId) filter.pacienteId = String(pacienteId);
    if (profesionalId) filter.profesionalId = String(profesionalId);
    if (fechaDesde) filter.fechaDesde = new Date(String(fechaDesde));
    if (fechaHasta) filter.fechaHasta = new Date(String(fechaHasta));
    if (estado) filter.estado = String(estado);

    const reservas = await reservaService.obtenerReservas(filter);

    res.json(reservas);
  } catch (error) {
    logger.error({ error }, 'Error getting reservations');
    res.status(500).json({ error: error instanceof Error ? error.message : 'Error al obtener reservas' });
  }
});

// Get specific reservation
router.get('/:id',  authMiddleware,  async (req: AuthRequest,  res: Response) => {
  try {
    const { id } = req.params as { id: string };

    if (!id) {
      return res.status(400).json({ error: 'ID es obligatorio' });
    }

    const reserva = await reservaService.obtenerReservaPorId(id);

    res.json(reserva);
  } catch (error) {
    logger.error({ error }, 'Error getting specific reservation');
    res.status(500).json({ error: error instanceof Error ? error.message : 'Error al obtener reserva' });
  }
});

export default router;
