/**
 * PayPal Payment Strategy
 *
 * Implementación de estrategia para PayPal (Internacional)
 * Soporta suscripciones recurrentes y pagos únicos
 *
 * Documentación: https://developer.paypal.com/docs/api/
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
 * Configuración específica de PayPal
 */
interface PaypalStrategyConfig extends StrategyConfig {
  type: 'paypal';
  clientId: string;
  secretKey: string;
  webhookId: string;
}

/**
 * Payload de webhook de PayPal
 */
interface PaypalWebhookPayload {
  id: string;
  event_type: string;
  resource_type: string;
  resource: {
    id: string;
    status: string;
    amount?: {
      currency_code: string;
      value: string;
    };
    create_time?: string;
    update_time?: string;
  };
  create_time: string;
}

/**
 * Estrategia de pago para PayPal (Internacional)
 */
export class PaypalStrategy implements IPaymentStrategy {
  private client: AxiosInstance;
  private config: PaypalStrategyConfig;
  private initialized = false;
  private accessToken?: string;
  private tokenExpiresAt?: number;

  constructor(config?: Partial<PaypalStrategyConfig>) {
    this.config = {
      type: 'paypal',
      baseUrl: config?.baseUrl || 'https://api-m.sandbox.paypal.com',
      clientId: process.env.PAYPAL_CLIENT_ID || '',
      secretKey: process.env.PAYPAL_SECRET || '',
      webhookId: process.env.PAYPAL_WEBHOOK_ID || '',
      timeout: config?.timeout || 30000,
      ...config
    } as PaypalStrategyConfig;

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    this.setupInterceptors();
  }

  /**
   * Configurar interceptores para logging y auth
   */
  private setupInterceptors(): void {
    this.client.interceptors.request.use(async (config) => {
      // Agregar token de acceso
      await this.ensureAccessToken();
      config.headers.Authorization = `Bearer ${this.accessToken}`;

      logger.debug({
        event: 'paypal_request',
        method: config.method,
        url: config.url
      });
      return config;
    });

    this.client.interceptors.response.use(
      (response) => {
        logger.debug({
          event: 'paypal_response',
          status: response.status,
          url: response.config.url
        });
        return response;
      },
      (error) => {
        logger.error({
          event: 'paypal_error',
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

    if (!this.config.clientId) {
      throw new StrategyError(
        'PAYPAL_CLIENT_ID is required',
        'MISSING_CLIENT_ID',
        'paypal'
      );
    }
    if (!this.config.secretKey) {
      throw new StrategyError(
        'PAYPAL_SECRET is required',
        'MISSING_SECRET_KEY',
        'paypal'
      );
    }
    if (!this.config.webhookId) {
      throw new StrategyError(
        'PAYPAL_WEBHOOK_ID is required',
        'MISSING_WEBHOOK_ID',
        'paypal'
      );
    }

    this.initialized = true;
    logger.info({ event: 'paypal_strategy_initialized' });
  }

  /**
   * Obtener tipo de estrategia
   */
  getType(): 'paypal' {
    return 'paypal';
  }

  /**
   * Obtener/refresh access token
   */
  private async ensureAccessToken(): Promise<void> {
    const now = Date.now();

    // Si el token es válido, no hacer nada
    if (this.accessToken && this.tokenExpiresAt && now < this.tokenExpiresAt) {
      return;
    }

    // Obtener nuevo token
    const credentials = Buffer.from(
      `${this.config.clientId}:${this.config.secretKey}`
    ).toString('base64');

    const response = await axios.post(
      `${this.config.baseUrl}/v1/oauth2/token`,
      'grant_type=client_credentials',
      {
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    this.accessToken = response.data.access_token;
    // El token expira en 32400 segundos (9 horas), restamos 5 min de margen
    this.tokenExpiresAt = now + (response.data.expires_in - 300) * 1000;

    logger.debug({
      event: 'paypal_access_token_obtained',
      expiresIn: response.data.expires_in
    });
  }

  /**
   * Crear un pago o suscripción con PayPal
   *
   * @param request - Datos del pago
   * @returns Response con approvalUrl y transactionId
   */
  async createPayment(request: PaymentRequest): Promise<PaymentResponse> {
    try {
      await this.initialize();

      // Generar idempotency key
      const idempotencyKey = request.idempotencyKey ||
        this.generateIdempotencyKey(request.customerId, request.amount, request.description);

      // Determinar si es suscripción o pago único
      const isSubscription = request.metadata?.isSubscription === true;

      if (isSubscription) {
        // Crear suscripción
        return await this.createSubscription(request, idempotencyKey);
      } else {
        // Crear pago único (Order)
        return await this.createOrder(request, idempotencyKey);
      }
    } catch (error: any) {
      logger.error({
        event: 'paypal_create_payment_error',
        error: error.message,
        customerId: request.customerId,
        amount: request.amount
      });

      throw new StrategyError(
        error.response?.data?.message || 'Failed to create PayPal payment',
        error.response?.data?.name || 'PAYPAL_CREATE_ERROR',
        'paypal'
      );
    }
  }

  /**
   * Crear una suscripción (Billing Plan)
   */
  private async createSubscription(
    request: PaymentRequest,
    idempotencyKey: string
  ): Promise<PaymentResponse> {
    const planId = request.metadata?.planId;

    if (!planId) {
      throw new StrategyError(
        'planId is required for subscriptions',
        'MISSING_PLAN_ID',
        'paypal'
      );
    }

    // Crear suscripción
    const response = await this.client.post(
      '/v1/billing/subscriptions',
      {
        plan_id: planId,
        start_time: new Date(Date.now() + 60000).toISOString(), // 1 min desde ahora
        subscriber: {
          name: {
            given_name: request.customerId,
            surname: 'Customer'
          },
          email_address: request.metadata?.email || `${request.customerId}@example.com`
        },
        application_context: {
          brand_name: 'Galeno',
          locale: 'es-EC',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'SUBSCRIBE_NOW',
          payment_method: {
            payer_selected: 'PAYPAL',
            payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED'
          },
          return_url: `${request.metadata?.returnUrl || 'http://localhost:5173'}/payment/success?session_id=${idempotencyKey}`,
          cancel_url: `${request.metadata?.returnUrl || 'http://localhost:5173'}/payment/cancel`
        }
      },
      {
        headers: {
          'Prefer': 'return=representation',
          'PayPal-Request-Id': idempotencyKey
        }
      }
    );

    const subscription = response.data;

    // Obtener URL de aprobación
    const approvalUrl = subscription.links?.find(
      (link: any) => link.rel === 'approve'
    )?.href;

    logger.info({
      event: 'paypal_subscription_created',
      subscriptionId: subscription.id,
      planId,
      amount: request.amount
    });

    return {
      transactionId: subscription.id,
      status: 'pending',
      hostedUrl: approvalUrl,
      metadata: {
        type: 'subscription',
        plan_id: planId
      }
    };
  }

  /**
   * Crear un pago único (Order)
   */
  private async createOrder(
    request: PaymentRequest,
    idempotencyKey: string
  ): Promise<PaymentResponse> {
    const amountInDollars = (request.amount / 100).toFixed(2);

    // Crear orden
    const response = await this.client.post(
      '/v2/checkout/orders',
      {
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: idempotencyKey,
            amount: {
              currency_code: 'USD',
              value: amountInDollars,
              breakdown: {
                item_total: {
                  currency_code: 'USD',
                  value: amountInDollars
                }
              }
            },
            description: request.description,
            custom_id: idempotencyKey
          }
        ],
        application_context: {
          brand_name: 'Galeno',
          locale: 'es-EC',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'PAY_NOW',
          return_url: `${request.metadata?.returnUrl || 'http://localhost:5173'}/payment/success?session_id=${idempotencyKey}`,
          cancel_url: `${request.metadata?.returnUrl || 'http://localhost:5173'}/payment/cancel`
        }
      },
      {
        headers: {
          'PayPal-Request-Id': idempotencyKey
        }
      }
    );

    const order = response.data;

    // Obtener URL de aprobación
    const approvalUrl = order.links?.find(
      (link: any) => link.rel === 'approve'
    )?.href;

    logger.info({
      event: 'paypal_order_created',
      orderId: order.id,
      amount: request.amount
    });

    return {
      transactionId: order.id,
      status: 'pending',
      hostedUrl: approvalUrl,
      metadata: {
        type: 'order',
        reference_id: idempotencyKey
      }
    };
  }

  /**
   * Verificar el status de un pago
   */
  async verifyPayment(transactionId: string): Promise<VerifyPaymentResponse> {
    try {
      await this.initialize();

      // Intentar verificar como orden primero
      try {
        const orderResponse = await this.client.get(`/v2/checkout/orders/${transactionId}`);
        const order = orderResponse.data;

        const status = this.mapStatus(order.status);

        return {
          transactionId: order.id,
          status,
          amount: order.purchase_units?.[0]?.amount?.value
            ? Math.round(parseFloat(order.purchase_units[0].amount.value) * 100)
            : undefined,
          approvedAt: status === 'approved' ? new Date(order.create_time) : undefined,
          metadata: {
            type: 'order',
            status: order.status
          }
        };
      } catch {
        // Si no es orden, intentar como suscripción
        const subResponse = await this.client.get(`/v1/billing/subscriptions/${transactionId}`);
        const subscription = subResponse.data;

        const status = this.mapSubscriptionStatus(subscription.status);

        return {
          transactionId: subscription.id,
          status,
          metadata: {
            type: 'subscription',
            status: subscription.status,
            plan_id: subscription.plan_id
          }
        };
      }
    } catch (error: any) {
      logger.error({
        event: 'paypal_verify_payment_error',
        error: error.message,
        transactionId
      });

      throw new StrategyError(
        error.response?.data?.message || 'Failed to verify PayPal payment',
        error.response?.data?.name || 'PAYPAL_VERIFY_ERROR',
        'paypal'
      );
    }
  }

  /**
   * Procesar un webhook de PayPal
   *
   * Valida firma usando PayPal-Transmission-Sig
   */
  async handleWebhook(payload: any, signature?: string): Promise<WebhookResult> {
    try {
      await this.initialize();

      // 1. Verificar firma
      if (!signature) {
        throw new StrategyError(
          'Missing webhook signature',
          'MISSING_SIGNATURE',
          'paypal'
        );
      }

      // PayPal usa verificación vía API, no HMAC local
      const isValid = await this.verifyWebhookSignature(payload, signature);
      if (!isValid) {
        throw new StrategyError(
          'Invalid webhook signature',
          'INVALID_SIGNATURE',
          'paypal'
        );
      }

      // 2. Procesar evento
      const webhookPayload: PaypalWebhookPayload = payload;
      const eventType = webhookPayload.event_type;

      logger.info({
        event: 'paypal_webhook_received',
        eventType,
        transactionId: webhookPayload.resource?.id,
        status: webhookPayload.resource?.status
      });

      // 3. Procesar según tipo de evento
      switch (eventType) {
        case 'BILLING.SUBSCRIPTION.ACTIVATED':
        case 'CHECKOUT.ORDER.APPROVED':
        case 'PAYMENT.CAPTURE.COMPLETED':
          // El payment orchestrator actualizará el estado en BD
          break;
        default:
          logger.debug({
            event: 'paypal_webhook_event_ignored',
            eventType
          });
      }

      return {
        success: true,
        transactionId: webhookPayload.resource?.id
      };
    } catch (error: any) {
      logger.error({
        event: 'paypal_webhook_error',
        error: error.message,
        transactionId: payload?.resource?.id
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
          'paypal'
        );
      }

      const refundAmount = request.amount || payment.amount || 0;
      const amountInDollars = (refundAmount / 100).toFixed(2);

      // Crear reembolso (capture refund)
      const response = await this.client.post(
        `/v2/checkout/orders/${request.transactionId}/capture`,
        {
          amount: {
            currency_code: 'USD',
            value: amountInDollars
          },
          note_to_payer: request.reason || 'Customer request'
        }
      );

      logger.info({
        event: 'paypal_refund_created',
        transactionId: request.transactionId,
        refundId: response.data.id,
        amount: refundAmount
      });

      return {
        refundId: response.data.id,
        status: response.data.status === 'COMPLETED' ? 'approved' : 'pending',
        amount: refundAmount
      };
    } catch (error: any) {
      logger.error({
        event: 'paypal_refund_error',
        error: error.message,
        transactionId: request.transactionId
      });

      throw new StrategyError(
        error.response?.data?.message || 'Failed to process refund',
        error.response?.data?.name || 'PAYPAL_REFUND_ERROR',
        'paypal'
      );
    }
  }

  /**
   * Verificar firma de webhook vía API de PayPal
   */
  private async verifyWebhookSignature(payload: any, signature: string): Promise<boolean> {
    try {
      const transmissionId = payload.transmission_id;
      const transmissionTime = payload.transmission_time;
      const webhookId = this.config.webhookId;

      // Construir string para verificación
      const crcPayload = `${transmissionId}|${transmissionTime}|${webhookId}|${JSON.stringify(payload)}`;

      // Obtener certificado público de PayPal
      const certResponse = await this.client.get(
        '/v1/notifications/verify-webhook-signature',
        {
          headers: {
            'Paypal-Transmission-Sig': signature
          }
        }
      );

      // Verificar usando la API de PayPal
      const verificationResponse = await this.client.post(
        '/v1/notifications/verify-webhook-signature',
        {
          auth_algo: certResponse.data.auth_algo,
          cert_url: certResponse.data.cert_url,
          transmission_id: transmissionId,
          transmission_sig: signature,
          transmission_time: transmissionTime,
          webhook_id: webhookId,
          webhook_event: payload
        }
      );

      return verificationResponse.data.verification_status === 'SUCCESS';
    } catch (error: any) {
      logger.error({
        event: 'paypal_signature_verification_error',
        error: error.message
      });
      return false;
    }
  }

  /**
   * Mapear status de PayPal Order a status interno
   */
  private mapStatus(paypalStatus: string): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      'CREATED': 'pending',
      'SAVED': 'pending',
      'APPROVED': 'approved',
      'VOIDED': 'cancelled',
      'COMPLETED': 'approved',
      'PAYER_ACTION_REQUIRED': 'pending'
    };

    return statusMap[paypalStatus] || 'pending';
  }

  /**
   * Mapear status de PayPal Subscription a status interno
   */
  private mapSubscriptionStatus(paypalStatus: string): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      'APPROVAL_PENDING': 'pending',
      'APPROVED': 'approved',
      'ACTIVE': 'approved',
      'SUSPENDED': 'pending',
      'CANCELLED': 'cancelled',
      'EXPIRED': 'cancelled'
    };

    return statusMap[paypalStatus] || 'pending';
  }

  /**
   * Generar idempotency key
   */
  private generateIdempotencyKey(customerId: string, amount: number, description: string): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    return `paypal_${customerId}_${amount}_${timestamp}_${random}`;
  }
}
