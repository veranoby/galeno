// apps/api/src/di/__tests__/di-container.test.ts
/**
 * Tests para el contenedor DI
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getDIContainer, createScopedContainer, registerService } from '../../di-container';
import { resetDIContainer } from '../../test-utils/di-helpers';

// Mock de Prisma
vi.mock('../../config/database.js', () => ({
  default: {}
}));

// Mock de repositorios
vi.mock('../../repositories', () => ({
  PrismaCuentaRepository: vi.fn(),
  PrismaConsultaRepository: vi.fn(),
  PrismaPacienteRepository: vi.fn(),
  PrismaPagoRepository: vi.fn(),
  PrismaNotificationRepository: vi.fn()
}));

// Mock de canales
vi.mock('../../services/notifications/channels/PushNotificationChannel.js', () => ({
  PushNotificationChannel: vi.fn()
}));

vi.mock('../../services/notifications/channels/SSENotificationChannel.js', () => ({
  SSENotificationChannel: vi.fn()
}));

vi.mock('../../services/notifications/channels/WhatsAppNotificationChannel.ts', () => ({
  WhatsAppNotificationChannel: vi.fn()
}));

vi.mock('../../services/notifications/channels/ToastNotificationChannel.ts', () => ({
  ToastNotificationChannel: vi.fn()
}));

// Mock de servicios de pago
vi.mock('../../services/payment/gateways/PaymentGatewayService.ts', () => ({
  PaymentGatewayService: vi.fn()
}));

vi.mock('../../services/payment/gateways/SubscriptionService.ts', () => ({
  SubscriptionService: vi.fn()
}));

vi.mock('../../services/payment/handlers/PaymentWebhookService.ts', () => ({
  PaymentWebhookService: vi.fn()
}));

vi.mock('../../services/payment/handlers/PaymentHistoryService.ts', () => ({
  PaymentHistoryService: vi.fn()
}));

// Mock de orquestadores
vi.mock('../../services/notifications/NotificationOrchestrator.ts', () => ({
  NotificationOrchestrator: vi.fn()
}));

vi.mock('../../services/payment/PaymentOrchestrator.ts', () => ({
  PaymentOrchestrator: vi.fn()
}));

describe('DI Container', () => {
  beforeEach(() => {
    // Resetear el singleton antes de cada test (usando helper)
    resetDIContainer();
  });

  afterEach(() => {
    // Limpiar después de los tests
    resetDIContainer();
  });

  describe('getDIContainer', () => {
    it('should return a container with all dependencies', () => {
      const container = getDIContainer();

      expect(container).toBeDefined();
      expect(container.prisma).toBeDefined();
    });

    it('should return same container on subsequent calls', () => {
      const container1 = getDIContainer();
      const container2 = getDIContainer();

      expect(container1).toBe(container2);
    });

    it('should have all repositories registered', () => {
      const container = getDIContainer();

      expect(container.cuentaRepository).toBeDefined();
      expect(container.consultaRepository).toBeDefined();
      expect(container.pacienteRepository).toBeDefined();
      expect(container.pagoRepository).toBeDefined();
      expect(container.notificationRepository).toBeDefined();
    });

    it('should have all notification channels registered', () => {
      const container = getDIContainer();

      expect(container.pushNotificationChannel).toBeDefined();
      expect(container.sseNotificationChannel).toBeDefined();
      expect(container.whatsappNotificationChannel).toBeDefined();
      expect(container.toastNotificationChannel).toBeDefined();
    });

    it('should have all payment services registered', () => {
      const container = getDIContainer();

      expect(container.paymentGatewayService).toBeDefined();
      expect(container.subscriptionService).toBeDefined();
      expect(container.paymentWebhookService).toBeDefined();
      expect(container.paymentHistoryService).toBeDefined();
    });

    it('should have all orchestrators registered', () => {
      const container = getDIContainer();

      expect(container.notificationOrchestrator).toBeDefined();
      expect(container.paymentOrchestrator).toBeDefined();
    });
  });

  describe('createScopedContainer', () => {
    it('should create a new scoped container', () => {
      const scoped = createScopedContainer();

      expect(scoped).toBeDefined();
      expect(typeof scoped.register).toBe('function');
      expect(typeof scoped.resolve).toBe('function');
    });

    it('should create different instance each time', () => {
      const scoped1 = createScopedContainer();
      const scoped2 = createScopedContainer();

      expect(scoped1).not.toBe(scoped2);
    });

    it('should not affect main container', () => {
      const main = getDIContainer();
      const scoped = createScopedContainer();

      // El scoped no afecta al main
      expect(main).toBeDefined();
      expect(scoped).toBeDefined();
      expect(scoped).not.toBe(main);
    });
  });

  describe('registerService', () => {
    it('should register a new service dynamically', () => {
      const mockService = { test: () => true };

      registerService('testService', () => mockService);

      const container = getDIContainer();
      const resolved = container.resolve('testService') as { test: () => boolean };

      expect(resolved).toBeDefined();
    });
  });

  describe('dependency resolution', () => {
    it('should resolve repositories correctly', () => {
      const container = getDIContainer();

      const cuentaRepo = container.cuentaRepository;
      const notificationRepo = container.notificationRepository;

      expect(cuentaRepo).toBeDefined();
      expect(notificationRepo).toBeDefined();
    });

    it('should resolve services with their dependencies', () => {
      const container = getDIContainer();

      const notificationOrchestrator = container.notificationOrchestrator;
      const paymentOrchestrator = container.paymentOrchestrator;

      expect(notificationOrchestrator).toBeDefined();
      expect(paymentOrchestrator).toBeDefined();
    });
  });
});
