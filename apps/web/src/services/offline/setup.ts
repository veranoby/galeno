/**
 * Setup del modo offline para Galeno
 * 
 * Inicializa:
 * - IndexedDB
 * - SyncManager
 * - Interceptors para apiClient
 * - Event listeners para online/offline
 */

import { apiClient } from '@/services/api';
import { 
  setupOfflineInterceptors,
  syncManager,
  indexedDBService,
  operationQueue
} from '@/services/offline';

/**
 * Inicializar el modo offline
 */
export async function setupOfflineMode(): Promise<void> {
  try {
    console.log('[Offline Setup] Initializing offline mode...');

    // 1. Inicializar IndexedDB (ya se inicializa con Dexie al importar)
    console.log('[Offline Setup] IndexedDB ready');

    // 2. Configurar interceptores en apiClient
    setupOfflineInterceptors(apiClient);
    console.log('[Offline Setup] API interceptors configured');

    // 3. Iniciar SyncManager (ya es singleton, solo usar)
    console.log('[Offline Setup] SyncManager ready');

    // 4. Configurar event listeners globales
    setupOnlineOfflineListeners();
    console.log('[Offline Setup] Online/offline listeners configured');

    // 5. Verificar si hay operaciones pendientes
    const pendingCount = await operationQueue.getCount();
    if (pendingCount > 0) {
      console.log(`[Offline Setup] Found ${pendingCount} pending operations`);
      
      // Si hay conexión, intentar sincronizar
      if (navigator.onLine) {
        console.log('[Offline Setup] Starting auto-sync for pending operations');
        syncManager.sync().catch(err => {
          console.error('[Offline Setup] Auto-sync failed:', err);
        });
      }
    }

    console.log('[Offline Setup] Offline mode fully initialized ✅');
  } catch (error) {
    console.error('[Offline Setup] Initialization failed:', error);
    throw error;
  }
}

/**
 * Configurar listeners para eventos online/offline
 */
async function setupOnlineOfflineListeners(): Promise<void> {
  // Online event
  window.addEventListener('online', async () => {
    console.log('[Offline Setup] Connection restored - going online');
    (syncManager as any).emit('connection-change', { isOnline: true });

    // Auto-sync cuando vuelve la conexión
    const connectionState = syncManager.getConnectionState();
    if (!connectionState.isSyncing) {
      try {
        await syncManager.sync();
      } catch (error) {
        console.error('[Offline Setup] Sync after reconnection failed:', error);
      }
    }
  });

  // Offline event
  window.addEventListener('offline', () => {
    console.log('[Offline Setup] Connection lost - going offline');
    (syncManager as any).emit('connection-change', { isOnline: false });
  });

  // Beforeunload - advertir si hay cambios pendientes
  window.addEventListener('beforeunload', async (event) => {
    const pendingCount = await syncManager.getPendingCount();
    
    if (pendingCount > 0) {
      const message = `Tienes ${pendingCount} cambios pendientes de sincronizar. ¿Estás seguro de que quieres salir?`;
      event.returnValue = message;
      return message;
    }
  });
}

/**
 * Obtener estado actual del offline mode
 */
export async function getOfflineStatus(): Promise<{
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSync: Date | null;
}> {
  return {
    isOnline: navigator.onLine,
    isSyncing: (syncManager as any).isSyncing || false,
    pendingCount: await syncManager.getPendingCount(),
    lastSync: (syncManager as any).lastSyncTime || null
  };
}
