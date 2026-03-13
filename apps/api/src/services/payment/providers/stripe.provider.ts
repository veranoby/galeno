import Stripe from 'stripe';
import {
  PaymentProvider,
  CustomerData,
  CustomerResult,
  SubscriptionData,
  SubscriptionResult,
  CancelResult,
  UpdateResult,
  InvoiceResult
} from '../index';
import { logger } from '../../../utils/logger';

export class StripeProvider implements PaymentProvider {
  private stripe: Stripe;

  constructor() {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }
    
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-01-27' as any, // Usar versión reciente de Stripe API
    });
  }

  async createCustomer(data: CustomerData): Promise<CustomerResult> {
    try {
      const customer = await this.stripe.customers.create({
        email: data.email, 
        name: data.name, 
        phone: data.phone, 
        address: data.address ? {
          line1: data.address.line1, 
          line2: data.address.line2, 
          city: data.address.city, 
          state: data.address.state, 
          postal_code: data.address.postal_code, 
          country: data.address.country, 
        } : undefined, 
      });

      return {
        customerId: customer.id,
        success: true,
      };
    } catch (error) {
      logger.error({ error,  email: data.email },  'Error creating Stripe customer');
      return {
        customerId: '',
        success: false,
        error: (error as Error).message,
      };
    }
  }

  async createSubscription(data: SubscriptionData): Promise<SubscriptionResult> {
    try {
      // First, we need to create a price for the plan
      // In a real implementation, we would have predefined prices for each plan
      // For now, we'll create a dynamic price
      const price = await this.createPriceForPlan(data.plan);

      if (!price) {
        return {
          subscriptionId: '',
          success: false,
          error: 'Could not create price for plan',
        };
      }

      const subscription = await this.stripe.subscriptions.create({
        customer: data.customerId, 
        items: [{ price: price.id }], 
        trial_period_days: data.trialPeriodDays, 
        payment_behavior: 'default_incomplete', 
        expand: ['latest_invoice.payment_intent'], 
      });

      return {
        subscriptionId: subscription.id,
        invoiceId: (subscription.latest_invoice as any)?.id || '',
        success: true,
      };
    } catch (error) {
      logger.error({ 
        error,  
        customerId: data.customerId,  
        plan: data.plan 
      },  'Error creating Stripe subscription');
      return {
        subscriptionId: '',
        success: false,
        error: (error as Error).message,
      };
    }
  }

  private async createPriceForPlan(plan: string): Promise<Stripe.Price | null> {
    // In a real implementation, you would have predefined prices
    // For demo purposes, we'll create a price dynamically
    try {
      // Map plan to price (these would be configured in your system)
      const planPrices: Record<string, number> = {
        'FREE': 0,
        'PREMIUM': 2990, // $29.90 in cents
        'CLINICA_SME': 9990, // $99.90 in cents
      };

      const amount = planPrices[plan];
      if (amount === undefined) {
        return null;
      }

      // Check if price already exists for this plan
      const existingPrices = await this.stripe.prices.list({
        lookup_keys: [`plan_${plan.toLowerCase()}_monthly`],
      });

      if (existingPrices.data.length > 0) {
        return existingPrices.data[0];
      }

      // Create a new price
      const price = await this.stripe.prices.create({
        unit_amount: amount, 
        currency: 'usd', 
        recurring: {
          interval: 'month', 
        }, 
        lookup_key: `plan_${plan.toLowerCase()}_monthly`,
        nickname: `${plan} Monthly`,
      });

      return price;
    } catch (error) {
      logger.error({ error,  plan },  'Error creating Stripe price for plan');
      return null;
    }
  }

  async cancelSubscription(subscriptionId: string): Promise<CancelResult> {
    try {
      await this.stripe.subscriptions.cancel(subscriptionId);

      return {
        success: true,
      };
    } catch (error) {
      logger.error({ error, subscriptionId },  'Error cancelling Stripe subscription');
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  async updatePaymentMethod(customerId: string,  paymentMethodId: string): Promise<UpdateResult> {
    try {
      // Attach payment method to customer
      await this.stripe.paymentMethods.attach(paymentMethodId,  {
        customer: customerId, 
      });

      // Set as default payment method
      await this.stripe.customers.update(customerId,  {
        invoice_settings: {
          default_payment_method: paymentMethodId, 
        }, 
      });

      return {
        success: true,
      };
    } catch (error) {
      logger.error({ 
        error,  
        customerId,  
        paymentMethodId 
      },  'Error updating Stripe payment method');
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  async getInvoice(invoiceId: string): Promise<InvoiceResult> {
    try {
      const invoice = await this.stripe.invoices.retrieve(invoiceId);

      return {
        invoiceUrl: invoice.hosted_invoice_url || '',
        success: true,
      };
    } catch (error) {
      logger.error({ error,  invoiceId },  'Error retrieving Stripe invoice');
      return {
        invoiceUrl: '',
        success: false,
        error: (error as Error).message,
      };
    }
  }
}