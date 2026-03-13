// apps/api/src/di/index.ts
/**
 * Barrel export para el módulo DI
 */

export { getDIContainer, createScopedContainer, registerService } from '../di-container.js';
export { AwilixManagerClass } from './awilix-manager.js';
export type { DIContainer, DependencyBinding, DependencyBindings } from './types.js';
