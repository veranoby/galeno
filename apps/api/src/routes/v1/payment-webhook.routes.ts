/**
 * Payment Webhook Routes
 *
 * Rutas para recibir webhooks de gateways de pago (Payphone, Kushki)
 * con validación HMAC y manejo de idempotencia.
 *
 * @module routes/v1
 */

import { Router, json, raw } from 'express';
import { logger } from '../../utils/logger.js';
import {
  handlePayphoneWebhook,
  handleKushkiWebhook,
  webhookHealthCheck
} from '../../services/payment/webhook-handler.js';
import {
  validateHmacSignature,
  paymentValidationErrorHandler
} from '../../middleware/payment-validation.js';

const router: Router = Router();

/**
 * @openapi
 * /api/v1/payments/webhooks/health:
 *   get:
 *     summary: Health check para webhooks de pago
 *     tags: [Payments]
 *     responses:
 *       200:
 *         description: Health check exitoso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 webhooks:
 *                   type: object
 *                   properties:
 *                     payphone:
 *                       type: string
 *                       example: /api/v1/payment/webhooks/payphone
 *                     kushki:
 *                       type: string
 *                       example: /api/v1/payment/webhooks/kushki
 */
router.get('/health', webhookHealthCheck);

/**
 * @openapi
 * /api/v1/payments/webhooks/payphone:
 *   post:
 *     summary: Webhook de Payphone para notificaciones de pago
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 description: ID de transacción de Payphone
 *               externalId:
 *                 type: string
 *                 description: ID externo (idempotency key)
 *               phoneNumber:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [CREATED, PENDING, APPROVED, REJECTED, REFUNDED, CANCELLED]
 *               value:
 *                 type: number
 *                 description: Monto en centavos
 *               currency:
 *                 type: string
 *                 example: USD
 *               createdAt:
 *                 type: string
 *                 format: date-time
 *               updatedAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Webhook recibido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 received:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Error en datos del webhook
 *       401:
 *         description: Firma HMAC inválida
 *       500:
 *         description: Error interno del servidor
 */
router.post(
  '/webhook/payphone',
  // Raw body es necesario para validación HMAC correcta
  raw({ type: 'application/json' }),
  // Validación HMAC con el secret de Payphone
  validateHmacSignature({
    secretKey: process.env.PAYPHONE_WEBHOOK_SECRET || '',
    signatureHeader: 'x-payphone-signature',
    algorithm: 'sha256',
    signatureFormat: 'hex'
  }),
  // Parsear JSON después de validación HMAC
  json(),
  // Handler del webhook
  handlePayphoneWebhook,
  // Error handler
  paymentValidationErrorHandler
);

/**
 * @openapi
 * /api/v1/payments/webhooks/kushki:
 *   post:
 *     summary: Webhook de Kushki para notificaciones de transacción
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               transactionId:
 *                 type: string
 *                 description: ID de transacción de Kushki
 *               event:
 *                 type: string
 *                 description: Tipo de evento
 *                 example: transaction.approved
 *               status:
 *                 type: string
 *                 enum: [PENDING, APPROVED, DECLINED, REFUNDED, CANCELLED, VOIDED]
 *               amount:
 *                 type: number
 *                 description: Monto en centavos
 *               currency:
 *                 type: string
 *                 example: USD
 *               authorizationCode:
 *                 type: string
 *                 description: Código de autorización
 *               lastFourDigits:
 *                 type: string
 *                 description: Últimos 4 dígitos de la tarjeta
 *                 example: '1111'
 *     responses:
 *       200:
 *         description: Webhook recibido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 received:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Error en datos del webhook
 *       401:
 *         description: Firma HMAC inválida
 *       500:
 *         description: Error interno del servidor
 */
router.post(
  '/webhook/kushki',
  // Raw body es necesario para validación HMAC correcta
  raw({ type: 'application/json' }),
  // Validación HMAC con el secret de Kushki
  validateHmacSignature({
    secretKey: process.env.KUSHKI_WEBHOOK_SECRET || '',
    signatureHeader: 'kushki-signature',
    algorithm: 'sha256',
    signatureFormat: 'hex'
  }),
  // Parsear JSON después de validación HMAC
  json(),
  // Handler del webhook
  handleKushkiWebhook,
  // Error handler
  paymentValidationErrorHandler
);

// Error handler is handled by the validation middleware's paymentValidationErrorHandler
export default router;
