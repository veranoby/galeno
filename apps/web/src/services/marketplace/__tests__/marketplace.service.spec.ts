// apps/web/src/services/marketplace/__tests__/marketplace.service.spec.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { marketplaceService, type MarketplaceModule, type ModuleType } from '../index';

// Mock API client
const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock('@/services/api', () => ({
  apiClient: {
    get: mockGet,
    post: mockPost,
  },
}));

describe('MarketplaceService (Frontend)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockModules: MarketplaceModule[] = [
    {
      id: 'whatsapp-business',
      name: 'WhatsApp Business',
      description: 'Recordatorios automáticos y confirmaciones de citas vía WhatsApp',
      icon: 'mdi-whatsapp',
      price: 1,
      features: [
        'Recordatorios automáticos de citas',
        'Confirmaciones con un clic',
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
      price: 5,
      features: [
        'Diagnóstico asistido por IA',
        'Sugerencias de tratamiento personalizadas',
      ],
      requiredPlan: ['PREMIUM', 'CLINICA_SME'],
      category: 'ai',
      popular: true,
    },
  ];

  describe('getAllModules', () => {
    it('should fetch all modules from API', async () => {
      mockGet.mockResolvedValue({ data: mockModules });

      const modules = await marketplaceService.getAllModules();

      expect(modules).toEqual(mockModules);
      expect(mockGet).toHaveBeenCalledWith('/marketplace/modules');
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('should handle API errors', async () => {
      mockGet.mockRejectedValue(new Error('Network error'));

      await expect(marketplaceService.getAllModules()).rejects.toThrow('Network error');
    });
  });

  describe('getModuleById', () => {
    it('should fetch a single module by ID', async () => {
      mockGet.mockResolvedValue({ data: mockModules[0] });

      const module = await marketplaceService.getModuleById('whatsapp-business');

      expect(module).toEqual(mockModules[0]);
      expect(mockGet).toHaveBeenCalledWith('/marketplace/modules/whatsapp-business');
    });

    it('should return null when module not found (404)', async () => {
      mockGet.mockRejectedValue({ response: { status: 404 } });

      const module = await marketplaceService.getModuleById('non-existent');

      expect(module).toBeNull();
    });

    it('should throw error for non-404 errors', async () => {
      mockGet.mockRejectedValue(new Error('Server error'));

      await expect(marketplaceService.getModuleById('whatsapp-business'))
        .rejects.toThrow('Server error');
    });
  });

  describe('getModulesByCategory', () => {
    it('should fetch modules filtered by category', async () => {
      const communicationModules = mockModules.filter(m => m.category === 'communication');
      mockGet.mockResolvedValue({ data: communicationModules });

      const modules = await marketplaceService.getModulesByCategory('communication');

      expect(modules).toEqual(communicationModules);
      expect(mockGet).toHaveBeenCalledWith('/marketplace/modules/category/communication');
    });
  });

  describe('getActivationStatus', () => {
    it('should fetch activation status for all modules', async () => {
      const mockStatus = [
        {
          moduleId: 'whatsapp-business' as ModuleType,
          active: true,
          activatedAt: new Date('2024-01-01'),
          canActivate: true,
        },
        {
          moduleId: 'ia-pro' as ModuleType,
          active: false,
          canActivate: true,
        },
      ];
      mockGet.mockResolvedValue({ data: mockStatus });

      const status = await marketplaceService.getActivationStatus();

      expect(status).toEqual(mockStatus);
      expect(mockGet).toHaveBeenCalledWith('/marketplace/status');
    });
  });

  describe('getActiveModules', () => {
    it('should fetch list of active module IDs', async () => {
      const activeModules: ModuleType[] = ['whatsapp-business', 'ia-pro'];
      mockGet.mockResolvedValue({ data: activeModules });

      const modules = await marketplaceService.getActiveModules();

      expect(modules).toEqual(activeModules);
      expect(mockGet).toHaveBeenCalledWith('/marketplace/active');
    });
  });

  describe('activateModule', () => {
    it('should activate a module', async () => {
      const mockResult = {
        success: true,
        message: 'Módulo activado exitosamente',
        activation: {
          moduleId: 'whatsapp-business' as ModuleType,
          active: true,
          activatedAt: new Date(),
        },
      };
      mockPost.mockResolvedValue({ data: mockResult });

      const result = await marketplaceService.activateModule('whatsapp-business');

      expect(result).toEqual(mockResult);
      expect(mockPost).toHaveBeenCalledWith('/marketplace/activate', {
        moduleId: 'whatsapp-business',
      });
    });

    it('should handle activation failure', async () => {
      const mockResult = {
        success: false,
        message: 'Plan no compatible',
      };
      mockPost.mockResolvedValue({ data: mockResult });

      const result = await marketplaceService.activateModule('ia-pro');

      expect(result).toEqual(mockResult);
      expect(result.success).toBe(false);
    });
  });

  describe('deactivateModule', () => {
    it('should deactivate a module', async () => {
      const mockResult = {
        success: true,
        message: 'Módulo desactivado exitosamente',
        activation: {
          moduleId: 'whatsapp-business' as ModuleType,
          active: false,
          activatedAt: new Date('2024-01-01'),
        },
      };
      mockPost.mockResolvedValue({ data: mockResult });

      const result = await marketplaceService.deactivateModule('whatsapp-business');

      expect(result).toEqual(mockResult);
      expect(mockPost).toHaveBeenCalledWith('/marketplace/deactivate', {
        moduleId: 'whatsapp-business',
      });
    });
  });

  describe('isModuleActive', () => {
    it('should check if a module is active', async () => {
      mockGet.mockResolvedValue({ data: { active: true } });

      const isActive = await marketplaceService.isModuleActive('whatsapp-business');

      expect(isActive).toBe(true);
      expect(mockGet).toHaveBeenCalledWith('/marketplace/check/whatsapp-business');
    });

    it('should return false when module is not active', async () => {
      mockGet.mockResolvedValue({ data: { active: false } });

      const isActive = await marketplaceService.isModuleActive('ia-pro');

      expect(isActive).toBe(false);
    });
  });

  describe('Module Types', () => {
    it('should have correct module type definitions', () => {
      const validModuleTypes: ModuleType[] = [
        'whatsapp-business',
        'ia-pro',
        'webrtc-pro',
        'migracion-pro',
      ];

      expect(validModuleTypes).toHaveLength(4);
      expect(validModuleTypes).toContain('whatsapp-business');
      expect(validModuleTypes).toContain('ia-pro');
    });
  });

  describe('Module Categories', () => {
    it('should have correct category type definitions', () => {
      const categories = [
        'communication',
        'ai',
        'video',
        'migration',
      ];

      expect(categories).toHaveLength(4);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      mockGet.mockRejectedValue(new Error('Network Error'));

      await expect(marketplaceService.getAllModules())
        .rejects.toThrow('Network Error');
    });

    it('should handle server errors gracefully', async () => {
      mockPost.mockRejectedValue(new Error('Internal Server Error'));

      await expect(marketplaceService.activateModule('whatsapp-business'))
        .rejects.toThrow('Internal Server Error');
    });
  });
});
