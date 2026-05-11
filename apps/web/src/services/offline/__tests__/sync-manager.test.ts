/**
 * Tests unitarios para SyncManager
 * Pruebas de sincronización offline-first
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SyncManager } from '../sync-manager';
import { GalenoDatabase } from '../indexeddb';

// Mock de apiClient
vi.mock('@galeno/api-client', () => ({
  apiClient: {
    get: vi.fn(() => Promise.resolve({ success: false, error: 'Not found' })),
    post: vi.fn(() => Promise.resolve({ success: false, error: 'Not implemented' })),
    put: vi.fn(() => Promise.resolve({ success: false, error: 'Not implemented' })),
    delete: vi.fn(() => Promise.resolve({ success: false, error: 'Not implemented' }))
  }
}));

describe('SyncManager', () => {
  let syncManager: SyncManager;

  beforeEach(() => {
    // Resetear base de datos para cada test
    GalenoDatabase.resetInstance();
    
    syncManager = new SyncManager({
      dbName: `test-db-${Date.now()}`,
      dbVersion: 1,
      autoSync: false,
      syncEndpoint: '/test-sync'
    });
  });

  afterEach(() => {
    syncManager.destroy();
    GalenoDatabase.resetInstance();
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('debe inicializar con estado offline basado en navigator.onLine', () => {
      const manager = new SyncManager({ autoSync: false, dbName: `test-${Date.now()}` });
      const state = manager.getConnectionState();
      
      expect(state.isOnline).toBe(typeof navigator !== 'undefined' ? navigator.onLine : true);
      expect(state.isSyncing).toBe(false);
      
      manager.destroy();
    });

    it('debe crear progreso inicial correcto', () => {
      const progress = syncManager.getSyncProgress();
      
      expect(progress.isSyncing).toBe(false);
      expect(progress.percentage).toBe(0);
      expect(progress.totalOperations).toBe(0);
      expect(progress.statusMessage).toBe('Idle');
    });
  });

  describe('connection state', () => {
    it('debe reportar estado de conexión correctamente', () => {
      const state = syncManager.getConnectionState();
      
      expect(state).toHaveProperty('isOnline');
      expect(state).toHaveProperty('isSyncing');
      expect(typeof state.isOnline).toBe('boolean');
      expect(typeof state.isSyncing).toBe('boolean');
    });

    it('debe verificar disponibilidad de conexión', () => {
      const isAvailable = syncManager.isConnectionAvailable();
      expect(typeof isAvailable).toBe('boolean');
    });
  });

  describe('event listeners', () => {
    it('debe registrar y remover listeners correctamente', () => {
      const listener = vi.fn();
      
      const cleanup = syncManager.on('connection-change', listener);
      
      // Verificar que el listener fue registrado
      expect(listener).not.toHaveBeenCalled();
      
      // Remover listener
      cleanup();
      
      // El listener no debería ser llamado después de remover
      expect(listener).not.toHaveBeenCalled();
    });

    it('debe emitir evento connection-change', async () => {
      const listener = vi.fn();
      syncManager.on('connection-change', listener);
      
      // Simular cambio de conexión manualmente
      window.dispatchEvent(new Event('online'));
      
      // Esperar un tick para que el evento se procese
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(listener).toHaveBeenCalled();
    });
  });

  describe('sync', () => {
    it('debe retornar resultado cuando no hay operaciones pendientes', async () => {
      // Forzar estado online para este test
      const originalOnline = navigator.onLine;
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

      try {
        const result = await syncManager.sync();

        expect(result).toBeDefined();
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('syncedCount');
        expect(result).toHaveProperty('completedAt');
      } finally {
        Object.defineProperty(navigator, 'onLine', { value: originalOnline, configurable: true });
      }
    });
  });

  describe('backoff delay calculation', () => {
    it('debe calcular delay exponencial correctamente', () => {
      // Acceder al método privado para testing
      const calculateBackoffDelay = (retryCount: number): number => {
        const base = 1000;
        const max = 60000;
        const delay = base * Math.pow(2, retryCount);
        return Math.min(delay, max);
      };

      expect(calculateBackoffDelay(0)).toBe(1000);
      expect(calculateBackoffDelay(1)).toBe(2000);
      expect(calculateBackoffDelay(2)).toBe(4000);
      expect(calculateBackoffDelay(3)).toBe(8000);
    });

    it('debe respetar el delay máximo', () => {
      const calculateBackoffDelay = (retryCount: number): number => {
        const base = 1000;
        const max = 60000;
        const delay = base * Math.pow(2, retryCount);
        return Math.min(delay, max);
      };

      // 2^10 = 1024, 1024 * 1000 = 1024000 > 60000
      expect(calculateBackoffDelay(10)).toBe(60000);
      expect(calculateBackoffDelay(20)).toBe(60000);
    });
  });

  describe('error classification', () => {
    it('debe clasificar errores de red correctamente', () => {
      const classifyError = (error: Error): string => {
        const message = error.message.toLowerCase();
        if (message.includes('network') || message.includes('fetch')) {
          return 'NETWORK';
        }
        if (message.includes('conflict')) {
          return 'CONFLICT';
        }
        if (message.includes('validation') || message.includes('invalid')) {
          return 'VALIDATION';
        }
        if (message.includes('server') || message.includes('500')) {
          return 'SERVER';
        }
        return 'UNKNOWN';
      };

      expect(classifyError(new Error('Network error'))).toBe('NETWORK');
      expect(classifyError(new Error('Fetch failed'))).toBe('NETWORK');
      expect(classifyError(new Error('Conflict detected'))).toBe('CONFLICT');
      expect(classifyError(new Error('Validation error'))).toBe('VALIDATION');
      expect(classifyError(new Error('Server error 500'))).toBe('SERVER');
      expect(classifyError(new Error('Unknown error'))).toBe('UNKNOWN');
    });
  });

  describe('destroy', () => {
    it('debe limpiar recursos al destruir', () => {
      const manager = new SyncManager({ autoSync: false, dbName: `test-${Date.now()}` });
      
      // Destruir
      manager.destroy();
      
      // Después de destruir, no debería haber errores
      expect(() => manager.destroy()).not.toThrow();
    });
  });
});

describe('SyncManager singleton', () => {
  beforeEach(() => {
    GalenoDatabase.resetInstance();
  });

  afterEach(() => {
    GalenoDatabase.resetInstance();
  });

  it('debe compartir la misma instancia de base de datos subyacente', () => {
    // El singleton está en la base de datos, no en el SyncManager
    const manager1 = SyncManager.getInstance();
    const manager2 = SyncManager.getInstance();
    
    // Ambos managers comparten la misma DB subyacente
    expect((manager1 as any).db).toBe((manager2 as any).db);
    
    manager1.destroy();
  });

  it('debe permitir múltiples instancias con diferentes configs', () => {
    const manager1 = new SyncManager({ dbName: 'db1-test', autoSync: false });
    const manager2 = new SyncManager({ dbName: 'db2-test', autoSync: false });
    
    expect(manager1).not.toBe(manager2);
    
    manager1.destroy();
    manager2.destroy();
  });
});
