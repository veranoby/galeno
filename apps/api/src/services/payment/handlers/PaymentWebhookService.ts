// apps/api/src/services/payment/handlers/PaymentWebhookService.ts
/**
 * Servicio para manejar webhooks de payment gateways
 * Procesa notificaciones de Pagos, Reembolsos, etc.
 */

import type { PaymentGateway, WebhookPayload, WebhookResult } from '../base.js';
import { logger } from '../../../utils/logger.js';
import { PrismaClient } from '@prisma/client';

export class PaymentWebhookService {
  private gateways: Map<string, PaymentGateway> = new Map();
  private initialized: boolean = false;

  constructor(private prisma: PrismaClient) {}

  async initialize() {
    if (this.initialized) return;

    if (process.env.PAYPHONE_API_KEY) {
      const { PayphoneProvider } = await import('../payphone.provider.js');
      this.gateways.set('payphone', new PayphoneProvider());
    }

    if (process.env.KUSHKI_PUBLIC_MERCHANT_ID) {
      const { KushkiProvider } = await import('../kushki.provider.js');
      this.gateways.set('kushki', new KushkiProvider());
    }

    this.initialized = true;
  }

  private async getGateway(provider: string): Promise<PaymentGateway> {
    await this.initialize();
    const instance = this.gateways.get(provider);
    if (!instance) {
      throw new Error(`${provider} payment gateway not configured`);
    }
    return instance;
  }

  /**
   * Manejar webhook de un payment provider
   */
  async handleWebhook(provider: 'payphone' | 'kushki', payload: WebhookPayload, signature?: string): Promise<WebhookResult> {
    try {
      const gateway = await this.getGateway(provider);
      const result = await gateway.handleWebhook(payload, signature);

      // Actualizar estado del pago en base de datos si el webhook fue exitoso
      if (result.success && result.transactionId) {
        await this.updatePaymentStatus(result.transactionId, result.status);
      }

      logger.info({
        event: 'webhook_processed',
        provider,
        transactionId: result.transactionId,
        status: result.status
      });

      return result;
    } catch (error) {
      logger.error({ error, provider, payload }, 'Error handling webhook');
      throw error;
    }
  }

  /**
   * Actualizar estado del pago en base de datos
   */
  private async updatePaymentStatus(transactionId: string, status: string) {
    try {
      await this.prisma.pago.update({
        where: { transactionId },
        data: {
          status: status as any,
          approvedAt: status === 'APPROVED' ? new Date() : undefined
        }
      });
    } catch (error) {
      logger.warn({ error, transactionId, status }, 'Could not update payment status');
    }
  }

  /**
   * Verificar firma del webhook (para seguridad)
   */
  verifyWebhookSignature(provider: 'payphone' | 'kushki', payload: string, signature: string): boolean {
    // Implementación básica - cada provider puede tener su propia lógica
    // TODO: Implementar verificación real de firma según el provider
    logger.warn({ provider }, 'Webhook signature verification not fully implemented');
    return true;
  }
}
