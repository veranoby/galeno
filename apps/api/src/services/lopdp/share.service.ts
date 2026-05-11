// apps/api/src/services/lopdp/share.service.ts
import { PrismaClient, EstadoConexion, TipoAcceso, AuditAction, ResourceType } from '@prisma/client';
import { AuditService } from '../audit/audit.service.js';
import { NotificationService } from '../notifications/notification.service.js';
import { logger } from '../../utils/logger.js';

export interface ShareDocumentInput {
  documentoId: string;
  destinatarioId: string; // Doctor que recibirá el documento
  solicitanteId: string; // Usuario que solicita compartir
  motivoComparticion: string;
  temporal?: boolean;
  fechaExpiracion?: Date;
}

export interface ShareConsultaInput {
  consultaId: string;
  destinatarioId: string;
  solicitanteId: string;
  motivoComparticion: string;
  incluirDocumentos?: boolean;
  temporal?: boolean;
  fechaExpiracion?: Date;
}

export interface ShareResponse {
  success: boolean;
  message: string;
  shareId?: string;
  requiresConsent?: boolean;
}

/**
 * Servicio para compartir documentos y consultas entre profesionales de salud
 * con compliance LOPDP (consentimiento explícito del paciente)
 */
export class ShareService {
  constructor(
    private prisma: PrismaClient,
    private notificationService: NotificationService
  ) {}

  /**
   * Verifica si existe una conexión activa entre paciente y doctor
   */
  private async hasActiveConnection(pacienteId: string, doctorId: string): Promise<boolean> {
    const conexion = await this.prisma.conexionPaciente.findUnique({
      where: {
        pacienteId_doctorId: {
          pacienteId,
          doctorId
        }
      }
    });

    return conexion?.estado === EstadoConexion.activa;
  }

  /**
   * Obtiene el paciente propietario del documento
   */
  private async getDocumentOwner(documentoId: string): Promise<{ pacienteId: string; pacienteNombre: string } | null> {
    const documento = await this.prisma.documento.findUnique({
      where: { id: documentoId },
      include: {
        consulta: {
          include: {
            paciente: {
              include: {
                cuenta: {
                  select: { nombre: true }
                }
              }
            }
          }
        }
      }
    });

    if (!documento) {
      return null;
    }

    return {
      pacienteId: documento.consulta.pacienteId,
      pacienteNombre: documento.consulta.paciente.cuenta.nombre
    };
  }

  /**
   * Obtiene el paciente propietario de la consulta
   */
  private async getConsultaOwner(consultaId: string): Promise<{ pacienteId: string; pacienteNombre: string } | null> {
    const consulta = await this.prisma.consulta.findUnique({
      where: { id: consultaId },
      include: {
        paciente: {
          include: {
            cuenta: {
              select: { nombre: true }
            }
          }
        }
      }
    });

    if (!consulta) {
      return null;
    }

    return {
      pacienteId: consulta.pacienteId,
      pacienteNombre: consulta.paciente.cuenta.nombre
    };
  }

  /**
   * Obtiene información del doctor destinatario
   */
  private async getDoctorInfo(doctorId: string): Promise<{ nombre: string; especialidad?: string; email: string } | null> {
    const doctor = await this.prisma.cuenta.findUnique({
      where: { id: doctorId },
      select: {
        nombre: true,
        especialidad: true,
        email: true,
        rol: true
      }
    });

    if (!doctor || doctor.rol !== 'DOCTOR') {
      return null;
    }

    return doctor;
  }

  /**
   * Comparte un documento con otro doctor
   * Requiere consentimiento explícito del paciente (conexión activa)
   */
  async shareDocument(input: ShareDocumentInput): Promise<ShareResponse> {
    try {
      // 1. Obtener información del documento y paciente
      const owner = await this.getDocumentOwner(input.documentoId);
      if (!owner) {
        return {
          success: false,
          message: 'Documento no encontrado'
        };
      }

      // 2. Verificar que existe conexión activa con el destinatario
      const hasConnection = await this.hasActiveConnection(owner.pacienteId, input.destinatarioId);
      
      if (!hasConnection) {
        // No hay consentimiento - crear solicitud de conexión
        return {
          success: false,
          message: 'Se requiere consentimiento del paciente para compartir este documento',
          requiresConsent: true
        };
      }

      // 3. Crear registro de compartición (opcional, para auditoría)
      const shareRecord = await this.prisma.documentoCompartido.create({
        data: {
          documentoId: input.documentoId,
          destinatarioId: input.destinatarioId,
          solicitanteId: input.solicitanteId,
          motivoComparticion: input.motivoComparticion,
          temporal: input.temporal || false,
          fechaExpiracion: input.fechaExpiracion,
          fechaComparticion: new Date()
        }
      });

      // 4. Notificar al destinatario
      const doctorInfo = await this.getDoctorInfo(input.destinatarioId);
      if (doctorInfo) {
        await this.notificationService.sendNotification({
          userId: input.destinatarioId,
          notification: {
            title: 'Documento compartido',
            body: `Se ha compartido un documento del paciente ${owner.pacienteNombre}`,
            data: {
              type: 'DOCUMENTO_COMPARTIDO',
              documentoId: input.documentoId,
              shareId: shareRecord.id,
              pacienteNombre: owner.pacienteNombre,
              motivoComparticion: input.motivoComparticion
            }
          }
        });
      }

      // 5. Registrar auditoría LOPDP
      await AuditService.logEvent(
        input.solicitanteId,
        'DOCTOR',
        AuditAction.RESOURCE_ACCESS,
        ResourceType.DOCUMENTO,
        input.documentoId,
        {
          accion: 'COMPARTIR_DOCUMENTO',
          destinatarioId: input.destinatarioId,
          motivoComparticion: input.motivoComparticion,
          temporal: input.temporal,
          fechaExpiracion: input.fechaExpiracion
        }
      );

      logger.info(`Documento ${input.documentoId} compartido con doctor ${input.destinatarioId}`);

      return {
        success: true,
        message: 'Documento compartido exitosamente',
        shareId: shareRecord.id
      };
    } catch (error) {
      logger.error('Error al compartir documento:', error);
      return {
        success: false,
        message: 'Error al compartir documento'
      };
    }
  }

  /**
   * Comparte una consulta completa con otro doctor
   * Requiere consentimiento explícito del paciente (conexión activa)
   */
  async shareConsulta(input: ShareConsultaInput): Promise<ShareResponse> {
    try {
      // 1. Obtener información de la consulta y paciente
      const owner = await this.getConsultaOwner(input.consultaId);
      if (!owner) {
        return {
          success: false,
          message: 'Consulta no encontrada'
        };
      }

      // 2. Verificar que existe conexión activa con el destinatario
      const hasConnection = await this.hasActiveConnection(owner.pacienteId, input.destinatarioId);
      
      if (!hasConnection) {
        return {
          success: false,
          message: 'Se requiere consentimiento del paciente para compartir esta consulta',
          requiresConsent: true
        };
      }

      // 3. Crear registro de compartición
      const shareRecord = await this.prisma.consultaCompartida.create({
        data: {
          consultaId: input.consultaId,
          destinatarioId: input.destinatarioId,
          solicitanteId: input.solicitanteId,
          motivoComparticion: input.motivoComparticion,
          incluirDocumentos: input.incluirDocumentos || false,
          temporal: input.temporal || false,
          fechaExpiracion: input.fechaExpiracion,
          fechaComparticion: new Date()
        }
      });

      // 4. Si se solicitan documentos, compartirlos también
      if (input.incluirDocumentos) {
        const documentos = await this.prisma.documento.findMany({
          where: { consultaId: input.consultaId }
        });

        for (const doc of documentos) {
          await this.prisma.documentoCompartido.create({
            data: {
              documentoId: doc.id,
              destinatarioId: input.destinatarioId,
              solicitanteId: input.solicitanteId,
              motivoComparticion: `Incluido en consulta compartida: ${input.motivoComparticion}`,
              temporal: input.temporal || false,
              fechaExpiracion: input.fechaExpiracion,
              fechaComparticion: new Date()
            }
          });
        }
      }

      // 5. Notificar al destinatario
      const doctorInfo = await this.getDoctorInfo(input.destinatarioId);
      if (doctorInfo) {
        await this.notificationService.sendNotification({
          userId: input.destinatarioId,
          notification: {
            title: 'Consulta compartida',
            body: `Se ha compartido una consulta del paciente ${owner.pacienteNombre}`,
            data: {
              type: 'CONSULTA_COMPARTIDA',
              consultaId: input.consultaId,
              shareId: shareRecord.id,
              pacienteNombre: owner.pacienteNombre,
              motivoComparticion: input.motivoComparticion,
              incluirDocumentos: input.incluirDocumentos
            }
          }
        });
      }

      // 6. Registrar auditoría LOPDP
      await AuditService.logEvent(
        input.solicitanteId,
        'DOCTOR',
        AuditAction.RESOURCE_ACCESS,
        ResourceType.CONSULTA,
        input.consultaId,
        {
          accion: 'COMPARTIR_CONSULTA',
          destinatarioId: input.destinatarioId,
          motivoComparticion: input.motivoComparticion,
          incluirDocumentos: input.incluirDocumentos,
          temporal: input.temporal,
          fechaExpiracion: input.fechaExpiracion
        }
      );

      logger.info(`Consulta ${input.consultaId} compartida con doctor ${input.destinatarioId}`);

      return {
        success: true,
        message: 'Consulta compartida exitosamente',
        shareId: shareRecord.id
      };
    } catch (error) {
      logger.error('Error al compartir consulta:', error);
      return {
        success: false,
        message: 'Error al compartir consulta'
      };
    }
  }

  /**
   * Obtiene documentos compartidos con un doctor
   */
  async getSharedDocuments(doctorId: string, limit = 50) {
    return await this.prisma.documentoCompartido.findMany({
      where: {
        destinatarioId: doctorId,
        // Excluir expirados
        OR: [
          { fechaExpiracion: null },
          { fechaExpiracion: { gt: new Date() } }
        ]
      },
      include: {
        documento: {
          include: {
            consulta: {
              include: {
                paciente: {
                  include: {
                    cuenta: {
                      select: { nombre: true }
                    }
                  }
                }
              }
            }
          }
        },
        solicitante: {
          select: {
            nombre: true,
            especialidad: true
          }
        }
      },
      orderBy: {
        fechaComparticion: 'desc'
      },
      take: limit
    });
  }

  /**
   * Obtiene consultas compartidas con un doctor
   */
  async getSharedConsultas(doctorId: string, limit = 50) {
    return await this.prisma.consultaCompartida.findMany({
      where: {
        destinatarioId: doctorId,
        // Excluir expirados
        OR: [
          { fechaExpiracion: null },
          { fechaExpiracion: { gt: new Date() } }
        ]
      },
      include: {
        consulta: {
          include: {
            paciente: {
              include: {
                cuenta: {
                  select: { nombre: true }
                }
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
        solicitante: {
          select: {
            nombre: true,
            especialidad: true
          }
        }
      },
      orderBy: {
        fechaComparticion: 'desc'
      },
      take: limit
    });
  }

  /**
   * Revoca el acceso a un documento compartido
   */
  async revokeDocumentShare(shareId: string, userId: string): Promise<ShareResponse> {
    try {
      const share = await this.prisma.documentoCompartido.findUnique({
        where: { id: shareId }
      });

      if (!share) {
        return {
          success: false,
          message: 'Registro de compartición no encontrado'
        };
      }

      // Verificar que el usuario es el solicitante original
      if (share.solicitanteId !== userId) {
        return {
          success: false,
          message: 'No autorizado para revocar este acceso'
        };
      }

      // Marcar como expirado
      await this.prisma.documentoCompartido.update({
        where: { id: shareId },
        data: {
          fechaExpiracion: new Date()
        }
      });

      // Notificar al destinatario
      await this.notificationService.sendNotification({
        userId: share.destinatarioId,
        notification: {
          title: 'Acceso revocado',
          body: 'Se ha revocado el acceso a un documento compartido',
          data: {
            type: 'ACCESO_REVOCADO',
            shareId,
            documentoId: share.documentoId
          }
        }
      });

      // Registrar auditoría
      await AuditService.logEvent(
        userId,
        'DOCTOR',
        AuditAction.RESOURCE_ACCESS,
        ResourceType.DOCUMENTO,
        share.documentoId,
        {
          accion: 'REVOCAR_COMPARTICION',
          shareId
        }
      );

      return {
        success: true,
        message: 'Acceso revocado exitosamente'
      };
    } catch (error) {
      logger.error('Error al revocar compartición de documento:', error);
      return {
        success: false,
        message: 'Error al revocar acceso'
      };
    }
  }

  /**
   * Revoca el acceso a una consulta compartida
   */
  async revokeConsultaShare(shareId: string, userId: string): Promise<ShareResponse> {
    try {
      const share = await this.prisma.consultaCompartida.findUnique({
        where: { id: shareId }
      });

      if (!share) {
        return {
          success: false,
          message: 'Registro de compartición no encontrado'
        };
      }

      // Verificar que el usuario es el solicitante original
      if (share.solicitanteId !== userId) {
        return {
          success: false,
          message: 'No autorizado para revocar este acceso'
        };
      }

      // Marcar como expirado
      await this.prisma.consultaCompartida.update({
        where: { id: shareId },
        data: {
          fechaExpiracion: new Date()
        }
      });

      // Notificar al destinatario
      await this.notificationService.sendNotification({
        userId: share.destinatarioId,
        notification: {
          title: 'Acceso revocado',
          body: 'Se ha revocado el acceso a una consulta compartida',
          data: {
            type: 'ACCESO_REVOCADO',
            shareId,
            consultaId: share.consultaId
          }
        }
      });

      // Registrar auditoría
      await AuditService.logEvent(
        userId,
        'DOCTOR',
        AuditAction.RESOURCE_ACCESS,
        ResourceType.CONSULTA,
        share.consultaId,
        {
          accion: 'REVOCAR_COMPARTICION',
          shareId
        }
      );

      return {
        success: true,
        message: 'Acceso revocado exitosamente'
      };
    } catch (error) {
      logger.error('Error al revocar compartición de consulta:', error);
      return {
        success: false,
        message: 'Error al revocar acceso'
      };
    }
  }
}

export default ShareService;
