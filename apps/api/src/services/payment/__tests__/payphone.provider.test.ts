/**
 * Payphone Provider Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PayphoneProvider } from '../payphone.provider.js';
import { PaymentError, WebhookSignatureError } from '../base.js';

// Mock environment variables
const mockEnv = {
  PAYPHONE_API_KEY: 'test_api_key',
  PAYPHONE_SECRET_KEY: 'test_secret_key',
  PAYPHONE_WEBHOOK_SECRET: 'test_webhook_secret'
};

describe('PayphoneProvider', () => {
  let provider: PayphoneProvider;

  beforeEach(() => {
    vi.stubEnv('PAYPHONE_API_KEY', mockEnv.PAYPHONE_API_KEY);
    vi.stubEnv('PAYPHONE_SECRET_KEY', mockEnv.PAYPHONE_SECRET_KEY);
    vi.stubEnv('PAYPHONE_WEBHOOK_SECRET', mockEnv.PAYPHONE_WEBHOOK_SECRET);

    provider = new PayphoneProvider();
  });

  describe('constructor', () => {
    it('should create provider with default config', () => {
      expect(provider).toBeDefined();
    });

    it('should create provider with custom config', () => {
      const customProvider = new PayphoneProvider({
        apiKey: 'custom_key',
        baseUrl: 'https://custom.api.com'
      });
      expect(customProvider).toBeDefined();
    });
  });

  describe('initialize', () => {
    it('should initialize successfully with valid config', async () => {
      await expect(provider.initialize()).resolves.not.toThrow();
    });

    it('should throw error if API key is missing', async () => {
      vi.stubEnv('PAYPHONE_API_KEY', '');
      const invalidProvider = new PayphoneProvider();
      await expect(invalidProvider.initialize()).rejects.toThrow('PAYPHONE_API_KEY');
    });

    it('should throw error if secret key is missing', async () => {
      vi.stubEnv('PAYPHONE_SECRET_KEY', '');
      const invalidProvider = new PayphoneProvider();
      await expect(invalidProvider.initialize()).rejects.toThrow('PAYPHONE_SECRET_KEY');
    });

    it('should throw error if webhook secret is missing', async () => {
      vi.stubEnv('PAYPHONE_WEBHOOK_SECRET', '');
      const invalidProvider = new PayphoneProvider();
      await expect(invalidProvider.initialize()).rejects.toThrow('PAYPHONE_WEBHOOK_SECRET');
    });
  });

  describe('createPayment', () => {
    it('should create payment request with correct structure', async () => {
      const request = {
        amount: 1000,
        currency: 'USD' as const,
        customerId: 'test_customer',
        description: 'Test payment'
      };

      // Mock axios post
      const mockPost = vi.fn().mockResolvedValue({
        data: {
          id: 'test_transaction_id',
          link: 'https://payphone.link/test'
        }
      });

      provider['client'] = {
        post: mockPost,
        interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } }
      } as any;

      const result = await provider.createPayment(request);

      expect(mockPost).toHaveBeenCalledWith('/payment_links', expect.objectContaining({
        external_id: expect.stringContaining('idem_'),
        phone_number: request.customerId,
        value: request.amount,
        currency: request.currency,
        description: request.description
      }));

      expect(result).toEqual({
        transactionId: 'test_transaction_id',
        status: 'pending',
        qrCode: expect.any(String),
        hostedUrl: 'https://payphone.link/test'
      });
    });

    it('should calculate splits correctly', async () => {
      const request = {
        amount: 1000,
        currency: 'USD' as const,
        customerId: 'test_customer',
        description: 'Test payment',
        splits: [
          { recipientAccountId: 'galeno', amount: 0, percentage: 15 },
          { recipientAccountId: 'doctor', amount: 0, percentage: 85 }
        ]
      };

      const mockPost = vi.fn().mockResolvedValue({
        data: { id: 'test_id', link: 'https://test.link' }
      });

      provider['client'] = {
        post: mockPost,
        interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } }
      } as any;

      await provider.createPayment(request);

      expect(mockPost).toHaveBeenCalledWith('/payment_links', expect.objectContaining({
        metadata: expect.objectContaining({
          splits: expect.arrayContaining([
            expect.objectContaining({ percentage: 15, amount: 150 }),
            expect.objectContaining({ percentage: 85, amount: 850 })
          ])
        })
      }));
    });

    it('should throw PaymentError on API error', async () => {
      const request = {
        amount: 1000,
        currency: 'USD' as const,
        customerId: 'test_customer',
        description: 'Test payment'
      };

      const mockPost = vi.fn().mockRejectedValue({
        response: {
          data: { message: 'Invalid phone number', code: 'INVALID_PHONE' }
        }
      });

      provider['client'] = {
        post: mockPost,
        interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } }
      } as any;

      await expect(provider.createPayment(request)).rejects.toThrow(PaymentError);
    });
  });

  describe('verifyPayment', () => {
    it('should verify payment status', async () => {
      const mockGet = vi.fn().mockResolvedValue({
        data: {
          id: 'test_id',
          status: 'APPROVED',
          value: 1000,
          updatedAt: '2024-01-01T00:00:00Z'
        }
      });

      provider['client'] = {
        get: mockGet,
        interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } }
      } as any;

      const result = await provider.verifyPayment('test_id');

      expect(mockGet).toHaveBeenCalledWith('/payment_links/test_id');
      expect(result).toEqual({
        transactionId: 'test_id',
        status: 'approved',
        amount: 1000,
        approvedAt: expect.any(Date),
        metadata: expect.any(Object)
      });
    });
  });

  describe('handleWebhook', () => {
    it('should reject webhook without signature', async () => {
      const payload = { id: 'test_id', status: 'APPROVED' };

      const result = await provider.handleWebhook(payload);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining('signature')
      });
    });

    it('should reject webhook with invalid signature', async () => {
      const payload = { id: 'test_id', status: 'APPROVED' };
      const invalidSignature = 'invalid_signature';

      const result = await provider.handleWebhook(payload, invalidSignature);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining('Invalid signature')
      });
    });

    it('should process valid webhook', async () => {
      const payload = {
        id: 'test_id',
        externalId: 'external_123',
        status: 'APPROVED',
        value: 1000,
        currency: 'USD'
      };

      // Create valid signature
      const crypto = await import('crypto');
      const signature = crypto
        .createHmac('sha256', mockEnv.PAYPHONE_WEBHOOK_SECRET)
        .update(JSON.stringify(payload))
        .digest('hex');

      const result = await provider.handleWebhook(payload, signature);

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('test_id');
    });

    it('should handle webhook with 0x prefix in signature', async () => {
      const payload = {
        id: 'test_id',
        status: 'APPROVED',
        value: 1000
      };

      const crypto = await import('crypto');
      const signature = '0x' + crypto
        .createHmac('sha256', mockEnv.PAYPHONE_WEBHOOK_SECRET)
        .update(JSON.stringify(payload))
        .digest('hex');

      const result = await provider.handleWebhook(payload, signature);

      expect(result.success).toBe(true);
    });

    it('should handle webhook with uppercase signature', async () => {
      const payload = {
        id: 'test_id',
        status: 'APPROVED',
        value: 1000
      };

      const crypto = await import('crypto');
      const signature = crypto
        .createHmac('sha256', mockEnv.PAYPHONE_WEBHOOK_SECRET)
        .update(JSON.stringify(payload))
        .digest('hex')
        .toUpperCase();

      const result = await provider.handleWebhook(payload, signature);

      expect(result.success).toBe(true);
    });
  });

  describe('refund', () => {
    it('should process refund', async () => {
      const mockVerify = vi.fn().mockResolvedValue({
        status: 'approved',
        amount: 1000
      });

      const mockPost = vi.fn().mockResolvedValue({
        data: { id: 'refund_id', status: 'approved' }
      });

      provider['verifyPayment'] = mockVerify;
      provider['client'] = {
        post: mockPost,
        interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } }
      } as any;

      const result = await provider.refund({
        transactionId: 'test_id',
        amount: 500,
        reason: 'Customer request'
      });

      expect(result).toEqual({
        refundId: 'refund_id',
        status: 'approved',
        amount: 500
      });
    });

    it('should reject refund for non-approved payment', async () => {
      const mockVerify = vi.fn().mockResolvedValue({
        status: 'pending'
      });

      provider['verifyPayment'] = mockVerify;

      await expect(provider.refund({
        transactionId: 'test_id'
      })).rejects.toThrow('Cannot refund a non-approved payment');
    });
  });

  describe('calculateSplits', () => {
    it('should calculate splits correctly', () => {
      const splits = provider['calculateSplits'](1000, [
        { recipientAccountId: 'galeno', amount: 0, percentage: 15 },
        { recipientAccountId: 'doctor', amount: 0, percentage: 85 }
      ]);

      expect(splits).toEqual([
        { recipientAccountId: 'galeno', amount: 150, percentage: 15 },
        { recipientAccountId: 'doctor', amount: 850, percentage: 85 }
      ]);
    });

    it('should throw error if percentages do not sum to 100', () => {
      expect(() => {
        provider['calculateSplits'](1000, [
          { recipientAccountId: 'galeno', amount: 0, percentage: 10 },
          { recipientAccountId: 'doctor', amount: 0, percentage: 85 }
        ]);
      }).toThrow('must sum to 100%');
    });
  });
});
