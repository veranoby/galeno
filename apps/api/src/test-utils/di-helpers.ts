// apps/api/src/test-utils/di-helpers.ts
/**
 * Test Helpers para DI Container
 *
 * Funciones utilitarias para tests que usan el DI Container.
 * Consolida la lógica de reset que estaba duplicada en múltiples archivos.
 */

import { AwilixManagerClass } from '../di/awilix-manager.js';

/**
 * Resetea el contenedor DI a su estado inicial.
 *
 * Útil para tests que necesitan un contenedor limpio.
 * Esta función consolida la lógica que estaba duplicada en:
 * - awilix-manager.test.ts
 * - di-container.test.ts
 *
 * @example
 * ```typescript
 * import { resetDIContainer } from '@/test-utils/di-helpers.js';
 *
 * beforeEach(() => {
 *   resetDIContainer();
 * });
 * ```
 */
export function resetDIContainer(): void {
  (AwilixManagerClass as any).instance = null;
}

/**
 * Crea un contenedor DI scoped para un test específico.
 *
 * Útil para tests que necesitan aislamiento total sin afectar
 * el contenedor global.
 *
 * @returns Contenedor DI scoped
 */
export function createTestContainer(): ReturnType<typeof AwilixManagerClass.prototype.createScopedContainer> {
  return AwilixManagerClass.getInstance().createScopedContainer();
}

/**
 * Setup helper para tests de DI Container.
 *
 * Ejecuta el reset y retorna el contenedor limpio.
 *
 * @returns Contenedor DI limpio
 */
export function setupDIContainer() {
  resetDIContainer();
  return AwilixManagerClass.getInstance().getContainer();
}
