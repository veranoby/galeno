// apps/api/src/services/module/__tests__/module.service.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock del logger para evitar dependencias
vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Importar después del mock
import { moduleService } from '../module.service';

describe('ModuleService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAllModules', () => {
    it('debería retornar todos los módulos disponibles', async () => {
      const modules = await moduleService.getAllModules();

      expect(modules).toBeInstanceOf(Array);
      expect(modules.length).toBeGreaterThan(0);
      expect(modules.every(m => m.enabled)).toBe(true);
    });

    it('debería incluir el módulo de odontograma', async () => {
      const modules = await moduleService.getAllModules();
      const odontograma = modules.find(m => m.id === 'odontograma');

      expect(odontograma).toBeDefined();
      expect(odontograma?.name).toBe('Odontograma');
      expect(odontograma?.specialty).toBe('odontologia');
    });

    it('debería incluir el módulo de retina atlas', async () => {
      const modules = await moduleService.getAllModules();
      const retina = modules.find(m => m.id === 'retina-atlas');

      expect(retina).toBeDefined();
      expect(retina?.name).toBe('Retina Atlas');
      expect(retina?.specialty).toBe('oftalmologia');
    });

    it('debería incluir el módulo de curvas de crecimiento', async () => {
      const modules = await moduleService.getAllModules();
      const crecimiento = modules.find(m => m.id === 'curvas-crecimiento');

      expect(crecimiento).toBeDefined();
      expect(crecimiento?.name).toBe('Curvas de Crecimiento');
      expect(crecimiento?.specialty).toBe('pediatria');
    });
  });

  describe('getModulesBySpecialty', () => {
    it('debería retornar módulos de odontología', async () => {
      const modules = await moduleService.getModulesBySpecialty('odontologia');

      expect(modules.length).toBeGreaterThan(0);
      expect(modules.every(m => m.specialty === 'odontologia')).toBe(true);
    });

    it('debería retornar módulos de pediatría', async () => {
      const modules = await moduleService.getModulesBySpecialty('pediatria');

      expect(modules.length).toBeGreaterThan(0);
      expect(modules.every(m => m.specialty === 'pediatria')).toBe(true);
    });

    it('debería retornar módulos de oftalmología', async () => {
      const modules = await moduleService.getModulesBySpecialty('oftalmologia');

      expect(modules.length).toBeGreaterThan(0);
      expect(modules.every(m => m.specialty === 'oftalmologia')).toBe(true);
    });

    it('debería retornar array vacío para especialidades sin módulos', async () => {
      const modules = await moduleService.getModulesBySpecialty('traumatologia');

      expect(modules).toHaveLength(0);
    });
  });

  describe('getModuleById', () => {
    it('debería encontrar el módulo de odontograma por ID', async () => {
      const module = await moduleService.getModuleById('odontograma');

      expect(module).toBeDefined();
      expect(module?.id).toBe('odontograma');
      expect(module?.enabled).toBe(true);
    });

    it('debería retornar null para módulos inexistentes', async () => {
      const module = await moduleService.getModuleById('non-existent');

      expect(module).toBeNull();
    });
  });

  describe('saveModuleData', () => {
    it('debería guardar datos de odontograma', async () => {
      const data = {
        moduleId: 'odontograma',
        pacienteId: 'patient-123',
        datos: {
          odontograma: {
            dientes: {
              '11': { id: '11', cuadrante: 1, posicion: 1, tipo: 'incisivo', extra: false, seleccionado: false, caras: {}, estado: 'sano' },
            },
          },
        },
      };

      const result = await moduleService.saveModuleData(data);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.moduleId).toBe('odontograma');
      expect(result.pacienteId).toBe('patient-123');
    });

    it('debería asignar fechas de creación y actualización', async () => {
      const data = {
        moduleId: 'odontograma',
        pacienteId: 'patient-123',
        datos: {},
      };

      const result = await moduleService.saveModuleData(data);

      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('debería aceptar consultaId opcional', async () => {
      const data = {
        moduleId: 'odontograma',
        pacienteId: 'patient-123',
        consultaId: 'consulta-456',
        datos: {},
      };

      const result = await moduleService.saveModuleData(data);

      expect(result.consultaId).toBe('consulta-456');
    });
  });

  describe('validateModuleData', () => {
    describe('validación de odontograma', () => {
      it('debería validar datos correctos de odontograma', () => {
        const data = {
          odontograma: {
            dientes: {
              '11': { estado: 'sano' },
              '12': { estado: 'caries' },
            },
          },
        };

        const isValid = moduleService.validateModuleData('odontograma', data);

        expect(isValid).toBe(true);
      });

      it('debería rechazar odontograma sin dientes', () => {
        const data = {
          odontograma: {},
        };

        const isValid = moduleService.validateModuleData('odontograma', data);

        expect(isValid).toBe(false);
      });

      it('debería rechazar dientes sin estado', () => {
        const data = {
          odontograma: {
            dientes: {
              '11': {},
            },
          },
        };

        const isValid = moduleService.validateModuleData('odontograma', data);

        expect(isValid).toBe(false);
      });
    });

    describe('validación de retina atlas', () => {
      it('debería validar datos correctos de retina', () => {
        const data = {
          imagenes: [
            { id: 'img-1', tipo: 'color_fondo', ojo: 'derecho', url: 'http://example.com/img.jpg' },
          ],
        };

        const isValid = moduleService.validateModuleData('retina-atlas', data);

        expect(isValid).toBe(true);
      });

      it('debería rechazar datos sin imagenes', () => {
        const data = {};

        const isValid = moduleService.validateModuleData('retina-atlas', data);

        expect(isValid).toBe(false);
      });

      it('debería rechazar imagen sin campos requeridos', () => {
        const data = {
          imagenes: [
            { id: 'img-1' },
          ],
        };

        const isValid = moduleService.validateModuleData('retina-atlas', data);

        expect(isValid).toBe(false);
      });
    });

    describe('validación de curvas de crecimiento', () => {
      it('debería validar datos correctos de crecimiento', () => {
        const data = {
          sexo: 'masculino',
          mediciones: [
            { tipo: 'peso_edad', valor: 8.5, edadMeses: 12 },
          ],
        };

        const isValid = moduleService.validateModuleData('curvas-crecimiento', data);

        expect(isValid).toBe(true);
      });

      it('debería rechazar datos sin sexo', () => {
        const data = {
          mediciones: [
            { tipo: 'peso_edad', valor: 8.5, edadMeses: 12 },
          ],
        };

        const isValid = moduleService.validateModuleData('curvas-crecimiento', data);

        expect(isValid).toBe(false);
      });

      it('debería rechazar sexo inválido', () => {
        const data = {
          sexo: 'otro',
          mediciones: [],
        };

        const isValid = moduleService.validateModuleData('curvas-crecimiento', data);

        expect(isValid).toBe(false);
      });
    });

    it('debería lanzar error para módulo inexistente', () => {
      const data = {};

      expect(() => {
        moduleService.validateModuleData('non-existent', data);
      }).toThrow('Module not found: non-existent');
    });
  });

  describe('deleteModuleData', () => {
    it('debería eliminar datos de módulo', async () => {
      const deleted = await moduleService.deleteModuleData('mod-123');

      expect(deleted).toBe(true);
    });
  });

  describe('listPatientModuleData', () => {
    it('debería retornar array vacío inicialmente', async () => {
      const data = await moduleService.listPatientModuleData('patient-123');

      expect(data).toBeInstanceOf(Array);
      expect(data).toHaveLength(0);
    });
  });

  describe('getModuleData', () => {
    it('debería retornar null cuando no hay datos', async () => {
      const data = await moduleService.getModuleData('odontograma', 'patient-123');

      expect(data).toBeNull();
    });

    it('debería aceptar consultaId opcional', async () => {
      const data = await moduleService.getModuleData('odontograma', 'patient-123', 'consulta-456');

      expect(data).toBeNull();
    });
  });
});
