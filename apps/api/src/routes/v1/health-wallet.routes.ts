import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../../middleware/auth.js';
import { AuditService } from '../../services/audit/audit.service.js';
import { getNotificationService } from '../../services/notifications/notification.service.js';
import HealthWalletService from '../../services/paciente/health-wallet-service.js';
import QRService from '../../services/paciente/qr-service.js';
import AuthorizationService from '../../services/lopdp/autorizacion-service.js';
import prisma from '../../config/database.js';

const router: Router = Router();

// Initialize services
const healthWalletService = new HealthWalletService(prisma);
const qrService = new QRService(prisma);
const notificationService = getNotificationService(prisma);
const authorizationService = new AuthorizationService(prisma,  notificationService);

/**
 * POST /health-wallet
 * Create a new health wallet for a patient
 */
router.post('/',  authMiddleware,  async (req: AuthRequest,  res: Response) => {
  try {
    const { pacienteId } = req.body;
    const userId = req.user!.id;

    const wallet = await healthWalletService.createHealthWallet({
      pacienteId, 
      userId
    });

    res.status(201).json({
      success: true, 
      data: wallet
    });
  } catch (error) {
    console.error('[HealthWallet] Error creating wallet:', error);
    res.status(400).json({
      success: false, 
      error: (error as Error).message
    });
  }
});

/**
 * GET /health-wallet/:pacienteId
 * Get health wallet details for a patient
 */
router.get('/:pacienteId',  authMiddleware,  async (req: AuthRequest,  res: Response) => {
  try {
    const { pacienteId } = req.params as { pacienteId: string };
    const userId = req.user!.id;

    const details = await healthWalletService.getWalletDetails({
      pacienteId, 
      userId
    });

    res.json({
      success: true, 
      data: details
    });
  } catch (error) {
    console.error('[HealthWallet] Error getting wallet details:', error);
    res.status(403).json({
      success: false, 
      error: (error as Error).message
    });
  }
});

/**
 * POST /health-wallet/qr
 * Generate a QR code for health wallet access
 */
router.post('/qr',  authMiddleware,  async (req: AuthRequest,  res: Response) => {
  try {
    const { pacienteId } = req.body;

    const qrData = await qrService.generateWalletQR({ pacienteId });

    res.json({
      success: true, 
      data: { qr: qrData }
    });
  } catch (error) {
    console.error('[HealthWallet] Error generating QR:', error);
    res.status(400).json({
      success: false, 
      error: (error as Error).message
    });
  }
});

/**
 * POST /health-wallet/validate-qr
 * Validate a health wallet QR code
 */
router.post('/validate-qr',  authMiddleware,  async (req: AuthRequest,  res: Response) => {
  try {
    const { qrData } = req.body;
    const userId = req.user!.id;

    const result = await qrService.validateWalletQR({ qrData,  userId });

    res.json({
      success: true, 
      data: result
    });
  } catch (error) {
    console.error('[HealthWallet] Error validating QR:', error);
    res.status(400).json({
      success: false, 
      error: (error as Error).message
    });
  }
});

/**
 * POST /health-wallet/request-access
 * Request access to a patient's health wallet (doctor initiates)
 */
router.post('/request-access',  authMiddleware,  async (req: AuthRequest,  res: Response) => {
  try {
    const { pacienteId, doctorId, tipoAcceso, permisos } = req.body;
    const userId = req.user!.id;

    // Verify the authenticated user is the doctor making the request
    if (userId !== doctorId) {
      return res.status(403).json({
        success: false, 
        error: 'Unauthorized: Cannot request access on behalf of another doctor'
      });
    }

    const conexion = await authorizationService.requestConsent({
      pacienteId, 
      doctorId, 
      tipoAcceso, 
      permisos, 
      userId
    });

    res.json({
      success: true, 
      data: conexion
    });
  } catch (error) {
    console.error('[HealthWallet] Error requesting access:', error);
    res.status(400).json({
      success: false, 
      error: (error as Error).message
    });
  }
});

/**
 * POST /health-wallet/grant-access
 * Grant access to a doctor (patient responds)
 */
router.post('/grant-access',  authMiddleware,  async (req: AuthRequest,  res: Response) => {
  try {
    const { conexionId, granted } = req.body;
    const userId = req.user!.id;

    const conexion = await authorizationService.respondToConsent({
      conexionId, 
      granted, 
      userId
    });

    res.json({
      success: true, 
      data: conexion
    });
  } catch (error) {
    console.error('[HealthWallet] Error granting access:', error);
    res.status(403).json({
      success: false, 
      error: (error as Error).message
    });
  }
});

/**
 * POST /health-wallet/revoke-access
 * Revoke access from a doctor
 */
router.post('/revoke-access',  authMiddleware,  async (req: AuthRequest,  res: Response) => {
  try {
    const { conexionId } = req.body;
    const userId = req.user!.id;

    const conexion = await authorizationService.revokeConsent(conexionId,  userId);

    res.json({
      success: true, 
      data: conexion
    });
  } catch (error) {
    console.error('[HealthWallet] Error revoking access:', error);
    res.status(403).json({
      success: false, 
      error: (error as Error).message
    });
  }
});

/**
 * GET /health-wallet/:pacienteId/connections
 * Get all connections for a patient's health wallet
 */
router.get('/:pacienteId/connections',  authMiddleware,  async (req: AuthRequest,  res: Response) => {
  try {
    const { pacienteId } = req.params as { pacienteId: string };
    const userId = req.user!.id;

    const connections = await authorizationService.getAuthorizedDoctors({
      pacienteId, 
      userId
    });

    res.json({
      success: true, 
      data: connections
    });
  } catch (error) {
    console.error('[HealthWallet] Error getting connections:', error);
    res.status(403).json({
      success: false, 
      error: (error as Error).message
    });
  }
});

/**
 * GET /health-wallet/:pacienteId/consent-requests
 * Get pending consent requests for a patient
 */
router.get('/:pacienteId/consent-requests',  authMiddleware,  async (req: AuthRequest,  res: Response) => {
  try {
    const { pacienteId } = req.params as { pacienteId: string };
    const userId = req.user!.id;

    const requests = await authorizationService.getConsentRequests({
      pacienteId, 
      userId
    });

    res.json({
      success: true, 
      data: requests
    });
  } catch (error) {
    console.error('[HealthWallet] Error getting consent requests:', error);
    res.status(403).json({
      success: false, 
      error: (error as Error).message
    });
  }
});

export default router;
