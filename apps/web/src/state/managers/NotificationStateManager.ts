// apps/web/src/state/managers/NotificationStateManager.ts
/**
 * NotificationStateManager - Gestión centralizada de notificaciones
 *
 * Responsabilidades:
 * - Unificar estado de notificaciones push, SSE, toast
 * - Manejar cola de notificaciones
 * - Proveer API reactiva para componentes
 *
 * Patrones aplicados:
 * - Singleton: Una instancia única
 * - Observer Pattern: Notificar cambios de notificaciones
 * - Queue: Cola de notificaciones pendientes
 */

import { ref, computed, watch, type Ref } from 'vue';

// ============= TYPES =============

export interface AppNotification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'system';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  data?: Record<string, unknown>;
  source: 'push' | 'sse' | 'local' | 'websocket';
}

export interface NotificationPreferences {
  pushEnabled: boolean;
  sseEnabled: boolean;
  toastEnabled: boolean;
  soundEnabled: boolean;
  desktopEnabled: boolean;
}

// ============= STATE MANAGER =============

class NotificationStateManagerClass {
  // Estado privado reactivo
  private _notifications: Ref<AppNotification[]>;
  private _unreadCount: Ref<number>;
  private _preferences: Ref<NotificationPreferences>;

  // Suscriptores
  private subscribers: Set<(notification: AppNotification) => void> = new Set();

  // Conexión SSE activa
  private sseConnection: EventSource | null = null;

  // Debounce timeout para localStorage (prevenir writes excesivos)
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Cargar notificaciones desde localStorage si existen
    const savedNotifications = this.loadFromStorage();

    this._notifications = ref(savedNotifications);
    this._unreadCount = ref(this.calculateUnreadCount(this._notifications.value));
    this._preferences = ref(this.loadPreferences());

    // Watch con debouncing para localStorage writes (OPTIMIZACIÓN)
    watch(
      this._notifications,
      (notifications) => {
        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => {
          this.saveToStorage(notifications);
        }, 500); // Debounce 500ms
      },
      { deep: true }
    );

    // Watch para preferencias
    watch(
      this._preferences,
      (prefs) => {
        this.savePreferences(prefs);
      },
      { deep: true }
    );

    // Solicitar permisos de notificación desktop
    this.requestDesktopPermission();
  }

  // ============= PUBLIC API =============

  /**
   * Lista de todas las notificaciones
   */
  get notifications(): AppNotification[] {
    return this._notifications.value;
  }

  /**
   * Conteo de notificaciones no leídas
   */
  get unreadCount(): number {
    return this._unreadCount.value;
  }

  /**
   * Preferencias de notificación
   */
  get preferences(): NotificationPreferences {
    return this._preferences.value;
  }

  /**
   * Agregar una notificación (local)
   *
   * OPTIMIZACIÓN: saveToStorage() se maneja por watch con debouncing
   */
  addNotification(notification: Omit<AppNotification, 'id' | 'timestamp' | 'source'>): void {
    const newNotification: AppNotification = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2)}`,
      timestamp: new Date(),
      source: 'local'
    };

    this._notifications.value.unshift(newNotification);
    this.updateUnreadCount();

    // Mostrar toast si está habilitado
    if (this._preferences.value.toastEnabled) {
      this.showToast(newNotification);
    }

    // Mostrar notificación desktop si está habilitado
    if (this._preferences.value.desktopEnabled) {
      this.showDesktopNotification(newNotification);
    }

    // saveToStorage() manejado por watch con debouncing
  }

  /**
   * Marcar notificación como leída
   *
   * OPTIMIZACIÓN: saveToStorage() se maneja por watch con debouncing
   */
  markAsRead(notificationId: string): void {
    const notification = this._notifications.value.find(n => n.id === notificationId);
    if (notification && !notification.read) {
      notification.read = true;
      this.updateUnreadCount();
      // saveToStorage() manejado por watch con debouncing
    }
  }

  /**
   * Marcar todas como leídas
   *
   * OPTIMIZACIÓN: saveToStorage() se maneja por watch con debouncing
   */
  markAllAsRead(): void {
    this._notifications.forEach(n => n.read = true);
    this.updateUnreadCount();
    // saveToStorage() manejado por watch con debouncing
  }

  /**
   * Remover notificación
   *
   * OPTIMIZACIÓN: saveToStorage() se maneja por watch con debouncing
   */
  removeNotification(notificationId: string): void {
    this._notifications.value = this._notifications.value.filter(
      n => n.id !== notificationId
    );
    this.updateUnreadCount();
    // saveToStorage() manejado por watch con debouncing
  }

  /**
   * Limpiar todas las notificaciones
   *
   * OPTIMIZACIÓN: saveToStorage() se maneja por watch con debouncing
   */
  clearAll(): void {
    this._notifications.value = [];
    this.updateUnreadCount();
    // saveToStorage() manejado por watch con debouncing
  }

  /**
   * Limpiar notificaciones leídas
   *
   * OPTIMIZACIÓN: saveToStorage() se maneja por watch con debouncing
   */
  clearRead(): void {
    this._notifications.value = this._notifications.value.filter(n => !n.read);
    // saveToStorage() manejado por watch con debouncing
  }

  /**
   * Actualizar preferencias
   *
   * OPTIMIZACIÓN: savePreferences() se maneja por watch
   */
  updatePreferences(updates: Partial<NotificationPreferences>): void {
    this._preferences.value = {
      ...this._preferences.value,
      ...updates
    };
    // savePreferences() manejado por watch
  }

  /**
   * Suscribirse a nuevas notificaciones
   */
  subscribe(callback: (notification: AppNotification) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  /**
   * Conectar a SSE para recibir notificaciones en tiempo real
   */
  connectSSE(url: string): void {
    if (this.sseConnection) {
      this.sseConnection.close();
    }

    this.sseConnection = new EventSource(url);

    this.sseConnection.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'notification') {
          const notification: AppNotification = {
            id: data.notificationId || `sse_${Date.now()}`,
            type: data.type || 'info',
            title: data.title || '',
            message: data.message || '',
            timestamp: new Date(data.createdAt || Date.now()),
            read: data.read || false,
            data: data.data,
            source: 'sse'
          };

          this._notifications.value.unshift(notification);
          this.updateUnreadCount();

          if (this._preferences.value.toastEnabled) {
            this.showToast(notification);
          }

          this.notifySubscribers(notification);
          // saveToStorage() manejado por watch con debouncing
        }
      } catch (error) {
        console.error('Error parsing SSE notification:', error);
      }
    };

    this.sseConnection.onerror = () => {
      // Reconexión automática por el navegador
      console.warn('SSE connection error, will retry');
    };
  }

  /**
   * Desconectar SSE
   */
  disconnectSSE(): void {
    if (this.sseConnection) {
      this.sseConnection.close();
      this.sseConnection = null;
    }
  }

  /**
   * Limpia recursos (para prevenir memory leaks)
   *
   * OPTIMIZACIÓN: Cleanup de timeout y conexiones
   */
  destroy(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    this.disconnectSSE();
    this.subscribers.clear();
  }

  // ============= PRIVATE METHODS =============

  private updateUnreadCount(): void {
    this._unreadCount.value = this.calculateUnreadCount(this._notifications.value);
  }

  private calculateUnreadCount(notifications: AppNotification[]): number {
    return notifications.filter(n => !n.read).length;
  }

  private showToast(notification: AppNotification): void {
    // Usar vue-toastification o similar
    // Esto es un placeholder para la librería de toast que uses
    console.log('[Toast]', notification.title, notification.message);

    // Ejemplo con vue-toastification:
    /*
    import { useToast } from 'vue-toastification';
    const toast = useToast();
    toast(notification.message, {
      type: notification.type,
      title: notification.title
    });
    */
  }

  private async showDesktopNotification(notification: AppNotification): Promise<void> {
    if (!('Notification' in window)) return;

    if (Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/icons/icon-192.png',
        tag: notification.id,
        timestamp: notification.timestamp.getTime()
      });
    }
  }

  private async requestDesktopPermission(): Promise<void> {
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch {
        // Usuario denegó permiso
      }
    }
  }

  private notifySubscribers(notification: AppNotification): void {
    this.subscribers.forEach(callback => {
      try {
        callback(notification);
      } catch (error) {
        console.error('Error in notification subscriber:', error);
      }
    });
  }

  private loadFromStorage(): AppNotification[] {
    try {
      const saved = localStorage.getItem('galeno_notifications');
      if (!saved) return [];

      const parsed = JSON.parse(saved);

      // Convertir timestamps de string a Date
      return parsed.map((n: any) => ({
        ...n,
        timestamp: new Date(n.timestamp)
      }));
    } catch {
      // Ignore errors
    }
    return [];
  }

  /**
   * Guarda notificaciones en localStorage (método interno, llamado por watch)
   *
   * OPTIMIZACIÓN: Ahora es private y llamado solo por watch con debouncing
   */
  private saveToStorage(notifications: AppNotification[]): void {
    try {
      localStorage.setItem('galeno_notifications', JSON.stringify(notifications));
    } catch (error) {
      console.error('Error saving notifications:', error);
    }
  }

  private loadPreferences(): NotificationPreferences {
    try {
      const saved = localStorage.getItem('galeno_notification_prefs');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Ignore errors
    }
    return {
      pushEnabled: true,
      sseEnabled: true,
      toastEnabled: true,
      soundEnabled: true,
      desktopEnabled: false
    };
  }

  /**
   * Guarda preferencias en localStorage (método interno, llamado por watch)
   *
   * OPTIMIZACIÓN: Ahora es private y llamado solo por watch
   */
  private savePreferences(preferences: NotificationPreferences): void {
    try {
      localStorage.setItem('galeno_notification_prefs', JSON.stringify(preferences));
    } catch (error) {
      console.error('Error saving notification preferences:', error);
    }
  }
}

// ============= SINGLETON =============

export const NotificationStateManager = new NotificationStateManagerClass();

// ============= COMPOSABLE PARA VUE =============

/**
 * Composable para usar el NotificationStateManager en componentes Vue 3
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { useNotificationManager } from '@/state/managers/NotificationStateManager'
 *
 * const {
 *   notifications,
 *   unreadCount,
 *   addNotification,
 *   markAsRead,
 *   markAllAsRead
 * } = useNotificationManager()
 *
 * const showSuccess = () => {
 *   addNotification({
 *     type: 'success',
 *     title: 'Éxito',
 *     message: 'Operación completada'
 *   })
 * }
 * </script>
 * ```
 */
export function useNotificationManager() {
  return {
    // Estado
    notifications: NotificationStateManager.notifications,
    unreadCount: NotificationStateManager.unreadCount,
    preferences: NotificationStateManager.preferences,

    // Métodos
    addNotification: (notification: Parameters<typeof NotificationStateManager.addNotification>[0]) =>
      NotificationStateManager.addNotification(notification),

    markAsRead: (id: string) =>
      NotificationStateManager.markAsRead(id),

    markAllAsRead: () =>
      NotificationStateManager.markAllAsRead(),

    removeNotification: (id: string) =>
      NotificationStateManager.removeNotification(id),

    clearAll: () =>
      NotificationStateManager.clearAll(),

    clearRead: () =>
      NotificationStateManager.clearRead(),

    updatePreferences: (updates: Parameters<typeof NotificationStateManager.updatePreferences>[0]) =>
      NotificationStateManager.updatePreferences(updates),

    connectSSE: (url: string) =>
      NotificationStateManager.connectSSE(url),

    disconnectSSE: () =>
      NotificationStateManager.disconnectSSE(),

    subscribe: (callback: Parameters<typeof NotificationStateManager.subscribe>[0]) =>
      NotificationStateManager.subscribe(callback)
  };
}

export default NotificationStateManager;
