<template>
  <div class="kushki-card-form">
    <h2 class="text-h5 font-weight-bold mb-4">
      Pagar con Tarjeta
    </h2>

    <v-alert
      type="info"
      variant="tonal"
      density="comfortable"
      class="mb-6"
    >
      <template v-slot:prepend>
        <v-icon size="large">mdi-shield-check</v-icon>
      </template>
      <div>
        <h3 class="text-h6 mb-2">Pago seguro con Kushki</h3>
        <p class="text-body-2">
          Tus datos de tarjeta están protegidos con encriptación PCI DSS.
          No almacenamos información sensible.
        </p>
      </div>
    </v-alert>

    <!-- Card Form -->
    <v-form
      ref="formRef"
      v-model="formValid"
      @submit.prevent="handleSubmit"
    >
      <v-card variant="outlined" class="mb-6">
        <v-card-text>
          <!-- Card Number -->
          <v-text-field
            v-model="cardNumber"
            label="Número de tarjeta"
            placeholder="0000 0000 0000 0000"
            :rules="cardNumberRules"
            maxlength="19"
            prepend-inner-icon="mdi-credit-card"
            variant="outlined"
            class="mb-4"
            @update:model-value="formatCardNumber"
          />

          <v-row>
            <!-- Card Holder -->
            <v-col cols="12" md="6">
              <v-text-field
                v-model="cardHolderName"
                label="Nombre del titular"
                placeholder="JUAN PEREZ"
                :rules="cardHolderRules"
                maxlength="50"
                prepend-inner-icon="mdi-account"
                variant="outlined"
              />
            </v-col>

            <!-- Expiry Date -->
            <v-col cols="12" md="3">
              <v-text-field
                v-model="expiryMonth"
                label="Mes (MM)"
                placeholder="12"
                :rules="expiryMonthRules"
                maxlength="2"
                variant="outlined"
                @update:model-value="formatExpiryMonth"
              />
            </v-col>

            <v-col cols="12" md="3">
              <v-text-field
                v-model="expiryYear"
                label="Año (YY)"
                placeholder="25"
                :rules="expiryYearRules"
                maxlength="2"
                variant="outlined"
                @update:model-value="formatExpiryYear"
              />
            </v-col>
          </v-row>

          <!-- CVV -->
          <v-text-field
            v-model="cvv"
            label="CVV"
            placeholder="123"
            :rules="cvvRules"
            maxlength="4"
            type="password"
            prepend-inner-icon="mdi-lock"
            variant="outlined"
            class="mt-4"
            @update:model-value="formatCVV"
          />

          <!-- Installments -->
          <v-select
            v-model="installments"
            label="Cuotas"
            :items="installmentOptions"
            variant="outlined"
            class="mt-4"
          />
        </v-card-text>
      </v-card>

      <!-- Payment Summary -->
      <v-alert
        color="primary"
        variant="tonal"
        density="compact"
        class="mb-6"
      >
        <div class="d-flex justify-space-between align-center">
          <span>Monto a pagar:</span>
          <span class="text-h6 font-weight-bold">{{ amountFormatted }}</span>
        </div>
      </v-alert>

      <!-- Actions -->
      <div class="card-actions">
        <v-btn
          variant="text"
          @click="$emit('previous')"
          class="mr-2"
        >
          Atrás
        </v-btn>
        <v-btn
          color="primary"
          :loading="isProcessing"
          :disabled="!formValid"
          type="submit"
        >
          {{ isProcessing ? 'Procesando...' : `Pagar ${amountFormatted}` }}
        </v-btn>
      </div>
    </v-form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { apiClient } from '@/services/api';
import { useToast } from 'vue-toastification';

// Props
interface Props {
  cardToken: string | null;
  amount: number;
  isProcessing: boolean;
}

const props = defineProps<Props>();

// Emits
const emit = defineEmits<{
  'update:cardToken': [token: string | null];
  'paymentComplete': [success: boolean];
  'previous': [];
}>();

// State
const toast = useToast();
const formRef = ref();
const formValid = ref(false);

// Form fields
const cardNumber = ref('');
const cardHolderName = ref('');
const expiryMonth = ref('');
const expiryYear = ref('');
const cvv = ref('');
const installments = ref(1);

// Computed
const amountFormatted = computed(() => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(props.amount / 100);
});

const installmentOptions = computed(() => {
  const options = [];
  for (let i = 1; i <= 12; i++) {
    options.push({
      title: i === 1 ? 'Pago único' : `${i} cuotas`,
      value: i
    });
  }
  return options;
});

// Validation rules
const cardNumberRules = [
  (v: string) => !!v || 'Número de tarjeta requerido',
  (v: string) => v.replace(/\s/g, '').length === 16 || 'Número de tarjeta inválido'
];

const cardHolderRules = [
  (v: string) => !!v || 'Nombre del titular requerido',
  (v: string) => v.length >= 3 || 'Nombre muy corto'
];

const expiryMonthRules = [
  (v: string) => !!v || 'Mes requerido',
  (v: string) => parseInt(v) >= 1 && parseInt(v) <= 12 || 'Mes inválido'
];

const expiryYearRules = [
  (v: string) => !!v || 'Año requerido',
  (v: string) => parseInt(v) >= 24 && parseInt(v) <= 35 || 'Año inválido'
];

const cvvRules = [
  (v: string) => !!v || 'CVV requerido',
  (v: string) => v.length >= 3 && v.length <= 4 || 'CVV inválido'
];

// Methods
function formatCardNumber(value: string) {
  const v = value.replace(/\s/g, '').replace(/[^0-9]/g, '');
  const formatted = v.match(/.{1,4}/g)?.join(' ') || v;
  cardNumber.value = formatted;
}

function formatExpiryMonth(value: string) {
  const v = value.replace(/[^0-9]/g, '');
  expiryMonth.value = v;
}

function formatExpiryYear(value: string) {
  const v = value.replace(/[^0-9]/g, '');
  expiryYear.value = v;
}

function formatCVV(value: string) {
  const v = value.replace(/[^0-9]/g, '');
  cvv.value = v;
}

async function handleSubmit() {
  const valid = await formRef.value?.validate();
  if (!valid) return;

  try {
    emit('update:cardToken', null);

    // Tokenize card
    const tokenResponse = await apiClient.post('/payment/kushki/token', {
      cardNumber: cardNumber.value.replace(/\s/g, ''),
      cardHolderName: cardHolderName.value.toUpperCase(),
      expiryMonth: expiryMonth.value,
      expiryYear: expiryYear.value,
      cvv: cvv.value,
      installments: installments.value
    });

    if (!tokenResponse.success || !tokenResponse.data) {
      throw new Error(tokenResponse.error || 'Error al tokenizar tarjeta');
    }

    const token = (tokenResponse.data as any).token;
    emit('update:cardToken', token);

    // Charge with token
    const chargeResponse = await apiClient.post('/payment/kushki/charge', {
      amount: props.amount,
      currency: 'USD',
      token: token,
      description: 'Compra de plan',
      metadata: {
        installments: installments.value
      }
    });

    if (chargeResponse.success && chargeResponse.data) {
      toast.success('¡Pago aprobado!');
      emit('paymentComplete', true);
    } else {
      throw new Error(chargeResponse.error || 'Error al procesar pago');
    }
  } catch (error: any) {
    console.error('Kushki payment error:', error);
    toast.error(error.response?.data?.message || 'Error al procesar pago');
  }
}
</script>

<style scoped lang="scss">
.kushki-card-form {
  padding: 16px 0;
}

.card-actions {
  display: flex;
  justify-content: flex-end;
}
</style>
