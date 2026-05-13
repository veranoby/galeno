<template>
  <v-container class="checkout-container" max-width="900">
    <!-- Header -->
    <div class="checkout-header text-center mb-6">
      <v-icon icon="mdi-lock-outline" size="large" color="primary" class="mb-2" />
      <h1 class="text-h4 font-weight-bold mb-2">
        Completar Suscripción
      </h1>
      <p class="text-medium-emphasis">
        {{ geoInfo.country === 'EC' ? 'Pago seguro con PayPhone (Ecuador)' : 'Pago internacional con PayPal' }}
      </p>
    </div>

    <!-- Loading Geo-IP -->
    <v-alert
      v-if="loadingGeo"
      type="info"
      variant="tonal"
      class="mb-4"
    >
      <v-progress-circular indeterminate size="20" class="mr-2" />
      Detectando ubicación para mostrar método de pago...
    </v-alert>

    <!-- Error Alert -->
    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      class="mb-4"
      closable
      @click:close="error = null"
    >
      {{ error }}
    </v-alert>

    <!-- Plan Selection -->
    <v-card class="mb-6" variant="outlined">
      <v-card-title class="text-h6 font-weight-bold">
        1. Selecciona tu Plan
      </v-card-title>
      <v-card-text>
        <v-row>
          <v-col cols="12" md="4">
            <v-card
              :color="selectedPlan === 'FREE' ? 'primary' : undefined"
              variant="outlined"
              class="plan-card"
              :class="{ 'selected-plan': selectedPlan === 'FREE' }"
              @click="selectedPlan = 'FREE'"
            >
              <v-card-title class="text-center">
                <v-icon icon="mdi-account-check" class="mr-2" />FREE
              </v-card-title>
              <v-card-text class="text-center">
                <div class="text-h3 font-weight-bold">$0</div>
                <div class="text-caption text-medium-emphasis">/mes</div>
                <v-divider class="my-2" />
                <ul class="plan-features">
                  <li><v-icon icon="mdi-check" size="small" color="success" /> 1 Doctor</li>
                  <li><v-icon icon="mdi-check" size="small" color="success" /> Historias clínicas</li>
                  <li><v-icon icon="mdi-check" size="small" color="success" /> Recetas digitales</li>
                </ul>
              </v-card-text>
            </v-card>
          </v-col>

          <v-col cols="12" md="4">
            <v-card
              :color="selectedPlan === 'PREMIUM' ? 'primary' : undefined"
              variant="outlined"
              class="plan-card"
              :class="{ 'selected-plan': selectedPlan === 'PREMIUM' }"
              @click="selectedPlan = 'PREMIUM'"
            >
              <v-chip color="secondary" size="small" class="plan-badge">
                MÁS POPULAR
              </v-chip>
              <v-card-title class="text-center">
                <v-icon icon="mdi-star" class="mr-2" />PREMIUM
              </v-card-title>
              <v-card-text class="text-center">
                <div class="text-h3 font-weight-bold">$10</div>
                <div class="text-caption text-medium-emphasis">/mes</div>
                <v-divider class="my-2" />
                <ul class="plan-features">
                  <li><v-icon icon="mdi-check" size="small" color="success" /> 5 Doctores</li>
                  <li><v-icon icon="mdi-check" size="small" color="success" /> 2 Asistentes</li>
                  <li><v-icon icon="mdi-check" size="small" color="success" /> Teleconsultas</li>
                  <li><v-icon icon="mdi-check" size="small" color="success" /> IA Asistente</li>
                </ul>
              </v-card-text>
            </v-card>
          </v-col>

          <v-col cols="12" md="4">
            <v-card
              :color="selectedPlan === 'CLINICA_SME' ? 'primary' : undefined"
              variant="outlined"
              class="plan-card"
              :class="{ 'selected-plan': selectedPlan === 'CLINICA_SME' }"
              @click="selectedPlan = 'CLINICA_SME'"
            >
              <v-card-title class="text-center">
                <v-icon icon="mdi-hospital" class="mr-2" />CLÍNICA
              </v-card-title>
              <v-card-text class="text-center">
                <div class="text-h3 font-weight-bold">$45</div>
                <div class="text-caption text-medium-emphasis">/mes</div>
                <v-divider class="my-2" />
                <ul class="plan-features">
                  <li><v-icon icon="mdi-check" size="small" color="success" /> 10 Doctores</li>
                  <li><v-icon icon="mdi-check" size="small" color="success" /> 5 Asistentes</li>
                  <li><v-icon icon="mdi-check" size="small" color="success" /> Multi-sede</li>
                  <li><v-icon icon="mdi-check" size="small" color="success" /> Soporte prioritario</li>
                </ul>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- Payment Method Info -->
    <v-card class="mb-6" variant="outlined" v-if="!loadingGeo">
      <v-card-title class="text-h6 font-weight-bold d-flex align-center">
        <v-icon icon="mdi-credit-card" class="mr-2" />
        2. Método de Pago
        <v-chip :color="geoInfo.country === 'EC' ? 'success' : 'info'" size="small" class="ml-auto">
          <v-icon icon="mdi-map-marker" start size="x-small" />
          {{ geoInfo.country === 'EC' ? 'Ecuador' : 'Internacional' }}
        </v-chip>
      </v-card-title>
      <v-card-text>
        <v-alert
          :type="geoInfo.country === 'EC' ? 'success' : 'info'"
          variant="tonal"
          class="mb-4"
        >
          <div class="d-flex align-center">
            <v-icon
              :icon="geoInfo.country === 'EC' ? 'mdi-qrcode' : 'mdi-paypal'"
              size="large"
              class="mr-3"
            />
            <div>
              <div class="text-weight-bold">
                {{ geoInfo.country === 'EC' ? 'PayPhone - Pago con QR' : 'PayPal - Suscripción Internacional' }}
              </div>
              <div class="text-caption">
                {{ geoInfo.country === 'EC' 
                  ? 'Escanea el código QR con tu app bancaria para pagar' 
                  : 'Serás redirigido a PayPal para completar tu suscripción' 
                }}
              </div>
            </div>
          </div>
        </v-alert>

        <!-- Tax Info -->
        <v-alert type="info" variant="tonal" density="compact">
          <v-icon icon="mdi-information" start />
          {{ geoInfo.country === 'EC' 
            ? 'Precio incluye IVA (15%)' 
            : 'Precio sin impuestos (exportación de servicios)' 
          }}
        </v-alert>
      </v-card-text>
    </v-card>

    <!-- Payment Processing -->
    <v-card v-if="paymentUrl || qrCodeUrl" class="mb-6" variant="outlined">
      <v-card-title class="text-h6 font-weight-bold">
        3. Completar Pago
      </v-card-title>
      <v-card-text class="text-center">
        <!-- QR Code para PayPhone -->
        <div v-if="qrCodeUrl" class="qr-container">
          <v-img :src="qrCodeUrl" max-width="250" class="mx-auto mb-3" />
          <p class="text-body-2 mb-2">
            <v-icon icon="mdi-qrcode-scan" start />
            Escanea con tu app bancaria
          </p>
          <v-btn color="primary" :loading="isProcessing" @click="verifyPayment">
            Verificar Pago
          </v-btn>
        </div>

        <!-- Redirect a PayPal -->
        <div v-else-if="paymentUrl" class="paypal-container">
          <v-progress-circular indeterminate color="primary" size="64" class="mb-3" />
          <p class="text-body-1 mb-4">
            Redirigiendo a PayPal...
          </p>
          <v-btn color="primary" :href="paymentUrl" target="_blank">
            <v-icon icon="mdi-open-in-new" start />
            Ir a PayPal
          </v-btn>
        </div>
      </v-card-text>
    </v-card>

    <!-- Actions -->
    <div class="checkout-actions">
      <v-btn
        variant="text"
        :disabled="isProcessing"
        @click="handleCancel"
      >
        Cancelar
      </v-btn>
      <v-spacer />
      <v-btn
        color="primary"
        :disabled="!selectedPlan || isProcessing || loadingGeo"
        :loading="isProcessing"
        @click="processPayment"
      >
        {{ paymentUrl || qrCodeUrl ? 'Verificar' : 'Suscribirse Ahora' }}
      </v-btn>
    </div>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import { apiClient as api } from '@/services/api';

type PlanType = 'FREE' | 'PREMIUM' | 'CLINICA_SME';

const router = useRouter();
const snackbar = useToast();

// Estado
const loadingGeo = ref(true);
const isProcessing = ref(false);
const selectedPlan = ref<PlanType>('PREMIUM');
const error = ref<string | null>(null);

// Geo-IP info
const geoInfo = ref({
  country: 'EC',
  detected: false
});

// Payment response
const paymentUrl = ref<string | null>(null);
const qrCodeUrl = ref<string | null>(null);
const transactionId = ref<string | null>(null);

// Plan prices
const planPrices: Record<PlanType, number> = {
  FREE: 0,
  PREMIUM: 1000, // $10 en centavos
  CLINICA_SME: 4500 // $45 en centavos
};

// Amount calculado
const amount = computed(() => planPrices[selectedPlan.value]);

// Detectar Geo-IP al montar
onMounted(async () => {
  try {
    const response = await api.get('/api/v1/payments/strategies');
    const data = response.data.data;
    
    geoInfo.value = {
      country: data.detectedCountry || 'EC',
      detected: true
    };
  } catch (err) {
    console.error('Error detecting Geo-IP:', err);
    geoInfo.value = { country: 'EC', detected: false };
  } finally {
    loadingGeo.value = false;
  }
});

// Procesar pago
async function processPayment() {
  if (!selectedPlan.value) {
    error.value = 'Selecciona un plan';
    return;
  }

  isProcessing.value = true;
  error.value = null;

  try {
    const isEcuador = geoInfo.value.country === 'EC';
    
    if (selectedPlan.value === 'FREE') {
      // Plan gratuito - activar inmediatamente
      await activateFreePlan();
      return;
    }

    if (isEcuador) {
      // PayPhone (QR)
      const response = await api.post('/api/v1/payments/payphone/init', {
        amount: amount.value,
        tax: Math.round(amount.value * 0.15), // 15% IVA
        currency: 'USD',
        description: `Suscripción ${selectedPlan.value}`
      });

      transactionId.value = response.data.data.transactionId;
      qrCodeUrl.value = response.data.data.qrCode;
      
      snackbar.show({
        message: 'Escanea el QR para pagar',
        type: 'info'
      });
    } else {
      // PayPal (Internacional)
      const response = await api.post('/api/v1/payments/paypal/subscription', {
        amount: amount.value,
        currency: 'USD',
        description: `Suscripción ${selectedPlan.value}`,
        planId: selectedPlan.value === 'PREMIUM' ? 'premium-monthly' : 'clinica-monthly'
      });

      transactionId.value = response.data.data.transactionId;
      paymentUrl.value = response.data.data.approvalUrl;
      
      // Abrir PayPal en nueva ventana
      if (paymentUrl.value) {
        window.open(paymentUrl.value, '_blank');
      }
      
      snackbar.show({
        message: 'Completa tu pago en PayPal',
        type: 'info'
      });
    }
  } catch (err: any) {
    console.error('Payment error:', err);
    error.value = err.response?.data?.message || 'Error al procesar el pago';
    snackbar.show({
      message: error.value,
      type: 'error'
    });
  } finally {
    isProcessing.value = false;
  }
}

// Verificar pago (PayPhone)
async function verifyPayment() {
  if (!transactionId.value) return;

  isProcessing.value = true;

  try {
    const response = await api.get(`/api/v1/payments/payphone/verify/${transactionId.value}`);
    const status = response.data.data.status;

    if (status === 'approved') {
      await handleSuccess();
    } else if (status === 'rejected') {
      error.value = 'El pago fue rechazado';
      snackbar.show({ message: error.value, type: 'error' });
    } else {
      snackbar.show({
        message: 'El pago está pendiente. Escanea el QR.',
        type: 'info'
      });
    }
  } catch (err: any) {
    console.error('Verify error:', err);
    error.value = 'Error al verificar el pago';
  } finally {
    isProcessing.value = false;
  }
}

// Activar plan gratuito
async function activateFreePlan() {
  isProcessing.value = true;
  
  try {
    // Aquí iría la llamada al endpoint de activación
    await api.post('/api/v1/subscriptions/activate', {
      plan: 'FREE'
    });
    
    await handleSuccess();
  } catch (err: any) {
    console.error('Free plan activation error:', err);
    error.value = 'Error al activar plan gratuito';
  } finally {
    isProcessing.value = false;
  }
}

// Manejar éxito
async function handleSuccess() {
  snackbar.show({
    message: '¡Suscripción activada exitosamente!',
    type: 'success'
  });

  // Redirigir a dashboard
  setTimeout(() => {
    router.push('/dashboard?subscription=success');
  }, 2000);
}

// Cancelar
function handleCancel() {
  router.push('/dashboard');
}
</script>

<style scoped lang="scss">
.checkout-container {
  padding: 24px;
  max-width: 900px;
}

.checkout-header {
  padding-top: 16px;
}

.plan-card {
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.12);
  }
  
  &.selected-plan {
    border-color: rgb(var(--v-theme-primary));
    border-width: 2px;
  }
}

.plan-badge {
  position: absolute;
  top: 8px;
  right: 8px;
}

.plan-features {
  list-style: none;
  padding: 0;
  margin: 0;
  text-align: left;
  
  li {
    padding: 4px 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }
}

.qr-container,
.paypal-container {
  padding: 24px;
  text-align: center;
}

.checkout-actions {
  display: flex;
  gap: 12px;
  padding: 24px 0;
  border-top: 1px solid rgba(0, 0, 0, 0.12);
  margin-top: 24px;
}
</style>
