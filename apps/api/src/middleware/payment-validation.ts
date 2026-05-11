/**
 * Payment Validation Middleware
 *
 * Middleware para validación de webhooks (HMAC signature)
 * y verificación de idempotencia en pagos.
 *
 * @module middleware
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';

/**
 * Configuración de validación HMAC
 */
interface HmacValidationConfig {
  /** Secret key para verificación HMAC */
  secretKey: string;
  /** Header donde viene la firma */
  signatureHeader: string;
  /** Algoritmo hash (default: sha256) */
  algorithm?: 'sha256' | 'sha512';
  /** Formato de la firma (default: hex) */
  signatureFormat?: 'hex' | 'base64';
}

/**
 * Error de validación de firma HMAC
 */
export class HmacValidationError extends Error {
  public code: string;
  public statusCode: number;

  constructor(message: string, code = 'INVALID_SIGNATURE', statusCode = 401) {
    super(message);
    this.name = 'HmacValidationError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Error de idempotencia (pago duplicado)
 */
export class IdempotencyError extends Error {
  public code: string;
  public existingTransactionId?: string;

  constructor(message: string, existingTransactionId?: string) {
    super(message);
    this.name = 'IdempotencyError';
    this.code = 'DUPLICATE_PAYMENT';
    this.existingTransactionId = existingTransactionId;
  }
}

/**
 * Middleware para validar firma HMAC en webhooks
 *
 * @param config - Configuración de validación
 * @returns Middleware function
 *
 * @example
 * // Payphone webhook validation
 * app.post('/webhook/payphone',
 *   validateHmacSignature({
 *     secretKey: process.env.PAYPHONE_WEBHOOK_SECRET!,
 *     signatureHeader: 'x-payphone-signature'
 *   }),
 *   handleWebhook
 * );
 *
 * @example
 * // Kushki webhook validation
 * app.post('/webhook/kushki',
 *   validateHmacSignature({
 *     secretKey: process.env.KUSHKI_WEBHOOK_SECRET!,
 *     signatureHeader: 'kushki-signature'
 *   }),
 *   handleWebhook
 * );
 */
export function validateHmacSignature(config: HmacValidationConfig) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const signature = req.headers[config.signatureHeader.toLowerCase()] as string | undefined;

      // 1. Verificar que existe la firma
      if (!signature) {
        logger.warn({
          event: 'hmac_validation_missing_signature',
          signatureHeader: config.signatureHeader,
          path: req.path
        });
        throw new HmacValidationError(
          `Missing signature header: ${config.signatureHeader}`,
          'MISSING_SIGNATURE',
          400
        );
      }

      // 2. Verificar que existe el secret key
      if (!config.secretKey) {
        logger.error({
          event: 'hmac_validation_misconfiguration',
          message: 'Secret key is not configured'
        });
        throw new HmacValidationError(
          'Server misconfiguration: missing secret key',
          'SERVER_MISCONFIGURATION',
          500
        );
      }

      // 3. Obtener body raw para validación
      // Nota: El body debe estar disponible como string o buffer
      let rawBody: string;

      if (Buffer.isBuffer(req.body)) {
        rawBody = req.body.toString('utf8');
      } else if (typeof req.body === 'string') {
        rawBody = req.body;
      } else if ('rawBody' in req && req.rawBody) {
        // Algunos middlewares guardan el body raw en req.rawBody
        rawBody = (req as any).rawBody;
      } else {
        // Fallback: serializar el body (menos seguro pero funcional)
        rawBody = JSON.stringify(req.body);
      }

      // 4. Calcular firma esperada
      const algorithm = config.algorithm || 'sha256';
      const expectedSignature = crypto
        .createHmac(algorithm, config.secretKey)
        .update(rawBody)
        .digest(config.signatureFormat || 'hex');

      // 5. Comparar firmas usando timing-safe comparison
      const signatureBuffer = Buffer.from(signature, config.signatureFormat || 'hex');
      const expectedBuffer = Buffer.from(expectedSignature);

      if (signatureBuffer.length !== expectedBuffer.length) {
        logger.warn({
          event: 'hmac_validation_length_mismatch',
          receivedLength: signatureBuffer.length,
          expectedLength: expectedBuffer.length,
          path: req.path
        });
        throw new HmacValidationError('Invalid signature length', 'INVALID_SIGNATURE_LENGTH');
      }

      const isValid = crypto.timingSafeEqual(signatureBuffer, expectedBuffer);

      if (!isValid) {
        logger.warn({
          event: 'hmac_validation_failed',
          signatureHeader: config.signatureHeader,
          path: req.path,
          signatureProvided: signature.substring(0, 16) + '...'
        });
        throw new HmacValidationError('Invalid HMAC signature', 'INVALID_SIGNATURE');
      }

      // 6. Firma válida - continuar
      logger.debug({
        event: 'hmac_validation_success',
        signatureHeader: config.signatureHeader,
        path: req.path
      });

      next();
    } catch (error) {
      if (error instanceof HmacValidationError) {
        logger.error({
          event: 'hmac_validation_error',
          code: error.code,
          message: error.message,
          statusCode: error.statusCode
        });
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code
        });
      } else {
        next(error);
      }
    }
  };
}

/**
 * Middleware para verificar idempotencia en pagos
 *
 * Verifica si ya existe un pago con la misma Idempotency-Key
 *
 * @returns Middleware function
 *
 * @example
 * // Prevenir pagos duplicados
 * app.post('/payments/create',
 *   authMiddleware,
 *   checkPaymentIdempotency(),
 *   createPaymentHandler
 * );
 */
export function checkPaymentIdempotency() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idempotencyKey = req.headers['idempotency-key'] as string | undefined;

      // Si no hay idempotency key, continuar (no es obligatorio)
      if (!idempotencyKey) {
        logger.debug({
          event: 'idempotency_check_skipped',
          reason: 'no_idempotency_key'
        });
        next();
        return;
      }

      // Importar prisma dinámicamente para evitar circular dependencies
      const { default: prisma } = await import('../config/database.js');

      // Buscar pago existente con esta idempotency key
      const existingPago = await prisma.pago.findUnique({
        where: { externalId: idempotencyKey },
        select: {
          id: true,
          transactionId: true,
          status: true,
          amount: true,
          gateway: true
        }
      });

      if (existingPago) {
        logger.info({
          event: 'idempotency_check_duplicate',
          idempotencyKey,
          existingPagoId: existingPago.id,
          existingStatus: existingPago.status,
          transactionId: existingPago.transactionId
        });

        // Retornar pago existente en lugar de crear uno nuevo
        res.status(200).json({
          success: true,
          idempotent: true,
          data: {
            pagoId: existingPago.id,
            transactionId: existingPago.transactionId,
            status: existingPago.status,
            amount: Number(existingPago.amount),
            gateway: existingPago.gateway
          }
        });
      } else {
        // No existe - continuar con la creación
        logger.debug({
          event: 'idempotency_check_passed',
          idempotencyKey
        });

        // Adjuntar key al request para uso posterior
        (req as any).idempotencyKey = idempotencyKey;
        next();
      }
    } catch (error: any) {
      logger.error({
        event: 'idempotency_check_error',
        error: error.message,
        stack: error.stack
      });
      next(error);
    }
  };
}

/**
 * Middleware para validar datos de pago
 *
 * @returns Middleware function
 */
export function validatePaymentData() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { amount, currency, description } = req.body;

      // Validar amount
      if (!amount || typeof amount !== 'number' || amount <= 0) {
        res.status(400).json({
          success: false,
          error: 'Invalid amount',
          message: 'Amount must be a positive number (in cents)'
        });
        return;
      }

      // Validar currency (siempre USD para Ecuador)
      if (currency && currency !== 'USD') {
        res.status(400).json({
          success: false,
          error: 'Invalid currency',
          message: 'Only USD currency is supported'
        });
        return;
      }

      // Validar description
      if (!description || typeof description !== 'string' || description.length > 255) {
        res.status(400).json({
          success: false,
          error: 'Invalid description',
          message: 'Description is required and must be less than 255 characters'
        });
        return;
      }

      // Validar metadata si existe
      if (req.body.metadata && typeof req.body.metadata !== 'object') {
        res.status(400).json({
          success: false,
          error: 'Invalid metadata',
          message: 'Metadata must be an object'
        });
        return;
      }

      logger.debug({
        event: 'payment_data_validated',
        amount,
        currency: currency || 'USD',
        descriptionLength: description.length
      });

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Handler de errores para validación de pagos
 */
export function paymentValidationErrorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (err instanceof HmacValidationError) {
    logger.error({
      event: 'payment_validation_error',
      type: 'hmac',
      code: err.code,
      message: err.message
    });

    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code
    });
  } else if (err instanceof IdempotencyError) {
    logger.info({
      event: 'payment_validation_error',
      type: 'idempotency',
      code: err.code,
      existingTransactionId: err.existingTransactionId
    });

    res.status(409).json({
      success: false,
      error: 'Duplicate payment detected',
      code: err.code,
      existingTransactionId: err.existingTransactionId
    });
  } else {
    next(err);
  }
}
