<!-- apps/web/src/components/payment/PaymentMethodSelection.vue -->
<template>
  <div class="payment-method-container">
    <h2 class="section-title">Método de Pago</h2>
    <p class="section-subtitle">Selecciona tu método de pago preferido</p>

    <div class="methods-grid">
      <!-- Payphone (QR) -->
      <v-card
        class="method-card"
        :class="{ 'selected': selectedMethod === 'payphone' }"
        variant="outlined"
        @click="selectMethod('payphone')"
      >
        <div class="method-icon">
          <v-icon size="64" color="#3b82f6">mdi-qrcode</v-icon>
        </div>
        
        <v-card-title class="method-title">
          Payphone
          <v-chip size="small" color="success" class="ml-2">Recomendado</v-chip>
        </v-card-title>
        
        <v-card-text>
          <p class="method-description">
            Escanea el código QR con tu app Payphone
          </p>
          <v-list density="compact">
            <v-list-item>
              <template v-slot:prepend>
                <v-icon size="small" color="success">mdi-check-circle</v-icon>
              </template>
              <v-list-item-title>Pago instantáneo</v-list-item-title>
            </v-list-item>
            <v-list-item>
              <template v-slot:prepend>
                <v-icon size="small" color="success">mdi-check-circle</v-icon>
              </template>
              <v-list-item-title>Sin comisiones adicionales</v-list-item-title>
            </v-list-item>
            <v-list-item>
              <template v-slot:prepend>
                <v-icon size="small" color="success">mdi-check-circle</v-icon>
              </template>
              <v-list-item-title>Disponible 24/7</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-card-text>
      </v-card>

      <!-- Kushki (Tarjeta) -->
      <v-card
        class="method-card"
        :class="{ 'selected': selectedMethod === 'kushki' }"
        variant="outlined"
        @click="selectMethod('kushki')"
      >
        <div class="method-icon">
          <v-icon size="64" color="#10b981">mdi-credit-card</v-icon>
        </div>
        
        <v-card-title class="method-title">
          Tarjeta de Crédito/Débito
        </v-card-title>
        
        <v-card-text>
          <p class="method-description">
            Paga con Visa, Mastercard, American Express
          </p>
          <v-list density="compact">
            <v-list-item>
              <template v-slot:prepend>
                <v-icon size="small" color="success">mdi-check-circle</v-icon>
              </template>
              <v-list-item-title>Todas las tarjetas</v-list-item-title>
            </v-list-item>
            <v-list-item>
              <template v-slot:prepend>
                <v-icon size="small" color="success">mdi-check-circle</v-icon>
              </template>
              <v-list-item-title>Hasta 12 cuotas</v-list-item-title>
            </v-list-item>
            <v-list-item>
              <template v-slot:prepend>
                <v-icon size="small" color="success">mdi-check-circle</v-icon>
              </template>
              <v-list-item-title>Procesado por Kushki</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-card-text>
      </v-card>

      <!-- Transferencia -->
      <v-card
        class="method-card"
        :class="{ 'selected': selectedMethod === 'transfer' }"
        variant="outlined"
        @click="selectMethod('transfer')"
        disabled
      >
        <div class="method-icon">
          <v-icon size="64" color="#6b7280">mdi-bank-transfer</v-icon>
        </div>
        
        <v-card-title class="method-title">
          Transferencia Bancaria
          <v-chip size="small" color="grey" class="ml-2">Próximamente</v-chip>
        </v-card-title>
        
        <v-card-text>
          <p class="method-description">
            Transfiere directamente a nuestra cuenta
          </p>
          <v-list density="compact">
            <v-list-item>
              <template v-slot:prepend>
                <v-icon size="small" color="grey">mdi-lock</v-icon>
              </template>
              <v-list-item-title class="text-grey">Disponible pronto</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-card-text>
      </v-card>
    </div>

    <div class="method-actions">
      <v-btn
        variant="text"
        @click="$emit('previous')"
        class="mr-4"
      >
        Atrás
      </v-btn>
      <v-btn
        color="primary"
        size="large"
        :disabled="!selectedMethod || selectedMethod === 'transfer'"
        @click="$emit('next')"
      >
        Continuar
      </v-btn>
    </div>

    <!-- Security Notice -->
    <div class="security-notice mt-8">
      <v-alert
        variant="tonal"
        density="compact"
        border="start"
      >
        <template v-slot:prepend>
          <v-icon size="small">mdi-shield-check</v-icon>
        </template>
        <div class="security-text">
          <strong>Pago 100% seguro:</strong> Tus datos están protegidos con encriptación de grado bancario
        </div>
      </v-alert>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { PaymentMethod } from '@/composables/usePayment';

interface Props {
  selectedMethod: PaymentMethod;
}

defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:selectedMethod', method: PaymentMethod): void;
  (e: 'next'): void;
  (e: 'previous'): void;
}>();

const selectMethod = (method: PaymentMethod) => {
  emit('update:selectedMethod', method);
};
</script>

<style scoped>
.payment-method-container {
  max-width: 1000px;
  margin: 0 auto;
}

.section-title {
  text-align: center;
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 8px;
  color: #1a1a2e;
}

.section-subtitle {
  text-align: center;
  color: #666;
  margin-bottom: 32px;
}

.methods-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
  margin-bottom: 32px;
}

.method-card {
  cursor: pointer;
  transition: all 0.3s ease;
  border-radius: 16px;
  padding: 24px;
}

.method-card:hover:not([disabled]) {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
}

.method-card.selected {
  border-color: #3b82f6;
  box-shadow: 0 8px 16px rgba(59, 130, 246, 0.2);
}

.method-card[disabled] {
  opacity: 0.6;
  cursor: not-allowed;
}

.method-icon {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 120px;
  background: linear-gradient(135deg, #f8fafc, #e2e8f0);
  border-radius: 12px;
  margin-bottom: 16px;
}

.method-title {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 16px;
}

.method-description {
  text-align: center;
  color: #666;
  margin-bottom: 16px;
}

.method-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

.security-notice {
  max-width: 600px;
  margin: 0 auto;
}

.security-text {
  font-size: 0.875rem;
  color: #666;
}

/* Responsive */
@media (max-width: 768px) {
  .methods-grid {
    grid-template-columns: 1fr;
  }

  .section-title {
    font-size: 1.5rem;
  }

  .method-actions {
    flex-direction: column-reverse;
    gap: 12px;
  }

  .method-actions .v-btn {
    width: 100%;
  }
}
</style>
