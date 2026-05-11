import { Router, Request, Response } from 'express';
import { AuthRequest, authMiddleware } from '../../middleware/auth.js';
import { logger } from '../../utils/logger.js';
import prisma from '../../config/database.js';
import { sseManager } from '../../services/sse/manager.js';
import { AuditService } from '../../services/audit/audit.service.js';
import { AuditAction } from '@prisma/client';

const router: Router = Router();

/**
 * Interface for simplified interconsulta creation
 */
interface SimpleInterconsultaCreate {
  pacienteId: string;
  especialidadDestino: string;
  motivo: string;
}

/**
 * Interface for simplified interconsulta response
 */
interface SimpleInterconsulta {
  id: string;
  pacienteId: string;
  pacienteNombre: string;
  especialidadDestino: string;
  motivo: string;
  estado: 'pendiente' | 'en_proceso' | 'completada' | 'cerrada';
  fechaCreacion: string;
  solicitanteId: string;
  solicitanteNombre: string;
}

/**
 * GET /api/v1/interconsultas/simple - Listar interconsultas simplificadas
 *
 * Query params:
 * - estado: Filter by state (pendiente, en_proceso, completada, cerrada)
 * - busqueda: Search by patient name or ID
 */
router.get('/simple', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { estado, busqueda } = req.query;

    // Build where clause
    const where: any = {};

    // Filter by estado if provided - map simplified states to Prisma states
    if (estado && typeof estado === 'string') {
      // Map simplified states to Prisma enum states
      const estadoMap: Record<string, string> = {
        'pendiente': 'pendiente',
        'en_proceso': 'en_proceso',
        'aceptada': 'aceptada',
        'completada': 'completada',
        'cerrada': 'cerrada'
      };
      const prismaEstado = estadoMap[estado];
      if (prismaEstado) {
        where.estado = prismaEstado;
      }
    }

    // Search by patient name or ID
    if (busqueda && typeof busqueda === 'string') {
      where.OR = [
        { pacienteId: busqueda },
        { paciente: { nombre: { contains: busqueda, mode: 'insensitive' } } }
      ];
    }

    // Fetch interconsultas with relations
    const interconsultas = await prisma.interconsulta.findMany({
      where,
      include: {
        consulta: {
          select: {
            paciente: {
              select: {
                id: true,
                nombre: true
              }
            }
          }
        },
        solicitanteUser: {
          select: {
            id: true,
            nombre: true,
            especialidad: true
          }
        },
        destinoUser: {
          select: {
            id: true,
            nombre: true,
            especialidad: true
          }
        }
      },
      orderBy: { creadoEn: 'desc' }
    });

    // Transform to simplified format
    const simplified: SimpleInterconsulta[] = interconsultas.map((interconsulta) => {
      // Map Prisma estado to simplified estado using switch for type safety
      let simplifiedEstado: SimpleInterconsulta['estado'] = 'pendiente';
      
      switch (interconsulta.estado) {
        case 'pendiente':
          simplifiedEstado = 'pendiente';
          break;
        case 'en_proceso':
        case 'aceptada':
          simplifiedEstado = 'en_proceso';
          break;
        case 'rechazada':
        case 'cerrada':
          simplifiedEstado = 'cerrada';
          break;
        case 'completada':
          simplifiedEstado = 'completada';
          break;
      }

      return {
        id: interconsulta.id,
        pacienteId: interconsulta.consulta?.paciente?.id || '',
        pacienteNombre: interconsulta.consulta?.paciente?.nombre || 'Sin paciente',
        especialidadDestino: interconsulta.destinoUser?.especialidad || 'Especialidad',
        motivo: interconsulta.mensaje || 'Sin motivo',
        estado: simplifiedEstado,
        fechaCreacion: interconsulta.creadoEn.toISOString(),
        solicitanteId: interconsulta.solicitanteUser?.id || '',
        solicitanteNombre: interconsulta.solicitanteUser?.nombre || 'Desconocido'
      };
    });

    res.json(simplified);
  } catch (error) {
    logger.error({ error }, 'Error fetching simplified interconsultas');
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch simplified interconsultas'
    });
  }
});

/**
 * POST /api/v1/interconsultas/simple - Crear interconsulta simplificada
 *
 * Creates a simplified interconsulta without requiring an existing consulta
 */
router.post('/simple', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { pacienteId, especialidadDestino, motivo }: SimpleInterconsultaCreate = req.body;

    // Validate required fields
    if (!pacienteId || !especialidadDestino || !motivo) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'pacienteId, especialidadDestino, and motivo are required'
      });
    }

    // Verify patient exists and get cuentaId
    const paciente = await prisma.paciente.findUnique({
      where: { id: pacienteId },
      select: { id: true, cuentaId: true, nombre: true }
    });

    if (!paciente) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Patient not found'
      });
    }

    // Get or create a consulta for this interconsulta
    // For simplified flow, we create a minimal consulta record
    const doctorId = req.user?.id;
    const cuentaId = req.user?.rol === 'ASISTENTE' || req.user?.rol === 'ENFERMERA'
      ? req.user?.cuentaId
      : req.user?.id;

    // Create a minimal consulta record to link the interconsulta
    const consulta = await prisma.consulta.create({
      data: {
        cuentaId: cuentaId || paciente.cuentaId,
        pacienteId,
        doctorId: doctorId || paciente.cuentaId,
        estado: 'borrador',
        motivoConsulta: `Interconsulta simplificada: ${motivo}`
      }
    });

    // Find destination doctor by specialty (first available)
    const destinoUser = await prisma.cuenta.findFirst({
      where: {
        especialidad: especialidadDestino,
        rol: 'DOCTOR'
      },
      select: { id: true, nombre: true, especialidad: true }
    });

    if (!destinoUser) {
      // If no doctor found with that specialty, use the account owner
      return res.status(404).json({
        error: 'Not found',
        message: `No doctor found with specialty: ${especialidadDestino}`
      });
    }

    // Create interconsulta
    const interconsulta = await prisma.interconsulta.create({
      data: {
        consultaId: consulta.id,
        solicitante: cuentaId || doctorId || '',
        destino: destinoUser.id,
        tipo: 'basica',
        estado: 'pendiente',
        mensaje: motivo
      },
      include: {
        consulta: {
          select: {
            paciente: {
              select: {
                id: true,
                nombre: true
              }
            }
          }
        },
        solicitanteUser: {
          select: {
            id: true,
            nombre: true
          }
        }
      }
    });

    const response: SimpleInterconsulta = {
      id: interconsulta.id,
      pacienteId: pacienteId,
      pacienteNombre: paciente.nombre,
      especialidadDestino,
      motivo,
      estado: 'pendiente',
      fechaCreacion: interconsulta.creadoEn.toISOString(),
      solicitanteId: interconsulta.solicitanteUser?.id || '',
      solicitanteNombre: interconsulta.solicitanteUser?.nombre || 'Desconocido'
    };

    logger.info({
      interconsultaId: interconsulta.id,
      pacienteId,
      createdBy: req.user?.id
    }, 'Simplified interconsulta created');

    res.status(201).json(response);
  } catch (error) {
    logger.error({ error, body: req.body }, 'Error creating simplified interconsulta');
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create simplified interconsulta'
    });
  }
});

/**
 * PATCH /api/v1/interconsultas/simple/:id/estado - Update interconsulta estado
 */
router.patch('/simple/:id/estado', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
    const { estado } = req.body;

    if (!estado) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'estado is required'
      });
    }

    const validEstados = ['pendiente', 'en_proceso', 'aceptada', 'completada', 'cerrada'];
    if (!validEstados.includes(estado)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Invalid estado. Must be one of: ${validEstados.join(', ')}`
      });
    }

    // Map simplified estado to Prisma estado
    const estadoMap: Record<string, string> = {
      'pendiente': 'pendiente',
      'en_proceso': 'en_proceso',
      'aceptada': 'aceptada',
      'completada': 'completada',
      'cerrada': 'cerrada'
    };
    const prismaEstado = estadoMap[estado];

    const interconsulta = await prisma.interconsulta.findUnique({
      where: { id }
    });

    if (!interconsulta) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Interconsulta not found'
      });
    }

    const oldEstado = interconsulta.estado;

    const updated = await prisma.interconsulta.update({
      where: { id },
      data: { estado: prismaEstado as any }
    });

    // Emitir notificación SSE al solicitante
    try {
      await sseManager.sendEventToUser(interconsulta.solicitante, 'INTERCONSULTA_STATUS_CHANGE', {
        interconsultaId: id,
        oldStatus: oldEstado,
        newStatus: prismaEstado,
        mensaje: 'Interconsulta actualizada'
      });
    } catch (error) {
      logger.error({ error }, 'Error sending SSE notification');
    }

    // Registrar auditoría
    try {
      await AuditService.log({
        userId: req.user!.id,
        action: AuditAction.RESOURCE_UPDATE,
        resourceType: 'INTERCONSULTA' as any,
        resourceId: id,
        rolUsuario: req.user!.rol,
        metadata: {
          from: oldEstado,
          to: prismaEstado
        }
      });
    } catch (error) {
      logger.error({ error }, 'Error logging audit');
    }

    res.json({
      id: updated.id,
      estado: updated.estado
    });
  } catch (error) {
    logger.error({ error, id: req.params.id }, 'Error updating interconsulta estado');
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update interconsulta estado'
    });
  }
});

/**
 * PATCH /api/v1/interconsultas/simple/:id/cerrar - Close interconsulta manually
 */
router.patch('/simple/:id/cerrar', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];

    const interconsulta = await prisma.interconsulta.findUnique({
      where: { id }
    });

    if (!interconsulta) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Interconsulta not found'
      });
    }

    const oldEstado = interconsulta.estado;

    const updated = await prisma.interconsulta.update({
      where: { id },
      data: {
        estado: 'cerrada' as any,
        respondidaEn: new Date()
      }
    });

    // Emitir notificación SSE al solicitante
    try {
      await sseManager.sendEventToUser(interconsulta.solicitante, 'INTERCONSULTA_CERRADA', {
        interconsultaId: id,
        oldStatus: oldEstado,
        newStatus: 'cerrada',
        mensaje: 'Interconsulta cerrada manualmente'
      });
    } catch (error) {
      logger.error({ error }, 'Error sending SSE notification');
    }

    // Registrar auditoría
    try {
      await AuditService.log({
        userId: req.user!.id,
        action: AuditAction.RESOURCE_UPDATE,
        resourceType: 'INTERCONSULTA' as any,
        resourceId: id,
        rolUsuario: req.user!.rol,
        metadata: {
          from: oldEstado,
          to: 'cerrada',
          closedManually: true
        }
      });
    } catch (error) {
      logger.error({ error }, 'Error logging audit');
    }

    logger.info({
      interconsultaId: id,
      closedBy: req.user?.id
    }, 'Simplified interconsulta closed manually');

    res.json({
      id: updated.id,
      estado: updated.estado,
      mensaje: 'Interconsulta cerrada exitosamente'
    });
  } catch (error) {
    logger.error({ error, id: req.params.id }, 'Error closing interconsulta');
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to close interconsulta'
    });
  }
});

/**
 * GET /api/v1/interconsultas/simple/:id - Get single interconsulta detail
 */
router.get('/simple/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];

    const interconsulta = await prisma.interconsulta.findUnique({
      where: { id },
      include: {
        consulta: {
          select: {
            paciente: {
              select: {
                id: true,
                nombre: true,
                cedula: true,
                fechaNacimiento: true
              }
            }
          }
        },
        solicitanteUser: {
          select: {
            id: true,
            nombre: true,
            especialidad: true
          }
        },
        destinoUser: {
          select: {
            id: true,
            nombre: true,
            especialidad: true
          }
        }
      }
    });

    if (!interconsulta) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Interconsulta not found'
      });
    }

    res.json({
      id: interconsulta.id,
      pacienteId: interconsulta.consulta?.paciente?.id || '',
      pacienteNombre: interconsulta.consulta?.paciente?.nombre || 'Sin paciente',
      pacienteCedula: interconsulta.consulta?.paciente?.cedula || '',
      especialidadDestino: interconsulta.destinoUser?.especialidad || '',
      destinoNombre: interconsulta.destinoUser?.nombre || '',
      motivo: interconsulta.mensaje || '',
      respuesta: interconsulta.respuesta || '',
      estado: interconsulta.estado,
      fechaCreacion: interconsulta.creadoEn.toISOString(),
      respondidaEn: interconsulta.respondidaEn?.toISOString() || null,
      solicitanteNombre: interconsulta.solicitanteUser?.nombre || 'Desconocido'
    });
  } catch (error) {
    logger.error({ error, id: req.params.id }, 'Error fetching interconsulta detail');
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch interconsulta detail'
    });
  }
});

export default router;
