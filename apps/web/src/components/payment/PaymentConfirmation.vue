<!-- apps/web/src/components/payment/PaymentConfirmation.vue -->
<template>
  <div class="payment-confirmation-container">
    <!-- Success State -->
    <div v-if="status === 'approved'" class="confirmation-success">
      <div class="success-icon">
        <v-icon size="120" color="success">mdi-check-circle</v-icon>
      </div>

      <h2 class="confirmation-title">¡Pago Exitoso!</h2>
      <p class="confirmation-subtitle">Tu plan ha sido activado correctamente</p>

      <v-card class="summary-card mt-6" variant="outlined">
        <v-card-text>
          <div class="summary-row">
            <span class="summary-label">Monto pagado:</span>
            <span class="summary-amount">{{ amount }}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Plan contratado:</span>
            <span class="summary-value">{{ plan }}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Fecha de pago:</span>
            <span class="summary-value">{{ currentDate }}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Próxima facturación:</span>
            <span class="summary-value">{{ nextBillingDate }}</span>
          </div>
        </v-card-text>
      </v-card>

      <v-alert
        variant="tonal"
        density="compact"
        border="start"
        color="primary"
        class="mt-6"
      >
        <template v-slot:prepend>
          <v-icon size="small">mdi-email</v-icon>
        </template>
        Hemos enviado un comprobante a tu correo electrónico
      </v-alert>

      <div class="success-actions mt-8">
        <v-btn
          color="primary"
          size="large"
          @click="$emit('close')"
          block
        >
          Ir al Dashboard
        </v-btn>
      </div>
    </div>

    <!-- Pending State -->
    <div v-else-if="status === 'pending'" class="confirmation-pending">
      <div class="pending-icon">
        <v-progress-circular
          indeterminate
          color="primary"
          size="120"
          width="8"
        />
      </div>

      <h2 class="confirmation-title">Procesando Pago</h2>
      <p class="confirmation-subtitle">Estamos confirmando tu pago...</p>

      <p class="pending-message">
        Esto puede tomar unos minutos. Una vez confirmado, recibirás un correo electrónico.
      </p>
    </div>

    <!-- Rejected State -->
    <div v-else-if="status === 'rejected'" class="confirmation-rejected">
      <div class="rejected-icon">
        <v-icon size="120" color="error">mdi-alert-circle</v-icon>
      </div>

      <h2 class="confirmation-title">Pago Rechazado</h2>
      <p class="confirmation-subtitle">No pudimos procesar tu pago</p>

      <v-alert
        variant="outlined"
        density="compact"
        border="start"
        color="error"
        class="mt-6"
      >
        <strong>Posibles causas:</strong>
        <ul class="error-causes">
          <li>Saldo insuficiente</li>
          <li>Tarjeta expirada</li>
          <li>Límite excedido</li>
          <li>Error en los datos</li>
        </ul>
      </v-alert>

      <div class="rejected-actions mt-8">
        <v-btn
          color="primary"
          size="large"
          @click="$emit('retry')"
          block
          class="mb-4"
        >
          Intentar Nuevamente
        </v-btn>
        <v-btn
          variant="text"
          @click="$emit('close')"
        >
          Volver al inicio
        </v-btn>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { PlanType } from '@/composables/usePayment';

interface Props {
  status: 'pending' | 'approved' | 'rejected';
  amount: string;
  plan: PlanType;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'retry'): void;
}>();

const currentDate = computed(() => {
  return new Date().toLocaleDateString('es-EC', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

const nextBillingDate = computed(() => {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  return date.toLocaleDateString('es-EC', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});
</script>

<style scoped>
.payment-confirmation-container {
  max-width: 600px;
  margin: 0 auto;
  text-align: center;
}

.success-icon,
.pending-icon,
.rejected-icon {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 24px;
}

.confirmation-title {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 8px;
  color: #1a1a2e;
}

.confirmation-subtitle {
  font-size: 1.125rem;
  color: #666;
  margin-bottom: 24px;
}

.summary-card {
  text-align: left;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #e2e8f0;
}

.summary-row:last-child {
  border-bottom: none;
}

.summary-label {
  color: #666;
  font-size: 0.875rem;
}

.summary-amount {
  font-size: 1.5rem;
  font-weight: 700;
  color: #10b981;
}

.summary-value {
  color: #1a1a2e;
  font-weight: 500;
}

.pending-message {
  color: #666;
  font-size: 1rem;
  line-height: 1.6;
}

.error-causes {
  margin: 8px 0 0 20px;
  padding: 0;
}

.error-causes li {
  margin-bottom: 4px;
  color: #666;
}

.success-actions,
.rejected-actions {
  max-width: 400px;
  margin: 0 auto;
}

/* Animations */
.confirmation-success {
  animation: fadeIn 0.5s ease;
}

.confirmation-rejected {
  animation: shake 0.5s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-10px); }
  75% { transform: translateX(10px); }
}

/* Responsive */
@media (max-width: 768px) {
  .confirmation-title {
    font-size: 1.5rem;
  }

  .success-icon .v-icon,
  .rejected-icon .v-icon {
    font-size: 80px !important;
    width: 80px !important;
    height: 80px !important;
  }
}
</style>
