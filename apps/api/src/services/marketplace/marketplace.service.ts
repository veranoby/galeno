// apps/api/src/services/marketplace/marketplace.service.ts

import { logger } from '../../utils/logger.js';
import prisma from '../../config/database.js';
import { Plan } from '@prisma/client';

/**
 * Tipos de módulos disponibles en el marketplace
 */
export type ModuleType = 
  | 'whatsapp-business'
  | 'ia-pro'
  | 'webrtc-pro'
  | 'migracion-pro';

/**
 * Configuración de un módulo del marketplace
 */
export interface MarketplaceModule {
  id: ModuleType;
  name: string;
  description: string;
  icon: string;
  price: number; // Precio mensual en USD
  features: string[];
  requiredPlan: Plan[]; // Planes mínimos requeridos
  category: 'communication' | 'ai' | 'video' | 'migration';
  popular?: boolean;
}

/**
 * Estado de activación de un módulo
 */
export interface ModuleActivationStatus {
  moduleId: ModuleType;
  active: boolean;
  activatedAt?: Date;
  canActivate: boolean;
  activationBlockedReason?: string;
}

/**
 * Resultado de activación de módulo
 */
export interface ModuleActivationResult {
  success: boolean;
  message: string;
  activation?: {
    moduleId: ModuleType;
    active: boolean;
    activatedAt: Date;
  };
}

/**
 * Catálogo de módulos disponibles
 */
const MARKETPLACE_MODULES: MarketplaceModule[] = [
  {
    id: 'whatsapp-business',
    name: 'WhatsApp Business',
    description: 'Recordatorios automáticos y confirmaciones de citas vía WhatsApp',
    icon: 'mdi-whatsapp',
    price: 1, // $1/mes
    features: [
      'Recordatorios automáticos de citas',
      'Confirmaciones con un clic',
      'Notificaciones de estado',
      'Plantillas personalizables',
      'Estadísticas de envío'
    ],
    requiredPlan: ['PREMIUM', 'CLINICA_SME'],
    category: 'communication',
    popular: true,
  },
  {
    id: 'ia-pro',
    name: 'IA Pro',
    description: 'Asistente de IA avanzado con sugerencias de diagnóstico y tratamiento',
    icon: 'mdi-robot-happy',
    price: 5, // $5/mes
    features: [
      'Diagnóstico asistido por IA',
      'Sugerencias de tratamiento personalizadas',
      'Alertas de interacciones medicamentosas',
      'Análisis de patrones clínicos',
      'Integración con CIE-10'
    ],
    requiredPlan: ['PREMIUM', 'CLINICA_SME'],
    category: 'ai',
    popular: true,
  },
  {
    id: 'webrtc-pro',
    name: 'WebRTC Pro',
    description: 'Teleconsultas profesionales con grabación y branding personalizado',
    icon: 'mdi-video',
    price: 1, // $1/mes
    features: [
      'Grabación de teleconsultas',
      'Branding personalizado',
      'Sala de espera virtual',
      'Chat integrado',
      'Compartir pantalla HD'
    ],
    requiredPlan: ['PREMIUM', 'CLINICA_SME'],
    category: 'video',
  },
  {
    id: 'migracion-pro',
    name: 'Migración Pro',
    description: 'Importación masiva de pacientes desde otras plataformas con IA',
    icon: 'mdi-database-import',
    price: 1, // $1/mes (temporal)
    features: [
      'Importación masiva de pacientes',
      'IA para limpieza de datos',
      'Mapeo automático de campos',
      'Validación de datos duplicados',
      'Reporte de migración'
    ],
    requiredPlan: ['FREE', 'PREMIUM', 'CLINICA_SME'],
    category: 'migration',
  },
];

/**
 * Servicio de Marketplace de Módulos
 */
export class MarketplaceService {
  /**
   * Obtiene todos los módulos disponibles en el marketplace
   */
  async getAllModules(): Promise<MarketplaceModule[]> {
    return MARKETPLACE_MODULES;
  }

  /**
   * Obtiene un módulo específico por su ID
   */
  async getModuleById(id: string): Promise<MarketplaceModule | null> {
    const module = MARKETPLACE_MODULES.find(m => m.id === id);
    return module || null;
  }

  /**
   * Obtiene módulos por categoría
   */
  async getModulesByCategory(category: string): Promise<MarketplaceModule[]> {
    return MARKETPLACE_MODULES.filter(m => m.category === category);
  }

  /**
   * Verifica el estado de activación de módulos para un usuario
   */
  async getModuleActivationStatus(
    userId: string
  ): Promise<ModuleActivationStatus[]> {
    logger.info(`Fetching module activation status for user: ${userId}`);

    // Obtener plan del usuario
    const user = await prisma.cuenta.findUnique({
      where: { id: userId },
      select: {
        id: true,
        plan: true,
        moduleActivations: {
          select: {
            moduleId: true,
            activo: true,
            fechaActivacion: true
          }
        }
      }
    });

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    // Mapear activaciones existentes
    const activationMap = new Map(
      user.moduleActivations.map(a => [a.moduleId, { active: a.activo, activatedAt: a.fechaActivacion }])
    );

    // Verificar cada módulo del catálogo
    const statusList: ModuleActivationStatus[] = MARKETPLACE_MODULES.map(module => {
      const activation = activationMap.get(module.id);
      const canActivate = this.canActivateModule(user.plan, module);

      return {
        moduleId: module.id,
        active: activation?.active || false,
        activatedAt: activation?.activatedAt,
        canActivate,
        activationBlockedReason: canActivate
          ? undefined
          : `Plan ${user.plan} no es compatible con este módulo. Planes requeridos: ${module.requiredPlan.join(', ')}`
      };
    });

    return statusList;
  }

  /**
   * Activa un módulo para un usuario
   */
  async activateModule(
    userId: string,
    moduleId: ModuleType
  ): Promise<ModuleActivationResult> {
    logger.info(`Activating module ${moduleId} for user: ${userId}`);

    try {
      // Verificar que el módulo existe
      const module = await this.getModuleById(moduleId);
      if (!module) {
        return {
          success: false,
          message: `Módulo ${moduleId} no encontrado`
        };
      }

      // Obtener usuario y verificar plan
      const user = await prisma.cuenta.findUnique({
        where: { id: userId },
        select: {
          id: true,
          plan: true,
          customerId: true
        }
      });

      if (!user) {
        return {
          success: false,
          message: 'Usuario no encontrado'
        };
      }

      // Verificar si el plan permite activar este módulo
      if (!this.canActivateModule(user.plan, module)) {
        return {
          success: false,
          message: `Tu plan actual (${user.plan}) no permite activar este módulo. Planes requeridos: ${module.requiredPlan.join(', ')}`
        };
      }

      // Verificar si ya está activado
      const existingActivation = await prisma.moduleActivation.findUnique({
        where: {
          cuentaId_moduleId: {
            cuentaId: userId,
            moduleId: moduleId
          }
        }
      });

      if (existingActivation?.activo) {
        return {
          success: false,
          message: 'El módulo ya está activado',
          activation: {
            moduleId,
            active: true,
            activatedAt: existingActivation.fechaActivacion!
          }
        };
      }

      // Activar o crear activación
      const activation = await prisma.moduleActivation.upsert({
        where: {
          cuentaId_moduleId: {
            cuentaId: userId,
            moduleId: moduleId
          }
        },
        update: {
          activo: true,
          fechaActivacion: new Date(),
          fechaDesactivacion: null
        },
        create: {
          cuentaId: userId,
          moduleId: moduleId,
          activo: true,
          fechaActivacion: new Date()
        }
      });

      logger.info({
        event: 'module_activated',
        userId,
        moduleId,
        activationId: activation.id
      });

      return {
        success: true,
        message: `Módulo ${module.name} activado exitosamente`,
        activation: {
          moduleId,
          active: true,
          activatedAt: activation.fechaActivacion!
        }
      };
    } catch (error: any) {
      logger.error({
        event: 'module_activation_error',
        userId,
        moduleId,
        error: error.message
      });

      return {
        success: false,
        message: `Error al activar el módulo: ${error.message}`
      };
    }
  }

  /**
   * Desactiva un módulo para un usuario
   */
  async deactivateModule(
    userId: string,
    moduleId: ModuleType
  ): Promise<ModuleActivationResult> {
    logger.info(`Deactivating module ${moduleId} for user: ${userId}`);

    try {
      // Verificar que el módulo existe
      const module = await this.getModuleById(moduleId);
      if (!module) {
        return {
          success: false,
          message: `Módulo ${moduleId} no encontrado`
        };
      }

      // Verificar activación existente
      const existingActivation = await prisma.moduleActivation.findUnique({
        where: {
          cuentaId_moduleId: {
            cuentaId: userId,
            moduleId: moduleId
          }
        }
      });

      if (!existingActivation || !existingActivation.activo) {
        return {
          success: false,
          message: 'El módulo no está activado'
        };
      }

      // Desactivar módulo
      const activation = await prisma.moduleActivation.update({
        where: {
          cuentaId_moduleId: {
            cuentaId: userId,
            moduleId: moduleId
          }
        },
        data: {
          activo: false,
          fechaDesactivacion: new Date()
        }
      });

      logger.info({
        event: 'module_deactivated',
        userId,
        moduleId,
        activationId: activation.id
      });

      return {
        success: true,
        message: `Módulo ${module.name} desactivado exitosamente`,
        activation: {
          moduleId,
          active: false,
          activatedAt: activation.fechaActivacion!
        }
      };
    } catch (error: any) {
      logger.error({
        event: 'module_deactivation_error',
        userId,
        moduleId,
        error: error.message
      });

      return {
        success: false,
        message: `Error al desactivar el módulo: ${error.message}`
      };
    }
  }

  /**
   * Obtiene los módulos activados de un usuario
   */
  async getActiveModules(userId: string): Promise<ModuleType[]> {
    logger.info(`Fetching active modules for user: ${userId}`);

    const activations = await prisma.moduleActivation.findMany({
      where: {
        cuentaId: userId,
        activo: true
      },
      select: {
        moduleId: true
      }
    });

    return activations.map(a => a.moduleId as ModuleType);
  }

  /**
   * Verifica si un usuario puede activar un módulo según su plan
   */
  private canActivateModule(
    userPlan: Plan,
    module: MarketplaceModule
  ): boolean {
    return module.requiredPlan.includes(userPlan);
  }

  /**
   * Verifica si un usuario tiene un módulo específico activado
   */
  async isModuleActive(
    userId: string,
    moduleId: ModuleType
  ): Promise<boolean> {
    const activation = await prisma.moduleActivation.findUnique({
      where: {
        cuentaId_moduleId: {
          cuentaId: userId,
          moduleId: moduleId
        }
      },
      select: {
        activo: true
      }
    });

    return activation?.activo || false;
  }
}

// Exportar instancia singleton
export const marketplaceService = new MarketplaceService();
