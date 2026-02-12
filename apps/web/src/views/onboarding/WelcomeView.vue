<template>
  <div class="welcome-view">
    <v-row>
      <v-col cols="12">
        <!-- Hero Image -->
        <div class="text-center mb-6">
          <v-icon
            icon="mdi-doctor"
            size="80"
            color="primary"
            class="mb-4"
          />
          <h2 class="text-h4 font-weight-bold mb-3">
            Tu práctica médica, simplificada
          </h2>
          <p class="text-body-1 text-medium-emphasis">
            Galeno es la plataforma integral para médicos en Ecuador.
            Gestiona consultas, pacientes, agenda y mucho más.
          </p>
        </div>

        <!-- Features List -->
        <v-list class="features-list mb-6">
          <v-list-item>
            <template #prepend>
              <v-icon color="success">mdi-check-circle</v-icon>
            </template>
            <v-list-item-title class="font-weight-medium">
              Historias clínicas digitales
            </v-list-item-title>
            <v-list-item-subtitle>
              Consultas completas con recetas electrónicas
            </v-list-item-subtitle>
          </v-list-item>

          <v-list-item>
            <template #prepend>
              <v-icon color="success">mdi-check-circle</v-icon>
            </template>
            <v-list-item-title class="font-weight-medium">
              Agenda inteligente
            </v-list-item-title>
            <v-list-item-subtitle>
              Gestiona citas presenciales y teleconsultas
            </v-list-item-subtitle>
          </v-list-item>

          <v-list-item>
            <template #prepend>
              <v-icon color="success">mdi-check-circle</v-icon>
            </template>
            <v-list-item-title class="font-weight-medium">
              IA Copilot
            </v-list-item-title>
            <v-list-item-subtitle>
              Asistente con inteligencia artificial
            </v-list-item-subtitle>
          </v-list-item>

          <v-list-item>
            <template #prepend>
              <v-icon color="success">mdi-check-circle</v-icon>
            </template>
            <v-list-item-title class="font-weight-medium">
              Facturación electrónica
            </v-list-item-title>
            <v-list-item-subtitle>
              Integración completa con SRI
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>

        <!-- CTA Button -->
        <v-btn
          color="primary"
          size="large"
          block
          rounded="lg"
          class="text-none font-weight-bold"
          @click="startOnboarding"
        >
          Comenzar registro
          <v-icon end>mdi-arrow-right</v-icon>
        </v-btn>

        <!-- Additional Info -->
        <div class="text-center mt-4">
          <p class="text-caption text-medium-emphasis mb-2">
            El proceso toma menos de 5 minutos
          </p>
          <div class="d-flex align-center justify-center gap-2">
            <v-icon size="16" color="grey">mdi-shield-check</v-icon>
            <span class="text-caption">Tus datos están protegidos con cifrado AES-256</span>
          </div>
        </div>
      </v-col>
    </v-row>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useOnboardingStore } from '@/stores/onboarding';

const router = useRouter();
const onboardingStore = useOnboardingStore();

function startOnboarding() {
  onboardingStore.nextStep();
  router.push('/onboarding/verificar-email');
}
</script>

<style scoped>
.welcome-view {
  padding: 20px 0;
}

.features-list {
  background: transparent;
}

.features-list .v-list-item {
  padding-left: 0;
}
</style>
