/**
 * Módulo offline-first para Galeno
 *
 * Proporciona almacenamiento local con IndexedDB, sincronización automática
 * cuando hay conexión, y resolución de conflictos con Last Write Wins (LWW).
 *
 * @module @/services/offline
 */

// Tipos principales
export type {
  OfflineEntity,
  QueuedOperation,
  OperationType,
  SyncStatus,
  SyncResult,
  SyncError,
  SyncProgress,
  ConflictResolutionStrategy,
  OfflineConfig
} from './types';

export { DEFAULT_OFFLINE_CONFIG } from './types';

// IndexedDB con Dexie
export { GalenoDatabase, IndexedDBService, indexedDBService } from './indexeddb';

// Cola de operaciones
export { OperationQueue, operationQueue } from './queue';
export type { EnqueueOptions, QueueFilter } from './queue';

// Estrategia LWW
export { LWWStrategy, lww } from './lww-strategy';
export type { ConflictResolutionResult, VersionComparison } from './lww-strategy';

// SyncManager
export { SyncManager, syncManager } from './sync-manager';
export type {
  SyncEventType,
  SyncEvent,
  SyncEventListener,
  SyncManagerConfig
} from './sync-manager';

// Interceptor para apiClient
export {
  offlineRequestInterceptor,
  offlineResponseInterceptor,
  offlineResponseErrorInterceptor,
  setupOfflineInterceptors
} from './interceptor';

// Composable
export { useOffline } from '@/composables/useOffline';
