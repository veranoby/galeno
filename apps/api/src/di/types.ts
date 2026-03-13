// apps/api/src/di/types.ts
/**
 * Tipos para el Contenedor de Inyección de Dependencias
 */

import type { AwilixContainer } from 'awilix';
import type { PrismaClient } from '@prisma/client';
import type {
  ICuentaRepository,
  IConsultaRepository,
  IPacienteRepository,
  IPagoRepository,
  INotificationRepository
} from '../repositories/interfaces/index.js';

/**
 * Contenedor DI con todas las dependencias registradas
 */
export interface DIContainer extends AwilixContainer {
  prisma: PrismaClient;

  cuentaRepository: ICuentaRepository;
  consultaRepository: IConsultaRepository;
  pacienteRepository: IPacienteRepository;
  pagoRepository: IPagoRepository;
  notificationRepository: INotificationRepository;

  pushNotificationChannel: import('../services/notifications/channels/PushNotificationChannel.js').PushNotificationChannel;
  sseNotificationChannel: import('../services/notifications/channels/SSENotificationChannel.js').SSENotificationChannel;
  whatsappNotificationChannel: import('../services/notifications/channels/WhatsAppNotificationChannel.js').WhatsAppNotificationChannel;
  toastNotificationChannel: import('../services/notifications/channels/ToastNotificationChannel.js').ToastNotificationChannel;

  paymentGatewayService: import('../services/payment/gateways/PaymentGatewayService.js').PaymentGatewayService;
  subscriptionService: import('../services/payment/gateways/SubscriptionService.js').SubscriptionService;
  paymentWebhookService: import('../services/payment/handlers/PaymentWebhookService.js').PaymentWebhookService;
  paymentHistoryService: import('../services/payment/handlers/PaymentHistoryService.js').PaymentHistoryService;

  notificationOrchestrator: import('../services/notifications/NotificationOrchestrator.js').NotificationOrchestrator;
  paymentOrchestrator: import('../services/payment/PaymentOrchestrator.js').PaymentOrchestrator;
}

/**
 * Configuración de binding para una dependencia
 */
export interface DependencyBinding<T = unknown> {
  factory: (container: DIContainer) => T;
  lifetime: 'singleton' | 'scoped' | 'transient';
}

/**
 * Mapa de todas las configuraciones de dependencias
 */
export interface DependencyBindings {
  [name: string]: DependencyBinding;
}
