import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useSSE } from './useSSE';
import { useAuthStore } from '@/stores/auth';

export interface TriageNotification {
  type: 'TRIAGE_COMPLETED' | 'TRIAGE_UPDATE';
  data: {
    consultaId: string;
    pacienteId: string;
    pacienteNombre: string;
    doctorId: string;
    timestamp: string;
    triajeData?: any;
    consulta?: {
      id: string;
      estado: string;
      fechaConsulta?: string;
      motivoConsulta?: string;
    };
  };
  timestamp: number;
}

export interface UseTriageNotificationsOptions {
  autoRefresh?: boolean;
  showNotifications?: boolean;
  onNotification?: (notification: TriageNotification) => void;
}

/**
 * Composable for managing triage notifications via SSE
 * Used by doctors to receive real-time triage completion alerts
 */
export function useTriageNotifications(options: UseTriageNotificationsOptions = {}) {
  const {
    autoRefresh = true,
    showNotifications = true,
    onNotification
  } = options;

  const authStore = useAuthStore();
  const { connected } = useSSE(authStore.user?.id || '');

  const notifications = ref<TriageNotification[]>([]);
  const unreadCount = ref(0);
  const lastNotification = ref<TriageNotification | null>(null);
  const showBadge = ref(false);

  const hasUnreadNotifications = computed(() => unreadCount.value > 0);

  /**
   * Add a new triage notification
   */
  const addNotification = (notification: TriageNotification) => {
    notifications.value.unshift(notification);
    unreadCount.value++;
    lastNotification.value = notification;
    showBadge.value = true;

    if (onNotification) {
      onNotification(notification);
    }

    // Keep only last 50 notifications
    if (notifications.value.length > 50) {
      notifications.value = notifications.value.slice(0, 50);
    }
  };

  /**
   * Mark notification as read
   */
  const markAsRead = (notificationId: number) => {
    const notification = notifications.value[notificationId];
    if (notification) {
      unreadCount.value = Math.max(0, unreadCount.value - 1);
    }
  };

  /**
   * Mark all notifications as read
   */
  const markAllAsRead = () => {
    unreadCount.value = 0;
    showBadge.value = false;
  };

  /**
   * Clear all notifications
   */
  const clearNotifications = () => {
    notifications.value = [];
    unreadCount.value = 0;
    lastNotification.value = null;
    showBadge.value = false;
  };

  /**
   * Handle incoming SSE message
   */
  const handleSSEMessage = (event: CustomEvent) => {
    const data = event.detail;
    
    if (data.type === 'TRIAGE_COMPLETED') {
      const notification: TriageNotification = {
        type: 'TRIAGE_COMPLETED',
        data: data.data,
        timestamp: data.timestamp
      };

      addNotification(notification);

      // Auto-refresh queue if enabled
      if (autoRefresh) {
        // Trigger custom event for components to listen
        window.dispatchEvent(new CustomEvent('triage-notification-received', {
          detail: notification
        }));
      }
    }
  };

  /**
   * Show toast notification
   */
  const showToastNotification = (notification: TriageNotification) => {
    if (!showNotifications) return;

    // Dispatch custom event for toast systems to listen
    window.dispatchEvent(new CustomEvent('show-toast', {
      detail: {
        title: 'Nuevo Triaje Completado',
        message: `El paciente ${notification.data.pacienteNombre} está listo para atención`,
        type: 'success',
        timeout: 5000
      }
    }));
  };

  onMounted(() => {
    // Listen for SSE messages globally
    window.addEventListener('sse-message', handleSSEMessage as EventListener);
    
    // Listen for custom toast events
    if (showNotifications) {
      window.addEventListener('triage-notification-received', ((event: CustomEvent) => {
        showToastNotification(event.detail);
      }) as EventListener);
    }
  });

  onUnmounted(() => {
    window.removeEventListener('sse-message', handleSSEMessage as EventListener);
    window.removeEventListener('triage-notification-received', ((event: CustomEvent) => {
      showToastNotification(event.detail);
    }) as EventListener);
  });

  return {
    // State
    notifications,
    unreadCount,
    lastNotification,
    hasUnreadNotifications,
    connected,

    // Actions
    markAsRead,
    markAllAsRead,
    clearNotifications,
    addNotification
  };
}
