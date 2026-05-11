/**
 * Composable useOffline para gestión reactiva del estado offline
 * Proporciona estado de conexión, sincronización y notificaciones toast
 */

import { ref, computed, onMounted, onUnmounted, readonly, type Ref, type ComputedRef } from 'vue';
import { syncManager, type SyncEventListener, type SyncEvent } from '../services/offline/sync-manager';
import type { SyncProgress, QueuedOperation } from '../services/offline/types';
import { logger } from '../utils/logger';

/**
 * Opciones para el composable useOffline
 */
export interface UseOfflineOptions {
  /** Habilitar notificaciones toast (default: true) */
  enableNotifications?: boolean;
  
  /** Auto-sync al recuperar conexión (default: true) */
  autoSync?: boolean;
  
  /** Intervalo de polling para actualizar estado (ms, default: 0 = sin polling) */
  pollingInterval?: number;
}

/**
 * Resultado del composable useOffline
 */
export interface UseOfflineReturn {
  /** Estado de conexión (true = offline) */
  isOffline: Readonly<Ref<boolean>>;
  
  /** Estado de sincronización en curso */
  isSyncing: Readonly<Ref<boolean>>;
  
  /** Número de operaciones pendientes */
  pendingCount: Readonly<Ref<number>>;
  
  /** Progreso actual de sincronización */
  syncProgress: Readonly<Ref<SyncProgress>>;
  
  /** Indica si hay conexión disponible */
  isOnline: ComputedRef<boolean>;
  
  /** Indica si hay operaciones pendientes */
  hasPendingChanges: ComputedRef<boolean>;
  
  /** Porcentaje de progreso de sincronización */
  syncPercentage: ComputedRef<number>;
  
  /** Mensaje de estado actual */
  statusMessage: ComputedRef<string>;
  
  /**
   * Fuerza una sincronización manual
   */
  sync: () => Promise<void>;
  
  /**
   * Obtiene las operaciones pendientes agrupadas
   */
  getPendingChanges: () => Promise<Map<string, QueuedOperation[]>>;
  
  /**
   * Obtiene el conteo actualizado de pendientes
   */
  refreshPendingCount: () => Promise<void>;
}

// Referencia global para notificaciones toast (se inicializa en useNotifications)
let showToastRef: ((message: string, type?: 'success' | 'error' | 'info' | 'warning') => void) | null = null;

/**
 * Configura la función de toast para el composable
 * Debe llamarse desde el setup de la app principal
 */
export function setToastFunction(
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void
): void {
  showToastRef = showToast;
}

/**
 * Muestra notificación toast si está configurada
 */
function notify(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info'): void {
  if (showToastRef) {
    showToastRef(message, type);
  }
  logger.debug(`[useOffline] Notification: ${message}`, { type });
}

/**
 * Composable para gestión del estado offline-first
 * Proporciona estado reactivo y métodos para sincronización
 * 
 * @example
 * ```vue
 * <script setup lang="ts">
 * const { isOffline, isSyncing, pendingCount, sync } = useOffline();
 * </script>
 * 
 * <template>
 *   <div v-if="isOffline" class="offline-banner">
 *     Sin conexión - {{ pendingCount }} cambios pendientes
 *   </div>
 *   <v-btn :loading="isSyncing" @click="sync">
 *     Sincronizar
 *   </v-btn>
 * </template>
 * ```
 */
export function useOffline(options: UseOfflineOptions = {}): UseOfflineReturn {
  const {
    enableNotifications = true,
    autoSync = true,
    pollingInterval = 0
  } = options;

  // Estado reactivo
  const isOffline = ref(!navigator.onLine);
  const isSyncing = ref(false);
  const pendingCount = ref(0);
  const syncProgress = ref<SyncProgress>({
    isSyncing: false,
    percentage: 0,
    totalOperations: 0,
    processedOperations: 0,
    currentOperation: null,
    statusMessage: 'Idle'
  });

  // Computed properties
  const isOnline = computed(() => !isOffline.value);
  const hasPendingChanges = computed(() => pendingCount.value > 0);
  const syncPercentage = computed(() => syncProgress.value.percentage);
  const statusMessage = computed(() => syncProgress.value.statusMessage);

  // Referencias a listeners para cleanup
  let cleanupConnectionListener: (() => void) | null = null;
  let cleanupSyncStartListener: (() => void) | null = null;
  let cleanupSyncProgressListener: (() => void) | null = null;
  let cleanupSyncCompleteListener: (() => void) | null = null;
  let cleanupSyncErrorListener: (() => void) | null = null;
  let pollingIntervalId: number | null = null;

  /**
   * Actualiza el conteo de operaciones pendientes
   */
  async function refreshPendingCount(): Promise<void> {
    try {
      const count = await syncManager.getPendingCount();
      pendingCount.value = count;
    } catch (error) {
      logger.error('[useOffline] Failed to refresh pending count', { error });
    }
  }

  /**
   * Maneja cambios de conexión
   */
  function handleConnectionChange(data: { isOnline: boolean }): void {
    isOffline.value = !data.isOnline;
    
    if (enableNotifications) {
      if (data.isOnline) {
        notify('Conexión restaurada', 'success');
      } else {
        notify('Sin conexión - los cambios se guardarán localmente', 'warning');
      }
    }

    // Actualizar pending count cuando cambia la conexión
    refreshPendingCount();
  }

  /**
   * Maneja inicio de sincronización
   */
  function handleSyncStart(): void {
    isSyncing.value = true;
    
    if (enableNotifications) {
      notify('Sincronizando cambios...', 'info');
    }
  }

  /**
   * Maneja progreso de sincronización
   */
  function handleSyncProgress(data: SyncProgress): void {
    syncProgress.value = { ...data };
  }

  /**
   * Maneja completado de sincronización
   */
  function handleSyncComplete(data: {
    success: boolean;
    syncedCount: number;
    conflictCount: number;
    failedCount: number;
  }): void {
    isSyncing.value = false;
    
    if (enableNotifications) {
      if (data.success) {
        let message = `Sincronización completada: ${data.syncedCount} elementos`;
        if (data.conflictCount > 0) {
          message += `, ${data.conflictCount} conflictos resueltos`;
        }
        notify(message, 'success');
      } else {
        notify(
          `Sincronización fallida: ${data.failedCount} errores`,
          'error'
        );
      }
    }

    // Actualizar pending count después de sync
    refreshPendingCount();
  }

  /**
   * Maneja error de sincronización
   */
  function handleSyncError(data: { result: { errors: Array<{ message: string }> } }): void {
    isSyncing.value = false;
    
    if (enableNotifications) {
      const errorMessage = data.result.errors[0]?.message || 'Error de sincronización';
      notify(errorMessage, 'error');
    }
  }

  /**
   * Inicia polling periódico para actualizar estado
   */
  function startPolling(): void {
    if (pollingInterval <= 0) return;

    pollingIntervalId = window.setInterval(() => {
      refreshPendingCount();
    }, pollingInterval);
  }

  /**
   * Detiene el polling
   */
  function stopPolling(): void {
    if (pollingIntervalId) {
      clearInterval(pollingIntervalId);
      pollingIntervalId = null;
    }
  }

  /**
   * Ejecuta sincronización manual
   */
  async function sync(): Promise<void> {
    if (isOffline.value) {
      if (enableNotifications) {
        notify('Sin conexión para sincronizar', 'warning');
      }
      return;
    }

    try {
      await syncManager.forceSync();
    } catch (error) {
      logger.error('[useOffline] Manual sync failed', { error });
      if (enableNotifications) {
        notify('Error al sincronizar', 'error');
      }
    }
  }

  /**
   * Obtiene cambios pendientes agrupados por entidad
   */
  async function getPendingChanges(): Promise<Map<string, QueuedOperation[]>> {
    return syncManager.getPendingChanges();
  }

  // Suscribirse a eventos del SyncManager
  onMounted(() => {
    // Estado inicial
    isOffline.value = !navigator.onLine;
    refreshPendingCount();

    // Suscribirse a eventos
    cleanupConnectionListener = syncManager.on('connection-change', (event: SyncEvent) => {
      handleConnectionChange(event.data as { isOnline: boolean });
    });

    cleanupSyncStartListener = syncManager.on('sync-start', () => {
      handleSyncStart();
    });

    cleanupSyncProgressListener = syncManager.on('sync-progress', (event: SyncEvent) => {
      handleSyncProgress(event.data as SyncProgress);
    });

    cleanupSyncCompleteListener = syncManager.on('sync-complete', (event: SyncEvent) => {
      handleSyncComplete(event.data as {
        success: boolean;
        syncedCount: number;
        conflictCount: number;
        failedCount: number;
      });
    });

    cleanupSyncErrorListener = syncManager.on('sync-error', (event: SyncEvent) => {
      handleSyncError(event.data as { result: { errors: Array<{ message: string }> } });
    });

    // Iniciar polling si está configurado
    startPolling();

    logger.info('[useOffline] Composable mounted');
  });

  // Cleanup al desmontar
  onUnmounted(() => {
    cleanupConnectionListener?.();
    cleanupSyncStartListener?.();
    cleanupSyncProgressListener?.();
    cleanupSyncCompleteListener?.();
    cleanupSyncErrorListener?.();
    stopPolling();

    logger.info('[useOffline] Composable unmounted');
  });

  return {
    // Estado reactivo
    isOffline: readonly(isOffline),
    isSyncing: readonly(isSyncing),
    pendingCount: readonly(pendingCount),
    syncProgress: readonly(syncProgress),

    // Computed
    isOnline,
    hasPendingChanges,
    syncPercentage,
    statusMessage,

    // Métodos
    sync,
    getPendingChanges,
    refreshPendingCount
  };
}

export default useOffline;
