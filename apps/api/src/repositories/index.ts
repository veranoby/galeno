// apps/api/src/repositories/index.ts
/**
 * Punto de entrada para el módulo de Repositories
 * Proporciona acceso a todas las interfaces e implementaciones
 */

// Interfaces
export * from './interfaces';

// Implementaciones Prisma
export * from './prisma';

// Types útiles para DI Container
export type { Repository } from './interfaces/IRepository.js';
