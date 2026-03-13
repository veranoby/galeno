// apps/api/src/services/payment/gateways/__tests__/SubscriptionService.test.ts
/**
 * Tests para SubscriptionService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SubscriptionService } from '../SubscriptionService.js';
import { Plan } from '@prisma/client';
import { PrismaClient } from '@prisma/client';

// Mock de Prisma
vi.mock('../../../../config/database.js', () => ({
  default: new PrismaClient()
}));

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let mockPrisma: any;

  beforeEach(() => {
    // Mock prisma client
    mockPrisma = {
      cuenta: {
        findUnique: vi.fn(),
        update: vi.fn()
      }
    };

    service = new SubscriptionService(mockPrisma as any);
  });

  describe('createCustomer', () => {
    it('should return mock customer when provider not available', async () => {
      const result = await service.createCustomer('payphone', {
        email: 'test@example.com',
        name: 'Test User'
      });

      expect(result.success).toBe(true);
      expect(result.customerId).toContain('mock_');
    });

    it('should handle special characters in email', async () => {
      const result = await service.createCustomer('payphone', {
        email: 'user+tag@example.com',
        name: 'Test User'
      });

      expect(result.customerId).toContain('mock_');
      expect(result.customerId).not.toContain('@');
    });
  });

  describe('createSubscription', () => {
    it('should throw error when provider not configured', async () => {
      mockPrisma.cuenta.findUnique.mockResolvedValue({
        id: 'user123',
        email: 'test@example.com',
        nombre: 'Test User',
        customerId: 'cust_123'
      });

      await expect(
        service.createSubscription('user123', 'payphone', Plan.PREMIUM, 'pm_123')
      ).rejects.toThrow('subscription provider not configured');
    });

    it('should throw error when user not found', async () => {
      mockPrisma.cuenta.findUnique.mockResolvedValue(null);

      await expect(
        service.createSubscription('user123', 'payphone', Plan.PREMIUM, 'pm_123')
      ).rejects.toThrow('subscription provider not configured');
    });
  });

  describe('cancelSubscription', () => {
    it('should throw error when provider not configured', async () => {
      mockPrisma.cuenta.findUnique.mockResolvedValue({
        id: 'user123',
        customerId: 'cust_123',
        subscriptionId: 'sub_123'
      });

      await expect(
        service.cancelSubscription('user123', 'payphone')
      ).rejects.toThrow('subscription provider not configured');
    });

    it('should throw error when user not found', async () => {
      mockPrisma.cuenta.findUnique.mockResolvedValue(null);

      await expect(
        service.cancelSubscription('user123', 'payphone')
      ).rejects.toThrow('subscription provider not configured');
    });
  });

  describe('updatePaymentMethod', () => {
    it('should throw error when provider not configured', async () => {
      mockPrisma.cuenta.findUnique.mockResolvedValue({
        customerId: 'cust_123'
      });

      await expect(
        service.updatePaymentMethod('user123', 'payphone', 'pm_456')
      ).rejects.toThrow('subscription provider not configured');
    });

    it('should throw error when user not found', async () => {
      mockPrisma.cuenta.findUnique.mockResolvedValue(null);

      await expect(
        service.updatePaymentMethod('user123', 'payphone', 'pm_456')
      ).rejects.toThrow('subscription provider not configured');
    });
  });

  describe('getInvoice', () => {
    it('should return placeholder invoice when provider not available', async () => {
      const result = await service.getInvoice('user123', 'invoice_123');

      expect(result.success).toBe(true);
      expect(result.invoiceUrl).toContain('/api/payments/invoices/');
    });
  });
});
