// apps/api/src/services/payment/gateways/PaymentGatewayService.ts
/**
 * Servicio para pagos únicos (QR, card charges)
 * Maneja Payphone y Kushki para transacciones one-time
 */

import type { PaymentGateway, PaymentRequest, PaymentResponse, VerifyPaymentRequest, VerifyPaymentResponse, RefundRequest, RefundResponse } from '../base.js';
import { logger } from '../../../utils/logger.js';

export class PaymentGatewayService {
  private gateways: Map<string, PaymentGateway> = new Map();
  private initialized: boolean = false;

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
   * Crear un pago único (QR o cargo de tarjeta)
   */
  async createPayment(provider: 'payphone' | 'kushki', request: PaymentRequest): Promise<PaymentResponse> {
    try {
      const gateway = await this.getGateway(provider);
      return await gateway.createPayment(request);
    } catch (error) {
      logger.error({ error, provider, request }, 'Error creating payment');
      throw error;
    }
  }

  /**
   * Verificar estado de un pago
   */
  async verifyPayment(provider: 'payphone' | 'kushki', transactionId: string): Promise<VerifyPaymentResponse> {
    try {
      const gateway = await this.getGateway(provider);
      return await gateway.verifyPayment(transactionId);
    } catch (error) {
      logger.error({ error, provider, transactionId }, 'Error verifying payment');
      throw error;
    }
  }

  /**
   * Procesar reembolso
   */
  async refund(provider: 'payphone' | 'kushki', request: RefundRequest): Promise<RefundResponse> {
    try {
      const gateway = await this.getGateway(provider);
      return await gateway.refund(request);
    } catch (error) {
      logger.error({ error, provider, request }, 'Error processing refund');
      throw error;
    }
  }

  /**
   * Verificar si un gateway está configurado
   */
  isGatewayAvailable(provider: string): boolean {
    return this.gateways.has(provider);
  }
}
