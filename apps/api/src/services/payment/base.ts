/**
 * Payment Gateway Base Classes and Interfaces
 * 
 * Proporciona una abstracción común para todas las pasarelas de pago
 * soportadas (Payphone, Kushki, Stripe, Paymentez).
 * 
 * @module services/payment
 */

/**
 * Status de un pago
 */
export type PaymentStatus = 'pending' | 'approved' | 'rejected' | 'refunded' | 'cancelled';

/**
 * Status de un split de comisión
 */
export type SplitStatus = 'pending' | 'paid' | 'failed';

/**
 * Tipos de gateway soportados
 */
export type PaymentGatewayType = 'payphone' | 'kushki' | 'stripe' | 'paymentez';

/**
 * Datos para crear un split de comisión
 */
export interface SplitCommission {
  /** ID de la cuenta recipiente */
  recipientAccountId: string;
  /** Monto a recibir */
  amount: number;
  /** Porcentaje del total (0-100) */
  percentage: number;
  /** Descripción opcional */
  description?: string;
}

/**
 * Request para crear un pago
 */
export interface PaymentRequest {
  /** Monto total en centavos (ej: 1000 = $10.00) */
  amount: number;
  /** Moneda (siempre USD para Ecuador) */
  currency: 'USD';
  /** ID del cliente */
  customerId: string;
  /** Descripción del pago */
  description: string;
  /** Splits de comisión (opcional) */
  splits?: SplitCommission[];
  /** Metadata adicional */
  metadata?: Record<string, any>;
  /** ID de idempotencia para prevenir pagos duplicados */
  idempotencyKey?: string;
}

/**
 * Response de creación de pago
 */
export interface PaymentResponse {
  /** ID de transacción único */
  transactionId: string;
  /** Status del pago */
  status: PaymentStatus;
  /** QR code para Payphone (base64 o URL) */
  qrCode?: string;
  /** Token para Kushki (card tokenization) */
  token?: string;
  /** URL de hosted checkout (Stripe/Paymentez) */
  hostedUrl?: string;
  /** Mensaje de error si aplica */
  error?: string;
  /** Metadata adicional */
  metadata?: Record<string, any>;
}

/**
 * Request para verificar un pago
 */
export interface VerifyPaymentRequest {
  /** ID de transacción a verificar */
  transactionId: string;
}

/**
 * Response de verificación de pago
 */
export interface VerifyPaymentResponse {
  /** ID de transacción */
  transactionId: string;
  /** Status actual del pago */
  status: PaymentStatus;
  /** Monto pagado */
  amount?: number;
  /** Fecha de aprobación */
  approvedAt?: Date;
  /** Metadata del pago */
  metadata?: Record<string, any>;
}

/**
 * Request para reembolso
 */
export interface RefundRequest {
  /** ID de transacción original */
  transactionId: string;
  /** Monto a reembolsar (parcial o total) */
  amount?: number;
  /** Razón del reembolso */
  reason?: string;
}

/**
 * Response de reembolso
 */
export interface RefundResponse {
  /** ID de reembolso */
  refundId: string;
  /** Status del reembolso */
  status: 'pending' | 'approved' | 'rejected';
  /** Monto reembolsado */
  amount: number;
  /** Mensaje de error si aplica */
  error?: string;
}

/**
 * Payload base para webhooks
 */
export interface WebhookPayload {
  /** Tipo de evento */
  event: string;
  /** ID de transacción */
  transactionId: string;
  /** Status del pago */
  status: PaymentStatus;
  /** Timestamp del evento */
  timestamp: number;
  /** Datos específicos del gateway */
  data: any;
}

/**
 * Resultado de procesamiento de webhook
 */
export interface WebhookResult {
  /** Si el webhook fue procesado exitosamente */
  success: boolean;
  /** ID de transacción procesada */
  transactionId?: string;
  /** Mensaje de error si aplica */
  error?: string;
}

/**
 * Configuración de gateway
 */
export interface GatewayConfig {
  /** API key pública */
  publicKey?: string;
  /** API key privada/secret */
  secretKey?: string;
  /** Merchant ID */
  merchantId?: string;
  /** URL base de la API */
  baseUrl: string;
  /** URL de webhook (callback) */
  webhookUrl?: string;
  /** Timeout en ms */
  timeout?: number;
}

/**
 * Clase abstracta para todos los payment gateways
 * 
 * Define el contrato que deben implementar todos los proveedores
 */
export abstract class PaymentGateway {
  protected config: GatewayConfig;
  protected initialized: boolean = false;

  constructor(config: GatewayConfig) {
    this.config = config;
  }

  /**
   * Inicializar el gateway
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    await this.validateConfig();
    this.initialized = true;
  }

  /**
   * Validar configuración del gateway
   */
  protected async validateConfig(): Promise<void> {
    if (!this.config.baseUrl) {
      throw new Error('Gateway baseUrl is required');
    }
    
    // Subclasses pueden agregar validaciones específicas
    await this.onValidateConfig();
  }

  /**
   * Hook para validaciones específicas de cada gateway
   */
  protected abstract onValidateConfig(): Promise<void>;

  /**
   * Crear un pago
   * 
   * @param request - Datos del pago
   * @returns Response con transactionId y status
   */
  abstract createPayment(request: PaymentRequest): Promise<PaymentResponse>;

  /**
   * Verificar el status de un pago
   * 
   * @param transactionId - ID de transacción a verificar
   * @returns Status actual del pago
   */
  abstract verifyPayment(transactionId: string): Promise<VerifyPaymentResponse>;

  /**
   * Procesar un webhook del gateway
   * 
   * @param payload - Payload del webhook
   * @param signature - Firma de seguridad (HMAC, etc)
   * @returns Resultado del procesamiento
   */
  abstract handleWebhook(payload: any, signature?: string): Promise<WebhookResult>;

  /**
   * Procesar un reembolso
   * 
   * @param request - Datos del reembolso
   * @returns Resultado del reembolso
   */
  abstract refund(request: RefundRequest): Promise<RefundResponse>;

  /**
   * Calcular splits de comisión
   * 
   * @param amount - Monto total
   * @param splits - Configuración de splits
   * @returns Splits calculados
   */
  protected calculateSplits(amount: number, splits?: SplitCommission[]): SplitCommission[] {
    if (!splits || splits.length === 0) {
      return [];
    }

    // Validar que la suma de porcentajes sea 100%
    const totalPercentage = splits.reduce((sum, split) => sum + split.percentage, 0);
    
    if (Math.abs(totalPercentage - 100) > 0.01) {
      throw new Error(`Split percentages must sum to 100%, got ${totalPercentage}%`);
    }

    // Calcular montos basados en porcentajes
    return splits.map(split => ({
      ...split,
      amount: Math.round(amount * (split.percentage / 100))
    }));
  }

  /**
   * Generar idempotency key
   */
  protected generateIdempotencyKey(customerId: string, amount: number, description: string): string {
    const timestamp = Date.now();
    return `idem_${customerId}_${amount}_${timestamp}`;
  }
}

/**
 * Error personalizado para pagos
 */
export class PaymentError extends Error {
  constructor(
    message: string,
    public code: string,
    public transactionId?: string
  ) {
    super(message);
    this.name = 'PaymentError';
  }
}

/**
 * Error de validación de webhook
 */
export class WebhookSignatureError extends Error {
  public code: string;
  
  constructor(message: string) {
    super(message);
    this.name = 'WebhookSignatureError';
    this.code = 'INVALID_SIGNATURE';
  }
}
