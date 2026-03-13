// apps/api/src/services/notifications/__tests__/NotificationOrchestrator.test.ts
/**
 * Tests para NotificationOrchestrator
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotificationOrchestrator } from '../NotificationOrchestrator.js';
import { PrismaClient } from '@prisma/client';
import type { INotificationRepository } from '../../../repositories/interfaces/INotificationRepository.js';
import { NotificationMethod } from '@galeno/shared-types';

// Mock de los canales
vi.mock('../channels/PushNotificationChannel.js', () => ({
  PushNotificationChannel: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue(true),
    isAvailable: vi.fn().mockReturnValue(true),
    getChannelName: vi.fn().mockReturnValue('push')
  }))
}));

vi.mock('../channels/SSENotificationChannel.js', () => ({
  SSENotificationChannel: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue(true),
    isAvailable: vi.fn().mockResolvedValue(true),
    getChannelName: vi.fn().mockReturnValue('sse')
  }))
}));

vi.mock('../channels/WhatsAppNotificationChannel.js', () => ({
  WhatsAppNotificationChannel: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue(true),
    isAvailable: vi.fn().mockResolvedValue(true),
    getChannelName: vi.fn().mockReturnValue('whatsapp')
  }))
}));

vi.mock('../channels/ToastNotificationChannel.js', () => ({
  ToastNotificationChannel: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue(true),
    isAvailable: vi.fn().mockReturnValue(true),
    getChannelName: vi.fn().mockReturnValue('toast')
  }))
}));

// Mock logger
vi.mock('../../../utils/logger.js', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}));

describe('NotificationOrchestrator', () => {
  let orchestrator: NotificationOrchestrator;
  let mockPrisma: any;
  let mockNotificationRepo: INotificationRepository;

  beforeEach(() => {
    // Mock prisma
    mockPrisma = {};

    // Mock notification repo
    mockNotificationRepo = {
      create: vi.fn().mockResolvedValue({
        id: 'notif_123',
        userId: 'user123',
        titulo: 'Test',
        cuerpo: 'Test message',
        tipo: 'GENERAL',
        leido: false,
        datos: {},
        createdAt: new Date()
      }),
      findByUser: vi.fn().mockResolvedValue([]),
      markAsRead: vi.fn().mockResolvedValue({} as any),
      markAllAsRead: vi.fn().mockResolvedValue({ count: 1 }),
      countUnreadByUser: vi.fn().mockResolvedValue(5),
      update: vi.fn().mockResolvedValue({} as any)
    } as any;

    orchestrator = new NotificationOrchestrator(mockPrisma as PrismaClient, mockNotificationRepo);
  });

  describe('constructor', () => {
    it('should initialize all channels', () => {
      expect(orchestrator).toBeDefined();
      expect(orchestrator['pushChannel']).toBeDefined();
      expect(orchestrator['sseChannel']).toBeDefined();
      expect(orchestrator['whatsappChannel']).toBeDefined();
      expect(orchestrator['toastChannel']).toBeDefined();
    });
  });

  describe('sendNotification', () => {
    it('should send notification via specified method', async () => {
      const result = await orchestrator.sendNotification({
        userId: 'user123',
        title: 'Test',
        message: 'Test message',
        type: 'GENERAL' as any,
        method: NotificationMethod.PUSH
      });

      expect(result.success).toBe(true);
      expect(result.notificationId).toBe('notif_123');
      expect(result.deliveredMethods).toContain(NotificationMethod.PUSH);
    });

    it('should send notification via default methods (push + sse)', async () => {
      const result = await orchestrator.sendNotification({
        userId: 'user123',
        title: 'Test',
        message: 'Test message',
        type: 'GENERAL' as any
      });

      expect(result.success).toBe(true);
      expect(result.deliveredMethods.length).toBeGreaterThan(0);
    });
  });

  describe('getUserNotifications', () => {
    it('should get user notifications', async () => {
      const result = await orchestrator.getUserNotifications('user123');

      expect(mockNotificationRepo.findByUser).toHaveBeenCalledWith('user123', {
        orderBy: { createdAt: 'desc' },
        limit: 50,
        offset: 0
      });
      expect(result).toEqual([]);
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const result = await orchestrator.markAsRead('notif_123', 'user123');

      expect(result).toBe(true);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      const result = await orchestrator.markAllAsRead('user123');

      expect(result).toBe(true);
    });
  });

  describe('getUnreadCount', () => {
    it('should get unread count', async () => {
      const result = await orchestrator.getUnreadCount('user123');

      expect(result).toBe(5);
    });
  });

  describe('getPreferences', () => {
    it('should return default preferences', async () => {
      const result = await orchestrator.getPreferences('user123');

      expect(result).toEqual({
        pushEnabled: true,
        sseEnabled: true,
        toastEnabled: true,
        whatsappEnabled: true,
        methods: [
          NotificationMethod.PUSH,
          NotificationMethod.SSE,
          NotificationMethod.TOAST,
          NotificationMethod.WHATSAPP
        ]
      });
    });
  });

  describe('updatePreferences', () => {
    it('should merge preferences', async () => {
      const result = await orchestrator.updatePreferences('user123', {
        pushEnabled: false
      });

      expect(result.pushEnabled).toBe(false);
      expect(result.sseEnabled).toBe(true);
    });
  });

  describe('getAvailableChannels', () => {
    it('should return all available channels', async () => {
      const result = await orchestrator.getAvailableChannels('user123');

      expect(result).toContain('push');
      expect(result).toContain('sse');
      expect(result).toContain('whatsapp');
      expect(result).toContain('toast');
    });
  });
});
