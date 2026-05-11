import { Notification } from '@galeno/shared-types';

export interface PushNotificationPermissionStatus {
  status: 'granted' | 'denied' | 'default';
  supported: boolean;
}

export class PushNotificationService {
  private static instance: PushNotificationService;
  private swRegistration: ServiceWorkerRegistration | null = null;
  
  // Singleton pattern
  public static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  /**
   * Check if push notifications are supported in the browser
   */
  isSupported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window;
  }

  /**
   * Request permission for push notifications
   */
  async requestPermission(): Promise<PushNotificationPermissionStatus> {
    if (!this.isSupported()) {
      return { status: 'default', supported: false };
    }

    try {
      const permission = await Notification.requestPermission();
      return { status: permission as 'granted' | 'denied' | 'default', supported: true };
    } catch (error) {
      console.error('Error requesting push notification permission:', error);
      return { status: 'default', supported: true };
    }
  }

  /**
   * Register the service worker for push notifications
   */
  async registerServiceWorker(swPath: string = '/sw.js'): Promise<ServiceWorkerRegistration | null> {
    if (!this.isSupported()) {
      console.error('Push notifications are not supported in this browser');
      return null;
    }

    try {
      this.swRegistration = await navigator.serviceWorker.register(swPath);
      console.log('Service Worker registered for push notifications:', this.swRegistration);
      return this.swRegistration;
    } catch (error) {
      console.error('Error registering service worker:', error);
      return null;
    }
  }

  /**
   * Subscribe to push notifications
   */
  async subscribeToPush(vapidPublicKey: string): Promise<PushSubscription | null> {
    if (!this.swRegistration) {
      console.error('Service worker not registered');
      return null;
    }

    try {
      // Check if we already have a subscription
      let subscription = await this.swRegistration.pushManager.getSubscription();
      if (subscription) {
        return subscription;
      }

      // Get the VAPID public key as an ArrayBuffer
      const applicationServerKey = this.urlB64ToUint8Array(vapidPublicKey);
      
      // Subscribe to push notifications
      subscription = await this.swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });

      console.log('Push subscription successful:', subscription);
      return subscription;
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      return null;
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribeFromPush(): Promise<boolean> {
    if (!this.swRegistration) {
      return false;
    }

    try {
      const subscription = await this.swRegistration.pushManager.getSubscription();
      if (!subscription) {
        return true; // Already unsubscribed
      }

      const success = await subscription.unsubscribe();
      console.log('Push unsubscription successful:', success);
      return success;
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      return false;
    }
  }

  /**
   * Send subscription to server
   */
  async sendSubscriptionToServer(subscription: PushSubscription, userId: string): Promise<boolean> {
    try {
      const response = await fetch('/api/v1/notifications/push-subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          userId,
          subscription: JSON.stringify(subscription.toJSON())
        })
      });

      return response.ok;
    } catch (error) {
      console.error('Error sending subscription to server:', error);
      return false;
    }
  }

  /**
   * Remove subscription from server
   */
  async removeSubscriptionFromServer(endpoint: string, userId: string): Promise<boolean> {
    try {
      const response = await fetch('/api/v1/notifications/push-unsubscribe', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          userId,
          endpoint
        })
      });

      return response.ok;
    } catch (error) {
      console.error('Error removing subscription from server:', error);
      return false;
    }
  }

  /**
   * Show a push notification (for testing purposes)
   */
  async showNotification(notification: Notification): Promise<void> {
    if (!this.swRegistration) {
      console.error('Service worker not registered');
      return;
    }

    try {
      // Show notification through service worker
      await this.swRegistration.showNotification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: notification.id,
        data: {
          url: '/', // Default URL to open when notification is clicked
          ...notification.data
        }
      });
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }

  /**
   * Convert URL-safe base64 to Uint8Array for VAPID keys
   */
  private urlB64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  /**
   * Get current subscription
   */
  async getCurrentSubscription(): Promise<PushSubscription | null> {
    if (!this.swRegistration) {
      return null;
    }

    try {
      return await this.swRegistration.pushManager.getSubscription();
    } catch (error) {
      console.error('Error getting current subscription:', error);
      return null;
    }
  }
}

// Export a singleton instance
export const pushNotificationService = PushNotificationService.getInstance();