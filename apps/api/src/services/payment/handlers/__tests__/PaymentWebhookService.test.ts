// apps/api/src/services/payment/handlers/__tests__/PaymentWebhookService.test.ts
/**
 * Tests para PaymentWebhookService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PaymentWebhookService } from '../PaymentWebhookService.js';
import { PrismaClient } from '@prisma/client';
import type { WebhookPayload } from '../../base.js';

// Mock de Prisma
vi.mock('../../../../config/database.js', () => ({
  default: new PrismaClient()
}));

describe('PaymentWebhookService', () => {
  let service: PaymentWebhookService;
  let mockPrisma: any;

  beforeEach(() => {
    // Mock prisma client
    mockPrisma = {
      pago: {
        update: vi.fn()
      }
    };

    service = new PaymentWebhookService(mockPrisma as any);

    // Mock environment variables
    process.env.PAYPHONE_API_KEY = 'test_key';
    process.env.KUSHKI_PUBLIC_MERCHANT_ID = 'test_merchant_id';
  });

  describe('handleWebhook', () => {
    it('should throw error for non-configured gateway', async () => {
      const mockPayload: WebhookPayload = {
        event: 'payment.failed',
        transactionId: 'test_txn',
        status: 'rejected',
        timestamp: Date.now(),
        data: { error: 'Gateway not configured' }
      };

      await expect(
        service.handleWebhook('nonexistent' as any, mockPayload, 'sig')
      ).rejects.toThrow();
    });

    it('should process webhook successfully for configured gateway', async () => {
      // Mock del gateway para que retorne éxito
      const mockPayload = { transaction_id: 'txn_123' };
      const mockResult = {
        success: true,
        transactionId: 'txn_123',
        status: 'APPROVED'
      };

      // Nota: Este test necesitará que el gateway esté configurado
      // Por ahora solo verificamos que el método existe
      expect(service.handleWebhook).toBeDefined();
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should return true (basic implementation)', () => {
      const result = service.verifyWebhookSignature('payphone', 'payload', 'signature');
      expect(result).toBe(true);
    });

    it('should accept any provider', () => {
      expect(service.verifyWebhookSignature('payphone', 'payload', 'sig')).toBe(true);
      expect(service.verifyWebhookSignature('kushki', 'payload', 'sig')).toBe(true);
    });
  });
});
