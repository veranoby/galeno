// apps/api/src/di/__tests__/awilix-manager.test.ts
/**
 * Tests para AwilixManager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AwilixManagerClass } from '../awilix-manager.js';
import type { DIContainer } from '../types.js';
import { resetDIContainer } from '../../test-utils/di-helpers.js';

// Mock de Prisma
vi.mock('../../config/database.js', () => ({
  default: {}
}));

// Mock de los canales
vi.mock('../../services/notifications/channels/PushNotificationChannel.js', () => ({
  PushNotificationChannel: vi.fn()
}));

vi.mock('../../services/notifications/channels/SSENotificationChannel.js', () => ({
  SSENotificationChannel: vi.fn()
}));

vi.mock('../../services/notifications/channels/WhatsAppNotificationChannel.js', () => ({
  WhatsAppNotificationChannel: vi.fn()
}));

vi.mock('../../services/notifications/channels/ToastNotificationChannel.js', () => ({
  ToastNotificationChannel: vi.fn()
}));

// Mock de los servicios de pago
vi.mock('../../services/payment/gateways/PaymentGatewayService.js', () => ({
  PaymentGatewayService: vi.fn()
}));

vi.mock('../../services/payment/gateways/SubscriptionService.js', () => ({
  SubscriptionService: vi.fn()
}));

vi.mock('../../services/payment/handlers/PaymentWebhookService.js', () => ({
  PaymentWebhookService: vi.fn()
}));

vi.mock('../../services/payment/handlers/PaymentHistoryService.js', () => ({
  PaymentHistoryService: vi.fn()
}));

// Mock de los orquestadores
vi.mock('../../services/notifications/NotificationOrchestrator.js', () => ({
  NotificationOrchestrator: vi.fn()
}));

vi.mock('../../services/payment/PaymentOrchestrator.js', () => ({
  PaymentOrchestrator: vi.fn()
}));

describe('AwilixManager', () => {
  let manager: AwilixManagerClass;

  beforeEach(() => {
    // Resetear el singleton antes de cada test (usando helper)
    resetDIContainer();
    manager = AwilixManagerClass.getInstance();
  });

  afterEach(() => {
    // Limpiar después de los tests
    resetDIContainer();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = AwilixManagerClass.getInstance();
      const instance2 = AwilixManagerClass.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('getContainer', () => {
    it('should return Awilix container', () => {
      const container = manager.getContainer();

      expect(container).toBeDefined();
      expect(typeof container.register).toBe('function');
      expect(typeof container.resolve).toBe('function');
    });

    it('should have prisma registered', () => {
      const container = manager.getContainer();

      expect(container.prisma).toBeDefined();
    });

    it('should have repositories registered', () => {
      const container = manager.getContainer();

      expect(container.cuentaRepository).toBeDefined();
      expect(container.consultaRepository).toBeDefined();
      expect(container.pacienteRepository).toBeDefined();
      expect(container.pagoRepository).toBeDefined();
      expect(container.notificationRepository).toBeDefined();
    });

    it('should have notification channels registered', () => {
      const container = manager.getContainer();

      expect(container.pushNotificationChannel).toBeDefined();
      expect(container.sseNotificationChannel).toBeDefined();
      expect(container.whatsappNotificationChannel).toBeDefined();
      expect(container.toastNotificationChannel).toBeDefined();
    });

    it('should have payment services registered', () => {
      const container = manager.getContainer();

      expect(container.paymentGatewayService).toBeDefined();
      expect(container.subscriptionService).toBeDefined();
      expect(container.paymentWebhookService).toBeDefined();
      expect(container.paymentHistoryService).toBeDefined();
    });

    it('should have orchestrators registered', () => {
      const container = manager.getContainer();

      expect(container.notificationOrchestrator).toBeDefined();
      expect(container.paymentOrchestrator).toBeDefined();
    });
  });

  describe('createScopedContainer', () => {
    it('should create a new scoped container', () => {
      const scoped = manager.createScopedContainer();

      expect(scoped).toBeDefined();
      expect(scoped).not.toBe(manager.getContainer());
    });
  });

  describe('registerService', () => {
    it('should register a new service dynamically', () => {
      const mockFactory = vi.fn().mockReturnValue({ test: true });

      manager.registerService('testService', mockFactory);

      const container = manager.getContainer();
      const service = container.resolve('testService') as { test: boolean };
      expect(service).toBeDefined();
      expect(service.test).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset the container', () => {
      const container1 = manager.getContainer();

      manager.reset();
      const container2 = manager.getContainer();

      // Debería ser un nuevo contenedor pero con las mismas dependencias
      expect(container2).toBeDefined();
      expect(container2).not.toBe(container1);
    });
  });
});
