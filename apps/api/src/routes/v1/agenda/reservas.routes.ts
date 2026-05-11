import { Router } from 'express';
import { 
  crearReserva,
  cancelarReserva,
  confirmarReserva,
  reprogramarReserva
} from '../../../services/agenda/reserva-service.js';
import { authMiddleware, requireDoctor, requireDoctorOrPaciente, type AuthRequest } from '../../../middleware/auth.js';
import { validateReserva } from '../../../middleware/validation.js';

const router: Router = Router();

// POST /api/v1/agenda/reservas - Crear una nueva reserva/cita
router.post('/',  
  authMiddleware,  
  requireDoctorOrPaciente, 
  validateReserva('create'),
  async (req: AuthRequest,  res) => {
    try {
      const reservaData = {
        ...req.body,
        doctorId: req.body.doctorId, // Debe estar en el body
        pacienteId: req.user!.id // El paciente es el usuario autenticado
      };

      // Validar que el pacienteId sea correcto si es un paciente quien hace la solicitud
      if (req.user!.rol !== 'DOCTOR') {
        reservaData.pacienteId = req.user!.id;
      }

      const resultado = await crearReserva(reservaData);
      
      if (resultado.success) {
        res.status(201).json(resultado);
      } else {
        res.status(400).json(resultado);
      }
    } catch (error) {
      res.status(500).json({
        success: false, 
        error: error instanceof Error ? error.message : 'Error al crear reserva'
      });
    }
  }
);

// PUT /api/v1/agenda/reservas/:id/cancelar - Cancelar una reserva
router.put('/:id/cancelar',  
  authMiddleware, 
  requireDoctorOrPaciente, 
  async (req: AuthRequest,  res) => {
    try {
      const { id } = req.params as { id: string };
      const { motivo } = req.body;
      const userId = req.user!.id;

      // Para cancelar, puede ser el doctor o el paciente
      const resultado = await cancelarReserva(id,  userId,  motivo);
      
      if (resultado.success) {
        res.json(resultado);
      } else {
        res.status(400).json(resultado);
      }
    } catch (error) {
      res.status(500).json({
        success: false, 
        error: error instanceof Error ? error.message : 'Error al cancelar reserva'
      });
    }
  }
);

// PUT /api/v1/agenda/reservas/:id/confirmar - Confirmar una reserva (solo doctor)
router.put('/:id/confirmar',  
  authMiddleware, 
  requireDoctor, 
  async (req: AuthRequest,  res) => {
    try {
      const { id } = req.params as { id: string };
      const doctorId = req.user!.id;

      const resultado = await confirmarReserva(id,  doctorId);
      
      if (resultado.success) {
        res.json(resultado);
      } else {
        res.status(400).json(resultado);
      }
    } catch (error) {
      res.status(500).json({
        success: false, 
        error: error instanceof Error ? error.message : 'Error al confirmar reserva'
      });
    }
  }
);

// PUT /api/v1/agenda/reservas/:id/reprogramar - Reprogramar una reserva
router.put('/:id/reprogramar',  
  authMiddleware, 
  requireDoctorOrPaciente, 
  async (req: AuthRequest,  res) => {
    try {
      const { id } = req.params as { id: string };
      const { nuevaFechaHora } = req.body;
      const userId = req.user!.id;

      if (!nuevaFechaHora) {
        return res.status(400).json({
          success: false, 
          error: 'La nueva fecha y hora son requeridas'
        });
      }

      const fecha = new Date(nuevaFechaHora);
      if (isNaN(fecha.getTime())) {
        return res.status(400).json({
          success: false, 
          error: 'Fecha inválida'
        });
      }

      const resultado = await reprogramarReserva(id,  userId,  fecha);
      
      if (resultado.success) {
        res.json(resultado);
      } else {
        res.status(400).json(resultado);
      }
    } catch (error) {
      res.status(500).json({
        success: false, 
        error: error instanceof Error ? error.message : 'Error al reprogramar reserva'
      });
    }
  }
);

export default router;