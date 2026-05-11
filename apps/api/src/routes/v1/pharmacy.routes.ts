import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../../middleware/auth.js';
import { pharmacyRoleGuard, PharmacyAuthRequest } from '../../middleware/pharmacy-role-guard.js';
import PharmacyQRValidationService from '../../services/pharmacy/qr-validation.service.js';
import QRService from '../../services/paciente/qr-service.js';
import prisma from '../../config/database.js';
import { logger } from '../../utils/logger.js';

const router: Router = Router();

// Initialize services
const pharmacyQRService = new PharmacyQRValidationService(prisma);
const qrService = new QRService(prisma);

/**
 * POST /pharmacy/generate-qr
 *
 * Generates a temporary access QR for pharmacy validation
 *
 * Security:
 * - Requires FARMACIA role
 * - Limited duration (default 1 hour)
 * - Purpose-specific QR (pharmacy_validation only)
 * - Audit logging
 *
 * @body {string} pacienteId - Patient ID
 * @body {number} durationHours - QR validity duration (default: 1)
 * @returns {object} Generated QR code
 */
router.post('/generate-qr', authMiddleware, pharmacyRoleGuard, async (req: PharmacyAuthRequest, res: Response) => {
  try {
    const { pacienteId, durationHours = 1 } = req.body;

    // Validate input
    if (!pacienteId || typeof pacienteId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'pacienteId is required and must be a string'
      });
    }

    if (typeof durationHours !== 'number' || durationHours <= 0 || durationHours > 24) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'durationHours must be between 1 and 24'
      });
    }

    // Generate pharmacy QR using existing QR service
    const qrData = await qrService.generatePharmacyQR(pacienteId, durationHours);

    logger.info({
      pharmacyId: req.pharmacyContext?.pharmacyId,
      pacienteId,
      durationHours
    }, 'Pharmacy QR generated');

    res.json({
      success: true,
      data: { qr: qrData }
    });
  } catch (error) {
    logger.error({ error, pharmacyId: req.pharmacyContext?.pharmacyId }, 'Pharmacy QR generation error');

    const errorMessage = (error as Error).message;

    res.status(400).json({
      success: false,
      error: 'Generation Error',
      message: errorMessage
    });
  }
});

/**
 * POST /pharmacy/validate-qr
 *
 * Validates a pharmacy QR code and returns limited patient information
 *
 * Security:
 * - Requires FARMACIA role
 * - Cryptographic signature verification
 * - Expiration time validation
 * - Audit logging
 * - Limited data access (no full medical history)
 *
 * @body {string} qrData - Base64-encoded QR code data
 * @returns {object} Validation result with limited patient info
 */
router.post('/validate-qr', authMiddleware, pharmacyRoleGuard, async (req: PharmacyAuthRequest, res: Response) => {
  try {
    const { qrData } = req.body;

    // Validate input
    if (!qrData || typeof qrData !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'qrData is required and must be a string'
      });
    }

    // Validate QR code
    const validationResult = await pharmacyQRService.validatePharmacyQR(
      qrData,
      req.pharmacyContext?.pharmacyId
    );

    // Get limited patient information (no full medical history)
    const patientInfo = await pharmacyQRService.getLimitedPatientInfo(validationResult.paciente.id);

    if (!patientInfo) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }

    logger.info({
      pharmacyId: req.pharmacyContext?.pharmacyId,
      pacienteId: patientInfo.id,
      qrValidUntil: validationResult.expiresAt.toISOString()
    }, 'Pharmacy QR validation successful');

    res.json({
      success: true,
      data: {
        isValid: validationResult.isValid,
        expiresAt: validationResult.expiresAt,
        walletId: validationResult.wallet.walletId,
        patientInfo: {
          id: patientInfo.id,
          nombre: patientInfo.nombre,
          cedula: patientInfo.cedula,
          fechaNacimiento: patientInfo.fechaNacimiento,
          email: patientInfo.email,
          telefono: patientInfo.telefono
          // Intentionally NOT including: antecedentes, consultas, historial médico
        }
      }
    });
  } catch (error) {
    logger.error({ error, pharmacyId: req.pharmacyContext?.pharmacyId }, 'Pharmacy QR validation error');

    // Handle specific error types
    const errorMessage = (error as Error).message;
    
    if (errorMessage.includes('signature mismatch')) {
      return res.status(401).json({
        success: false,
        error: 'Invalid Signature',
        message: 'QR code signature verification failed'
      });
    }

    if (errorMessage.includes('expired')) {
      return res.status(400).json({
        success: false,
        error: 'QR Expired',
        message: 'The QR code has expired. Please generate a new one.'
      });
    }

    if (errorMessage.includes('Invalid QR purpose')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid QR Purpose',
        message: 'This QR code is not intended for pharmacy validation'
      });
    }

    // Generic error response
    res.status(400).json({
      success: false,
      error: 'Validation Error',
      message: errorMessage
    });
  }
});

/**
 * GET /pharmacy/patient/:id
 * 
 * Gets limited patient information for pharmacy access
 * Does NOT include full medical history
 * 
 * Security:
 * - Requires FARMACIA role
 * - Limited data access principle
 * - Audit logging
 * 
 * @param {string} id - Patient ID
 * @returns {object} Limited patient information
 */
router.get('/patient/:id', authMiddleware, pharmacyRoleGuard, async (req: PharmacyAuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const patientInfo = await pharmacyQRService.getLimitedPatientInfo(id);

    if (!patientInfo) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }

    logger.info({
      pharmacyId: req.pharmacyContext?.pharmacyId,
      pacienteId: patientInfo.id
    }, 'Pharmacy accessed limited patient info');

    res.json({
      success: true,
      data: {
        id: patientInfo.id,
        nombre: patientInfo.nombre,
        cedula: patientInfo.cedula,
        fechaNacimiento: patientInfo.fechaNacimiento,
        email: patientInfo.email,
        telefono: patientInfo.telefono
        // Intentionally NOT including: antecedentes, consultas, historial médico
      }
    });
  } catch (error) {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    logger.error({ error, pharmacyId: req.pharmacyContext?.pharmacyId, pacienteId: id }, 'Error fetching patient info');

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to fetch patient information'
    });
  }
});

/**
 * GET /pharmacy/keys
 * 
 * Retorna llaves públicas o configuraciones para validación offline
 * Solo accesible para usuarios con rol FARMACIA
 */
router.get('/keys', authMiddleware, pharmacyRoleGuard, async (req: PharmacyAuthRequest, res: Response) => {
  try {
    // En una implementación real, esto retornaría llaves públicas.
    // Para el MVP con HMAC, retornamos el secret configurado para validación local.
    const validationConfig = {
      algorithm: 'HS256',
      issuer: 'galeno-api',
      publicKey: process.env.QR_SECRET || 'fallback-secret-for-dev',
      expiresIn: '24h'
    };

    res.json({
      success: true,
      data: validationConfig
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch validation keys' });
  }
});

export default router;
