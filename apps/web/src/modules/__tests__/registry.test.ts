// apps/web/src/modules/__tests__/registry.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { moduleRegistry, registerModule, registerAsyncModule } from '../registry';
import type { ModuleConfig, SpecialtyModuleType } from '@/types/module';

describe('ModuleRegistry', () => {
  let testModuleConfig: ModuleConfig;

  beforeEach(() => {
    // Limpiar el registro antes de cada test
    moduleRegistry.clear();

    // Configuración de módulo de prueba
    testModuleConfig = {
      id: 'test-module',
      name: 'Test Module',
      description: 'A test module',
      specialty: 'general' as SpecialtyModuleType,
      kind: 'form',
      version: '1.0.0',
    };
  });

  describe('register', () => {
    it('debería registrar un módulo correctamente', () => {
      const component = { template: '<div>Test</div>' };
      moduleRegistry.register(testModuleConfig, component);

      expect(moduleRegistry.hasModule('test-module')).toBe(true);
    });

    it('debería indexar módulos por especialidad', () => {
      const component = { template: '<div>Test</div>' };
      moduleRegistry.register(testModuleConfig, component);

      const modules = moduleRegistry.getModulesBySpecialty('general');
      expect(modules).toHaveLength(1);
      expect(modules[0].config.id).toBe('test-module');
    });

    it('debería permitir registrar múltiples módulos', () => {
      const component = { template: '<div>Test</div>' };

      moduleRegistry.register({
        ...testModuleConfig,
        id: 'module-1',
        name: 'Module 1',
      }, component);

      moduleRegistry.register({
        ...testModuleConfig,
        id: 'module-2',
        name: 'Module 2',
      }, component);

      expect(moduleRegistry.getAllModules()).toHaveLength(2);
    });
  });

  describe('getModule', () => {
    it('debería obtener un módulo por su ID', () => {
      const component = { template: '<div>Test</div>' };
      moduleRegistry.register(testModuleConfig, component);

      const module = moduleRegistry.getModule('test-module');

      expect(module).toBeDefined();
      expect(module?.config.id).toBe('test-module');
    });

    it('debería retornar undefined para módulos no existentes', () => {
      const module = moduleRegistry.getModule('non-existent');

      expect(module).toBeUndefined();
    });
  });

  describe('getModulesBySpecialty', () => {
    beforeEach(() => {
      const component = { template: '<div>Test</div>' };

      moduleRegistry.register({
        ...testModuleConfig,
        id: 'odonto-1',
        specialty: 'odontologia',
      }, component);

      moduleRegistry.register({
        ...testModuleConfig,
        id: 'odonto-2',
        specialty: 'odontologia',
      }, component);

      moduleRegistry.register({
        ...testModuleConfig,
        id: 'pedia-1',
        specialty: 'pediatria',
      }, component);
    });

    it('debería obtener módulos de una especialidad específica', () => {
      const odontoModules = moduleRegistry.getModulesBySpecialty('odontologia');

      expect(odontoModules).toHaveLength(2);
      expect(odontoModules.every(m => m.config.specialty === 'odontologia')).toBe(true);
    });

    it('debería retornar array vacío para especialidades sin módulos', () => {
      const dermaModules = moduleRegistry.getModulesBySpecialty('dermatologia');

      expect(dermaModules).toHaveLength(0);
    });
  });

  describe('unregister', () => {
    it('debería desregistrar un módulo', () => {
      const component = { template: '<div>Test</div>' };
      moduleRegistry.register(testModuleConfig, component);

      const unregistered = moduleRegistry.unregister('test-module');

      expect(unregistered).toBe(true);
      expect(moduleRegistry.hasModule('test-module')).toBe(false);
    });

    it('debería retornar false al desregistrar un módulo inexistente', () => {
      const unregistered = moduleRegistry.unregister('non-existent');

      expect(unregistered).toBe(false);
    });

    it('debería remover el módulo del índice de especialidades', () => {
      const component = { template: '<div>Test</div>' };
      moduleRegistry.register(testModuleConfig, component);

      moduleRegistry.unregister('test-module');

      const modules = moduleRegistry.getModulesBySpecialty('general');
      expect(modules).toHaveLength(0);
    });
  });

  describe('getConfig', () => {
    it('debería obtener la configuración de un módulo', () => {
      const component = { template: '<div>Test</div>' };
      moduleRegistry.register(testModuleConfig, component);

      const config = moduleRegistry.getConfig('test-module');

      expect(config).toEqual(testModuleConfig);
    });

    it('debería retornar undefined para módulos no existentes', () => {
      const config = moduleRegistry.getConfig('non-existent');

      expect(config).toBeUndefined();
    });
  });

  describe('getStats', () => {
    beforeEach(() => {
      const component = { template: '<div>Test</div>' };

      moduleRegistry.register({
        ...testModuleConfig,
        id: 'odonto-1',
        specialty: 'odontologia',
      }, component);

      moduleRegistry.register({
        ...testModuleConfig,
        id: 'odonto-2',
        specialty: 'odontologia',
      }, component);

      moduleRegistry.register({
        ...testModuleConfig,
        id: 'pedia-1',
        specialty: 'pediatria',
      }, component);
    });

    it('debería calcular estadísticas correctamente', () => {
      const stats = moduleRegistry.getStats();

      expect(stats.totalModules).toBe(3);
      expect(stats.bySpecialty.odontologia).toBe(2);
      expect(stats.bySpecialty.pediatria).toBe(1);
    });
  });

  describe('registerAsyncModule', () => {
    it('debería registrar un módulo asíncrono', () => {
      const loader = () => Promise.resolve({ default: { template: '<div>Async</div>' } });

      registerAsyncModule({
        ...testModuleConfig,
        id: 'async-module',
      }, loader);

      expect(moduleRegistry.hasModule('async-module')).toBe(true);
    });
  });
});
