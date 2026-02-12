<template>
  <div class="profile-setup-view">
    <!-- Step Description -->
    <div class="text-center mb-6">
      <v-icon
        icon="mdi-account-circle"
        size="48"
        color="primary"
        class="mb-3"
      />
      <h3 class="text-h5 font-weight-bold mb-2">
        Configura tu perfil profesional
      </h3>
      <p class="text-body-2 text-medium-emphasis">
        Completa tu información para personalizar tu experiencia
      </p>
    </div>

    <!-- Profile Form -->
    <v-form
      ref="profileForm"
      @submit.prevent="saveProfile"
    >
      <!-- Especialidad -->
      <v-text-field
        v-model="formData.especialidad"
        label="Especialidad"
        placeholder="Ej: Medicina General"
        variant="outlined"
        :rules="especialidadRules"
        :disabled="isLoading"
        prepend-inner-icon="mdi-stethoscope"
        class="mb-2"
      />

      <!-- Subespecialidad (opcional) -->
      <v-text-field
        v-model="formData.subespecialidad"
        label="Subespecialidad (opcional)"
        placeholder="Ej: Cardiología"
        variant="outlined"
        :disabled="isLoading"
        prepend-inner-icon="mdi-doctor"
        class="mb-2"
      />

      <!-- Número de Licencia -->
      <v-text-field
        v-model="formData.numeroLicencia"
        label="Número de licencia"
        placeholder="Ej: 12345-MSP"
        variant="outlined"
        :rules="numeroLicenciaRules"
        :disabled="isLoading"
        prepend-inner-icon="mdi-card-account-details"
        class="mb-2"
      />

      <!-- Teléfono -->
      <v-text-field
        v-model="formData.telefono"
        label="Teléfono celular"
        placeholder="+593 98 765 4321"
        variant="outlined"
        :rules="telefonoRules"
        :disabled="isLoading"
        prepend-inner-icon="mdi-phone"
        class="mb-4"
      />

      <!-- Consultorio Section -->
      <v-divider class="mb-4" />
      <p class="text-subtitle-2 font-weight-bold mb-3">
        Información del Consultorio
      </p>

      <v-text-field
        v-model="formData.consultorio.nombre"
        label="Nombre del consultorio"
        placeholder="Ej: Consultorio Dr. Pérez"
        variant="outlined"
        :rules="requiredRule"
        :disabled="isLoading"
        prepend-inner-icon="mdi-office-building"
        class="mb-2"
      />

      <v-text-field
        v-model="formData.consultorio.direccion"
        label="Dirección"
        placeholder="Ej: Av. Principal 123, Edificio Médico"
        variant="outlined"
        :rules="direccionRules"
        :disabled="isLoading"
        prepend-inner-icon="mdi-map-marker"
        class="mb-2"
      />

      <v-text-field
        v-model="formData.consultorio.ciudad"
        label="Ciudad"
        placeholder="Ej: Quito"
        variant="outlined"
        :rules="requiredRule"
        :disabled="isLoading"
        prepend-inner-icon="mdi-city"
        class="mb-2"
      />

      <v-text-field
        v-model="formData.consultorio.telefono"
        label="Teléfono consultorio (opcional)"
        placeholder="+593 2 123 4567"
        variant="outlined"
        :disabled="isLoading"
        prepend-inner-icon="mdi-phone-office"
        class="mb-4"
      />

      <!-- Preferencias -->
      <v-divider class="mb-4" />
      <p class="text-subtitle-2 font-weight-bold mb-3">
        Preferencias
      </p>

      <v-select
        v-model="formData.preferencias.idioma"
        label="Idioma"
        :items="idiomaOptions"
        variant="outlined"
        :disabled="isLoading"
        prepend-inner-icon="mdi-translate"
        class="mb-2"
      />

      <v-select
        v-model="formData.preferencias.formatoHora"
        label="Formato de hora"
        :items="formatoHoraOptions"
        variant="outlined"
        :disabled="isLoading"
        prepend-inner-icon="mdi-clock"
        class="mb-4"
      />

      <!-- Save Button -->
      <v-btn
        type="submit"
        color="primary"
        size="large"
        block
        rounded="lg"
        :loading="isLoading"
        class="text-none font-weight-bold"
      >
        Guardar y continuar
      </v-btn>
    </v-form>

    <!-- Error Alert -->
    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      class="mt-4"
      density="compact"
      closable
      @click:close="clearError"
    >
      {{ error }}
    </v-alert>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useOnboardingStore } from '@/stores/onboarding';
import type { ProfileSetupData } from '@galeno/shared-types';
import { storeToRefs } from 'pinia';

const onboardingStore = useOnboardingStore();
const { isLoading, error } = storeToRefs(onboardingStore);

const formData = ref<ProfileSetupData>({
  especialidad: '',
  subespecialidad: '',
  numeroLicencia: '',
  telefono: '',
  consultorio: {
    nombre: '',
    direccion: '',
    ciudad: '',
    telefono: ''
  },
  preferencias: {
    idioma: 'es',
    zonaHoraria: 'America/Guayaquil',
    formatoHora: '24h'
  }
});

const idiomaOptions = [
  { title: 'Español', value: 'es' },
  { title: 'English', value: 'en' }
];

const formatoHoraOptions = [
  { title: '24 horas (14:00)', value: '24h' },
  { title: '12 horas (2:00 PM)', value: '12h' }
];

const especialidadRules = [
  (v: string) => !!v || 'Especialidad es requerida',
  (v: string) => v.length >= 2 || 'Especialidad debe tener al menos 2 caracteres'
];

const numeroLicenciaRules = [
  (v: string) => !!v || 'Número de licencia es requerido',
  (v: string) => v.length >= 5 || 'Número de licencia debe tener al menos 5 caracteres'
];

const telefonoRules = [
  (v: string) => !!v || 'Teléfono es requerido',
  (v: string) => /^\+?\d{7,15}$/.test(v) || 'Teléfono debe tener entre 7 y 15 dígitos'
];

const direccionRules = [
  (v: string) => !!v || 'Dirección es requerida',
  (v: string) => v.length >= 10 || 'Dirección debe tener al menos 10 caracteres'
];

const requiredRule = [
  (v: string) => !!v || 'Este campo es requerido'
];

async function saveProfile() {
  const success = await onboardingStore.completeProfileSetup(formData.value);
  if (success) {
    // Navigation happens automatically via store
  }
}

function clearError() {
  error.value = null;
}
</script>

<style scoped>
.profile-setup-view {
  padding: 20px 0;
  max-height: 500px;
  overflow-y: auto;
}
</style>
