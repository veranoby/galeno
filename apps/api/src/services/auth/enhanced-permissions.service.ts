import { Plan } from '@prisma/client';
import { logger } from '../../utils/logger.js';
import prisma from '../../config/database.js';
import { Permission, ROLE_PERMISSIONS, PLAN_PERMISSIONS, UserWithPermissions, PermissionService } from './permissions.service.js';

/**
 * Enhanced permission service with resource-level access control
 */
export class EnhancedPermissionService {
  /**
   * Check if a user can access a specific resource based on permissions and ownership
   */
  static async canAccessResource(
    userId: string,  
    resourceType: 'paciente' | 'consulta' | 'documento' | 'usuario' | 'cita', 
    resourceId: string
  ): Promise<boolean> {
    try {
      const userPermissions = await this.getUserPermissions(userId);
      
      // Admins can access everything
      if (userPermissions.rol === 'ADMIN') {
        return true;
      }

      // Check if user has the basic permission to access resources of this type
      const permissionMap: Record<string, Permission> = {
        'paciente': Permission.PATIENT_READ,
        'consulta': Permission.CONSULTATION_READ,
        'documento': Permission.DOCUMENT_READ,
        'usuario': Permission.USER_READ,
        'cita': Permission.CONSULTATION_READ // Citas are related to consultations
      };

      const requiredPermission = permissionMap[resourceType];
      if (!requiredPermission || !userPermissions.permissions.includes(requiredPermission)) {
        return false;
      }

      // Perform resource-specific access checks
      switch (resourceType) {
        case 'paciente':
          return this.canAccessPatient(userId,  resourceId,  userPermissions);
        case 'consulta':
          return this.canAccessConsulta(userId,  resourceId,  userPermissions);
        case 'documento':
          return this.canAccessDocumento(userId,  resourceId,  userPermissions);
        case 'usuario':
          return this.canAccessUsuario(userId,  resourceId,  userPermissions);
        case 'cita':
          return this.canAccessCita(userId,  resourceId,  userPermissions);
        default:
          return false;
      }
    } catch (error) {
      logger.error({ error,  userId,  resourceType,  resourceId },  'Error checking resource access');
      return false;
    }
  }

  /**
   * Check if user can access a patient
   */
  private static async canAccessPatient(userId: string,  pacienteId: string,  userPermissions: UserWithPermissions): Promise<boolean> {
    // Get patient and check ownership
    const paciente = await prisma.paciente.findUnique({
      where: { id: pacienteId }, 
      select: { cuentaId: true }
    });

    if (!paciente) {
      return false;
    }

    // Doctors can access their own patients
    if (userPermissions.rol === 'DOCTOR' && paciente.cuentaId === userId) {
      return true;
    }

    // Assistants/nurses can access patients of their assigned doctor
    if ((userPermissions.rol === 'ASISTENTE' || userPermissions.rol === 'ENFERMERA') && 
        userPermissions.cuentaId === paciente.cuentaId) {
      return true;
    }

    return false;
  }

  /**
   * Check if user can access a consulta
   */
  private static async canAccessConsulta(userId: string,  consultaId: string,  userPermissions: UserWithPermissions): Promise<boolean> {
    const consulta = await prisma.consulta.findUnique({
      where: { id: consultaId }, 
      select: { 
        cuentaId: true, 
        paciente: { select: { cuentaId: true } }, 
        doctorId: true, 
        asistenteId: true
      }
    });

    if (!consulta) {
      return false;
    }

    // Doctors can access their own consultations
    if (userPermissions.rol === 'DOCTOR' && (consulta.doctorId === userId || consulta.cuentaId === userId)) {
      return true;
    }

    // Assistants can access consultations they were assigned to
    if (userPermissions.rol === 'ASISTENTE' && consulta.asistenteId === userId) {
      return true;
    }

    // Assistants/nurses can access consultations of patients they have access to
    if ((userPermissions.rol === 'ASISTENTE' || userPermissions.rol === 'ENFERMERA') &&
        userPermissions.cuentaId === consulta.paciente.cuentaId) {
      return true;
    }

    return false;
  }

  /**
   * Check if user can access a documento
   */
  private static async canAccessDocumento(userId: string,  documentoId: string,  userPermissions: UserWithPermissions): Promise<boolean> {
    const documento = await prisma.documento.findUnique({
      where: { id: documentoId }, 
      select: {
        consulta: {
          select: {
            cuentaId: true, 
            paciente: { select: { cuentaId: true } }, 
            doctorId: true, 
            asistenteId: true
          }
        }
      }
    });

    if (!documento) {
      return false;
    }

    const consulta = documento.consulta;

    // Doctors can access documents from their consultations
    if (userPermissions.rol === 'DOCTOR' && (consulta.doctorId === userId || consulta.cuentaId === userId)) {
      return true;
    }

    // Assistants can access documents from consultations they were assigned to
    if (userPermissions.rol === 'ASISTENTE' && consulta.asistenteId === userId) {
      return true;
    }

    // Assistants/nurses can access documents of patients they have access to
    if ((userPermissions.rol === 'ASISTENTE' || userPermissions.rol === 'ENFERMERA') &&
        userPermissions.cuentaId === consulta.paciente.cuentaId) {
      return true;
    }

    return false;
  }

  /**
   * Check if user can access another user
   */
  private static async canAccessUsuario(userId: string,  targetUserId: string,  userPermissions: UserWithPermissions): Promise<boolean> {
    // Users can access their own information
    if (userId === targetUserId) {
      return true;
    }

    // Doctors can access their linked users (assistants,  nurses)
    if (userPermissions.rol === 'DOCTOR') {
      const targetUser = await prisma.usuarioVinculado.findUnique({
        where: { id: targetUserId }, 
        select: { cuentaId: true }
      });

      if (targetUser && targetUser.cuentaId === userId) {
        return true;
      }
    }

    // Assistants/nurses can access their doctor
    if ((userPermissions.rol === 'ASISTENTE' || userPermissions.rol === 'ENFERMERA') &&
        userPermissions.cuentaId === targetUserId) {
      return true;
    }

    return false;
  }

  /**
   * Check if user can access a cita
   */
  private static async canAccessCita(userId: string,  citaId: string,  userPermissions: UserWithPermissions): Promise<boolean> {
    const cita = await prisma.cita.findUnique({
      where: { id: citaId }, 
      select: { 
        doctorId: true,  
        paciente: { select: { cuentaId: true } }, 
        ubicacion: { select: { doctorId: true } }
      }
    });

    if (!cita) {
      return false;
    }

    // Doctors can access their own appointments
    if (userPermissions.rol === 'DOCTOR' && cita.doctorId === userId) {
      return true;
    }

    // Assistants/nurses can access appointments of patients they have access to
    if ((userPermissions.rol === 'ASISTENTE' || userPermissions.rol === 'ENFERMERA') &&
        userPermissions.cuentaId === cita.paciente.cuentaId) {
      return true;
    }

    return false;
  }

  /**
   * Get user permissions
   */
  static async getUserPermissions(userId: string): Promise<UserWithPermissions> {
    return PermissionService.getUserPermissions(userId);
  }

  /**
   * Check if user has a specific permission
   */
  static async hasPermission(userId: string,  permission: Permission): Promise<boolean> {
    return PermissionService.checkPermission(userId,  permission);
  }
}

/**
 * Helper function to check resource access - can be used in route handlers
 */
export async function checkResourceAccess(
  userId: string, 
  resourceType: 'paciente' | 'consulta' | 'documento' | 'usuario' | 'cita', 
  resourceId: string
): Promise<boolean> {
  return EnhancedPermissionService.canAccessResource(userId,  resourceType,  resourceId);
}