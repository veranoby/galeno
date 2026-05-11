// apps/web/src/modules/register.ts

/**
 * Registro de Módulos de Especialidad
 *
 * Este archivo se encarga de registrar todos los módulos de especialidad
 * disponibles en el ModuleRegistry global.
 *
 * Los módulos se cargan dinámicamente y pueden ser accedidos mediante
 * el ModuleLoader component o directamente desde el registro.
 */

import { moduleRegistry } from './registry';
import type { SpecialtyModuleType } from '@/types/module';

// Importar componentes de módulos
import { Odontograma } from './odontograma';
import { RetinaAtlas } from './retina';
import { CurvasCrecimiento } from './crecimiento';

/**
 * Inicializa el registro de módulos de especialidad
 *
 * Debe llamarse durante la inicialización de la aplicación
 */
export function registerSpecialtyModules(): void {
  console.info('[SpecialtyModules] Registering modules...');

  // Módulo de Odontograma
  moduleRegistry.register({
    id: 'odontograma',
    name: 'Odontograma',
    description: 'Registro visual del estado dental con tratamientos por diente y cara',
    specialty: 'odontologia' as SpecialtyModuleType,
    kind: 'chart',
    version: '1.0.0',
    author: 'Galeno',
    tags: ['diente', 'tratamiento', 'odontología'],
    icon: 'mdi-tooth',
  }, Odontograma);

  // Módulo de Retina Atlas
  moduleRegistry.register({
    id: 'retina-atlas',
    name: 'Retina Atlas',
    description: 'Visor de imágenes de retina con anotaciones y comparación',
    specialty: 'oftalmologia' as SpecialtyModuleType,
    kind: 'viewer',
    version: '1.0.0',
    author: 'Galeno',
    tags: ['retina', 'ojo', 'imagen', 'anotación'],
    icon: 'mdi-eye',
  }, RetinaAtlas);

  // Módulo de Curvas de Crecimiento
  moduleRegistry.register({
    id: 'curvas-crecimiento',
    name: 'Curvas de Crecimiento',
    description: 'Seguimiento del crecimiento infantil según estándares OMS',
    specialty: 'pediatria' as SpecialtyModuleType,
    kind: 'chart',
    version: '1.0.0',
    author: 'Galeno',
    tags: ['crecimiento', 'oms', 'pediatría', 'percentil'],
    icon: 'mdi-chart-line',
  }, CurvasCrecimiento);

  // Mostrar estadísticas del registro
  const stats = moduleRegistry.getStats();
  console.info('[SpecialtyModules] Modules registered:', stats);

  // Verificar que los módulos se hayan registrado correctamente
  const requiredModules = ['odontograma', 'retina-atlas', 'curvas-crecimiento'];
  for (const moduleId of requiredModules) {
    if (!moduleRegistry.hasModule(moduleId)) {
      console.error(`[SpecialtyModules] Failed to register module: ${moduleId}`);
    } else {
      console.info(`[SpecialtyModules] ✓ Module registered: ${moduleId}`);
    }
  }
}

/**
 * Obtiene los IDs de todos los módulos registrados
 */
export function getRegisteredModuleIds(): string[] {
  return moduleRegistry.getAllModules().map(m => m.config.id);
}

/**
 * Verifica si un módulo está registrado
 */
export function isModuleRegistered(moduleId: string): boolean {
  return moduleRegistry.hasModule(moduleId);
}

/**
 * Obtiene todos los módulos de una especialidad
 */
export function getModulesBySpecialty(specialty: SpecialtyModuleType) {
  return moduleRegistry.getModulesBySpecialty(specialty);
}

/**
 * Obtiene información de todos los módulos registrados
 */
export function getModulesInfo() {
  return moduleRegistry.getAllModules().map(m => ({
    id: m.config.id,
    name: m.config.name,
    specialty: m.config.specialty,
    kind: m.config.kind,
    version: m.config.version,
  }));
}
