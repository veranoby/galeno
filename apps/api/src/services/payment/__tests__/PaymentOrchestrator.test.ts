// apps/api/src/services/payment/__tests__/PaymentOrchestrator.test.ts
/**
 * Tests para PaymentOrchestrator
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PaymentOrchestrator } from '../PaymentOrchestrator.js';
import { Plan } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import type { IPagoRepository } from '../../../repositories/interfaces/IPagoRepository.js';

// Mock del módulo database antes de importar el orchestrator
const mockPrismaInstance = {
  cuenta: {
    findUnique: vi.fn(),
    update: vi.fn()
  },
  historialPago: {
    findMany: vi.fn()
  }
};

vi.mock('../../config/database.js', () => ({
  default: mockPrismaInstance
}));

describe('PaymentOrchestrator', () => {
  let orchestrator: PaymentOrchestrator;
  let mockPrisma: any;
  let mockPagoRepo: IPagoRepository;

  beforeEach(() => {
    // Reiniciar mocks
    vi.clearAllMocks();

    // Configurar mock prisma client
    mockPrisma = mockPrismaInstance;
    mockPrisma.cuenta.findUnique.mockResolvedValue({
      id: 'user123',
      email: 'test@example.com',
      nombre: 'Test User'
    });

    // Mock PagoRepository
    mockPagoRepo = {
      findMany: vi.fn(),
      getCuentaMetrics: vi.fn(),
      sumByStatus: vi.fn(),
      findByExternalId: vi.fn(),
      findById: vi.fn()
    } as any;

    orchestrator = new PaymentOrchestrator(mockPrisma as any, mockPagoRepo);
  });

  describe('constructor', () => {
    it('should initialize all services', () => {
      expect(orchestrator).toBeDefined();
      expect(orchestrator['gatewayService']).toBeDefined();
      expect(orchestrator['subscriptionService']).toBeDefined();
      expect(orchestrator['webhookService']).toBeDefined();
      expect(orchestrator['historyService']).toBeDefined();
    });
  });

  describe('gateway methods (delegate to PaymentGatewayService)', () => {
    it('should have createPayment method', () => {
      expect(orchestrator.createPayment).toBeDefined();
      expect(typeof orchestrator.createPayment).toBe('function');
    });

    it('should have verifyPayment method', () => {
      expect(orchestrator.verifyPayment).toBeDefined();
      expect(typeof orchestrator.verifyPayment).toBe('function');
    });

    it('should have refund method', () => {
      expect(orchestrator.refund).toBeDefined();
      expect(typeof orchestrator.refund).toBe('function');
    });
  });

  describe('subscription methods (delegate to SubscriptionService)', () => {
    it('should have createCustomer method', () => {
      expect(orchestrator.createCustomer).toBeDefined();
      expect(typeof orchestrator.createCustomer).toBe('function');
    });

    it('should have createSubscription method', () => {
      expect(orchestrator.createSubscription).toBeDefined();
      expect(typeof orchestrator.createSubscription).toBe('function');
    });

    it('should have cancelSubscription method', () => {
      expect(orchestrator.cancelSubscription).toBeDefined();
      expect(typeof orchestrator.cancelSubscription).toBe('function');
    });

    it('should have updatePaymentMethod method', () => {
      expect(orchestrator.updatePaymentMethod).toBeDefined();
      expect(typeof orchestrator.updatePaymentMethod).toBe('function');
    });

    it('should have getInvoice method', () => {
      expect(orchestrator.getInvoice).toBeDefined();
      expect(typeof orchestrator.getInvoice).toBe('function');
    });
  });

  describe('webhook methods (delegate to PaymentWebhookService)', () => {
    it('should have handleWebhook method', () => {
      expect(orchestrator.handleWebhook).toBeDefined();
      expect(typeof orchestrator.handleWebhook).toBe('function');
    });
  });

  describe('history methods (delegate to PaymentHistoryService)', () => {
    it('should have getPaymentHistory method', () => {
      expect(orchestrator.getPaymentHistory).toBeDefined();
      expect(typeof orchestrator.getPaymentHistory).toBe('function');
    });

    it('should have getPaymentMetrics method', () => {
      expect(orchestrator.getPaymentMetrics).toBeDefined();
      expect(typeof orchestrator.getPaymentMetrics).toBe('function');
    });

    it('should have getPaymentSummary method', () => {
      expect(orchestrator.getPaymentSummary).toBeDefined();
      expect(typeof orchestrator.getPaymentSummary).toBe('function');
    });

    it('should have getPaymentByTransactionId method', () => {
      expect(orchestrator.getPaymentByTransactionId).toBeDefined();
      expect(typeof orchestrator.getPaymentByTransactionId).toBe('function');
    });

    it('should have getInvoiceUrl method', () => {
      expect(orchestrator.getInvoiceUrl).toBeDefined();
      expect(typeof orchestrator.getInvoiceUrl).toBe('function');
    });
  });

  describe('utility methods', () => {
    it('should have isGatewayAvailable method', () => {
      expect(orchestrator.isGatewayAvailable).toBeDefined();
      expect(typeof orchestrator.isGatewayAvailable).toBe('function');
    });

    it('should return false for non-existent gateway', () => {
      expect(orchestrator.isGatewayAvailable('nonexistent')).toBe(false);
    });
  });

  describe('backward compatibility', () => {
    it('should maintain same API as original PaymentService', () => {
      // Verificar que todos los métodos originales existen
      const originalMethods = [
        'createPayment',
        'verifyPayment',
        'refund',
        'createCustomer',
        'createSubscription',
        'cancelSubscription',
        'updatePaymentMethod',
        'getPaymentHistory',
        'getInvoice',
        'handleWebhook'
      ];

      originalMethods.forEach(method => {
        expect(orchestrator[method]).toBeDefined();
      });
    });
  });
});
