<template>
  <v-snackbar
    v-model="showPrompt"
    color="primary"
    location="bottom"
    :timeout="-1"
    role="alertdialog"
    aria-labelledby="pwa-install-title"
    aria-describedby="pwa-install-description"
    class="pwa-install-prompt"
  >
    <div class="d-flex align-center gap-3">
      <!-- Icono -->
      <v-icon
        icon="mdi-download-box"
        size="large"
        aria-hidden="true"
        class="mr-2"
      />

      <!-- Contenido -->
      <div class="flex-grow-1">
        <h2
          id="pwa-install-title"
          class="text-subtitle-1 font-weight-bold mb-1"
        >
          Instala Galeno
        </h2>
        <p
          id="pwa-install-description"
          class="text-caption text-medium-emphasis mb-0"
        >
          Accede más rápido a todas las funcionalidades
        </p>
      </div>

      <!-- Acciones -->
      <div class="d-flex gap-2">
        <v-btn
          variant="text"
          size="small"
          @click="handleDismiss"
          aria-label="Instalar más tarde"
          ref="btnDismissRef"
        >
          Más tarde
        </v-btn>

        <v-btn
          variant="tonal"
          color="white"
          size="small"
          @click="handleInstall"
          aria-label="Instalar aplicación Galeno"
          ref="btnInstallRef"
          class="text-primary"
        >
          <v-icon icon="mdi-plus-box" start size="small" aria-hidden="true" />
          Instalar
        </v-btn>
      </div>
    </div>
  </v-snackbar>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from 'vue';
import { usePWA } from '@/composables/usePWA';

/**
 * Componente PWAInstallPrompt
 * 
 * Muestra un prompt para instalar la aplicación PWA
 * cuando el navegador lo permite y el usuario no ha
 * dismissado el prompt previamente.
 * 
 * Características:
 * - Accesibilidad WCAG 2.1 AA
 * - Focus management
 * - Tracking de dismiss (7 días)
 * - UI con Vuetify
 */

// Composable PWA
const { isInstallable, promptInstall, markInstallDismissed } = usePWA();

// Estado local
const showPrompt = ref<boolean>(false);

// Referencias para focus management
const btnDismissRef = ref<HTMLButtonElement | null>(null);
const btnInstallRef = ref<HTMLButtonElement | null>(null);

/**
 * Muestra el prompt con delay para mejor UX
 */
function showInstallPrompt(): void {
  // Delay de 3 segundos para no interrumpir al usuario
  setTimeout(() => {
    showPrompt.value = true;
    
    // Focus en el botón de instalar cuando se muestra
    nextTick(() => {
      btnInstallRef.value?.focus();
    });
  }, 3000);
}

/**
 * Maneja el click en instalar
 */
async function handleInstall(): Promise<void> {
  showPrompt.value = false;
  
  try {
    const result = await promptInstall();
    
    if (result?.outcome === 'accepted') {
      console.log('[PWAInstallPrompt] Instalación aceptada');
    }
  } catch (error) {
    console.error('[PWAInstallPrompt] Error en instalación:', error);
  }
}

/**
 * Maneja el click en dismiss (más tarde)
 */
function handleDismiss(): void {
  showPrompt.value = false;
  markInstallDismissed();
  
  // Focus en botón dismiss para accesibilidad
  nextTick(() => {
    btnDismissRef.value?.focus();
  });
}

/**
 * Escucha cambios en isInstallable
 */
onMounted(() => {
  watch(isInstallable, (newValue) => {
    if (newValue === true) {
      showInstallPrompt();
    }
  }, { immediate: true });
});
</script>

<style scoped>
.pwa-install-prompt {
  max-width: 600px;
}

.gap-2 {
  gap: 0.5rem;
}

.gap-3 {
  gap: 1rem;
}

/* Asegurar contraste adecuado */
.text-primary {
  color: rgb(var(--v-theme-primary)) !important;
}
</style>
