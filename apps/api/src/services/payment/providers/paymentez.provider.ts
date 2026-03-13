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

export class PaymentezProvider implements PaymentProvider {
  private baseUrl: string;
  private clientToken: string;
  private appCode: string;

  constructor() {
    if (!process.env.PAYMENTEZ_CLIENT_TOKEN || !process.env.PAYMENTEZ_APP_CODE) {
      throw new Error('PAYMENTEZ_CLIENT_TOKEN and PAYMENTEZ_APP_CODE environment variables are required');
    }
    
    this.clientToken = process.env.PAYMENTEZ_CLIENT_TOKEN;
    this.appCode = process.env.PAYMENTEZ_APP_CODE;
    this.baseUrl = process.env.PAYMENTEZ_API_URL || 'https://api.paymentez.com/v2';
  }

  async createCustomer(data: CustomerData): Promise<CustomerResult> {
    try {
      // Paymentez customer creation
      const response = await fetch(`${this.baseUrl}/user/create/`,  {
        method: 'POST', 
        headers: {
          'Content-Type': 'application/json', 
          'Auth-Token': this.clientToken, 
        }, 
        body: JSON.stringify({
          id: data.email,  // Using email as user ID
          email: data.email, 
          first_name: data.name.split(' ')[0] || data.name,
          last_name: data.name.split(' ').slice(1).join(' ') || 'N/A',
          phone_number: data.phone || '',
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Paymentez API error: ${error}`);
      }

      const result = await response.json();
      
      return {
        customerId: result.user.id,
        success: true,
      };
    } catch (error) {
      logger.error({ error,  email: data.email },  'Error creating Paymentez customer');
      return {
        customerId: '',
        success: false,
        error: (error as Error).message,
      };
    }
  }

  async createSubscription(data: SubscriptionData): Promise<SubscriptionResult> {
    try {
      // In Paymentez, subscriptions are handled differently
      // This is a simplified implementation
      const response = await fetch(`${this.baseUrl}/card/add/`,  {
        method: 'POST', 
        headers: {
          'Content-Type': 'application/json', 
          'Auth-Token': this.clientToken, 
        }, 
        body: JSON.stringify({
          user_id: data.customerId, 
          card_data: {
            token: data.paymentMethodId,  // Assuming paymentMethodId is a token
          }, 
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Paymentez API error: ${error}`);
      }

      const result = await response.json();
      
      // For now, return a simulated subscription ID
      // In reality, Paymentez handles recurring payments differently
      return {
        subscriptionId: `sub_${Date.now()}`, // Placeholder
        success: true,
      };
    } catch (error) {
      logger.error({ 
        error,  
        customerId: data.customerId,  
        plan: data.plan 
      },  'Error creating Paymentez subscription');
      return {
        subscriptionId: '',
        success: false,
        error: (error as Error).message,
      };
    }
  }

  async cancelSubscription(subscriptionId: string): Promise<CancelResult> {
    try {
      // Paymentez doesn't have a direct subscription cancellation
      // We would need to remove the card or handle it differently
      // This is a placeholder implementation
      
      // In a real implementation, you would need to handle this differently
      // based on Paymentez's actual API capabilities
      
      return {
        success: true,
      };
    } catch (error) {
      logger.error({ error,  subscriptionId },  'Error cancelling Paymentez subscription');
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  async updatePaymentMethod(customerId: string,  paymentMethodId: string): Promise<UpdateResult> {
    try {
      // Add new payment method for user
      const response = await fetch(`${this.baseUrl}/card/add/`,  {
        method: 'POST', 
        headers: {
          'Content-Type': 'application/json', 
          'Auth-Token': this.clientToken, 
        }, 
        body: JSON.stringify({
          user_id: customerId, 
          card_data: {
            token: paymentMethodId, 
          }, 
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Paymentez API error: ${error}`);
      }

      return {
        success: true,
      };
    } catch (error) {
      logger.error({ 
        error,  
        customerId,  
        paymentMethodId 
      },  'Error updating Paymentez payment method');
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  async getInvoice(invoiceId: string): Promise<InvoiceResult> {
    try {
      // Paymentez doesn't directly provide invoices in the same way as Stripe
      // This would need to be handled differently
      
      return {
        invoiceUrl: `/invoices/${invoiceId}`, // Placeholder
        success: true,
      };
    } catch (error) {
      logger.error({ error,  invoiceId },  'Error retrieving Paymentez invoice');
      return {
        invoiceUrl: '',
        success: false,
        error: (error as Error).message,
      };
    }
  }
}