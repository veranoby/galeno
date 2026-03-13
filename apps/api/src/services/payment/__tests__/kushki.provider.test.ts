/**
 * Kushki Provider Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KushkiProvider, type CardData } from '../kushki.provider.js';
import { PaymentError, WebhookSignatureError } from '../base.js';

// Mock environment variables
const mockEnv = {
  KUSHKI_PUBLIC_MERCHANT_ID: 'test_public_merchant',
  KUSHKI_PRIVATE_MERCHANT_ID: 'test_private_merchant',
  KUSHKI_WEBHOOK_SECRET: 'test_webhook_secret'
};

describe('KushkiProvider', () => {
  let provider: KushkiProvider;

  beforeEach(() => {
    vi.stubEnv('KUSHKI_PUBLIC_MERCHANT_ID', mockEnv.KUSHKI_PUBLIC_MERCHANT_ID);
    vi.stubEnv('KUSHKI_PRIVATE_MERCHANT_ID', mockEnv.KUSHKI_PRIVATE_MERCHANT_ID);
    vi.stubEnv('KUSHKI_WEBHOOK_SECRET', mockEnv.KUSHKI_WEBHOOK_SECRET);

    provider = new KushkiProvider();
  });

  describe('constructor', () => {
    it('should create provider with default config', () => {
      expect(provider).toBeDefined();
    });

    it('should create provider with custom config', () => {
      const customProvider = new KushkiProvider({
        publicMerchantId: 'custom_public',
        baseUrl: 'https://custom.api.com'
      });
      expect(customProvider).toBeDefined();
    });
  });

  describe('initialize', () => {
    it('should initialize successfully with valid config', async () => {
      await expect(provider.initialize()).resolves.not.toThrow();
    });

    it('should throw error if public merchant ID is missing', async () => {
      vi.stubEnv('KUSHKI_PUBLIC_MERCHANT_ID', '');
      const invalidProvider = new KushkiProvider();
      await expect(invalidProvider.initialize()).rejects.toThrow('KUSHKI_PUBLIC_MERCHANT_ID');
    });

    it('should throw error if private merchant ID is missing', async () => {
      vi.stubEnv('KUSHKI_PRIVATE_MERCHANT_ID', '');
      const invalidProvider = new KushkiProvider();
      await expect(invalidProvider.initialize()).rejects.toThrow('KUSHKI_PRIVATE_MERCHANT_ID');
    });

    it('should throw error if webhook secret is missing', async () => {
      vi.stubEnv('KUSHKI_WEBHOOK_SECRET', '');
      const invalidProvider = new KushkiProvider();
      await expect(invalidProvider.initialize()).rejects.toThrow('KUSHKI_WEBHOOK_SECRET');
    });
  });

  describe('createToken', () => {
    it('should tokenize card successfully', async () => {
      const cardData: CardData = {
        cardNumber: '4111111111111111',
        cardHolderName: 'John Doe',
        expiryMonth: '12',
        expiryYear: '25',
        cvv: '123',
        installments: 1
      };

      const mockPost = vi.fn().mockResolvedValue({
        data: {
          token: 'tok_test123456',
          lastFourDigits: '1111',
          brand: 'visa',
          cardType: 'credit'
        }
      });

      provider['client'] = {
        post: mockPost,
        interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } }
      } as any;

      const result = await provider.createToken(cardData);

      expect(mockPost).toHaveBeenCalledWith('/tokenize', expect.objectContaining({
        card: expect.objectContaining({
          cardHolderName: cardData.cardHolderName,
          expiryMonth: cardData.expiryMonth,
          expiryYear: cardData.expiryYear
        })
      }));

      expect(result).toEqual({
        token: 'tok_test123456',
        lastFourDigits: '1111',
        brand: 'visa',
        cardType: 'credit'
      });
    });

    it('should throw PaymentError on tokenization error', async () => {
      const cardData: CardData = {
        cardNumber: '4111111111111111',
        cardHolderName: 'John Doe',
        expiryMonth: '12',
        expiryYear: '25',
        cvv: '123'
      };

      const mockPost = vi.fn().mockRejectedValue({
        response: {
          data: { message: 'Invalid card number', code: 'INVALID_CARD' }
        }
      });

      provider['client'] = {
        post: mockPost,
        interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } }
      } as any;

      await expect(provider.createToken(cardData)).rejects.toThrow(PaymentError);
    });
  });

  describe('createPayment', () => {
    it('should create payment with token', async () => {
      const request = {
        amount: 1000,
        currency: 'USD' as const,
        customerId: 'test_customer',
        description: 'Test payment',
        metadata: {
          token: 'tok_test123'
        }
      };

      const mockPost = vi.fn().mockResolvedValue({
        data: {
          transactionId: 'test_transaction',
          status: 'APPROVED'
        }
      });

      provider['client'] = {
        post: mockPost,
        interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } }
      } as any;

      const result = await provider.createPayment(request);

      expect(mockPost).toHaveBeenCalledWith('/charge', expect.objectContaining({
        token: 'tok_test123',
        amount: request.amount,
        currency: request.currency,
        externalId: expect.stringContaining('idem_')
      }));

      expect(result).toEqual({
        transactionId: 'test_transaction',
        status: 'approved'
      });
    });

    it('should throw error if token is missing', async () => {
      const request = {
        amount: 1000,
        currency: 'USD' as const,
        customerId: 'test_customer',
        description: 'Test payment'
      };

      await expect(provider.createPayment(request)).rejects.toThrow('Card token is required');
    });

    it('should calculate splits correctly', async () => {
      const request = {
        amount: 1000,
        currency: 'USD' as const,
        customerId: 'test_customer',
        description: 'Test payment',
        metadata: { token: 'tok_test' },
        splits: [
          { recipientAccountId: 'galeno', amount: 0, percentage: 15 },
          { recipientAccountId: 'doctor', amount: 0, percentage: 85 }
        ]
      };

      const mockPost = vi.fn().mockResolvedValue({
        data: { transactionId: 'test_id', status: 'APPROVED' }
      });

      provider['client'] = {
        post: mockPost,
        interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } }
      } as any;

      await provider.createPayment(request);

      expect(mockPost).toHaveBeenCalledWith('/charge', expect.objectContaining({
        metadata: expect.objectContaining({
          splits: expect.arrayContaining([
            expect.objectContaining({ percentage: 15, amount: 150 }),
            expect.objectContaining({ percentage: 85, amount: 850 })
          ])
        })
      }));
    });
  });

  describe('verifyPayment', () => {
    it('should verify payment status', async () => {
      const mockGet = vi.fn().mockResolvedValue({
        data: {
          id: 'test_id',
          status: 'APPROVED',
          amount: 1000,
          approvedAt: '2024-01-01T00:00:00Z',
          authorizationCode: 'AUTH123',
          lastFourDigits: '1111'
        }
      });

      provider['client'] = {
        get: mockGet,
        interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } }
      } as any;

      const result = await provider.verifyPayment('test_id');

      expect(mockGet).toHaveBeenCalledWith('/transactions/test_id');
      expect(result).toEqual({
        transactionId: 'test_id',
        status: 'approved',
        amount: 1000,
        approvedAt: expect.any(Date),
        metadata: expect.objectContaining({
          authorizationCode: 'AUTH123',
          lastFourDigits: '1111'
        })
      });
    });
  });

  describe('handleWebhook', () => {
    it('should reject webhook without signature', async () => {
      const payload = { transactionId: 'test_id', status: 'APPROVED' };

      const result = await provider.handleWebhook(payload);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining('signature')
      });
    });

    it('should reject webhook with invalid signature', async () => {
      const payload = { transactionId: 'test_id', status: 'APPROVED' };
      const invalidSignature = 'invalid_signature';

      const result = await provider.handleWebhook(payload, invalidSignature);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining('Invalid signature')
      });
    });

    it('should process valid webhook', async () => {
      const payload = {
        transactionId: 'test_id',
        event: 'transaction.approved',
        status: 'APPROVED',
        amount: 1000
      };

      // Create valid signature
      const crypto = await import('crypto');
      const signature = crypto
        .createHmac('sha256', mockEnv.KUSHKI_WEBHOOK_SECRET)
        .update(JSON.stringify(payload))
        .digest('hex');

      const result = await provider.handleWebhook(payload, signature);

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('test_id');
    });

    it('should handle webhook with 0x prefix in signature', async () => {
      const payload = {
        transactionId: 'test_id',
        status: 'APPROVED',
        amount: 1000
      };

      const crypto = await import('crypto');
      const signature = '0x' + crypto
        .createHmac('sha256', mockEnv.KUSHKI_WEBHOOK_SECRET)
        .update(JSON.stringify(payload))
        .digest('hex');

      const result = await provider.handleWebhook(payload, signature);

      expect(result.success).toBe(true);
    });

    it('should handle webhook with uppercase signature', async () => {
      const payload = {
        transactionId: 'test_id',
        status: 'APPROVED',
        amount: 1000
      };

      const crypto = await import('crypto');
      const signature = crypto
        .createHmac('sha256', mockEnv.KUSHKI_WEBHOOK_SECRET)
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

  describe('mapStatus', () => {
    it('should map Kushki status to internal status', () => {
      expect(provider['mapStatus']('PENDING')).toBe('pending');
      expect(provider['mapStatus']('APPROVED')).toBe('approved');
      expect(provider['mapStatus']('DECLINED')).toBe('rejected');
      expect(provider['mapStatus']('REFUNDED')).toBe('refunded');
      expect(provider['mapStatus']('CANCELLED')).toBe('cancelled');
      expect(provider['mapStatus']('UNKNOWN')).toBe('pending');
    });
  });
});
