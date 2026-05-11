/**
 * Estrategia Last Write Wins (LWW) para resolución de conflictos
 * Compara timestamps y versiones para determinar qué datos prevalecen
 */

import { logger } from '../../utils/logger';
import type { OfflineEntity, ConflictResolutionStrategy } from './types';

/**
 * Resultado de la resolución de un conflicto
 */
export interface ConflictResolutionResult<T extends OfflineEntity> {
  /** Indica si hubo conflicto */
  hasConflict: boolean;
  
  /** Entidad resultante después de la resolución */
  resolved: T;
  
  /** Estrategia utilizada para resolver */
  strategy: ConflictResolutionStrategy;
  
  /** Campos que fueron modificados */
  modifiedFields: string[];
  
  /** Indica si se usó la versión del servidor */
  serverVersionUsed: boolean;
}

/**
 * Comparación entre dos versiones de una entidad
 */
export interface VersionComparison {
  /** Indica si hay conflicto */
  hasConflict: boolean;
  
  /** Diferencia de tiempo en ms (local - server) */
  timeDifference: number;
  
  /** Diferencia de versiones */
  versionDifference: number;
  
  /** Campos diferentes entre las versiones */
  differentFields: string[];
  
  /** Indica cuál versión es más reciente */
  newerVersion: 'local' | 'server' | 'equal';
}

/**
 * Implementación de la estrategia Last Write Wins
 * Usa timestamps y versiones para resolver conflictos
 */
export class LWWStrategy {
  /**
   * Compara dos versiones de una entidad y determina si hay conflicto
   * @param local - Versión local de la entidad
   * @param server - Versión del servidor de la entidad
   * @returns Resultado de la comparación
   */
  static compareVersions<T extends OfflineEntity>(
    local: T,
    server: T
  ): VersionComparison {
    const differentFields = this.getDifferentFields(local, server);
    const timeDifference = local.lastModified - server.lastModified;
    const versionDifference = local.version - server.version;

    // Hay conflicto si los datos son diferentes y ambos han sido modificados
    const hasConflict =
      differentFields.length > 0 &&
      local.syncStatus !== 'PENDING' &&
      server.syncStatus !== 'PENDING';

    let newerVersion: 'local' | 'server' | 'equal';
    if (timeDifference > 0) {
      newerVersion = 'local';
    } else if (timeDifference < 0) {
      newerVersion = 'server';
    } else {
      // Si los timestamps son iguales, usar versión
      if (versionDifference > 0) {
        newerVersion = 'local';
      } else if (versionDifference < 0) {
        newerVersion = 'server';
      } else {
        newerVersion = 'equal';
      }
    }

    return {
      hasConflict,
      timeDifference,
      versionDifference,
      differentFields,
      newerVersion
    };
  }

  /**
   * Obtiene los campos diferentes entre dos entidades
   * @param local - Versión local
   * @param server - Versión del servidor
   * @returns Array de nombres de campos diferentes
   */
  static getDifferentFields<T extends OfflineEntity>(local: T, server: T): string[] {
    const differentFields: string[] = [];
    const localKeys = Object.keys(local) as Array<keyof T>;

    for (const key of localKeys) {
      // Ignorar metadatos de sincronización
      if (['syncStatus', 'version', 'tempId'].includes(key as string)) {
        continue;
      }

      const localValue = local[key];
      const serverValue = server[key as keyof T];

      if (!this.valuesAreEqual(localValue, serverValue)) {
        differentFields.push(key as string);
      }
    }

    return differentFields;
  }

  /**
   * Compara dos valores para determinar si son iguales
   * Maneja objetos, arrays y tipos primitivos
   */
  private static valuesAreEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a === null || b === null) return a === b;
    if (typeof a !== typeof b) return false;

    if (typeof a === 'object') {
      const aStr = JSON.stringify(a);
      const bStr = JSON.stringify(b);
      return aStr === bStr;
    }

    return false;
  }

  /**
   * Resuelve un conflicto usando Last Write Wins
   * La versión con timestamp más reciente prevalece
   * @param local - Versión local de la entidad
   * @param server - Versión del servidor de la entidad
   * @returns Resultado de la resolución
   */
  static resolve<T extends OfflineEntity>(
    local: T,
    server: T
  ): ConflictResolutionResult<T> {
    const comparison = this.compareVersions(local, server);

    if (!comparison.hasConflict) {
      // No hay conflicto, retornar la versión local
      return {
        hasConflict: false,
        resolved: { ...local },
        strategy: 'LWW',
        modifiedFields: [],
        serverVersionUsed: false
      };
    }

    // Determinar cuál versión usar basado en el timestamp
    const useServer = comparison.newerVersion === 'server';
    const winner = useServer ? server : local;
    const loser = useServer ? local : server;

    // Crear entidad resuelta combinando lo mejor de ambas versiones
    const resolved = this.mergeEntities(winner, loser, comparison.differentFields);

    // Actualizar metadatos
    resolved.version = Math.max(local.version, server.version) + 1;
    resolved.lastModified = Math.max(local.lastModified, server.lastModified);
    resolved.syncStatus = 'SYNCED';
    resolved.syncedAt = Date.now();

    logger.info('[LWW] Conflict resolved', {
      entityId: local.id,
      winner: useServer ? 'server' : 'local',
      timeDifference: comparison.timeDifference,
      modifiedFields: comparison.differentFields
    });

    return {
      hasConflict: true,
      resolved,
      strategy: 'LWW',
      modifiedFields: comparison.differentFields,
      serverVersionUsed: useServer
    };
  }

  /**
   * Fusiona dos entidades campo por campo
   * Para cada campo diferente, usa el valor de la entidad ganadora
   * @param winner - Entidad ganadora (más reciente)
   * @param loser - Entidad perdedora
   * @param differentFields - Campos que difieren entre las entidades
   * @returns Entidad fusionada
   */
  private static mergeEntities<T extends OfflineEntity>(
    winner: T,
    loser: T,
    differentFields: string[]
  ): T {
    // Comenzar con una copia profunda de la entidad ganadora
    const merged = JSON.parse(JSON.stringify(winner)) as T;

    // Para campos no diferentes, asegurar que se mantengan los valores
    // Esto preserva cualquier dato que no esté en conflicto
    const allKeys = Array.from(
      new Set([
        ...Object.keys(winner),
        ...Object.keys(loser)
      ])
    ) as Array<keyof T>;

    for (const key of allKeys) {
      // Ignorar metadatos que se manejan por separado
      if (['version', 'lastModified', 'syncStatus', 'syncedAt', 'tempId'].includes(key as string)) {
        continue;
      }

      // Si el campo no es diferente, mantener el valor del ganador
      // (ya está copiado, solo es para claridad)
      if (!differentFields.includes(key as string)) {
        continue;
      }

      // El campo ya tiene el valor del ganador por la copia inicial
    }

    return merged;
  }

  /**
   * Realiza un merge fino campo por campo
   * Cada campo individual usa su propio timestamp para determinar el valor
   * Útil cuando diferentes campos pueden modificarse independientemente
   * @param local - Versión local
   * @param server - Versión del servidor
   * @param fieldTimestamps - Mapa de timestamps por campo (opcional)
   * @returns Entidad fusionada
   */
  static mergeFieldByField<T extends OfflineEntity>(
    local: T,
    server: T,
    fieldTimestamps?: Record<string, number>
  ): T {
    const merged = { ...local } as T;
    const localKeys = Object.keys(local) as Array<keyof T>;

    for (const key of localKeys) {
      // Ignorar metadatos
      if (['syncStatus', 'version', 'tempId', 'syncedAt'].includes(key as string)) {
        continue;
      }

      const localValue = local[key];
      const serverValue = server[key as keyof T];

      if (!this.valuesAreEqual(localValue, serverValue)) {
        // Valores diferentes, determinar cuál usar
        let useServer: boolean;

        if (fieldTimestamps && fieldTimestamps[key as string]) {
          // Usar timestamp específico del campo si está disponible
          const fieldTime = fieldTimestamps[key as string];
          useServer = fieldTime > local.lastModified;
        } else {
          // Fallback: comparar lastModified de las entidades
          useServer = server.lastModified > local.lastModified;
        }

        merged[key] = useServer ? serverValue : localValue;
      }
    }

    // Actualizar metadatos
    merged.version = Math.max(local.version, server.version) + 1;
    merged.lastModified = Date.now();
    merged.syncStatus = 'SYNCED';
    merged.syncedAt = Date.now();

    return merged;
  }

  /**
   * Detecta conflictos potenciales antes de sincronizar
   * @param local - Versión local
   * @param server - Versión del servidor (puede ser null si no existe)
   * @returns Indica si hay conflicto potencial
   */
  static hasPotentialConflict<T extends OfflineEntity>(
    local: T,
    server: T | null
  ): boolean {
    if (!server) {
      // No existe en el servidor, no hay conflicto
      return false;
    }

    // Hay conflicto si ambos han sido modificados desde la última sync
    if (!local.syncedAt || !server.syncedAt) {
      return local.syncStatus === 'PENDING';
    }

    // Verificar si hubo modificaciones locales después de la última sync
    const localModifiedAfterSync = local.lastModified > local.syncedAt;
    const serverModifiedAfterSync = server.lastModified > server.syncedAt;

    return localModifiedAfterSync && serverModifiedAfterSync;
  }

  /**
   * Prepara una entidad para sincronización
   * Actualiza timestamps y versión
   * @param entity - Entidad a preparar
   * @param isUpdate - Indica si es una actualización (vs creación)
   * @returns Entidad preparada para sync
   */
  static prepareForSync<T extends OfflineEntity>(
    entity: T,
    isUpdate: boolean
  ): T {
    const prepared = { ...entity };

    if (isUpdate) {
      prepared.lastModified = Date.now();
      prepared.version = entity.version + 1;
      prepared.syncStatus = 'PENDING';
    } else {
      // Nueva entidad
      prepared.createdAt = Date.now();
      prepared.lastModified = Date.now();
      prepared.version = 1;
      prepared.syncStatus = 'PENDING';
    }

    return prepared;
  }

  /**
   * Actualiza una entidad local con datos del servidor después de sync exitoso
   * @param local - Entidad local actual
   * @param serverData - Datos recibidos del servidor
   * @returns Entidad actualizada
   */
  static applyServerResponse<T extends OfflineEntity>(
    local: T,
    serverData: Partial<T> & { id: string }
  ): T {
    const updated = {
      ...local,
      ...serverData,
      syncStatus: 'SYNCED' as const,
      syncedAt: Date.now(),
      lastModified: serverData.lastModified || local.lastModified,
      version: serverData.version || local.version
    };

    // Eliminar tempId si existe y tenemos ID real del servidor
    if (serverData.id && !serverData.id.startsWith('temp_')) {
      delete updated.tempId;
    }

    return updated;
  }
}

// Exportar como namespace para uso conveniente
export const lww = LWWStrategy;
