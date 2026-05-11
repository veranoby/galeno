<!-- apps/web/src/components/payment/PayphoneQR.vue -->
<template>
  <div class="payphone-qr-container">
    <h2 class="section-title">Escanea el código QR</h2>
    <p class="section-subtitle">Completa tu pago escaneando con la app Payphone</p>

    <div class="qr-content">
      <!-- QR Code -->
      <div class="qr-code-wrapper">
        <div v-if="qrCodeUrl" class="qr-code">
          <img :src="qrCodeUrl" alt="Payphone QR Code" />
        </div>
        <div v-else class="qr-loading">
          <v-progress-circular indeterminate color="primary" size="64" />
          <p class="mt-4">Generando código QR...</p>
        </div>
      </div>

      <!-- Payment Info -->
      <div class="payment-info">
        <v-alert
          variant="tonal"
          density="compact"
          border="start"
          color="primary"
          class="mb-4"
        >
          <template v-slot:prepend>
            <v-icon size="small">mdi-information</v-icon>
          </template>
          <div>
            <strong>Instrucciones:</strong>
            <ol class="instructions-list">
              <li>Abre la app Payphone en tu celular</li>
              <li>Selecciona "Escanear QR"</li>
              <li>Apunta tu cámara al código QR</li>
              <li>Confirma el pago de <strong>{{ amountFormatted }}</strong></li>
            </ol>
          </div>
        </v-alert>

        <!-- Payment Details -->
        <div class="payment-details">
          <div class="detail-row">
            <span class="detail-label">Monto a pagar:</span>
            <span class="detail-amount">{{ amountFormatted }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Plan:</span>
            <span class="detail-value">{{ plan }}</span>
          </div>
          <div class="detail-row" v-if="transactionId">
            <span class="detail-label">Transacción:</span>
            <span class="detail-value mono">{{ transactionId }}</span>
          </div>
        </div>

        <!-- Timer -->
        <div class="qr-timer" v-if="timeRemaining > 0">
          <v-progress-circular
            :model-value="timerProgress"
            :rotate="-90"
            :size="120"
            :width="8"
            color="primary"
            class="timer-circle"
          >
            <div class="timer-text">
              <v-icon size="32">mdi-timer-outline</v-icon>
              <span class="timer-count">{{ formatTime(timeRemaining) }}</span>
            </div>
          </v-progress-circular>
          <p class="timer-message">El código QR expira en {{ formatTime(timeRemaining) }}</p>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="qr-actions">
      <v-btn
        variant="text"
        @click="$emit('previous')"
        :disabled="isProcessing"
      >
        Atrás
      </v-btn>
      
      <v-btn
        color="primary"
        variant="tonal"
        @click="refreshQR"
        :loading="isProcessing"
      >
        <v-icon start>mdi-refresh</v-icon>
        Regenerar QR
      </v-btn>

      <v-btn
        color="success"
        variant="elevated"
        @click="$emit('payment-complete')"
        :loading="isProcessing"
        :disabled="!qrCodeUrl"
      >
        <v-icon start>mdi-check-circle</v-icon>
        Ya realicé el pago
      </v-btn>
    </div>

    <!-- Status Polling -->
    <div class="status-polling" v-if="isPolling">
      <v-progress-linear indeterminate color="primary" />
      <p class="polling-text">Verificando tu pago...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useToast } from 'vue-toastification';

interface Props {
  qrCode?: string;
  amount: number;
  isProcessing?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isProcessing: false
});

const emit = defineEmits<{
  (e: 'payment-complete'): void;
  (e: 'previous'): void;
  (e: 'refresh'): void;
}>();

const toast = useToast();

const transactionId = ref<string>('');
const timeRemaining = ref<number>(900); // 15 minutos
const isPolling = ref(false);
let pollingInterval: NodeJS.Timeout | null = null;
let timerInterval: NodeJS.Timeout | null = null;

const qrCodeUrl = computed(() => props.qrCode);

const amountFormatted = computed(() => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(props.amount / 100);
});

const plan = computed(() => 'PREMIUM'); // TODO: From parent

const timerProgress = computed(() => {
  return (timeRemaining.value / 900) * 100;
});

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// Start polling for payment status
const startPolling = () => {
  isPolling.value = true;
  
  pollingInterval = setInterval(async () => {
    try {
      // TODO: Call API to check payment status
      // const response = await apiClient.get(`/payment/payphone/status/${transactionId.value}`);
      // if (response.data.status === 'approved') {
      //   handlePaymentComplete();
      // }
    } catch (error) {
      console.error('Error checking payment status:', error);
    }
  }, 5000); // Check every 5 seconds
};

// Timer countdown
const startTimer = () => {
  timerInterval = setInterval(() => {
    timeRemaining.value--;
    
    if (timeRemaining.value <= 0) {
      stopPolling();
      toast.warning('El código QR ha expirado. Por favor regenera el código.');
    }
  }, 1000);
};

const stopPolling = () => {
  isPolling.value = false;
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
};

const refreshQR = () => {
  timeRemaining.value = 900;
  emit('refresh');
  startTimer();
};

const handlePaymentComplete = () => {
  stopPolling();
  toast.success('¡Pago confirmado exitosamente!');
  emit('payment-complete');
};

// Lifecycle
onMounted(() => {
  startTimer();
  startPolling();
});

onUnmounted(() => {
  stopPolling();
});

// Expose methods
defineExpose({
  handlePaymentComplete
});
</script>

<style scoped>
.payphone-qr-container {
  max-width: 800px;
  margin: 0 auto;
}

.section-title {
  text-align: center;
  font-size: 1.75rem;
  font-weight: 700;
  margin-bottom: 8px;
  color: #1a1a2e;
}

.section-subtitle {
  text-align: center;
  color: #666;
  margin-bottom: 32px;
}

.qr-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 32px;
  margin-bottom: 32px;
}

.qr-code-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  padding: 32px;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.qr-code {
  width: 100%;
  max-width: 280px;
}

.qr-code img {
  width: 100%;
  height: auto;
}

.qr-loading {
  text-align: center;
}

.payment-info {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.instructions-list {
  margin: 12px 0 0 20px;
  padding: 0;
}

.instructions-list li {
  margin-bottom: 8px;
  color: #666;
}

.payment-details {
  background: #f8fafc;
  padding: 16px;
  border-radius: 8px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #e2e8f0;
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-label {
  color: #666;
  font-size: 0.875rem;
}

.detail-amount {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1a1a2e;
}

.detail-value {
  color: #1a1a2e;
  font-weight: 500;
}

.detail-value.mono {
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
}

.qr-timer {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px;
  background: #f8fafc;
  border-radius: 12px;
}

.timer-circle {
  margin-bottom: 16px;
}

.timer-text {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.timer-count {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1a1a2e;
}

.timer-message {
  color: #666;
  font-size: 0.875rem;
}

.qr-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.status-polling {
  margin-top: 24px;
  text-align: center;
}

.polling-text {
  margin-top: 8px;
  color: #666;
  font-size: 0.875rem;
}

/* Responsive */
@media (max-width: 768px) {
  .qr-content {
    grid-template-columns: 1fr;
  }

  .qr-actions {
    flex-direction: column;
  }

  .qr-actions .v-btn {
    width: 100%;
  }
}
</style>
