/**
 * Kushki Payment Provider
 * 
 * Integración con la API de Kushki para Ecuador/Perú
 * Soporta tokenización de tarjetas (PCI compliant) y split de comisiones
 * 
 * Documentación: https://docs.kushkipagos.com/
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
  WebhookResult,
  PaymentStatus,
  PaymentError,
  WebhookSignatureError
} from './base.js';
import { logger } from '../../utils/logger.js';

/**
 * Configuración específica de Kushki
 */
interface KushkiConfig extends GatewayConfig {
  publicMerchantId: string;
  privateMerchantId: string;
  webhookSecret: string;
}

/**
 * Datos de tarjeta para tokenización (NUNCA almacenar PAN completo)
 */
export interface CardData {
  /** Número de tarjeta (se enmascara después de tokenizar) */
  cardNumber: string;
  /** Nombre del titular */
  cardHolderName: string;
  /** Mes de expiración (MM) */
  expiryMonth: string;
  /** Año de expiración (YY) */
  expiryYear: string;
  /** CVV */
  cvv: string;
  /** Número de cuotas */
  installments?: number;
}

/**
 * Response de tokenización
 */
export interface TokenResponse {
  /** Token seguro de la tarjeta */
  token: string;
  /** Últimos 4 dígitos (para mostrar al usuario) */
  lastFourDigits: string;
  /** Marca de la tarjeta */
  brand: string;
  /** Tipo de tarjeta */
  cardType: 'credit' | 'debit';
}

/**
 * Provider de Kushki
 */
export class KushkiProvider extends PaymentGateway {
  private client: AxiosInstance;
  protected config: KushkiConfig;

  constructor(config?: Partial<KushkiConfig>) {
    const finalConfig = {
      baseUrl: config?.baseUrl || 'https://api.kushkipagos.com',
      publicKey: config?.publicMerchantId,
      secretKey: config?.privateMerchantId,
      merchantId: config?.publicMerchantId,
      webhookUrl: config?.webhookUrl,
      timeout: config?.timeout || 30000
    };
    
    super(finalConfig);

    this.config = {
      publicMerchantId: process.env.KUSHKI_PUBLIC_MERCHANT_ID || '',
      privateMerchantId: process.env.KUSHKI_PRIVATE_MERCHANT_ID || '',
      webhookSecret: process.env.KUSHKI_WEBHOOK_SECRET || '',
      baseUrl: finalConfig.baseUrl,
      timeout: finalConfig.timeout,
      ...config
    } as KushkiConfig;

    this.client = axios.create({
      baseURL: `${this.config.baseUrl}/v1`,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'kushki-merchant-id': this.config.privateMerchantId
      }
    });

    // Request interceptor para logging
    this.client.interceptors.request.use((config) => {
      logger.debug({
        event: 'kushki_request',
        method: config.method,
        url: config.url
      });
      return config;
    });

    // Response interceptor para logging
    this.client.interceptors.response.use(
      (response) => {
        logger.debug({
          event: 'kushki_response',
          status: response.status,
          url: response.config.url
        });
        return response;
      },
      (error) => {
        logger.error({
          event: 'kushki_error',
          message: error.message,
          status: error.response?.status,
          url: error.config?.url
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Validar configuración específica de Kushki
   */
  protected async onValidateConfig(): Promise<void> {
    if (!this.config.publicMerchantId) {
      throw new Error('KUSHKI_PUBLIC_MERCHANT_ID environment variable is required');
    }
    if (!this.config.privateMerchantId) {
      throw new Error('KUSHKI_PRIVATE_MERCHANT_ID environment variable is required');
    }
    if (!this.config.webhookSecret) {
      throw new Error('KUSHKI_WEBHOOK_SECRET environment variable is required');
    }
  }

  /**
   * Tokenizar una tarjeta (PCI compliant)
   * 
   * @param cardData - Datos de la tarjeta
   * @returns Token seguro
   */
  async createToken(cardData: CardData): Promise<TokenResponse> {
    try {
      await this.initialize();

      // IMPORTANTE: Los datos de tarjeta NUNCA deben loguearse
      const response = await this.client.post('/tokenize', {
        card: {
          cardNumber: cardData.cardNumber,
          cardHolderName: cardData.cardHolderName,
          expiryMonth: cardData.expiryMonth,
          expiryYear: cardData.expiryYear,
          cvv: cardData.cvv
        },
        installments: cardData.installments || 1
      });

      const tokenData = response.data;

      logger.info({
        event: 'kushki_token_created',
        token: tokenData.token.substring(0, 8) + '...',
        brand: tokenData.brand,
        lastFourDigits: tokenData.lastFourDigits
      });

      return {
        token: tokenData.token,
        lastFourDigits: tokenData.lastFourDigits,
        brand: tokenData.brand,
        cardType: tokenData.cardType
      };
    } catch (error: any) {
      logger.error({
        event: 'kushki_token_error',
        error: error.message,
        cardHolderName: cardData.cardHolderName
      });

      throw new PaymentError(
        error.response?.data?.message || 'Failed to tokenize card',
        error.response?.data?.code || 'KUSHKI_TOKEN_ERROR'
      );
    }
  }

  /**
   * Crear un pago con token de tarjeta
   * 
   * @param token - Token de la tarjeta
   * @param request - Datos del pago
   * @returns Response con transactionId
   */
  async createPayment(request: PaymentRequest): Promise<PaymentResponse> {
    try {
      await this.initialize();

      // El token debe venir en metadata.token
      const token = request.metadata?.token;
      if (!token) {
        throw new PaymentError(
          'Card token is required',
          'MISSING_TOKEN'
        );
      }

      // Generar idempotency key
      const idempotencyKey = request.idempotencyKey || 
        this.generateIdempotencyKey(request.customerId, request.amount, request.description);

      // Calcular splits
      const splits = this.calculateSplits(request.amount, request.splits);

      // Crear cargo en Kushki
      const response = await this.client.post('/charge', {
        token: token,
        amount: request.amount, // En centavos
        currency: request.currency,
        externalId: idempotencyKey,
        description: request.description,
        metadata: {
          customerId: request.customerId,
          splits: splits.length > 0 ? splits : undefined,
          ...request.metadata
        },
        installments: request.metadata?.installments || 1
      });

      const charge = response.data;

      logger.info({
        event: 'kushki_payment_created',
        transactionId: charge.transactionId,
        externalId: idempotencyKey,
        amount: request.amount,
        splits: splits.length
      });

      return {
        transactionId: charge.transactionId,
        status: this.mapStatus(charge.status),
        token: undefined // El token ya fue usado, no retornarlo
      };
    } catch (error: any) {
      logger.error({
        event: 'kushki_create_payment_error',
        error: error.message,
        customerId: request.customerId,
        amount: request.amount
      });

      throw new PaymentError(
        error.response?.data?.message || 'Failed to create Kushki payment',
        error.response?.data?.code || 'KUSHKI_CHARGE_ERROR',
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

      const response = await this.client.get(`/transactions/${transactionId}`);
      const transaction = response.data;

      const status = this.mapStatus(transaction.status);

      return {
        transactionId: transaction.id,
        status,
        amount: transaction.amount,
        approvedAt: status === 'approved' ? new Date(transaction.approvedAt) : undefined,
        metadata: {
          authorizationCode: transaction.authorizationCode,
          lastFourDigits: transaction.lastFourDigits
        }
      };
    } catch (error: any) {
      logger.error({
        event: 'kushki_verify_payment_error',
        error: error.message,
        transactionId
      });

      throw new PaymentError(
        error.response?.data?.message || 'Failed to verify Kushki payment',
        error.response?.data?.code || 'KUSHKI_VERIFY_ERROR',
        transactionId
      );
    }
  }

  /**
   * Procesar un webhook de Kushki
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
      const status = this.mapStatus(payload.status);

      logger.info({
        event: 'kushki_webhook_received',
        transactionId: payload.transactionId,
        status,
        amount: payload.amount
      });

      // 3. Actualizar estado en BD (esto se haría en el service layer)
      // await updatePaymentStatus(payload.externalId, status);

      // 4. Procesar splits si el pago fue aprobado
      if (status === 'approved') {
        // await processPaymentSplits(payload.transactionId, payload.amount);
        // await sendPaymentConfirmationEmail(payload.externalId);
      }

      return {
        success: true,
        transactionId: payload.transactionId
      };
    } catch (error: any) {
      logger.error({
        event: 'kushki_webhook_error',
        error: error.message,
        transactionId: payload?.transactionId
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

      // Crear reembolso en Kushki
      const response = await this.client.post(`/transactions/${request.transactionId}/void`, {
        amount: refundAmount,
        reason: request.reason || 'Customer request'
      });

      logger.info({
        event: 'kushki_refund_created',
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
        event: 'kushki_refund_error',
        error: error.message,
        transactionId: request.transactionId
      });

      throw new PaymentError(
        error.response?.data?.message || 'Failed to process refund',
        error.response?.data?.code || 'KUSHKI_REFUND_ERROR',
        request.transactionId
      );
    }
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
          event: 'kushki_signature_length_mismatch',
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
        event: 'kushki_signature_verification_error',
        error: error.message
      });
      return false;
    }
  }

  /**
   * Mapear status de Kushki a status interno
   */
  private mapStatus(kushkiStatus: string): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      'PENDING': 'pending',
      'APPROVED': 'approved',
      'DECLINED': 'rejected',
      'REFUNDED': 'refunded',
      'CANCELLED': 'cancelled',
      'VOIDED': 'cancelled'
    };

    return statusMap[kushkiStatus] || 'pending';
  }
}
