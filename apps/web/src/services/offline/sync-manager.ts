/**
 * SyncManager - Gestor de sincronización offline-first
 * Detecta cambios de conectividad y sincroniza la cola de operaciones
 */

import { apiClient } from '@galeno/api-client';
import { logger } from '../../utils/logger';
import { GalenoDatabase } from './indexeddb';
import { OperationQueue } from './queue';
import { LWWStrategy } from './lww-strategy';
import type {
  OfflineConfig,
  SyncResult,
  SyncError,
  SyncProgress,
  QueuedOperation,
  OfflineEntity,
  ConflictResolutionStrategy
} from './types';
import { DEFAULT_OFFLINE_CONFIG } from './types';

/**
 * Tipos de eventos emitidos por SyncManager
 */
export type SyncEventType =
  | 'sync-start'
  | 'sync-progress'
  | 'sync-complete'
  | 'sync-error'
  | 'connection-change'
  | 'conflict-detected';

/**
 * Payload de eventos de sincronización
 */
export interface SyncEvent {
  type: SyncEventType;
  data: unknown;
  timestamp: number;
}

/**
 * Listener para eventos de sincronización
 */
export type SyncEventListener = (event: SyncEvent) => void;

/**
 * Configuración extendida para SyncManager
 */
export interface SyncManagerConfig extends OfflineConfig {
  /** Endpoint base para sincronización */
  syncEndpoint: string;
  
  /** Tiempo entre heartbeats de conexión (ms) */
  connectionCheckInterval: number;
  
  /** Habilitar auto-sync cuando hay conexión */
  autoSync: boolean;
}

/**
 * Clase principal para gestión de sincronización offline-first
 */
export class SyncManager {
  private db: GalenoDatabase;
  private queue: OperationQueue;
  private config: SyncManagerConfig;
  private isOnline: boolean;
  private isSyncing: boolean;
  private listeners: Map<SyncEventType, Set<SyncEventListener>>;
  private connectionCheckIntervalId: number | null;
  private currentSyncProgress: SyncProgress;

  /**
   * Crea una instancia de SyncManager
   * @param config - Configuración opcional
   */
  constructor(config: Partial<SyncManagerConfig> = {}) {
    this.db = GalenoDatabase.getInstance();
    this.queue = OperationQueue.getInstance(config);
    this.config = {
      ...DEFAULT_OFFLINE_CONFIG,
      syncEndpoint: '/sync',
      connectionCheckInterval: 5000,
      autoSync: true,
      ...config
    };

    this.isOnline = navigator.onLine;
    this.isSyncing = false;
    this.listeners = new Map();
    this.connectionCheckIntervalId = null;
    this.currentSyncProgress = this.createInitialProgress();

    // Inicializar listeners de conexión
    this.initConnectionListeners();
  }

  /**
   * Obtiene una instancia de SyncManager
   */
  static getInstance(config?: Partial<SyncManagerConfig>): SyncManager {
    return new SyncManager(config);
  }

  /**
   * Crea objeto de progreso inicial
   */
  private createInitialProgress(): SyncProgress {
    return {
      isSyncing: false,
      percentage: 0,
      totalOperations: 0,
      processedOperations: 0,
      currentOperation: null,
      statusMessage: 'Idle'
    };
  }

  /**
   * Inicializa listeners para eventos de conexión online/offline
   */
  private initConnectionListeners(): void {
    // Listener para evento online
    const handleOnline = () => {
      logger.info('[SyncManager] Connection restored (online)');
      this.isOnline = true;
      this.emit('connection-change', { isOnline: true });

      if (this.config.autoSync) {
        this.sync().catch(err => {
          logger.error('[SyncManager] Auto-sync failed after reconnection', { error: err });
        });
      }
    };

    // Listener para evento offline
    const handleOffline = () => {
      logger.warn('[SyncManager] Connection lost (offline)');
      this.isOnline = false;
      this.emit('connection-change', { isOnline: false });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Iniciar chequeo periódico de conexión
    this.startConnectionCheck();
  }

  /**
   * Inicia chequeo periódico de conexión
   */
  private startConnectionCheck(): void {
    if (this.connectionCheckIntervalId) {
      clearInterval(this.connectionCheckIntervalId);
    }

    this.connectionCheckIntervalId = window.setInterval(() => {
      const currentlyOnline = navigator.onLine;
      if (currentlyOnline !== this.isOnline) {
        if (currentlyOnline) {
          this.isOnline = true;
          this.emit('connection-change', { isOnline: true });
        } else {
          this.isOnline = false;
          this.emit('connection-change', { isOnline: false });
        }
      }
    }, this.config.connectionCheckInterval);
  }

  /**
   * Detiene el chequeo de conexión
   */
  private stopConnectionCheck(): void {
    if (this.connectionCheckIntervalId) {
      clearInterval(this.connectionCheckIntervalId);
      this.connectionCheckIntervalId = null;
    }
  }

  /**
   * Registra un listener para eventos de sincronización
   * @param eventType - Tipo de evento a escuchar
   * @param listener - Función listener
   * @returns Función para remover el listener
   */
  on(eventType: SyncEventType, listener: SyncEventListener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener);

    // Retornar función cleanup
    return () => {
      this.listeners.get(eventType)?.delete(listener);
    };
  }

  /**
   * Emite un evento a todos los listeners registrados
   * @param eventType - Tipo de evento
   * @param data - Datos del evento
   */
  private emit(eventType: SyncEventType, data: unknown): void {
    const event: SyncEvent = {
      type: eventType,
      data,
      timestamp: Date.now()
    };

    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          logger.error('[SyncManager] Error in event listener', { error, eventType });
        }
      });
    }

    // También emitir evento global para debugging en desarrollo
    // Usamos typeof para evitar errores de TypeScript con import.meta
    try {
      // eslint-disable-next-line no-eval
      const meta = (0, eval)('import.meta');
      if (meta?.env?.DEV) {
        window.dispatchEvent(new CustomEvent('galeno-sync', { detail: event }));
      }
    } catch {
      // Ignorar errores de import.meta en entornos que no lo soportan
    }
  }

  /**
   * Verifica si hay conexión a internet
   * @returns true si está online
   */
  isConnectionAvailable(): boolean {
    return this.isOnline;
  }

  /**
   * Obtiene el estado actual de sincronización
   */
  getSyncProgress(): SyncProgress {
    return { ...this.currentSyncProgress };
  }

  /**
   * Obtiene el estado de conexión
   */
  getConnectionState(): { isOnline: boolean; isSyncing: boolean } {
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing
    };
  }

  /**
   * Calcula delay con backoff exponencial para reintentos
   * @param retryCount - Número de reintentos realizados
   * @returns Delay en milisegundos
   */
  private calculateBackoffDelay(retryCount: number): number {
    const delay = this.config.retryDelayBase * Math.pow(2, retryCount);
    return Math.min(delay, this.config.retryDelayMax);
  }

  /**
   * Ejecuta la sincronización de la cola de operaciones
   * @returns Promesa con resultado de la sincronización
   */
  async sync(): Promise<SyncResult> {
    if (this.isSyncing) {
      logger.warn('[SyncManager] Sync already in progress');
      return {
        success: false,
        syncedCount: 0,
        conflictCount: 0,
        failedCount: 0,
        errors: [{
          operationId: '',
          errorType: 'UNKNOWN',
          message: 'Sync already in progress',
          entityId: ''
        }],
        completedAt: Date.now()
      };
    }

    if (!this.isOnline) {
      logger.warn('[SyncManager] Cannot sync while offline');
      return {
        success: false,
        syncedCount: 0,
        conflictCount: 0,
        failedCount: 0,
        errors: [{
          operationId: '',
          errorType: 'NETWORK',
          message: 'No network connection',
          entityId: ''
        }],
        completedAt: Date.now()
      };
    }

    this.isSyncing = true;
    this.currentSyncProgress = {
      isSyncing: true,
      percentage: 0,
      totalOperations: 0,
      processedOperations: 0,
      currentOperation: null,
      statusMessage: 'Starting sync...'
    };

    this.emit('sync-start', { timestamp: Date.now() });

    const result: SyncResult = {
      success: true,
      syncedCount: 0,
      conflictCount: 0,
      failedCount: 0,
      errors: [],
      completedAt: Date.now()
    };

    try {
      // Consolidar operaciones antes de sincronizar
      await this.queue.consolidate();

      // Obtener todas las operaciones pendientes
      const operations = await this.queue.getAll();
      this.currentSyncProgress.totalOperations = operations.length;

      if (operations.length === 0) {
        logger.info('[SyncManager] No pending operations to sync');
        this.completeSync(result);
        return result;
      }

      logger.info(`[SyncManager] Starting sync of ${operations.length} operations`);

      // Procesar cada operación
      for (const operation of operations) {
        this.currentSyncProgress.currentOperation = operation;
        this.currentSyncProgress.statusMessage = `Syncing ${operation.type} ${operation.entityName}...`;

        try {
          const success = await this.processOperation(operation);
          
          if (success) {
            result.syncedCount++;
            await this.queue.complete(operation.id);
          } else {
            result.failedCount++;
          }
        } catch (error) {
          result.failedCount++;
          const syncError: SyncError = {
            operationId: operation.id,
            errorType: this.classifyError(error),
            message: error instanceof Error ? error.message : 'Unknown error',
            entityId: operation.entityId,
            details: { operation: operation.type }
          };
          result.errors.push(syncError);

          // Marcar operación como fallida con retry
          await this.queue.fail(operation.id, syncError.message);
        }

        this.currentSyncProgress.processedOperations++;
        this.currentSyncProgress.percentage = Math.round(
          (this.currentSyncProgress.processedOperations / this.currentSyncProgress.totalOperations) * 100
        );

        this.emit('sync-progress', { ...this.currentSyncProgress });
      }

      // Limpiar operaciones sincronizadas antiguas
      await this.queue.clearSynced();

      result.success = result.failedCount === 0;
      result.completedAt = Date.now();

      this.completeSync(result);
      return result;
    } catch (error) {
      logger.error('[SyncManager] Sync failed with error', { error });
      result.success = false;
      result.errors.push({
        operationId: '',
        errorType: 'UNKNOWN',
        message: error instanceof Error ? error.message : 'Sync failed',
        entityId: ''
      });
      this.completeSync(result);
      return result;
    }
  }

  /**
   * Completa la sincronización y actualiza estado
   * @param result - Resultado de la sincronización
   */
  private completeSync(result: SyncResult): void {
    this.isSyncing = false;
    this.currentSyncProgress.isSyncing = false;
    this.currentSyncProgress.statusMessage = result.success 
      ? `Sync complete: ${result.syncedCount} synced`
      : `Sync failed: ${result.failedCount} failed`;

    this.emit('sync-complete', result);

    if (!result.success) {
      this.emit('sync-error', { result });
    }

    logger.info('[SyncManager] Sync completed', {
      syncedCount: result.syncedCount,
      conflictCount: result.conflictCount,
      failedCount: result.failedCount,
      success: result.success
    });
  }

  /**
   * Procesa una operación individual de la cola
   * @param operation - Operación a procesar
   * @returns true si fue exitosa
   */
  private async processOperation(operation: QueuedOperation): Promise<boolean> {
    const endpoint = `${this.config.syncEndpoint}/${operation.entityName}`;
    
    // Verificar si hay conflicto antes de sincronizar
    const hasConflict = await this.checkConflict(operation);
    
    if (hasConflict) {
      return await this.handleConflict(operation);
    }

    // Ejecutar operación según tipo
    switch (operation.type) {
      case 'CREATE':
        return await this.executeCreate(operation, endpoint);
      case 'UPDATE':
        return await this.executeUpdate(operation, endpoint);
      case 'DELETE':
        return await this.executeDelete(operation, endpoint);
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  /**
   * Verifica si hay conflicto para una operación
   */
  private async checkConflict(operation: QueuedOperation): Promise<boolean> {
    try {
      // Obtener entidad local
      const table = this.db.getTable(operation.entityName);
      const localEntity = await table.get(operation.entityId);

      if (!localEntity) {
        return false;
      }

      // Obtener versión del servidor
      const response = await apiClient.get<OfflineEntity>(
        `/${operation.entityName}/${operation.entityId}`
      );

      if (!response.success || !response.data) {
        return false;
      }

      // Usar LWW para detectar conflicto
      const comparison = LWWStrategy.compareVersions(localEntity, response.data);
      return comparison.hasConflict;
    } catch {
      return false;
    }
  }

  /**
   * Maneja conflicto usando estrategia LWW
   */
  private async handleConflict(operation: QueuedOperation): Promise<boolean> {
    logger.info('[SyncManager] Conflict detected for operation', { operation });

    try {
      // Obtener entidad local
      const table = this.db.getTable(operation.entityName);
      const localEntity = await table.get(operation.entityId);

      if (!localEntity) {
        await this.queue.complete(operation.id);
        return true;
      }

      // Obtener entidad del servidor
      const response = await apiClient.get<OfflineEntity>(
        `/${operation.entityName}/${operation.entityId}`
      );

      if (!response.success || !response.data) {
        throw new Error('Failed to fetch server version for conflict resolution');
      }

      // Resolver conflicto con LWW
      const resolution = LWWStrategy.resolve(localEntity, response.data);

      // Emitir evento de conflicto
      this.emit('conflict-detected', {
        entityId: operation.entityId,
        entityName: operation.entityName,
        resolution,
        strategy: this.config.defaultConflictStrategy
      });

      // Actualizar entidad local con resolución
      await table.put(resolution.resolved);

      // Si la resolución usa versión del servidor, marcar como completada
      if (resolution.serverVersionUsed) {
        await this.queue.complete(operation.id);
        return true;
      }

      // Si usa versión local, reintentar la operación
      return await this.executeCreate(operation, `${this.config.syncEndpoint}/${operation.entityName}`);
    } catch (error) {
      logger.error('[SyncManager] Conflict resolution failed', { error, operation });
      return false;
    }
  }

  /**
   * Ejecuta operación CREATE
   */
  private async executeCreate(operation: QueuedOperation, endpoint: string): Promise<boolean> {
    const response = await apiClient.post(endpoint, operation.payload);

    if (!response.success) {
      throw new Error(response.error || 'Create failed');
    }

    // Actualizar entidad local con ID del servidor si es necesario
    const responseData = response.data as Record<string, unknown> | undefined;
    if (operation.payload?.tempId && responseData?.id) {
      const table = this.db.getTable(operation.entityName);
      await table.update(operation.entityId, {
        id: responseData.id as string,
        tempId: undefined
      });
    }

    return true;
  }

  /**
   * Ejecuta operación UPDATE
   */
  private async executeUpdate(operation: QueuedOperation, endpoint: string): Promise<boolean> {
    const response = await apiClient.put(`${endpoint}/${operation.entityId}`, operation.payload);
    
    if (!response.success) {
      throw new Error(response.error || 'Update failed');
    }

    return true;
  }

  /**
   * Ejecuta operación DELETE
   */
  private async executeDelete(operation: QueuedOperation, endpoint: string): Promise<boolean> {
    const response = await apiClient.delete(`${endpoint}/${operation.entityId}`);
    
    if (!response.success && response.error !== 'Not found') {
      throw new Error(response.error || 'Delete failed');
    }

    // Eliminar entidad local
    const table = this.db.getTable(operation.entityName);
    await table.delete(operation.entityId);

    return true;
  }

  /**
   * Clasifica el tipo de error para manejo apropiado
   */
  private classifyError(error: unknown): SyncError['errorType'] {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (message.includes('network') || message.includes('fetch')) {
        return 'NETWORK';
      }
      if (message.includes('conflict')) {
        return 'CONFLICT';
      }
      if (message.includes('validation') || message.includes('invalid')) {
        return 'VALIDATION';
      }
      if (message.includes('server') || message.includes('500')) {
        return 'SERVER';
      }
    }
    return 'UNKNOWN';
  }

  /**
   * Fuerza una sincronización manual
   * @returns Promesa con resultado
   */
  async forceSync(): Promise<SyncResult> {
    logger.info('[SyncManager] Force sync triggered');
    return this.sync();
  }

  /**
   * Obtiene operaciones pendientes agrupadas
   * @returns Promesa con operaciones agrupadas por entidad
   */
  async getPendingChanges(): Promise<Map<string, QueuedOperation[]>> {
    return this.queue.getGroupedByEntity();
  }

  /**
   * Obtiene conteo de operaciones pendientes
   * @returns Promesa con el conteo
   */
  async getPendingCount(): Promise<number> {
    return this.queue.getCount();
  }

  /**
   * Limpia la cola de operaciones
   */
  async clearQueue(): Promise<void> {
    await this.queue.clearAll();
    logger.info('[SyncManager] Queue cleared');
  }

  /**
   * Destruye el SyncManager y limpia recursos
   */
  destroy(): void {
    this.stopConnectionCheck();
    this.listeners.clear();
    logger.info('[SyncManager] Destroyed');
  }
}

// Exportar instancia singleton
export const syncManager = SyncManager.getInstance();
