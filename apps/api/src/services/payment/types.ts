/**
 * Payment Service Types
 * 
 * Tipos para el servicio de pagos y suscripciones
 */

import { Plan } from '@prisma/client';

/**
 * Payment provider interface
 */
export interface PaymentProvider {
  createCustomer(data: CustomerData): Promise<CustomerResult>;
  createSubscription(data: SubscriptionData): Promise<SubscriptionResult>;
  cancelSubscription(subscriptionId: string): Promise<CancelResult>;
  updatePaymentMethod(customerId: string, paymentMethodId: string): Promise<UpdateResult>;
  getInvoice(invoiceId: string): Promise<InvoiceResult>;
}

/**
 * Customer data for payment provider
 */
export interface CustomerData {
  email: string;
  name: string;
  phone?: string;
  address?: Address;
}

/**
 * Address information
 */
export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

/**
 * Subscription creation data
 */
export interface SubscriptionData {
  customerId: string;
  plan: Plan;
  paymentMethodId: string;
  trialPeriodDays?: number;
}

/**
 * Customer creation result
 */
export interface CustomerResult {
  customerId: string;
  success: boolean;
  error?: string;
}

/**
 * Subscription creation result
 */
export interface SubscriptionResult {
  subscriptionId: string;
  invoiceId?: string;
  success: boolean;
  error?: string;
}

/**
 * Subscription cancellation result
 */
export interface CancelResult {
  success: boolean;
  error?: string;
}

/**
 * Payment method update result
 */
export interface UpdateResult {
  success: boolean;
  error?: string;
}

/**
 * Invoice retrieval result
 */
export interface InvoiceResult {
  invoiceUrl: string;
  success: boolean;
  error?: string;
}
