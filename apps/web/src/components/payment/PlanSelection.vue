<!-- apps/web/src/components/payment/PlanSelection.vue -->
<template>
  <div class="plan-selection-container">
    <h2 class="section-title">Selecciona tu Plan</h2>
    <p class="section-subtitle">Elige el plan que mejor se adapte a tu práctica médica</p>

    <div class="plans-grid">
      <!-- Plan FREE -->
      <v-card
        class="plan-card"
        :class="{ 'selected': selectedPlan === 'FREE' }"
        variant="outlined"
        @click="selectPlan('FREE')"
      >
        <v-card-title class="plan-header">
          <h3 class="plan-name">Free</h3>
          <div class="plan-price">
            <span class="currency">$</span>
            <span class="amount">0</span>
            <span class="period">/mes</span>
          </div>
        </v-card-title>

        <v-card-text>
          <div class="plan-features">
            <v-list density="compact">
              <v-list-item v-for="feature in freeFeatures" :key="feature">
                <template v-slot:prepend>
                  <v-icon size="small" color="success">mdi-check-circle</v-icon>
                </template>
                <v-list-item-title>{{ feature }}</v-list-item-title>
              </v-list-item>
            </v-list>
          </div>
        </v-card-text>

        <v-card-actions>
          <v-btn
            :color="selectedPlan === 'FREE' ? 'primary' : 'default'"
            variant="tonal"
            block
          >
            {{ selectedPlan === 'FREE' ? 'Seleccionado' : 'Seleccionar' }}
          </v-btn>
        </v-card-actions>
      </v-card>

      <!-- Plan PREMIUM -->
      <v-card
        class="plan-card featured"
        :class="{ 'selected': selectedPlan === 'PREMIUM' }"
        variant="elevated"
        @click="selectPlan('PREMIUM')"
      >
        <div class="featured-badge">Más Popular</div>
        
        <v-card-title class="plan-header">
          <h3 class="plan-name">Premium</h3>
          <div class="plan-price">
            <span class="currency">$</span>
            <span class="amount">29.90</span>
            <span class="period">/mes</span>
          </div>
        </v-card-title>

        <v-card-text>
          <div class="plan-features">
            <v-list density="compact">
              <v-list-item v-for="feature in premiumFeatures" :key="feature">
                <template v-slot:prepend>
                  <v-icon size="small" :color="feature.includes('Todo') ? 'primary' : 'success'">
                    mdi-check-circle
                  </v-icon>
                </template>
                <v-list-item-title>{{ feature }}</v-list-item-title>
              </v-list-item>
            </v-list>
          </div>
        </v-card-text>

        <v-card-actions>
          <v-btn
            :color="selectedPlan === 'PREMIUM' ? 'primary' : 'default'"
            variant="tonal"
            block
          >
            {{ selectedPlan === 'PREMIUM' ? 'Seleccionado' : 'Seleccionar' }}
          </v-btn>
        </v-card-actions>
      </v-card>

      <!-- Plan CLÍNICA SME -->
      <v-card
        class="plan-card"
        :class="{ 'selected': selectedPlan === 'CLINICA_SME' }"
        variant="outlined"
        @click="selectPlan('CLINICA_SME')"
      >
        <v-card-title class="plan-header">
          <h3 class="plan-name">Clínica</h3>
          <div class="plan-price">
            <span class="currency">$</span>
            <span class="amount">99.90</span>
            <span class="period">/mes</span>
          </div>
        </v-card-title>

        <v-card-text>
          <div class="plan-features">
            <v-list density="compact">
              <v-list-item v-for="feature in clinicaFeatures" :key="feature">
                <template v-slot:prepend>
                  <v-icon size="small" color="success">mdi-check-circle</v-icon>
                </template>
                <v-list-item-title>{{ feature }}</v-list-item-title>
              </v-list-item>
            </v-list>
          </div>
        </v-card-text>

        <v-card-actions>
          <v-btn
            :color="selectedPlan === 'CLINICA_SME' ? 'primary' : 'default'"
            variant="tonal"
            block
          >
            {{ selectedPlan === 'CLINICA_SME' ? 'Seleccionado' : 'Seleccionar' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </div>

    <div class="plan-actions">
      <v-btn
        color="primary"
        size="large"
        :disabled="!selectedPlan"
        @click="$emit('next')"
        block
      >
        Continuar
      </v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { PlanType } from '@/composables/usePayment';

interface Props {
  selectedPlan: PlanType;
}

defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:selectedPlan', plan: PlanType): void;
  (e: 'next'): void;
}>();

const freeFeatures = [
  'Hasta 50 pacientes',
  'Historias clínicas básicas',
  'Agendamiento de citas',
  'Recetas digitales',
  'Soporte por email'
];

const premiumFeatures = [
  'Pacientes ilimitados',
  'Historias clínicas completas',
  'Telemedicina integrada',
  'Interconsultas',
  'Health Wallet',
  'Soporte prioritario',
  'Reportes y estadísticas'
];

const clinicaFeatures = [
  'Todo lo del plan Premium',
  'Hasta 10 doctores',
  'Hasta 20 asistentes',
  'Gestión multi-sede',
  'Interconsultas ilimitadas',
  'API de integración',
  'Soporte 24/7',
  'Capacitación personalizada'
];

const selectPlan = (plan: PlanType) => {
  emit('update:selectedPlan', plan);
};
</script>

<style scoped>
.plan-selection-container {
  max-width: 1200px;
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

.plans-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
  margin-bottom: 32px;
}

.plan-card {
  position: relative;
  cursor: pointer;
  transition: all 0.3s ease;
  border-radius: 16px;
  overflow: hidden;
}

.plan-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
}

.plan-card.selected {
  border-color: #3b82f6;
  box-shadow: 0 8px 16px rgba(59, 130, 246, 0.2);
}

.plan-card.featured {
  border: 2px solid #3b82f6;
}

.featured-badge {
  position: absolute;
  top: 12px;
  right: -32px;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  color: white;
  padding: 4px 40px;
  font-size: 12px;
  font-weight: 600;
  transform: rotate(45deg);
}

.plan-header {
  padding: 24px;
  text-align: center;
  background: linear-gradient(135deg, #f8fafc, #e2e8f0);
}

.plan-name {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0 0 16px 0;
  color: #1a1a2e;
}

.plan-price {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 4px;
}

.currency {
  font-size: 1.5rem;
  color: #666;
}

.amount {
  font-size: 3rem;
  font-weight: 700;
  color: #1a1a2e;
}

.period {
  font-size: 1rem;
  color: #666;
}

.plan-features {
  padding: 16px 24px;
}

.plan-actions {
  max-width: 400px;
  margin: 0 auto;
}

/* Responsive */
@media (max-width: 768px) {
  .plans-grid {
    grid-template-columns: 1fr;
  }

  .section-title {
    font-size: 1.5rem;
  }

  .amount {
    font-size: 2.5rem;
  }
}
</style>
