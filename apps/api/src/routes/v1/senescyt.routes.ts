import { Router, Request, Response } from 'express';
import senescytService from '../../services/senescyt/validation.service.js';
import { authMiddleware, AuthRequest } from '../../middleware/auth.js';
import { logger } from '../../utils/logger.js';

const router: Router = Router();

/**
 * @openapi
 * /senescyt/validar:
 *   post:
 *     summary: Validate medical title with SENESCYT
 *     tags: [SENESCYT]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - cedula
 *               - numeroTitulo
 *               - codigoUniversidad
 *             properties:
 *               cedula:
 *                 type: string
 *                 description: Ecuadorian ID (10 digits)
 *               numeroTitulo:
 *                 type: string
 *                 description: Title number
 *               codigoUniversidad:
 *                 type: string
 *                 description: University code
 *     responses:
 *       200:
 *         description: Title validation result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 doctorId:
 *                   type: string
 *                 validado:
 *                   type: boolean
 *                 fechaValidacion:
 *                   type: string
 *                   format: date-time
 *                 respuesta:
 *                   type: object
 *                   properties:
 *                     valido:
 *                       type: boolean
 *                     nombreProfesional:
 *                       type: string
 *                     tituloProfesional:
 *                       type: string
 *                     universidad:
 *                       type: string
 *                     fechaRegistro:
 *                       type: string
 *                     fechaExpedicion:
 *                       type: string
 *                     estado:
 *                       type: string
 *                       enum: [ACTIVO, SUSPENDIDO, CANCELADO]
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Authentication error
 *       500:
 *         description: Server error
 */
router.post('/validar', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { cedula, numeroTitulo, codigoUniversidad } = req.body;

    // Validate required fields
    if (!cedula || !numeroTitulo || !codigoUniversidad) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'cedula, numeroTitulo, and codigoUniversidad are required'
      });
    }

    // Validate cedula format
    const cedulaRegex = /^\d{10}$/;
    if (!cedulaRegex.test(cedula)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid cédula format. Must be 10 digits'
      });
    }

    const doctorId = req.user?.id;
    if (!doctorId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated'
      });
    }

    const result = await senescytService.validarDoctor(
      doctorId,
      cedula,
      numeroTitulo,
      codigoUniversidad
    );

    res.status(200).json(result);
  } catch (error) {
    logger.error({ error, body: req.body }, 'Error validating title');

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Handle specific error types
    if (errorMessage.includes('no encontrado')) {
      return res.status(404).json({
        error: 'Not Found',
        message: errorMessage
      });
    }

    if (errorMessage.includes('autenticación')) {
      return res.status(401).json({
        error: 'Authentication Error',
        message: errorMessage
      });
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: errorMessage
    });
  }
});

/**
 * @openapi
 * /senescyt/status:
 *   get:
 *     summary: Get validation status
 *     tags: [SENESCYT]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Validation status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 doctorId:
 *                   type: string
 *                 validado:
 *                   type: boolean
 *                 fechaValidacion:
 *                   type: string
 *                   format: date-time
 *                 respuesta:
 *                   type: object
 *       404:
 *         description: Status not found
 */
router.get('/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const doctorId = req.user?.id;

    if (!doctorId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated'
      });
    }

    const status = await senescytService.getValidationStatus(doctorId);

    if (!status) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Validation status not found'
      });
    }

    res.status(200).json(status);
  } catch (error) {
    logger.error({ error }, 'Error getting validation status');
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get validation status'
    });
  }
});

export default router;
