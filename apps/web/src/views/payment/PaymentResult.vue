<template>
  <v-container class="payment-result-container" max-width="600">
    <v-card class="text-center" variant="outlined">
      <v-card-text class="pt-12">
        <!-- Success -->
        <div v-if="status === 'success'">
          <v-icon icon="mdi-check-circle" size="128" color="success" class="mb-4" />
          <h1 class="text-h4 font-weight-bold mb-2">¡Pago Exitoso!</h1>
          <p class="text-body-1 text-medium-emphasis mb-4">
            Tu suscripción ha sido activada correctamente.
          </p>
          <v-alert type="success" variant="tonal" class="mb-4">
            <div class="text-body-2">
              <strong>Transacción:</strong> {{ transactionId }}<br />
              <strong>Plan:</strong> {{ plan }}<br />
              <strong>Monto:</strong> {{ amount }}
            </div>
          </v-alert>
        </div>

        <!-- Cancelled -->
        <div v-else-if="status === 'cancelled'">
          <v-icon icon="mdi-cancel" size="128" color="warning" class="mb-4" />
          <h1 class="text-h4 font-weight-bold mb-2">Pago Cancelado</h1>
          <p class="text-body-1 text-medium-emphasis mb-4">
            La transacción fue cancelada. Puedes intentar nuevamente cuando lo desees.
          </p>
        </div>

        <!-- Error -->
        <div v-else-if="status === 'error'">
          <v-icon icon="mdi-alert-circle" size="128" color="error" class="mb-4" />
          <h1 class="text-h4 font-weight-bold mb-2">Error en el Pago</h1>
          <p class="text-body-1 text-medium-emphasis mb-4">
            {{ errorMessage || 'Ocurrió un error al procesar tu pago.' }}
          </p>
        </div>

        <!-- Pending -->
        <div v-else-if="status === 'pending'">
          <v-progress-circular indeterminate size="64" color="primary" class="mb-4" />
          <h1 class="text-h4 font-weight-bold mb-2">Procesando Pago</h1>
          <p class="text-body-1 text-medium-emphasis mb-4">
            Estamos verificando tu pago. Esto puede tomar unos minutos.
          </p>
        </div>
      </v-card-text>

      <v-card-actions class="justify-center pb-12">
        <v-btn
          v-if="status === 'pending'"
          color="primary"
          variant="outlined"
          @click="refreshStatus"
        >
          Verificar Estado
        </v-btn>
        <v-btn
          color="primary"
          @click="goToDashboard"
        >
          Ir al Dashboard
        </v-btn>
        <v-btn
          v-if="status === 'cancelled' || status === 'error'"
          color="secondary"
          variant="outlined"
          @click="retryPayment"
        >
          Intentar Nuevamente
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/api';

const route = useRoute();
const router = useRouter();

// Estado
const status = ref<'success' | 'cancelled' | 'error' | 'pending'>('pending');
const transactionId = ref('');
const plan = ref('');
const amount = ref('');
const errorMessage = ref('');

// Computed para obtener parámetros de la URL
const sessionId = computed(() => route.query.session_id as string);
const paymentId = computed(() => route.query.payment_id as string);
const token = computed(() => route.query.token as string);

onMounted(() => {
  // Determinar estado basado en parámetros
  if (route.query.cancelled === 'true') {
    status.value = 'cancelled';
  } else if (route.query.error) {
    status.value = 'error';
    errorMessage.value = route.query.error as string;
  } else if (route.query.success === 'true' || paymentId.value) {
    status.value = 'pending';
    verifyPayment();
  }
});

// Verificar estado del pago
async function verifyPayment() {
  if (!sessionId.value && !paymentId.value) {
    status.value = 'error';
    errorMessage.value = 'No se encontró información de la transacción';
    return;
  }

  try {
    // Determinar gateway (podría venir de la URL o localStorage)
    const gateway = (route.query.gateway as string) || 'payphone';
    const txId = paymentId.value || sessionId.value;

    const response = await api.get(`/api/v1/payments/${gateway}/verify/${txId}`);
    const paymentData = response.data.data;

    transactionId.value = paymentData.transactionId;
    plan.value = paymentData.metadata?.plan || 'PREMIUM';
    amount.value = paymentData.amount 
      ? `$${(paymentData.amount / 100).toFixed(2)}` 
      : '$10.00';

    if (paymentData.status === 'approved') {
      status.value = 'success';
    } else if (paymentData.status === 'rejected') {
      status.value = 'error';
      errorMessage.value = 'El pago fue rechazado';
    } else {
      status.value = 'pending';
    }
  } catch (err) {
    console.error('Error verifying payment:', err);
    // Asumir éxito si hay token de PayPal
    if (token.value) {
      status.value = 'success';
      transactionId.value = token.value;
    } else {
      status.value = 'error';
      errorMessage.value = 'No se pudo verificar el estado del pago';
    }
  }
}

// Refrescar estado
function refreshStatus() {
  verifyPayment();
}

// Ir al dashboard
function goToDashboard() {
  router.push('/dashboard');
}

// Reintentar pago
function retryPayment() {
  router.push('/checkout');
}
</script>

<style scoped lang="scss">
.payment-result-container {
  padding: 24px;
}
</style>
