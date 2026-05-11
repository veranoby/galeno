<template>
  <v-card variant="outlined" class="senescyt-validation-card">
    <v-card-title class="text-h6 py-4 bg-primary text-white">
      <v-icon icon="mdi-certificate" start class="mr-2" />
      Validación SENESCYT
      <v-spacer />
      <v-chip
        v-if="validationStatus"
        :color="validationStatus.validado ? 'success' : 'warning'"
        size="small"
        variant="tonal"
      >
        <v-icon
          start
          size="x-small"
          :icon="validationStatus.validado ? 'mdi-check-circle' : 'mdi-clock-outline'"
        />
        {{ validationStatus.validado ? 'Validado' : 'Pendiente' }}
      </v-chip>
    </v-card-title>

    <v-card-text class="pa-4">
      <!-- Success Alert -->
      <v-alert
        v-if="validationStatus?.validado"
        type="success"
        variant="tonal"
        density="compact"
        class="mb-4"
        border="start"
        closable
      >
        <template v-slot:prepend>
          <v-icon icon="mdi-check-circle" />
        </template>
        <div>
          <strong>Título validado exitosamente</strong><br>
          <small v-if="validationStatus.respuesta">
            {{ validationStatus.respuesta.tituloProfesional }} - {{ validationStatus.respuesta.universidad }}
          </small>
        </div>
      </v-alert>

      <!-- Error Alert -->
      <v-alert
        v-if="errorMessage"
        :type="errorType"
        variant="tonal"
        density="compact"
        class="mb-4"
        border="start"
        closable
        @click:close="errorMessage = null"
      >
        {{ errorMessage }}
      </v-alert>

      <!-- Validation Form -->
      <v-form ref="form" v-model="formValid" @submit.prevent="validarTitulo">
        <v-row dense>
          <v-col cols="12">
            <v-text-field
              v-model="formData.cedula"
              label="Cédula"
              variant="outlined"
              :rules="[rules.required, rules.cedula]"
              hint="Ingrese su cédula (10 dígitos)"
              persistent-hint
              maxlength="10"
              counter="10"
            >
              <template v-slot:prepend-inner>
                <v-icon icon="mdi-badge-account-horizontal" />
              </template>
            </v-text-field>
          </v-col>

          <v-col cols="12">
            <v-text-field
              v-model="formData.numeroTitulo"
              label="Número de Título"
              variant="outlined"
              :rules="[rules.required]"
              hint="Número de título registrado en SENESCYT"
              persistent-hint
            >
              <template v-slot:prepend-inner>
                <v-icon icon="mdi-school" />
              </template>
            </v-text-field>
          </v-col>

          <v-col cols="12">
            <v-select
              v-model="formData.codigoUniversidad"
              :items="universidades"
              label="Universidad"
              variant="outlined"
              :rules="[rules.required]"
              hint="Seleccione la universidad que emitió el título"
              persistent-hint
            >
              <template v-slot:prepend-inner>
                <v-icon icon="mdi-university" />
              </template>
            </v-select>
          </v-col>
        </v-row>

        <v-btn
          color="primary"
          block
          size="large"
          :loading="loading"
          :disabled="!formValid"
          @click="validarTitulo"
          class="mt-4 touch-friendly"
        >
          <v-icon start>mdi-check-circle</v-icon>
          {{ loading ? 'Validando...' : 'Validar Título' }}
        </v-btn>
      </v-form>

      <!-- Info Card -->
      <v-alert
        type="info"
        variant="tonal"
        density="compact"
        class="mt-4"
        border="start"
      >
        <template v-slot:prepend>
          <v-icon icon="mdi-information" />
        </template>
        <div>
          <strong>Información:</strong><br>
          <small>
            La validación se realiza en tiempo real con los registros de la SENESCYT.
            El proceso puede tomar unos segundos.
          </small>
        </div>
      </v-alert>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { apiClient } from '@/services/api';

interface ValidationStatus {
  doctorId: string;
  validado: boolean;
  fechaValidacion: string;
  respuesta?: {
    valido: boolean;
    nombreProfesional: string;
    tituloProfesional: string;
    universidad: string;
    fechaRegistro: string;
    fechaExpedicion: string;
    estado: 'ACTIVO' | 'SUSPENDIDO' | 'CANCELADO';
  };
}

const form = ref<HTMLFormElement | null>(null);
const formValid = ref(false);

const formData = ref({
  cedula: '',
  numeroTitulo: '',
  codigoUniversidad: ''
});

const validationStatus = ref<ValidationStatus | null>(null);
const loading = ref(false);
const errorMessage = ref<string | null>(null);
const errorType = ref<'error' | 'warning'>('error');

const universidades = [
  { title: 'Universidad Central del Ecuador', value: 'UCE' },
  { title: 'Universidad de Guayaquil', value: 'UG' },
  { title: 'Universidad de Cuenca', value: 'UC' },
  { title: 'Universidad de las Américas', value: 'UDLA' },
  { title: 'Universidad San Francisco de Quito', value: 'USFQ' },
  { title: 'Pontificia Universidad Católica del Ecuador', value: 'PUCE' },
  { title: 'Universidad Técnica Particular de Loja', value: 'UTPL' },
  { title: 'Escuela Superior Politécnica del Litoral', value: 'ESPOL' },
  { title: 'Universidad de Cuenca', value: 'UC' },
  { title: 'Otra Universidad', value: 'OTRA' }
];

// Form validation rules
const rules = {
  required: (value: string) => !!value || 'Este campo es requerido',
  cedula: (value: string) => {
    if (!value) return true;
    const cedulaRegex = /^\d{10}$/;
    return cedulaRegex.test(value) || 'La cédula debe tener 10 dígitos';
  }
};

const validarTitulo = async () => {
  if (!form.value?.valid) return;

  loading.value = true;
  errorMessage.value = null;

  try {
    const response = await apiClient.post<ValidationStatus>('/senescyt/validar', formData.value);

    if (response.success && response.data) {
      validationStatus.value = response.data;

      if (!response.data.validado) {
        errorMessage.value = 'El título no pudo ser validado. Verifique los datos e intente nuevamente.';
        errorType.value = 'warning';
      }
    } else {
      errorMessage.value = response.error || 'Error al validar el título';
      errorType.value = 'error';
    }
  } catch (error) {
    console.error('Error validando título:', error);

    if (error instanceof Error) {
      errorMessage.value = error.message;
    } else {
      errorMessage.value = 'Error de conexión. Intente nuevamente.';
    }
    errorType.value = 'error';
  } finally {
    loading.value = false;
  }
};

const cargarEstado = async () => {
  try {
    const response = await apiClient.get<ValidationStatus>('/senescyt/status');

    if (response.success && response.data) {
      validationStatus.value = response.data;
    }
  } catch (error) {
    console.debug('No se encontró estado de validación previo');
  }
};

onMounted(() => {
  cargarEstado();
});
</script>

<style scoped>
.senescyt-validation-card {
  max-width: 600px;
  margin: 0 auto;
}

@media (max-width: 599px) {
  .senescyt-validation-card {
    border-radius: 8px;
  }

  .text-h6 {
    font-size: 1rem;
  }

  .v-btn {
    min-height: 48px;
  }
}

@media (min-width: 960px) {
  .senescyt-validation-card {
    border-radius: 12px;
    transition: box-shadow 0.2s ease;

    &:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
  }
}
</style>
