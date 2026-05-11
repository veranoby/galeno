// apps/web/src/modules/index.ts

/**
 * Sistema de Módulos de Especialidad
 *
 * Este sistema permite registrar, cargar y renderizar módulos dinámicos
 * para diferentes especialidades médicas.
 */

// Tipos
export * from '@/types/module';

// Clase base y factory
export { BaseSpecialtyModule, type ModuleFactory } from './base-module';

// Registro de módulos
export {
  moduleRegistry,
  registerModule,
  registerAsyncModule
} from './registry';

// Funciones de registro de módulos de especialidad
export {
  registerSpecialtyModules,
  getRegisteredModuleIds,
  isModuleRegistered,
  getModulesBySpecialty,
  getModulesInfo
} from './register';

// Componente de carga de módulos
export { default as ModuleLoader } from './ModuleLoader.vue';
