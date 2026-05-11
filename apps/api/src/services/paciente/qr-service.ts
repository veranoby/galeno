import QRCode from 'qrcode';
import crypto from 'crypto';
import { PrismaClient, HealthWallet, Paciente } from '@prisma/client';
import AuditService from '../audit/audit.service.js';

interface GenerateQRInput {
  pacienteId: string;
}

interface ValidateQRInput {
  qrData: string;
  userId?: string; // Optional: for audit logging
}

interface QRValidationResult {
  wallet: HealthWallet;
  paciente: Paciente;
  isValid: boolean;
  expiresAt: Date;
}

class QRService {
  private readonly QR_SECRET: string;

  constructor(private prisma: PrismaClient) {
    this.QR_SECRET = process.env.QR_SECRET || '';
    if (!this.QR_SECRET) {
      throw new Error('QR_SECRET environment variable is required for QR code generation. Please set QR_SECRET in your environment variables.');
    }
  }

  /**
   * Generates a QR code for health wallet access
   */
  async generateWalletQR(input: GenerateQRInput): Promise<string> {
    const wallet = await this.prisma.healthWallet.findUnique({
      where: { pacienteId: input.pacienteId }
    });

    if (!wallet || !wallet.activo) {
      throw new Error('Wallet not found or inactive');
    }

    // Generate QR with wallet ID + signature + expiration
    const timestamp = Date.now();
    const expirationTime = timestamp + (24 * 60 * 60 * 1000); // 24 hours
    const signature = crypto
      .createHmac('sha256', this.QR_SECRET)
      .update(`${wallet.walletId}:${timestamp}:${expirationTime}`)
      .digest('hex');

    const qrData = JSON.stringify({
      walletId: wallet.walletId, 
      timestamp, 
      expirationTime, 
      signature, 
      version: wallet.version
    });

    return QRCode.toDataURL(qrData);
  }

  /**
   * Validates a health wallet QR code
   */
  async validateWalletQR(input: ValidateQRInput): Promise<QRValidationResult> {
    try {
      const data = JSON.parse(input.qrData);

      // Verify signature
      const expectedSignature = crypto
        .createHmac('sha256', this.QR_SECRET)
        .update(`${data.walletId}:${data.timestamp}:${data.expirationTime}`)
        .digest('hex');

      if (data.signature !== expectedSignature) {
        throw new Error('Invalid QR: signature mismatch');
      }

      // Verify expiration
      const now = Date.now();
      if (now > data.expirationTime) {
        throw new Error('QR expired');
      }

      const wallet = await this.prisma.healthWallet.findUnique({
        where: { walletId: data.walletId }, 
        include: { paciente: true }
      });

      if (!wallet || !wallet.activo) {
        throw new Error('Wallet not found or inactive');
      }

      // Log the QR validation attempt
      if (input.userId) {
        await AuditService.log({
          userId: input.userId,
          action: 'RESOURCE_ACCESS',
          resourceType: 'PACIENTE',
          resourceId: wallet.id,
          rolUsuario: 'DOCTOR',
          metadata: { action: 'QR_VALIDATED', pacienteId: wallet.pacienteId, walletId: wallet.walletId }
        });
      }

      return {
        wallet,
        paciente: wallet.paciente,
        isValid: true,
        expiresAt: new Date(data.expirationTime)
      };
    } catch (error) {
      console.error('Error validating wallet QR:', error);
      
      // Log the failed validation attempt
      if (input.userId) {
        await AuditService.log({
          userId: input.userId,
          action: 'RESOURCE_ACCESS',
          resourceType: 'PACIENTE',
          resourceId: null,
          rolUsuario: 'DOCTOR',
          metadata: { action: 'QR_VALIDATION_FAILED', error: (error as Error).message }
        });
      }
      
      throw new Error(`QR validation failed: ${(error as Error).message}`);
    }
  }

  /**
   * Generates a temporary access QR for pharmacy validation
   */
  async generatePharmacyQR(pacienteId: string,  durationHours: number = 1): Promise<string> {
    const wallet = await this.prisma.healthWallet.findUnique({
      where: { pacienteId }
    });

    if (!wallet || !wallet.activo) {
      throw new Error('Wallet not found or inactive');
    }

    // Generate temporary access token
    const tempToken = crypto.randomBytes(32).toString('hex');
    const timestamp = Date.now();
    const expirationTime = timestamp + (durationHours * 60 * 60 * 1000);

    const signature = crypto
      .createHmac('sha256', this.QR_SECRET)
      .update(`${wallet.walletId}:${tempToken}:${timestamp}:${expirationTime}`)
      .digest('hex');

    const qrData = JSON.stringify({
      walletId: wallet.walletId, 
      tempToken, 
      timestamp, 
      expirationTime, 
      signature, 
      purpose: 'pharmacy_validation'
    });

    return QRCode.toDataURL(qrData);
  }

  /**
   * Validates a temporary access QR (for pharmacies,  etc.)
   */
  async validatePharmacyQR(qrData: string,  userId?: string): Promise<QRValidationResult> {
    try {
      const data = JSON.parse(qrData);

      if (data.purpose !== 'pharmacy_validation') {
        throw new Error('Invalid QR purpose');
      }

      // Verify signature
      const expectedSignature = crypto
        .createHmac('sha256', this.QR_SECRET)
        .update(`${data.walletId}:${data.tempToken}:${data.timestamp}:${data.expirationTime}`)
        .digest('hex');

      if (data.signature !== expectedSignature) {
        throw new Error('Invalid QR: signature mismatch');
      }

      // Verify expiration
      const now = Date.now();
      if (now > data.expirationTime) {
        throw new Error('QR expired');
      }

      const wallet = await this.prisma.healthWallet.findUnique({
        where: { walletId: data.walletId }, 
        include: { paciente: true }
      });

      if (!wallet || !wallet.activo) {
        throw new Error('Wallet not found or inactive');
      }

      // Log the QR validation attempt
      if (userId) {
        await AuditService.log({
          userId,
          action: 'RESOURCE_ACCESS',
          resourceType: 'PACIENTE',
          resourceId: wallet.id,
          rolUsuario: 'DOCTOR',
          metadata: { action: 'PHARMACY_QR_VALIDATED', pacienteId: wallet.pacienteId, walletId: wallet.walletId }
        });
      }

      return {
        wallet,
        paciente: wallet.paciente,
        isValid: true,
        expiresAt: new Date(data.expirationTime)
      };
    } catch (error) {
      console.error('Error validating pharmacy QR:', error);
      
      if (userId) {
        await AuditService.log({
          userId,
          action: 'RESOURCE_ACCESS',
          resourceType: 'PACIENTE',
          resourceId: null,
          rolUsuario: 'DOCTOR',
          metadata: { action: 'PHARMACY_QR_VALIDATION_FAILED', error: (error as Error).message }
        });
      }
      
      throw new Error(`Pharmacy QR validation failed: ${(error as Error).message}`);
    }
  }
}

export default QRService;