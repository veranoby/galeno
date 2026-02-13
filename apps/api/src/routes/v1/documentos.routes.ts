import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../../middleware/auth.js';
import { logger } from '../../utils/logger.js';
import prisma from '../../config/database.js';

const router: Router = Router();

/**
 * GET /api/documentos - List documents for user
 */
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { tipo, firmado, page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (tipo && typeof tipo === 'string') {
      where.tipo = tipo;
    }

    if (firmado !== undefined) {
      where.firmado = firmado === 'true';
    }

    // Get user's consultas and their documents
    const consultas = await prisma.consulta.findMany({
      where: {
        OR: [
          { doctorId: req.user?.id },
          { asistenteId: req.user?.id }
        ]
      },
      select: { id: true }
    });

    const consultaIds = consultas.map(c => c.id);

    const total = await prisma.documento.count({
      where: {
        consultaId: { in: consultaIds },
        ...where
      }
    });

    const documentos = await prisma.documento.findMany({
      where: {
        consultaId: { in: consultaIds },
        ...where
      },
      include: {
        consulta: {
          select: {
            id: true,
            estado: true
          }
        }
      },
      orderBy: { fechaEmision: 'desc' as const },
      skip,
      take: limitNum
    });

    res.json({
      data: documentos,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasMore: skip + limitNum < total
      }
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching documentos');
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch documentos'
    });
  }
});

/**
 * GET /api/documentos/:id - Get documento detail
 */
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];

    const documento = await prisma.documento.findUnique({
      where: { id }
    });

    if (!documento) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Documento not found'
      });
    }

    // Verify access - user must be doctor or assistant of the consulta
    const consulta = await prisma.consulta.findFirst({
      where: {
        id: documento.consultaId,
        OR: [
          { doctorId: req.user?.id },
          { asistenteId: req.user?.id }
        ]
      }
    });

    if (!consulta && req.user?.rol !== 'ADMIN') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this documento'
      });
    }

    res.json({ data: documento });
  } catch (error) {
    logger.error({ error, id: req.params.id }, 'Error fetching documento');
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch documento'
    });
  }
});

/**
 * POST /api/documentos - Create new documento
 */
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { consultaId, tipo, contenido } = req.body;

    if (!consultaId || !tipo) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'consultaId and tipo are required'
      });
    }

    // Verify consulta exists and user has access
    const consulta = await prisma.consulta.findFirst({
      where: {
        id: consultaId,
        OR: [
          { doctorId: req.user?.id },
          { asistenteId: req.user?.id }
        ]
      }
    });

    if (!consulta && req.user?.rol !== 'ADMIN') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this consulta'
      });
    }

    if (!consulta) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Consulta not found'
      });
    }

    const documento = await prisma.documento.create({
      data: {
        consultaId,
        pacienteId: consulta.pacienteId,
        tipo,
        contenido: (contenido ? JSON.stringify(contenido) : '{}') as any,
        firmado: false,
        fechaEmision: new Date()
      }
    });

    logger.info({
      documentoId: documento.id,
      consultaId,
      createdBy: req.user?.id
    }, 'Documento creado');

    res.status(201).json({ data: documento });
  } catch (error) {
    logger.error({ error, body: req.body }, 'Error creating documento');
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create documento'
    });
  }
});

/**
 * PUT /api/documentos/:id - Update documento
 */
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
    const { nombre, tipo, contenido, firmado } = req.body;

    const existingDocumento = await prisma.documento.findUnique({
      where: { id }
    });

    if (!existingDocumento) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Documento not found'
      });
    }

    // Verify access
    const consulta = await prisma.consulta.findFirst({
      where: {
        id: existingDocumento.consultaId,
        OR: [
          { doctorId: req.user?.id },
          { asistenteId: req.user?.id }
        ]
      }
    });

    if (!consulta && req.user?.rol !== 'ADMIN') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this documento'
      });
    }

    const updateData: any = {};
    if (nombre !== undefined) updateData.nombre = nombre;
    if (tipo !== undefined) updateData.tipo = tipo;
    if (contenido !== undefined) updateData.contenido = contenido;
    if (firmado !== undefined) {
      if (firmado && existingDocumento.firmado) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Documento is already signed'
        });
      }
      updateData.firmado = firmado;
    }

    const documento = await prisma.documento.update({
      where: { id },
      data: updateData
    });

    logger.info({
      documentoId: documento.id,
      updatedBy: req.user?.id
    }, 'Documento actualizado');

    res.json({ data: documento });
  } catch (error) {
    logger.error({ error, id: req.params.id }, 'Error updating documento');
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update documento'
    });
  }
});

/**
 * DELETE /api/documentos/:id - Delete documento
 */
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];

    const existingDocumento = await prisma.documento.findUnique({
      where: { id }
    });

    if (!existingDocumento) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Documento not found'
      });
    }

    // Verify access
    const consulta = await prisma.consulta.findFirst({
      where: {
        id: existingDocumento.consultaId,
        OR: [
          { doctorId: req.user?.id },
          { asistenteId: req.user?.id }
        ]
      }
    });

    if (!consulta && req.user?.rol !== 'ADMIN') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this documento'
      });
    }

    await prisma.documento.delete({
      where: { id }
    });

    logger.info({
      documentoId: id,
      deletedBy: req.user?.id
    }, 'Documento eliminado');

    res.status(204).send();
  } catch (error) {
    logger.error({ error, id: req.params.id }, 'Error deleting documento');
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete documento'
    });
  }
});

export default router;
