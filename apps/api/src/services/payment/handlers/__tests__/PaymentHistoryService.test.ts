// apps/api/src/services/payment/handlers/__tests__/PaymentHistoryService.test.ts
/**
 * Tests para PaymentHistoryService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PaymentHistoryService } from '../PaymentHistoryService.js';
import { PrismaClient } from '@prisma/client';
import type { IPagoRepository } from '../../../../repositories/interfaces/IPagoRepository.js';

// Mock de Prisma
vi.mock('../../../../config/database.js', () => ({
  default: new PrismaClient()
}));

describe('PaymentHistoryService', () => {
  let service: PaymentHistoryService;
  let mockPrisma: any;
  let mockPagoRepo: IPagoRepository;

  beforeEach(() => {
    // Mock prisma client
    mockPrisma = {
      historialPago: {
        findMany: vi.fn()
      }
    };

    // Mock PagoRepository
    mockPagoRepo = {
      findMany: vi.fn(),
      getCuentaMetrics: vi.fn(),
      sumByStatus: vi.fn(),
      findByExternalId: vi.fn(),
      findById: vi.fn()
    } as any;

    service = new PaymentHistoryService(mockPrisma as any, mockPagoRepo);
  });

  describe('getPaymentHistory', () => {
    it('should return both pagos and historial', async () => {
      const mockPagos = [{ id: 'pago_1', amount: 100 }];
      const mockHistorial = [{ id: 'hist_1', monto: 50 }];

      mockPagoRepo.findMany.mockResolvedValue(mockPagos);
      mockPrisma.historialPago.findMany.mockResolvedValue(mockHistorial);

      const result = await service.getPaymentHistory('cuenta_123');

      expect(result).toEqual({
        pagos: mockPagos,
        historial: mockHistorial
      });
    });

    it('should use default limit of 50', async () => {
      mockPagoRepo.findMany.mockResolvedValue([]);
      mockPrisma.historialPago.findMany.mockResolvedValue([]);

      await service.getPaymentHistory('cuenta_123');

      expect(mockPagoRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 50 })
      );
    });

    it('should accept custom limit', async () => {
      mockPagoRepo.findMany.mockResolvedValue([]);
      mockPrisma.historialPago.findMany.mockResolvedValue([]);

      await service.getPaymentHistory('cuenta_123', 10);

      expect(mockPagoRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10 })
      );
    });
  });

  describe('getPaymentMetrics', () => {
    it('should call repository with correct parameters', async () => {
      const mockMetrics = {
        total: 10,
        recaudado: 1000,
        pendiente: 0,
        tasaCompletado: 90
      };

      mockPagoRepo.getCuentaMetrics.mockResolvedValue(mockMetrics);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      const result = await service.getPaymentMetrics('cuenta_123', startDate, endDate);

      expect(mockPagoRepo.getCuentaMetrics).toHaveBeenCalledWith('cuenta_123', startDate, endDate);
      expect(result).toEqual(mockMetrics);
    });
  });

  describe('getPaymentSummary', () => {
    it('should call repository with correct parameters', async () => {
      const mockSummary = {
        pendiente: 100,
        completado: 500,
        fallido: 0,
        reembolsado: 0
      };

      mockPagoRepo.sumByStatus.mockResolvedValue(mockSummary);

      const result = await service.getPaymentSummary('cuenta_123');

      expect(mockPagoRepo.sumByStatus).toHaveBeenCalledWith('cuenta_123', undefined, undefined);
      expect(result).toEqual(mockSummary);
    });
  });

  describe('getPaymentByTransactionId', () => {
    it('should call repository with transaction ID', async () => {
      const mockPago = { id: 'pago_1', transactionId: 'txn_123' };

      mockPagoRepo.findByExternalId.mockResolvedValue(mockPago);

      const result = await service.getPaymentByTransactionId('txn_123');

      expect(mockPagoRepo.findByExternalId).toHaveBeenCalledWith('txn_123');
      expect(result).toEqual(mockPago);
    });
  });

  describe('getInvoiceUrl', () => {
    it('should return invoice URL for existing payment', async () => {
      const mockPago = {
        id: 'pago_1',
        transactionId: 'txn_123',
        amount: 100,
        status: 'APPROVED'
      };

      mockPagoRepo.findById.mockResolvedValue(mockPago);

      const result = await service.getInvoiceUrl('pago_1');

      expect(result).toEqual({
        invoiceUrl: '/api/payments/invoices/pago_1',
        transactionId: 'txn_123',
        amount: 100,
        status: 'APPROVED'
      });
    });

    it('should throw error for non-existent payment', async () => {
      mockPagoRepo.findById.mockResolvedValue(null);

      await expect(service.getInvoiceUrl('nonexistent')).rejects.toThrow('Payment not found');
    });
  });
});
