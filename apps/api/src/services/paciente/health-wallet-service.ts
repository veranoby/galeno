import { PrismaClient, HealthWallet, Paciente, ConexionPaciente, TipoAcceso, EstadoConexion, AuditAction, ResourceType } from '@prisma/client';
import crypto from 'crypto';
import QRCode from 'qrcode';
import { AuditService } from '../audit/audit.service';

interface CreateHealthWalletInput {
  pacienteId: string;
  userId: string;
}

interface GenerateQRInput {
  pacienteId: string;
}

interface ValidateQRInput {
  qrData: string;
}

interface RequestAccessInput {
  pacienteId: string;
  doctorId: string;
  tipoAcceso: TipoAcceso;
  permisos: any;
  userId: string;
}

interface GrantAccessInput {
  conexionId: string;
  userId: string;
}

interface RevokeAccessInput {
  conexionId: string;
  userId: string;
}

interface GetWalletDetailsInput {
  pacienteId: string;
  userId: string;
}

interface GetConnectionsInput {
  pacienteId: string;
  userId: string;
}

class HealthWalletService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Creates a new Health Wallet for a patient
   */
  async createHealthWallet(input: CreateHealthWalletInput): Promise<HealthWallet> {
    // Verify user has permission to create wallet for this patient
    const paciente = await this.prisma.paciente.findUnique({
      where: { id: input.pacienteId }
    });

    if (!paciente) {
      throw new Error('Patient not found');
    }

    // Check if user is the patient owner or authorized representative
    if (paciente.cuentaId !== input.userId) {
      throw new Error('Unauthorized: Only patient owner can create health wallet');
    }

    // Generate unique wallet ID
    const walletId = `HW-${crypto.randomBytes(16).toString('hex').toUpperCase()}`;

    const healthWallet = await this.prisma.healthWallet.create({
      data: {
        pacienteId: input.pacienteId, 
        walletId, 
        activo: true
      }
    });

    // Log the creation
    await AuditService.log({
      userId: input.userId,
      action: 'HEALTH_WALLET_CREATED' as AuditAction,
      resourceType: 'HEALTH_WALLET' as ResourceType,
      resourceId: healthWallet.id,
      rolUsuario: 'DOCTOR',
      metadata: { pacienteId: input.pacienteId }
    });

    return healthWallet;
  }

  /**
   * Generates a QR code for the patient's health wallet
   */
  async generateWalletQR(input: GenerateQRInput): Promise<string> {
    const wallet = await this.prisma.healthWallet.findUnique({
      where: { pacienteId: input.pacienteId }
    });

    if (!wallet || !wallet.activo) {
      throw new Error('Wallet not found or inactive');
    }

    // Generate QR with wallet ID + signature for security
    const timestamp = Date.now();
    const signature = crypto
      .createHmac('sha256',  process.env.QR_SECRET || 'fallback-secret-key')
      .update(`${wallet.walletId}:${timestamp}`)
      .digest('hex');

    const qrData = JSON.stringify({
      walletId: wallet.walletId, 
      timestamp, 
      signature, 
      version: wallet.version
    });

    return QRCode.toDataURL(qrData);
  }

  /**
   * Validates a health wallet QR code
   */
  async validateWalletQR(input: ValidateQRInput): Promise<{ wallet: HealthWallet; paciente: Paciente } | null> {
    try {
      const data = JSON.parse(input.qrData);

      // Verify signature
      const expectedSignature = crypto
        .createHmac('sha256',  process.env.QR_SECRET || 'fallback-secret-key')
        .update(`${data.walletId}:${data.timestamp}`)
        .digest('hex');

      if (data.signature !== expectedSignature) {
        throw new Error('Invalid QR: signature mismatch');
      }

      // Verify validity (24 hours)
      if (Date.now() - data.timestamp > 24 * 60 * 60 * 1000) {
        throw new Error('QR expired');
      }

      const wallet = await this.prisma.healthWallet.findUnique({
        where: { walletId: data.walletId }, 
        include: { paciente: true }
      });

      if (!wallet || !wallet.activo) {
        throw new Error('Wallet not found or inactive');
      }

      return { wallet, paciente: wallet.paciente };
    } catch (error) {
      console.error('Error validating wallet QR:', error);
      throw new Error(`QR validation failed: ${(error as Error).message}`);
    }
  }

  /**
   * Requests access to a patient's health wallet
   */
  async requestAccess(input: RequestAccessInput): Promise<ConexionPaciente> {
    // Verify patient exists
    const paciente = await this.prisma.paciente.findUnique({
      where: { id: input.pacienteId }
    });

    if (!paciente) {
      throw new Error('Patient not found');
    }

    // Verify doctor exists
    const doctor = await this.prisma.cuenta.findUnique({
      where: { id: input.doctorId }
    });

    if (!doctor || doctor.rol !== 'DOCTOR') {
      throw new Error('Doctor not found');
    }

    // Check if connection already exists
    let conexion = await this.prisma.conexionPaciente.findUnique({
      where: {
        pacienteId_doctorId: {
          pacienteId: input.pacienteId, 
          doctorId: input.doctorId
        }
      }
    });

    if (conexion) {
      // Update existing connection
      conexion = await this.prisma.conexionPaciente.update({
        where: { id: conexion.id }, 
        data: {
          tipoAcceso: input.tipoAcceso, 
          permisos: input.permisos, 
          estado: EstadoConexion.activa, 
          revocadaEn: null
        }
      });
    } else {
      // Create new connection request
      conexion = await this.prisma.conexionPaciente.create({
        data: {
          pacienteId: input.pacienteId, 
          doctorId: input.doctorId, 
          autorizadoPor: 'paciente',  // This would be determined by who initiated
          tipoAcceso: input.tipoAcceso, 
          permisos: input.permisos, 
          estado: EstadoConexion.activa
        }
      });
    }

    // Log the access request
    await AuditService.log({
      userId: input.userId,
      action: 'ACCESS_REQUESTED' as AuditAction,
      resourceType: 'CONEXION_PACIENTE' as ResourceType,
      resourceId: conexion.id,
      rolUsuario: 'DOCTOR',
      metadata: { pacienteId: input.pacienteId, doctorId: input.doctorId }
    });

    return conexion;
  }

  /**
   * Grants access to a doctor for a patient's health wallet
   */
  async grantAccess(input: GrantAccessInput): Promise<ConexionPaciente> {
    const conexion = await this.prisma.conexionPaciente.findUnique({
      where: { id: input.conexionId }, 
      include: { paciente: true }
    });

    if (!conexion) {
      throw new Error('Connection request not found');
    }

    // Only the patient can grant access
    if (conexion.paciente.cuentaId !== input.userId) {
      throw new Error('Unauthorized: Only patient can grant access');
    }

    const updatedConexion = await this.prisma.conexionPaciente.update({
      where: { id: input.conexionId }, 
      data: {
        estado: EstadoConexion.activa, 
        fechaAutorizacion: new Date()
      }
    });

    // Log the access grant
    await AuditService.log({
      userId: input.userId,
      action: 'ACCESS_GRANTED' as AuditAction,
      resourceType: 'CONEXION_PACIENTE' as ResourceType,
      resourceId: updatedConexion.id,
      rolUsuario: 'DOCTOR',
      metadata: { pacienteId: conexion.pacienteId, doctorId: conexion.doctorId }
    });

    return updatedConexion;
  }

  /**
   * Revokes access to a doctor for a patient's health wallet
   */
  async revokeAccess(input: RevokeAccessInput): Promise<ConexionPaciente> {
    const conexion = await this.prisma.conexionPaciente.findUnique({
      where: { id: input.conexionId }, 
      include: { paciente: true }
    });

    if (!conexion) {
      throw new Error('Connection not found');
    }

    // Only the patient can revoke access
    if (conexion.paciente.cuentaId !== input.userId) {
      throw new Error('Unauthorized: Only patient can revoke access');
    }

    const updatedConexion = await this.prisma.conexionPaciente.update({
      where: { id: input.conexionId }, 
      data: {
        estado: EstadoConexion.revocada, 
        revocadaEn: new Date()
      }
    });

    // Log the access revocation
    await AuditService.log({
      userId: input.userId,
      action: 'ACCESS_REVOKED' as AuditAction,
      resourceType: 'CONEXION_PACIENTE' as ResourceType,
      resourceId: updatedConexion.id,
      rolUsuario: 'DOCTOR',
      metadata: { pacienteId: conexion.pacienteId, doctorId: conexion.doctorId }
    });

    return updatedConexion;
  }

  /**
   * Gets health wallet details for a patient
   */
  async getWalletDetails(input: GetWalletDetailsInput): Promise<{
    wallet: HealthWallet;
    paciente: Paciente;
    connections: (ConexionPaciente & { doctor: { nombre: string; especialidad: string | null } })[];
  }> {
    const paciente = await this.prisma.paciente.findUnique({
      where: { id: input.pacienteId }
    });

    if (!paciente) {
      throw new Error('Patient not found');
    }

    // Only the patient owner can view wallet details
    if (paciente.cuentaId !== input.userId) {
      throw new Error('Unauthorized: Only patient owner can view wallet details');
    }

    const wallet = await this.prisma.healthWallet.findUnique({
      where: { pacienteId: input.pacienteId }
    });

    if (!wallet) {
      throw new Error('Health wallet not found');
    }

    const connections = await this.prisma.conexionPaciente.findMany({
      where: { pacienteId: input.pacienteId }, 
      include: {
        doctor: {
          select: {
            nombre: true, 
            especialidad: true
          }
        }
      }
    });

    // Log the access
    await AuditService.log({
      userId: input.userId,
      action: 'HEALTH_WALLET_ACCESSED' as AuditAction,
      resourceType: 'HEALTH_WALLET' as ResourceType,
      resourceId: wallet.id,
      rolUsuario: 'DOCTOR',
      metadata: { pacienteId: input.pacienteId }
    });

    return {
      wallet,
      paciente,
      connections
    };
  }

  /**
   * Gets active connections for a patient's health wallet
   */
  async getConnections(input: GetConnectionsInput): Promise<ConexionPaciente[]> {
    const paciente = await this.prisma.paciente.findUnique({
      where: { id: input.pacienteId }
    });

    if (!paciente) {
      throw new Error('Patient not found');
    }

    // Only the patient owner can view connections
    if (paciente.cuentaId !== input.userId) {
      throw new Error('Unauthorized: Only patient owner can view connections');
    }

    const connections = await this.prisma.conexionPaciente.findMany({
      where: {
        pacienteId: input.pacienteId, 
        estado: EstadoConexion.activa
      }
    });

    return connections;
  }

  /**
   * Checks if a doctor has access to a patient's health wallet
   */
  async hasAccess(pacienteId: string,  doctorId: string): Promise<boolean> {
    const conexion = await this.prisma.conexionPaciente.findFirst({
      where: {
        pacienteId, 
        doctorId, 
        estado: EstadoConexion.activa
      }
    });

    return !!conexion;
  }
}

export default HealthWalletService;