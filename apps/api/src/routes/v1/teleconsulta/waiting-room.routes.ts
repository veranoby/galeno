/**
 * Rutas para el servicio de Sala de Espera Virtual
 *
 * Endpoints:
 * - POST /waiting-room - Crear sala de espera (paciente entra)
 * - GET /waiting-room/:citaId/status - Obtener estado de la sala
 * - POST /waiting-room/:citaId/admit - Admitir paciente (doctor)
 * - POST /waiting-room/:citaId/reject - Rechazar paciente (doctor)
 * - POST /waiting-room/:citaId/start-session - Iniciar sesión (doctor)
 * - DELETE /waiting-room/:citaId - Terminar sesión (doctor)
 * - GET /waiting-room/:citaId/validate - Validar acceso
 */

import { Router, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { authMiddleware, type AuthRequest } from '../../../middleware/auth.js';
import { logger } from '../../../utils/logger.js';
import {
  waitingRoomService,
} from '../../../services/teleconference/waiting-room.service.js';
import type { WaitingRoomStatus } from '../../../services/teleconference/waiting-room.types.js';

const router: Router = Router();

/**
 * Rate limiter para salas de espera
 * 30 requests por minuto por IP
 */
const waitingRoomLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 30, // 30 requests por minuto
  message: {
    success: false,
    error: 'Demasiadas solicitudes. Por favor intenta de nuevo en un minuto.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Aplicar rate limiter a todas las rutas
router.use(waitingRoomLimiter);

/**
 * @openapi
 * /api/v1/teleconsulta/waiting-room:
 *   post:
 *     summary: Crear sala de espera (paciente entra)
 *     tags: [Teleconsulta]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - citaId
 *             properties:
 *               citaId:
 *                 type: string
 *                 format: uuid
 *                 description: ID de la cita
 *     responses:
 *       201:
 *         description: Sala de espera creada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     citaId:
 *                       type: string
 *                     estado:
 *                       type: string
 *                       enum: [waiting, admitted, in-session, ended, timeout]
 *                     enteredAt:
 *                       type: string
 *                       format: date-time
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Error en la solicitud
 *       403:
 *         description: No autorizado
 *       404:
 *         description: Cita no encontrada
 */
router.post('/',
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const { citaId } = req.body;
      const userId = req.user!.id;

      if (!citaId) {
        return res.status(400).json({
          success: false,
          error: 'citaId es requerido',
        });
      }

      // Obtener información de la cita para verificar permisos
      const { obtenerCitaPorId } = await import('../../../services/agenda/cita-service.js');
      const cita = await obtenerCitaPorId(citaId);

      if (!cita) {
        return res.status(404).json({
          success: false,
          error: 'Cita no encontrada',
        });
      }

      // Solo el paciente puede crear la sala de espera
      if (cita.pacienteId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'No autorizado: solo el paciente puede entrar a la sala de espera',
        });
      }

      // Verificar que la cita es una teleconsulta
      if (cita.tipo !== 'teleconsulta') {
        return res.status(400).json({
          success: false,
          error: 'La cita no es una teleconsulta',
        });
      }

      // Verificar estado de la cita
      if (!['programada', 'confirmada', 'en_progreso'].includes(cita.estado)) {
        return res.status(400).json({
          success: false,
          error: 'La cita debe estar programada, confirmada o en progreso',
        });
      }

      // Crear la sala de espera
      const waitingRoom = await waitingRoomService.createWaitingRoom({
        citaId,
        pacienteId: userId,
        doctorId: cita.doctorId,
      });

      logger.info(
        {
          accion: 'waiting_room_created',
          userId,
          citaId,
        },
        'Sala de espera creada'
      );

      res.status(201).json({
        success: true,
        data: waitingRoom,
      });
    } catch (error) {
      logger.error({ error }, 'Error al crear sala de espera');
      
      if (error instanceof Error) {
        if (error.message.includes('ya está en sesión')) {
          return res.status(400).json({
            success: false,
            error: error.message,
          });
        }
        if (error.message.includes('ya fue admitido')) {
          return res.status(400).json({
            success: false,
            error: error.message,
          });
        }
      }

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al crear sala de espera',
      });
    }
  }
);

/**
 * @openapi
 * /api/v1/teleconsulta/waiting-room/{citaId}/status:
 *   get:
 *     summary: Obtener estado de la sala de espera
 *     tags: [Teleconsulta]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: citaId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID de la cita
 *     responses:
 *       200:
 *         description: Estado de la sala de espera
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     estado:
 *                       type: string
 *                       enum: [waiting, admitted, in-session, ended, timeout]
 *                     timeRemaining:
 *                       type: number
 *                       description: Tiempo restante en segundos
 *                     timeElapsed:
 *                       type: number
 *                       description: Tiempo transcurrido en segundos
 *                     enteredAt:
 *                       type: string
 *                       format: date-time
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *       404:
 *         description: Sala de espera no encontrada
 */
router.get('/:citaId/status',
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const { citaId } = req.params;
      if (typeof citaId !== 'string') {
        return res.status(400).json({ success: false, error: 'citaId must be a string' });
      }
      const userId = req.user!.id;
      const userRole = req.user!.rol;

      // Validar acceso
      const validation = await waitingRoomService.validateAccess(citaId, userId, userRole);

      if (!validation.valid) {
        return res.status(403).json({
          success: false,
          error: validation.reason || 'No autorizado',
        });
      }

      const status = waitingRoomService.getWaitingRoomStatus(citaId);

      if (!status) {
        return res.status(404).json({
          success: false,
          error: 'Sala de espera no encontrada',
        });
      }

      // Agregar información del paciente y doctor si es doctor quien consulta
      if (validation.role === 'doctor') {
        const { obtenerCitaPorId } = await import('../../../services/agenda/cita-service.js');
        const cita = await obtenerCitaPorId(citaId);

        if (cita) {
          const extendedStatus: WaitingRoomStatus & { paciente?: { id: string; nombre: string } } = {
            ...status,
            paciente: {
              id: cita.pacienteId,
              nombre: cita.paciente?.nombre || 'Paciente',
            },
          };
          res.json({
            success: true,
            data: extendedStatus,
          });
          return;
        }
      }

      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      logger.error({ error }, 'Error al obtener estado de sala de espera');
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al obtener estado',
      });
    }
  }
);

/**
 * @openapi
 * /api/v1/teleconsulta/waiting-room/{citaId}/admit:
 *   post:
 *     summary: Admitir paciente (doctor)
 *     tags: [Teleconsulta]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: citaId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID de la cita
 *     responses:
 *       200:
 *         description: Paciente admitido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     estado:
 *                       type: string
 *                       enum: [admitted]
 *                     admittedAt:
 *                       type: string
 *                       format: date-time
 *       403:
 *         description: No autorizado
 *       404:
 *         description: Sala de espera no encontrada
 */
router.post('/:citaId/admit',
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const { citaId } = req.params;
      if (typeof citaId !== 'string') {
        return res.status(400).json({ success: false, error: 'citaId must be a string' });
      }
      const doctorId = req.user!.id;

      // Admitir paciente
      const waitingRoom = await waitingRoomService.admitPatient(citaId, doctorId);

      logger.info(
        {
          accion: 'patient_admitted',
          doctorId,
          citaId,
          pacienteId: waitingRoom.pacienteId,
        },
        'Paciente admitido en sala de espera'
      );

      res.json({
        success: true,
        data: waitingRoom,
      });
    } catch (error) {
      logger.error({ error }, 'Error al admitir paciente');
      
      if (error instanceof Error) {
        if (error.message.includes('No hay sala de espera')) {
          return res.status(404).json({
            success: false,
            error: error.message,
          });
        }
        if (error.message.includes('No autorizado')) {
          return res.status(403).json({
            success: false,
            error: error.message,
          });
        }
      }

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al admitir paciente',
      });
    }
  }
);

/**
 * @openapi
 * /api/v1/teleconsulta/waiting-room/{citaId}/reject:
 *   post:
 *     summary: Rechazar paciente (doctor)
 *     tags: [Teleconsulta]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: citaId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID de la cita
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Motivo del rechazo
 *     responses:
 *       200:
 *         description: Paciente rechazado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     estado:
 *                       type: string
 *                       enum: [ended]
 *                     rejectReason:
 *                       type: string
 *       403:
 *         description: No autorizado
 *       404:
 *         description: Sala de espera no encontrada
 */
router.post('/:citaId/reject',
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const { citaId } = req.params;
      if (typeof citaId !== 'string') {
        return res.status(400).json({ success: false, error: 'citaId must be a string' });
      }
      const { reason } = req.body;
      const doctorId = req.user!.id;

      // Rechazar paciente
      const waitingRoom = await waitingRoomService.rejectPatient(citaId, doctorId, reason);

      logger.info(
        {
          accion: 'patient_rejected',
          doctorId,
          citaId,
          pacienteId: waitingRoom.pacienteId,
          reason,
        },
        'Paciente rechazado en sala de espera'
      );

      res.json({
        success: true,
        data: waitingRoom,
      });
    } catch (error) {
      logger.error({ error }, 'Error al rechazar paciente');
      
      if (error instanceof Error) {
        if (error.message.includes('No hay sala de espera')) {
          return res.status(404).json({
            success: false,
            error: error.message,
          });
        }
        if (error.message.includes('No autorizado')) {
          return res.status(403).json({
            success: false,
            error: error.message,
          });
        }
      }

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al rechazar paciente',
      });
    }
  }
);

/**
 * @openapi
 * /api/v1/teleconsulta/waiting-room/{citaId}/start-session:
 *   post:
 *     summary: Iniciar sesión de consulta (doctor)
 *     tags: [Teleconsulta]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: citaId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID de la cita
 *     responses:
 *       200:
 *         description: Sesión iniciada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     estado:
 *                       type: string
 *                       enum: [in-session]
 *                     sessionStartedAt:
 *                       type: string
 *                       format: date-time
 *       403:
 *         description: No autorizado
 *       404:
 *         description: Sala de espera no encontrada
 */
router.post('/:citaId/start-session',
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const { citaId } = req.params;
      if (typeof citaId !== 'string') {
        return res.status(400).json({ success: false, error: 'citaId must be a string' });
      }
      const doctorId = req.user!.id;

      // Iniciar sesión
      const waitingRoom = await waitingRoomService.startSession(citaId, doctorId);

      logger.info(
        {
          accion: 'session_started',
          doctorId,
          citaId,
          pacienteId: waitingRoom.pacienteId,
        },
        'Sesión de consulta iniciada'
      );

      res.json({
        success: true,
        data: waitingRoom,
      });
    } catch (error) {
      logger.error({ error }, 'Error al iniciar sesión');
      
      if (error instanceof Error) {
        if (error.message.includes('No hay sala de espera')) {
          return res.status(404).json({
            success: false,
            error: error.message,
          });
        }
        if (error.message.includes('No autorizado')) {
          return res.status(403).json({
            success: false,
            error: error.message,
          });
        }
      }

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al iniciar sesión',
      });
    }
  }
);

/**
 * @openapi
 * /api/v1/teleconsulta/waiting-room/{citaId}:
 *   delete:
 *     summary: Terminar sesión (doctor)
 *     tags: [Teleconsulta]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: citaId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID de la cita
 *     responses:
 *       200:
 *         description: Sesión terminada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     estado:
 *                       type: string
 *                       enum: [ended]
 *                     endedAt:
 *                       type: string
 *                       format: date-time
 *       403:
 *         description: No autorizado
 *       404:
 *         description: Sala de espera no encontrada
 */
router.delete('/:citaId',
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const { citaId } = req.params;
      if (typeof citaId !== 'string') {
        return res.status(400).json({ success: false, error: 'citaId must be a string' });
      }
      const doctorId = req.user!.id;

      // Terminar sesión
      const waitingRoom = await waitingRoomService.endSession(citaId, doctorId);

      logger.info(
        {
          accion: 'session_ended',
          doctorId,
          citaId,
          pacienteId: waitingRoom.pacienteId,
        },
        'Sesión de consulta finalizada'
      );

      res.json({
        success: true,
        data: waitingRoom,
      });
    } catch (error) {
      logger.error({ error }, 'Error al terminar sesión');
      
      if (error instanceof Error) {
        if (error.message.includes('No hay sala de espera')) {
          return res.status(404).json({
            success: false,
            error: error.message,
          });
        }
        if (error.message.includes('No autorizado')) {
          return res.status(403).json({
            success: false,
            error: error.message,
          });
        }
      }

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al terminar sesión',
      });
    }
  }
);

/**
 * @openapi
 * /api/v1/teleconsulta/waiting-room/{citaId}/validate:
 *   get:
 *     summary: Validar acceso a sala de espera
 *     tags: [Teleconsulta]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: citaId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID de la cita
 *     responses:
 *       200:
 *         description: Resultado de validación
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     valid:
 *                       type: boolean
 *                     role:
 *                       type: string
 *                       enum: [paciente, doctor]
 *                     reason:
 *                       type: string
 */
router.get('/:citaId/validate',
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const { citaId } = req.params;
      if (typeof citaId !== 'string') {
        return res.status(400).json({ success: false, error: 'citaId must be a string' });
      }
      const userId = req.user!.id;
      const userRole = req.user!.rol;

      const validation = await waitingRoomService.validateAccess(citaId, userId, userRole);

      res.json({
        success: true,
        data: validation,
      });
    } catch (error) {
      logger.error({ error }, 'Error al validar acceso');
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al validar acceso',
      });
    }
  }
);

/**
 * @openapi
 * /api/v1/teleconsulta/waiting-room/doctor/active:
 *   get:
 *     summary: Obtener salas activas del doctor
 *     tags: [Teleconsulta]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de salas activas
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
 *                       citaId:
 *                         type: string
 *                       pacienteId:
 *                         type: string
 *                       estado:
 *                         type: string
 *                       enteredAt:
 *                         type: string
 *                       expiresAt:
 *                         type: string
 */
router.get('/doctor/active',
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const doctorId = req.user!.id;
      const activeRooms = waitingRoomService.getActiveRoomsForDoctor(doctorId);

      res.json({
        success: true,
        data: activeRooms,
      });
    } catch (error) {
      logger.error({ error }, 'Error al obtener salas activas');
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al obtener salas activas',
      });
    }
  }
);

export default router;
