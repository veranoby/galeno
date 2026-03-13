// apps/api/src/services/payment/PaymentOrchestrator.ts
/**
 * Orquestador de servicios de pago
 * Coordina todos los servicios de pago y mantiene backward compatibility
 */

import { Plan } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import type { PaymentGateway } from './base.js';
import type { PaymentProvider, CustomerData, SubscriptionData, CustomerResult, SubscriptionResult, CancelResult, UpdateResult, InvoiceResult } from './types.js';

// Servicios especializados
import { PaymentGatewayService } from './gateways/PaymentGatewayService.js';
import { SubscriptionService } from './gateways/SubscriptionService.js';
import { PaymentWebhookService } from './handlers/PaymentWebhookService.js';
import { PaymentHistoryService } from './handlers/PaymentHistoryService.js';

// Re-export types
export type {
  PaymentProvider,
  CustomerData,
  Address,
  SubscriptionData,
  CustomerResult,
  SubscriptionResult,
  CancelResult,
  UpdateResult,
  InvoiceResult
} from './types.js';

export type {
  PaymentStatus,
  SplitStatus,
  PaymentGatewayType,
  SplitCommission,
  PaymentRequest,
  PaymentResponse,
  VerifyPaymentRequest,
  VerifyPaymentResponse,
  RefundRequest,
  RefundResponse,
  WebhookPayload,
  WebhookResult,
  GatewayConfig
} from './base.js';

export {
  PaymentGateway,
  PaymentError,
  WebhookSignatureError
} from './base.js';

export type { CardData, TokenResponse } from './kushki.provider.js';
export { KushkiProvider } from './kushki.provider.js';
export { PayphoneProvider } from './payphone.provider.js';

/**
 * PaymentOrchestrator - Coordinador de servicios de pago
 *
 * Mantiene backward compatibility con el PaymentService original
 * mientras delega a servicios especializados.
 */
export class PaymentOrchestrator {
  private gatewayService: PaymentGatewayService;
  private subscriptionService: SubscriptionService;
  private webhookService: PaymentWebhookService;
  private historyService: PaymentHistoryService;

  constructor(private prisma: PrismaClient, pagoRepo?: any) {
    this.gatewayService = new PaymentGatewayService();
    this.subscriptionService = new SubscriptionService(prisma);
    this.webhookService = new PaymentWebhookService(prisma);
    this.historyService = new PaymentHistoryService(prisma, pagoRepo);
  }

  // ========== GATEWAY SERVICE (Pagos únicos) ==========

  /**
   * Crear pago único (QR o tarjeta)
   */
  async createPayment(provider: 'payphone' | 'kushki', request: any) {
    return await this.gatewayService.createPayment(provider, request);
  }

  /**
   * Verificar estado de pago
   */
  async verifyPayment(provider: 'payphone' | 'kushki', transactionId: string) {
    return await this.gatewayService.verifyPayment(provider, transactionId);
  }

  /**
   * Procesar reembolso
   */
  async refund(provider: 'payphone' | 'kushki', request: any) {
    return await this.gatewayService.refund(provider, request);
  }

  // ========== SUBSCRIPTION SERVICE (Suscripciones) ==========

  /**
   * Crear cliente para suscripciones
   */
  async createCustomer(provider: 'payphone' | 'kushki', userData: CustomerData): Promise<CustomerResult> {
    return await this.subscriptionService.createCustomer(provider, userData);
  }

  /**
   * Crear suscripción
   */
  async createSubscription(
    userId: string,
    provider: 'payphone' | 'kushki',
    plan: Plan,
    paymentMethodId: string,
    trialPeriodDays?: number
  ): Promise<SubscriptionResult> {
    return await this.subscriptionService.createSubscription(userId, provider, plan, paymentMethodId, trialPeriodDays);
  }

  /**
   * Cancelar suscripción
   */
  async cancelSubscription(userId: string, provider: 'payphone' | 'kushki'): Promise<CancelResult> {
    return await this.subscriptionService.cancelSubscription(userId, provider);
  }

  /**
   * Actualizar método de pago
   */
  async updatePaymentMethod(userId: string, provider: 'payphone' | 'kushki', paymentMethodId: string): Promise<UpdateResult> {
    return await this.subscriptionService.updatePaymentMethod(userId, provider, paymentMethodId);
  }

  /**
   * Obtener factura
   */
  async getInvoice(userId: string, invoiceId: string): Promise<InvoiceResult> {
    return await this.subscriptionService.getInvoice(userId, invoiceId);
  }

  // ========== WEBHOOK SERVICE (Webhooks) ==========

  /**
   * Manejar webhook
   */
  async handleWebhook(provider: 'payphone' | 'kushki', payload: any, signature?: string) {
    return await this.webhookService.handleWebhook(provider, payload, signature);
  }

  // ========== HISTORY SERVICE (Historial) ==========

  /**
   * Obtener historial de pagos
   */
  async getPaymentHistory(cuentaId: string) {
    return await this.historyService.getPaymentHistory(cuentaId);
  }

  /**
   * Obtener métricas de pagos
   */
  async getPaymentMetrics(cuentaId: string, startDate?: Date, endDate?: Date) {
    return await this.historyService.getPaymentMetrics(cuentaId, startDate, endDate);
  }

  /**
   * Obtener resumen de pagos
   */
  async getPaymentSummary(cuentaId: string, startDate?: Date, endDate?: Date) {
    return await this.historyService.getPaymentSummary(cuentaId, startDate, endDate);
  }

  /**
   * Buscar pago por transaction ID
   */
  async getPaymentByTransactionId(transactionId: string) {
    return await this.historyService.getPaymentByTransactionId(transactionId);
  }

  /**
   * Obtener URL de factura
   */
  async getInvoiceUrl(pagoId: string) {
    return await this.historyService.getInvoiceUrl(pagoId);
  }

  // ========== UTILIDADES ==========

  /**
   * Verificar si un gateway está disponible
   */
  isGatewayAvailable(provider: string): boolean {
    return this.gatewayService.isGatewayAvailable(provider);
  }
}

// Función para obtener el orchestrator con lazy initialization
let orchestratorInstance: PaymentOrchestrator | null = null;

export function getPaymentOrchestrator(prisma?: PrismaClient): PaymentOrchestrator {
  if (!orchestratorInstance) {
    const db = prisma || require('../../config/database.js').default;
    // TODO: Inyectar pagoRepo cuando se migre completamente a Repository
    orchestratorInstance = new PaymentOrchestrator(db);
  }
  return orchestratorInstance;
}

// Backward compatibility alias (evaluado lazy)
// Nota: Esto se evaluará la primera vez que se importe el módulo
Object.defineProperty(module, 'exports', {
  get: () => ({
    PaymentOrchestrator,
    getPaymentOrchestrator,
    paymentService: null // Será seteado por getPaymentOrchestrator()
  })
});

// Exportar paymentService como getter para lazy initialization
export const paymentService = new Proxy({} as PaymentOrchestrator, {
  get(_target, prop) {
    const instance = getPaymentOrchestrator();
    return instance[prop as keyof PaymentOrchestrator];
  }
});
