import { Router, Response } from 'express';
import { 
  crearSlot, 
  actualizarSlot, 
  eliminarSlot, 
  obtenerSlotsPorDoctor, 
  obtenerSlotsPorUbicacion, 
  obtenerSlotPorId, 
  obtenerSlotsDisponibles,
  desactivarSlot
} from '../../../services/agenda/disponibilidad-service.js';
import { authMiddleware, requireDoctor, type AuthRequest } from '../../../middleware/auth.js';
import { validateDisponibilidad } from '../../../middleware/validation.js';

const router: Router = Router();

// POST /api/v1/agenda/disponibilidad - Crear un nuevo slot de disponibilidad
router.post('/',  
  authMiddleware,  
  requireDoctor,  
  validateDisponibilidad('create'),
  async (req: AuthRequest,  res: Response) => {
    try {
      const slotData = {
        ...req.body,
        doctorId: req.user!.id
      };

      const slot = await crearSlot(slotData);
      res.status(201).json({
        success: true, 
        data: slot
      });
    } catch (error) {
      res.status(400).json({
        success: false, 
        error: error instanceof Error ? error.message : 'Error al crear disponibilidad'
      });
    }
  }
);

// PUT /api/v1/agenda/disponibilidad/:id - Actualizar un slot existente
router.put('/:id',  
  authMiddleware,  
  requireDoctor,  
  validateDisponibilidad('update'),
  async (req: AuthRequest,  res: Response) => {
    try {
      const { id } = req.params as { id: string };
      const slotData = req.body;

      // Verificar que el slot pertenece al doctor autenticado
      const slotExistente = await obtenerSlotPorId(id);
      if (!slotExistente || slotExistente.doctorId !== req.user!.id) {
        return res.status(403).json({
          success: false, 
          error: 'No autorizado para modificar este slot'
        });
      }

      const slot = await actualizarSlot(id,  slotData);
      res.json({
        success: true, 
        data: slot
      });
    } catch (error) {
      res.status(400).json({
        success: false, 
        error: error instanceof Error ? error.message : 'Error al actualizar disponibilidad'
      });
    }
  }
);

// DELETE /api/v1/agenda/disponibilidad/:id - Eliminar un slot (soft delete)
router.delete('/:id',  
  authMiddleware,  
  requireDoctor,  
  async (req: AuthRequest,  res: Response) => {
    try {
      const { id } = req.params as { id: string };

      // Verificar que el slot pertenece al doctor autenticado
      const slotExistente = await obtenerSlotPorId(id);
      if (!slotExistente || slotExistente.doctorId !== req.user!.id) {
        return res.status(403).json({
          success: false, 
          error: 'No autorizado para eliminar esta cita'
        });
      }

      const slot = await desactivarSlot(id); // Usamos desactivar en lugar de eliminar
      res.json({
        success: true, 
        data: slot
      });
    } catch (error) {
      res.status(400).json({
        success: false, 
        error: error instanceof Error ? error.message : 'Error al eliminar disponibilidad'
      });
    }
  }
);

// GET /api/v1/agenda/disponibilidad - Obtener slots de disponibilidad del doctor
router.get('/',  
  authMiddleware,  
  requireDoctor,  
  async (req: AuthRequest,  res: Response) => {
    try {
      const { ubicacionId, diaSemana } = req.query;
      const doctorId = req.user!.id;

      let slots;
      if (ubicacionId) {
        slots = await obtenerSlotsPorUbicacion(ubicacionId as string);
      } else {
        slots = await obtenerSlotsPorDoctor(doctorId);
      }

      // Filtrar por día de la semana si se proporciona
      if (diaSemana !== undefined) {
        const dia = parseInt(diaSemana as string);
        slots = slots.filter(slot => slot.diaSemana === dia);
      }

      res.json({
        success: true, 
        data: slots
      });
    } catch (error) {
      res.status(400).json({
        success: false, 
        error: error instanceof Error ? error.message : 'Error al listar disponibilidades'
      });
    }
  }
);

// GET /api/v1/agenda/disponibilidad/:id - Obtener un slot específico
router.get('/:id',  
  authMiddleware,  
  async (req: AuthRequest,  res: Response) => {
    try {
      const { id } = req.params as { id: string };

      const slot = await obtenerSlotPorId(id);
      if (!slot) {
        return res.status(404).json({
          success: false, 
          error: 'Slot no encontrado'
        });
      }

      // Verificar permisos: el slot debe pertenecer al doctor o el usuario debe ser el paciente con acceso
      if (req.user!.rol === 'DOCTOR' && slot.doctorId !== req.user!.id) {
        return res.status(403).json({
          success: false, 
          error: 'No autorizado para acceder a este slot'
        });
      }

      res.json({
        success: true, 
        data: slot
      });
    } catch (error) {
      res.status(400).json({
        success: false, 
        error: error instanceof Error ? error.message : 'Error al obtener disponibilidad'
      });
    }
  }
);

// GET /api/v1/agenda/disponibilidad/:doctorId/:fecha - Obtener slots disponibles para un doctor en una fecha específica
router.get('/:doctorId/:fecha',  
  authMiddleware, 
  async (req: AuthRequest,  res: Response) => {
    try {
      const { doctorId, fecha } = req.params as { doctorId: string, fecha: string };

      // Parsear la fecha
      const fechaDate = new Date(fecha);
      if (isNaN(fechaDate.getTime())) {
        return res.status(400).json({
          success: false, 
          error: 'Fecha inválida'
        });
      }

      const slotsDisponibles = await obtenerSlotsDisponibles(doctorId,  fechaDate);

      res.json({
        success: true, 
        data: slotsDisponibles
      });
    } catch (error) {
      res.status(400).json({
        success: false, 
        error: error instanceof Error ? error.message : 'Error al obtener slots disponibles'
      });
    }
  }
);

export default router;