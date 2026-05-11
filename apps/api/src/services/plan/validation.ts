import { Plan } from '@prisma/client';
import prisma from '../../config/database.js';
import { PLANES_CONFIG, getPlanConfig, type StorageUsage } from './config.js';
import { logger } from '../../utils/logger.js';

export interface PlanValidationResult {
  valid: boolean;
  error?: string;
  usage?: StorageUsage;
}

/**
 * Validates if a user can add more doctors based on their plan limits
 */
export async function validarLimiteDoctores(userId: string,  additionalDoctors: number = 1): Promise<PlanValidationResult> {
  try {
    // Get user's account with plan information
    const user = await prisma.cuenta.findUnique({
      where: { id: userId },
      select: {
        id: true,
        plan: true,
        rol: true,
        planLimites: {
          select: {
            maxDoctores: true,
            maxAsistentes: true,
            maxAlmacenamientoMB: true
          }
        }
      }
    });

    if (!user) {
      return { valid: false, error: 'Usuario no encontrado' };
    }

    if (!user.plan) {
      return { valid: false, error: 'Cuenta sin plan definido' };
    }

    const config = getPlanConfig(user.plan);

    // Determine max doctors based on plan and custom limits
    let maxDoctores: number;
    if (user.plan === 'CLINICA_SME') {
      // For CLINICA_SME, max doctors is dynamic based on plan limits
      maxDoctores = user.planLimites?.maxDoctores ?? config.limites.maxDoctores;
    } else {
      maxDoctores = user.planLimites?.maxDoctores ?? config.limites.maxDoctores;
    }

    // For simplicity, we count current user as 1 doctor
    // In a multi-doctor setup, you would count all UsuarioVinculado with ASISTENTE role
    const currentDoctorsCount = 1;

    const totalAfterAddition = currentDoctorsCount + additionalDoctors;

    if (totalAfterAddition > maxDoctores) {
      return {
        valid: false,
        error: `Límite de doctores excedido. Plan permite ${maxDoctores}, actualmente hay ${currentDoctorsCount}, intentando agregar ${additionalDoctors}.`
      };
    }

    return {
      valid: true
    };
  } catch (error) {
    logger.error({ error,  userId,  additionalDoctors },  'Error validating doctor limit');
    return { valid: false, error: 'Error interno al validar límite de doctores' };
  }
}

/**
 * Validates if a user can add more assistants based on their plan limits
 */
export async function validarLimiteAsistentes(userId: string,  additionalAssistants: number = 1): Promise<PlanValidationResult> {
  try {
    // Get user's account with plan information
    const user = await prisma.cuenta.findUnique({
      where: { id: userId },
      select: {
        id: true,
        plan: true,
        rol: true,
        planLimites: {
          select: {
            maxDoctores: true,
            maxAsistentes: true,
            maxAlmacenamientoMB: true
          }
        }
      }
    });

    if (!user) {
      return { valid: false, error: 'Usuario no encontrado' };
    }

    if (!user.plan) {
      return { valid: false, error: 'Cuenta sin plan definido' };
    }

    const config = getPlanConfig(user.plan);

    // Determine max assistants based on plan and custom limits
    const maxAsistentes = user.planLimites?.maxAsistentes ?? config.limites.maxAsistentes;

    // Count current assistants (UsuarioVinculado with ASISTENTE role)
    const currentAssistantsCount = await prisma.usuarioVinculado.count({
      where: {
        cuentaId: userId,
        rol: 'ASISTENTE'
      }
    });

    const totalAfterAddition = currentAssistantsCount + additionalAssistants;

    if (totalAfterAddition > maxAsistentes) {
      return {
        valid: false,
        error: `Límite de asistentes excedido. Plan permite ${maxAsistentes}, actualmente hay ${currentAssistantsCount}, intentando agregar ${additionalAssistants}.`
      };
    }

    return {
      valid: true
    };
  } catch (error) {
    logger.error({ error,  userId,  additionalAssistants },  'Error validating assistant limit');
    return { valid: false, error: 'Error interno al validar límite de asistentes' };
  }
}

/**
 * Validates if a user has enough storage space based on their plan limits
 */
export async function validarLimiteAlmacenamiento(usuarioId: string,  bytesToAdd: number): Promise<PlanValidationResult> {
  try {
    // Get user's account with plan information
    const user = await prisma.cuenta.findUnique({
      where: { id: usuarioId },
      select: {
        id: true,
        plan: true,
        rol: true,
        planLimites: {
          select: {
            maxDoctores: true,
            maxAlmacenamientoMB: true
          }
        }
      }
    });

    if (!user) {
      return { valid: false, error: 'Usuario no encontrado' };
    }

    if (!user.plan) {
      return { valid: false, error: 'Cuenta sin plan definido' };
    }

    const config = getPlanConfig(user.plan);

    // Determine max storage based on plan
    let maxAlmacenamientoMB: number;
    if (user.plan === 'CLINICA_SME') {
      // For CLINICA_SME, storage is calculated as 500MB per doctor
      // For simplicity, we use 1 (current user)
      const doctorCount = 1;
      maxAlmacenamientoMB = doctorCount * 500; // 500MB per doctor
    } else {
      maxAlmacenamientoMB = user.planLimites?.maxAlmacenamientoMB ?? config.limites.maxAlmacenamientoMB;
    }

    // Calculate current storage usage (this would typically come from a storage tracking table)
    // For now, we'll calculate based on file sizes in the documentos table
    const documentos = await prisma.documento.findMany({
      where: {
        pacienteId: usuarioId,
        OR: [
          { contenido: { not: null } },
          { archivoUrl: { not: null } }
        ]
      },
      select: {
        archivoSize: true
      }
    });

    const currentUsageBytes = documentos.reduce((sum,  doc) => sum + (doc.archivoSize || 0), 0);
    const currentUsageMB = currentUsageBytes / (1024 * 1024); // Convert to MB

    const requestedSizeMB = bytesToAdd / (1024 * 1024); // Convert to MB
    const totalAfterAdditionMB = currentUsageMB + requestedSizeMB;

    if (totalAfterAdditionMB > maxAlmacenamientoMB) {
      const disponibleMB = maxAlmacenamientoMB - currentUsageMB;
      return {
        valid: false,
        error: `Almacenamiento insuficiente. Disponible: ${disponibleMB.toFixed(2)} MB, solicitado: ${requestedSizeMB.toFixed(2)} MB`,
        usage: {
          usadoMB: currentUsageMB,
          disponibleMB: disponibleMB,
          porcentajeUsado: (currentUsageMB / maxAlmacenamientoMB) * 100
        }
      };
    }

    return {
      valid: true,
      usage: {
        usadoMB: currentUsageMB,
        disponibleMB: maxAlmacenamientoMB - currentUsageMB,
        porcentajeUsado: (currentUsageMB / maxAlmacenamientoMB) * 100
      }
    };
  } catch (error) {
    logger.error({ error,  usuarioId,  bytesToAdd },  'Error validating storage limit');
    return { valid: false, error: 'Error interno al validar límite de almacenamiento' };
  }
}

/**
 * Validates if a user can access a specific feature based on their plan
 */
export async function validarAccesoFuncionalidad(usuarioId: string,  feature: string): Promise<PlanValidationResult> {
  try {
    // Get user's account with plan information
    const user = await prisma.cuenta.findUnique({
      where: { id: usuarioId },
      select: {
        id: true,
        plan: true,
        rol: true,
      }
    });

    if (!user) {
      return { valid: false, error: 'Usuario no encontrado' };
    }

    if (!user.plan) {
      return { valid: false, error: 'Cuenta sin plan definido' };
    }

    const config = getPlanConfig(user.plan);
    
    // Check if the feature is available for this plan
    const caracteristicas = config.caracteristicas;
    
    // Feature availability mapping
    const featureMap: Record<string, keyof typeof caracteristicas> = {
      'interconsultas': 'tieneInterconsultas',
      'telemedicina': 'tieneTeleconsultas',
      'health_wallet': 'tieneHealthWallet',
      'integracion_sri': 'tieneSRIIntegracion',
      'ia_asistente': 'tieneIAAsistente',
      'soporte_prioridad': 'tieneSoportePrioridad'
    };

    const featureKey = featureMap[feature];
    if (featureKey && !caracteristicas[featureKey]) {
      return {
        valid: false,
        error: `La funcionalidad "${feature}" no está disponible en su plan actual (${user.plan}).`
      };
    }

    return { valid: true };
  } catch (error) {
    logger.error({ error,  usuarioId,  feature },  'Error validating feature access');
    return { valid: false, error: 'Error interno al validar acceso a funcionalidad' };
  }
}

/**
 * Main validation service that combines all plan validations
 */
export class PlanValidationService {
  static async validateDoctorLimit(userId: string,  additionalCount: number = 1): Promise<PlanValidationResult> {
    return validarLimiteDoctores(userId,  additionalCount);
  }

  static async validateAssistantLimit(userId: string,  additionalCount: number = 1): Promise<PlanValidationResult> {
    return validarLimiteAsistentes(userId,  additionalCount);
  }

  static async validateStorageLimit(userId: string,  bytesToAdd: number): Promise<PlanValidationResult> {
    return validarLimiteAlmacenamiento(userId,  bytesToAdd);
  }

  static async validateFeatureAccess(userId: string,  feature: string): Promise<PlanValidationResult> {
    return validarAccesoFuncionalidad(userId,  feature);
  }

  /**
   * Middleware function to validate plan limits before performing an action
   */
  static async validatePlanBeforeAction(
    userId: string,  
    action: 'add_doctor' | 'add_assistant' | 'upload_file' | 'access_feature', 
    params?: { count?: number; size?: number; feature?: string }
  ): Promise<PlanValidationResult> {
    switch (action) {
      case 'add_doctor':
        return this.validateDoctorLimit(userId,  params?.count || 1);
      case 'add_assistant':
        return this.validateAssistantLimit(userId,  params?.count || 1);
      case 'upload_file':
        return this.validateStorageLimit(userId,  params?.size || 0);
      case 'access_feature':
        return this.validateFeatureAccess(userId,  params?.feature || '');
      default:
        return { valid: false, error: 'Acción no válida para validación de plan' };
    }
  }
}