// apps/api/src/di-container.ts
/**
 * Contenedor de Inyección de Dependencias (DI Container)
 *
 * Usa Awilix para gestionar las dependencias del sistema:
 * - Repositories (acceso a datos)
 * - Services (lógica de negocio)
 * - Orchestrators (coordinación)
 * - Channels (canales de notificación)
 *
 * Beneficios:
 * - Testabilidad: Mock fácil en tests
 * - Configuración centralizada
 * - Ciclo de vida controlado (scoped, singleton, transient)
 * - Sin dependencias globales (singletons)
 */

import type { AwilixContainer } from 'awilix';
import { AwilixManagerClass } from './di/awilix-manager.js';
import type { DIContainer } from './di/types.js';

/**
 * Obtiene el contenedor DI
 * @returns Contenedor Awilix configurado
 */
export function getDIContainer(): DIContainer {
  return AwilixManagerClass.getInstance().getContainer();
}

/**
 * Crea un contenedor scoped para testing o contextos específicos
 * @returns Contenedor Awilix scoped
 */
export function createScopedContainer(): DIContainer {
  return AwilixManagerClass.getInstance().createScopedContainer();
}

/**
 * Registra un servicio adicional en el contenedor
 * @param name Nombre del servicio
 * @param registration Función de registro
 */
export function registerService<T>(
  name: string,
  registration: (container: DIContainer) => T
): void {
  AwilixManagerClass.getInstance().registerService(name, registration);
}

// Export por defecto el contenedor
export default getDIContainer;
