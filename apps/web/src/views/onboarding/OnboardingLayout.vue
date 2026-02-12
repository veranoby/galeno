<template>
  <v-container
    fluid
    class="onboarding-container fill-height justify-center"
  >
    <v-row class="justify-center">
      <v-col
        cols="12"
        sm="10"
        md="8"
        lg="6"
      >
        <v-card
          class="onboarding-card"
          :elevation="8"
        >
          <!-- Progress Bar -->
          <v-progress-linear
            :model-value="progress"
            color="primary"
            height="8"
            rounded
          />

          <v-card-text class="pa-6">
            <!-- Header -->
            <div class="text-center mb-6">
              <v-img
                src="/logo.svg"
                alt="Galeno"
                max-width="120"
                class="mx-auto mb-4"
              />
              <h1 class="text-h5 font-weight-bold mb-2">
                Bienvenido a Galeno
              </h1>
              <p class="text-body-2 text-medium-emphasis">
                Completa tu perfil en menos de 5 minutos
              </p>
            </div>

            <!-- Stepper -->
            <v-stepper
              v-model="currentStepIndex"
              class="elevation-0"
              hide-actions
            >
              <v-stepper-header class="elevation-0">
                <v-stepper-step
                  :complete="isEmailVerified"
                  :color="isEmailVerified ? 'success' : 'primary'"
                  step="1"
                >
                  Email
                  <small v-if="isEmailVerified">Verificado</small>
                </v-stepper-step>

                <v-divider />

                <v-stepper-step
                  :complete="isProfileCompleted"
                  :color="isProfileCompleted ? 'success' : 'primary'"
                  step="2"
                >
                  Perfil
                  <small v-if="isProfileCompleted">Completado</small>
                </v-stepper-step>

                <v-divider />

                <v-stepper-step
                  :complete="isTutorialCompleted"
                  :color="isTutorialCompleted ? 'success' : 'primary'"
                  step="3"
                >
                  Tutorial
                  <small v-if="isTutorialCompleted">Completado</small>
                </v-stepper-step>
              </v-stepper-header>
            </v-stepper>

            <!-- Time Remaining -->
            <v-alert
              v-if="estimatedTimeRemaining > 0"
              type="info"
              variant="tonal"
              class="mb-4"
              density="compact"
            >
              <template #prepend>
                <v-icon>mdi-clock-outline</v-icon>
              </template>
              Tiempo estimado restante: {{ estimatedTimeRemaining }} minutos
            </v-alert>

            <!-- Step Content -->
            <div class="step-content">
              <router-view />
            </div>

            <!-- Navigation -->
            <div
              v-if="showNavigation"
              class="navigation-buttons mt-6"
            >
              <v-row>
                <v-col cols="6">
                  <v-btn
                    v-if="canGoBack"
                    variant="outlined"
                    color="primary"
                    block
                    @click="goBack"
                  >
                    Atrás
                  </v-btn>
                </v-col>
                <v-col cols="6">
                  <v-btn
                    v-if="canGoForward"
                    color="primary"
                    block
                    :loading="isLoading"
                    :disabled="!canProceed"
                    @click="goForward"
                  >
                    {{ nextButtonText }}
                  </v-btn>
                </v-col>
              </v-row>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useOnboardingStore } from '@/stores/onboarding';
import { OnboardingStep } from '@galeno/shared-types';
import { storeToRefs } from 'pinia';

const router = useRouter();
const onboardingStore = useOnboardingStore();
const { progress, estimatedTimeRemaining, isEmailVerified, isProfileCompleted, isTutorialCompleted, isLoading } = storeToRefs(onboardingStore);

const currentStepIndex = computed(() => {
  const stepMap: Record<OnboardingStep, number> = {
    [OnboardingStep.WELCOME]: 0,
    [OnboardingStep.EMAIL_VERIFICATION]: 1,
    [OnboardingStep.PROFILE_SETUP]: 2,
    [OnboardingStep.TUTORIAL]: 3,
    [OnboardingStep.COMPLETED]: 4
  };
  return stepMap[onboardingStore.currentStep];
});

const showNavigation = computed(() => {
  return onboardingStore.currentStep !== OnboardingStep.WELCOME &&
         onboardingStore.currentStep !== OnboardingStep.COMPLETED;
});

const canGoBack = computed(() => {
  return onboardingStore.currentStep !== OnboardingStep.EMAIL_VERIFICATION;
});

const canGoForward = computed(() => {
  return true;
});

const canProceed = computed(() => {
  switch (onboardingStore.currentStep) {
    case OnboardingStep.EMAIL_VERIFICATION:
      return onboardingStore.isEmailVerified;
    case OnboardingStep.PROFILE_SETUP:
      return onboardingStore.isProfileCompleted;
    case OnboardingStep.TUTORIAL:
      return onboardingStore.isTutorialCompleted;
    default:
      return true;
  }
});

const nextButtonText = computed(() => {
  switch (onboardingStore.currentStep) {
    case OnboardingStep.EMAIL_VERIFICATION:
      return 'Continuar';
    case OnboardingStep.PROFILE_SETUP:
      return 'Guardar y continuar';
    case OnboardingStep.TUTORIAL:
      return 'Finalizar';
    default:
      return 'Continuar';
  }
});

function goBack() {
  onboardingStore.previousStep();
  updateRoute();
}

function goForward() {
  onboardingStore.nextStep();
  updateRoute();
}

function updateRoute() {
  const routeMap: Record<OnboardingStep, string> = {
    [OnboardingStep.WELCOME]: '/onboarding/bienvenida',
    [OnboardingStep.EMAIL_VERIFICATION]: '/onboarding/verificar-email',
    [OnboardingStep.PROFILE_SETUP]: '/onboarding/configurar-perfil',
    [OnboardingStep.TUTORIAL]: '/onboarding/tutorial',
    [OnboardingStep.COMPLETED]: '/onboarding/completado'
  };

  router.push(routeMap[onboardingStore.currentStep]);
}
</script>

<style scoped>
.onboarding-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.onboarding-card {
  margin-top: 10vh;
  border-radius: 16px !important;
}

.step-content {
  min-height: 300px;
}

.navigation-buttons button {
  height: 48px;
}
</style>
