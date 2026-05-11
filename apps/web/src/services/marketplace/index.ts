// apps/web/src/services/marketplace/index.ts

import { apiClient } from '@/services/api';

/**
 * Tipos de módulos del marketplace
 */
export type ModuleType = 
  | 'whatsapp-business'
  | 'ia-pro'
  | 'webrtc-pro'
  | 'migracion-pro';

export type ModuleCategory = 'communication' | 'ai' | 'video' | 'migration';

/**
 * Configuración de un módulo del marketplace
 */
export interface MarketplaceModule {
  id: ModuleType;
  name: string;
  description: string;
  icon: string;
  price: number;
  features: string[];
  requiredPlan: string[];
  category: ModuleCategory;
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
 * Servicio de Marketplace para frontend
 */
export const marketplaceService = {
  /**
   * Obtiene todos los módulos disponibles
   */
  async getAllModules(): Promise<MarketplaceModule[]> {
    const response = await apiClient.get('/marketplace/modules');
    return response.data as MarketplaceModule[];
  },

  /**
   * Obtiene un módulo por su ID
   */
  async getModuleById(id: string): Promise<MarketplaceModule | null> {
    try {
      const response = await apiClient.get(`/marketplace/modules/${id}`);
      return response.data as MarketplaceModule;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Obtiene módulos por categoría
   */
  async getModulesByCategory(category: ModuleCategory): Promise<MarketplaceModule[]> {
    const response = await apiClient.get(`/marketplace/modules/category/${category}`);
    return response.data as MarketplaceModule[];
  },

  /**
   * Obtiene el estado de activación de módulos del usuario
   */
  async getActivationStatus(): Promise<ModuleActivationStatus[]> {
    const response = await apiClient.get('/marketplace/status');
    return response.data as ModuleActivationStatus[];
  },

  /**
   * Obtiene los módulos activados del usuario
   */
  async getActiveModules(): Promise<ModuleType[]> {
    const response = await apiClient.get('/marketplace/active');
    return response.data as ModuleType[];
  },

  /**
   * Activa un módulo
   */
  async activateModule(moduleId: ModuleType): Promise<ModuleActivationResult> {
    const response = await apiClient.post('/marketplace/activate', { moduleId });
    return response.data as ModuleActivationResult;
  },

  /**
   * Desactiva un módulo
   */
  async deactivateModule(moduleId: ModuleType): Promise<ModuleActivationResult> {
    const response = await apiClient.post('/marketplace/deactivate', { moduleId });
    return response.data as ModuleActivationResult;
  },

  /**
   * Verifica si un módulo está activado
   */
  async isModuleActive(moduleId: ModuleType): Promise<boolean> {
    const response = await apiClient.get(`/marketplace/check/${moduleId}`);
    return response.data.active as boolean;
  }
};
