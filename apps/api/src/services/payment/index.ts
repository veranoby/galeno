// apps/api/src/services/payment/index.ts
/**
 * Módulo de Servicios de Pago - Refactorizado
 *
 * Arquitectura modular:
 * - PaymentGatewayService: Pagos únicos (QR, card charges)
 * - SubscriptionService: Suscripciones recurrentes
 * - PaymentWebhookService: Manejo de webhooks
 * - PaymentHistoryService: Historial y métricas
 * - PaymentOrchestrator: Coordinador principal
 *
 * Backward compatibility: Se mantiene paymentService como alias
 */

import { Plan } from '@prisma/client';
import { PrismaClient } from '@prisma/client';

// Importar el orchestrator que contiene todos los servicios
import {
  PaymentOrchestrator,
  getPaymentOrchestrator,
  paymentService as orchestratorSingleton
} from './PaymentOrchestrator.js';

// Re-exportar todos los tipos y clases para backward compatibility
export {
  // Tipos
  PaymentProvider,
  CustomerData,
  Address,
  SubscriptionData,
  CustomerResult,
  SubscriptionResult,
  CancelResult,
  UpdateResult,
  InvoiceResult,
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
  GatewayConfig,
  CardData,
  TokenResponse,

  // Clases y errores
  PaymentGateway,
  PaymentError,
  WebhookSignatureError,
  KushkiProvider,
  PayphoneProvider,

  // Orquestador
  PaymentOrchestrator,
  getPaymentOrchestrator
} from './PaymentOrchestrator.js';

// Exportar servicios individuales para uso directo si se necesita
export { PaymentGatewayService } from './gateways/PaymentGatewayService.js';
export { SubscriptionService } from './gateways/SubscriptionService.js';
export { PaymentWebhookService } from './handlers/PaymentWebhookService.js';
export { PaymentHistoryService } from './handlers/PaymentHistoryService.js';

// Backward compatibility: paymentService como singleton
// Nota: Este es el mismo instance que getPaymentOrchestrator()
export const paymentService = orchestratorSingleton;

// Type exports para uso externo
export type { PaymentGateway } from './base.js';
export type { PaymentProvider } from './types.js';
