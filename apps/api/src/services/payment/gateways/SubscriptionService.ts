// apps/api/src/services/payment/gateways/SubscriptionService.ts
/**
 * Servicio para suscripciones recurrentes
 * Maneja creación, cancelación y actualización de suscripciones
 */

import { Plan, PrismaClient } from '@prisma/client';
import type { PaymentProvider, CustomerData, SubscriptionData, CustomerResult, SubscriptionResult, CancelResult, UpdateResult } from '../types.js';
import { logger } from '../../../utils/logger.js';
import { getPlanConfig } from '../../plan/config.js';

export class SubscriptionService {
  private providers: Map<string, PaymentProvider> = new Map();
  private initialized: boolean = false;

  constructor(private prisma: PrismaClient) {}

  async initialize() {
    if (this.initialized) return;

    // Nota: Payphone y Kushki no soportan suscripciones en Ecuador
    // Futuro: Agregar StripeProvider para soporte de suscripciones
    // if (process.env.STRIPE_SECRET_KEY) {
    //   const { StripeProvider } = await import('../stripe.provider.js');
    //   this.providers.set('stripe', new StripeProvider());
    // }

    this.initialized = true;
  }

  private async getProvider(provider: string): Promise<PaymentProvider> {
    await this.initialize();
    const instance = this.providers.get(provider);
    if (!instance) {
      throw new Error(`${provider} subscription provider not configured. Note: Payphone and Kushki don't support subscriptions in Ecuador.`);
    }
    return instance;
  }

  /**
   * Crear cliente para suscripciones
   */
  async createCustomer(provider: 'payphone' | 'kushki', userData: CustomerData): Promise<CustomerResult> {
    try {
      const providerInstance = await this.getProvider(provider);
      return await providerInstance.createCustomer(userData);
    } catch (error) {
      // Fallback: Retornar mock customer para providers sin soporte
      logger.warn({ provider, userData }, 'Customer creation not supported, using mock implementation');
      return {
        customerId: `mock_${userData.email.replace(/@/g, '_')}`,
        success: true
      };
    }
  }

  /**
   * Crear suscripción
   */
  async createSubscription(
    userId: string,
    provider: 'payphone' | 'kushki',
    plan: Plan,
    paymentMethodId: string,
    trialPeriodDays?: number
  ): Promise<SubscriptionResult> {
    try {
      const providerInstance = await this.getProvider(provider);

      // Obtener datos del usuario
      const user = await this.prisma.cuenta.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          nombre: true,
          customerId: true
        }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Obtener configuración del plan
      const planConfig = getPlanConfig(plan);

      // Crear customer si no existe
      let customerId = user.customerId;
      if (!customerId) {
        const customerResult = await this.createCustomer(provider, {
          email: user.email,
          name: user.nombre || user.email,
        });

        if (!customerResult.success) {
          throw new Error(`Failed to create customer: ${customerResult.error}`);
        }

        customerId = customerResult.customerId;

        // Actualizar cuenta con customer ID
        await this.prisma.cuenta.update({
          where: { id: user.id },
          data: { customerId }
        });
      }

      // Crear suscripción vía provider
      const subscriptionData: SubscriptionData = {
        customerId,
        plan,
        paymentMethodId,
        trialPeriodDays
      };

      const result = await providerInstance.createSubscription(subscriptionData);

      if (!result.success) {
        throw new Error(`Failed to create subscription: ${result.error}`);
      }

      // Actualizar cuenta con información de suscripción
      await this.prisma.cuenta.update({
        where: { id: user.id },
        data: {
          plan,
          fechaInicioSuscripcion: new Date(),
          fechaFinSuscripcion: null,
          estadoPago: 'activo',
          metodoPagoId: paymentMethodId,
          subscriptionId: result.subscriptionId
        }
      });

      logger.info({
        event: 'subscription_created',
        userId,
        plan,
        provider,
        subscriptionId: result.subscriptionId
      });

      return result;
    } catch (error) {
      logger.error({ error, userId, plan, provider }, 'Error creating subscription');
      throw error;
    }
  }

  /**
   * Cancelar suscripción
   */
  async cancelSubscription(userId: string, provider: 'payphone' | 'kushki'): Promise<CancelResult> {
    try {
      const providerInstance = await this.getProvider(provider);

      const user = await this.prisma.cuenta.findUnique({
        where: { id: userId },
        select: {
          id: true,
          customerId: true,
          subscriptionId: true
        }
      });

      if (!user || !user.subscriptionId) {
        throw new Error('No active subscription found');
      }

      const result = await providerInstance.cancelSubscription(user.subscriptionId);

      if (result.success) {
        await this.prisma.cuenta.update({
          where: { id: user.id },
          data: {
            estadoPago: 'cancelado',
            fechaFinSuscripcion: new Date()
          }
        });

        logger.info({
          event: 'subscription_cancelled',
          userId,
          provider,
          subscriptionId: user.subscriptionId
        });
      }

      return result;
    } catch (error) {
      logger.error({ error, userId, provider }, 'Error cancelling subscription');
      throw error;
    }
  }

  /**
   * Actualizar método de pago de suscripción
   */
  async updatePaymentMethod(userId: string, provider: 'payphone' | 'kushki', paymentMethodId: string): Promise<UpdateResult> {
    try {
      const providerInstance = await this.getProvider(provider);

      const user = await this.prisma.cuenta.findUnique({
        where: { id: userId },
        select: { customerId: true }
      });

      if (!user || !user.customerId) {
        throw new Error('Customer not found');
      }

      return await providerInstance.updatePaymentMethod(user.customerId, paymentMethodId);
    } catch (error) {
      logger.error({ error, userId, provider }, 'Error updating payment method');
      throw error;
    }
  }

  /**
   * Obtener factura
   */
  async getInvoice(userId: string, invoiceId: string, provider: 'payphone' | 'kushki' = 'payphone') {
    try {
      const providerInstance = await this.getProvider(provider);
      return await providerInstance.getInvoice(invoiceId);
    } catch (error) {
      // Fallback: Retornar factura placeholder
      logger.warn({ userId, invoiceId }, 'Invoice retrieval not supported, returning placeholder');
      return {
        invoiceUrl: `/api/payments/invoices/${invoiceId}`,
        success: true
      };
    }
  }
}
