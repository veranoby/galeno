// apps/api/src/services/payment/gateways/__tests__/PaymentGatewayService.test.ts
/**
 * Tests para PaymentGatewayService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PaymentGatewayService } from '../PaymentGatewayService.js';

describe('PaymentGatewayService', () => {
  let service: PaymentGatewayService;

  beforeEach(() => {
    service = new PaymentGatewayService();
    // Mock environment variables
    process.env.PAYPHONE_API_KEY = 'test_key';
    process.env.KUSHKI_PUBLIC_MERCHANT_ID = 'test_merchant_id';
  });

  describe('isGatewayAvailable', () => {
    it('should return false before initialization', () => {
      expect(service.isGatewayAvailable('payphone')).toBe(false);
    });

    it('should return true after initialization', async () => {
      await service.initialize();
      expect(service.isGatewayAvailable('payphone')).toBe(true);
    });

    it('should return false for non-existent gateway', async () => {
      await service.initialize();
      expect(service.isGatewayAvailable('stripe')).toBe(false);
    });
  });

  describe('initialize', () => {
    it('should be idempotent', async () => {
      await service.initialize();
      await service.initialize();

      // La segunda inicialización no debería hacer nada
      expect(service.isGatewayAvailable('payphone')).toBe(true);
    });
  });

  describe('getGateway', () => {
    it('should throw error for non-configured gateway', async () => {
      await expect(service.getGateway('nonexistent')).rejects.toThrow();
    });

    it('should return gateway instance for configured provider', async () => {
      await service.initialize();
      const gateway = await service.getGateway('payphone');
      expect(gateway).toBeDefined();
    });
  });
});
