// apps/api/src/services/payment/handlers/PaymentHistoryService.ts
/**
 * Servicio para historial de pagos
 * Maneja consulta de historial y generación de facturas
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../../../utils/logger.js';
import { IPagoRepository } from '../../../repositories/interfaces/IPagoRepository.js';

export class PaymentHistoryService {
  constructor(
    private prisma: PrismaClient,
    private pagoRepo: IPagoRepository
  ) {}

  /**
   * Obtener historial de pagos de una cuenta
   */
  async getPaymentHistory(cuentaId: string, limit: number = 50) {
    try {
      // Usar el repositorio para obtener pagos recientes
      const pagos = await this.pagoRepo.findMany({
        where: { cuentaId },
        orderBy: { createdAt: 'desc' },
        limit
      });

      // También obtener historial de pagos antiguos (migración)
      const historial = await this.prisma.historialPago.findMany({
        where: { cuentaId },
        orderBy: { createdAt: 'desc' },
        take: limit
      });

      return {
        pagos: pagos,
        historial: historial
      };
    } catch (error) {
      logger.error({ error, cuentaId }, 'Error fetching payment history');
      throw error;
    }
  }

  /**
   * Obtener métricas de pagos de una cuenta
   */
  async getPaymentMetrics(cuentaId: string, startDate?: Date, endDate?: Date) {
    try {
      return await this.pagoRepo.getCuentaMetrics(cuentaId, startDate, endDate);
    } catch (error) {
      logger.error({ error, cuentaId }, 'Error fetching payment metrics');
      throw error;
    }
  }

  /**
   * Obtener resumen de pagos por estado
   */
  async getPaymentSummary(cuentaId: string, startDate?: Date, endDate?: Date) {
    try {
      return await this.pagoRepo.sumByStatus(cuentaId, startDate, endDate);
    } catch (error) {
      logger.error({ error, cuentaId }, 'Error fetching payment summary');
      throw error;
    }
  }

  /**
   * Buscar un pago por transaction ID
   */
  async getPaymentByTransactionId(transactionId: string) {
    try {
      return await this.pagoRepo.findByExternalId(transactionId);
    } catch (error) {
      logger.error({ error, transactionId }, 'Error fetching payment by transaction ID');
      throw error;
    }
  }

  /**
   * Obtener URL de factura para un pago
   */
  async getInvoiceUrl(pagoId: string) {
    try {
      const pago = await this.pagoRepo.findById(pagoId);
      if (!pago) {
        throw new Error('Payment not found');
      }

      // Generar URL de factura basada en el gateway
      // TODO: Implementar generación real de factura
      return {
        invoiceUrl: `/api/payments/invoices/${pagoId}`,
        transactionId: pago.transactionId,
        amount: pago.amount,
        status: pago.status
      };
    } catch (error) {
      logger.error({ error, pagoId }, 'Error generating invoice URL');
      throw error;
    }
  }
}
