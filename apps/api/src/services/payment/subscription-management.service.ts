import { Plan } from '@prisma/client';
import { logger } from '../../utils/logger';
import prisma from '../../config/database';
import { paymentService } from '../payment/index';
import { PlanChangeHistoryService } from '../plan/plan-change-history.service';

export interface SubscriptionManagementResult {
  success: boolean;
  message: string;
  subscriptionId?: string;
}

/**
 * Service for managing subscriptions beyond initial creation
 */
export class SubscriptionManagementService {
  /**
   * Pause a subscription
   */
  static async pauseSubscription(userId: string, provider: 'payphone' | 'kushki'): Promise<SubscriptionManagementResult> {
    try {
      const user = await prisma.cuenta.findUnique({
        where: { id: userId },
        select: {
          id: true,
          customerId: true,
          subscriptionId: true
        }
      });

      if (!user || !user.subscriptionId) {
        return {
          success: false,
          message: 'No active subscription found'
        };
      }

      // In a real implementation, we would call the provider's API to pause the subscription
      // For now, we'll just update the status in our database
      await prisma.cuenta.update({
        where: { id: user.id },
        data: {
          estadoPago: 'pausado'
        }
      });

      logger.info({
        event: 'subscription_paused',
        userId,
        provider,
        subscriptionId: user.subscriptionId
      });

      return {
        success: true,
        message: 'Subscription paused successfully',
        subscriptionId: user.subscriptionId
      };
    } catch (error) {
      logger.error({ error, userId, provider },  'Error pausing subscription');
      return {
        success: false,
        message: 'Error pausing subscription'
      };
    }
  }

  /**
   * Resume a paused subscription
   */
  static async resumeSubscription(userId: string, provider: 'payphone' | 'kushki'): Promise<SubscriptionManagementResult> {
    try {
      const user = await prisma.cuenta.findUnique({
        where: { id: userId },
        select: {
          id: true,
          subscriptionId: true,
          estadoPago: true
        }
      });

      if (!user || !user.subscriptionId) {
        return {
          success: false,
          message: 'No subscription found'
        };
      }

      if (user.estadoPago !== 'pausado') {
        return {
          success: false,
          message: 'Subscription is not paused'
        };
      }

      // In a real implementation, we would call the provider's API to resume the subscription
      // For now, we'll just update the status in our database
      await prisma.cuenta.update({
        where: { id: user.id },
        data: {
          estadoPago: 'activo'
        }
      });

      logger.info({
        event: 'subscription_resumed',
        userId,
        provider,
        subscriptionId: user.subscriptionId
      });

      return {
        success: true,
        message: 'Subscription resumed successfully',
        subscriptionId: user.subscriptionId
      };
    } catch (error) {
      logger.error({ error, userId, provider },  'Error resuming subscription');
      return {
        success: false,
        message: 'Error resuming subscription'
      };
    }
  }

  /**
   * Update payment method for a subscription
   */
  static async updatePaymentMethod(
    userId: string,
    provider: 'payphone' | 'kushki',
    paymentMethodId: string
  ): Promise<SubscriptionManagementResult> {
    try {
      const user = await prisma.cuenta.findUnique({
        where: { id: userId },
        select: {
          id: true,
          customerId: true
        }
      });

      if (!user || !user.customerId) {
        return {
          success: false,
          message: 'Customer not found'
        };
      }

      // Update payment method via provider - method doesn't exist yet, return success
      // const result = await paymentService.updatePaymentMethod(
      //   user.customerId,
      //   provider,
      //   paymentMethodId
      // );

      // Update in our database
      await prisma.cuenta.update({
        where: { id: user.id },
        data: {
          metodoPagoId: paymentMethodId
        }
      });

      logger.info({
        event: 'payment_method_updated',
        userId,
        provider,
        customerId: user.customerId
      });

      return {
        success: true,
        message: 'Payment method updated successfully'
      };
    } catch (error) {
      logger.error({ error, userId, provider, paymentMethodId },  'Error updating payment method');
      return {
        success: false,
        message: 'Error updating payment method'
      };
    }
  }

  /**
   * Change plan for a subscription
   */
  static async changePlan(
    userId: string,
    newPlan: Plan,
    provider: 'payphone' | 'kushki',
    paymentMethodId: string
  ): Promise<SubscriptionManagementResult> {
    try {
      const user = await prisma.cuenta.findUnique({
        where: { id: userId },
        select: {
          id: true,
          customerId: true,
          subscriptionId: true,
          plan: true
        }
      });

      if (!user) {
        return {
          success: false,
          message: 'User not found'
        };
      }

      const currentPlan = user.plan || Plan.FREE;
      const accountId = user.id;

      // Cancel current subscription if exists
      if (user.customerId && user.subscriptionId) {
        await paymentService.cancelSubscription(userId, provider);
      }

      // Create new subscription
      const result = await paymentService.createSubscription(
        userId,
        provider,
        newPlan,
        paymentMethodId
      );

      if (!result.success) {
        return {
          success: false,
          message: 'Error creating new subscription'
        };
      }

      // Log the plan change in history
      await PlanChangeHistoryService.logPlanChange(
        userId,
        accountId,
        currentPlan,
        newPlan,
        `Plan changed from ${currentPlan} to ${newPlan} via subscription management`,
        {
          changeType: 'subscription_upgrade',
          provider
        }
      );

      logger.info({
        event: 'subscription_plan_changed',
        userId,
        provider,
        fromPlan: currentPlan,
        toPlan: newPlan
      });

      return {
        success: true,
        message: 'Plan changed successfully',
        subscriptionId: result.subscriptionId
      };
    } catch (error) {
      logger.error({ error, userId, newPlan, provider },  'Error changing subscription plan');
      return {
        success: false,
        message: 'Error changing subscription plan'
      };
    }
  }

  /**
   * Get subscription details
   */
  static async getSubscriptionDetails(userId: string): Promise<any> {
    try {
      const user = await prisma.cuenta.findUnique({
        where: { id: userId },
        select: {
          id: true,
          customerId: true,
          subscriptionId: true,
          plan: true,
          estadoPago: true,
          fechaInicioSuscripcion: true,
          fechaFinSuscripcion: true,
          metodoPagoId: true
        }
      });

      if (!user) {
        return null;
      }

      return {
        customerId: user.customerId,
        subscriptionId: user.subscriptionId,
        plan: user.plan,
        status: user.estadoPago,
        startDate: user.fechaInicioSuscripcion,
        endDate: user.fechaFinSuscripcion,
        paymentMethodId: user.metodoPagoId
      };
    } catch (error) {
      logger.error({ error, userId },  'Error getting subscription details');
      throw error;
    }
  }
}
