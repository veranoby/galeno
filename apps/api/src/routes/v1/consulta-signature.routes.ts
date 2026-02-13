import { Router, Response } from 'express';
import { AuthRequest, authMiddleware, requireMedical } from '../../middleware/auth.js';
import { logger } from '../../utils/logger.js';
import {
  consultaSignatureService,
  CertificadoFirma,
  FirmaConsultaError
} from '../../services/consultation/signature.js';
import prisma from '../../config/database.js';

const router: Router = Router();

/**
 * POST /api/consultas/:id/firmar
 *
 * Firma una consulta médica con certificado XAdES-BES
 *
 * Request body:
 * {
 *   "xmlFirma": "<signed_xml>",
 *   "certificado": {
 *     "subject": "...",
 *     "cn": "...",
 *     "cedula": "...",
 *     "email": "...",
 *     "issuer": "...",
 *     "serialNumber": "...",
 *     "validFrom": "2024-01-01T00:00:00.000Z",
 *     "validTo": "2025-01-01T00:00:00.000Z"
 *   }
 * }
 */
router.post('/:id/firmar', authMiddleware, requireMedical, async (req: AuthRequest, res: Response) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
    const { xmlFirma, certificado } = req.body;

    // Validar request
    if (!xmlFirma || typeof xmlFirma !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'xmlFirma es requerido y debe ser un string'
      });
    }

    if (!certificado || typeof certificado !== 'object') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'certificado es requerido y debe ser un objeto'
      });
    }

    // Validar campos del certificado
    const camposRequeridos = ['subject', 'cn', 'cedula', 'issuer', 'serialNumber', 'validFrom', 'validTo'];
    for (const campo of camposRequeridos) {
      if (!certificado[campo]) {
        return res.status(400).json({
          error: 'Bad Request',
          message: `certificado.${campo} es requerido`
        });
      }
    }

    // Convertir fechas
    const certificadoParsed: CertificadoFirma = {
      ...certificado,
      validFrom: new Date(certificado.validFrom),
      validTo: new Date(certificado.validTo)
    };

    // Verificar acceso a la consulta
    const consulta = await prisma.consulta.findUnique({
      where: { id },
      select: { pacienteId: true }
    });

    if (!consulta) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Consulta no encontrada'
      });
    }

    // Verificar que el doctor tenga acceso al paciente
    if (req.user?.rol !== 'ADMIN') {
      // Verificar RLS
      const paciente = await prisma.paciente.findUnique({
        where: { id: consulta.pacienteId },
        select: { cuentaId: true }
      });

      if (!paciente) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Paciente no encontrado'
        });
      }

      if (req.user?.rol === 'DOCTOR' && paciente.cuentaId !== req.user.id) {
        // Verificar si es un usuario vinculado
        const usuarioVinculado = await prisma.usuarioVinculado.findUnique({
          where: { id: req.user.id },
          select: { cuentaId: true }
        });

        if (!usuarioVinculado || usuarioVinculado.cuentaId !== paciente.cuentaId) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'No tienes acceso a esta consulta'
          });
        }
      }
    }

    // Firmar consulta
    const resultado = await consultaSignatureService.firmarConsulta(
      id,
      req.user!.id,
      xmlFirma,
      certificadoParsed
    );

    logger.info({
      consultaId: id,
      doctorId: req.user?.id,
      certificadoCn: certificadoParsed.cn
    }, 'Consulta firmada');

    res.json(resultado);
  } catch (error) {
    if (error instanceof FirmaConsultaError) {
      const statusMap = {
        'SIN_PERMISO': 403,
        'YA_FIRMADA': 400,
        'ESTADO_INVALIDO': 400,
        'CERTIFICADO_INVALIDO': 400
      };

      return res.status(statusMap[error.code]).json({
        error: 'Bad Request',
        message: error.message,
        code: error.code
      });
    }

    logger.error({ error, id: req.params.id }, 'Error al firmar consulta');
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error al firmar la consulta'
    });
  }
});

/**
 * GET /api/consultas/:id/firma/historial
 *
 * Obtiene el historial de firma de una consulta
 */
router.get('/:id/firma/historial', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];

    // Verificar acceso
    const consulta = await prisma.consulta.findUnique({
      where: { id },
      select: { pacienteId: true }
    });

    if (!consulta) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Consulta no encontrada'
      });
    }

    // Verificar RLS
    if (req.user?.rol !== 'ADMIN') {
      const paciente = await prisma.paciente.findUnique({
        where: { id: consulta.pacienteId },
        select: { cuentaId: true }
      });

      if (!paciente) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Paciente no encontrado'
        });
      }

      if (req.user?.rol === 'DOCTOR' && paciente.cuentaId !== req.user.id) {
        const usuarioVinculado = await prisma.usuarioVinculado.findUnique({
          where: { id: req.user.id },
          select: { cuentaId: true }
        });

        if (!usuarioVinculado || usuarioVinculado.cuentaId !== paciente.cuentaId) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'No tienes acceso a esta consulta'
          });
        }
      }
    }

    const historial = await consultaSignatureService.obtenerHistorialFirma(id);

    res.json({ data: historial });
  } catch (error) {
    logger.error({ error, id: req.params.id }, 'Error al obtener historial de firma');
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error al obtener el historial de firma'
    });
  }
});

/**
 * GET /api/consultas/:id/firma/xml
 *
 * Descarga el XML de firma de una consulta
 */
router.get('/:id/firma/xml', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];

    const xml = await consultaSignatureService.obtenerXmlFirma(id, req.user!.id);

    if (!xml) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'XML de firma no encontrado o sin permisos'
      });
    }

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="consulta-${id}-firma.xml"`);
    res.send(xml);
  } catch (error) {
    logger.error({ error, id: req.params.id }, 'Error al descargar XML de firma');
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error al descargar el XML de firma'
    });
  }
});

/**
 * GET /api/consultas/:id/puede-firmar
 *
 * Verifica si una consulta puede ser firmada
 */
router.get('/:id/puede-firmar', authMiddleware, requireMedical, async (req: AuthRequest, res: Response) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];

    const puedeFirmar = await consultaSignatureService.puedeFirmar(id, req.user!.id);

    res.json({
      data: {
        consultaId: id,
        puedeFirmar
      }
    });
  } catch (error) {
    logger.error({ error, id: req.params.id }, 'Error al verificar si puede firmar');
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error al verificar si puede firmar'
    });
  }
});

export default router;
