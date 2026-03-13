// apps/api/src/services/notifications/channels/__tests__/ToastNotificationChannel.test.ts
/**
 * Tests para ToastNotificationChannel
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ToastNotificationChannel } from '../ToastNotificationChannel.js';

describe('ToastNotificationChannel', () => {
  let channel: ToastNotificationChannel;

  beforeEach(() => {
    channel = new ToastNotificationChannel();
  });

  describe('send', () => {
    it('should always return true (handled on frontend)', async () => {
      const result = await channel.send('user123', {
        title: 'Test',
        message: 'Test message',
        type: 'GENERAL' as any
      });

      expect(result).toBe(true);
    });
  });

  describe('isAvailable', () => {
    it('should always return true', () => {
      expect(channel.isAvailable()).toBe(true);
    });
  });

  describe('getChannelName', () => {
    it('should return "toast"', () => {
      expect(channel.getChannelName()).toBe('toast');
    });
  });

  describe('formatForFrontend', () => {
    it('should format notification for frontend', () => {
      const result = channel.formatForFrontend(
        {
          title: 'Test',
          message: 'Test message',
          type: 'GENERAL' as any,
          data: { key: 'value' }
        },
        'notif_123'
      );

      expect(result).toEqual({
        id: 'notif_123',
        title: 'Test',
        message: 'Test message',
        type: 'GENERAL',
        method: 'toast', // Valor en minúsculas del enum
        read: false,
        createdAt: expect.any(Date),
        data: { key: 'value' }
      });
    });
  });
});
