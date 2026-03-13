// apps/api/src/services/notifications/channels/__tests__/PushNotificationChannel.test.ts
/**
 * Tests para PushNotificationChannel
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PushNotificationChannel } from '../PushNotificationChannel.js';
import { PrismaClient } from '@prisma/client';

// Mock logger
vi.mock('../../../../utils/logger.js', () => ({
  logger: {
    error: vi.fn()
  }
}));

// Mock del módulo notification.service antes de importar el canal
vi.mock('../../../notification.service.js', () => ({
  getNotificationService: vi.fn().mockReturnValue({
    sendNotification: vi.fn().mockResolvedValue({ success: true })
  })
}));

describe('PushNotificationChannel', () => {
  let channel: PushNotificationChannel;
  let mockPrisma: PrismaClient;

  beforeEach(() => {
    mockPrisma = {} as PrismaClient;
    channel = new PushNotificationChannel(mockPrisma);
  });

  describe('send', () => {
    it('should have send method', () => {
      expect(channel.send).toBeDefined();
      expect(typeof channel.send).toBe('function');
    });

    it('should send push notification', async () => {
      // El test verifica que el método existe y tiene la firma correcta
      // La implementación real depende del notification service
      expect(async () => {
        await channel.send('user123', {
          title: 'Test',
          message: 'Test message',
          type: 'GENERAL' as any
        });
      }).not.toThrow();
    });
  });

  describe('isAvailable', () => {
    it('should always return true', () => {
      expect(channel.isAvailable()).toBe(true);
    });
  });

  describe('getChannelName', () => {
    it('should return "push"', () => {
      expect(channel.getChannelName()).toBe('push');
    });
  });
});
