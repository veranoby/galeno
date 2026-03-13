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

// Re-exportar el orchestrator y funciones principales
export { PaymentOrchestrator, getPaymentOrchestrator };
export const paymentService = orchestratorSingleton;

// Exportar servicios individuales para uso directo
export { PaymentGatewayService } from './gateways/PaymentGatewayService.js';
export { SubscriptionService } from './gateways/SubscriptionService.js';
export { PaymentWebhookService } from './handlers/PaymentWebhookService.js';
export { PaymentHistoryService } from './handlers/PaymentHistoryService.js';

// Re-exportar tipos desde base y types
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

export type { CardData, TokenResponse } from './kushki.provider.js';

// Exportar clases
export { PaymentGateway, PaymentError, WebhookSignatureError } from './base.js';

// KushkiProvider y PayphoneProvider están en sus propios archivos
export { KushkiProvider } from './kushki.provider.js';
export { PayphoneProvider } from './payphone.provider.js';
