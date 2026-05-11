<template>
  <v-card class="collaborative-triage" elevation="2">
    <v-card-title class="d-flex align-center justify-space-between">
      <span>
        <v-icon start color="primary">mdi-heart-pulse</v-icon>
        Captura de Signos Vitales
      </span>
      <v-chip
        :color="prioridadColor"
        size="small"
        variant="tonal"
      >
        Prioridad: {{ prioridadLabel }}
      </v-chip>
    </v-card-title>

    <v-card-text>
      <v-form v-model="formularioValido" ref="formRef">
        <!-- Signos Vitales -->
        <v-row>
          <v-col cols="12">
            <h3 class="text-h6 mb-3">
              <v-icon start size="small" color="primary">mdi-monitor-heart</v-icon>
              Signos Vitales
            </h3>
          </v-col>

          <!-- Presión Arterial -->
          <v-col cols="12" sm="6" md="3">
            <v-text-field
              v-model="form.bloodPressure"
              label="Presión Arterial"
              placeholder="120/80"
              hint="mmHg"
              persistent-hint
            />
          </v-col>

          <!-- Frecuencia Cardíaca -->
          <v-col cols="12" sm="6" md="3">
            <v-text-field
              v-model.number="form.heartRate"
              label="Frecuencia Cardíaca"
              type="number"
              placeholder="72"
              hint="BPM"
              persistent-hint
            />
          </v-col>

          <!-- Temperatura -->
          <v-col cols="12" sm="6" md="3">
            <v-text-field
              v-model.number="form.temperature"
              label="Temperatura"
              type="number"
              step="0.1"
              placeholder="36.5"
              hint="°C"
              persistent-hint
            />
          </v-col>

          <!-- Saturación O2 -->
          <v-col cols="12" sm="6" md="3">
            <v-text-field
              v-model.number="form.oxygenSaturation"
              label="Saturación O2"
              type="number"
              placeholder="98"
              hint="%"
              persistent-hint
              :color="saturacionColor"
            />
          </v-col>

          <!-- Frecuencia Respiratoria -->
          <v-col cols="12" sm="6" md="3">
            <v-text-field
              v-model.number="form.respiratoryRate"
              label="Frec. Respiratoria"
              type="number"
              placeholder="16"
              hint="rpm"
              persistent-hint
            />
          </v-col>

          <!-- Peso -->
          <v-col cols="12" sm="6" md="3">
            <v-text-field
              v-model.number="form.weight"
              label="Peso"
              type="number"
              step="0.1"
              placeholder="70"
              hint="kg"
              persistent-hint
            />
          </v-col>

          <!-- Talla -->
          <v-col cols="12" sm="6" md="3">
            <v-text-field
              v-model.number="form.height"
              label="Talla"
              type="number"
              step="0.01"
              placeholder="1.70"
              hint="metros"
              persistent-hint
            />
          </v-col>

          <!-- Nivel de Dolor -->
          <v-col cols="12" sm="6" md="3">
            <v-slider
              v-model="form.painLevel"
              label="Nivel de Dolor"
              :min="0"
              :max="10"
              :step="1"
              thumb-label="always"
              track-color="success"
              :color="dolorColor"
            >
              <template v-slot:append>
                <v-chip size="small" :color="dolorColor">
                  {{ form.painLevel }}/10
                </v-chip>
              </template>
            </v-slider>
          </v-col>
        </v-row>

        <v-divider class="my-4" />

        <!-- Información Clínica -->
        <v-row>
          <v-col cols="12">
            <h3 class="text-h6 mb-3">
              <v-icon start size="small" color="primary">mdi-clipboard-text</v-icon>
              Información Clínica
            </h3>
          </v-col>

          <!-- Motivo de Consulta -->
          <v-col cols="12">
            <v-textarea
              v-model="form.motivo"
              label="Motivo de Consulta"
              placeholder="Describa el motivo principal de la consulta..."
              rows="2"
              :rules="[v => !!v || 'El motivo es requerido']"
            />
          </v-col>

          <!-- Alergias -->
          <v-col cols="12" sm="6">
            <v-text-field
              v-model="form.allergyStatus"
              label="Alergias"
              placeholder="Ninguna conocida / Detallar..."
            />
          </v-col>

          <!-- Medicamentos Actuales -->
          <v-col cols="12" sm="6">
            <v-text-field
              v-model="form.currentMedications"
              label="Medicamentos Actuales"
              placeholder="Listar medicamentos que toma el paciente..."
            />
          </v-col>

          <!-- Síntomas -->
          <v-col cols="12">
            <v-combobox
              v-model="form.sintomas"
              :items="sintomasComunes"
              label="Síntomas"
              multiple
              chips
              closable-chips
              hint="Seleccione o escriba síntomas adicionales"
              persistent-hint
            />
          </v-col>

          <!-- Notas Adicionales -->
          <v-col cols="12">
            <v-textarea
              v-model="form.notes"
              label="Notas Adicionales"
              placeholder="Observaciones adicionales..."
              rows="2"
            />
          </v-col>
        </v-row>

        <!-- Prioridad -->
        <v-row>
          <v-col cols="12">
            <v-btn-toggle
              v-model="prioridadSeleccionada"
              mandatory
              variant="outlined"
              divided
            >
              <v-btn value="baja" color="success">
                <v-icon start>mdi-arrow-down</v-icon>
                Baja
              </v-btn>
              <v-btn value="media" color="warning">
                <v-icon start>mdi-minus</v-icon>
                Media
              </v-btn>
              <v-btn value="alta" color="error">
                <v-icon start>mdi-arrow-up</v-icon>
                Alta
              </v-btn>
            </v-btn-toggle>
          </v-col>
        </v-row>
      </v-form>
    </v-card-text>

    <!-- Acciones -->
    <v-card-actions>
      <v-spacer />
      <v-btn
        variant="outlined"
        @click="$emit('cancelar')"
      >
        Cancelar
      </v-btn>
      <v-btn
        variant="elevated"
        color="primary"
        :loading="loading"
        :disabled="!formularioValido"
        @click="$emit('guardar-borrador', form)"
      >
        <v-icon start>mdi-content-save</v-icon>
        Guardar Borrador
      </v-btn>
      <v-btn
        variant="elevated"
        color="success"
        :loading="loading"
        :disabled="!formularioValido"
        @click="$emit('completar', form)"
      >
        <v-icon start>mdi-check-circle</v-icon>
        Completar Triaje
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useTriage, type SignosVitales } from '@/composables/useTriage';

// Emits
const emit = defineEmits<{
  (e: 'guardar-borrador', data: any): void;
  (e: 'completar', data: any): void;
  (e: 'cancelar'): void;
}>();

// Estado
const loading = ref(false);
const formularioValido = ref(false);
const formRef = ref<HTMLFormElement>();
const prioridadSeleccionada = ref<'baja' | 'media' | 'alta'>('media');

// Formulario
const form = ref({
  bloodPressure: '',
  heartRate: undefined as number | undefined,
  temperature: undefined as number | undefined,
  respiratoryRate: undefined as number | undefined,
  oxygenSaturation: undefined as number | undefined,
  weight: undefined as number | undefined,
  height: undefined as number | undefined,
  painLevel: 0,
  motivo: '',
  allergyStatus: '',
  currentMedications: '',
  sintomas: [] as string[],
  notes: ''
});

// Síntomas comunes
const sintomasComunes = [
  'Fiebre',
  'Dolor de cabeza',
  'Náuseas',
  'Vómitos',
  'Diarrea',
  'Dolor abdominal',
  'Dificultad para respirar',
  'Tos',
  'Mareos',
  'Fatiga',
  'Dolor de garganta',
  'Congestión nasal'
];

// Composable
const { calcularPrioridad } = useTriage();

// Computed - Prioridad
const prioridadLabel = computed(() => {
  const labels = { baja: 'Baja', media: 'Media', alta: 'Alta' };
  return labels[prioridadSeleccionada.value];
});

const prioridadColor = computed(() => {
  const colors = { baja: 'success', media: 'warning', alta: 'error' };
  return colors[prioridadSeleccionada.value];
});

// Computed - Saturación
const saturacionColor = computed(() => {
  if (!form.value.oxygenSaturation) return 'default';
  if (form.value.oxygenSaturation < 90) return 'error';
  if (form.value.oxygenSaturation < 95) return 'warning';
  return 'success';
});

// Computed - Dolor
const dolorColor = computed(() => {
  if (form.value.painLevel <= 3) return 'success';
  if (form.value.painLevel <= 6) return 'warning';
  return 'error';
});

// Reset form
function resetForm() {
  form.value = {
    bloodPressure: '',
    heartRate: undefined,
    temperature: undefined,
    respiratoryRate: undefined,
    oxygenSaturation: undefined,
    weight: undefined,
    height: undefined,
    painLevel: 0,
    motivo: '',
    allergyStatus: '',
    currentMedications: '',
    sintomas: [],
    notes: ''
  };
  prioridadSeleccionada.value = 'media';
  formRef.value?.reset();
}

defineExpose({ resetForm });
</script>

<style scoped>
.collaborative-triage {
  max-width: 1000px;
  margin: 0 auto;
}
</style>
