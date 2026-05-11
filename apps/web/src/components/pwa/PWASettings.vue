<template>
  <v-card
    variant="outlined"
    elevation="0"
    class="pwa-settings-card"
    role="region"
    aria-labelledby="pwa-settings-title"
  >
    <v-card-title
      id="pwa-settings-title"
      class="text-h6 font-weight-medium d-flex align-center"
    >
      <v-icon
        icon="mdi-cellphone-link"
        class="mr-2"
        color="primary"
        aria-hidden="true"
      />
      Aplicación Progresiva (PWA)
    </v-card-title>

    <v-card-text class="pt-4">
      <!-- Estado de instalación -->
      <v-list density="compact" role="list" aria-label="Estado de la aplicación">
        <!-- Estado de instalación -->
        <v-list-item role="listitem" class="px-0">
          <template #prepend>
            <v-icon
              :icon="isPWAInstalled ? 'mdi-check-circle' : 'mdi-download-box-outline'"
              :color="isPWAInstalled ? 'success' : 'grey'"
              size="small"
              aria-hidden="true"
            />
          </template>

          <v-list-item-title>
            {{ isPWAInstalled ? 'Instalada' : 'No instalada' }}
          </v-list-item-title>

          <v-list-item-subtitle class="text-caption">
            {{ isPWAInstalled
              ? 'La aplicación está instalada en tu dispositivo'
              : 'Instala la aplicación para acceso rápido'
            }}
          </v-list-item-subtitle>

          <template #append>
            <v-chip
              :color="isPWAInstalled ? 'success' : 'grey-lighten-1'"
              size="small"
              :text="isPWAInstalled ? 'Activa' : 'Disponible'"
            />
          </template>
        </v-list-item>

        <!-- Estado de conexión -->
        <v-list-item role="listitem" class="px-0">
          <template #prepend>
            <v-icon
              :icon="isOnline ? 'mdi-wifi' : 'mdi-wifi-off'"
              :color="isOnline ? 'success' : 'error'"
              size="small"
              aria-hidden="true"
            />
          </template>

          <v-list-item-title>
            {{ isOnline ? 'En línea' : 'Sin conexión' }}
          </v-list-item-title>

          <v-list-item-subtitle class="text-caption">
            {{ isOnline
              ? 'Conectado a internet'
              : 'Algunas funciones no están disponibles'
            }}
          </v-list-item-subtitle>
        </v-list-item>

        <!-- Versión de la app -->
        <v-list-item role="listitem" class="px-0">
          <template #prepend>
            <v-icon
              icon="mdi-information-outline"
              color="grey"
              size="small"
              aria-hidden="true"
            />
          </template>

          <v-list-item-title>
            Versión
          </v-list-item-title>

          <v-list-item-subtitle class="text-caption">
            {{ appVersion }}
          </v-list-item-subtitle>
        </v-list-item>
      </v-list>

      <!-- Acciones -->
      <v-divider class="my-3" />

      <div class="d-flex flex-wrap gap-2">
        <!-- Botón instalar (solo si es instalable y no instalada) -->
        <v-btn
          v-if="isInstallable && !isPWAInstalled"
          color="primary"
          variant="tonal"
          @click="handleInstall"
          prepend-icon="mdi-plus-box"
          aria-label="Instalar aplicación Galeno"
          class="mr-2"
        >
          Instalar
        </v-btn>

        <!-- Botón actualizar Service Worker -->
        <v-btn
          v-if="showUpdateAvailable"
          color="info"
          variant="tonal"
          @click="handleUpdate"
          prepend-icon="mdi-refresh"
          aria-label="Actualizar aplicación"
          class="mr-2"
        >
          Actualizar
        </v-btn>

        <!-- Botón abrir offline page -->
        <v-btn
          variant="outlined"
          @click="handleOpenOffline"
          prepend-icon="mdi-wifi-off"
          aria-label="Ver página offline"
        >
          Ver modo offline
        </v-btn>
      </div>

      <!-- Información adicional -->
      <v-alert
        type="info"
        variant="tonal"
        density="compact"
        class="mt-4"
        icon="mdi-lightbulb-on"
        role="note"
      >
        <p class="text-caption mb-0">
          <strong>Consejo:</strong>
          {{ isPWAInstalled
            ? 'Puedes acceder a Galeno desde tu pantalla de inicio como cualquier app.'
            : 'Instalar la aplicación te permite acceder más rápido y usar algunas funciones sin conexión.'
          }}
        </p>
      </v-alert>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { usePWA } from '@/composables/usePWA';
import { useRegisterSW } from 'virtual:pwa-register/vue';

/**
 * Componente PWASettings
 * 
 * Muestra el estado de la PWA y permite:
 * - Ver estado de instalación
 * - Instalar la aplicación (si es posible)
 * - Ver estado de conexión
 * - Ver versión de la app
 * - Actualizar service worker
 * 
 * Características:
 * - Accesibilidad WCAG 2.1 AA
 * - Mobile-first responsive
 * - Integración con usePWA composable
 */

// Router
const router = useRouter();

// Composable PWA
const {
  isPWAInstalled,
  isInstallable,
  isOnline,
  appVersion,
  promptInstall
} = usePWA();

// Service Worker update
const {
  updateServiceWorker,
  needRefresh: showUpdateAvailable
} = useRegisterSW();

// Estado local
const isInstalling = ref<boolean>(false);

/**
 * Maneja la instalación de la PWA
 */
async function handleInstall(): Promise<void> {
  isInstalling.value = true;
  
  try {
    const result = await promptInstall();
    
    if (result?.outcome === 'accepted') {
      console.log('[PWASettings] Instalación iniciada');
    }
  } catch (error) {
    console.error('[PWASettings] Error en instalación:', error);
  } finally {
    isInstalling.value = false;
  }
}

/**
 * Maneja la actualización del service worker
 */
async function handleUpdate(): Promise<void> {
  try {
    await updateServiceWorker();
    console.log('[PWASettings] Service Worker actualizado');
  } catch (error) {
    console.error('[PWASettings] Error actualizando:', error);
  }
}

/**
 * Navega a la página offline
 */
function handleOpenOffline(): void {
  router.push('/offline');
}
</script>

<style scoped>
.pwa-settings-card {
  width: 100%;
}

.gap-2 {
  gap: 0.5rem;
}

/* Asegurar que los botones se envuelvan correctamente en mobile */
@media (max-width: 600px) {
  .d-flex.flex-wrap {
    flex-direction: column;
  }
  
  .mr-2 {
    margin-right: 0 !important;
    margin-bottom: 0.5rem;
  }
}
</style>
