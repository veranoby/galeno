<template>
  <div class="completed-view text-center">
    <!-- Success Icon -->
    <v-icon
      icon="mdi-check-circle"
      size="80"
      color="success"
      class="mb-4"
    />

    <!-- Success Message -->
    <h2 class="text-h4 font-weight-bold mb-3">
      ¡Bienvenido a Galeno!
    </h2>
    <p class="text-body-1 text-medium-emphasis mb-6">
      Tu perfil está configurado y listo para usar.
    </p>

    <!-- Summary Card -->
    <v-card
      variant="outlined"
      class="summary-card mb-6"
    >
      <v-card-text>
        <v-row>
          <v-col cols="4">
            <div class="stat-item">
              <v-icon
                icon="mdi-email-check"
                color="success"
                size="24"
                class="mb-2"
              />
              <p class="text-caption text-medium-emphasis">
                Email
              </p>
              <p class="text-body-2 font-weight-medium">
                Verificado
              </p>
            </div>
          </v-col>

          <v-col cols="4">
            <div class="stat-item">
              <v-icon
                icon="mdi-account-check"
                color="success"
                size="24"
                class="mb-2"
              />
              <p class="text-caption text-medium-emphasis">
                Perfil
              </p>
              <p class="text-body-2 font-weight-medium">
                Completado
              </p>
            </div>
          </v-col>

          <v-col cols="4">
            <div class="stat-item">
              <v-icon
                icon="mdi-school"
                color="success"
                size="24"
                class="mb-2"
              />
              <p class="text-caption text-medium-emphasis">
                Tutorial
              </p>
              <p class="text-body-2 font-weight-medium">
                Completado
              </p>
            </div>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- Time Spent -->
    <v-alert
      type="info"
      variant="tonal"
      class="mb-6"
      density="compact"
    >
      <template #prepend>
        <v-icon>mdi-clock-fast</v-icon>
      </template>
      Completaste el registro en {{ timeSpent }} minutos
    </v-alert>

    <!-- Next Steps -->
    <div class="next-steps mb-6">
      <p class="text-subtitle-2 font-weight-bold mb-3">
        ¿Qué quieres hacer ahora?
      </p>

      <v-row>
        <v-col cols="6">
          <v-card
            hover
            @click="goToRoute('/consultas')"
          >
            <v-card-text class="text-center">
              <v-icon
                icon="mdi-stethoscope"
                size="32"
                color="primary"
                class="mb-2"
              />
              <p class="text-body-2 font-weight-medium">
                Nueva Consulta
              </p>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="6">
          <v-card
            hover
            @click="goToRoute('/agenda')"
          >
            <v-card-text class="text-center">
              <v-icon
                icon="mdi-calendar"
                size="32"
                color="primary"
                class="mb-2"
              />
              <p class="text-body-2 font-weight-medium">
                Configurar Agenda
              </p>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </div>

    <!-- Go to Dashboard Button -->
    <v-btn
      color="primary"
      size="large"
      block
      rounded="lg"
      class="text-none font-weight-bold"
      @click="goToDashboard"
    >
      Ir al Dashboard
      <v-icon end>mdi-arrow-right</v-icon>
    </v-btn>

    <!-- Additional Resources -->
    <div class="additional-resources mt-6">
      <p class="text-caption text-medium-emphasis mb-2">
        Recursos adicionales
      </p>
      <div class="d-flex justify-center gap-4">
        <a
          href="#"
          class="text-caption text-primary text-decoration-none"
        >
          Documentación
        </a>
        <span class="text-caption text-grey">•</span>
        <a
          href="#"
          class="text-caption text-primary text-decoration-none"
        >
          Video tutoriales
        </a>
        <span class="text-caption text-grey">•</span>
        <a
          href="#"
          class="text-caption text-primary text-decoration-none"
        >
          Soporte
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useOnboardingStore } from '@/stores/onboarding';
import { storeToRefs } from 'pinia';

const router = useRouter();
const onboardingStore = useOnboardingStore();
const { state } = storeToRefs(onboardingStore);

const timeSpent = computed(() => {
  if (state.value.startedAt && state.value.completedAt) {
    const start = new Date(state.value.startedAt).getTime();
    const end = new Date(state.value.completedAt).getTime();
    const minutes = Math.round((end - start) / 60000);
    return minutes;
  }
  return 5; // Default estimated time
});

function goToDashboard() {
  onboardingStore.$reset();
  router.push('/');
}

function goToRoute(route: string) {
  onboardingStore.$reset();
  router.push(route);
}
</script>

<style scoped>
.completed-view {
  padding: 20px 0;
}

.summary-card {
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.next-steps .v-card {
  cursor: pointer;
  transition: transform 0.2s;
}

.next-steps .v-card:hover {
  transform: translateY(-4px);
}
</style>
