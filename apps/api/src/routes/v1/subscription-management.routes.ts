import { Router } from 'express';
import { authMiddleware, requireRole } from '../../middleware/auth.js';
import { SubscriptionManagementService } from '../../services/payment/subscription-management.service.js';
import { logger } from '../../utils/logger.js';

const router: Router = Router();

/**
 * @openapi
 * /api/v1/payments/subscription/pause:
 *   post:
 *     summary: Pause subscription
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
 *         description: Subscription paused
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 */
router.post('/subscription/pause',  authMiddleware,  requireRole('DOCTOR',  'ADMIN'), async (req,  res) => {
  try {
    const { provider } = req.body;
    const userId = req.user!.id;

    if (!provider || !['payphone',  'kushki'].includes(provider)) {
      return res.status(400).json({
        error: 'Invalid provider',
        message: 'Provider must be payphone or kushki'
      });
    }

    const result = await SubscriptionManagementService.pauseSubscription(userId,  provider as 'payphone' | 'kushki');

    res.json(result);
  } catch (error) {
    logger.error({ error },  'Error pausing subscription');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /api/v1/payments/subscription/resume:
 *   post:
 *     summary: Resume subscription
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
 *         description: Subscription resumed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 */
router.post('/subscription/resume',  authMiddleware,  requireRole('DOCTOR',  'ADMIN'), async (req,  res) => {
  try {
    const { provider } = req.body;
    const userId = req.user!.id;

    if (!provider || !['payphone',  'kushki'].includes(provider)) {
      return res.status(400).json({
        error: 'Invalid provider',
        message: 'Provider must be payphone or kushki'
      });
    }

    const result = await SubscriptionManagementService.resumeSubscription(userId,  provider as 'payphone' | 'kushki');

    res.json(result);
  } catch (error) {
    logger.error({ error },  'Error resuming subscription');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /api/v1/payments/subscription/payment-method:
 *   post:
 *     summary: Update payment method
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
 *         description: Payment method updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 */
router.post('/subscription/payment-method',  authMiddleware,  requireRole('DOCTOR',  'ADMIN'), async (req,  res) => {
  try {
    const { provider, paymentMethodId } = req.body;
    const userId = req.user!.id;

    if (!provider || !paymentMethodId) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        message: 'Provider and paymentMethodId are required' 
      });
    }

    if (!['payphone',  'kushki'].includes(provider)) {
      return res.status(400).json({
        error: 'Invalid provider',
        message: 'Provider must be payphone or kushki'
      });
    }

    const result = await SubscriptionManagementService.updatePaymentMethod(userId,  provider as 'payphone' | 'kushki',  paymentMethodId);

    res.json(result);
  } catch (error) {
    logger.error({ error },  'Error updating payment method');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /api/v1/payments/subscription/change-plan:
 *   post:
 *     summary: Change subscription plan
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
 *               newPlan:
 *                 type: string
 *                 enum: [FREE, PREMIUM, CLINICA_SME]
 *               paymentMethodId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Plan changed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 */
router.post('/subscription/change-plan',  authMiddleware,  requireRole('DOCTOR',  'ADMIN'), async (req,  res) => {
  try {
    const { provider, newPlan, paymentMethodId } = req.body;
    const userId = req.user!.id;

    if (!provider || !newPlan || !paymentMethodId) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        message: 'Provider,  newPlan,  and paymentMethodId are required' 
      });
    }

    if (!['payphone',  'kushki'].includes(provider)) {
      return res.status(400).json({
        error: 'Invalid provider',
        message: 'Provider must be payphone or kushki'
      });
    }

    const result = await SubscriptionManagementService.changePlan(userId,  newPlan,  provider as 'payphone' | 'kushki',  paymentMethodId);

    res.json(result);
  } catch (error) {
    logger.error({ error },  'Error changing subscription plan');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /api/v1/payments/subscription/details:
 *   get:
 *     summary: Get subscription details
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 customerId:
 *                   type: string
 *                 subscriptionId:
 *                   type: string
 *                 plan:
 *                   type: string
 *                 status:
 *                   type: string
 *                 startDate:
 *                   type: string
 *                   format: date-time
 *                 endDate:
 *                   type: string
 *                   format: date-time
 *                 paymentMethodId:
 *                   type: string
 */
router.get('/subscription/details',  authMiddleware,  requireRole('DOCTOR',  'ADMIN'), async (req,  res) => {
  try {
    const userId = req.user!.id;

    const details = await SubscriptionManagementService.getSubscriptionDetails(userId);

    if (!details) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    res.json(details);
  } catch (error) {
    logger.error({ error },  'Error getting subscription details');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;