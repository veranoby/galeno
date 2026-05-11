import { ref, Ref } from 'vue';
import { useSSE } from '@/composables/useSSE';
import { 
  Notification, 
  NotificationMethod, 
  NotificationType, 
  SendNotificationRequest, 
  SendNotificationResponse
} from '@galeno/shared-types';
import { useApi } from '@/composables/useApi';
import { pushNotificationService } from '@/services/push-notifications';

export interface NotificationOptions {
  title: string;
  message: string;
  type?: NotificationType;
  duration?: number; // For toast notifications
  method?: NotificationMethod; // Which delivery method to use
  data?: Record<string, unknown>;
}

export interface NotificationPreferences {
  pushEnabled: boolean;
  sseEnabled: boolean;
  toastEnabled: boolean;
  methods: NotificationMethod[];
}

export interface UseNotificationsReturn {
  notifications: Ref<Notification[]>;
  unreadCount: Ref<number>;
  preferences: Ref<NotificationPreferences>;
  isLoading: Ref<boolean>;
  error: Ref<string | null>;
  addNotification: (options: NotificationOptions) => void;
  markAsRead: (id: string) => Promise<boolean>;
  markAllAsRead: () => Promise<boolean>;
  updatePreferences: (prefs: Partial<NotificationPreferences>) => void;
  sendNotification: (request: SendNotificationRequest) => Promise<SendNotificationResponse>;
  getNotifications: () => Promise<Notification[]>;
  subscribeToSSE: () => void;
  unsubscribeFromSSE: () => void;
}

/**
 * Composable for managing notifications (Push, SSE, Toast).
 * Uses the centralized useApi for all network requests.
 */
export const useNotifications = (): UseNotificationsReturn => {
  const { get, post, patch, put, isLoading, error } = useApi();
  
  const notifications = ref<Notification[]>([]);
  const unreadCount = ref(0);
  const preferences = ref<NotificationPreferences>({
    pushEnabled: true,
    sseEnabled: true,
    toastEnabled: true,
    methods: [NotificationMethod.PUSH, NotificationMethod.SSE, NotificationMethod.TOAST]
  });

  // Get user ID from auth store or localStorage
  const getUserId = () => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        return user.id;
      } catch (e) {
        console.error('Failed to parse user from localStorage');
        return null;
      }
    }
    return null;
  };

  // Use the existing SSE composable to listen for notifications
  const userId = getUserId();
  const { connect, disconnect, connected } = userId ? useSSE(userId) : { connect: () => {}, disconnect: () => {}, connected: ref(false) };

  // Add a notification to the local state
  const addNotification = (options: NotificationOptions) => {
    const newNotification: Notification = {
      id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId: '', // Will be populated by backend
      title: options.title,
      message: options.message,
      type: options.type || NotificationType.INFO,
      method: options.method || NotificationMethod.TOAST,
      read: false,
      createdAt: new Date(),
      data: options.data || {}
    };

    // Add to the beginning of the array (most recent first)
    notifications.value.unshift(newNotification);

    // Update unread count
    if (!newNotification.read) {
      unreadCount.value++;
    }

    // Show toast if enabled and method is toast
    if (preferences.value.toastEnabled && 
        (options.method === NotificationMethod.TOAST || !options.method)) {
      showLocalToast(newNotification);
    }
  };

  // Show a local toast notification
  const showLocalToast = (notification: Notification) => {
    // In a real implementation, this might emit an event or use a global toast manager
    console.log('Showing toast:', notification);
  };

  // Mark a notification as read
  const markAsRead = async (id: string): Promise<boolean> => {
    const response = await patch<any>(`/api/v1/notifications/${id}/read`, {});
    if (response.success) {
      const notificationIndex = notifications.value.findIndex(n => n.id === id);
      if (notificationIndex !== -1) {
        notifications.value[notificationIndex].read = true;
        unreadCount.value = Math.max(0, unreadCount.value - 1);
      }
      return true;
    }
    return false;
  };

  // Mark all notifications as read
  const markAllAsRead = async (): Promise<boolean> => {
    const response = await patch<any>('/api/v1/notifications/read-all', {});
    if (response.success) {
      notifications.value.forEach(notification => {
        notification.read = true;
      });
      unreadCount.value = 0;
      return true;
    }
    return false;
  };

  // Send a notification via the API
  const sendNotification = async (request: SendNotificationRequest): Promise<SendNotificationResponse> => {
    const response = await post<SendNotificationResponse>('/api/v1/notifications/send', request);
    if (response.success && response.data) {
      return response.data;
    }
    return {
      success: false,
      deliveredMethods: [],
      error: error.value || 'Failed to send notification'
    };
  };

  // Get notifications from the API
  const getNotifications = async (): Promise<Notification[]> => {
    const response = await get<{ notifications: Notification[] }>('/api/v1/notifications');
    if (response.success && response.data) {
      notifications.value = response.data.notifications || [];
      unreadCount.value = notifications.value.filter((n: Notification) => !n.read).length || 0;
      return notifications.value;
    }
    return [];
  };

  // Subscribe to SSE notifications
  const subscribeToSSE = () => {
    if (userId && !connected.value) {
      connect();
      
      const handleSSEMessage = (event: CustomEvent) => {
        const data = event.detail;
        if (data.type === 'NOTIFICATION') {
          const notification: Notification = {
            id: data.data.id,
            userId: data.data.userId,
            title: data.data.title,
            message: data.data.message,
            type: data.data.type,
            method: NotificationMethod.SSE,
            read: false,
            createdAt: new Date(data.data.createdAt),
            data: data.data.data
          };
          
          notifications.value.unshift(notification);
          
          if (!notification.read) {
            unreadCount.value++;
          }
          
          if (preferences.value.toastEnabled) {
            showLocalToast(notification);
          }
        }
      };
      
      window.addEventListener('sse-message', handleSSEMessage as EventListener);
    }
  };

  // Unsubscribe from SSE notifications
  const unsubscribeFromSSE = () => {
    disconnect();
  };

  // Initialize notification preferences from localStorage or default
  const initPreferences = () => {
    const savedPrefs = localStorage.getItem('notificationPreferences');
    if (savedPrefs) {
      try {
        const parsed = JSON.parse(savedPrefs);
        preferences.value = { ...preferences.value, ...parsed };
      } catch (e) {
        console.warn('Failed to parse notification preferences from localStorage');
      }
    }
  };

  // Initialize push notifications if enabled
  const initPushNotifications = async () => {
    if (preferences.value.pushEnabled && pushNotificationService.isSupported()) {
      await pushNotificationService.registerServiceWorker();
      
      const permStatus = await pushNotificationService.requestPermission();
      if (permStatus.status === 'granted') {
        const subscription = await pushNotificationService.subscribeToPush(
          process.env.VAPID_PUBLIC_KEY || ''
        );
        
        if (subscription && userId) {
          await pushNotificationService.sendSubscriptionToServer(subscription, userId);
        }
      }
    }
  };

  // Save preferences to localStorage whenever they change
  const savePreferences = () => {
    localStorage.setItem('notificationPreferences', JSON.stringify(preferences.value));
  };

  // Watch for preference changes and save them
  preferences.value = new Proxy(preferences.value, {
    set(target, property, value) {
      (target as any)[property] = value;
      savePreferences();
      return true;
    }
  });

  // Load preferences from server
  const loadPreferences = async () => {
    const response = await get<{ preferences: NotificationPreferences }>('/api/v1/notifications/preferences');
    if (response.success && response.data) {
      preferences.value = response.data.preferences;
    }
  };

  // Update preferences on server
  const updatePreferencesOnServer = async (prefs: Partial<NotificationPreferences>) => {
    const response = await put<{ preferences: NotificationPreferences }>('/api/v1/notifications/preferences', prefs);
    if (response.success && response.data) {
      preferences.value = response.data.preferences;
    }
  };

  // Update notification preferences and sync with server
  const updatePreferences = async (prefs: Partial<NotificationPreferences>) => {
    preferences.value = {
      ...preferences.value,
      ...prefs
    };

    try {
      await updatePreferencesOnServer(prefs);
    } catch (err) {
      console.warn('Could not sync preferences with server, keeping local changes');
    }
  };

  // Initialize preferences and push notifications
  initPreferences();
  loadPreferences();
  initPushNotifications();

  return {
    notifications,
    unreadCount,
    preferences,
    isLoading,
    error,
    addNotification,
    markAsRead,
    markAllAsRead,
    updatePreferences,
    sendNotification,
    getNotifications,
    subscribeToSSE,
    unsubscribeFromSSE
  };
};
