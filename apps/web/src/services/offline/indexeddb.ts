/**
 * Servicio IndexedDB con Dexie.js para almacenamiento offline-first
 * Maneja el schema de la base de datos y operaciones CRUD bulk
 */

import Dexie, { type Table, type EntityTable } from 'dexie';
import { logger } from '../../utils/logger';
import type { OfflineEntity, QueuedOperation, SyncStatus } from './types';

/**
 * Schema de la base de datos IndexedDB
 * Define las tablas y sus índices para pacientes, consultas, documentos y cola de sincronización
 */
interface GalenoDBSchema {
  /** Tabla de pacientes almacenados localmente */
  pacientes: EntityTable<
    OfflineEntity & {
      nombre: string;
      apellido: string;
      cedula: string;
      fechaNacimiento: string;
      genero: string;
      telefono?: string;
      email?: string;
      direccion?: string;
      historiaClinica?: string;
      antecedentes?: Record<string, unknown>;
    },
    'id' | 'cedula' | 'historiaClinica'
  >;

  /** Tabla de consultas médicas almacenadas localmente */
  consultas: EntityTable<
    OfflineEntity & {
      pacienteId: string;
      medicoId: string;
      fecha: string;
      motivo: string;
      diagnostico?: string;
      tratamiento?: string;
      observaciones?: string;
      signosVitales?: Record<string, number | string>;
      documentos?: string[];
    },
    'id' | 'pacienteId' | 'medicoId' | 'fecha'
  >;

  /** Tabla de documentos almacenados localmente */
  documentos: EntityTable<
    OfflineEntity & {
      tipo: string;
      nombre: string;
      url?: string;
      blob?: Blob;
      metadata?: Record<string, unknown>;
      consultaId?: string;
      pacienteId?: string;
    },
    'id' | 'consultaId' | 'pacienteId'
  >;

  /** Tabla de cola de operaciones pendientes de sincronización */
  syncQueue: EntityTable<QueuedOperation, 'id'>;

  /** Tabla de metadatos de sincronización */
  syncMetadata: EntityTable<
    {
      key: string;
      value: unknown;
      updatedAt: number;
    },
    'key'
  >;
}

/**
 * Clase principal para gestión de IndexedDB con Dexie
 */
class GalenoDatabase extends Dexie {
  pacientes!: Table<OfflineEntity & { nombre: string; apellido: string; cedula: string; fechaNacimiento: string; genero: string; telefono?: string; email?: string; direccion?: string; historiaClinica?: string; antecedentes?: Record<string, unknown> }, string>;
  consultas!: Table<OfflineEntity & { pacienteId: string; medicoId: string; fecha: string; motivo: string; diagnostico?: string; tratamiento?: string; observaciones?: string; signosVitales?: Record<string, number | string>; documentos?: string[] }, string>;
  documentos!: Table<OfflineEntity & { tipo: string; nombre: string; url?: string; blob?: Blob; metadata?: Record<string, unknown>; consultaId?: string; pacienteId?: string }, string>;
  syncQueue!: Table<QueuedOperation, string>;
  syncMetadata!: Table<{ key: string; value: unknown; updatedAt: number }, string>;

  private static instance: GalenoDatabase | null = null;

  /**
   * Constructor privado para patrón singleton
   */
  private constructor(dbName: string, dbVersion: number) {
    super(dbName);

    this.version(dbVersion).stores({
      pacientes: 'id, cedula, historiaClinica, syncStatus, lastModified',
      consultas: 'id, pacienteId, medicoId, fecha, syncStatus, lastModified',
      documentos: 'id, consultaId, pacienteId, syncStatus, lastModified',
      syncQueue: 'id, entityName, entityId, createdAt, retryCount, priority',
      syncMetadata: 'key, updatedAt'
    });

    // Event handlers para logging
    this.on('populate', () => {
      logger.info('[IndexedDB] Database populated');
    });

    this.on('blocked', () => {
      logger.warn('[IndexedDB] Database blocked - another connection is using it');
    });
  }

  /**
   * Obtiene la instancia singleton de la base de datos
   */
  static getInstance(dbName = 'galeno-offline-db', dbVersion = 1): GalenoDatabase {
    if (!GalenoDatabase.instance) {
      GalenoDatabase.instance = new GalenoDatabase(dbName, dbVersion);
    }
    return GalenoDatabase.instance;
  }

  /**
   * Reinicia la instancia singleton (útil para testing)
   */
  static resetInstance(): void {
    if (GalenoDatabase.instance) {
      GalenoDatabase.instance.close();
      GalenoDatabase.instance = null;
    }
  }

  /**
   * Obtiene una tabla por nombre con tipado dinámico
   */
  getTable<T extends OfflineEntity>(tableName: string): Table<T, string> {
    return this.table(tableName) as Table<T, string>;
  }
}

/**
 * Servicio de operaciones bulk para IndexedDB
 * Proporciona métodos optimizados para operaciones masivas
 */
export class IndexedDBService {
  private db: GalenoDatabase;

  /**
   * Crea una instancia del servicio IndexedDB
   */
  constructor(db: GalenoDatabase) {
    this.db = db;
  }

  /**
   * Obtiene la instancia del servicio (singleton implícito a través de DB)
   */
  static getInstance(): IndexedDBService {
    return new IndexedDBService(GalenoDatabase.getInstance());
  }

  /**
   * Inserta o actualiza múltiples entidades en una transacción
   * @param tableName - Nombre de la tabla
   * @param entities - Array de entidades a insertar/actualizar
   * @returns Promesa con los IDs de las entidades procesadas
   */
  async bulkPut<T extends OfflineEntity>(tableName: string, entities: T[]): Promise<string[]> {
    try {
      const table = this.db.getTable<T>(tableName);
      const ids: string[] = [];

      await this.db.transaction('rw', table, async () => {
        for (const entity of entities) {
          await table.put(entity);
          ids.push(entity.id);
        }
      });

      logger.debug(`[IndexedDB] Bulk put ${ids.length} entities in ${tableName}`, { ids });
      return ids;
    } catch (error) {
      logger.error(`[IndexedDB] Bulk put failed in ${tableName}`, { error, tableName });
      throw error;
    }
  }

  /**
   * Obtiene múltiples entidades por sus IDs
   * @param tableName - Nombre de la tabla
   * @param ids - Array de IDs a buscar
   * @returns Promesa con array de entidades encontradas
   */
  async bulkGet<T extends OfflineEntity>(tableName: string, ids: string[]): Promise<T[]> {
    try {
      const table = this.db.getTable<T>(tableName);
      const entities: T[] = [];

      await this.db.transaction('r', table, async () => {
        for (const id of ids) {
          const entity = await table.get(id);
          if (entity) {
            entities.push(entity);
          }
        }
      });

      logger.debug(`[IndexedDB] Bulk get ${entities.length} entities from ${tableName}`, { ids });
      return entities;
    } catch (error) {
      logger.error(`[IndexedDB] Bulk get failed from ${tableName}`, { error, tableName });
      throw error;
    }
  }

  /**
   * Obtiene todas las entidades de una tabla
   * @param tableName - Nombre de la tabla
   * @returns Promesa con array de todas las entidades
   */
  async getAll<T extends OfflineEntity>(tableName: string): Promise<T[]> {
    try {
      const table = this.db.getTable<T>(tableName);
      const entities = await table.toArray();
      logger.debug(`[IndexedDB] Get all ${entities.length} entities from ${tableName}`);
      return entities;
    } catch (error) {
      logger.error(`[IndexedDB] Get all failed from ${tableName}`, { error, tableName });
      throw error;
    }
  }

  /**
   * Obtiene entidades filtradas por estado de sincronización
   * @param tableName - Nombre de la tabla
   * @param syncStatus - Estado de sincronización a filtrar
   * @returns Promesa con array de entidades filtradas
   */
  async getBySyncStatus<T extends OfflineEntity>(
    tableName: string,
    syncStatus: SyncStatus
  ): Promise<T[]> {
    try {
      const table = this.db.getTable<T>(tableName);
      const entities = await table.filter(e => e.syncStatus === syncStatus).toArray();
      logger.debug(
        `[IndexedDB] Get ${entities.length} entities with status ${syncStatus} from ${tableName}`
      );
      return entities;
    } catch (error) {
      logger.error(`[IndexedDB] Get by sync status failed from ${tableName}`, {
        error,
        tableName,
        syncStatus
      });
      throw error;
    }
  }

  /**
   * Elimina una entidad por ID
   * @param tableName - Nombre de la tabla
   * @param id - ID de la entidad a eliminar
   * @returns Promesa que se resuelve cuando se completa la eliminación
   */
  async delete(tableName: string, id: string): Promise<void> {
    try {
      const table = this.db.getTable(tableName);
      await table.delete(id);
      logger.debug(`[IndexedDB] Deleted entity ${id} from ${tableName}`);
    } catch (error) {
      logger.error(`[IndexedDB] Delete failed for ${id} in ${tableName}`, { error, tableName, id });
      throw error;
    }
  }

  /**
   * Elimina múltiples entidades por IDs
   * @param tableName - Nombre de la tabla
   * @param ids - Array de IDs a eliminar
   * @returns Promesa que se resuelve cuando se completan las eliminaciones
   */
  async bulkDelete(tableName: string, ids: string[]): Promise<void> {
    try {
      const table = this.db.getTable(tableName);
      await this.db.transaction('rw', table, async () => {
        for (const id of ids) {
          await table.delete(id);
        }
      });
      logger.debug(`[IndexedDB] Bulk deleted ${ids.length} entities from ${tableName}`);
    } catch (error) {
      logger.error(`[IndexedDB] Bulk delete failed from ${tableName}`, { error, tableName });
      throw error;
    }
  }

  /**
   * Busca entidades por un campo específico
   * @param tableName - Nombre de la tabla
   * @param indexName - Nombre del índice a usar
   * @param value - Valor a buscar
   * @returns Promesa con array de entidades encontradas
   */
  async findByIndex<T extends OfflineEntity>(
    tableName: string,
    indexName: string,
    value: string | number | null
  ): Promise<T[]> {
    try {
      const table = this.db.getTable<T>(tableName);
      const entities = await table.where(indexName).equals(value as any).toArray();
      logger.debug(`[IndexedDB] Found ${entities.length} entities by ${indexName}=${value}`);
      return entities;
    } catch (error) {
      logger.error(`[IndexedDB] Find by index failed`, { error, tableName, indexName, value });
      throw error;
    }
  }

  /**
   * Actualiza campos específicos de una entidad
   * @param tableName - Nombre de la tabla
   * @param id - ID de la entidad
   * @param updates - Objeto con campos a actualizar
   * @returns Promesa que se resuelve cuando se completa la actualización
   */
  async updateFields<T extends OfflineEntity>(
    tableName: string,
    id: string,
    updates: Record<string, unknown>
  ): Promise<void> {
    try {
      const table = this.db.getTable<T>(tableName);
      await table.update(id, updates as any);
      logger.debug(`[IndexedDB] Updated fields for ${id} in ${tableName}`, { updates });
    } catch (error) {
      logger.error(`[IndexedDB] Update fields failed for ${id} in ${tableName}`, {
        error,
        tableName,
        id
      });
      throw error;
    }
  }

  /**
   * Obtiene el conteo de entidades en una tabla
   * @param tableName - Nombre de la tabla
   * @returns Promesa con el número de entidades
   */
  async count(tableName: string): Promise<number> {
    try {
      const table = this.db.getTable(tableName);
      const count = await table.count();
      return count;
    } catch (error) {
      logger.error(`[IndexedDB] Count failed for ${tableName}`, { error, tableName });
      throw error;
    }
  }

  /**
   * Limpia todas las entidades de una tabla
   * @param tableName - Nombre de la tabla
   * @returns Promesa que se resuelve cuando se completa la limpieza
   */
  async clear(tableName: string): Promise<void> {
    try {
      const table = this.db.getTable(tableName);
      await table.clear();
      logger.info(`[IndexedDB] Cleared all entities from ${tableName}`);
    } catch (error) {
      logger.error(`[IndexedDB] Clear failed for ${tableName}`, { error, tableName });
      throw error;
    }
  }

  /**
   * Implementa LRU (Least Recently Used) eviction para mantener la cuota
   * Elimina las entidades menos recientemente modificadas hasta alcanzar el límite
   * @param tableName - Nombre de la tabla
   * @param maxCount - Número máximo de entidades a mantener
   * @returns Promesa con el número de entidades eliminadas
   */
  async applyLRUEviction(tableName: string, maxCount: number): Promise<number> {
    try {
      const table = this.db.getTable<OfflineEntity>(tableName);
      const currentCount = await table.count();

      if (currentCount <= maxCount) {
        return 0;
      }

      const entitiesToDelete = await table
        .orderBy('lastModified')
        .limit(currentCount - maxCount)
        .toArray();

      const idsToDelete = entitiesToDelete.map(e => e.id);

      await this.db.transaction('rw', table, async () => {
        for (const id of idsToDelete) {
          await table.delete(id);
        }
      });

      logger.info(
        `[IndexedDB] LRU eviction: removed ${idsToDelete.length} entities from ${tableName}`
      );
      return idsToDelete.length;
    } catch (error) {
      logger.error(`[IndexedDB] LRU eviction failed for ${tableName}`, { error, tableName });
      throw error;
    }
  }

  /**
   * Obtiene estadísticas de uso de la base de datos
   * @returns Promesa con estadísticas de cada tabla
   */
  async getStats(): Promise<Record<string, number>> {
    const tables = ['pacientes', 'consultas', 'documentos', 'syncQueue', 'syncMetadata'];
    const stats: Record<string, number> = {};

    for (const table of tables) {
      try {
        stats[table] = await this.count(table);
      } catch {
        stats[table] = -1;
      }
    }

    return stats;
  }

  /**
   * Exporta todos los datos de la base de datos
   * @returns Promesa con objeto conteniendo todos los datos
   */
  async exportAll(): Promise<Record<string, unknown[]>> {
    const tables = ['pacientes', 'consultas', 'documentos', 'syncQueue', 'syncMetadata'];
    const exportData: Record<string, unknown[]> = {};

    for (const table of tables) {
      try {
        exportData[table] = await this.getAll(table);
      } catch (error) {
        logger.warn(`[IndexedDB] Export failed for ${table}`, { error });
        exportData[table] = [];
      }
    }

    return exportData;
  }

  /**
   * Importa datos en la base de datos
   * @param data - Objeto con datos a importar por tabla
   */
  async importAll(data: Record<string, OfflineEntity[]>): Promise<void> {
    for (const [tableName, entities] of Object.entries(data)) {
      if (entities.length > 0) {
        await this.bulkPut(tableName, entities);
      }
    }
    logger.info('[IndexedDB] Import completed');
  }
}

// Exportar instancia singleton
export const indexedDBService = IndexedDBService.getInstance();

// Exportar la clase DB para uso directo si es necesario
export { GalenoDatabase };
