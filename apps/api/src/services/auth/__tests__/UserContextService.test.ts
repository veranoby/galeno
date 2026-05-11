// apps/api/src/services/auth/__tests__/UserContextService.test.ts
/**
 * Tests para UserContextService
 *
 * Tests de TDD para verificar:
 * - Carga de usuarios Cuenta
 * - Carga de usuarios Vinculados
 * - Cache con TTL
 * - Configuración de RLS
 * - Invalidación de caché
 * - Manejo de errores
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UserContextService, getUserContextService, resetUserContextService } from '../UserContextService.js';
import type { PrismaClient } from '@prisma/client';

// Mock de Prisma
const mockPrisma = {
  cuenta: {
    findUnique: vi.fn()
  },
  usuarioVinculado: {
    findUnique: vi.fn()
  },
  $executeRaw: vi.fn()
} as unknown as PrismaClient;

// Mock del logger
vi.mock('../../utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('UserContextService', () => {
  let service: UserContextService;

  beforeEach(() => {
    // Resetear mocks y singleton
    vi.clearAllMocks();
    resetUserContextService();
    service = new UserContextService(mockPrisma);
  });

  afterEach(() => {
    resetUserContextService();
  });

  describe('loadUserContext', () => {
    it('should load a Cuenta user successfully', async () => {
      const mockCuenta = {
        id: 'cuenta-123',
        email: 'doctor@galeno.com',
        rol: 'DOCTOR'
      };

      vi.mocked(mockPrisma.cuenta.findUnique).mockResolvedValue(mockCuenta as any);
      vi.mocked(mockPrisma.$executeRaw).mockResolvedValue(1);

      const result = await service.loadUserContext('cuenta-123');

      expect(result.success).toBe(true);
      expect(result.user).toEqual({
        id: 'cuenta-123',
        email: 'doctor@galeno.com',
        rol: 'DOCTOR',
        isActive: true
      });
      expect(mockPrisma.cuenta.findUnique).toHaveBeenCalledWith({
        where: { id: 'cuenta-123' },
        select: {
          id: true,
          email: true,
          rol: true
        }
      });
    });

    it('should load a UsuarioVinculado user successfully', async () => {
      const mockUsuario = {
        id: 'vinculado-123',
        email: 'asistente@galeno.com',
        rol: 'ASISTENTE',
        cuentaId: 'doctor-123',
        doctorAsignadoId: 'doctor-123',
        activo: true
      };

      vi.mocked(mockPrisma.cuenta.findUnique).mockResolvedValue(null);
      vi.mocked(mockPrisma.usuarioVinculado.findUnique).mockResolvedValue(mockUsuario as any);
      vi.mocked(mockPrisma.$executeRaw).mockResolvedValue(1);

      const result = await service.loadUserContext('vinculado-123');

      expect(result.success).toBe(true);
      expect(result.user).toEqual({
        id: 'vinculado-123',
        email: 'asistente@galeno.com',
        rol: 'ASISTENTE',
        cuentaId: 'doctor-123',
        isActive: true
      });
    });

    it('should return error when user not found', async () => {
      vi.mocked(mockPrisma.cuenta.findUnique).mockResolvedValue(null);
      vi.mocked(mockPrisma.usuarioVinculado.findUnique).mockResolvedValue(null);

      const result = await service.loadUserContext('nonexistent-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found or inactive');
      expect(result.user).toBeUndefined();
    });

    it('should return error when Cuenta not found', async () => {
      vi.mocked(mockPrisma.cuenta.findUnique).mockResolvedValue(null);
      vi.mocked(mockPrisma.usuarioVinculado.findUnique).mockResolvedValue(null);

      const result = await service.loadUserContext('cuenta-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found or inactive');
    });

    it('should return error when inactive UsuarioVinculado', async () => {
      const mockUsuario = {
        id: 'vinculado-123',
        email: 'asistente@galeno.com',
        rol: 'ASISTENTE',
        activo: false // Inactive
      };

      vi.mocked(mockPrisma.cuenta.findUnique).mockResolvedValue(null);
      vi.mocked(mockPrisma.usuarioVinculado.findUnique).mockResolvedValue(mockUsuario as any);

      const result = await service.loadUserContext('vinculado-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found or inactive');
    });

    it('should set RLS context after loading user', async () => {
      const mockCuenta = {
        id: 'cuenta-123',
        email: 'doctor@galeno.com',
        rol: 'DOCTOR'
      };

      vi.mocked(mockPrisma.cuenta.findUnique).mockResolvedValue(mockCuenta as any);
      vi.mocked(mockPrisma.$executeRaw).mockResolvedValue(1);

      await service.loadUserContext('cuenta-123');

      expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(2);
    });

    it('should handle database errors gracefully', async () => {
      vi.mocked(mockPrisma.cuenta.findUnique).mockRejectedValue(new Error('DB Error'));

      const result = await service.loadUserContext('cuenta-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to load user context');
    });
  });

  describe('Cache', () => {
    it('should cache user context after first load', async () => {
      const mockCuenta = {
        id: 'cuenta-123',
        email: 'doctor@galeno.com',
        rol: 'DOCTOR'
      };

      vi.mocked(mockPrisma.cuenta.findUnique).mockResolvedValue(mockCuenta as any);
      vi.mocked(mockPrisma.$executeRaw).mockResolvedValue(1);

      // First call - loads from DB
      await service.loadUserContext('cuenta-123');
      expect(mockPrisma.cuenta.findUnique).toHaveBeenCalledTimes(1);

      // Second call - loads from cache
      await service.loadUserContext('cuenta-123');
      expect(mockPrisma.cuenta.findUnique).toHaveBeenCalledTimes(1); // Still 1
    });

    it('should invalidate cache for specific user', async () => {
      const mockCuenta = {
        id: 'cuenta-123',
        email: 'doctor@galeno.com',
        rol: 'DOCTOR'
      };

      vi.mocked(mockPrisma.cuenta.findUnique).mockResolvedValue(mockCuenta as any);
      vi.mocked(mockPrisma.$executeRaw).mockResolvedValue(1);

      // Load and cache
      await service.loadUserContext('cuenta-123');
      expect(mockPrisma.cuenta.findUnique).toHaveBeenCalledTimes(1);

      // Invalidate cache
      service.invalidateCache('cuenta-123');

      // Load again - should hit DB
      await service.loadUserContext('cuenta-123');
      expect(mockPrisma.cuenta.findUnique).toHaveBeenCalledTimes(2);
    });

    it('should clear all cache', async () => {
      const mockCuenta = {
        id: 'cuenta-123',
        email: 'doctor@galeno.com',
        rol: 'DOCTOR'
      };

      vi.mocked(mockPrisma.cuenta.findUnique).mockResolvedValue(mockCuenta as any);
      vi.mocked(mockPrisma.$executeRaw).mockResolvedValue(1);

      // Load multiple users
      await service.loadUserContext('cuenta-123');
      await service.loadUserContext('cuenta-456');
      expect(mockPrisma.cuenta.findUnique).toHaveBeenCalledTimes(2);

      // Clear all cache
      service.clearCache();

      // Load again - should hit DB
      await service.loadUserContext('cuenta-123');
      expect(mockPrisma.cuenta.findUnique).toHaveBeenCalledTimes(3);
    });

    it('should respect cache TTL', async () => {
      const mockCuenta = {
        id: 'cuenta-123',
        email: 'doctor@galeno.com',
        rol: 'DOCTOR'
      };

      vi.mocked(mockPrisma.cuenta.findUnique).mockResolvedValue(mockCuenta as any);
      vi.mocked(mockPrisma.$executeRaw).mockResolvedValue(1);

      // Create service with very short TTL for testing
      const shortCacheService = new UserContextService(mockPrisma);
      // Override TTL by accessing private cache and setting expired entry
      (shortCacheService as any).cache.set('cuenta-123', {
        user: mockCuenta,
        expiresAt: Date.now() - 1000 // Expired 1ms ago
      });

      await shortCacheService.loadUserContext('cuenta-123');
      expect(mockPrisma.cuenta.findUnique).toHaveBeenCalledTimes(1);
    });
  });

  describe('Helper methods', () => {
    it('hasRole should return true for matching role', async () => {
      const mockCuenta = {
        id: 'cuenta-123',
        email: 'doctor@galeno.com',
        rol: 'DOCTOR'
      };

      vi.mocked(mockPrisma.cuenta.findUnique).mockResolvedValue(mockCuenta as any);
      vi.mocked(mockPrisma.$executeRaw).mockResolvedValue(1);

      const hasRole = await service.hasRole('cuenta-123', 'DOCTOR');
      expect(hasRole).toBe(true);
    });

    it('hasRole should return false for non-matching role', async () => {
      const mockCuenta = {
        id: 'cuenta-123',
        email: 'doctor@galeno.com',
        rol: 'DOCTOR'
      };

      vi.mocked(mockPrisma.cuenta.findUnique).mockResolvedValue(mockCuenta as any);
      vi.mocked(mockPrisma.$executeRaw).mockResolvedValue(1);

      const hasRole = await service.hasRole('cuenta-123', 'ADMIN');
      expect(hasRole).toBe(false);
    });

    it('hasRole should return false for non-existent user', async () => {
      vi.mocked(mockPrisma.cuenta.findUnique).mockResolvedValue(null);
      vi.mocked(mockPrisma.usuarioVinculado.findUnique).mockResolvedValue(null);

      const hasRole = await service.hasRole('nonexistent', 'DOCTOR');
      expect(hasRole).toBe(false);
    });

    it('isActiveUser should return true for active user', async () => {
      const mockCuenta = {
        id: 'cuenta-123',
        email: 'doctor@galeno.com',
        rol: 'DOCTOR'
      };

      vi.mocked(mockPrisma.cuenta.findUnique).mockResolvedValue(mockCuenta as any);
      vi.mocked(mockPrisma.$executeRaw).mockResolvedValue(1);

      const isActive = await service.isActiveUser('cuenta-123');
      expect(isActive).toBe(true);
    });

    it('isActiveUser should return false for inactive user', async () => {
      vi.mocked(mockPrisma.cuenta.findUnique).mockResolvedValue(null);
      vi.mocked(mockPrisma.usuarioVinculado.findUnique).mockResolvedValue(null);

      const isActive = await service.isActiveUser('nonexistent');
      expect(isActive).toBe(false);
    });

    it('getCuentaId should return cuentaId for UsuarioVinculado', async () => {
      const mockUsuario = {
        id: 'vinculado-123',
        email: 'asistente@galeno.com',
        rol: 'ASISTENTE',
        doctorAsignadoId: 'doctor-123',
        activo: true
      };

      vi.mocked(mockPrisma.cuenta.findUnique).mockResolvedValue(null);
      vi.mocked(mockPrisma.usuarioVinculado.findUnique).mockResolvedValue(mockUsuario as any);
      vi.mocked(mockPrisma.$executeRaw).mockResolvedValue(1);

      const cuentaId = await service.getCuentaId('vinculado-123');
      expect(cuentaId).toBe('doctor-123');
    });

    it('getCuentaId should return user id for Cuenta', async () => {
      const mockCuenta = {
        id: 'cuenta-123',
        email: 'doctor@galeno.com',
        rol: 'DOCTOR'
      };

      vi.mocked(mockPrisma.cuenta.findUnique).mockResolvedValue(mockCuenta as any);
      vi.mocked(mockPrisma.$executeRaw).mockResolvedValue(1);

      const cuentaId = await service.getCuentaId('cuenta-123');
      expect(cuentaId).toBe('cuenta-123');
    });
  });

  describe('Singleton', () => {
    it('should return same instance on subsequent calls', () => {
      const instance1 = getUserContextService(mockPrisma);
      const instance2 = getUserContextService();

      expect(instance1).toBe(instance2);
    });

    it('should throw error on first call without prisma', () => {
      resetUserContextService();
      expect(() => getUserContextService()).toThrow('UserContextService requires PrismaClient');
    });

    it('should create new instance after reset', () => {
      const instance1 = getUserContextService(mockPrisma);
      resetUserContextService();
      const instance2 = getUserContextService(mockPrisma);

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('RLS context setting', () => {
    it('should not fail request if RLS setting fails', async () => {
      const mockCuenta = {
        id: 'cuenta-123',
        email: 'doctor@galeno.com',
        rol: 'DOCTOR',
        activa: true
      };

      vi.mocked(mockPrisma.cuenta.findUnique).mockResolvedValue(mockCuenta as any);
      vi.mocked(mockPrisma.$executeRaw).mockRejectedValue(new Error('RLS Error'));

      const result = await service.loadUserContext('cuenta-123');

      // Should still succeed even if RLS fails
      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
    });
  });
});
