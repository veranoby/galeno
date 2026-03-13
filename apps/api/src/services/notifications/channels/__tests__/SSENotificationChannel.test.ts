// apps/api/src/services/notifications/channels/__tests__/SSENotificationChannel.test.ts
/**
 * Tests para SSENotificationChannel
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SSENotificationChannel } from '../SSENotificationChannel.js';
import { PrismaClient } from '@prisma/client';

// Mock del SSE manager
vi.mock('../../../../services/sse/sse-manager.js', () => ({
  sseManager: {
    sendToUser: vi.fn().mockResolvedValue(undefined),
    hasUserConnection: vi.fn().mockReturnValue(true)
  }
}));

// Mock logger
vi.mock('../../../../utils/logger.js', () => ({
  logger: {
    debug: vi.fn()
  }
}));

describe('SSENotificationChannel', () => {
  let channel: SSENotificationChannel;

  beforeEach(() => {
    channel = new SSENotificationChannel();
  });

  describe('send', () => {
    it('should send SSE notification', async () => {
      const result = await channel.send('user123', {
        title: 'Test',
        message: 'Test message',
        type: 'GENERAL' as any
      });

      expect(result).toBe(true);
    });
  });

  describe('isAvailable', () => {
    it('should return true when user has connection', async () => {
      const result = await channel.isAvailable('user123');
      expect(result).toBe(true);
    });
  });

  describe('getChannelName', () => {
    it('should return "sse"', () => {
      expect(channel.getChannelName()).toBe('sse');
    });
  });
});
