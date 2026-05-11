/**
 * Tests unitarios para LWWStrategy
 * Pruebas de resolución de conflictos Last Write Wins
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LWWStrategy } from '../lww-strategy';
import type { OfflineEntity } from '../types';

/**
 * Entidad de prueba para tests
 */
interface TestEntity extends OfflineEntity {
  nombre: string;
  apellido: string;
  email: string;
  edad?: number;
}

/**
 * Crea una entidad de prueba con valores por defecto
 */
function createTestEntity(overrides: Partial<TestEntity> = {}): TestEntity {
  const now = Date.now();
  return {
    id: 'test-1',
    createdAt: now - 10000,
    lastModified: now,
    syncedAt: now - 5000,
    version: 1,
    syncStatus: 'SYNCED',
    nombre: 'Juan',
    apellido: 'Pérez',
    email: 'juan@example.com',
    ...overrides
  };
}

describe('LWWStrategy', () => {
  describe('compareVersions', () => {
    it('debe detectar que la versión local es más reciente', () => {
      const local = createTestEntity({ lastModified: 1000, syncStatus: 'SYNCED' });
      const server = createTestEntity({ lastModified: 500, syncStatus: 'SYNCED' });

      const result = LWWStrategy.compareVersions(local, server);

      expect(result.newerVersion).toBe('local');
      expect(result.timeDifference).toBe(500);
    });

    it('debe detectar que la versión del servidor es más reciente', () => {
      const local = createTestEntity({ lastModified: 500, syncStatus: 'SYNCED' });
      const server = createTestEntity({ lastModified: 1000, syncStatus: 'SYNCED' });

      const result = LWWStrategy.compareVersions(local, server);

      expect(result.newerVersion).toBe('server');
      expect(result.timeDifference).toBe(-500);
    });

    it('debe detectar campos diferentes entre versiones', () => {
      const local = createTestEntity({ nombre: 'Juan', edad: 30 });
      const server = createTestEntity({ nombre: 'Carlos', edad: 35 });

      const result = LWWStrategy.compareVersions(local, server);

      expect(result.differentFields).toContain('nombre');
      expect(result.differentFields).toContain('edad');
      expect(result.differentFields).not.toContain('id');
    });

    it('debe ignorar metadatos de sincronización en la comparación', () => {
      const local = createTestEntity({ version: 5, syncStatus: 'PENDING' });
      const server = createTestEntity({ version: 3, syncStatus: 'SYNCED' });

      const result = LWWStrategy.compareVersions(local, server);

      expect(result.differentFields).not.toContain('version');
      expect(result.differentFields).not.toContain('syncStatus');
    });

    it('debe usar versión cuando los timestamps son iguales', () => {
      const local = createTestEntity({ lastModified: 1000, version: 5 });
      const server = createTestEntity({ lastModified: 1000, version: 3 });

      const result = LWWStrategy.compareVersions(local, server);

      expect(result.newerVersion).toBe('local');
      expect(result.versionDifference).toBe(2);
    });
  });

  describe('getDifferentFields', () => {
    it('debe retornar array vacío cuando las entidades son iguales', () => {
      const entity1 = createTestEntity();
      const entity2 = createTestEntity();

      const result = LWWStrategy.getDifferentFields(entity1, entity2);

      expect(result).toEqual([]);
    });

    it('debe detectar todos los campos diferentes', () => {
      const local = createTestEntity({
        nombre: 'Juan',
        apellido: 'Pérez',
        email: 'juan@example.com'
      });
      const server = createTestEntity({
        nombre: 'Carlos',
        apellido: 'Gómez',
        email: 'carlos@example.com'
      });

      const result = LWWStrategy.getDifferentFields(local, server);

      expect(result).toContain('nombre');
      expect(result).toContain('apellido');
      expect(result).toContain('email');
    });

    it('debe manejar valores null correctamente', () => {
      const local = createTestEntity({ edad: 30 });
      const server = createTestEntity({ edad: undefined });

      const result = LWWStrategy.getDifferentFields(local, server);

      expect(result).toContain('edad');
    });
  });

  describe('resolve', () => {
    it('debe retornar sin conflicto cuando no hay diferencias', () => {
      const local = createTestEntity();
      const server = createTestEntity();

      const result = LWWStrategy.resolve(local, server);

      expect(result.hasConflict).toBe(false);
      expect(result.resolved.id).toBe(local.id);
      expect(result.serverVersionUsed).toBe(false);
    });

    it('debe usar la versión del servidor cuando es más reciente', () => {
      const local = createTestEntity({
        lastModified: 500,
        nombre: 'Juan',
        syncStatus: 'SYNCED'
      });
      const server = createTestEntity({
        lastModified: 1000,
        nombre: 'Carlos',
        syncStatus: 'SYNCED'
      });

      const result = LWWStrategy.resolve(local, server);

      expect(result.hasConflict).toBe(true);
      expect(result.serverVersionUsed).toBe(true);
      expect(result.resolved.nombre).toBe('Carlos');
    });

    it('debe usar la versión local cuando es más reciente', () => {
      const local = createTestEntity({
        lastModified: 1000,
        nombre: 'Juan',
        syncStatus: 'SYNCED'
      });
      const server = createTestEntity({
        lastModified: 500,
        nombre: 'Carlos',
        syncStatus: 'SYNCED'
      });

      const result = LWWStrategy.resolve(local, server);

      expect(result.hasConflict).toBe(true);
      expect(result.serverVersionUsed).toBe(false);
      expect(result.resolved.nombre).toBe('Juan');
    });

    it('debe actualizar metadatos después de resolver', () => {
      const local = createTestEntity({ lastModified: 500, version: 2 });
      const server = createTestEntity({ lastModified: 1000, version: 3 });

      const result = LWWStrategy.resolve(local, server);

      expect(result.resolved.syncStatus).toBe('SYNCED');
      expect(result.resolved.syncedAt).toBeDefined();
      expect(result.resolved.version).toBeGreaterThan(Math.max(2, 3));
      expect(result.resolved.lastModified).toBeGreaterThanOrEqual(1000);
    });

    it('debe preservar campos no conflictivos', () => {
      const local = createTestEntity({
        lastModified: 1000,
        nombre: 'Juan',
        apellido: 'Pérez',
        edad: 30
      });
      const server = createTestEntity({
        lastModified: 500,
        nombre: 'Carlos',
        apellido: 'Pérez',
        edad: 30
      });

      const result = LWWStrategy.resolve(local, server);

      expect(result.resolved.nombre).toBe('Juan');
      expect(result.resolved.apellido).toBe('Pérez');
      expect(result.resolved.edad).toBe(30);
    });
  });

  describe('mergeFieldByField', () => {
    it('debe fusionar campos individualmente basado en timestamps', () => {
      const local = createTestEntity({
        lastModified: 1000,
        nombre: 'Juan',
        apellido: 'Pérez'
      });
      const server = createTestEntity({
        lastModified: 500,
        nombre: 'Carlos',
        apellido: 'Gómez'
      });

      const result = LWWStrategy.mergeFieldByField(local, server);

      // Como local es más reciente, debería ganar en todos los campos
      expect(result.nombre).toBe('Juan');
      expect(result.apellido).toBe('Pérez');
    });

    it('debe actualizar metadatos después del merge', () => {
      const local = createTestEntity();
      const server = createTestEntity();

      const result = LWWStrategy.mergeFieldByField(local, server);

      expect(result.syncStatus).toBe('SYNCED');
      expect(result.syncedAt).toBeDefined();
      expect(result.version).toBeGreaterThan(local.version);
    });
  });

  describe('hasPotentialConflict', () => {
    it('debe retornar false cuando no hay entidad del servidor', () => {
      const local = createTestEntity();

      const result = LWWStrategy.hasPotentialConflict(local, null);

      expect(result).toBe(false);
    });

    it('debe detectar conflicto cuando ambos fueron modificados', () => {
      const now = Date.now();
      const local = createTestEntity({
        lastModified: now,
        syncedAt: now - 10000,
        syncStatus: 'PENDING'
      });
      const server = createTestEntity({
        lastModified: now,
        syncedAt: now - 10000
      });

      const result = LWWStrategy.hasPotentialConflict(local, server);

      expect(result).toBe(true);
    });

    it('debe retornar false cuando solo el local fue modificado', () => {
      const now = Date.now();
      const local = createTestEntity({
        lastModified: now,
        syncedAt: now - 1000
      });
      const server = createTestEntity({
        lastModified: now - 5000,
        syncedAt: now - 1000
      });

      const result = LWWStrategy.hasPotentialConflict(local, server);

      expect(result).toBe(false);
    });
  });

  describe('prepareForSync', () => {
    it('debe preparar entidad para CREATE', () => {
      const entity = createTestEntity({ syncStatus: 'SYNCED' });

      const result = LWWStrategy.prepareForSync(entity, false);

      expect(result.syncStatus).toBe('PENDING');
      expect(result.version).toBe(1);
      expect(result.createdAt).toBeDefined();
      expect(result.lastModified).toBeDefined();
    });

    it('debe preparar entidad para UPDATE', () => {
      const entity = createTestEntity({ version: 5, syncStatus: 'SYNCED', lastModified: 100 });

      const result = LWWStrategy.prepareForSync(entity, true);

      expect(result.syncStatus).toBe('PENDING');
      expect(result.version).toBe(6);
      expect(result.lastModified).toBeGreaterThan(100);
    });
  });

  describe('applyServerResponse', () => {
    it('debe aplicar respuesta del servidor a entidad local', () => {
      const local = createTestEntity({
        id: 'temp-123',
        tempId: 'temp-123',
        syncStatus: 'PENDING'
      });
      const serverData = {
        id: 'server-456',
        version: 10,
        nombre: 'Juan Actualizado'
      };

      const result = LWWStrategy.applyServerResponse(local, serverData);

      expect(result.id).toBe('server-456');
      expect(result.tempId).toBeUndefined();
      expect(result.syncStatus).toBe('SYNCED');
      expect(result.syncedAt).toBeDefined();
      expect(result.nombre).toBe('Juan Actualizado');
    });

    it('debe mantener tempId si el servidor no devuelve ID real', () => {
      const local = createTestEntity({
        id: 'temp-123',
        tempId: 'temp-123'
      });
      const serverData = {
        id: 'temp-123',
        version: 2
      };

      const result = LWWStrategy.applyServerResponse(local, serverData);

      // El tempId se mantiene porque el ID del servidor es igual al tempId
      expect(result.id).toBe('temp-123');
    });
  });
});
