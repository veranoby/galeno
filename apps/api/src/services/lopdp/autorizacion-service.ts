import { PrismaClient, ConexionPaciente, TipoAcceso, EstadoConexion, Paciente, Cuenta, AuditAction, ResourceType } from '@prisma/client';
import { AuditService } from '../audit/audit.service.js';
import { NotificationService } from '../notifications/notification.service.js';

interface ConsentRequestInput {
  pacienteId: string;
  doctorId: string;
  tipoAcceso: TipoAcceso;
  permisos: any;
  userId: string;
}

interface ConsentResponseInput {
  conexionId: string;
  granted: boolean;
  userId: string;
}

interface GetConsentRequestsInput {
  pacienteId: string;
  userId: string;
}

interface GetAuthorizedDoctorsInput {
  pacienteId: string;
  userId: string;
}

class AuthorizationService {
  constructor(
    private prisma: PrismaClient, 
    private notificationService: NotificationService
  ) {}

  /**
   * Requests patient consent for doctor access to health data
   */
  async requestConsent(input: ConsentRequestInput): Promise<ConexionPaciente> {
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
      throw new Error('Doctor not found or invalid role');
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
          revocadaEn: null, 
          fechaAutorizacion: new Date()
        }
      });
    } else {
      // Create new connection request
      conexion = await this.prisma.conexionPaciente.create({
        data: {
          pacienteId: input.pacienteId, 
          doctorId: input.doctorId, 
          autorizadoPor: 'paciente',
          tipoAcceso: input.tipoAcceso, 
          permisos: input.permisos, 
          estado: EstadoConexion.activa
        }
      });
    }

    // Send push notification to patient
    await this.notificationService.sendConsentRequest(
      paciente.id, // Should probably be paciente account ID if it exists
      {
        title: 'Solicitud de acceso a tu historial médico', 
        body: `El Dr. ${doctor.nombre} ha solicitado acceso a tu historial médico`, 
        data: {
          type: 'consent_request', 
          conexionId: conexion.id, 
          doctorName: doctor.nombre, 
          doctorSpecialty: doctor.especialidad || 'General'
        }
      }
    );

    // Log the consent request
    await AuditService.logEvent(
      input.userId, 
      'DOCTOR',
      AuditAction.RESOURCE_ACCESS,
      ResourceType.PACIENTE,
      input.pacienteId,
      { 
        tipoAcceso: input.tipoAcceso,
        conexionId: conexion.id
      }
    );

    return conexion;
  }

  /**
   * Handles patient response to consent request
   */
  async respondToConsent(input: ConsentResponseInput): Promise<ConexionPaciente> {
    const conexion = await this.prisma.conexionPaciente.findUnique({
      where: { id: input.conexionId }, 
      include: { paciente: true,  doctor: true }
    });

    if (!conexion) {
      throw new Error('Connection request not found');
    }

    // Only the patient can respond to consent requests
    if (conexion.paciente.cuentaId !== input.userId) {
      throw new Error('Unauthorized: Only patient can respond to consent requests');
    }

    let updatedConexion: ConexionPaciente;

    if (input.granted) {
      // Update connection to reflect patient consent
      updatedConexion = await this.prisma.conexionPaciente.update({
        where: { id: input.conexionId }, 
        data: {
          estado: EstadoConexion.activa, 
          autorizadoPor: 'paciente',
          fechaAutorizacion: new Date()
        }
      });

      // Notify doctor that access was granted
      await this.notificationService.sendConsentResponse(
        conexion.doctorId, 
        {
          title: 'Acceso concedido a tu historial médico', 
          body: `El paciente ha concedido acceso a su historial médico`, 
          data: {
            type: 'consent_granted', 
            conexionId: input.conexionId, 
            pacienteId: conexion.pacienteId
          }
        }
      );
    } else {
      // Deny access
      updatedConexion = await this.prisma.conexionPaciente.update({
        where: { id: input.conexionId }, 
        data: {
          estado: EstadoConexion.revocada, 
          revocadaEn: new Date()
        }
      });

      // Notify doctor that access was denied
      await this.notificationService.sendConsentResponse(
        conexion.doctorId, 
        {
          title: 'Acceso denegado a historial médico', 
          body: `El paciente ha denegado el acceso a su historial médico`, 
          data: {
            type: 'consent_denied', 
            conexionId: input.conexionId, 
            pacienteId: conexion.pacienteId
          }
        }
      );
    }

    // Log the consent response
    await AuditService.logEvent(
      input.userId, 
      'PACIENTE',
      AuditAction.RESOURCE_ACCESS,
      ResourceType.PACIENTE,
      conexion.pacienteId,
      { granted: input.granted, conexionId: input.conexionId }
    );

    return updatedConexion;
  }

  /**
   * Gets pending consent requests for a patient
   */
  async getConsentRequests(input: GetConsentRequestsInput): Promise<ConexionPaciente[]> {
    const paciente = await this.prisma.paciente.findUnique({
      where: { id: input.pacienteId }
    });

    if (!paciente) {
      throw new Error('Patient not found');
    }

    if (paciente.cuentaId !== input.userId) {
      throw new Error('Unauthorized');
    }

    return await this.prisma.conexionPaciente.findMany({
      where: {
        pacienteId: input.pacienteId, 
        estado: EstadoConexion.activa
      }, 
      include: {
        doctor: {
          select: {
            nombre: true, 
            especialidad: true
          }
        }
      }
    });
  }

  /**
   * Gets doctors authorized to access patient's health data
   */
  async getAuthorizedDoctors(input: GetAuthorizedDoctorsInput): Promise<any[]> {
    const paciente = await this.prisma.paciente.findUnique({
      where: { id: input.pacienteId }
    });

    if (!paciente) {
      throw new Error('Patient not found');
    }

    if (paciente.cuentaId !== input.userId) {
      throw new Error('Unauthorized');
    }

    return await this.prisma.conexionPaciente.findMany({
      where: {
        pacienteId: input.pacienteId, 
        estado: EstadoConexion.activa
      }, 
      include: {
        doctor: {
          select: {
            id: true, 
            nombre: true, 
            especialidad: true, 
            email: true
          }
        }
      }
    });
  }

  /**
   * Revokes consent for a doctor to access patient data
   */
  async revokeConsent(conexionId: string,  userId: string): Promise<ConexionPaciente> {
    const conexion = await this.prisma.conexionPaciente.findUnique({
      where: { id: conexionId }, 
      include: { paciente: true }
    });

    if (!conexion) {
      throw new Error('Connection not found');
    }

    if (conexion.paciente.cuentaId !== userId) {
      throw new Error('Unauthorized');
    }

    const updatedConexion = await this.prisma.conexionPaciente.update({
      where: { id: conexionId }, 
      data: {
        estado: EstadoConexion.revocada, 
        revocadaEn: new Date()
      }
    });

    // Notify doctor
    await this.notificationService.sendConsentResponse(
      conexion.doctorId, 
      {
        title: 'Acceso revocado a historial médico', 
        body: `El paciente ha revocado tu acceso a su historial médico`, 
        data: {
          type: 'access_revoked', 
          conexionId: conexionId, 
          pacienteId: conexion.pacienteId
        }
      }
    );

    // Log the consent revocation
    await AuditService.logEvent(
      userId, 
      'PACIENTE',
      AuditAction.RESOURCE_ACCESS,
      ResourceType.PACIENTE,
      conexion.pacienteId,
      { action: 'REVOKE_CONSENT', conexionId }
    );

    return updatedConexion;
  }
}

export default AuthorizationService;
