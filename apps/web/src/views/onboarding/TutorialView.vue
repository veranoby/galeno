<template>
  <div class="tutorial-view">
    <!-- Tutorial Steps -->
    <v-window
      v-model="currentTutorialStep"
      show-arrows
    >
      <!-- Step 1: Welcome to Dashboard -->
      <v-window-item :value="0">
        <div class="tutorial-step text-center">
          <v-icon
            icon="mdi-view-dashboard"
            size="64"
            color="primary"
            class="mb-4"
          />
          <h3 class="text-h5 font-weight-bold mb-3">
            Tu Dashboard Personalizado
          </h3>
          <p class="text-body-1 text-medium-emphasis mb-4">
            Accede rápidamente a todas las funcionalidades desde tu panel principal.
            Visualiza citas de hoy, consultas recientes y más.
          </p>
          <v-img
            src="/images/tutorial/dashboard.png"
            alt="Dashboard Preview"
            max-height="200"
            contain
            class="tutorial-image mb-4"
          />
        </div>
      </v-window-item>

      <!-- Step 2: Consultas -->
      <v-window-item :value="1">
        <div class="tutorial-step text-center">
          <v-icon
            icon="mdi-file-document-multiple"
            size="64"
            color="primary"
            class="mb-4"
          />
          <h3 class="text-h5 font-weight-bold mb-3">
            Consultas Médicas
          </h3>
          <p class="text-body-1 text-medium-emphasis mb-4">
            Crea historias clínicas completas con diagnóstico, recetas electrónicas
            y certificados. Todo con firma digital válida.
          </p>
          <v-img
            src="/images/tutorial/consultas.png"
            alt="Consultas Preview"
            max-height="200"
            contain
            class="tutorial-image mb-4"
          />
        </div>
      </v-window-item>

      <!-- Step 3: IA Copilot -->
      <v-window-item :value="2">
        <div class="tutorial-step text-center">
          <v-icon
            icon="mdi-robot"
            size="64"
            color="primary"
            class="mb-4"
          />
          <h3 class="text-h5 font-weight-bold mb-3">
            IA Copilot
          </h3>
          <p class="text-body-1 text-medium-emphasis mb-4">
            Tu asistente inteligente. Obtén sugerencias de diagnóstico,
            interacciones medicamentosas y más. Con 3 niveles de autonomía.
          </p>
          <v-img
            src="/images/tutorial/ia-copilot.png"
            alt="IA Copilot Preview"
            max-height="200"
            contain
            class="tutorial-image mb-4"
          />
        </div>
      </v-window-item>

      <!-- Step 4: Agenda -->
      <v-window-item :value="3">
        <div class="tutorial-step text-center">
          <v-icon
            icon="mdi-calendar-clock"
            size="64"
            color="primary"
            class="mb-4"
          />
          <h3 class="text-h5 font-weight-bold mb-3">
            Agenda Inteligente
          </h3>
          <p class="text-body-1 text-medium-emphasis mb-4">
            Gestiona citas presenciales y teleconsultas. Configura horarios
            de disponibilidad y deja que Galeno maneje el resto.
          </p>
          <v-img
            src="/images/tutorial/agenda.png"
            alt="Agenda Preview"
            max-height="200"
            contain
            class="tutorial-image mb-4"
          />
        </div>
      </v-window-item>

      <!-- Step 5: Pacientes -->
      <v-window-item :value="4">
        <div class="tutorial-step text-center">
          <v-icon
            icon="mdi-account-multiple"
            size="64"
            color="primary"
            class="mb-4"
          />
          <h3 class="text-h5 font-weight-bold mb-3">
            Directorio de Pacientes
          </h3>
          <p class="text-body-1 text-medium-emphasis mb-4">
            Accede al historial completo de tus pacientes. Conecta con
            Health Wallet para datos actualizados.
          </p>
          <v-img
            src="/images/tutorial/pacientes.png"
            alt="Pacientes Preview"
            max-height="200"
            contain
            class="tutorial-image mb-4"
          />
        </div>
      </v-window-item>
    </v-window>

    <!-- Window Controls -->
    <div class="tutorial-controls mt-4">
      <!-- Progress Indicators -->
      <div class="d-flex justify-center mb-4">
        <v-btn
          v-for="(_, index) in tutorialSteps"
          :key="index"
          icon
          size="8"
          :color="currentTutorialStep === index ? 'primary' : 'grey'"
          class="mx-1"
          @click="currentTutorialStep = index"
        />
      </div>

      <!-- Navigation Buttons -->
      <v-row>
        <v-col cols="6">
          <v-btn
            v-if="currentTutorialStep > 0"
            variant="outlined"
            color="primary"
            block
            @click="previousTutorialStep"
          >
            Atrás
          </v-btn>
        </v-col>
        <v-col cols="6">
          <v-btn
            v-if="currentTutorialStep < tutorialSteps - 1"
            color="primary"
            block
            @click="nextTutorialStep"
          >
            Siguiente
          </v-btn>
          <v-btn
            v-else
            color="success"
            block
            @click="completeOnboarding"
          >
            Completar
            <v-icon end>mdi-check</v-icon>
          </v-btn>
        </v-col>
      </v-row>

      <!-- Skip Option -->
      <div class="text-center mt-3">
        <v-btn
          variant="text"
          size="small"
          color="grey"
          @click="completeOnboarding"
        >
          Saltar tutorial
        </v-btn>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useOnboardingStore } from '@/stores/onboarding';

const router = useRouter();
const onboardingStore = useOnboardingStore();

const currentTutorialStep = ref(0);
const tutorialSteps = 5;

function nextTutorialStep() {
  if (currentTutorialStep.value < tutorialSteps - 1) {
    currentTutorialStep.value++;
  }
}

function previousTutorialStep() {
  if (currentTutorialStep.value > 0) {
    currentTutorialStep.value--;
  }
}

async function completeOnboarding() {
  onboardingStore.completeTutorial();
  await onboardingStore.markOnboardingCompleted();
  router.push('/onboarding/completado');
}
</script>

<style scoped>
.tutorial-view {
  padding: 20px 0;
}

.tutorial-step {
  min-height: 350px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.tutorial-image {
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.12);
}

.tutorial-controls {
  border-top: 1px solid rgba(0, 0, 0, 0.12);
  padding-top: 16px;
}
</style>
