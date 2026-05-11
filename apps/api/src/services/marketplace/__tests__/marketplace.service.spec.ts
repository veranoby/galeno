// apps/api/src/services/marketplace/__tests__/marketplace.service.spec.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { marketplaceService, ModuleType } from '../marketplace.service';
import prisma from '../../../config/database.js';

// Mock Prisma
vi.mock('../../../config/database.js', () => ({
  default: {
    cuenta: {
      findUnique: vi.fn(),
    },
    moduleActivation: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe('MarketplaceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAllModules', () => {
    it('should return all available modules', async () => {
      const modules = await marketplaceService.getAllModules();

      expect(modules).toHaveLength(4);
      expect(modules.map(m => m.id)).toEqual([
        'whatsapp-business',
        'ia-pro',
        'webrtc-pro',
        'migracion-pro',
      ]);
    });

    it('should return modules with correct structure', async () => {
      const modules = await marketplaceService.getAllModules();
      const whatsappModule = modules.find(m => m.id === 'whatsapp-business');

      expect(whatsappModule).toBeDefined();
      expect(whatsappModule?.name).toBe('WhatsApp Business');
      expect(whatsappModule?.price).toBe(1);
      expect(whatsappModule?.category).toBe('communication');
      expect(whatsappModule?.popular).toBe(true);
      expect(whatsappModule?.features).toHaveLength(5);
    });
  });

  describe('getModuleById', () => {
    it('should return module when ID exists', async () => {
      const module = await marketplaceService.getModuleById('ia-pro');

      expect(module).toBeDefined();
      expect(module?.id).toBe('ia-pro');
      expect(module?.name).toBe('IA Pro');
      expect(module?.category).toBe('ai');
    });

    it('should return null when ID does not exist', async () => {
      const module = await marketplaceService.getModuleById('non-existent');

      expect(module).toBeNull();
    });
  });

  describe('getModulesByCategory', () => {
    it('should return modules filtered by category', async () => {
      const communicationModules = await marketplaceService.getModulesByCategory('communication');

      expect(communicationModules).toHaveLength(1);
      expect(communicationModules[0].id).toBe('whatsapp-business');
    });

    it('should return empty array for unknown category', async () => {
      const modules = await marketplaceService.getModulesByCategory('unknown' as any);

      expect(modules).toHaveLength(0);
    });
  });

  describe('getModuleActivationStatus', () => {
    const mockUser = {
      id: 'user-123',
      plan: 'PREMIUM' as const,
      moduleActivations: [
        {
          moduleId: 'whatsapp-business',
          activo: true,
          fechaActivacion: new Date('2024-01-01'),
        },
      ],
    };

    it('should return activation status for all modules', async () => {
      vi.mocked(prisma.cuenta.findUnique).mockResolvedValue(mockUser as any);

      const status = await marketplaceService.getModuleActivationStatus('user-123');

      expect(status).toHaveLength(4);
      expect(prisma.cuenta.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        select: expect.objectContaining({
          plan: true,
          moduleActivations: expect.any(Object),
        }),
      });
    });

    it('should mark activated modules as active', async () => {
      vi.mocked(prisma.cuenta.findUnique).mockResolvedValue(mockUser as any);

      const status = await marketplaceService.getModuleActivationStatus('user-123');
      const whatsappStatus = status.find(s => s.moduleId === 'whatsapp-business');

      expect(whatsappStatus?.active).toBe(true);
      expect(whatsappStatus?.activatedAt).toEqual(new Date('2024-01-01'));
    });

    it('should mark inactive modules as not active', async () => {
      vi.mocked(prisma.cuenta.findUnique).mockResolvedValue(mockUser as any);

      const status = await marketplaceService.getModuleActivationStatus('user-123');
      const iaProStatus = status.find(s => s.moduleId === 'ia-pro');

      expect(iaProStatus?.active).toBe(false);
      expect(iaProStatus?.canActivate).toBe(true);
    });

    it('should block activation for incompatible plans', async () => {
      const freeUser = {
        ...mockUser,
        plan: 'FREE' as const,
      };
      vi.mocked(prisma.cuenta.findUnique).mockResolvedValue(freeUser as any);

      const status = await marketplaceService.getModuleActivationStatus('user-123');
      const iaProStatus = status.find(s => s.moduleId === 'ia-pro');

      expect(iaProStatus?.canActivate).toBe(false);
      expect(iaProStatus?.activationBlockedReason).toContain('FREE');
    });

    it('should throw error when user not found', async () => {
      vi.mocked(prisma.cuenta.findUnique).mockResolvedValue(null);

      await expect(marketplaceService.getModuleActivationStatus('non-existent'))
        .rejects.toThrow('User non-existent not found');
    });
  });

  describe('activateModule', () => {
    const mockUser = {
      id: 'user-123',
      plan: 'PREMIUM' as const,
      customerId: 'customer-123',
    };

    it('should activate module successfully', async () => {
      vi.mocked(prisma.cuenta.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.moduleActivation.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.moduleActivation.upsert).mockResolvedValue({
        id: 'activation-123',
        cuentaId: 'user-123',
        moduleId: 'whatsapp-business',
        activo: true,
        fechaActivacion: new Date(),
        fechaDesactivacion: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const result = await marketplaceService.activateModule('user-123', 'whatsapp-business');

      expect(result.success).toBe(true);
      expect(result.message).toContain('activado exitosamente');
      expect(result.activation?.active).toBe(true);
      expect(prisma.moduleActivation.upsert).toHaveBeenCalled();
    });

    it('should return error when module not found', async () => {
      const result = await marketplaceService.activateModule('user-123', 'non-existent' as ModuleType);

      expect(result.success).toBe(false);
      expect(result.message).toContain('no encontrado');
    });

    it('should return error when user not found', async () => {
      vi.mocked(prisma.cuenta.findUnique).mockResolvedValue(null);

      const result = await marketplaceService.activateModule('non-existent', 'whatsapp-business');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Usuario no encontrado');
    });

    it('should return error when plan is not compatible', async () => {
      const freeUser = {
        ...mockUser,
        plan: 'FREE' as const,
      };
      vi.mocked(prisma.cuenta.findUnique).mockResolvedValue(freeUser as any);

      const result = await marketplaceService.activateModule('user-123', 'ia-pro');

      expect(result.success).toBe(false);
      expect(result.message).toContain('no permite activar');
    });

    it('should return error when module already activated', async () => {
      vi.mocked(prisma.cuenta.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.moduleActivation.findUnique).mockResolvedValue({
        activo: true,
        fechaActivacion: new Date('2024-01-01'),
      } as any);

      const result = await marketplaceService.activateModule('user-123', 'whatsapp-business');

      expect(result.success).toBe(false);
      expect(result.message).toBe('El módulo ya está activado');
      expect(result.activation?.active).toBe(true);
    });

    it('should create new activation if none exists', async () => {
      vi.mocked(prisma.cuenta.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.moduleActivation.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.moduleActivation.upsert).mockResolvedValue({
        id: 'activation-123',
        cuentaId: 'user-123',
        moduleId: 'whatsapp-business',
        activo: true,
        fechaActivacion: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      await marketplaceService.activateModule('user-123', 'whatsapp-business');

      expect(prisma.moduleActivation.upsert).toHaveBeenCalledWith({
        where: {
          cuentaId_moduleId: {
            cuentaId: 'user-123',
            moduleId: 'whatsapp-business',
          },
        },
        update: expect.any(Object),
        create: expect.objectContaining({
          cuentaId: 'user-123',
          moduleId: 'whatsapp-business',
          activo: true,
        }),
      });
    });
  });

  describe('deactivateModule', () => {
    const mockUser = {
      id: 'user-123',
      plan: 'PREMIUM' as const,
    };

    it('should deactivate module successfully', async () => {
      vi.mocked(prisma.cuenta.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.moduleActivation.findUnique).mockResolvedValue({
        activo: true,
        fechaActivacion: new Date('2024-01-01'),
      } as any);
      vi.mocked(prisma.moduleActivation.update).mockResolvedValue({
        id: 'activation-123',
        cuentaId: 'user-123',
        moduleId: 'whatsapp-business',
        activo: false,
        fechaActivacion: new Date('2024-01-01'),
        fechaDesactivacion: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const result = await marketplaceService.deactivateModule('user-123', 'whatsapp-business');

      expect(result.success).toBe(true);
      expect(result.message).toContain('desactivado exitosamente');
      expect(result.activation?.active).toBe(false);
      expect(prisma.moduleActivation.update).toHaveBeenCalled();
    });

    it('should return error when module not found', async () => {
      const result = await marketplaceService.deactivateModule('user-123', 'non-existent' as ModuleType);

      expect(result.success).toBe(false);
      expect(result.message).toContain('no encontrado');
    });

    it('should return error when module not activated', async () => {
      vi.mocked(prisma.cuenta.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.moduleActivation.findUnique).mockResolvedValue(null);

      const result = await marketplaceService.deactivateModule('user-123', 'whatsapp-business');

      expect(result.success).toBe(false);
      expect(result.message).toBe('El módulo no está activado');
    });

    it('should return error when module already inactive', async () => {
      vi.mocked(prisma.cuenta.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.moduleActivation.findUnique).mockResolvedValue({
        activo: false,
      } as any);

      const result = await marketplaceService.deactivateModule('user-123', 'whatsapp-business');

      expect(result.success).toBe(false);
      expect(result.message).toBe('El módulo no está activado');
    });
  });

  describe('getActiveModules', () => {
    it('should return list of active module IDs', async () => {
      vi.mocked(prisma.moduleActivation.findMany).mockResolvedValue([
        { moduleId: 'whatsapp-business' },
        { moduleId: 'ia-pro' },
      ] as any);

      const activeModules = await marketplaceService.getActiveModules('user-123');

      expect(activeModules).toEqual(['whatsapp-business', 'ia-pro']);
      expect(prisma.moduleActivation.findMany).toHaveBeenCalledWith({
        where: {
          cuentaId: 'user-123',
          activo: true,
        },
        select: {
          moduleId: true,
        },
      });
    });

    it('should return empty array when no active modules', async () => {
      vi.mocked(prisma.moduleActivation.findMany).mockResolvedValue([]);

      const activeModules = await marketplaceService.getActiveModules('user-123');

      expect(activeModules).toEqual([]);
    });
  });

  describe('isModuleActive', () => {
    it('should return true when module is active', async () => {
      vi.mocked(prisma.moduleActivation.findUnique).mockResolvedValue({
        activo: true,
      } as any);

      const isActive = await marketplaceService.isModuleActive('user-123', 'whatsapp-business');

      expect(isActive).toBe(true);
    });

    it('should return false when module is not active', async () => {
      vi.mocked(prisma.moduleActivation.findUnique).mockResolvedValue({
        activo: false,
      } as any);

      const isActive = await marketplaceService.isModuleActive('user-123', 'whatsapp-business');

      expect(isActive).toBe(false);
    });

    it('should return false when no activation record exists', async () => {
      vi.mocked(prisma.moduleActivation.findUnique).mockResolvedValue(null);

      const isActive = await marketplaceService.isModuleActive('user-123', 'whatsapp-business');

      expect(isActive).toBe(false);
    });
  });
});
