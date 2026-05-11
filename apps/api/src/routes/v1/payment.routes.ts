import { Router } from 'express';
import { authMiddleware, requireRole } from '../../middleware/auth.js';
import { geoIPMiddleware, GeoIPRequest } from '../../middleware/geo-ip.js';
import { paymentService } from '../../services/payment/index.js';
import { logger } from '../../utils/logger.js';
import { Plan } from '@prisma/client';
import { paymentContext } from '../../services/payment/strategies/payment.context.js';
import {
  handlePayphoneWebhook,
  handlePaypalWebhook,
  webhookHealthCheck
} from '../../services/payment/webhook-handler.js';

const router: Router = Router();

/**
 * @openapi
 * /api/v1/payments/method:
 *   post:
 *     summary: Save payment method
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               provider:
 *                 type: string
 *                 enum: [payphone, kushki]
 *               paymentMethodId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment method saved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 */
router.post('/method',  authMiddleware,  requireRole('DOCTOR',  'ADMIN'), async (req,  res) => {
  try {
    const { provider, paymentMethodId } = req.body;
    const userId = req.user!.id;

    if (!provider || !paymentMethodId) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        message: 'Provider and paymentMethodId are required' 
      });
    }

    // In a real implementation, you would update the user's payment method
    // For now, we'll just validate that the provider is supported
    if (!['payphone',  'kushki'].includes(provider)) {
      return res.status(400).json({
        error: 'Invalid provider',
        message: 'Supported providers are: payphone,  kushki'
      });
    }

    // Update user with payment method info
    // This would be handled by the payment service in a real implementation
    logger.info({ 
      event: 'payment_method_added',  
      userId,  
      provider 
    });

    res.json({ success: true });
  } catch (error) {
    logger.error({ error },  'Error saving payment method');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /api/v1/payments/subscribe:
 *   post:
 *     summary: Subscribe to a plan
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               plan:
 *                 type: string
 *                 enum: [FREE, PREMIUM, CLINICA_SME]
 *               provider:
 *                 type: string
 *                 enum: [payphone, kushki]
 *               paymentMethodId:
 *                 type: string
 *               trialPeriodDays:
 *                 type: number
 *     responses:
 *       200:
 *         description: Subscription created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 subscriptionId:
 *                   type: string
 *                 invoiceId:
 *                   type: string
 */
router.post('/subscribe',  authMiddleware,  requireRole('DOCTOR',  'ADMIN'), async (req,  res) => {
  try {
    const { plan, provider, paymentMethodId, trialPeriodDays } = req.body;
    const userId = req.user!.id;

    if (!plan || !provider || !paymentMethodId) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        message: 'Plan,  provider,  and paymentMethodId are required' 
      });
    }

    // Validate plan
    if (!Object.values(Plan).includes(plan as Plan)) {
      return res.status(400).json({ 
        error: 'Invalid plan', 
        message: 'Plan must be one of FREE,  PREMIUM,  or CLINICA_SME' 
      });
    }

    // Validate provider
    if (!['payphone',  'kushki'].includes(provider)) {
      return res.status(400).json({
        error: 'Invalid provider',
        message: 'Supported providers are: payphone,  kushki'
      });
    }

    // Create subscription
    const result = await paymentService.createSubscription(
      userId, 
      provider as 'payphone' | 'kushki', 
      plan as Plan, 
      paymentMethodId, 
      trialPeriodDays
    );

    res.json(result);
  } catch (error) {
    logger.error({ error },  'Error creating subscription');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /api/v1/payments/cancel:
 *   post:
 *     summary: Cancel subscription
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               provider:
 *                 type: string
 *                 enum: [payphone, kushki]
 *     responses:
 *       200:
 *         description: Subscription cancelled
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 */
router.post('/cancel',  authMiddleware,  requireRole('DOCTOR',  'ADMIN'), async (req,  res) => {
  try {
    const { provider } = req.body;
    const userId = req.user!.id;

    if (!provider) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        message: 'Provider is required' 
      });
    }

    // Validate provider
    if (!['payphone',  'kushki'].includes(provider)) {
      return res.status(400).json({
        error: 'Invalid provider',
        message: 'Supported providers are: payphone,  kushki'
      });
    }

    // Cancel subscription
    const result = await paymentService.cancelSubscription(
      userId,
      provider as 'payphone' | 'kushki'
    );

    res.json(result);
  } catch (error) {
    logger.error({ error },  'Error cancelling subscription');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /api/v1/payments/history:
 *   get:
 *     summary: Get payment history
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Payment history
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 payments:
 *                   type: array
 *                   items:
 *                     type: object
 */
router.get('/history',  authMiddleware,  requireRole('DOCTOR',  'ADMIN'), async (req,  res) => {
  try {
    const userId = req.user!.id;

    // Get user's cuenta to get cuentaId
    const user = await (await import('../../config/database.js')).default.cuenta.findUnique({
      where: { id: userId },
      select: { id: true }
    });

    if (!user || !user.id) {
      return res.status(404).json({ error: 'User account not found' });
    }

    // Get payment history
    const payments = await paymentService.getPaymentHistory(user.id);

    res.json({ payments });
  } catch (error) {
    logger.error({ error },  'Error fetching payment history');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /api/v1/payments/invoice/{id}:
 *   get:
 *     summary: Get invoice
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Invoice
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 invoiceUrl:
 *                   type: string
 */
router.get('/invoice/:id',  authMiddleware,  requireRole('DOCTOR',  'ADMIN'), async (req,  res) => {
  try {
    const { id } = req.params as { id: string };
    const userId = req.user!.id;

    // Get invoice
    const result = await paymentService.getInvoice(userId,  id);

    res.json(result);
  } catch (error) {
    logger.error({ error },  'Error fetching invoice');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Include subscription management routes under the same router
const subscriptionManagementRouter = await import('./subscription-management.routes.js');
router.use('/',  subscriptionManagementRouter.default);

// ============= ENDPOINTS DE PAGO (TASK-018 + FASE 1) =============

/**
 * GET /api/v1/payments/health
 * Health check para pagos
 */
router.get('/health', webhookHealthCheck);

/**
 * POST /api/v1/payments/payphone/init
 * Iniciar pago con PayPhone (Ecuador)
 */
router.post('/payphone/init', authMiddleware, async (req, res) => {
  try {
    const { amount, tax, currency, description } = req.body;

    if (!amount || !currency) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'amount and currency are required'
      });
    }

    // Crear pago con PayPhone
    const result = await paymentContext.createPayment(
      {
        amount,
        currency,
        customerId: req.user!.id,
        description: description || 'Pago de suscripción',
        metadata: { tax }
      },
      { forceStrategy: 'payphone' }
    );

    res.json({
      success: true,
      data: {
        transactionId: result.transactionId,
        paymentUrl: result.hostedUrl,
        qrCode: result.qrCode,
        status: result.status
      }
    });
  } catch (error) {
    logger.error({ error }, 'Error creating Payphone payment');
    res.status(500).json({
      error: 'Failed to create payment',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/v1/payments/paypal/subscription
 * Crear suscripción con PayPal (Internacional)
 */
router.post('/paypal/subscription', authMiddleware, async (req, res) => {
  try {
    const { planId, amount, currency, description } = req.body;

    if (!planId && !amount) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'planId or amount is required'
      });
    }

    // Crear suscripción con PayPal
    const result = await paymentContext.createPayment(
      {
        amount: amount || 0,
        currency: currency || 'USD',
        customerId: req.user!.id,
        description: description || 'Suscripción mensual',
        metadata: {
          planId,
          isSubscription: true,
          returnUrl: process.env.FRONTEND_URL || 'http://localhost:5173'
        }
      },
      { forceStrategy: 'paypal' }
    );

    res.json({
      success: true,
      data: {
        transactionId: result.transactionId,
        approvalUrl: result.hostedUrl,
        status: result.status
      }
    });
  } catch (error) {
    logger.error({ error }, 'Error creating PayPal subscription');
    res.status(500).json({
      error: 'Failed to create subscription',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/v1/payments/paypal/order
 * Crear orden de pago único con PayPal
 */
router.post('/paypal/order', authMiddleware, async (req, res) => {
  try {
    const { amount, currency, description } = req.body;

    if (!amount || !currency) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'amount and currency are required'
      });
    }

    // Crear orden con PayPal
    const result = await paymentContext.createPayment(
      {
        amount,
        currency,
        customerId: req.user!.id,
        description: description || 'Pago único',
        metadata: {
          isSubscription: false,
          returnUrl: process.env.FRONTEND_URL || 'http://localhost:5173'
        }
      },
      { forceStrategy: 'paypal' }
    );

    res.json({
      success: true,
      data: {
        transactionId: result.transactionId,
        approvalUrl: result.hostedUrl,
        status: result.status
      }
    });
  } catch (error) {
    logger.error({ error }, 'Error creating PayPal order');
    res.status(500).json({
      error: 'Failed to create order',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/v1/payments/auto
 * Crear pago con selección automática de estrategia según país
 */
router.post('/auto', authMiddleware, geoIPMiddleware, async (req: GeoIPRequest, res) => {
  try {
    const { amount, currency, description, countryCode } = req.body;

    if (!amount || !currency) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'amount and currency are required'
      });
    }

    // Determinar país: 1) countryCode del body, 2) Geo-IP, 3) Default EC
    const country = countryCode || req.geo?.country || 'EC';

    // Crear pago con estrategia automática
    const result = await paymentContext.createPayment(
      {
        amount,
        currency,
        customerId: req.user!.id,
        description: description || 'Pago de suscripción'
      },
      { countryCode: country }
    );

    res.json({
      success: true,
      data: {
        transactionId: result.transactionId,
        paymentUrl: result.hostedUrl,
        qrCode: result.qrCode,
        status: result.status,
        detectedCountry: country,
        strategy: country === 'EC' ? 'payphone' : 'paypal'
      }
    });
  } catch (error) {
    logger.error({ error }, 'Error creating auto payment');
    res.status(500).json({
      error: 'Failed to create payment',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/v1/payments/strategies
 * Obtener estrategias de pago disponibles con recomendación basada en Geo-IP
 */
router.get('/strategies', authMiddleware, geoIPMiddleware, async (req: GeoIPRequest, res) => {
  try {
    const strategies = paymentContext.getAvailableStrategies();
    const strategyStatus = strategies.map(type => ({
      type,
      available: paymentContext.isStrategyAvailable(type)
    }));

    const detectedCountry = req.geo?.country || 'EC';
    const recommended = detectedCountry === 'EC' ? 'payphone' : 'paypal';

    res.json({
      success: true,
      data: {
        strategies: strategyStatus,
        recommended,
        detectedCountry,
        taxInfo: {
          applyIVA: detectedCountry === 'EC',
          ivaRate: detectedCountry === 'EC' ? 0.15 : 0
        }
      }
    });
  } catch (error) {
    logger.error({ error }, 'Error getting strategies');
    res.status(500).json({
      error: 'Failed to get strategies',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============= WEBHOOKS (Sin autenticación) =============

/**
 * POST /api/v1/payments/webhooks/payphone
 * Webhook para PayPhone (sin auth)
 */
router.post('/webhooks/payphone', (req, res) => {
  handlePayphoneWebhook(req, res).catch(err => {
    logger.error({ error: err }, 'Unhandled webhook error');
    res.status(500).json({ error: 'Internal server error' });
  });
});

/**
 * POST /api/v1/payments/webhooks/paypal
 * Webhook para PayPal (sin auth)
 */
router.post('/webhooks/paypal', (req, res) => {
  handlePaypalWebhook(req, res).catch(err => {
    logger.error({ error: err }, 'Unhandled webhook error');
    res.status(500).json({ error: 'Internal server error' });
  });
});

export default router;