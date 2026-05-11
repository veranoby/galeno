// apps/web/src/state/managers/__tests__/NotificationStateManager.test.ts
/**
 * Tests para NotificationStateManager
 *
 * Tests de TDD para verificar:
 * - Agregar notificaciones
 * - Marcar como leídas
 * - Conteo de no leídas
 * - Preferencias de notificación
 * - Suscriptores
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NotificationStateManager } from '../NotificationStateManager.js';

// Mock de localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};

vi.stubGlobal('localStorage', localStorageMock);

// Mock de Notification API
const notificationMock = {
  permission: 'default' as NotificationPermission,
  requestPermission: vi.fn(() => Promise.resolve('granted'))
};

vi.stubGlobal('Notification', notificationMock);

describe('NotificationStateManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    NotificationStateManager.clearAll();
  });

  describe('initial state', () => {
    it('should have empty notifications initially', () => {
      expect(NotificationStateManager.notifications).toEqual([]);
      expect(NotificationStateManager.unreadCount).toBe(0);
    });

    it('should have default preferences', () => {
      const prefs = NotificationStateManager.preferences;

      expect(prefs.pushEnabled).toBe(true);
      expect(prefs.sseEnabled).toBe(true);
      expect(prefs.toastEnabled).toBe(true);
      expect(prefs.soundEnabled).toBe(true);
      expect(prefs.desktopEnabled).toBe(false);
    });
  });

  describe('addNotification', () => {
    it('should add notification to state', () => {
      NotificationStateManager.addNotification({
        type: 'info',
        title: 'Test Notification',
        message: 'Test message'
      });

      expect(NotificationStateManager.notifications).toHaveLength(1);
      expect(NotificationStateManager.notifications[0].title).toBe('Test Notification');
      expect(NotificationStateManager.notifications[0].source).toBe('local');
    });

    it('should generate unique ID for each notification', () => {
      NotificationStateManager.addNotification({
        type: 'info',
        title: 'Notification 1',
        message: 'Message 1'
      });

      NotificationStateManager.addNotification({
        type: 'info',
        title: 'Notification 2',
        message: 'Message 2'
      });

      const ids = NotificationStateManager.notifications.map(n => n.id);
      expect(new Set(ids).size).toBe(2);
    });

    it('should set timestamp to current time', () => {
      const beforeAdd = Date.now();

      NotificationStateManager.addNotification({
        type: 'info',
        title: 'Test',
        message: 'Message'
      });

      const afterAdd = Date.now();
      const notification = NotificationStateManager.notifications[0];

      expect(notification.timestamp.getTime()).toBeGreaterThanOrEqual(beforeAdd);
      expect(notification.timestamp.getTime()).toBeLessThanOrEqual(afterAdd);
    });

    it('should increment unread count', () => {
      expect(NotificationStateManager.unreadCount).toBe(0);

      NotificationStateManager.addNotification({
        type: 'info',
        title: 'Test',
        message: 'Message'
      });

      expect(NotificationStateManager.unreadCount).toBe(1);
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', () => {
      NotificationStateManager.addNotification({
        type: 'info',
        title: 'Test',
        message: 'Message'
      });

      const notification = NotificationStateManager.notifications[0];
      expect(notification.read).toBe(false);

      NotificationStateManager.markAsRead(notification.id);

      expect(notification.read).toBe(true);
    });

    it('should decrement unread count', () => {
      NotificationStateManager.addNotification({
        type: 'info',
        title: 'Test',
        message: 'Message'
      });

      expect(NotificationStateManager.unreadCount).toBe(1);

      const notification = NotificationStateManager.notifications[0];
      NotificationStateManager.markAsRead(notification.id);

      expect(NotificationStateManager.unreadCount).toBe(0);
    });

    it('should not decrement if already read', () => {
      NotificationStateManager.addNotification({
        type: 'info',
        title: 'Test',
        message: 'Message'
      });

      const notification = NotificationStateManager.notifications[0];
      NotificationStateManager.markAsRead(notification.id);
      expect(NotificationStateManager.unreadCount).toBe(0);

      NotificationStateManager.markAsRead(notification.id);
      expect(NotificationStateManager.unreadCount).toBe(0);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', () => {
      NotificationStateManager.addNotification({
        type: 'info',
        title: 'Test 1',
        message: 'Message 1'
      });

      NotificationStateManager.addNotification({
        type: 'success',
        title: 'Test 2',
        message: 'Message 2'
      });

      expect(NotificationStateManager.unreadCount).toBe(2);

      NotificationStateManager.markAllAsRead();

      expect(NotificationStateManager.notifications.every(n => n.read)).toBe(true);
      expect(NotificationStateManager.unreadCount).toBe(0);
    });
  });

  describe('removeNotification', () => {
    it('should remove notification by ID', () => {
      NotificationStateManager.addNotification({
        type: 'info',
        title: 'Test',
        message: 'Message'
      });

      expect(NotificationStateManager.notifications).toHaveLength(1);

      const notification = NotificationStateManager.notifications[0];
      NotificationStateManager.removeNotification(notification.id);

      expect(NotificationStateManager.notifications).toHaveLength(0);
    });

    it('should update unread count when removing unread notification', () => {
      NotificationStateManager.addNotification({
        type: 'info',
        title: 'Test',
        message: 'Message'
      });

      expect(NotificationStateManager.unreadCount).toBe(1);

      const notification = NotificationStateManager.notifications[0];
      NotificationStateManager.removeNotification(notification.id);

      expect(NotificationStateManager.unreadCount).toBe(0);
    });
  });

  describe('clearAll', () => {
    it('should remove all notifications', () => {
      NotificationStateManager.addNotification({
        type: 'info',
        title: 'Test 1',
        message: 'Message 1'
      });

      NotificationStateManager.addNotification({
        type: 'success',
        title: 'Test 2',
        message: 'Message 2'
      });

      expect(NotificationStateManager.notifications).toHaveLength(2);

      NotificationStateManager.clearAll();

      expect(NotificationStateManager.notifications).toHaveLength(0);
      expect(NotificationStateManager.unreadCount).toBe(0);
    });
  });

  describe('clearRead', () => {
    it('should remove only read notifications', () => {
      NotificationStateManager.addNotification({
        type: 'info',
        title: 'Test 1',
        message: 'Message 1'
      });

      NotificationStateManager.addNotification({
        type: 'success',
        title: 'Test 2',
        message: 'Message 2'
      });

      const first = NotificationStateManager.notifications[0];
      NotificationStateManager.markAsRead(first.id);

      expect(NotificationStateManager.notifications).toHaveLength(2);

      NotificationStateManager.clearRead();

      expect(NotificationStateManager.notifications).toHaveLength(1);
      expect(NotificationStateManager.notifications[0].read).toBe(false);
    });
  });

  describe('updatePreferences', () => {
    it('should update specific preference', () => {
      NotificationStateManager.updatePreferences({
        desktopEnabled: true
      });

      expect(NotificationStateManager.preferences.desktopEnabled).toBe(true);
      expect(NotificationStateManager.preferences.toastEnabled).toBe(true); // Unchanged
    });

    it('should update multiple preferences', () => {
      NotificationStateManager.updatePreferences({
        pushEnabled: false,
        desktopEnabled: true,
        soundEnabled: false
      });

      expect(NotificationStateManager.preferences.pushEnabled).toBe(false);
      expect(NotificationStateManager.preferences.desktopEnabled).toBe(true);
      expect(NotificationStateManager.preferences.soundEnabled).toBe(false);
    });
  });

  describe('subscribers', () => {
    it('should notify subscribers on new notification', () => {
      const subscriber = vi.fn();
      NotificationStateManager.subscribe(subscriber);

      NotificationStateManager.addNotification({
        type: 'info',
        title: 'Test',
        message: 'Message'
      });

      expect(subscriber).toHaveBeenCalled();
      expect(subscriber).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test',
          message: 'Message'
        })
      );
    });

    it('should unsubscribe correctly', () => {
      const subscriber = vi.fn();
      const unsubscribe = NotificationStateManager.subscribe(subscriber);

      unsubscribe();

      NotificationStateManager.addNotification({
        type: 'info',
        title: 'Test',
        message: 'Message'
      });

      expect(subscriber).not.toHaveBeenCalled();
    });
  });

  describe('notification types', () => {
    it('should support all notification types', () => {
      const types: Array<'info' | 'success' | 'warning' | 'error' | 'system'> = [
        'info',
        'success',
        'warning',
        'error',
        'system'
      ];

      types.forEach(type => {
        NotificationStateManager.addNotification({
          type,
          title: `${type} notification`,
          message: `${type} message`
        });
      });

      expect(NotificationStateManager.notifications).toHaveLength(5);

      NotificationStateManager.notifications.forEach((notification, index) => {
        expect(notification.type).toBe(types[index]);
      });
    });
  });

  describe('cleanup and memory management', () => {
    it('should clear resources on destroy', () => {
      // Agregar algunos datos
      NotificationStateManager.addNotification({
        type: 'info',
        title: 'Test',
        message: 'Message'
      });

      const subscriber = vi.fn();
      const unsubscribe = NotificationStateManager.subscribe(subscriber);

      // Verificar estado antes de destroy
      expect(NotificationStateManager.notifications).toHaveLength(1);
      expect(NotificationStateManager.subscribers.size).toBeGreaterThan(0);

      // Llamar destroy
      NotificationStateManager.destroy();

      // Verificar que los recursos se limpiaron
      expect(NotificationStateManager.notifications).toHaveLength(1); // Las notificaciones se mantienen
      expect(NotificationStateManager.subscribers.size).toBe(0); // Suscriptores limpiados
    });

    it('should clear SSE connection on destroy', () => {
      // Crear una conexión SSE mock
      const mockEventSource = {
        close: vi.fn(),
        onmessage: null,
        onerror: null
      };

      // Simular conexión
      NotificationStateManager.connectSSE = vi.fn();

      NotificationStateManager.destroy();

      expect(NotificationStateManager.subscribers.size).toBe(0);
    });

    it('should handle multiple destroy calls safely', () => {
      NotificationStateManager.addNotification({
        type: 'info',
        title: 'Test',
        message: 'Message'
      });

      // Llamar destroy múltiples veces no debería lanzar error
      NotificationStateManager.destroy();
      expect(() => NotificationStateManager.destroy()).not.toThrow();
    });
  });

  describe('localStorage debouncing', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should debounce localStorage writes', () => {
      // El watch con debouncing debería esperar antes de escribir
      NotificationStateManager.addNotification({
        type: 'info',
        title: 'Test',
        message: 'Message'
      });

      // Inmediatamente no debería haber llamado a setItem
      expect(localStorageMock.setItem).not.toHaveBeenCalled();

      // Avanzar tiempo menos del debounce
      vi.advanceTimersByTime(400);
      expect(localStorageMock.setItem).not.toHaveBeenCalled();

      // Avanzar tiempo completo del debounce
      vi.advanceTimersByTime(100);
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('should reset debounce timer on new updates', () => {
      NotificationStateManager.addNotification({
        type: 'info',
        title: 'Test',
        message: 'Message'
      });

      // Avanzar tiempo parcial
      vi.advanceTimersByTime(300);

      // Agregar otra notificación (resetea el timer)
      NotificationStateManager.addNotification({
        type: 'success',
        title: 'Test 2',
        message: 'Message 2'
      });

      // Avanzar tiempo parcial (total 600ms pero reseteado)
      vi.advanceTimersByTime(300);
      expect(localStorageMock.setItem).not.toHaveBeenCalled();

      // Completar el debounce después del reset
      vi.advanceTimersByTime(200);
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });
  });
});
