/**
 * Payment Orchestrator Service
 *
 * Orquesta las operaciones de pago entre diferentes gateways (Payphone, Kushki)
 * con manejo de idempotencia, split de comisiones y validación de seguridad.
 *
 * @module services/payment
 */

import prisma from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import {
  PaymentGateway,
  PaymentRequest,
  PaymentResponse,
  VerifyPaymentResponse,
  RefundRequest,
  RefundResponse,
  PaymentError,
  SplitCommission
} from './base.js';
import { PayphoneProvider } from './payphone.provider.js';
import { KushkiProvider } from './kushki.provider.js';

/**
 * Tipo de gateway de pago
 */
export type PaymentGatewayType = 'payphone' | 'kushki';

/**
 * Configuración de comisión para split
 */
export interface CommissionConfig {
  /** Porcentaje para Galeno (0-100) */
  galenoPercentage: number;
  /** Porcentaje para Doctor (0-100) */
  doctorPercentage: number;
}

/**
 * Resultado de procesamiento de pago
 */
export interface PaymentOrchestratorResult {
  /** Éxito de la operación */
  success: boolean;
  /** ID de transacción */
  transactionId?: string;
  /** ID del pago en BD */
  pagoId?: string;
  /** QR code (Payphone) */
  qrCode?: string;
  /** URL de pago (si aplica) */
  paymentUrl?: string;
  /** Error si ocurrió */
  error?: string;
  /** Código de error */
  errorCode?: string;
}

/**
 * Resultado de verificación de pago
 */
export interface PaymentVerificationResult {
  /** Éxito de la verificación */
  success: boolean;
  /** Estado del pago */
  status: 'pending' | 'approved' | 'rejected' | 'refunded' | 'cancelled';
  /** Monto */
  amount?: number;
  /** Fecha de aprobación */
  approvedAt?: Date;
  /** Splits de comisión */
  splits?: Array<{
    recipientId: string;
    amount: number;
    percentage: number;
    status: string;
  }>;
  /** Error si ocurrió */
  error?: string;
}

/**
 * Payment Orchestrator - Gestiona pagos entre múltiples gateways
 */
export class PaymentOrchestratorService {
  private providers: Map<PaymentGatewayType, PaymentGateway> = new Map();
  private initialized = false;

  /**
   * Inicializar el orquestador y cargar providers
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Cargar Payphone si está configurado
    if (process.env.PAYPHONE_API_KEY) {
      const payphone = new PayphoneProvider();
      await payphone.initialize();
      this.providers.set('payphone', payphone);
      logger.info({ event: 'payment_provider_loaded', provider: 'payphone' });
    }

    // Cargar Kushki si está configurado
    if (process.env.KUSHKI_PUBLIC_MERCHANT_ID) {
      const kushki = new KushkiProvider();
      await kushki.initialize();
      this.providers.set('kushki', kushki);
      logger.info({ event: 'payment_provider_loaded', provider: 'kushki' });
    }

    this.initialized = true;
    logger.info({
      event: 'payment_orchestrator_initialized',
      providersCount: this.providers.size
    });
  }

  /**
   * Obtener provider por tipo
   */
  private async getProvider(gateway: PaymentGatewayType): Promise<PaymentGateway> {
    await this.initialize();
    const provider = this.providers.get(gateway);
    if (!provider) {
      throw new PaymentError(
        `Payment gateway ${gateway} is not configured`,
        'GATEWAY_NOT_CONFIGURED'
      );
    }
    return provider;
  }

  /**
   * Obtener configuración de comisiones
   */
  private getCommissionConfig(): CommissionConfig {
    const galenoPercentage = process.env.GALENO_COMMISSION_PERCENTAGE
      ? parseFloat(process.env.GALENO_COMMISSION_PERCENTAGE)
      : 15;
    const doctorPercentage = process.env.DOCTOR_COMMISSION_PERCENTAGE
      ? parseFloat(process.env.DOCTOR_COMMISSION_PERCENTAGE)
      : 85;

    // Validar que sumen 100%
    const total = galenoPercentage + doctorPercentage;
    if (Math.abs(total - 100) > 0.01) {
      logger.warn({
        event: 'commission_config_warning',
        galenoPercentage,
        doctorPercentage,
        total,
        message: 'Commission percentages do not sum to 100%, adjusting doctor percentage'
      });
      // Ajustar doctor percentage para que sume 100%
      return {
        galenoPercentage,
        doctorPercentage: 100 - galenoPercentage
      };
    }

    return { galenoPercentage, doctorPercentage };
  }

  /**
   * Calcular splits de comisión
   */
  private calculateCommissionSplits(
    amount: number,
    doctorAccountId: string
  ): SplitCommission[] {
    const config = this.getCommissionConfig();

    const galenoAmount = Math.round(amount * (config.galenoPercentage / 100));
    const doctorAmount = amount - galenoAmount;

    const splits: SplitCommission[] = [
      {
        recipientAccountId: 'galeno-system', // ID especial para Galeno
        amount: galenoAmount,
        percentage: config.galenoPercentage,
        description: `Comisión Galeno (${config.galenoPercentage}%)`
      },
      {
        recipientAccountId: doctorAccountId,
        amount: doctorAmount,
        percentage: config.doctorPercentage,
        description: `Pago doctor (${config.doctorPercentage}%)`
      }
    ];

    logger.debug({
      event: 'commission_splits_calculated',
      totalAmount: amount,
      splits: {
        galeno: { amount: galenoAmount, percentage: config.galenoPercentage },
        doctor: { amount: doctorAmount, percentage: config.doctorPercentage }
      }
    });

    return splits;
  }

  /**
   * Generar idempotency key única
   */
  private generateIdempotencyKey(
    customerId: string,
    amount: number,
    description: string
  ): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `idem_${customerId}_${amount}_${timestamp}_${random}`;
  }

  /**
   * Verificar idempotencia (prevenir pagos duplicados)
   */
  private async checkIdempotency(
    idempotencyKey: string,
    gateway: PaymentGatewayType
  ): Promise<{ exists: boolean; pagoId?: string; transactionId?: string }> {
    const existingPago = await prisma.pago.findUnique({
      where: { externalId: idempotencyKey }
    });

    if (existingPago) {
      logger.info({
        event: 'idempotency_check_duplicate',
        idempotencyKey,
        existingPagoId: existingPago.id,
        existingStatus: existingPago.status
      });

      return {
        exists: true,
        pagoId: existingPago.id,
        transactionId: existingPago.transactionId
      };
    }

    return { exists: false };
  }

  /**
   * Crear pago (QR o cargo con tarjeta)
   *
   * @param gateway - Gateway de pago (payphone | kushki)
   * @param amount - Monto en centavos
   * @param customerId - ID del cliente (doctor/cuenta)
   * @param description - Descripción del pago
   * @param metadata - Metadata adicional
   * @param idempotencyKey - Key de idempotencia opcional
   * @returns Resultado del pago
   */
  async createPayment({
    gateway,
    amount,
    customerId,
    description,
    metadata = {},
    idempotencyKey
  }: {
    gateway: PaymentGatewayType;
    amount: number;
    customerId: string;
    description: string;
    metadata?: Record<string, any>;
    idempotencyKey?: string;
  }): Promise<PaymentOrchestratorResult> {
    try {
      await this.initialize();

      // 1. Verificar idempotencia
      const generatedIdempotencyKey = idempotencyKey || this.generateIdempotencyKey(customerId, amount, description);
      const idempotencyCheck = await this.checkIdempotency(generatedIdempotencyKey, gateway);

      if (idempotencyCheck.exists && idempotencyCheck.transactionId) {
        logger.info({
          event: 'payment_idempotency_duplicate_found',
          idempotencyKey: generatedIdempotencyKey,
          existingTransactionId: idempotencyCheck.transactionId
        });

        // Retornar pago existente
        return {
          success: true,
          transactionId: idempotencyCheck.transactionId,
          pagoId: idempotencyCheck.pagoId
        };
      }

      // 2. Obtener cuenta del doctor para calcular splits
      const cuenta = await prisma.cuenta.findUnique({
        where: { id: customerId },
        select: { id: true, email: true, nombre: true }
      });

      if (!cuenta) {
        throw new PaymentError(
          `Customer ${customerId} not found`,
          'CUSTOMER_NOT_FOUND'
        );
      }

      // 3. Calcular splits de comisión
      const splits = this.calculateCommissionSplits(amount, customerId);

      // 4. Crear registro de pago en BD (estado PENDING)
      const pago = await prisma.pago.create({
        data: {
          cuentaId: customerId,
          gateway,
          amount,
          currency: 'USD',
          status: 'PENDING',
          transactionId: generatedIdempotencyKey, // Usar idempotency key como transactionId temporal
          externalId: generatedIdempotencyKey,
          description,
          metadata
        }
      });

      logger.info({
        event: 'payment_created_pending',
        pagoId: pago.id,
        gateway,
        amount,
        customerId
      });

      // 5. Obtener provider y crear pago
      const provider = await this.getProvider(gateway);

      const paymentRequest: PaymentRequest = {
        amount,
        currency: 'USD',
        customerId,
        description,
        splits,
        metadata: {
          ...metadata,
          pagoId: pago.id,
          galenoCommission: splits[0].amount,
          doctorAmount: splits[1].amount
        },
        idempotencyKey: generatedIdempotencyKey
      };

      const paymentResponse = await provider.createPayment(paymentRequest);

      // 6. Actualizar pago con transactionId real del gateway
      await prisma.pago.update({
        where: { id: pago.id },
        data: {
          transactionId: paymentResponse.transactionId
        }
      });

      // 7. Crear splits de comisión (estado PENDING)
      await prisma.paymentSplit.createMany({
        data: splits.map(split => ({
          pagoId: pago.id,
          recipientId: split.recipientAccountId,
          amount: split.amount,
          percentage: split.percentage,
          status: 'PENDING',
          description: split.description
        }))
      });

      logger.info({
        event: 'payment_gateway_created',
        pagoId: pago.id,
        transactionId: paymentResponse.transactionId,
        gateway,
        amount,
        splits: splits.length
      });

      return {
        success: true,
        transactionId: paymentResponse.transactionId,
        pagoId: pago.id,
        qrCode: paymentResponse.qrCode,
        paymentUrl: paymentResponse.hostedUrl
      };
    } catch (error: any) {
      logger.error({
        event: 'payment_create_error',
        gateway,
        customerId,
        amount,
        error: error.message,
        code: error.code
      });

      return {
        success: false,
        error: error.message || 'Failed to create payment',
        errorCode: error.code || 'PAYMENT_CREATE_ERROR'
      };
    }
  }

  /**
   * Verificar estado de pago
   */
  async verifyPayment(
    gateway: PaymentGatewayType,
    transactionId: string
  ): Promise<PaymentVerificationResult> {
    try {
      await this.initialize();

      const provider = await this.getProvider(gateway);
      const verification = await provider.verifyPayment(transactionId);

      // Obtener splits de BD si existen
      const pago = await prisma.pago.findUnique({
        where: { transactionId },
        include: {
          splits: {
            include: {
              recipient: {
                select: { id: true, email: true, nombre: true }
              }
            }
          }
        }
      });

      const splits = pago?.splits.map(split => ({
        recipientId: split.recipientId,
        amount: Number(split.amount),
        percentage: split.percentage,
        status: split.status
      }));

      return {
        success: true,
        status: verification.status,
        amount: verification.amount,
        approvedAt: verification.approvedAt,
        splits
      };
    } catch (error: any) {
      logger.error({
        event: 'payment_verify_error',
        gateway,
        transactionId,
        error: error.message
      });

      return {
        success: false,
        status: 'pending',
        error: error.message || 'Failed to verify payment'
      };
    }
  }

  /**
   * Procesar reembolso
   */
  async refund(
    gateway: PaymentGatewayType,
    request: {
      transactionId: string;
      amount?: number;
      reason?: string;
    }
  ): Promise<{ success: boolean; refundId?: string; error?: string }> {
    try {
      await this.initialize();

      const provider = await this.getProvider(gateway);

      const refundRequest: RefundRequest = {
        transactionId: request.transactionId,
        amount: request.amount,
        reason: request.reason || 'Customer request'
      };

      const refundResponse: RefundResponse = await provider.refund(refundRequest);

      // Actualizar estado del pago en BD
      await prisma.pago.update({
        where: { transactionId: request.transactionId },
        data: {
          status: 'REFUNDED',
          metadata: {
            refundId: refundResponse.refundId,
            refundAmount: refundResponse.amount,
            refundReason: request.reason
          }
        }
      });

      // Actualizar splits como FAILED
      await prisma.paymentSplit.updateMany({
        where: {
          pago: {
            transactionId: request.transactionId
          }
        },
        data: {
          status: 'FAILED'
        }
      });

      logger.info({
        event: 'payment_refunded',
        transactionId: request.transactionId,
        refundId: refundResponse.refundId,
        amount: refundResponse.amount
      });

      return {
        success: true,
        refundId: refundResponse.refundId
      };
    } catch (error: any) {
      logger.error({
        event: 'payment_refund_error',
        gateway,
        transactionId: request.transactionId,
        error: error.message
      });

      return {
        success: false,
        error: error.message || 'Failed to process refund'
      };
    }
  }

  /**
   * Obtener historial de pagos de un cliente
   */
  async getPaymentHistory(customerId: string): Promise<Array<{
    id: string;
    gateway: string;
    amount: number;
    currency: string;
    status: string;
    transactionId: string;
    description: string | null;
    createdAt: Date;
    approvedAt: Date | null;
  }>> {
    try {
      const payments = await prisma.pago.findMany({
        where: { cuentaId: customerId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          gateway: true,
          amount: true,
          currency: true,
          status: true,
          transactionId: true,
          description: true,
          createdAt: true,
          approvedAt: true
        }
      });

      return payments.map(p => ({
        ...p,
        amount: Number(p.amount)
      }));
    } catch (error: any) {
      logger.error({
        event: 'payment_history_error',
        customerId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Obtener detalles de un pago con splits
   */
  async getPaymentDetails(transactionId: string): Promise<{
    pago: any;
    splits: Array<{
      id: string;
      recipientId: string;
      amount: number;
      percentage: number;
      status: string;
      description: string | null;
      paidAt: Date | null;
    }>;
  } | null> {
    try {
      const pago = await prisma.pago.findUnique({
        where: { transactionId },
        include: {
          splits: {
            select: {
              id: true,
              recipientId: true,
              amount: true,
              percentage: true,
              status: true,
              description: true,
              paidAt: true
            }
          },
          cuenta: {
            select: {
              id: true,
              email: true,
              nombre: true
            }
          }
        }
      });

      if (!pago) {
        return null;
      }

      return {
        pago: {
          ...pago,
          amount: Number(pago.amount)
        },
        splits: pago.splits.map(s => ({
          ...s,
          amount: Number(s.amount)
        }))
      };
    } catch (error: any) {
      logger.error({
        event: 'payment_details_error',
        transactionId,
        error: error.message
      });
      throw error;
    }
  }
}

// Singleton instance
export const paymentOrchestrator = new PaymentOrchestratorService();
