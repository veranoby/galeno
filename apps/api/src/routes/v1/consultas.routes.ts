import { Router, Response } from 'express';
import { EstadoConsulta } from '@prisma/client';
import { AuthRequest, authMiddleware, canAccessPatient, requireMedical } from '../../middleware/auth.js';
import { logger } from '../../utils/logger.js';
import prisma from '../../config/database.js';
import {
  canTransition,
  getNextStates,
  validateTransition,
  getStateInfo
} from '../../services/stateMachine.js';
import { consultaSignatureService, FirmaConsultaError } from '../../services/consultation/signature.js';
import consultationAuditService from '../../services/consultation/consultation-audit.service.js';
import getDIContainer from '../../di-container.js';

const router: Router = Router();

/**
 * GET /api/consultas - Listar consultas con filtros y paginación
 *
 * Query params:
 * - estado: Filter by state (borrador, triaje, pendiente, en_atencion, finalizada, interconsulta)
 * - pacienteId: Filter by patient UUID
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 *
 * Includes: paciente, doctor, asistente relations
 * RLS automatically filters by user access
 */
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const {
      estado,
      pacienteId,
      page = '1',
      limit = '20'
    } = req.query;

    // Parse pagination params
    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
    const skip = (pageNum - 1) * limitNum;

    // Build where clause with RLS filtering
    const where: any = {};

    if (estado && typeof estado === 'string') {
      // Validate estado
      if (Object.values(EstadoConsulta).includes(estado as EstadoConsulta)) {
        where.estado = estado as EstadoConsulta;
      } else {
        return res.status(400).json({
          error: 'Bad Request',
          message: `Invalid estado. Must be one of: ${Object.values(EstadoConsulta).join(', ')}`
        });
      }
    }

    if (pacienteId && typeof pacienteId === 'string') {
      // Verify patient access for non-admin users (explicit RLS check)
      if (req.user?.rol !== 'ADMIN') {
        const hasAccess = await canAccessPatient(req, pacienteId);
        if (!hasAccess) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'You do not have access to this patient'
          });
        }
      }
      where.pacienteId = pacienteId;
    }

    // Get total count for pagination
    const total = await prisma.consulta.count({ where });

    // Fetch consultas with relations
    const consultas = await prisma.consulta.findMany({
      where,
      include: {
        paciente: {
          select: {
            id: true,
            nombre: true,
            cedula: true,
            healthWalletId: true,
            fechaNacimiento: true,
            telefono: true,
            email: true
          }
        },
        doctor: {
          select: {
            id: true,
            nombre: true,
            email: true,
            especialidad: true,
            rol: true
          }
        },
        asistente: {
          select: {
            id: true,
            nombre: true,
            email: true,
            rol: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limitNum
    });

    res.json({
      data: consultas,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasMore: skip + limitNum < total
      }
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching consultas');
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch consultas'
    });
  }
});

/**
 * GET /api/consultas/:id - Obtener detalle de una consulta
 *
 * Includes all relations and verifies ownership via RLS
 */
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];

    const consulta = await prisma.consulta.findUnique({
      where: { id },
      include: {
        paciente: {
          include: {
            antecedentes: {
              select: {
                id: true,
                tipo: true,
                categoria: true,
                detalle: true,
                grado: true,
                fechaRegistro: true
              }
            }
          }
        },
        doctor: {
          select: {
            id: true,
            nombre: true,
            email: true,
            especialidad: true,
            rol: true
          }
        },
        asistente: {
          select: {
            id: true,
            nombre: true,
            email: true,
            rol: true
          }
        },
        parent: {
          include: {
            paciente: {
              select: {
                nombre: true,
                cedula: true
              }
            },
            doctor: {
              select: {
                nombre: true,
                especialidad: true
              }
            }
          }
        },
        children: {
          select: {
            id: true,
            estado: true
          }
        },
        documentos: {
          select: {
            id: true,
            tipo: true,
            estado: true,
            fechaEmision: true
          }
        }
      }
    });

    if (!consulta) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Consulta not found'
      });
    }

    // Verify patient access (RLS ownership check)
    if (req.user?.rol !== 'ADMIN') {
      const hasAccess = await canAccessPatient(req, consulta.pacienteId);
      if (!hasAccess) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You do not have access to this consulta'
        });
      }
    }

    res.json({ data: consulta });
  } catch (error) {
    logger.error({ error, id: req.params.id }, 'Error fetching consulta');
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch consulta'
    });
  }
});

/**
 * POST /api/consultas - Crear nueva consulta
 *
 * Initial state: 'borrador'
 * Associated to user's patient (RLS)
 */
router.post('/', authMiddleware, requireMedical, async (req: AuthRequest, res: Response) => {
  try {
    const {
      pacienteId,
      motivoConsulta,
      triajeData,
      asistenteId
    } = req.body;

    // Validate required fields
    if (!pacienteId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'pacienteId is required'
      });
    }

    // Verify patient access (RLS)
    if (req.user?.rol !== 'ADMIN') {
      const hasAccess = await canAccessPatient(req, pacienteId);
      if (!hasAccess) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You do not have access to this patient'
        });
      }
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

    // Determine doctor ID based on user role
    let doctorId = req.user?.id;
    let cuentaId = paciente.cuentaId;

    if (req.user?.rol === 'ASISTENTE' || req.user?.rol === 'ENFERMERA') {
      // For linked users, use the assigned doctor's ID
      doctorId = req.user.cuentaId;
      if (!doctorId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Cannot determine doctor for this consulta'
        });
      }
    } else if (req.user?.rol === 'DOCTOR') {
      doctorId = req.user.id;
      cuentaId = req.user.id;
    }

    // Verify asistente exists if provided
    if (asistenteId) {
      const asistente = await prisma.usuarioVinculado.findUnique({
        where: { id: asistenteId }
      });

      if (!asistente || !asistente.activo) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid asistente'
        });
      }
    }

    // Create consulta with initial state 'borrador'
    const consulta = await prisma.consulta.create({
      data: {
        cuentaId,
        pacienteId,
        doctorId: doctorId!,
        asistenteId: asistenteId || null,
        estado: 'borrador',
        motivoConsulta: motivoConsulta || null,
        triajeData: triajeData || null
      },
      include: {
        paciente: {
          select: {
            id: true,
            nombre: true,
            cedula: true
          }
        },
        doctor: {
          select: {
            id: true,
            nombre: true,
            especialidad: true
          }
        },
        asistente: {
          select: {
            id: true,
            nombre: true,
            rol: true
          }
        }
      }
    });

    logger.info({
      consultaId: consulta.id,
      pacienteId: consulta.pacienteId,
      doctorId: consulta.doctorId,
      createdBy: req.user?.id
    }, 'Consulta created');

    res.status(201).json({ data: consulta });
  } catch (error) {
    logger.error({ error, body: req.body }, 'Error creating consulta');
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create consulta'
    });
  }
});

/**
 * PUT /api/consultas/:id - Actualizar consulta
 *
 * Only allows updates if state is 'borrador' or 'triaje'
 * Validates state transitions
 */
router.put('/:id', authMiddleware, requireMedical, async (req: AuthRequest, res: Response) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
    const {
      estado,
      motivoConsulta,
      evolucion,
      diagnosticoCie10,
      recetaJson,
      examenesJson,
      triajeData,
      firmado
    } = req.body;

    // Get existing consulta
    const existingConsulta = await prisma.consulta.findUnique({
      where: { id },
      include: {
        paciente: true
      }
    });

    if (!existingConsulta) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Consulta not found'
      });
    }

    // Verify patient access (RLS ownership check)
    if (req.user?.rol !== 'ADMIN') {
      const hasAccess = await canAccessPatient(req, existingConsulta.pacienteId);
      if (!hasAccess) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You do not have access to this consulta'
        });
      }
    }

    // Validar actualización con servicio de firma (previene ediciones post-firma)
    const validacion = await consultaSignatureService.validarActualizacion(
      id,
      { estado },
      req.user!.id
    );

    if (!validacion.valida) {
      return res.status(400).json({
        error: 'Bad Request',
        message: validacion.error
      });
    }

    // Validate state transition if changing state (before DB update)
    if (estado && estado !== existingConsulta.estado) {
      try {
        const di = getDIContainer();
        (di.cradle as any).consultationTransitionService.validateTransition(
          existingConsulta.estado,
          estado,
          req.user!.rol
        );
      } catch (error: any) {
        return res.status(error.status || 400).json({
          error: 'Bad Request',
          message: error.message || 'Invalid state transition'
        });
      }
    }

    // Build update data
    const updateData: any = {};
    if (motivoConsulta !== undefined) updateData.motivoConsulta = motivoConsulta;
    if (evolucion !== undefined) updateData.evolucion = evolucion;
    if (diagnosticoCie10 !== undefined) updateData.diagnosticoCie10 = diagnosticoCie10;
    if (recetaJson !== undefined) updateData.recetaJson = recetaJson;
    if (examenesJson !== undefined) updateData.examenesJson = examenesJson;
    if (triajeData !== undefined) updateData.triajeData = triajeData;
    if (estado !== undefined) updateData.estado = estado;
    if (firmado !== undefined) {
      // Only allow signing if not already signed and in a valid state
      if (firmado && !existingConsulta.firmado) {
        if (!['finalizada', 'interconsulta'].includes(existingConsulta.estado) &&
            !['finalizada', 'interconsulta'].includes(estado)) {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'Can only sign consultas in finalizada or interconsulta state'
          });
        }
        updateData.firmado = true;
      }
    }

    // Update consulta
    const consulta = await prisma.consulta.update({
      where: { id },
      data: updateData,
      include: {
        paciente: {
          select: {
            id: true,
            nombre: true,
            cedula: true
          }
        },
        doctor: {
          select: {
            id: true,
            nombre: true,
            especialidad: true
          }
        },
        asistente: {
          select: {
            id: true,
            nombre: true,
            rol: true
          }
        }
      }
    });

    logger.info({
      consultaId: consulta.id,
      previousState: existingConsulta.estado,
      newState: consulta.estado,
      updatedBy: req.user?.id
    }, 'Consulta updated');

    res.json({ data: consulta });
  } catch (error) {
    logger.error({ error, id: req.params.id, body: req.body }, 'Error updating consulta');
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update consulta'
    });
  }
});

/**
 * DELETE /api/consultas/:id - Eliminar consulta
 *
 * Only allows deletion if state is 'borrador'
 */
router.delete('/:id', authMiddleware, requireMedical, async (req: AuthRequest, res: Response) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];

    // Get existing consulta
    const existingConsulta = await prisma.consulta.findUnique({
      where: { id },
      include: {
        paciente: true
      }
    });

    if (!existingConsulta) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Consulta not found'
      });
    }

    // Verify patient access (RLS ownership check)
    if (req.user?.rol !== 'ADMIN') {
      const hasAccess = await canAccessPatient(req, existingConsulta.pacienteId);
      if (!hasAccess) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You do not have access to this consulta'
        });
      }
    }

    // Check if deletion is allowed (only borrador can be deleted)
    if (existingConsulta.estado !== 'borrador') {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Cannot delete consulta with state '${existingConsulta.estado}'. Only borrador can be deleted.`
      });
    }

    // Delete consulta (cascade will handle related documents)
    await prisma.consulta.delete({
      where: { id }
    });

    logger.info({
      consultaId: id,
      pacienteId: existingConsulta.pacienteId,
      deletedBy: req.user?.id
    }, 'Consulta deleted');

    res.status(204).send();
  } catch (error) {
    logger.error({ error, id: req.params.id }, 'Error deleting consulta');
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete consulta'
    });
  }
});

/**
 * PATCH /api/consultas/:id/estado - Cambiar estado de consulta
 *
 * Separate endpoint for state transitions
 * Validates state transitions using state machine
 */
router.patch('/:id/estado', authMiddleware, requireMedical, async (req: AuthRequest, res: Response) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
    const { estado } = req.body;

    if (!estado) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'estado is required'
      });
    }

    // Validate estado is a valid EstadoConsulta value
    if (!Object.values(EstadoConsulta).includes(estado)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Invalid estado. Must be one of: ${Object.values(EstadoConsulta).join(', ')}`
      });
    }

    // Get existing consulta
    const existingConsulta = await prisma.consulta.findUnique({
      where: { id }
    });

    if (!existingConsulta) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Consulta not found'
      });
    }

    // Verify patient access (RLS ownership check)
    if (req.user?.rol !== 'ADMIN') {
      const hasAccess = await canAccessPatient(req, existingConsulta.pacienteId);
      if (!hasAccess) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You do not have access to this consulta'
        });
      }
    }

    // Validate state transition using state machine
    try {
      const di = getDIContainer();
      (di.cradle as any).consultationTransitionService.validateTransition(
        existingConsulta.estado,
        estado,
        req.user!.rol
      );
    } catch (error: any) {
      return res.status(error.status || 400).json({
        error: 'Bad Request',
        message: error.message || 'Invalid state transition'
      });
    }

    // Update estado
    const consulta = await prisma.consulta.update({
      where: { id },
      data: { estado },
      include: {
        paciente: {
          select: {
            id: true,
            nombre: true,
            cedula: true
          }
        },
        doctor: {
          select: {
            id: true,
            nombre: true,
            especialidad: true
          }
        }
      }
    });

    // Emit event and Log state transition to audit trail
    try {
      const di = getDIContainer();
      await (di.cradle as any).consultationTransitionService.transitionState(
        existingConsulta.id,
        existingConsulta.estado,
        estado,
        req.user!.rol,
        existingConsulta.doctorId,
        (existingConsulta as any).paciente?.nombre
      );
      await consultationAuditService.logStateTransition({
        consultaId: consulta.id,
        pacienteId: existingConsulta.pacienteId,
        previousState: existingConsulta.estado,
        newState: estado,
        changedBy: req.user?.id || 'unknown',
        changedByRole: req.user?.rol || 'UNKNOWN',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] as string,
        metadata: {
          teleconsulta: false
        }
      });
    } catch (auditError) {
      // Don't fail the request if audit logging fails, but log the error
      logger.error({ auditError, consultaId: consulta.id }, 'Failed to log state transition audit');
    }

    logger.info({
      consultaId: consulta.id,
      previousState: existingConsulta.estado,
      newState: estado,
      changedBy: req.user?.id
    }, 'Consulta estado changed');

    res.json({
      data: consulta,
      previousState: existingConsulta.estado,
      newState: consulta.estado
    });
  } catch (error) {
    logger.error({ error, id: req.params.id, body: req.body }, 'Error changing consulta estado');
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to change consulta estado'
    });
  }
});

/**
 * GET /api/consultas/:id/transiciones - Get possible state transitions
 *
 * Returns the possible next states for the current consulta state
 */
router.get('/:id/transiciones', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];

    const consulta = await prisma.consulta.findUnique({
      where: { id }
    });

    if (!consulta) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Consulta not found'
      });
    }

    // Verify patient access (RLS ownership check)
    if (req.user?.rol !== 'ADMIN') {
      const hasAccess = await canAccessPatient(req, consulta.pacienteId);
      if (!hasAccess) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You do not have access to this consulta'
        });
      }
    }

    const stateInfo = getStateInfo(consulta.estado);

    res.json({
      data: {
        consultaId: consulta.id,
        currentEstado: consulta.estado,
        nextEstados: stateInfo.nextStates,
        isTerminal: stateInfo.isTerminal,
        allEstados: Object.values(EstadoConsulta)
      }
    });
  } catch (error) {
    logger.error({ error, params: req.params }, 'Error fetching consulta transiciones');
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch consulta transiciones'
    });
  }
});

export default router;
