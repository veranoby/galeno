<template>
  <div class="onboarding-progress">
    <!-- Overall Progress -->
    <div class="mb-4">
      <div class="d-flex justify-space-between align-center mb-2">
        <span class="text-body-2 font-weight-medium">
          Progreso del registro
        </span>
        <span class="text-body-2 text-primary font-weight-bold">
          {{ progress }}%
        </span>
      </div>
      <v-progress-linear
        :model-value="progress"
        color="primary"
        height="8"
        rounded
      />
    </div>

    <!-- Step Indicators -->
    <div class="step-indicators">
      <div
        v-for="(step, index) in steps"
        :key="index"
        class="step-item"
        :class="{
          'step-active': currentStepIndex === index,
          'step-completed': index < currentStepIndex
        }"
      >
        <div class="step-circle">
          <v-icon
            v-if="index < currentStepIndex"
            icon="mdi-check"
            size="20"
            color="white"
          />
          <span v-else>
            {{ index + 1 }}
          </span>
        </div>
        <div class="step-label">
          {{ step.label }}
        </div>
      </div>
    </div>

    <!-- Estimated Time -->
    <v-alert
      v-if="estimatedTimeRemaining > 0"
      type="info"
      variant="tonal"
      class="mt-4"
      density="compact"
    >
      <template #prepend>
        <v-icon size="18">mdi-clock-outline</v-icon>
      </template>
      <span class="text-caption">
        Tiempo estimado restante: {{ estimatedTimeRemaining }} minutos
      </span>
    </v-alert>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { OnboardingStep } from '@galeno/shared-types';

interface Step {
  label: string;
  step: OnboardingStep;
}

interface Props {
  currentStep: OnboardingStep;
  progress: number;
  estimatedTimeRemaining: number;
}

const props = withDefaults(defineProps<Props>(), {
  progress: 0,
  estimatedTimeRemaining: 5
});

const steps: Step[] = [
  { label: 'Bienvenida', step: OnboardingStep.WELCOME },
  { label: 'Email', step: OnboardingStep.EMAIL_VERIFICATION },
  { label: 'Perfil', step: OnboardingStep.PROFILE_SETUP },
  { label: 'Tutorial', step: OnboardingStep.TUTORIAL }
];

const currentStepIndex = computed(() => {
  return steps.findIndex(s => s.step === props.currentStep);
});
</script>

<style scoped>
.onboarding-progress {
  padding: 16px 0;
}

.step-indicators {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
}

.step-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  position: relative;
}

.step-item:not(:last-child)::after {
  content: '';
  position: absolute;
  top: 16px;
  left: 50%;
  width: 100%;
  height: 2px;
  background: rgba(0, 0, 0, 0.12);
  z-index: 0;
}

.step-item.step-completed:not(:last-child)::after {
  background: rgb(var(--v-theme-primary));
}

.step-circle {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.12);
  color: rgba(0, 0, 0, 0.6);
  font-weight: bold;
  z-index: 1;
  transition: all 0.3s;
}

.step-active .step-circle {
  background: rgb(var(--v-theme-primary));
  color: white;
  transform: scale(1.1);
}

.step-completed .step-circle {
  background: rgb(var(--v-theme-primary));
  color: white;
}

.step-label {
  font-size: 0.75rem;
  margin-top: 8px;
  text-align: center;
  color: rgba(0, 0, 0, 0.6);
}

.step-active .step-label {
  color: rgb(var(--v-theme-primary));
  font-weight: 600;
}
</style>
