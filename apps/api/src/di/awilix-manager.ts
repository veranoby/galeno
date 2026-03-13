// apps/api/src/di/awilix-manager.ts
/**
 * AwilixManager - Gestor del Contenedor de Inyección de Dependencias
 *
 * Configura y mantiene el contenedor Awilix con todos los servicios,
 * repositorios y orquestradores del sistema.
 */

import { createContainer, asFunction, asClass } from 'awilix';
import type { AwilixContainer } from 'awilix';
import type { PrismaClient } from '@prisma/client';
import prisma from '../config/database.js';

// Repositories
import {
  PrismaCuentaRepository,
  PrismaConsultaRepository,
  PrismaPacienteRepository,
  PrismaPagoRepository,
  PrismaNotificationRepository
} from '../repositories/index.js';

import type {
  ICuentaRepository,
  IConsultaRepository,
  IPacienteRepository,
  IPagoRepository,
  INotificationRepository
} from '../repositories/index.js';

// Services
import {
  PushNotificationChannel,
  SSENotificationChannel,
  WhatsAppNotificationChannel,
  ToastNotificationChannel
} from '../services/notifications/channels/index.js';

import {
  PaymentGatewayService,
  SubscriptionService,
  PaymentWebhookService,
  PaymentHistoryService
} from '../services/payment/index.js';

// Orchestrators
import { NotificationOrchestrator } from '../services/notifications/NotificationOrchestrator.js';
import { PaymentOrchestrator } from '../services/payment/PaymentOrchestrator.js';

// Types
import type { DIContainer, DependencyBindings } from './types.js';

/**
 * AwilixManager - Singleton para gestionar el contenedor DI
 */
class AwilixManagerClass {
  private static instance: AwilixManagerClass;
  private container: AwilixContainer;

  private constructor() {
    this.container = createContainer({
      injectionMode: 'PROXY' // Mejora performance y permite circular dependencies
    });

    this.registerBindings();
  }

  /**
   * Obtiene la instancia singleton del manager
   */
  static getInstance(): AwilixManagerClass {
    if (!AwilixManagerClass.instance) {
      AwilixManagerClass.instance = new AwilixManagerClass();
    }
    return AwilixManagerClass.instance;
  }

  /**
   * Obtiene el contenedor configurado
   */
  getContainer(): DIContainer {
    return this.container as DIContainer;
  }

  /**
   * Crea un contenedor scoped para tests o contextos específicos
   */
  createScopedContainer(): DIContainer {
    return createContainer({
      injectionMode: 'PROXY'
    }) as DIContainer;
  }

  /**
   * Registra todas las dependencias del sistema
   */
  private registerBindings(): void {
    const bindings = this.getBindings();

    Object.entries(bindings).forEach(([name, binding]) => {
      switch (binding.lifetime) {
        case 'singleton':
          this.container.register(
            name,
            asFunction(binding.factory).singleton()
          );
          break;
        case 'scoped':
          this.container.register(
            name,
            asFunction(binding.factory).scoped()
          );
          break;
        case 'transient':
        default:
          this.container.register(
            name,
            asFunction(binding.factory).transient()
          );
          break;
      }
    });
  }

  /**
   * Obtiene las configuraciones de dependencias
   */
  private getBindings(): DependencyBindings {
    return {
      // === CLIENTE PRISMA ===
      prisma: {
        factory: () => prisma,
        lifetime: 'singleton' as const
      },

      // === REPOSITORIES ===
      cuentaRepository: {
        factory: (c: DIContainer) => new PrismaCuentaRepository(c.prisma),
        lifetime: 'singleton' as const
      },
      consultaRepository: {
        factory: (c: DIContainer) => new PrismaConsultaRepository(c.prisma),
        lifetime: 'singleton' as const
      },
      pacienteRepository: {
        factory: (c: DIContainer) => new PrismaPacienteRepository(c.prisma),
        lifetime: 'singleton' as const
      },
      pagoRepository: {
        factory: (c: DIContainer) => new PrismaPagoRepository(c.prisma),
        lifetime: 'singleton' as const
      },
      notificationRepository: {
        factory: (c: DIContainer) => new PrismaNotificationRepository(c.prisma),
        lifetime: 'singleton' as const
      },

      // === NOTIFICATION CHANNELS ===
      pushNotificationChannel: {
        factory: (c: DIContainer) => new PushNotificationChannel(c.prisma),
        lifetime: 'transient' as const
      },
      sseNotificationChannel: {
        factory: () => new SSENotificationChannel(),
        lifetime: 'transient' as const
      },
      whatsappNotificationChannel: {
        factory: (c: DIContainer) => new WhatsAppNotificationChannel(
          c.prisma,
          c.notificationRepository
        ),
        lifetime: 'transient' as const
      },
      toastNotificationChannel: {
        factory: () => new ToastNotificationChannel(),
        lifetime: 'transient' as const
      },

      // === PAYMENT SERVICES ===
      paymentGatewayService: {
        factory: () => new PaymentGatewayService(),
        lifetime: 'singleton' as const
      },
      subscriptionService: {
        factory: (c: DIContainer) => new SubscriptionService(c.prisma),
        lifetime: 'singleton' as const
      },
      paymentWebhookService: {
        factory: (c: DIContainer) => new PaymentWebhookService(c.prisma),
        lifetime: 'singleton' as const
      },
      paymentHistoryService: {
        factory: (c: DIContainer) => new PaymentHistoryService(
          c.prisma,
          c.pagoRepository
        ),
        lifetime: 'singleton' as const
      },

      // === ORCHESTRATORS ===
      notificationOrchestrator: {
        factory: (c: DIContainer) => new NotificationOrchestrator(
          c.prisma,
          c.notificationRepository
        ),
        lifetime: 'singleton' as const
      },
      paymentOrchestrator: {
        factory: (c: DIContainer) => new PaymentOrchestrator(
          c.prisma,
          c.pagoRepository
        ),
        lifetime: 'singleton' as const
      }
    };
  }

  /**
   * Registra un servicio adicional dinámicamente
   */
  registerService<T>(name: string, registration: (container: DIContainer) => T): void {
    this.container.register(name, asFunction(registration).singleton());
  }

  /**
   * Resetea el contenedor (útil para tests)
   */
  reset(): void {
    this.container = createContainer({
      injectionMode: 'PROXY'
    });
    this.registerBindings();
  }
}

// Exportar la clase
export { AwilixManagerClass };
