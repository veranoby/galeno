import { Router, Request, Response } from 'express';
import { AppointmentManagementService } from '../../services/agenda/appointment-management-service.js';
import { logger } from '../../utils/logger.js';
import { authMiddleware, AuthRequest } from '../../middleware/auth.js';

const router: Router = Router();
const appointmentService = new AppointmentManagementService();

// GET /api/agenda/citas - List appointments with filters
router.get('/',  authMiddleware,  async (req: AuthRequest,  res: Response) => {
  try {
    const {
      doctorId,
      pacienteId,
      fechaDesde,
      fechaHasta,
      estado,
      tipo,
      limit,
      offset
    } = req.query;

    const filters: any = {};

    if (doctorId) filters.doctorId = String(doctorId);
    if (pacienteId) filters.pacienteId = String(pacienteId);
    if (estado) filters.estado = String(estado);
    if (tipo) filters.tipo = String(tipo);
    if (fechaDesde) filters.fechaDesde = new Date(String(fechaDesde));
    if (fechaHasta) filters.fechaHasta = new Date(String(fechaHasta));
    if (limit) filters.limit = parseInt(String(limit), 10);
    if (offset) filters.offset = parseInt(String(offset), 10);

    const appointments = await appointmentService.getAppointments(filters);

    res.json({
      success: true, 
      data: appointments, 
      count: appointments.length
    });
  } catch (error) {
    logger.error({ error: error.message, userId: req.user?.id }, 'Error getting appointments');
    res.status(500).json({
      success: false,
      error: error.message || 'Error al obtener las citas'
    });
  }
});

// GET /api/agenda/citas/:id - Get specific appointment
router.get('/:id',  authMiddleware,  async (req: AuthRequest,  res: Response) => {
  try {
    const { id } = req.params as { id: string };

    if (!id) {
      return res.status(400).json({
        success: false, 
        error: 'ID de cita es requerido'
      });
    }

    const appointment = await appointmentService.getAppointmentById(id);

    if (!appointment) {
      return res.status(404).json({
        success: false, 
        error: 'Cita no encontrada'
      });
    }

    // Authorization: Only doctor or patient can view appointment
    if (req.user?.rol === 'DOCTOR' && req.user?.id !== appointment.doctorId) {
      return res.status(403).json({
        success: false, 
        error: 'No autorizado para ver esta cita'
      });
    }

    res.json({
      success: true, 
      data: appointment
    });
  } catch (error) {
    const appointmentId = req.params.id;
    logger.error({ error: error.message, appointmentId }, 'Error getting appointment');
    res.status(500).json({
      success: false,
      error: error.message || 'Error al obtener la cita'
    });
  }
});

// POST /api/agenda/citas - Create new appointment
router.post('/',  authMiddleware,  async (req: AuthRequest,  res: Response) => {
  try {
    const {
      doctorId,
      pacienteId,
      fechaHora,
      tipo,
      ubicacionId,
      slotId,
      motivo
    } = req.body;

    // Validate required fields
    if (!doctorId || !pacienteId || !fechaHora || !tipo) {
      return res.status(400).json({
        success: false, 
        error: 'Los campos doctorId,  pacienteId,  fechaHora y tipo son obligatorios'
      });
    }

    // Validate types
    if (typeof doctorId !== 'string' || 
        typeof pacienteId !== 'string' || 
        typeof tipo !== 'string' ||
        (ubicacionId && typeof ubicacionId !== 'string') ||
        (slotId && typeof slotId !== 'string') ||
        (motivo && typeof motivo !== 'string')) {
      return res.status(400).json({
        success: false, 
        error: 'Tipos de datos incorrectos'
      });
    }

    // Validate date
    const dateObj = new Date(fechaHora);
    if (isNaN(dateObj.getTime())) {
      return res.status(400).json({
        success: false, 
        error: 'Fecha/hora inválida'
      });
    }

    // Validate appointment type
    if (!['presencial',  'teleconsulta'].includes(tipo)) {
      return res.status(400).json({
        success: false, 
        error: 'Tipo de cita inválido. Debe ser "presencial" o "teleconsulta"'
      });
    }

    // Authorization: Only doctor can create appointment for their patients
    if (req.user?.rol === 'DOCTOR' && req.user?.id !== doctorId) {
      return res.status(403).json({
        success: false, 
        error: 'No autorizado para crear citas para otros médicos'
      });
    }

    const appointment = await appointmentService.createAppointment({
      doctorId, 
      pacienteId, 
      fechaHora: dateObj, 
      tipo: tipo as 'presencial' | 'teleconsulta', 
      ubicacionId, 
      slotId, 
      motivo
    });

    res.status(201).json({
      success: true, 
      data: appointment
    });
  } catch (error) {
    logger.error({ error: error.message, userId: req.user?.id }, 'Error creating appointment');
    res.status(500).json({
      success: false,
      error: error.message || 'Error al crear la cita'
    });
  }
});

// PUT /api/agenda/citas/:id - Update appointment
router.put('/:id',  authMiddleware,  async (req: AuthRequest,  res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const {
      fechaHora,
      tipo,
      estado,
      ubicacionId,
      motivo
    } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false, 
        error: 'ID de cita es requerido'
      });
    }

    // Validate date if provided
    let dateObj: Date | undefined;
    if (fechaHora) {
      dateObj = new Date(fechaHora);
      if (isNaN(dateObj.getTime())) {
        return res.status(400).json({
          success: false, 
          error: 'Fecha/hora inválida'
        });
      }
    }

    // Validate appointment type if provided
    if (tipo && !['presencial',  'teleconsulta'].includes(tipo)) {
      return res.status(400).json({
        success: false, 
        error: 'Tipo de cita inválido. Debe ser "presencial" o "teleconsulta"'
      });
    }

    const updateData: any = {};
    if (fechaHora) updateData.fechaHora = dateObj;
    if (tipo) updateData.tipo = tipo;
    if (estado) updateData.estado = estado;
    if (ubicacionId) updateData.ubicacionId = ubicacionId;
    if (motivo) updateData.motivo = motivo;

    const appointment = await appointmentService.updateAppointment(id,  updateData);

    res.json({
      success: true, 
      data: appointment
    });
  } catch (error) {
    const appointmentId = req.params.id;
    logger.error({ error: error.message, appointmentId }, 'Error updating appointment');
    res.status(500).json({
      success: false,
      error: error.message || 'Error al actualizar la cita'
    });
  }
});

// PATCH /api/agenda/citas/:id/cancelar - Cancel appointment
router.patch('/:id/cancelar',  authMiddleware,  async (req: AuthRequest,  res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const { motivo } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false, 
        error: 'ID de cita es requerido'
      });
    }

    const appointment = await appointmentService.cancelAppointment(id,  motivo);

    res.json({
      success: true, 
      message: 'Cita cancelada exitosamente', 
      data: appointment
    });
  } catch (error) {
    const appointmentId = req.params.id;
    logger.error({ error: error.message, appointmentId }, 'Error canceling appointment');
    res.status(500).json({
      success: false,
      error: error.message || 'Error al cancelar la cita'
    });
  }
});

// PATCH /api/agenda/citas/:id/confirmar - Confirm appointment
router.patch('/:id/confirmar',  authMiddleware,  async (req: AuthRequest,  res: Response) => {
  try {
    const { id } = req.params as { id: string };

    if (!id) {
      return res.status(400).json({
        success: false, 
        error: 'ID de cita es requerido'
      });
    }

    const appointment = await appointmentService.confirmAppointment(id);

    res.json({
      success: true, 
      message: 'Cita confirmada exitosamente', 
      data: appointment
    });
  } catch (error) {
    const appointmentId = req.params.id;
    logger.error({ error: error.message, appointmentId }, 'Error confirming appointment');
    res.status(500).json({
      success: false,
      error: error.message || 'Error al confirmar la cita'
    });
  }
});

// PATCH /api/agenda/citas/:id/reprogramar - Reschedule appointment
router.patch('/:id/reprogramar',  authMiddleware,  async (req: AuthRequest,  res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const { nuevaFecha, motivo } = req.body;

    if (!id || !nuevaFecha) {
      return res.status(400).json({
        success: false, 
        error: 'ID de cita y nueva fecha son requeridos'
      });
    }

    // Validate date
    const newDate = new Date(nuevaFecha);
    if (isNaN(newDate.getTime())) {
      return res.status(400).json({
        success: false, 
        error: 'Fecha inválida'
      });
    }

    const appointment = await appointmentService.rescheduleAppointment(id,  newDate,  motivo);

    res.json({
      success: true, 
      message: 'Cita reprogramada exitosamente', 
      data: appointment
    });
  } catch (error) {
    const appointmentId = req.params.id;
    logger.error({ error: error.message, appointmentId }, 'Error rescheduling appointment');
    res.status(500).json({
      success: false,
      error: error.message || 'Error al reprogramar la cita'
    });
  }
});

// GET /api/agenda/citas/dia/:doctorId/:date - Get appointments for a specific day
router.get('/dia/:doctorId/:date',  authMiddleware,  async (req: AuthRequest,  res: Response) => {
  try {
    const { doctorId, date } = req.params;

    if (typeof doctorId !== 'string' || typeof date !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Doctor ID y fecha deben ser strings'
      });
    }

    if (!doctorId || !date) {
      return res.status(400).json({
        success: false,
        error: 'Doctor ID y fecha son requeridos'
      });
    }

    // Validate date format
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return res.status(400).json({
        success: false, 
        error: 'Fecha inválida'
      });
    }

    // Authorization: Only the doctor can view their own appointments
    if (req.user?.rol === 'DOCTOR' && req.user?.id !== doctorId) {
      return res.status(403).json({
        success: false, 
        error: 'No autorizado para ver citas de otros médicos'
      });
    }

    const appointments = await appointmentService.getAppointmentsForDay(doctorId,  dateObj);

    res.json({
      success: true, 
      data: appointments
    });
  } catch (error) {
    const doctorId = req.params.doctorId;
    const date = req.params.date;
    logger.error({ error: error.message, doctorId, date }, 'Error getting appointments for day');
    res.status(500).json({
      success: false,
      error: error.message || 'Error al obtener las citas del día'
    });
  }
});

// GET /api/agenda/citas/proximas/:doctorId - Get upcoming appointments for a doctor
router.get('/proximas/:doctorId',  authMiddleware,  async (req: AuthRequest,  res: Response) => {
  try {
    const { doctorId } = req.params;

    if (typeof doctorId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Doctor ID debe ser un string'
      });
    }

    const { limit } = req.query;

    if (!doctorId) {
      return res.status(400).json({
        success: false,
        error: 'Doctor ID es requerido'
      });
    }

    // Authorization: Only the doctor can view their own appointments
    if (req.user?.rol === 'DOCTOR' && req.user?.id !== doctorId) {
      return res.status(403).json({
        success: false, 
        error: 'No autorizado para ver citas de otros médicos'
      });
    }

    const limitNum = limit ? parseInt(String(limit), 10) : 5;
    const appointments = await appointmentService.getUpcomingAppointments(doctorId,  limitNum);

    res.json({
      success: true, 
      data: appointments
    });
  } catch (error) {
    const doctorId = req.params.doctorId;
    logger.error({ error: error.message, doctorId }, 'Error getting upcoming appointments');
    res.status(500).json({
      success: false,
      error: error.message || 'Error al obtener las citas próximas'
    });
  }
});

export default router;