<template>
  <div class="notification-settings">
    <v-card>
      <v-card-title>
        <v-icon start>mdi-bell-ring</v-icon>
        Configuración de Notificaciones
      </v-card-title>

      <v-card-subtitle>
        Elige cómo quieres recibir tus notificaciones
      </v-card-subtitle>

      <v-card-text>
        <!-- WhatsApp Notifications -->
        <v-card class="mb-4" variant="outlined">
          <v-card-title class="d-flex align-center">
            <v-icon color="success" class="mr-2">mdi-whatsapp</v-icon>
            WhatsApp
            <v-chip size="small" color="success" variant="tonal" class="ml-2">
              Recomendado
            </v-chip>
          </v-card-title>

          <v-card-text>
            <p class="text-body-2 text-medium-emphasis mb-4">
              Recibe recordatorios de citas y links de teleconsulta directamente en tu celular
            </p>

            <v-switch
              v-model="preferences.whatsappEnabled"
              label="Activar notificaciones por WhatsApp"
              color="success"
              hide-details
              @update:model-value="savePreferences"
            />

            <v-alert
              v-if="preferences.whatsappEnabled"
              type="info"
              variant="tonal"
              class="mt-3"
              density="compact"
            >
              <template #prepend>
                <v-icon size="small">mdi-information</v-icon>
              </template>
              <div class="text-caption">
                <strong>Recordatorios automáticos:</strong>
                <ul class="mt-1 mb-0 pl-4">
                  <li>24 horas antes de tu cita</li>
                  <li>1 hora antes de tu cita (urgente)</li>
                  <li>Link de teleconsulta directo</li>
                </ul>
              </div>
            </v-alert>
          </v-card-text>
        </v-card>

        <!-- Push Notifications -->
        <v-card class="mb-4" variant="outlined">
          <v-card-title class="d-flex align-center">
            <v-icon color="primary" class="mr-2">mdi-send</v-icon>
            Push Notifications
          </v-card-title>

          <v-card-text>
            <p class="text-body-2 text-medium-emphasis mb-4">
              Notificaciones push en tu dispositivo móvil
            </p>

            <v-switch
              v-model="preferences.pushEnabled"
              label="Activar notificaciones push"
              color="primary"
              hide-details
              @update:model-value="savePreferences"
            />

            <v-alert
              v-if="!preferences.whatsappEnabled && !preferences.pushEnabled"
              type="warning"
              variant="tonal"
              class="mt-3"
              density="compact"
            >
              <template #prepend>
                <v-icon size="small">mdi-alert</v-icon>
              </template>
              <div class="text-caption">
                <strong>Advertencia:</strong> Sin WhatsApp ni Push activados, podrías perder recordatorios importantes de citas.
              </div>
            </v-alert>
          </v-card-text>
        </v-card>

        <!-- In-App Notifications (SSE) -->
        <v-card class="mb-4" variant="outlined">
          <v-card-title class="d-flex align-center">
            <v-icon color="info" class="mr-2">mdi-wifi</v-icon>
            Notificaciones en la App
          </v-card-title>

          <v-card-text>
            <p class="text-body-2 text-medium-emphasis mb-4">
              Notificaciones en tiempo real cuando usas la aplicación
            </p>

            <v-switch
              v-model="preferences.sseEnabled"
              label="Activar notificaciones en la app"
              color="info"
              hide-details
              @update:model-value="savePreferences"
            />
          </v-card-text>
        </v-card>

        <!-- Toast Notifications -->
        <v-card class="mb-4" variant="outlined">
          <v-card-title class="d-flex align-center">
            <v-icon color="warning" class="mr-2">mdi-toast</v-icon>
            Notificaciones Emergentes
          </v-card-title>

          <v-card-text>
            <p class="text-body-2 text-medium-emphasis mb-4">
              Mensajes emergentes temporales en la interfaz
            </p>

            <v-switch
              v-model="preferences.toastEnabled"
              label="Activar notificaciones emergentes"
              color="warning"
              hide-details
              @update:model-value="savePreferences"
            />
          </v-card-text>
        </v-card>

        <!-- Phone Number Configuration -->
        <v-card variant="outlined">
          <v-card-title class="d-flex align-center">
            <v-icon color="success" class="mr-2">mdi-phone</v-icon>
            Número de Teléfono para WhatsApp
          </v-card-title>

          <v-card-text>
            <p class="text-body-2 text-medium-emphasis mb-4">
              El número donde recibirás los recordatorios de WhatsApp
            </p>

            <v-text-field
              v-model="phoneNumber"
              label="Número de teléfono"
              placeholder="+593 99 999 9999"
              type="tel"
              prepend-inner-icon="mdi-whatsapp"
              variant="outlined"
              hide-details="auto"
              class="mb-3"
            />

            <v-alert type="info" variant="tonal" density="compact">
              <template #prepend>
                <v-icon size="small">mdi-information</v-icon>
              </template>
              <div class="text-caption">
                Formato internacional: +593 (Ecuador) seguido de 9 dígitos
              </div>
            </v-alert>

            <v-btn
              color="success"
              class="mt-3"
              @click="savePhoneNumber"
              :loading="savingPhone"
            >
              Guardar Número
            </v-btn>
          </v-card-text>
        </v-card>
      </v-card-text>

      <!-- Test Notification Button -->
      <v-card-actions>
        <v-spacer />
        <v-btn
          color="success"
          variant="outlined"
          prepend-icon="mdi-whatsapp"
          @click="sendTestWhatsApp"
          :loading="sendingTest"
          :disabled="!preferences.whatsappEnabled"
        >
          Enviar Prueba por WhatsApp
        </v-btn>
      </v-card-actions>
    </v-card>

    <!-- Save Status Snackbar -->
    <v-snackbar
      v-model="showSnackbar"
      :color="snackbarColor"
      :timeout="3000"
    >
      {{ snackbarMessage }}
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useAuthStore } from '@/stores/auth.store';
import { NotificationMethod } from '@galeno/shared-types';

interface NotificationPreferences {
  pushEnabled: boolean;
  sseEnabled: boolean;
  toastEnabled: boolean;
  whatsappEnabled: boolean;
  methods: NotificationMethod[];
}

const authStore = useAuthStore();

// State
const preferences = ref<NotificationPreferences>({
  pushEnabled: true,
  sseEnabled: true,
  toastEnabled: true,
  whatsappEnabled: true,
  methods: [
    NotificationMethod.PUSH,
    NotificationMethod.SSE,
    NotificationMethod.TOAST,
    NotificationMethod.WHATSAPP,
  ],
});

const phoneNumber = ref('');
const savingPhone = ref(false);
const sendingTest = ref(false);
const showSnackbar = ref(false);
const snackbarMessage = ref('');
const snackbarColor = ref('success');

// Computed
const userId = computed(() => authStore.user?.id);

// Methods
const loadPreferences = async () => {
  try {
    const response = await fetch('/api/v1/notifications/preferences', {
      headers: {
        'Authorization': `Bearer ${authStore.token}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      preferences.value = data.preferences;
    }
  } catch (error) {
    console.error('Error loading preferences:', error);
  }
};

const savePreferences = async () => {
  try {
    const response = await fetch('/api/v1/notifications/preferences', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`,
      },
      body: JSON.stringify(preferences.value),
    });

    if (response.ok) {
      showSnackbarMessage('Preferencias guardadas exitosamente', 'success');
    } else {
      throw new Error('Failed to save preferences');
    }
  } catch (error) {
    console.error('Error saving preferences:', error);
    showSnackbarMessage('Error al guardar preferencias', 'error');
  }
};

const savePhoneNumber = async () => {
  if (!phoneNumber.value.trim()) {
    showSnackbarMessage('Ingresa un número de teléfono válido', 'warning');
    return;
  }

  savingPhone.value = true;

  try {
    // TODO: Implement phone number save API endpoint
    await new Promise(resolve => setTimeout(resolve, 1000));

    showSnackbarMessage('Número de teléfono guardado exitosamente', 'success');
  } catch (error) {
    console.error('Error saving phone number:', error);
    showSnackbarMessage('Error al guardar número de teléfono', 'error');
  } finally {
    savingPhone.value = false;
  }
};

const sendTestWhatsApp = async () => {
  sendingTest.value = true;

  try {
    const response = await fetch('/api/v1/notifications/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`,
      },
      body: JSON.stringify({
        userId: userId.value,
        title: '🧪 Prueba de WhatsApp - Galeno',
        message: 'Esta es una notificación de prueba. ¡WhatsApp está funcionando correctamente!',
        type: 'info',
        method: NotificationMethod.WHATSAPP,
      }),
    });

    if (response.ok) {
      showSnackbarMessage('Notificación de prueba enviada', 'success');
    } else {
      throw new Error('Failed to send test notification');
    }
  } catch (error) {
    console.error('Error sending test notification:', error);
    showSnackbarMessage('Error al enviar notificación de prueba', 'error');
  } finally {
    sendingTest.value = false;
  }
};

const showSnackbarMessage = (message: string, color: string) => {
  snackbarMessage.value = message;
  snackbarColor.value = color;
  showSnackbar.value = true;
};

// Lifecycle
onMounted(() => {
  loadPreferences();
});
</script>

<style scoped>
.notification-settings {
  max-width: 800px;
  margin: 0 auto;
}

.v-card-title {
  font-size: 1.25rem;
  font-weight: 600;
}
</style>
