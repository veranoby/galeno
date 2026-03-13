/**
 * PayPhone Payment Strategy
 *
 * Implementación de estrategia para PayPhone (Ecuador)
 * Soporta pagos con QR code y validación de firma HMAC-SHA256
 *
 * Documentación: https://payphone.ec/developers
 */

import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import {
  IPaymentStrategy,
  StrategyConfig,
  StrategyError
} from './payment.strategy.interface.js';
import {
  PaymentRequest,
  PaymentResponse,
  VerifyPaymentResponse,
  RefundRequest,
  RefundResponse,
  WebhookResult,
  PaymentStatus
} from '../base.js';
import { logger } from '../../../utils/logger.js';

/**
 * Configuración específica de PayPhone
 */
interface PayphoneStrategyConfig extends StrategyConfig {
  type: 'payphone';
  apiKey: string;
  secretKey: string;
  webhookSecret: string;
}

/**
 * Payload de webhook de PayPhone
 */
interface PayphoneWebhookPayload {
  id: string;
  external_id: string;
  phone_number: string;
  status: string;
  value: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

/**
 * Estrategia de pago para PayPhone (Ecuador)
 */
export class PayphoneStrategy implements IPaymentStrategy {
  private client: AxiosInstance;
  private config: PayphoneStrategyConfig;
  private initialized = false;

  constructor(config?: Partial<PayphoneStrategyConfig>) {
    this.config = {
      type: 'payphone',
      baseUrl: config?.baseUrl || 'https://api.payphone.ec/api/v1',
      apiKey: process.env.PAYPHONE_ID || '',
      secretKey: process.env.PAYPHONE_SECRET || '',
      webhookSecret: process.env.PAYPHONE_WEBHOOK_SECRET || '',
      timeout: config?.timeout || 30000,
      ...config
    } as PayphoneStrategyConfig;

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      }
    });

    this.setupInterceptors();
  }

  /**
   * Configurar interceptores para logging
   */
  private setupInterceptors(): void {
    this.client.interceptors.request.use((config) => {
      logger.debug({
        event: 'payphone_request',
        method: config.method,
        url: config.url
      });
      return config;
    });

    this.client.interceptors.response.use(
      (response) => {
        logger.debug({
          event: 'payphone_response',
          status: response.status,
          url: response.config.url
        });
        return response;
      },
      (error) => {
        logger.error({
          event: 'payphone_error',
          message: error.message,
          status: error.response?.status,
          url: error.config?.url
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Inicializar la estrategia
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (!this.config.apiKey) {
      throw new StrategyError(
        'PAYPHONE_ID is required',
        'MISSING_API_KEY',
        'payphone'
      );
    }
    if (!this.config.secretKey) {
      throw new StrategyError(
        'PAYPHONE_SECRET is required',
        'MISSING_SECRET_KEY',
        'payphone'
      );
    }
    if (!this.config.webhookSecret) {
      throw new StrategyError(
        'PAYPHONE_WEBHOOK_SECRET is required',
        'MISSING_WEBHOOK_SECRET',
        'payphone'
      );
    }

    this.initialized = true;
    logger.info({ event: 'payphone_strategy_initialized' });
  }

  /**
   * Obtener tipo de estrategia
   */
  getType(): 'payphone' {
    return 'payphone';
  }

  /**
   * Crear un pago con PayPhone
   *
   * @param request - Datos del pago
   * @returns Response con QR code y transactionId
   */
  async createPayment(request: PaymentRequest): Promise<PaymentResponse> {
    try {
      await this.initialize();

      // Generar idempotency key
      const idempotencyKey = request.idempotencyKey ||
        this.generateIdempotencyKey(request.customerId, request.amount, request.description);

      // Crear enlace de pago en PayPhone
      const response = await this.client.post('/payment_links', {
        external_id: idempotencyKey,
        phone_number: request.customerId,
        value: request.amount,
        currency: request.currency,
        description: request.description,
        metadata: {
          ...request.metadata,
          splits: request.splits
        }
      });

      const paymentLink = response.data;

      // Generar QR code URL
      const qrCode = await this.generateQRCode(paymentLink.id);

      logger.info({
        event: 'payphone_payment_created',
        transactionId: paymentLink.id,
        externalId: idempotencyKey,
        amount: request.amount
      });

      return {
        transactionId: paymentLink.id,
        status: 'pending',
        qrCode,
        hostedUrl: paymentLink.link
      };
    } catch (error: any) {
      logger.error({
        event: 'payphone_create_payment_error',
        error: error.message,
        customerId: request.customerId,
        amount: request.amount
      });

      throw new StrategyError(
        error.response?.data?.message || 'Failed to create Payphone payment',
        error.response?.data?.code || 'PAYPHONE_CREATE_ERROR',
        'payphone'
      );
    }
  }

  /**
   * Verificar el status de un pago
   */
  async verifyPayment(transactionId: string): Promise<VerifyPaymentResponse> {
    try {
      await this.initialize();

      const response = await this.client.get(`/payment_links/${transactionId}`);
      const payment = response.data;

      const status = this.mapStatus(payment.status);

      return {
        transactionId: payment.id,
        status,
        amount: payment.value,
        approvedAt: status === 'approved' ? new Date(payment.updated_at) : undefined,
        metadata: {
          phone_number: payment.phone_number,
          external_id: payment.external_id
        }
      };
    } catch (error: any) {
      logger.error({
        event: 'payphone_verify_payment_error',
        error: error.message,
        transactionId
      });

      throw new StrategyError(
        error.response?.data?.message || 'Failed to verify Payphone payment',
        error.response?.data?.code || 'PAYPHONE_VERIFY_ERROR',
        'payphone'
      );
    }
  }

  /**
   * Procesar un webhook de PayPhone
   *
   * Valida firma HMAC-SHA256 del header X-PayPhone-Signature
   */
  async handleWebhook(payload: any, signature?: string): Promise<WebhookResult> {
    try {
      await this.initialize();

      // 1. Verificar firma HMAC
      if (!signature) {
        throw new StrategyError(
          'Missing webhook signature',
          'MISSING_SIGNATURE',
          'payphone'
        );
      }

      const isValid = this.verifyWebhookSignature(payload, signature);
      if (!isValid) {
        throw new StrategyError(
          'Invalid webhook signature',
          'INVALID_SIGNATURE',
          'payphone'
        );
      }

      // 2. Procesar evento
      const webhookPayload: PayphoneWebhookPayload = payload;
      const status = this.mapStatus(webhookPayload.status);

      logger.info({
        event: 'payphone_webhook_received',
        transactionId: webhookPayload.id,
        externalId: webhookPayload.external_id,
        status,
        value: webhookPayload.value
      });

      return {
        success: true,
        transactionId: webhookPayload.id
      };
    } catch (error: any) {
      logger.error({
        event: 'payphone_webhook_error',
        error: error.message,
        transactionId: payload?.id
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Procesar un reembolso
   */
  async refund(request: RefundRequest): Promise<RefundResponse> {
    try {
      await this.initialize();

      // Verificar pago original
      const payment = await this.verifyPayment(request.transactionId);

      if (payment.status !== 'approved') {
        throw new StrategyError(
          'Cannot refund a non-approved payment',
          'INVALID_PAYMENT_STATUS',
          'payphone'
        );
      }

      const refundAmount = request.amount || payment.amount || 0;

      // Crear reembolso en PayPhone
      const response = await this.client.post(
        `/payment_links/${request.transactionId}/refund`,
        {
          amount: refundAmount,
          reason: request.reason || 'Customer request'
        }
      );

      logger.info({
        event: 'payphone_refund_created',
        transactionId: request.transactionId,
        refundId: response.data.id,
        amount: refundAmount
      });

      return {
        refundId: response.data.id,
        status: response.data.status === 'approved' ? 'approved' : 'pending',
        amount: refundAmount
      };
    } catch (error: any) {
      logger.error({
        event: 'payphone_refund_error',
        error: error.message,
        transactionId: request.transactionId
      });

      throw new StrategyError(
        error.response?.data?.message || 'Failed to process refund',
        error.response?.data?.code || 'PAYPHONE_REFUND_ERROR',
        'payphone'
      );
    }
  }

  /**
   * Generar QR code para pago
   */
  private async generateQRCode(paymentId: string): Promise<string> {
    return `${this.config.baseUrl}/qr/${paymentId}`;
  }

  /**
   * Verificar firma HMAC del webhook
   */
  private verifyWebhookSignature(payload: any, signature: string): boolean {
    try {
      const payloadString = JSON.stringify(payload);
      const expectedSignature = crypto
        .createHmac('sha256', this.config.webhookSecret)
        .update(payloadString)
        .digest('hex');

      // Normalizar firmas
      const normalizedSignature = signature.toLowerCase().replace(/^0x/, '');
      const normalizedExpected = expectedSignature.toLowerCase();

      // Verificar longitud
      if (normalizedSignature.length !== normalizedExpected.length) {
        logger.warn({
          event: 'payphone_signature_length_mismatch',
          receivedLength: normalizedSignature.length,
          expectedLength: normalizedExpected.length
        });
        return false;
      }

      return crypto.timingSafeEqual(
        Buffer.from(normalizedSignature, 'hex'),
        Buffer.from(normalizedExpected, 'hex')
      );
    } catch (error: any) {
      logger.error({
        event: 'payphone_signature_verification_error',
        error: error.message
      });
      return false;
    }
  }

  /**
   * Mapear status de PayPhone a status interno
   */
  private mapStatus(payphoneStatus: string): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      'CREATED': 'pending',
      'PENDING': 'pending',
      'APPROVED': 'approved',
      'REJECTED': 'rejected',
      'REFUNDED': 'refunded',
      'CANCELLED': 'cancelled'
    };

    return statusMap[payphoneStatus] || 'pending';
  }

  /**
   * Generar idempotency key
   */
  private generateIdempotencyKey(customerId: string, amount: number, description: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `payphone_${customerId}_${amount}_${timestamp}_${random}`;
  }
}
