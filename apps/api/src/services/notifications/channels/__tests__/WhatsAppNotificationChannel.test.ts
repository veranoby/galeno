// apps/api/src/services/notifications/channels/__tests__/WhatsAppNotificationChannel.test.ts
/**
 * Tests para WhatsAppNotificationChannel
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WhatsAppNotificationChannel } from '../WhatsAppNotificationChannel.js';
import { PrismaClient } from '@prisma/client';
import type { INotificationRepository } from '../../../../../repositories/interfaces/INotificationRepository.js';

// Mock del WhatsApp provider
vi.mock('../../../../services/whatsapp/index.js', () => ({
  getWhatsAppProvider: () => ({
    sendMessage: vi.fn().mockResolvedValue({
      messageId: 'msg_123',
      status: 'sent'
    })
  })
}));

// Mock logger
vi.mock('../../../../utils/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

describe('WhatsAppNotificationChannel', () => {
  let channel: WhatsAppNotificationChannel;
  let mockPrisma: any;
  let mockNotificationRepo: INotificationRepository;

  beforeEach(() => {
    // Mock prisma
    mockPrisma = {
      cuenta: {
        findUnique: vi.fn()
      },
      paciente: {
        findFirst: vi.fn()
      }
    };

    // Mock notification repo
    mockNotificationRepo = {
      update: vi.fn()
    } as any;

    channel = new WhatsAppNotificationChannel(mockPrisma, mockNotificationRepo);
  });

  describe('send', () => {
    it('should send WhatsApp notification when user has phone', async () => {
      mockPrisma.cuenta.findUnique.mockResolvedValue({
        id: 'user123',
        email: 'test@example.com',
        nombre: 'Test User'
      });

      mockPrisma.paciente.findFirst.mockResolvedValue({
        telefono: '+593987654321'
      });

      const result = await channel.send('user123', {
        title: 'Test',
        message: 'Test message',
        type: 'GENERAL' as any,
        notificationId: 'notif_123'
      });

      expect(result).toBe(true);
    });

    it('should use fallback when user has no phone', async () => {
      mockPrisma.cuenta.findUnique.mockResolvedValue({
        id: 'user123',
        email: 'test@example.com',
        nombre: 'Test User'
      });

      mockPrisma.paciente.findFirst.mockResolvedValue(null);

      const fallbackMock = vi.fn().mockResolvedValue(true);
      const result = await channel.send('user123', {
        title: 'Test',
        message: 'Test message',
        type: 'GENERAL' as any
      }, { send: fallbackMock });

      expect(result).toBe(true);
      expect(fallbackMock).toHaveBeenCalled();
    });

    it('should use fallback when user not found', async () => {
      mockPrisma.cuenta.findUnique.mockResolvedValue(null);

      const fallbackMock = vi.fn().mockResolvedValue(true);
      const result = await channel.send('user123', {
        title: 'Test',
        message: 'Test message',
        type: 'GENERAL' as any
      }, { send: fallbackMock });

      expect(result).toBe(true);
      expect(fallbackMock).toHaveBeenCalled();
    });
  });

  describe('isAvailable', () => {
    it('should return true when user has phone', async () => {
      mockPrisma.paciente.findFirst.mockResolvedValue({
        telefono: '+593987654321'
      });

      const result = await channel.isAvailable('user123');
      expect(result).toBe(true);
    });

    it('should return false when user has no phone', async () => {
      mockPrisma.paciente.findFirst.mockResolvedValue(null);

      const result = await channel.isAvailable('user123');
      expect(result).toBe(false);
    });
  });

  describe('getChannelName', () => {
    it('should return "whatsapp"', () => {
      expect(channel.getChannelName()).toBe('whatsapp');
    });
  });
});
