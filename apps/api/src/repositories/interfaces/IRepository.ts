// apps/api/src/repositories/interfaces/IRepository.ts
/**
 * Interfaz base para todos los Repositories
 * Define las operaciones comunes de CRUD
 */

import { Prisma } from '@prisma/client';

export interface Repository<T, CreateInput, UpdateInput, FindOptions> {
  /**
   * Crear una nueva entidad
   */
  create(data: CreateInput): Promise<T>;

  /**
   * Buscar entidades por criterios
   */
  findMany(options?: FindOptions): Promise<T[]>;

  /**
   * Buscar una entidad por ID
   */
  findById(id: string, options?: FindOptions): Promise<T | null>;

  /**
   * Actualizar una entidad
   */
  update(id: string, data: UpdateInput): Promise<T>;

  /**
   * Eliminar una entidad
   */
  delete(id: string): Promise<T>;

  /**
   * Contar entidades por criterios
   */
  count(options?: FindOptions): Promise<number>;
}
