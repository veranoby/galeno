/**
 * Rutas para el servicio de videoconferencia Jitsi Meet
 *
 * Endpoints:
 * - POST /api/v1/teleconsulta/meeting - Crear/configurar reunión para una cita
 * - GET /api/v1/teleconsulta/meeting/:citaId - Obtener datos de reunión para unirse
 * - DELETE /api/v1/teleconsulta/meeting/:citaId - Terminar reunión
 * - POST /api/v1/teleconsulta/waiting-room - Crear sala de espera
 * - GET /api/v1/teleconsulta/waiting-room/:citaId/status - Obtener estado de sala
 * - POST /api/v1/teleconsulta/waiting-room/:citaId/admit - Admitir paciente
 * - POST /api/v1/teleconsulta/waiting-room/:citaId/reject - Rechazar paciente
 * - DELETE /api/v1/teleconsulta/waiting-room/:citaId - Terminar sesión
 */

import { Router, type Response } from 'express';
import { authMiddleware, type AuthRequest, requireDoctor } from '../../middleware/auth.js';
import { logger } from '../../utils/logger.js';
import {
  jitsiService,
} from '../../services/teleconference/jitsi.service.js';
import { metricsService } from '../../services/monitoring/metrics.service.js';
import { obtenerCitaPorId } from '../../services/agenda/cita-service.js';
import waitingRoomRoutes from './teleconsulta/waiting-room.routes.js';

const router: Router = Router();

// Montar rutas de waiting room
router.use('/waiting-room', waitingRoomRoutes);

/**
 * @openapi
 * /api/v1/teleconsulta/meeting:
 *   post:
 *     summary: Crear/configurar reunión para una cita
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
 *         description: Reunión creada exitosamente
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
 *                     meetingId:
 *                       type: string
 *                     roomName:
 *                       type: string
 *                     jwtToken:
 *                       type: string
 *                     joinUrl:
 *                       type: string
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *                     domain:
 *                       type: string
 *       400:
 *         description: Error en la solicitud
 *       403:
 *         description: No autorizado
 *       404:
 *         description: Cita no encontrada
 */
router.post('/meeting',
  authMiddleware,
  requireDoctor,
  async (req: AuthRequest, res: Response) => {
    try {
      const { citaId } = req.body;
      const doctorId = req.user!.id;

      if (!citaId) {
        return res.status(400).json({
          success: false,
          error: 'citaId es requerido',
        });
      }

      // Verificar que la cita existe
      const cita = await obtenerCitaPorId(citaId);

      if (!cita) {
        return res.status(404).json({
          success: false,
          error: 'Cita no encontrada',
        });
      }

      // Verificar que la cita pertenece al doctor
      if (cita.doctorId !== doctorId) {
        return res.status(403).json({
          success: false,
          error: 'No autorizado: la cita no pertenece a este doctor',
        });
      }

      // Verificar que la cita es una teleconsulta
      if (cita.tipo !== 'teleconsulta') {
        return res.status(400).json({
          success: false,
          error: 'La cita no es una teleconsulta',
        });
      }

      // Verificar que la cita esté programada o confirmada
      if (cita.estado !== 'programada' && cita.estado !== 'confirmada' && cita.estado !== 'en_progreso') {
        return res.status(400).json({
          success: false,
          error: 'La cita debe estar programada, confirmada o en progreso',
        });
      }

      // Crear la reunión
      const meeting = await jitsiService.createMeeting({
        citaId,
        doctorId,
        pacienteId: cita.pacienteId,
        startTime: cita.fechaHora,
        doctorInfo: {
          nombre: cita.doctor?.nombre || 'Doctor',
          email: cita.doctor?.email || undefined,
        },
      });

      // Actualizar la cita con los datos de la reunión
      await jitsiService.configurarCitaTeleconsulta(citaId, meeting);

      // Log de auditoría
      logger.info({
        accion: 'jitsi_meeting_created',
        userId: doctorId,
        citaId,
        meetingId: meeting.meetingId,
        roomName: meeting.roomName,
      }, 'Reunión Jitsi creada');

      res.status(201).json({
        success: true,
        data: meeting,
      });
    } catch (error) {
      logger.error({ error }, 'Error al crear reunión Jitsi');
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al crear reunión',
      });
    }
  }
);

/**
 * @openapi
 * /api/v1/teleconsulta/meeting/{citaId}:
 *   get:
 *     summary: Obtener datos de reunión para unirse
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
 *         description: Datos de la reunión
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
 *                     roomName:
 *                       type: string
 *                     jwtToken:
 *                       type: string
 *                     joinUrl:
 *                       type: string
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *                     role:
 *                       type: string
 *                       enum: [moderator, participant]
 *       403:
 *         description: No autorizado
 *       404:
 *         description: Cita no encontrada o reunión no configurada
 */
router.get('/meeting/:citaId',
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const { citaId } = req.params;
      const userId = req.user!.id;
      const userRole = req.user!.rol;
      const userName = req.user!.email?.split('@')[0] || 'Usuario';
      const userEmail = req.user!.email;

      // Validar que citaId es un string
      if (typeof citaId !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'citaId inválido'
        });
      }

      // Obtener información de reunión
      const meetingInfo = await jitsiService.getMeetingInfo(
        citaId,
        userId,
        userRole,
        userName,
        userEmail
      );

      if (!meetingInfo) {
        return res.status(404).json({
          success: false,
          error: 'Reunión no encontrada o no tienes acceso',
        });
      }

      // Log de auditoría
      logger.info({
        accion: 'jitsi_meeting_joined',
        userId,
        userRole,
        citaId,
        role: meetingInfo.role,
      }, 'Usuario accediendo a reunión Jitsi');

      res.json({
        success: true,
        data: meetingInfo,
      });
    } catch (error) {
      logger.error({ error }, 'Error al obtener reunión Jitsi');
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al obtener reunión',
      });
    }
  }
);

/**
 * @openapi
 * /api/v1/teleconsulta/meeting/{citaId}:
 *   delete:
 *     summary: Terminar reunión
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
 *         description: Reunión terminada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       403:
 *         description: No autorizado
 *       404:
 *         description: Cita no encontrada
 */
router.delete('/meeting/:citaId',
  authMiddleware,
  requireDoctor,
  async (req: AuthRequest, res: Response) => {
    try {
      const { citaId } = req.params;
      const doctorId = req.user!.id;

      // Validar que citaId es un string
      if (typeof citaId !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'citaId inválido'
        });
      }

      // Verificar que la cita existe y pertenece al doctor
      const cita = await obtenerCitaPorId(citaId);

      if (!cita) {
        return res.status(404).json({
          success: false,
          error: 'Cita no encontrada',
        });
      }

      if (cita.doctorId !== doctorId) {
        return res.status(403).json({
          success: false,
          error: 'No autorizado: la cita no pertenece a este doctor',
        });
      }

      // Terminar la reunión
      await jitsiService.endMeeting(citaId);

      // Log de auditoría
      logger.info({
        accion: 'jitsi_meeting_ended',
        userId: doctorId,
        citaId,
      }, 'Reunión Jitsi terminada');

      res.json({
        success: true,
        message: 'Reunión terminada exitosamente',
      });
    } catch (error) {
      logger.error({ error }, 'Error al terminar reunión Jitsi');
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al terminar reunión',
      });
    }
  }
);

export default router;
