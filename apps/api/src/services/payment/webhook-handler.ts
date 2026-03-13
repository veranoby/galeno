/**
 * Payment Webhook Handler
 *
 * Procesa webhooks de diferentes gateways de pago con verificación de seguridad
 * e idempotencia.
 */

import { Request, Response } from 'express';
import prisma from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import { PayphoneProvider } from './payphone.provider.js';
import { KushkiProvider } from './kushki.provider.js';
import { PaypalStrategy } from './strategies/paypal.strategy.js';
import { WebhookSignatureError } from './base.js';

/**
 * Resultado del procesamiento de webhook
 */
interface WebhookProcessResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

/**
 * Procesar webhook de Payphone
 */
export async function handlePayphoneWebhook(req: Request, res: Response): Promise<void> {
  try {
    const signature = req.headers['x-payphone-signature'] as string | undefined;
    const payload = req.body;

    logger.info({
      event: 'webhook_received',
      gateway: 'payphone',
      transactionId: payload?.id,
      hasSignature: !!signature
    });

    // Log webhook para auditoría
    await prisma.paymentWebhookLog.create({
      data: {
        gateway: 'payphone',
        event: payload?.event || 'payment.status_changed',
        transactionId: payload?.id,
        payload,
        signature
      }
    });

    const payphoneProvider = new PayphoneProvider();
    const result = await payphoneProvider.handleWebhook(payload, signature);

    if (result.success) {
      // Actualizar estado del pago en BD
      if (payload?.status === 'APPROVED' && payload?.id) {
        await processApprovedPayment(payload.id, payload?.value, 'payphone');
      } else if (payload?.status === 'REJECTED' && payload?.id) {
        await processRejectedPayment(payload.id, 'payphone');
      }

      // Actualizar log como procesado
      await prisma.paymentWebhookLog.updateMany({
        where: {
          gateway: 'payphone',
          transactionId: payload?.id,
          processed: false
        },
        data: {
          processed: true,
          processedAt: new Date()
        }
      });

      res.status(200).json({ received: true });
    } else {
      logger.error({
        event: 'webhook_processing_failed',
        gateway: 'payphone',
        error: result.error
      });

      res.status(400).json({ error: result.error });
    }
  } catch (error: any) {
    logger.error({
      event: 'webhook_error',
      gateway: 'payphone',
      error: error.message,
      stack: error.stack
    });

    if (error instanceof WebhookSignatureError) {
      res.status(401).json({ error: 'Invalid signature' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

/**
 * Procesar pago aprobado - crea PaymentSplit records
 */
async function processApprovedPayment(
  transactionId: string,
  amount: number,
  gateway: string
): Promise<void> {
  try {
    // Buscar el pago en BD
    const pago = await prisma.pago.findUnique({
      where: { transactionId },
      include: { 
        cuenta: {
          select: {
            id: true,
            email: true,
            nombre: true
          }
        },
        splits: true
      }
    });

    if (!pago) {
      logger.warn({ transactionId }, 'Pago no encontrado para procesar splits');
      return;
    }

    // Verificar si ya fue procesado (idempotencia)
    if (pago.status === 'APPROVED') {
      logger.info({ 
        event: 'payment_already_approved', 
        transactionId,
        existingStatus: pago.status 
      });
      return;
    }

    // Actualizar estado del pago
    await prisma.pago.update({
      where: { id: pago.id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date()
      }
    });

    // Si ya existen splits, actualizarlos a PAID
    if (pago.splits && pago.splits.length > 0) {
      await prisma.paymentSplit.updateMany({
        where: {
          pagoId: pago.id,
          status: 'PENDING'
        },
        data: {
          status: 'PAID',
          paidAt: new Date()
        }
      });

      logger.info({
        event: 'payment_splits_marked_as_paid',
        transactionId,
        splitsCount: pago.splits.length
      });
    } else {
      // Calcular splits (15% Galeno, 85% Doctor por defecto)
      const galenoPercentage = process.env.GALENO_COMMISSION_PERCENTAGE
        ? parseFloat(process.env.GALENO_COMMISSION_PERCENTAGE)
        : 15;
      const doctorPercentage = 100 - galenoPercentage;

      const galenoAmount = Math.round(amount * (galenoPercentage / 100));
      const doctorAmount = amount - galenoAmount;

      // Crear splits
      await prisma.paymentSplit.createMany({
        data: [
          {
            pagoId: pago.id,
            recipientId: 'galeno-system', // ID especial para Galeno
            amount: galenoAmount,
            percentage: galenoPercentage,
            status: 'PAID',
            paidAt: new Date(),
            description: `Comisión Galeno (${galenoPercentage}%)`
          },
          {
            pagoId: pago.id,
            recipientId: pago.cuentaId,
            amount: doctorAmount,
            percentage: doctorPercentage,
            status: 'PAID',
            paidAt: new Date(),
            description: `Pago doctor (${doctorPercentage}%)`
          }
        ]
      });

      logger.info({
        event: 'payment_splits_created',
        transactionId,
        galenoAmount,
        doctorAmount,
        totalAmount: amount
      });
    }

    // Notificar al doctor sobre el pago aprobado (opcional)
    logger.info({
      event: 'payment_approved_notification',
      transactionId,
      doctorId: pago.cuentaId,
      amount,
      email: pago.cuenta.email
    });
  } catch (error) {
    logger.error({
      event: 'payment_splits_error',
      transactionId,
      error
    });
    // No throw - no queremos fallar el webhook por esto
  }
}

/**
 * Procesar pago rechazado
 */
async function processRejectedPayment(
  transactionId: string,
  gateway: string
): Promise<void> {
  try {
    const pago = await prisma.pago.findUnique({
      where: { transactionId },
      include: { splits: true }
    });

    if (!pago) {
      logger.warn({ transactionId }, 'Pago no encontrado para procesar rechazo');
      return;
    }

    // Actualizar estado del pago
    await prisma.pago.update({
      where: { id: pago.id },
      data: {
        status: 'REJECTED'
      }
    });

    // Marcar splits como FAILED
    if (pago.splits && pago.splits.length > 0) {
      await prisma.paymentSplit.updateMany({
        where: {
          pagoId: pago.id,
          status: 'PENDING'
        },
        data: {
          status: 'FAILED'
        }
      });
    }

    logger.info({
      event: 'payment_rejected',
      transactionId,
      gateway
    });
  } catch (error) {
    logger.error({
      event: 'payment_reject_error',
      transactionId,
      error
    });
  }
}

/**
 * Procesar webhook de Kushki
 */
export async function handleKushkiWebhook(req: Request, res: Response): Promise<void> {
  try {
    const signature = req.headers['kushki-signature'] as string | undefined;
    const payload = req.body;

    logger.info({
      event: 'webhook_received',
      gateway: 'kushki',
      transactionId: payload?.transactionId,
      hasSignature: !!signature
    });

    // Log webhook para auditoría
    await prisma.paymentWebhookLog.create({
      data: {
        gateway: 'kushki',
        event: payload?.event || 'transaction.status_changed',
        transactionId: payload?.transactionId,
        payload,
        signature
      }
    });

    const kushkiProvider = new KushkiProvider();
    const result = await kushkiProvider.handleWebhook(payload, signature);

    if (result.success) {
      // Actualizar estado del pago en BD
      if (payload?.status === 'APPROVED' && payload?.transactionId) {
        await processApprovedPayment(
          payload.transactionId,
          payload?.amount || 0,
          'kushki'
        );
      } else if (payload?.status === 'DECLINED' && payload?.transactionId) {
        await processRejectedPayment(payload.transactionId, 'kushki');
      }

      // Actualizar log como procesado
      await prisma.paymentWebhookLog.updateMany({
        where: {
          gateway: 'kushki',
          transactionId: payload?.transactionId,
          processed: false
        },
        data: {
          processed: true,
          processedAt: new Date()
        }
      });

      res.status(200).json({ received: true });
    } else {
      logger.error({
        event: 'webhook_processing_failed',
        gateway: 'kushki',
        error: result.error
      });

      res.status(400).json({ error: result.error });
    }
  } catch (error: any) {
    logger.error({
      event: 'webhook_error',
      gateway: 'kushki',
      error: error.message,
      stack: error.stack
    });

    if (error instanceof WebhookSignatureError) {
      res.status(401).json({ error: 'Invalid signature' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

/**
 * Health check para webhooks
 */
export function webhookHealthCheck(req: Request, res: Response): void {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    webhooks: {
      payphone: '/api/v1/payment/webhooks/payphone',
      kushki: '/api/v1/payment/webhooks/kushki',
      paypal: '/api/v1/payment/webhooks/paypal'
    }
  });
}

/**
 * Procesar webhook de PayPal
 */
export async function handlePaypalWebhook(req: Request, res: Response): Promise<void> {
  try {
    const signature = req.headers['paypal-transmission-sig'] as string | undefined;
    const payload = req.body;

    logger.info({
      event: 'webhook_received',
      gateway: 'paypal',
      eventType: payload?.event_type,
      transactionId: payload?.resource?.id,
      hasSignature: !!signature
    });

    // Log webhook para auditoría
    await prisma.paymentWebhookLog.create({
      data: {
        gateway: 'paypal',
        event: payload?.event_type || 'payment.status_changed',
        transactionId: payload?.resource?.id,
        payload,
        signature
      }
    });

    const paypalStrategy = new PaypalStrategy();
    const result = await paypalStrategy.handleWebhook(payload, signature);

    if (result.success) {
      // Procesar según tipo de evento
      const eventType = payload?.event_type;
      const resourceId = payload?.resource?.id;

      if (!resourceId) {
        logger.warn({ event: 'paypal_webhook_no_resource_id', payload });
        res.status(200).json({ received: true });
        return;
      }

      // Actualizar estado del pago en BD según evento
      if (eventType === 'BILLING.SUBSCRIPTION.ACTIVATED') {
        await processSubscriptionActivated(resourceId, payload);
      } else if (eventType === 'CHECKOUT.ORDER.APPROVED') {
        await processOrderApproved(resourceId, payload);
      } else if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
        await processPaymentCompleted(resourceId, payload);
      } else if (eventType === 'PAYMENT.CAPTURE.DENIED' || eventType === 'BILLING.SUBSCRIPTION.CANCELLED') {
        await processPaymentDenied(resourceId, 'paypal');
      }

      // Actualizar log como procesado
      await prisma.paymentWebhookLog.updateMany({
        where: {
          gateway: 'paypal',
          transactionId: resourceId,
          processed: false
        },
        data: {
          processed: true,
          processedAt: new Date()
        }
      });

      res.status(200).json({ received: true });
    } else {
      logger.error({
        event: 'webhook_processing_failed',
        gateway: 'paypal',
        error: result.error
      });

      res.status(400).json({ error: result.error });
    }
  } catch (error: any) {
    logger.error({
      event: 'paypal_webhook_error',
      error: error.message,
      stack: error.stack
    });

    if (error instanceof WebhookSignatureError) {
      res.status(401).json({ error: 'Invalid signature' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

/**
 * Procesar suscripción activada
 */
async function processSubscriptionActivated(
  subscriptionId: string,
  payload: any
): Promise<void> {
  try {
    // Buscar pago por transactionId
    const pago = await prisma.pago.findUnique({
      where: { transactionId: subscriptionId },
      include: { cuenta: true }
    });

    if (!pago) {
      logger.warn({
        event: 'paypal_subscription_not_found',
        subscriptionId
      });
      return;
    }

    if (pago.status === 'APPROVED') {
      logger.info({
        event: 'paypal_subscription_already_approved',
        subscriptionId
      });
      return;
    }

    // Actualizar pago
    await prisma.pago.update({
      where: { id: pago.id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        metadata: Object.assign({}, pago.metadata || {}, {
          subscriptionId,
          subscriptionActivatedAt: new Date().toISOString()
        })
      }
    });

    logger.info({
      event: 'paypal_subscription_activated',
      subscriptionId,
      accountId: pago.cuentaId
    });
  } catch (error) {
    logger.error({
      event: 'paypal_subscription_activation_error',
      subscriptionId,
      error
    });
  }
}

/**
 * Procesar orden aprobada
 */
async function processOrderApproved(
  orderId: string,
  payload: any
): Promise<void> {
  try {
    const amount = payload?.resource?.amount?.value
      ? Math.round(parseFloat(payload.resource.amount.value) * 100)
      : 0;

    await processApprovedPayment(orderId, amount, 'paypal');
  } catch (error) {
    logger.error({
      event: 'paypal_order_approved_error',
      orderId,
      error
    });
  }
}

/**
 * Procesar pago completado
 */
async function processPaymentCompleted(
  captureId: string,
  payload: any
): Promise<void> {
  try {
    const amount = payload?.resource?.amount?.value
      ? Math.round(parseFloat(payload.resource.amount.value) * 100)
      : 0;

    await processApprovedPayment(captureId, amount, 'paypal');
  } catch (error) {
    logger.error({
      event: 'paypal_payment_completed_error',
      captureId,
      error
    });
  }
}

/**
 * Procesar pago denegado
 */
async function processPaymentDenied(
  transactionId: string,
  gateway: string
): Promise<void> {
  try {
    await processRejectedPayment(transactionId, gateway);
  } catch (error) {
    logger.error({
      event: 'paypal_payment_denied_error',
      transactionId,
      error
    });
  }
}
