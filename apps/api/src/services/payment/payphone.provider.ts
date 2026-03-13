/**
 * Payphone Payment Provider
 * 
 * Integración con la API de Payphone para Ecuador
 * Soporta pagos con QR code y split de comisiones
 * 
 * Documentación: https://payphone.com.ec/developers
 */

import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import {
  PaymentGateway,
  GatewayConfig,
  PaymentRequest,
  PaymentResponse,
  VerifyPaymentResponse,
  RefundRequest,
  RefundResponse,
  WebhookPayload,
  WebhookResult,
  PaymentStatus,
  PaymentError,
  WebhookSignatureError
} from './base.js';
import { logger } from '../../utils/logger.js';

/**
 * Configuración específica de Payphone
 */
interface PayphoneConfig extends GatewayConfig {
  apiKey: string;
  secretKey: string;
  webhookSecret: string;
}

/**
 * Payload de webhook de Payphone
 */
interface PayphoneWebhookPayload {
  id: string;
  externalId: string;
  phoneNumber: string;
  status: string;
  value: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Provider de Payphone
 */
export class PayphoneProvider extends PaymentGateway {
  private client: AxiosInstance;
  protected config: PayphoneConfig;

  constructor(config?: Partial<PayphoneConfig>) {
    const finalConfig = {
      baseUrl: config?.baseUrl || 'https://payphone-api.herokuapp.com/api/v2',
      publicKey: config?.apiKey,
      secretKey: config?.secretKey,
      webhookUrl: config?.webhookUrl,
      timeout: config?.timeout || 30000
    };
    
    super(finalConfig);

    this.config = {
      apiKey: process.env.PAYPHONE_API_KEY || '',
      secretKey: process.env.PAYPHONE_SECRET_KEY || '',
      webhookSecret: process.env.PAYPHONE_WEBHOOK_SECRET || '',
      baseUrl: finalConfig.baseUrl,
      timeout: finalConfig.timeout,
      ...config
    } as PayphoneConfig;

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      }
    });

    // Request interceptor para logging
    this.client.interceptors.request.use((config) => {
      logger.debug({
        event: 'payphone_request',
        method: config.method,
        url: config.url
      });
      return config;
    });

    // Response interceptor para logging
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
   * Validar configuración específica de Payphone
   */
  protected async onValidateConfig(): Promise<void> {
    if (!this.config.apiKey) {
      throw new Error('PAYPHONE_API_KEY environment variable is required');
    }
    if (!this.config.secretKey) {
      throw new Error('PAYPHONE_SECRET_KEY environment variable is required');
    }
    if (!this.config.webhookSecret) {
      throw new Error('PAYPHONE_WEBHOOK_SECRET environment variable is required');
    }
  }

  /**
   * Crear un pago con Payphone
   * 
   * @param request - Datos del pago
   * @returns Response con QR code y transactionId
   */
  async createPayment(request: PaymentRequest): Promise<PaymentResponse> {
    try {
      await this.initialize();

      // Generar idempotency key si no existe
      const idempotencyKey = request.idempotencyKey || 
        this.generateIdempotencyKey(request.customerId, request.amount, request.description);

      // Calcular splits si existen
      const splits = this.calculateSplits(request.amount, request.splits);

      // Crear orden en Payphone
      const response = await this.client.post('/payment_links', {
        external_id: idempotencyKey,
        phone_number: request.customerId, // En producción, obtener de BD
        value: request.amount, // En centavos
        currency: request.currency,
        description: request.description,
        metadata: {
          ...request.metadata,
          splits: splits.length > 0 ? splits : undefined
        }
      });

      const paymentLink = response.data;

      // Generar QR code URL
      const qrCode = await this.generateQRCode(paymentLink.id);

      logger.info({
        event: 'payphone_payment_created',
        transactionId: paymentLink.id,
        externalId: idempotencyKey,
        amount: request.amount,
        splits: splits.length
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

      throw new PaymentError(
        error.response?.data?.message || 'Failed to create Payphone payment',
        error.response?.data?.code || 'PAYPHONE_CREATE_ERROR',
        request.idempotencyKey
      );
    }
  }

  /**
   * Verificar el status de un pago
   * 
   * @param transactionId - ID de transacción
   * @returns Status actual del pago
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
        approvedAt: status === 'approved' ? new Date(payment.updatedAt) : undefined,
        metadata: {
          phoneNumber: payment.phoneNumber,
          externalId: payment.externalId
        }
      };
    } catch (error: any) {
      logger.error({
        event: 'payphone_verify_payment_error',
        error: error.message,
        transactionId
      });

      throw new PaymentError(
        error.response?.data?.message || 'Failed to verify Payphone payment',
        error.response?.data?.code || 'PAYPHONE_VERIFY_ERROR',
        transactionId
      );
    }
  }

  /**
   * Procesar un webhook de Payphone
   * 
   * @param payload - Payload del webhook
   * @param signature - Firma HMAC
   * @returns Resultado del procesamiento
   */
  async handleWebhook(payload: any, signature?: string): Promise<WebhookResult> {
    try {
      await this.initialize();

      // 1. Verificar firma HMAC
      if (!signature) {
        throw new WebhookSignatureError('Missing webhook signature');
      }

      const isValid = this.verifyWebhookSignature(payload, signature);
      if (!isValid) {
        throw new WebhookSignatureError('Invalid webhook signature');
      }

      // 2. Procesar evento
      const webhookPayload: PayphoneWebhookPayload = payload;
      const status = this.mapStatus(webhookPayload.status);

      logger.info({
        event: 'payphone_webhook_received',
        transactionId: webhookPayload.id,
        externalId: webhookPayload.externalId,
        status,
        value: webhookPayload.value
      });

      // 3. Actualizar estado en BD (esto se haría en el service layer)
      // await updatePaymentStatus(webhookPayload.externalId, status);

      // 4. Procesar splits si el pago fue aprobado
      if (status === 'approved') {
        // await processPaymentSplits(webhookPayload.id, webhookPayload.value);
        // await sendPaymentConfirmationEmail(webhookPayload.externalId);
      }

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

      if (error instanceof WebhookSignatureError) {
        return {
          success: false,
          error: error.message
        };
      }

      throw error;
    }
  }

  /**
   * Procesar un reembolso
   * 
   * @param request - Datos del reembolso
   * @returns Resultado del reembolso
   */
  async refund(request: RefundRequest): Promise<RefundResponse> {
    try {
      await this.initialize();

      // Verificar pago original
      const payment = await this.verifyPayment(request.transactionId);
      
      if (payment.status !== 'approved') {
        throw new PaymentError(
          'Cannot refund a non-approved payment',
          'INVALID_PAYMENT_STATUS',
          request.transactionId
        );
      }

      const refundAmount = request.amount || payment.amount || 0;

      // Crear reembolso en Payphone
      const response = await this.client.post(`/payment_links/${request.transactionId}/refund`, {
        amount: refundAmount,
        reason: request.reason || 'Customer request'
      });

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

      throw new PaymentError(
        error.response?.data?.message || 'Failed to process refund',
        error.response?.data?.code || 'PAYPHONE_REFUND_ERROR',
        request.transactionId
      );
    }
  }

  /**
   * Generar QR code para pago
   */
  private async generateQRCode(paymentId: string): Promise<string> {
    // Payphone proporciona una URL para el QR
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

      // Normalizar firmas a lowercase para comparación
      const normalizedSignature = signature.toLowerCase().replace(/^0x/, '');
      const normalizedExpected = expectedSignature.toLowerCase();

      // Verificar longitud antes de timingSafeEqual
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
   * Mapear status de Payphone a status interno
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
}
