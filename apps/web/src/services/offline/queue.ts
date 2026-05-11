/**
 * Cola de operaciones pendientes para sincronización offline
 * Gestiona el encolado, persistencia y recuperación de operaciones
 */

import { GalenoDatabase } from './indexeddb';
import { logger } from '../../utils/logger';
import type { QueuedOperation, OperationType, OfflineConfig } from './types';
import { DEFAULT_OFFLINE_CONFIG } from './types';

/**
 * Opciones para encolar una operación
 */
export interface EnqueueOptions {
  /** Prioridad de la operación (default: 0) */
  priority?: number;
  
  /** Datos adicionales para la operación */
  payload?: Record<string, unknown>;
}

/**
 * Filtros para consultar operaciones en cola
 */
export interface QueueFilter {
  /** Filtrar por nombre de entidad */
  entityName?: string;
  
  /** Filtrar por ID de entidad */
  entityId?: string;
  
  /** Filtrar por tipo de operación */
  type?: OperationType;
  
  /** Filtrar por número máximo de reintentos */
  maxRetries?: number;
}

/**
 * Clase para gestión de la cola de operaciones pendientes
 */
export class OperationQueue {
  private db: GalenoDatabase;
  private config: OfflineConfig;

  /**
   * Crea una instancia de OperationQueue
   * @param db - Instancia de GalenoDatabase
   * @param config - Configuración opcional
   */
  constructor(db: GalenoDatabase, config: Partial<OfflineConfig> = {}) {
    this.db = db;
    this.config = { ...DEFAULT_OFFLINE_CONFIG, ...config };
  }

  /**
   * Obtiene una instancia de OperationQueue
   */
  static getInstance(config?: Partial<OfflineConfig>): OperationQueue {
    return new OperationQueue(GalenoDatabase.getInstance(), config);
  }

  /**
   * Genera un ID único para operaciones
   */
  private generateId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Encola una nueva operación para sincronización posterior
   * @param entityName - Nombre de la entidad (pacientes, consultas, documentos)
   * @param entityId - ID de la entidad afectada
   * @param type - Tipo de operación (CREATE, UPDATE, DELETE)
   * @param options - Opciones adicionales
   * @returns Promesa con la operación encolada
   */
  async enqueue(
    entityName: string,
    entityId: string,
    type: OperationType,
    options: EnqueueOptions = {}
  ): Promise<QueuedOperation> {
    const operation: QueuedOperation = {
      id: this.generateId(),
      type,
      entityName,
      entityId,
      payload: options.payload ?? null,
      createdAt: Date.now(),
      retryCount: 0,
      lastAttemptAt: null,
      lastError: null,
      priority: options.priority ?? 0
    };

    try {
      await this.db.transaction('rw', this.db.syncQueue, async () => {
        await this.db.syncQueue.add(operation);
      });

      // Aplicar LRU eviction si excede el límite
      await this.applyLRUEviction();

      logger.debug(`[Queue] Enqueued ${type} operation for ${entityName}:${entityId}`, {
        operationId: operation.id
      });

      return operation;
    } catch (error) {
      logger.error('[Queue] Failed to enqueue operation', { error, entityName, entityId, type });
      throw error;
    }
  }

  /**
   * Obtiene la siguiente operación pendiente para procesar
   * Ordena por prioridad (desc) y luego por createdAt (asc)
   * @returns Promesa con la operación o null si la cola está vacía
   */
  async dequeue(): Promise<QueuedOperation | null> {
    try {
      const operation = await this.db.syncQueue
        .orderBy('priority')
        .reverse()
        .first();

      if (!operation) {
        return null;
      }

      // Si hay múltiples con la misma prioridad, obtener la más antigua
      const operations = await this.db.syncQueue
        .where('priority')
        .equals(operation.priority)
        .sortBy('createdAt');

      return operations[0] ?? null;
    } catch (error) {
      logger.error('[Queue] Failed to dequeue operation', { error });
      throw error;
    }
  }

  /**
   * Obtiene todas las operaciones en cola
   * @param filter - Filtros opcionales
   * @returns Promesa con array de operaciones
   */
  async getAll(filter?: QueueFilter): Promise<QueuedOperation[]> {
    try {
      let collection = this.db.syncQueue.toCollection();

      if (filter?.entityName) {
        collection = this.db.syncQueue.where('entityName').equals(filter.entityName);
      }

      const operations = await collection.toArray();

      // Aplicar filtros adicionales en memoria
      return operations.filter(op => {
        if (filter?.entityId && op.entityId !== filter.entityId) return false;
        if (filter?.type && op.type !== filter.type) return false;
        if (filter?.maxRetries !== undefined && op.retryCount >= filter.maxRetries) return false;
        return true;
      });
    } catch (error) {
      logger.error('[Queue] Failed to get all operations', { error });
      throw error;
    }
  }

  /**
   * Obtiene el número de operaciones pendientes
   * @param filter - Filtros opcionales
   * @returns Promesa con el conteo
   */
  async getCount(filter?: QueueFilter): Promise<number> {
    const operations = await this.getAll(filter);
    return operations.length;
  }

  /**
   * Obtiene operaciones agrupadas por entidad
   * @returns Promesa con mapa de operaciones por entityId
   */
  async getGroupedByEntity(): Promise<Map<string, QueuedOperation[]>> {
    const operations = await this.getAll();
    const grouped = new Map<string, QueuedOperation[]>();

    for (const op of operations) {
      const key = `${op.entityName}:${op.entityId}`;
      const existing = grouped.get(key) || [];
      existing.push(op);
      grouped.set(key, existing);
    }

    return grouped;
  }

  /**
   * Marca una operación como completada y la elimina de la cola
   * @param operationId - ID de la operación
   */
  async complete(operationId: string): Promise<void> {
    try {
      await this.db.syncQueue.delete(operationId);
      logger.debug(`[Queue] Completed operation ${operationId}`);
    } catch (error) {
      logger.error('[Queue] Failed to complete operation', { error, operationId });
      throw error;
    }
  }

  /**
   * Marca una operación como fallida e incrementa el contador de reintentos
   * @param operationId - ID de la operación
   * @param error - Mensaje de error
   * @returns Promesa con la operación actualizada
   */
  async fail(operationId: string, error: string): Promise<QueuedOperation | null> {
    try {
      const operation = await this.db.syncQueue.get(operationId);
      
      if (!operation) {
        logger.warn(`[Queue] Operation ${operationId} not found for fail`);
        return null;
      }

      const updatedOperation: QueuedOperation = {
        ...operation,
        retryCount: operation.retryCount + 1,
        lastAttemptAt: Date.now(),
        lastError: error
      };

      await this.db.syncQueue.put(updatedOperation);
      
      logger.debug(`[Queue] Failed operation ${operationId}, retry ${updatedOperation.retryCount}`, {
        error
      });

      return updatedOperation;
    } catch (err) {
      logger.error('[Queue] Failed to mark operation as failed', { error: err, operationId });
      throw err;
    }
  }

  /**
   * Elimina operaciones que exceden el máximo de reintentos
   * @param maxRetries - Número máximo de reintentos
   * @returns Promesa con número de operaciones eliminadas
   */
  async removeExceededRetries(maxRetries?: number): Promise<number> {
    const limit = maxRetries ?? this.config.maxRetries;
    const operations = await this.getAll();
    const exceeded = operations.filter(op => op.retryCount >= limit);

    for (const op of exceeded) {
      await this.db.syncQueue.delete(op.id);
    }

    if (exceeded.length > 0) {
      logger.warn(`[Queue] Removed ${exceeded.length} operations exceeding max retries`);
    }

    return exceeded.length;
  }

  /**
   * Limpia operaciones sincronizadas antiguas (basado en TTL)
   * @returns Promesa con número de operaciones eliminadas
   */
  async clearSynced(): Promise<number> {
    try {
      const now = Date.now();
      const ttl = this.config.syncedOperationTTL;
      const cutoff = now - ttl;

      // Obtener todas las operaciones y filtrar las antiguas
      const operations = await this.getAll();
      const toDelete = operations.filter(op => {
        // Eliminar si fue creada hace más del TTL
        return op.createdAt < cutoff;
      });

      for (const op of toDelete) {
        await this.db.syncQueue.delete(op.id);
      }

      if (toDelete.length > 0) {
        logger.info(`[Queue] Cleared ${toDelete.length} old synced operations`);
      }

      return toDelete.length;
    } catch (error) {
      logger.error('[Queue] Failed to clear synced operations', { error });
      throw error;
    }
  }

  /**
   * Elimina todas las operaciones de la cola
   */
  async clearAll(): Promise<void> {
    try {
      await this.db.syncQueue.clear();
      logger.info('[Queue] Cleared all operations');
    } catch (error) {
      logger.error('[Queue] Failed to clear all operations', { error });
      throw error;
    }
  }

  /**
   * Elimina operaciones para una entidad específica
   * @param entityName - Nombre de la entidad
   * @param entityId - ID de la entidad
   * @returns Promesa con número de operaciones eliminadas
   */
  async clearForEntity(entityName: string, entityId: string): Promise<number> {
    try {
      const operations = await this.getAll({ entityName, entityId });
      
      for (const op of operations) {
        await this.db.syncQueue.delete(op.id);
      }

      logger.debug(`[Queue] Cleared ${operations.length} operations for ${entityName}:${entityId}`);
      return operations.length;
    } catch (error) {
      logger.error('[Queue] Failed to clear operations for entity', { error, entityName, entityId });
      throw error;
    }
  }

  /**
   * Consolida operaciones múltiples para la misma entidad
   * Combina CREATE + UPDATE en un solo UPDATE, o elimina operaciones DELETE redundantes
   * @returns Promesa con número de operaciones consolidadas
   */
  async consolidate(): Promise<number> {
    try {
      const grouped = await this.getGroupedByEntity();
      let consolidatedCount = 0;

      for (const [key, operations] of Array.from(grouped.entries())) {
        if (operations.length <= 1) continue;

        // Ordenar por createdAt
        const sorted = operations.sort((a, b) => a.createdAt - b.createdAt);

        // Si la última operación es DELETE, eliminar todas las anteriores
        const lastOp = sorted[sorted.length - 1];
        if (lastOp.type === 'DELETE') {
          for (let i = 0; i < sorted.length - 1; i++) {
            await this.db.syncQueue.delete(sorted[i].id);
            consolidatedCount++;
          }
          continue;
        }

        // Si hay CREATE seguido de UPDATEs, consolidar en un solo UPDATE
        const createOp = sorted.find(op => op.type === 'CREATE');
        if (createOp) {
          const updateOps = sorted.filter(op => op.type === 'UPDATE' && op.id !== createOp.id);
          if (updateOps.length > 0) {
            // Eliminar CREATE y mantener solo el último UPDATE con payload mergeado
            await this.db.syncQueue.delete(createOp.id);
            consolidatedCount++;

            // Actualizar el último UPDATE con el payload mergeado
            const lastUpdate = updateOps[updateOps.length - 1];
            const mergedPayload = {
              ...createOp.payload,
              ...lastUpdate.payload
            };
            await this.db.syncQueue.update(lastUpdate.id, { payload: mergedPayload });
          }
        }
      }

      if (consolidatedCount > 0) {
        logger.info(`[Queue] Consolidated ${consolidatedCount} operations`);
      }

      return consolidatedCount;
    } catch (error) {
      logger.error('[Queue] Failed to consolidate operations', { error });
      throw error;
    }
  }

  /**
   * Aplica LRU eviction para mantener la cola dentro del límite
   * @returns Promesa con número de operaciones eliminadas
   */
  private async applyLRUEviction(): Promise<number> {
    const currentCount = await this.db.syncQueue.count();
    
    if (currentCount <= this.config.maxQueueSize) {
      return 0;
    }

    const toDelete = currentCount - this.config.maxQueueSize;
    const operationsToDelete = await this.db.syncQueue
      .orderBy('createdAt')
      .limit(toDelete)
      .toArray();

    for (const op of operationsToDelete) {
      await this.db.syncQueue.delete(op.id);
    }

    logger.warn(
      `[Queue] LRU eviction: removed ${operationsToDelete.length} oldest operations (max: ${this.config.maxQueueSize})`
    );

    return operationsToDelete.length;
  }

  /**
   * Obtiene estadísticas de la cola
   * @returns Promesa con estadísticas detalladas
   */
  async getStats(): Promise<{
    total: number;
    byType: Record<OperationType, number>;
    byEntity: Record<string, number>;
    avgRetryCount: number;
    oldestOperation: QueuedOperation | null;
  }> {
    const operations = await this.getAll();
    
    const byType: Record<OperationType, number> = {
      CREATE: 0,
      UPDATE: 0,
      DELETE: 0
    };

    const byEntity: Record<string, number> = {};
    let totalRetries = 0;

    for (const op of operations) {
      byType[op.type]++;
      byEntity[op.entityName] = (byEntity[op.entityName] || 0) + 1;
      totalRetries += op.retryCount;
    }

    const sorted = operations.sort((a, b) => a.createdAt - b.createdAt);

    return {
      total: operations.length,
      byType,
      byEntity,
      avgRetryCount: operations.length > 0 ? totalRetries / operations.length : 0,
      oldestOperation: sorted[0] ?? null
    };
  }
}

// Exportar instancia singleton
export const operationQueue = OperationQueue.getInstance();
