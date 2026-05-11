import { PrismaClient, HealthWallet, Paciente } from '@prisma/client';
import crypto from 'crypto';
import AuditService from '../audit/audit.service.js';
import { logger } from '../../utils/logger.js';

/**
 * Input for QR validation
 */
interface ValidatePharmacyQRInput {
  qrData: string;
  pharmacyId?: string; // For audit logging
}

/**
 * Result of QR validation
 */
interface QRValidationResult {
  wallet: HealthWallet;
  paciente: Paciente;
  isValid: boolean;
  expiresAt: Date;
}

/**
 * Limited patient info for pharmacy access
 * Does NOT include full medical history
 */
interface LimitedPatientInfo {
  id: string;
  nombre: string;
  cedula: string;
  fechaNacimiento: Date;
  email: string | null;
  telefono: string | null;
}

/**
 * Pharmacy QR Validation Service
 * TASK-019: Validación QR Farmacias
 * 
 * Provides cryptographic validation of QR codes for pharmacy access
 * with limited patient information (no full medical history)
 * 
 * Security Features:
 * - HMAC-SHA256 signature verification
 * - Expiration time validation
 * - Purpose-specific QR codes (pharmacy_validation only)
 * - Audit logging for compliance
 * - Limited data access (principle of least privilege)
 */
class PharmacyQRValidationService {
  private readonly QR_SECRET: string;

  constructor(private prisma: PrismaClient) {
    this.QR_SECRET = process.env.QR_SECRET || '';
    
    if (!this.QR_SECRET) {
      throw new Error('QR_SECRET environment variable is required for pharmacy QR validation. Please set QR_SECRET in your environment variables.');
    }

    if (this.QR_SECRET.length < 32) {
      logger.warn('QR_SECRET may be too short. Recommended: 32+ characters for HMAC-SHA256');
    }
  }

  /**
   * Validates a pharmacy QR code with cryptographic verification
   * 
   * Validation Steps:
   * 1. Parse QR data
   * 2. Verify purpose is 'pharmacy_validation'
   * 3. Verify HMAC signature
   * 4. Check expiration time
   * 5. Verify wallet exists and is active
   * 6. Log audit trail
   * 
   * @param input - QR validation input
   * @returns Validation result with wallet and patient info
   * @throws Error if validation fails
   */
  async validatePharmacyQR(
    qrData: string,
    pharmacyId?: string
  ): Promise<QRValidationResult> {
    try {
      // Step 1: Parse QR data
      let data: any;
      try {
        data = JSON.parse(qrData);
      } catch (parseError) {
        logger.warn({ error: parseError }, 'Failed to parse QR data');
        throw new Error('Invalid QR format');
      }

      // Step 2: Verify required fields and purpose
      if (!data.walletId || !data.timestamp || !data.expirationTime || !data.signature) {
        throw new Error('Invalid QR: missing required fields');
      }

      if (data.purpose !== 'pharmacy_validation') {
        throw new Error('Invalid QR purpose');
      }

      // Step 3: Verify HMAC signature
      const expectedSignature = crypto
        .createHmac('sha256', this.QR_SECRET)
        .update(`${data.walletId}:${data.timestamp}:${data.expirationTime}`)
        .digest('hex');

      // Constant-time comparison to prevent timing attacks
      const signatureBuffer = Buffer.from(data.signature, 'hex');
      const expectedBuffer = Buffer.from(expectedSignature, 'hex');

      if (signatureBuffer.length !== expectedBuffer.length ||
          !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
        logger.warn({
          walletId: data.walletId,
          pharmacyId,
          reason: 'signature_mismatch'
        }, 'Pharmacy QR signature validation failed');
        
        throw new Error('Invalid QR: signature mismatch');
      }

      // Step 4: Verify expiration
      const now = Date.now();
      if (now > data.expirationTime) {
        logger.warn({
          walletId: data.walletId,
          pharmacyId,
          expirationTime: data.expirationTime,
          currentTime: now
        }, 'Pharmacy QR expired');
        
        throw new Error('QR expired');
      }

      // Step 5: Verify wallet exists and is active
      const wallet = await this.prisma.healthWallet.findUnique({
        where: { walletId: data.walletId },
        include: { paciente: true }
      });

      if (!wallet || !wallet.activo) {
        logger.warn({
          walletId: data.walletId,
          pharmacyId,
          reason: wallet ? 'inactive' : 'not_found'
        }, 'Pharmacy QR wallet validation failed');
        
        throw new Error('Wallet not found or inactive');
      }

      // Step 6: Log successful validation for audit
      if (pharmacyId) {
        await AuditService.log({
          userId: pharmacyId,
          action: 'RESOURCE_ACCESS',
          resourceType: 'PACIENTE',
          resourceId: wallet.id,
          rolUsuario: 'FARMACIA',
          metadata: {
            action: 'PHARMACY_QR_VALIDATED',
            pacienteId: wallet.pacienteId,
            walletId: wallet.walletId,
            expiresAt: new Date(data.expirationTime).toISOString(),
            validationTime: new Date().toISOString()
          }
        });
      }

      logger.info({
        walletId: data.walletId,
        pacienteId: wallet.pacienteId,
        pharmacyId,
        expiresAt: new Date(data.expirationTime).toISOString()
      }, 'Pharmacy QR validated successfully');

      return {
        wallet,
        paciente: wallet.paciente,
        isValid: true,
        expiresAt: new Date(data.expirationTime)
      };
    } catch (error) {
      logger.error({ error, pharmacyId }, 'Pharmacy QR validation error');

      // Log failed validation attempt for audit
      if (pharmacyId) {
        await AuditService.log({
          userId: pharmacyId,
          action: 'RESOURCE_ACCESS',
          resourceType: 'PACIENTE',
          resourceId: null,
          rolUsuario: 'FARMACIA',
          metadata: {
            action: 'PHARMACY_QR_VALIDATION_FAILED',
            error: (error as Error).message,
            validationTime: new Date().toISOString()
          }
        });
      }

      throw error;
    }
  }

  /**
   * Gets limited patient information for pharmacy access
   * 
   * IMPORTANT: This method intentionally returns LIMITED information
   * to comply with the principle of least privilege.
   * 
   * Does NOT include:
   * - Full medical history
   * - Consultations
   * - Antecedents
   * - Sensitive medical data
   * 
   * @param pacienteId - Patient ID
   * @returns Limited patient information or null if not found
   */
  async getLimitedPatientInfo(pacienteId: string): Promise<LimitedPatientInfo | null> {
    try {
      const paciente = await this.prisma.paciente.findUnique({
        where: { id: pacienteId },
        select: {
          id: true,
          nombre: true,
          cedula: true,
          fechaNacimiento: true,
          email: true,
          telefono: true
          // Intentionally NOT selecting: antecedentes, consultas, healthWallet, etc.
        }
      });

      if (!paciente) {
        return null;
      }

      return {
        id: paciente.id,
        nombre: paciente.nombre,
        cedula: paciente.cedula,
        fechaNacimiento: paciente.fechaNacimiento,
        email: paciente.email,
        telefono: paciente.telefono
      };
    } catch (error) {
      logger.error({ error, pacienteId }, 'Error fetching limited patient info');
      return null;
    }
  }

  /**
   * Generates a temporary access QR for pharmacy validation
   * 
   * @param pacienteId - Patient ID
   * @param durationHours - QR validity duration (default: 1 hour)
   * @returns Base64-encoded QR code image
   */
  async generatePharmacyQR(
    pacienteId: string,
    durationHours: number = 1
  ): Promise<string> {
    // This would typically import QRCode from 'qrcode'
    // For now, we'll focus on validation. Generation can be added if needed.
    throw new Error('QR generation not implemented in pharmacy validation service. Use paciente/qr-service.ts for generation.');
  }
}

export default PharmacyQRValidationService;
