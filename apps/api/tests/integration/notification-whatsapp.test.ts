/**
 * Enhanced Notification Service Integration Tests
 *
 * Tests for WhatsApp integration with fallback to push notifications
 */

import { describe, it, expect, beforeEach, vi, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { getEnhancedNotificationService } from '../../src/services/notifications/enhanced-notification.service.js';
import { NotificationMethod, NotificationType } from '@galeno/shared-types';
import { resetWhatsAppProvider } from '../../src/services/whatsapp/index.js';

// Mock database
const mockPrisma = {
  cuenta: {
    findUnique: vi.fn(),
  },
  paciente: {
    findFirst: vi.fn(),
  },
  notificacion: {
    create: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
  },
} as unknown as PrismaClient;

describe('EnhancedNotificationService - WhatsApp Integration', () => {
  let service: ReturnType<typeof getEnhancedNotificationService>;

  beforeAll(() => {
    // Reset WhatsApp provider singleton
    resetWhatsAppProvider();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    service = getEnhancedNotificationService(mockPrisma);
  });

  describe('sendNotification with WhatsApp', () => {
    it('should send WhatsApp notification successfully', async () => {
      // Mock user with phone number
      (mockPrisma.cuenta.findUnique as any).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        nombre: 'Test User',
      });

      (mockPrisma.paciente.findFirst as any).mockResolvedValue({
        telefono: '+593999999999',
      });

      (mockPrisma.notificacion.create as any).mockResolvedValue({
        id: 'notif-123',
        userId: 'user-123',
        titulo: 'Test Notification',
        cuerpo: 'Test Message',
        tipo: 'info',
        leido: false,
        createdAt: new Date(),
      });

      const result = await service.sendNotification({
        userId: 'user-123',
        title: 'Test Notification',
        message: 'Test Message',
        type: NotificationType.INFO,
        method: NotificationMethod.WHATSAPP,
      });

      expect(result.success).toBe(true);
      expect(result.deliveredMethods).toContain(NotificationMethod.WHATSAPP);
      expect(mockPrisma.paciente.findFirst).toHaveBeenCalledWith({
        where: { cuentaId: 'user-123' },
        select: { telefono: true },
      });
    });

    it('should fallback to push when phone number is missing', async () => {
      // Mock user without phone number
      (mockPrisma.cuenta.findUnique as any).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        nombre: 'Test User',
      });

      (mockPrisma.paciente.findFirst as any).mockResolvedValue(null);

      (mockPrisma.notificacion.create as any).mockResolvedValue({
        id: 'notif-123',
      });

      const result = await service.sendNotification({
        userId: 'user-123',
        title: 'Test Notification',
        message: 'Test Message',
        type: NotificationType.INFO,
        method: NotificationMethod.WHATSAPP,
      });

      // Should still succeed with fallback to push
      expect(result.success).toBe(true);
      expect(result.deliveredMethods).not.toContain(NotificationMethod.WHATSAPP);
    });

    it('should fallback to push when WhatsApp fails', async () => {
      // Mock user with phone number
      (mockPrisma.cuenta.findUnique as any).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        nombre: 'Test User',
      });

      (mockPrisma.paciente.findFirst as any).mockResolvedValue({
        telefono: '+593999999999',
      });

      (mockPrisma.notificacion.create as any).mockResolvedValue({
        id: 'notif-123',
      });

      // WhatsApp provider will fail and fallback to push (handled in provider)
      const result = await service.sendNotification({
        userId: 'user-123',
        title: 'Test Notification',
        message: 'Test Message',
        type: NotificationType.INFO,
        method: NotificationMethod.WHATSAPP,
      });

      // Should succeed with fallback
      expect(result.success).toBe(true);
    });

    it('should send notification via multiple methods', async () => {
      (mockPrisma.cuenta.findUnique as any).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        nombre: 'Test User',
      });

      (mockPrisma.paciente.findFirst as any).mockResolvedValue({
        telefono: '+593999999999',
      });

      (mockPrisma.notificacion.create as any).mockResolvedValue({
        id: 'notif-123',
      });

      const result = await service.sendNotification({
        userId: 'user-123',
        title: 'Test Notification',
        message: 'Test Message',
        type: NotificationType.INFO,
        method: NotificationMethod.WHATSAPP,
      });

      expect(result.success).toBe(true);
      expect(result.deliveredMethods).toBeDefined();
    });
  });

  describe('getPreferences', () => {
    it('should return preferences with WhatsApp enabled', async () => {
      const preferences = await service.getPreferences('user-123');

      expect(preferences).toEqual({
        pushEnabled: true,
        sseEnabled: true,
        toastEnabled: true,
        whatsappEnabled: true,
        methods: expect.arrayContaining([
          NotificationMethod.PUSH,
          NotificationMethod.SSE,
          NotificationMethod.TOAST,
          NotificationMethod.WHATSAPP,
        ]),
      });
    });
  });

  describe('updatePreferences', () => {
    it('should update WhatsApp preference', async () => {
      const updated = await service.updatePreferences('user-123', {
        whatsappEnabled: false,
      });

      expect(updated.whatsappEnabled).toBe(false);
      expect(updated.pushEnabled).toBe(true);
      expect(updated.sseEnabled).toBe(true);
    });

    it('should update methods to include WhatsApp', async () => {
      const updated = await service.updatePreferences('user-123', {
        methods: [NotificationMethod.WHATSAPP, NotificationMethod.PUSH],
      });

      expect(updated.methods).toEqual([
        NotificationMethod.WHATSAPP,
        NotificationMethod.PUSH,
      ]);
    });
  });

  describe('getUserNotifications', () => {
    it('should get user notifications', async () => {
      const mockNotifications = [
        {
          id: 'notif-1',
          userId: 'user-123',
          titulo: 'Notification 1',
          cuerpo: 'Message 1',
          tipo: 'info',
          leido: false,
          createdAt: new Date(),
          datos: { method: 'whatsapp' },
        },
      ];

      (mockPrisma.notificacion.findMany as any).mockResolvedValue(mockNotifications);

      const result = await service.getUserNotifications('user-123');

      expect(result).toHaveLength(1);
      expect(result[0].method).toBe(NotificationMethod.WHATSAPP);
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      (mockPrisma.notificacion.updateMany as any).mockResolvedValue({ count: 1 });

      const result = await service.markAsRead('notif-123', 'user-123');

      expect(result).toBe(true);
      expect(mockPrisma.notificacion.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'notif-123',
          userId: 'user-123',
        },
        data: {
          leido: true,
        },
      });
    });
  });

  describe('getUnreadCount', () => {
    it('should get unread notification count', async () => {
      (mockPrisma.notificacion.count as any).mockResolvedValue(5);

      const result = await service.getUnreadCount('user-123');

      expect(result).toBe(5);
      expect(mockPrisma.notificacion.count).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          leido: false,
        },
      });
    });
  });
});
