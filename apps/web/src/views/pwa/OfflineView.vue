<template>
  <v-container
    fluid
    fill-height
    class="d-flex align-center justify-center bg-grey-lighten-5 offline-container"
    role="main"
    aria-labelledby="offline-title"
  >
    <v-row justify="center">
      <v-col cols="12" sm="10" md="8" lg="6" xl="4">
        <v-card
          elevation="4"
          rounded="xl"
          class="pa-6 text-center"
          aria-describedby="offline-description"
        >
          <!-- Icono ilustrativo -->
          <div class="mb-6" aria-hidden="true">
            <v-icon
              icon="mdi-wifi-off"
              size="128"
              color="grey-lighten-2"
              class="offline-icon"
            />
          </div>

          <!-- Título -->
          <h1
            id="offline-title"
            class="text-h4 font-weight-bold mb-3 text-grey-darken-3"
          >
            Sin conexión
          </h1>

          <!-- Descripción -->
          <p
            id="offline-description"
            class="text-body-1 text-grey-darken-1 mb-6"
          >
            No tienes conexión a internet. Algunas funcionalidades no estarán
            disponibles hasta que te reconectes.
          </p>

          <!-- Funcionalidades disponibles offline -->
          <v-card
            variant="outlined"
            class="mb-6 text-start"
            role="region"
            aria-labelledby="available-offline-title"
          >
            <v-card-title
              id="available-offline-title"
              class="text-subtitle-1 font-weight-medium py-3"
            >
              <v-icon
                icon="mdi-check-circle-outline"
                color="success"
                size="small"
                class="mr-2"
                aria-hidden="true"
              />
              Disponible sin conexión
            </v-card-title>

            <v-card-text class="pt-0">
              <v-list density="compact" role="list">
                <v-list-item
                  v-for="feature in offlineFeatures"
                  :key="feature.id"
                  role="listitem"
                  class="py-2"
                >
                  <template #prepend>
                    <v-icon
                      :icon="feature.icon"
                      size="small"
                      color="primary"
                      aria-hidden="true"
                    />
                  </template>

                  <v-list-item-title class="text-body-2">
                    {{ feature.name }}
                  </v-list-item-title>
                </v-list-item>
              </v-list>
            </v-card-text>
          </v-card>

          <!-- Botón de reintento -->
          <div class="d-flex flex-column flex-sm-row gap-3 justify-center">
            <v-btn
              color="primary"
              size="large"
              :loading="isChecking"
              @click="handleRetry"
              prepend-icon="mdi-refresh"
              aria-label="Verificar conexión e intentar nuevamente"
              ref="btnRetryRef"
            >
              {{ isChecking ? 'Verificando...' : 'Reintentar' }}
            </v-btn>

            <v-btn
              variant="outlined"
              size="large"
              @click="handleGoBack"
              prepend-icon="mdi-arrow-left"
              aria-label="Volver a la página anterior"
            >
              Volver
            </v-btn>
          </div>

          <!-- Estado de conexión -->
          <v-alert
            v-if="isOnline"
            type="success"
            variant="tonal"
            class="mt-6"
            icon="mdi-wifi-check"
            role="status"
            aria-live="polite"
          >
            ¡Conexión restablecida! Redirigiendo...
          </v-alert>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { usePWA } from '@/composables/usePWA';

/**
 * Vista OfflineView
 * 
 * Página de fallback cuando el usuario está sin conexión.
 * Muestra funcionalidades disponibles offline y permite
 * reintentar la conexión.
 * 
 * Características:
 * - Accesibilidad WCAG 2.1 AA
 * - Mobile-first responsive
 * - Auto-redirect al recuperar conexión
 * - Lista de funcionalidades offline
 */

// Router
const router = useRouter();

// Composable PWA
const { isOnline, offlineMode } = usePWA();

// Estado local
const isChecking = ref<boolean>(false);

// Referencias
const btnRetryRef = ref<HTMLButtonElement | null>(null);

/**
 * Funcionalidades disponibles offline
 */
const offlineFeatures = [
  { id: '1', name: 'Ver historial de citas guardadas', icon: 'mdi-calendar-check' },
  { id: '2', name: 'Consultar pacientes en caché', icon: 'mdi-account-multiple' },
  { id: '3', name: 'Ver documentos descargados', icon: 'mdi-file-document' },
  { id: '4', name: 'Acceder a configuraciones guardadas', icon: 'mdi-cog' }
] as const;

/**
 * Verifica conexión e intenta reconectar
 */
async function handleRetry(): Promise<void> {
  isChecking.value = true;
  
  try {
    // Intentar cargar recurso para verificar conexión
    const response = await fetch('/manifest.webmanifest', {
      method: 'HEAD',
      cache: 'no-cache'
    });
    
    if (response.ok) {
      // Conexión exitosa
      isChecking.value = false;
      
      // Redirigir al home
      router.push('/');
    }
  } catch {
    // Sin conexión
    isChecking.value = false;
  }
}

/**
 * Vuelve a la página anterior
 */
function handleGoBack(): void {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push('/');
  }
}

/**
 * Maneja recuperación de conexión
 */
function handleOnline(): void {
  // Auto-redirect después de 2 segundos
  setTimeout(() => {
    router.push('/');
  }, 2000);
}

/**
 * Setup inicial
 */
onMounted(() => {
  // Focus en botón de reintento
  btnRetryRef.value?.focus();
  
  // Escuchar eventos de conexión
  window.addEventListener('online', handleOnline);
  
  // Verificar si estamos realmente offline
  if (navigator.onLine && !offlineMode.value) {
    // Si hay conexión, redirigir
    router.push('/');
  }
});

/**
 * Cleanup
 */
onUnmounted(() => {
  window.removeEventListener('online', handleOnline);
});
</script>

<style scoped>
.offline-container {
  min-height: 100vh;
}

.offline-icon {
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    transform: scale(1.05);
  }
}

.gap-3 {
  gap: 1rem;
}

/* Responsive adjustments */
@media (max-width: 600px) {
  .offline-icon {
    size: 96px;
  }
  
  #offline-title {
    font-size: 1.5rem;
  }
}
</style>
