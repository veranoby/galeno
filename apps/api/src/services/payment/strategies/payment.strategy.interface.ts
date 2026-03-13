/**
 * Payment Strategy Interface
 *
 * Define el contrato para las estrategias de pago (PayPhone, PayPal)
 * siguiendo el patrón Strategy para selección dinámica por país.
 *
 * @module services/payment/strategies
 */

import {
  PaymentRequest,
  PaymentResponse,
  VerifyPaymentResponse,
  RefundRequest,
  RefundResponse,
  WebhookResult
} from '../base.js';

/**
 * Tipo de estrategia de pago
 */
export type PaymentStrategyType = 'payphone' | 'paypal';

/**
 * Configuración base para estrategias
 */
export interface StrategyConfig {
  /** Tipo de gateway */
  type: PaymentStrategyType;
  /** URL base de la API */
  baseUrl: string;
  /** API key o client ID */
  clientId?: string;
  /** Secret key */
  secretKey?: string;
  /** URL de webhook */
  webhookUrl?: string;
  /** Timeout en ms */
  timeout?: number;
}

/**
 * Interface para estrategias de pago
 */
export interface IPaymentStrategy {
  /**
   * Inicializar la estrategia
   */
  initialize(): Promise<void>;

  /**
   * Crear un pago
   *
   * @param request - Datos del pago
   * @returns Response con transactionId y status
   */
  createPayment(request: PaymentRequest): Promise<PaymentResponse>;

  /**
   * Verificar el status de un pago
   *
   * @param transactionId - ID de transacción
   * @returns Status actual del pago
   */
  verifyPayment(transactionId: string): Promise<VerifyPaymentResponse>;

  /**
   * Procesar un webhook
   *
   * @param payload - Payload del webhook
   * @param signature - Firma de seguridad
   * @returns Resultado del procesamiento
   */
  handleWebhook(payload: any, signature?: string): Promise<WebhookResult>;

  /**
   * Procesar un reembolso
   *
   * @param request - Datos del reembolso
   * @returns Resultado del reembolso
   */
  refund(request: RefundRequest): Promise<RefundResponse>;

  /**
   * Obtener tipo de estrategia
   */
  getType(): PaymentStrategyType;
}

/**
 * Error de estrategia de pago
 */
export class StrategyError extends Error {
  constructor(
    message: string,
    public code: string,
    public strategy?: PaymentStrategyType
  ) {
    super(message);
    this.name = 'StrategyError';
  }
}
