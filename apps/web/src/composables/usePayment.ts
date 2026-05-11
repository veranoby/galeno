/**
 * Composable para gestión de pagos
 * 
 * Proporciona métodos para crear pagos, verificar estado,
 * y manejar la UI del checkout.
 */

import { ref, computed, onUnmounted } from 'vue';
import { apiClient } from '@/services/api';
import { useToast } from 'vue-toastification';

/**
 * Métodos de pago disponibles
 */
export type PaymentMethod = 'payphone' | 'kushki';

/**
 * Planes disponibles
 */
export type PlanType = 'FREE' | 'PREMIUM' | 'CLINICA_SME';

/**
 * Estado del pago
 */
export type PaymentStatus = 'pending' | 'approved' | 'rejected' | 'processing';

/**
 * Datos de tarjeta para Kushki
 */
export interface CardData {
  cardNumber: string;
  cardHolderName: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  installments?: number;
}

/**
 * Resultado de creación de pago
 */
export interface PaymentResult {
  transactionId: string;
  qrCode?: string;
  hostedUrl?: string;
  status: PaymentStatus;
}

/**
 * Respuesta de API de pago
 */
interface PaymentResponse {
  success: boolean;
  data?: PaymentResult;
  error?: string;
}

/**
 * Composable usePayment
 */
export function usePayment() {
  const toast = useToast();

  // Estado reactivo
  const currentStep = ref<number>(1);
  const selectedPlan = ref<PlanType>('PREMIUM');
  const paymentMethod = ref<PaymentMethod>('payphone');
  const paymentStatus = ref<PaymentStatus>('pending');
  const isProcessing = ref(false);
  const qrCodeUrl = ref<string>('');
  const transactionId = ref<string>('');
  const cardToken = ref<string>('');

  // Montos (en centavos)
  const planAmounts: Record<PlanType, number> = {
    FREE: 0,
    PREMIUM: 2990, // $29.90
    CLINICA_SME: 9990 // $99.90
  };

  // Computed
  const amount = computed(() => planAmounts[selectedPlan.value]);
  
  const amountFormatted = computed(() => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount.value / 100);
  });

  const isPayphone = computed(() => paymentMethod.value === 'payphone');
  
  const isKushki = computed(() => paymentMethod.value === 'kushki');

  const canGoToNextStep = computed(() => {
    if (currentStep.value === 1) return true; // Plan selection siempre válida
    if (currentStep.value === 2) return !!paymentMethod.value;
    if (currentStep.value === 3) {
      if (isPayphone.value) return !!qrCodeUrl.value;
      if (isKushki.value) return !!cardToken.value;
    }
    return false;
  });

  const totalSteps = computed(() => 4);

  // Métodos

  /**
   * Avanzar al siguiente paso
   */
  function nextStep() {
    if (currentStep.value < totalSteps.value) {
      currentStep.value++;
    }
  }

  /**
   * Retroceder al paso anterior
   */
  function previousStep() {
    if (currentStep.value > 1) {
      currentStep.value--;
    }
  }

  /**
   * Ir a un paso específico
   */
  function goToStep(step: number) {
    if (step >= 1 && step <= totalSteps.value) {
      currentStep.value = step;
    }
  }

  /**
   * Seleccionar un plan
   */
  function selectPlan(plan: PlanType) {
    selectedPlan.value = plan;
  }

  /**
   * Seleccionar método de pago
   */
  function selectPaymentMethod(method: PaymentMethod) {
    paymentMethod.value = method;
  }

  /**
   * Crear pago con Payphone (QR)
   */
  async function createPayphonePayment(): Promise<PaymentResult | null> {
    try {
      isProcessing.value = true;

      const response = await apiClient.post<PaymentResponse>('/payment/payphone/create', {
        amount: amount.value,
        currency: 'USD',
        description: `Plan ${selectedPlan.value}`,
        metadata: {
          plan: selectedPlan.value
        }
      });

      if (response.success && response.data) {
        transactionId.value = response.data.transactionId;
        qrCodeUrl.value = response.data.qrCode;
        paymentStatus.value = response.data.status || 'pending';

        // Iniciar polling para verificar pago
        startPaymentPolling();

        return response.data;
      } else {
        throw new Error(response.error || 'Error al crear pago');
      }
    } catch (error: any) {
      console.error('Payphone payment error:', error);
      toast.error(error.response?.data?.message || 'Error al crear pago con Payphone');
      return null;
    } finally {
      isProcessing.value = false;
    }
  }

  /**
   * Tokenizar tarjeta con Kushki
   */
  async function tokenizeCard(cardData: CardData): Promise<boolean> {
    try {
      isProcessing.value = true;

      const response = await apiClient.post<PaymentResponse>('/payment/kushki/token', {
        cardNumber: cardData.cardNumber,
        cardHolderName: cardData.cardHolderName,
        expiryMonth: cardData.expiryMonth,
        expiryYear: cardData.expiryYear,
        cvv: cardData.cvv,
        installments: cardData.installments || 1
      });

      if (response.success && response.data) {
        cardToken.value = response.data.token;
        return true;
      } else {
        throw new Error(response.error || 'Error al tokenizar tarjeta');
      }
    } catch (error: any) {
      console.error('Kushki tokenization error:', error);
      toast.error(error.response?.data?.message || 'Error al tokenizar tarjeta');
      return false;
    } finally {
      isProcessing.value = false;
    }
  }

  /**
   * Crear pago con Kushki (card token)
   */
  async function createKushkiPayment(): Promise<PaymentResult | null> {
    try {
      isProcessing.value = true;

      const response = await apiClient.post('/payment/kushki/charge', {
        amount: amount.value,
        currency: 'USD',
        token: cardToken.value,
        description: `Plan ${selectedPlan.value}`,
        metadata: {
          plan: selectedPlan.value
        }
      });

      if (response.success && response.data) {
        transactionId.value = response.data.transactionId;
        paymentStatus.value = response.data.status;
        return response.data;
      } else {
        throw new Error(response.error || 'Error al crear pago');
      }
    } catch (error: any) {
      console.error('Kushki payment error:', error);
      toast.error(error.response?.data?.message || 'Error al crear pago con Kushki');
      return null;
    } finally {
      isProcessing.value = false;
    }
  }

  /**
   * Verificar estado del pago
   */
  async function verifyPayment(txId: string): Promise<PaymentStatus> {
    try {
      const gateway = isPayphone.value ? 'payphone' : 'kushki';
      const response = await apiClient.get(`/payment/${gateway}/verify/${txId}`);

      if (response.success && response.data) {
        return response.data.status;
      }
      return 'pending';
    } catch (error) {
      console.error('Payment verification error:', error);
      return 'pending';
    }
  }

  /**
   * Polling para verificar pago de Payphone
   */
  let pollingInterval: ReturnType<typeof setInterval> | null = null;

  function startPaymentPolling() {
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }

    pollingInterval = setInterval(async () => {
      if (!transactionId.value) return;

      const status = await verifyPayment(transactionId.value);
      paymentStatus.value = status;

      if (status === 'approved') {
        stopPaymentPolling();
        toast.success('¡Pago aprobado exitosamente!');
        nextStep(); // Ir a confirmación
      } else if (status === 'rejected') {
        stopPaymentPolling();
        toast.error('Pago rechazado');
      }
    }, 3000); // Verificar cada 3 segundos
  }

  function stopPaymentPolling() {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
  }

  /**
   * Procesar pago completo
   */
  async function processPayment(cardData?: CardData): Promise<boolean> {
    try {
      if (isPayphone.value) {
        const result = await createPayphonePayment();
        return !!result;
      } else if (isKushki.value && cardData) {
        // Primero tokenizar
        const tokenized = await tokenizeCard(cardData);
        if (!tokenized) return false;

        // Luego crear pago
        const result = await createKushkiPayment();
        return !!result;
      }
      return false;
    } catch (error) {
      console.error('Payment processing error:', error);
      return false;
    }
  }

  /**
   * Reiniciar estado del checkout
   */
  function resetCheckout() {
    currentStep.value = 1;
    selectedPlan.value = 'PREMIUM';
    paymentMethod.value = 'payphone';
    paymentStatus.value = 'pending';
    isProcessing.value = false;
    qrCodeUrl.value = '';
    transactionId.value = '';
    cardToken.value = '';
    stopPaymentPolling();
  }

  // Cleanup on unmount
  onUnmounted(() => {
    stopPaymentPolling();
  });

  return {
    // State
    currentStep,
    selectedPlan,
    paymentMethod,
    paymentStatus,
    isProcessing,
    qrCodeUrl,
    transactionId,
    cardToken,
    amount,
    amountFormatted,

    // Computed
    isPayphone,
    isKushki,
    canGoToNextStep,
    totalSteps,

    // Methods
    nextStep,
    previousStep,
    goToStep,
    selectPlan,
    selectPaymentMethod,
    processPayment,
    verifyPayment,
    resetCheckout
  };
}
