/**
 * Tipos para el sistema offline-first de Galeno
 * Define estructuras para entidades offline, operaciones en cola,
 * estados de sincronización y estrategias de resolución de conflictos.
 */

/**
 * Estrategias disponibles para resolución de conflictos
 */
export type ConflictResolutionStrategy =
  | 'LWW' // Last Write Wins - usa el timestamp más reciente
  | 'SERVER_WINS' // La versión del servidor prevalece
  | 'CLIENT_WINS' // La versión del cliente prevalece
  | 'MERGE' // Intenta merge automático de campos
  | 'MANUAL'; // Requiere intervención del usuario

/**
 * Estados posibles de sincronización para una entidad
 */
export type SyncStatus =
  | 'SYNCED' // Sincronizado con el servidor
  | 'PENDING' // Pendiente de sincronización
  | 'CONFLICT' // Tiene conflicto con el servidor
  | 'FAILED' // Falló la sincronización
  | 'QUEUED'; // En cola para sincronización

/**
 * Tipos de operaciones que pueden encolarse para sincronización
 */
export type OperationType = 'CREATE' | 'UPDATE' | 'DELETE';

/**
 * Entidad base para todos los objetos que soportan offline-first
 * Incluye metadatos para tracking de sincronización
 */
export interface OfflineEntity {
  /** Identificador único de la entidad */
  id: string;
  
  /** Timestamp de creación en el cliente (ms desde epoch) */
  createdAt: number;
  
  /** Timestamp de última modificación local (ms desde epoch) */
  lastModified: number;
  
  /** Timestamp de última sincronización exitosa (ms desde epoch) */
  syncedAt: number | null;
  
  /** Versión de la entidad para control de conflictos */
  version: number;
  
  /** Estado actual de sincronización */
  syncStatus: SyncStatus;
  
  /** ID temporal para entidades creadas offline (se reemplaza al sincronizar) */
  tempId?: string;
}

/**
 * Operación encolada para sincronización posterior
 */
export interface QueuedOperation {
  /** Identificador único de la operación */
  id: string;
  
  /** Tipo de operación */
  type: OperationType;
  
  /** Nombre de la entidad/tabla (pacientes, consultas, documentos) */
  entityName: string;
  
  /** ID de la entidad afectada */
  entityId: string;
  
  /** Datos de la operación (payload para CREATE/UPDATE, null para DELETE) */
  payload: Record<string, unknown> | null;
  
  /** Timestamp de creación de la operación */
  createdAt: number;
  
  /** Número de reintentos realizados */
  retryCount: number;
  
  /** Timestamp del último intento */
  lastAttemptAt: number | null;
  
  /** Error del último intento (si falló) */
  lastError: string | null;
  
  /** Prioridad de la operación (mayor número = mayor prioridad) */
  priority: number;
}

/**
 * Resultado de una operación de sincronización
 */
export interface SyncResult {
  /** Indica si la sincronización fue exitosa */
  success: boolean;
  
  /** Número de entidades sincronizadas */
  syncedCount: number;
  
  /** Número de conflictos detectados */
  conflictCount: number;
  
  /** Número de operaciones fallidas */
  failedCount: number;
  
  /** Detalles de errores (si los hay) */
  errors: SyncError[];
  
  /** Timestamp de finalización */
  completedAt: number;
}

/**
 * Error detallado de sincronización
 */
export interface SyncError {
  /** ID de la operación fallida */
  operationId: string;
  
  /** Tipo de error */
  errorType: 'NETWORK' | 'CONFLICT' | 'VALIDATION' | 'SERVER' | 'UNKNOWN';
  
  /** Mensaje descriptivo del error */
  message: string;
  
  /** Entidad afectada */
  entityId: string;
  
  /** Stack trace o detalles adicionales */
  details?: Record<string, unknown>;
}

/**
 * Progreso de sincronización
 */
export interface SyncProgress {
  /** Indica si hay sincronización en curso */
  isSyncing: boolean;
  
  /** Porcentaje completado (0-100) */
  percentage: number;
  
  /** Número total de operaciones pendientes */
  totalOperations: number;
  
  /** Número de operaciones procesadas */
  processedOperations: number;
  
  /** Operación actual siendo procesada */
  currentOperation: QueuedOperation | null;
  
  /** Mensaje de estado descriptivo */
  statusMessage: string;
}

/**
 * Configuración del sistema offline
 */
export interface OfflineConfig {
  /** Nombre de la base de datos IndexedDB */
  dbName: string;
  
  /** Versión del schema de la base de datos */
  dbVersion: number;
  
  /** Máximo número de operaciones en cola antes de LRU eviction */
  maxQueueSize: number;
  
  /** Tiempo máximo de retención de operaciones sincronizadas (ms) */
  syncedOperationTTL: number;
  
  /** Estrategia por defecto para resolución de conflictos */
  defaultConflictStrategy: ConflictResolutionStrategy;
  
  /** Número máximo de reintentos para operaciones fallidas */
  maxRetries: number;
  
  /** Delay base para backoff exponencial (ms) */
  retryDelayBase: number;
  
  /** Delay máximo para backoff exponencial (ms) */
  retryDelayMax: number;
}

/**
 * Configuración por defecto del sistema offline
 */
export const DEFAULT_OFFLINE_CONFIG: OfflineConfig = {
  dbName: 'galeno-offline-db',
  dbVersion: 1,
  maxQueueSize: 1000,
  syncedOperationTTL: 24 * 60 * 60 * 1000, // 24 horas
  defaultConflictStrategy: 'LWW',
  maxRetries: 5,
  retryDelayBase: 1000, // 1 segundo
  retryDelayMax: 60000, // 1 minuto
};
