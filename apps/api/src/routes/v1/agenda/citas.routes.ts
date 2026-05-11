import { Router, Response } from 'express';
import { 
  crearCita,
  obtenerCitaPorId,
  obtenerCitasPorDoctor,
  obtenerCitasPorPaciente,
  actualizarCita,
  eliminarCita,
  cancelarCita,
  confirmarCita,
  iniciarCita,
  completarCita,
  marcarNoPresento,
  obtenerCitasProximas,
  obtenerEstadisticasCitas
} from '../../../services/agenda/cita-service.js';
import { authMiddleware, requireDoctor, requireDoctorOrPaciente, type AuthRequest } from '../../../middleware/auth.js';
import { validateCita } from '../../../middleware/validation.js';

const router: Router = Router();

// POST /api/v1/agenda/citas - Crear una nueva cita (esto sería para uso interno/administrativo)
router.post('/',  
  authMiddleware,  
  requireDoctor, 
  validateCita('create'),
  async (req: AuthRequest,  res: Response) => {
    try {
      const citaData = {
        ...req.body,
        doctorId: req.user!.id // El doctor es el usuario autenticado
      };

      const cita = await crearCita(citaData);
      res.status(201).json({
        success: true, 
        data: cita
      });
    } catch (error) {
      res.status(400).json({
        success: false, 
        error: error instanceof Error ? error.message : 'Error al crear cita'
      });
    }
  }
);

// GET /api/v1/agenda/citas/:id - Obtener una cita específica
router.get('/:id',  
  authMiddleware, 
  async (req: AuthRequest,  res: Response) => {
    try {
      const { id } = req.params as { id: string };

      const cita = await obtenerCitaPorId(id);
      if (!cita) {
        return res.status(404).json({
          success: false, 
          error: 'Cita no encontrada'
        });
      }

      // Verificar permisos: debe ser el doctor o el paciente de la cita
      if (req.user!.id !== cita.doctorId && req.user!.id !== cita.pacienteId) {
        return res.status(403).json({
          success: false, 
          error: 'No autorizado para acceder a esta cita'
        });
      }

      res.json({
        success: true, 
        data: cita
      });
    } catch (error) {
      res.status(400).json({
        success: false, 
        error: error instanceof Error ? error.message : 'Error al obtener cita'
      });
    }
  }
);

// GET /api/v1/agenda/citas - Obtener citas según el rol del usuario
router.get('/',  
  authMiddleware, 
  async (req: AuthRequest,  res: Response) => {
    try {
      const { 
        estado, 
        fechaDesde, 
        fechaHasta, 
        pacienteId,
        doctorId: queryDoctorId 
      } = req.query;

      const userId = req.user!.id;
      const userRole = req.user!.rol;

      let citas = [];

      if (userRole === 'DOCTOR') {
        // Doctor puede ver sus propias citas o las de un paciente específico (si tiene permiso)
        const doctorId = queryDoctorId ? queryDoctorId as string : userId;
        
        if (pacienteId) {
          // Si se especifica pacienteId, verificar que el doctor tenga acceso al paciente
          // (esto implicaría verificar la conexión entre doctor y paciente)
          citas = await obtenerCitasPorPaciente(
            pacienteId as string, 
            estado as any, 
            fechaDesde ? new Date(fechaDesde as string) : undefined,
            fechaHasta ? new Date(fechaHasta as string) : undefined
          );
        } else {
          citas = await obtenerCitasPorDoctor(
            doctorId as string, 
            estado as any, 
            fechaDesde ? new Date(fechaDesde as string) : undefined,
            fechaHasta ? new Date(fechaHasta as string) : undefined
          );
        }
      } else {
        // Paciente puede ver solo sus propias citas
        citas = await obtenerCitasPorPaciente(
          userId, 
          estado as any, 
          fechaDesde ? new Date(fechaDesde as string) : undefined,
          fechaHasta ? new Date(fechaHasta as string) : undefined
        );
      }

      res.json({
        success: true, 
        data: citas, 
        count: citas.length
      });
    } catch (error) {
      res.status(400).json({
        success: false, 
        error: error instanceof Error ? error.message : 'Error al listar citas'
      });
    }
  }
);

// PUT /api/v1/agenda/citas/:id - Actualizar una cita (solo para admins o doctores)
router.put('/:id',  
  authMiddleware, 
  requireDoctor, 
  validateCita('update'),
  async (req: AuthRequest,  res: Response) => {
    try {
      const { id } = req.params as { id: string };
      const citaData = req.body;

      // Verificar que la cita pertenece al doctor
      const citaExistente = await obtenerCitaPorId(id);
      if (!citaExistente || citaExistente.doctorId !== req.user!.id) {
        return res.status(403).json({
          success: false, 
          error: 'No autorizado para modificar esta cita'
        });
      }

      const cita = await actualizarCita(id,  citaData);
      res.json({
        success: true, 
        data: cita
      });
    } catch (error) {
      res.status(400).json({
        success: false, 
        error: error instanceof Error ? error.message : 'Error al actualizar cita'
      });
    }
  }
);

// DELETE /api/v1/agenda/citas/:id - Eliminar una cita (soft delete)
router.delete('/:id',  
  authMiddleware, 
  requireDoctor, 
  async (req: AuthRequest,  res: Response) => {
    try {
      const { id } = req.params as { id: string };

      // Verificar que la cita pertenece al doctor
      const citaExistente = await obtenerCitaPorId(id);
      if (!citaExistente || citaExistente.doctorId !== req.user!.id) {
        return res.status(403).json({
          success: false, 
          error: 'No autorizado para eliminar esta cita'
        });
      }

      const cita = await eliminarCita(id);
      res.json({
        success: true, 
        data: cita
      });
    } catch (error) {
      res.status(400).json({
        success: false, 
        error: error instanceof Error ? error.message : 'Error al eliminar cita'
      });
    }
  }
);

// PUT /api/v1/agenda/citas/:id/cancelar - Cancelar una cita
router.put('/:id/cancelar',  
  authMiddleware, 
  requireDoctorOrPaciente, 
  async (req: AuthRequest,  res: Response) => {
    try {
      const { id } = req.params as { id: string };
      const { motivo } = req.body;

      // Verificar que el usuario puede cancelar la cita
      const cita = await obtenerCitaPorId(id);
      if (!cita) {
        return res.status(404).json({
          success: false, 
          error: 'Cita no encontrada'
        });
      }

      if (req.user!.id !== cita.doctorId && req.user!.id !== cita.pacienteId) {
        return res.status(403).json({
          success: false, 
          error: 'No autorizado para cancelar esta cita'
        });
      }

      const citaCancelada = await cancelarCita(id,  motivo);
      res.json({
        success: true, 
        data: citaCancelada
      });
    } catch (error) {
      res.status(400).json({
        success: false, 
        error: error instanceof Error ? error.message : 'Error al cancelar cita'
      });
    }
  }
);

// PUT /api/v1/agenda/citas/:id/confirmar - Confirmar una cita
router.put('/:id/confirmar',  
  authMiddleware, 
  requireDoctor, 
  async (req: AuthRequest,  res: Response) => {
    try {
      const { id } = req.params as { id: string };

      // Verificar que la cita pertenece al doctor
      const cita = await obtenerCitaPorId(id);
      if (!cita || cita.doctorId !== req.user!.id) {
        return res.status(403).json({
          success: false, 
          error: 'No autorizado para confirmar esta cita'
        });
      }

      const citaConfirmada = await confirmarCita(id);
      res.json({
        success: true, 
        data: citaConfirmada
      });
    } catch (error) {
      res.status(400).json({
        success: false, 
        error: error instanceof Error ? error.message : 'Error al confirmar cita'
      });
    }
  }
);

// PUT /api/v1/agenda/citas/:id/iniciar - Iniciar una cita
router.put('/:id/iniciar',  
  authMiddleware, 
  requireDoctor, 
  async (req: AuthRequest,  res: Response) => {
    try {
      const { id } = req.params as { id: string };

      // Verificar que la cita pertenece al doctor
      const cita = await obtenerCitaPorId(id);
      if (!cita || cita.doctorId !== req.user!.id) {
        return res.status(403).json({
          success: false, 
          error: 'No autorizado para iniciar esta cita'
        });
      }

      const citaIniciada = await iniciarCita(id);
      res.json({
        success: true, 
        data: citaIniciada
      });
    } catch (error) {
      res.status(400).json({
        success: false, 
        error: error instanceof Error ? error.message : 'Error al iniciar cita'
      });
    }
  }
);

// PUT /api/v1/agenda/citas/:id/completar - Completar una cita
router.put('/:id/completar',  
  authMiddleware, 
  requireDoctor, 
  async (req: AuthRequest,  res: Response) => {
    try {
      const { id } = req.params as { id: string };

      // Verificar que la cita pertenece al doctor
      const cita = await obtenerCitaPorId(id);
      if (!cita || cita.doctorId !== req.user!.id) {
        return res.status(403).json({
          success: false, 
          error: 'No autorizado para completar esta cita'
        });
      }

      const citaCompletada = await completarCita(id);
      res.json({
        success: true, 
        data: citaCompletada
      });
    } catch (error) {
      res.status(400).json({
        success: false, 
        error: error instanceof Error ? error.message : 'Error al completar cita'
      });
    }
  }
);

// PUT /api/v1/agenda/citas/:id/no-presento - Marcar como no presentó
router.put('/:id/no-presento',  
  authMiddleware, 
  requireDoctor, 
  async (req: AuthRequest,  res: Response) => {
    try {
      const { id } = req.params as { id: string };

      // Verificar que la cita pertenece al doctor
      const cita = await obtenerCitaPorId(id);
      if (!cita || cita.doctorId !== req.user!.id) {
        return res.status(403).json({
          success: false, 
          error: 'No autorizado para modificar esta cita'
        });
      }

      const citaMarcada = await marcarNoPresento(id);
      res.json({
        success: true, 
        data: citaMarcada
      });
    } catch (error) {
      res.status(400).json({
        success: false, 
        error: error instanceof Error ? error.message : 'Error al marcar cita'
      });
    }
  }
);

// GET /api/v1/agenda/citas/proximas - Obtener citas próximas del doctor
router.get('/proximas',  
  authMiddleware, 
  requireDoctor, 
  async (req: AuthRequest,  res: Response) => {
    try {
      const { horas = '24' } = req.query;
      const doctorId = req.user!.id;
      const horasNum = parseInt(horas as string);

      const citas = await obtenerCitasProximas(doctorId,  horasNum);
      res.json({
        success: true, 
        data: citas
      });
    } catch (error) {
      res.status(400).json({
        success: false, 
        error: error instanceof Error ? error.message : 'Error al obtener citas próximas'
      });
    }
  }
);

// GET /api/v1/agenda/citas/estadisticas - Obtener estadísticas de citas del doctor
router.get('/estadisticas',  
  authMiddleware, 
  requireDoctor, 
  async (req: AuthRequest,  res: Response) => {
    try {
      const doctorId = req.user!.id;

      const estadisticas = await obtenerEstadisticasCitas(doctorId);
      res.json({
        success: true, 
        data: estadisticas
      });
    } catch (error) {
      res.status(400).json({
        success: false, 
        error: error instanceof Error ? error.message : 'Error al obtener estadísticas de citas'
      });
    }
  }
);

export default router;