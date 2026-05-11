/**
 * Payment Validation Middleware Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import {
  validateHmacSignature,
  checkPaymentIdempotency,
  validatePaymentData,
  HmacValidationError,
  IdempotencyError,
  paymentValidationErrorHandler
} from '../../middleware/payment-validation.js';
import crypto from 'crypto';

// Mock prisma for idempotency check
vi.mock('../../config/database.js', () => ({
  default: {
    pago: {
      findUnique: vi.fn()
    }
  }
}));

describe('Payment Validation Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      headers: {},
      body: {},
      path: '/test'
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    mockNext = vi.fn();
  });

  describe('validateHmacSignature', () => {
    const secretKey = 'test-secret-key-123';
    const signatureHeader = 'x-test-signature';

    it('should reject request without signature header', async () => {
      const middleware = validateHmacSignature({
        secretKey,
        signatureHeader
      });

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'MISSING_SIGNATURE'
        })
      );
    });

    it('should reject request with invalid signature', async () => {
      const payload = { test: 'data' };
      const invalidSignature = 'invalid-signature';

      mockReq.body = payload;
      mockReq.headers[signatureHeader.toLowerCase()] = invalidSignature;

      const middleware = validateHmacSignature({
        secretKey,
        signatureHeader
      });

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'INVALID_SIGNATURE'
        })
      );
    });

    it('should accept request with valid signature', async () => {
      const payload = { test: 'data' };
      const payloadString = JSON.stringify(payload);
      const validSignature = crypto
        .createHmac('sha256', secretKey)
        .update(payloadString)
        .digest('hex');

      mockReq.body = payload;
      mockReq.headers[signatureHeader.toLowerCase()] = validSignature;

      const middleware = validateHmacSignature({
        secretKey,
        signatureHeader
      });

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should handle signature with 0x prefix', async () => {
      const payload = { test: 'data' };
      const payloadString = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha256', secretKey)
        .update(payloadString)
        .digest('hex');
      const signatureWithPrefix = '0x' + signature;

      mockReq.body = payload;
      mockReq.headers[signatureHeader.toLowerCase()] = signatureWithPrefix;

      const middleware = validateHmacSignature({
        secretKey,
        signatureHeader
      });

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should handle uppercase signature', async () => {
      const payload = { test: 'data' };
      const payloadString = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha256', secretKey)
        .update(payloadString)
        .digest('hex');
      const uppercaseSignature = signature.toUpperCase();

      mockReq.body = payload;
      mockReq.headers[signatureHeader.toLowerCase()] = uppercaseSignature;

      const middleware = validateHmacSignature({
        secretKey,
        signatureHeader
      });

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject if secret key is not configured', async () => {
      mockReq.headers[signatureHeader.toLowerCase()] = 'some-signature';

      const middleware = validateHmacSignature({
        secretKey: '',
        signatureHeader
      });

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'SERVER_MISCONFIGURATION'
        })
      );
    });

    it('should use sha512 algorithm when specified', async () => {
      const payload = { test: 'data' };
      const payloadString = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha512', secretKey)
        .update(payloadString)
        .digest('hex');

      mockReq.body = payload;
      mockReq.headers[signatureHeader.toLowerCase()] = signature;

      const middleware = validateHmacSignature({
        secretKey,
        signatureHeader,
        algorithm: 'sha512'
      });

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('checkPaymentIdempotency', () => {
    it('should call next() if no idempotency key provided', async () => {
      await checkPaymentIdempotency()(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should return existing payment if idempotency key exists', async () => {
      const { default: prisma } = await import('../../config/database.js');
      vi.mocked(prisma.pago.findUnique).mockResolvedValue({
        id: 'pago-123',
        transactionId: 'tx-456',
        status: 'PENDING',
        amount: 1000 as any, // Decimal type mock
        gateway: 'payphone'
      } as any);

      mockReq.headers['idempotency-key'] = 'idem-existing-key';

      await checkPaymentIdempotency()(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          idempotent: true,
          data: expect.objectContaining({
            pagoId: 'pago-123',
            transactionId: 'tx-456'
          })
        })
      );
    });

    it('should call next() if idempotency key is new', async () => {
      const { default: prisma } = await import('../../config/database.js');
      vi.mocked(prisma.pago.findUnique).mockResolvedValue(null);

      mockReq.headers['idempotency-key'] = 'idem-new-key';

      await checkPaymentIdempotency()(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect((mockReq as any).idempotencyKey).toBe('idem-new-key');
    });
  });

  describe('validatePaymentData', () => {
    it('should reject request with invalid amount', async () => {
      mockReq.body = {
        amount: -100,
        currency: 'USD',
        description: 'Test payment'
      };

      await validatePaymentData()(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid amount'
        })
      );
    });

    it('should reject request with missing amount', async () => {
      mockReq.body = {
        currency: 'USD',
        description: 'Test payment'
      };

      await validatePaymentData()(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid amount'
        })
      );
    });

    it('should reject request with unsupported currency', async () => {
      mockReq.body = {
        amount: 1000,
        currency: 'EUR',
        description: 'Test payment'
      };

      await validatePaymentData()(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid currency'
        })
      );
    });

    it('should reject request with missing description', async () => {
      mockReq.body = {
        amount: 1000,
        currency: 'USD'
      };

      await validatePaymentData()(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid description'
        })
      );
    });

    it('should reject request with description too long', async () => {
      mockReq.body = {
        amount: 1000,
        currency: 'USD',
        description: 'a'.repeat(256)
      };

      await validatePaymentData()(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid description'
        })
      );
    });

    it('should reject request with invalid metadata type', async () => {
      mockReq.body = {
        amount: 1000,
        currency: 'USD',
        description: 'Test payment',
        metadata: 'invalid-string-metadata'
      };

      await validatePaymentData()(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid metadata'
        })
      );
    });

    it('should accept valid payment data', async () => {
      mockReq.body = {
        amount: 1000,
        currency: 'USD',
        description: 'Test payment',
        metadata: { orderId: 'order-123' }
      };

      await validatePaymentData()(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should accept payment data without currency (defaults to USD)', async () => {
      mockReq.body = {
        amount: 1000,
        description: 'Test payment'
      };

      await validatePaymentData()(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('paymentValidationErrorHandler', () => {
    it('should handle HmacValidationError', () => {
      const error = new HmacValidationError('Invalid signature', 'INVALID_SIGNATURE', 401);
      const send = vi.fn();

      paymentValidationErrorHandler(
        error,
        mockReq as Request,
        { ...mockRes, send } as Response,
        mockNext
      );

      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'INVALID_SIGNATURE'
        })
      );
    });

    it('should handle IdempotencyError', () => {
      const error = new IdempotencyError('Duplicate payment', 'tx-existing');
      const send = vi.fn();

      paymentValidationErrorHandler(
        error,
        mockReq as Request,
        { ...mockRes, send } as Response,
        mockNext
      );

      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'DUPLICATE_PAYMENT',
          existingTransactionId: 'tx-existing'
        })
      );
    });

    it('should pass other errors to next()', () => {
      const error = new Error('Some other error');

      paymentValidationErrorHandler(
        error,
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});
