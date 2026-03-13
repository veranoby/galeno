/**
 * Payment Context
 *
 * Implementa el patrón Context para selección dinámica de estrategia de pago
 * basado en la ubicación geográfica del usuario (Geo-IP).
 *
 * - Ecuador → PayPhoneStrategy
 * - Internacional → PayPalStrategy
 *
 * @module services/payment/strategies
 */

import { IPaymentStrategy, PaymentStrategyType, StrategyError } from './payment.strategy.interface.js';
import { PayphoneStrategy } from './payphone.strategy.js';
import { PaypalStrategy } from './paypal.strategy.js';
import {
  PaymentRequest,
  PaymentResponse,
  VerifyPaymentResponse,
  RefundRequest,
  RefundResponse,
  WebhookResult
} from '../base.js';
import { logger } from '../../../utils/logger.js';

/**
 * Opciones para obtener la estrategia
 */
export interface StrategyOptions {
  /** País del usuario (ISO 3166-1 alpha-2) */
  countryCode?: string;
  /** Tipo de estrategia forzada (opcional) */
  forceStrategy?: PaymentStrategyType;
}

/**
 * Payment Context - Gestiona estrategias de pago dinámicas
 */
export class PaymentContext {
  private strategies: Map<PaymentStrategyType, IPaymentStrategy> = new Map();
  private initialized = false;

  /**
   * Inicializar el contexto y cargar estrategias
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Cargar PayPhone (Ecuador)
    try {
      const payphone = new PayphoneStrategy();
      await payphone.initialize();
      this.strategies.set('payphone', payphone);
      logger.info({ event: 'payment_strategy_loaded', strategy: 'payphone' });
    } catch (error: any) {
      logger.warn({
        event: 'payment_strategy_load_error',
        strategy: 'payphone',
        error: error.message
      });
    }

    // Cargar PayPal (Internacional)
    try {
      const paypal = new PaypalStrategy();
      await paypal.initialize();
      this.strategies.set('paypal', paypal);
      logger.info({ event: 'payment_strategy_loaded', strategy: 'paypal' });
    } catch (error: any) {
      logger.warn({
        event: 'payment_strategy_load_error',
        strategy: 'paypal',
        error: error.message
      });
    }

    this.initialized = true;
    logger.info({
      event: 'payment_context_initialized',
      strategiesCount: this.strategies.size
    });
  }

  /**
   * Obtener estrategia basada en el país
   *
   * @param options - Opciones de selección
   * @returns Estrategia seleccionada
   */
  async getStrategy(options?: StrategyOptions): Promise<IPaymentStrategy> {
    await this.initialize();

    // Si se fuerza una estrategia específica
    if (options?.forceStrategy) {
      const strategy = this.strategies.get(options.forceStrategy);
      if (!strategy) {
        throw new StrategyError(
          `Strategy ${options.forceStrategy} is not available`,
          'STRATEGY_NOT_AVAILABLE',
          options.forceStrategy
        );
      }
      return strategy;
    }

    // Selección automática basada en país
    const countryCode = options?.countryCode?.toUpperCase() || 'EC';

    // Ecuador → PayPhone
    if (countryCode === 'EC') {
      const strategy = this.strategies.get('payphone');
      if (!strategy) {
        throw new StrategyError(
          'PayPhone strategy is not configured',
          'PAYPHONE_NOT_CONFIGURED',
          'payphone'
        );
      }
      return strategy;
    }

    // Internacional → PayPal
    const strategy = this.strategies.get('paypal');
    if (!strategy) {
      throw new StrategyError(
        'PayPal strategy is not configured',
        'PAYPAL_NOT_CONFIGURED',
        'paypal'
      );
    }
    return strategy;
  }

  /**
   * Obtener estrategia por tipo
   */
  async getStrategyByType(type: PaymentStrategyType): Promise<IPaymentStrategy> {
    await this.initialize();

    const strategy = this.strategies.get(type);
    if (!strategy) {
      throw new StrategyError(
        `Strategy ${type} is not available`,
        'STRATEGY_NOT_AVAILABLE',
        type
      );
    }
    return strategy;
  }

  /**
   * Crear un pago con selección automática de estrategia
   */
  async createPayment(
    request: PaymentRequest,
    options?: StrategyOptions
  ): Promise<PaymentResponse> {
    const strategy = await this.getStrategy(options);
    
    logger.info({
      event: 'payment_context_create_payment',
      strategy: strategy.getType(),
      amount: request.amount,
      customerId: request.customerId
    });

    return strategy.createPayment(request);
  }

  /**
   * Verificar un pago con estrategia específica
   */
  async verifyPayment(
    transactionId: string,
    strategyType: PaymentStrategyType
  ): Promise<VerifyPaymentResponse> {
    const strategy = await this.getStrategyByType(strategyType);
    return strategy.verifyPayment(transactionId);
  }

  /**
   * Procesar webhook con estrategia específica
   */
  async handleWebhook(
    payload: any,
    signature: string | undefined,
    strategyType: PaymentStrategyType
  ): Promise<WebhookResult> {
    const strategy = await this.getStrategyByType(strategyType);
    return strategy.handleWebhook(payload, signature);
  }

  /**
   * Procesar reembolso con estrategia específica
   */
  async refund(
    request: RefundRequest,
    strategyType: PaymentStrategyType
  ): Promise<RefundResponse> {
    const strategy = await this.getStrategyByType(strategyType);
    return strategy.refund(request);
  }

  /**
   * Obtener estrategias disponibles
   */
  getAvailableStrategies(): PaymentStrategyType[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * Verificar si una estrategia está disponible
   */
  isStrategyAvailable(type: PaymentStrategyType): boolean {
    return this.strategies.has(type);
  }
}

// Singleton instance
export const paymentContext = new PaymentContext();
