<template>
  <v-card class="triage-form-card">
    <v-card-title class="d-flex align-center justify-space-between">
      <div>
        <h2 class="text-h5 font-weight-bold">
          <v-icon start color="primary">mdi-heart-pulse</v-icon>
          Captura de Signos Vitales
        </h2>
        <p class="text-subtitle-2 text-medium-emphasis mt-1">
          Complete los datos del triaje para {{ pacienteNombre }}
        </p>
      </div>
      <v-chip :color="estadoChipColor" variant="tonal" size="small">
        {{ estado }}
      </v-chip>
    </v-card-title>

    <v-card-text>
      <v-form ref="formRef" v-model="isValid">
        <!-- Signos Vitales Principales -->
        <div class="mb-6">
          <h3 class="text-subtitle-1 font-weight-bold mb-3">
            <v-icon start size="small">mdi-vitals</v-icon>
            Signos Vitales
          </h3>
          <v-row dense>
            <!-- Presión Arterial -->
            <v-col cols="12" md="4">
              <v-text-field
                v-model="form.bloodPressure"
                label="Presión Arterial (mmHg)"
                placeholder="120/80"
                hint="Formato: sistólica/diastólica"
                persistent-hint
                :rules="[rules.required, rules.bloodPressure]"
                prepend-inner-icon="mdi-heart"
                variant="outlined"
                density="comfortable"
              />
            </v-col>

            <!-- Frecuencia Cardíaca -->
            <v-col cols="12" md="4">
              <v-text-field
                v-model.number="form.heartRate"
                label="Frecuencia Cardíaca (BPM)"
                type="number"
                placeholder="72"
                hint="Latidos por minuto"
                persistent-hint
                :rules="[rules.required, rules.heartRate]"
                prepend-inner-icon="mdi-heart-box"
                variant="outlined"
                density="comfortable"
              />
            </v-col>

            <!-- Temperatura -->
            <v-col cols="12" md="4">
              <v-text-field
                v-model.number="form.temperature"
                label="Temperatura (°C)"
                type="number"
                step="0.1"
                placeholder="36.5"
                hint="Grados Celsius"
                persistent-hint
                :rules="[rules.required, rules.temperature]"
                prepend-inner-icon="mdi-thermometer"
                variant="outlined"
                density="comfortable"
              />
            </v-col>

            <!-- Frecuencia Respiratoria -->
            <v-col cols="12" md="4">
              <v-text-field
                v-model.number="form.respiratoryRate"
                label="Frecuencia Respiratoria (RPM)"
                type="number"
                placeholder="16"
                hint="Respiraciones por minuto"
                persistent-hint
                :rules="[rules.required, rules.respiratoryRate]"
                prepend-inner-icon="mdi-lungs"
                variant="outlined"
                density="comfortable"
              />
            </v-col>

            <!-- Saturación de Oxígeno -->
            <v-col cols="12" md="4">
              <v-text-field
                v-model.number="form.oxygenSaturation"
                label="Saturación O₂ (%)"
                type="number"
                placeholder="98"
                hint="Porcentaje de saturación"
                persistent-hint
                :rules="[rules.required, rules.oxygenSaturation]"
                prepend-inner-icon="mdi-air-purifier"
                variant="outlined"
                density="comfortable"
              />
            </v-col>

            <!-- Nivel de Dolor -->
            <v-col cols="12" md="4">
              <v-slider
                v-model="form.painLevel"
                label="Nivel de Dolor"
                :min="0"
                :max="10"
                step="1"
                thumb-label="always"
                hint="0 = Sin dolor, 10 = Dolor máximo"
                persistent-hint
                :rules="[rules.required]"
              >
                <template v-slot:prepend>
                  <v-icon size="small">mdi-emoticon-happy-outline</v-icon>
                </template>
                <template v-slot:append>
                  <v-icon size="small">mdi-emoticon-sad-outline</v-icon>
                </template>
              </v-slider>
            </v-col>
          </v-row>
        </div>

        <!-- Medidas Antropométricas -->
        <div class="mb-6">
          <h3 class="text-subtitle-1 font-weight-bold mb-3">
            <v-icon start size="small">mdi-ruler</v-icon>
            Medidas Antropométricas
          </h3>
          <v-row dense>
            <v-col cols="12" md="6">
              <v-text-field
                v-model.number="form.weight"
                label="Peso (kg)"
                type="number"
                step="0.1"
                placeholder="70.0"
                :rules="[rules.required, rules.weight]"
                prepend-inner-icon="mdi-weight"
                variant="outlined"
                density="comfortable"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model.number="form.height"
                label="Altura (cm)"
                type="number"
                placeholder="175"
                :rules="[rules.required, rules.height]"
                prepend-inner-icon="mdi-tape-measure"
                variant="outlined"
                density="comfortable"
              />
            </v-col>
          </v-row>
        </div>

        <!-- Información Clínica Adicional -->
        <div class="mb-6">
          <h3 class="text-subtitle-1 font-weight-bold mb-3">
            <v-icon start size="small">mdi-clipboard-text</v-icon>
            Información Clínica
          </h3>
          <v-row dense>
            <v-col cols="12">
              <v-textarea
                v-model="form.chiefComplaint"
                label="Motivo Principal de Consulta"
                placeholder="Describa el motivo principal de la consulta..."
                rows="2"
                counter="500"
                :rules="[rules.required]"
                variant="outlined"
                density="comfortable"
              />
            </v-col>

            <v-col cols="12" md="6">
              <v-text-field
                v-model="form.allergyStatus"
                label="Alergias"
                placeholder="Sin alergias conocidas o listar alergias"
                :rules="[rules.required]"
                prepend-inner-icon="mdi-alert-circle"
                variant="outlined"
                density="comfortable"
              />
            </v-col>

            <v-col cols="12" md="6">
              <v-text-field
                v-model="form.currentMedications"
                label="Medicación Actual"
                placeholder="Listar medicamentos actuales o 'Ninguno'"
                variant="outlined"
                density="comfortable"
              />
            </v-col>

            <v-col cols="12">
              <v-textarea
                v-model="form.notes"
                label="Notas Adicionales"
                placeholder="Observaciones adicionales..."
                rows="3"
                counter="1000"
                variant="outlined"
                density="comfortable"
              />
            </v-col>
          </v-row>
        </div>

        <!-- Alertas de Valores Anormales -->
        <v-alert
          v-if="abnormalValues.length > 0"
          type="warning"
          variant="tonal"
          class="mb-4"
          icon="mdi-alert"
        >
          <template v-slot:title>
            <div class="d-flex align-center">
              <v-icon start color="warning">mdi-alert</v-icon>
              Valores Fuera de Rango Normal
            </div>
          </template>
          <div class="text-body-2">
            <ul class="mb-0">
              <li v-for="(alert, index) in abnormalValues" :key="index">
                {{ alert }}
              </li>
            </ul>
          </div>
        </v-alert>
      </v-form>
    </v-card-text>

    <v-card-actions class="pa-4">
      <v-spacer />
      <v-btn
        variant="outlined"
        color="medium-emphasis"
        @click="$emit('cancel')"
        :disabled="isSubmitting"
      >
        Cancelar
      </v-btn>
      <v-btn
        variant="tonal"
        color="primary"
        @click="handleSaveDraft"
        :loading="isSubmitting"
        :disabled="!isValid"
        class="mr-2"
      >
        <v-icon start>mdi-content-save-edit</v-icon>
        Guardar Borrador
      </v-btn>
      <v-btn
        variant="flat"
        color="primary"
        @click="handleComplete"
        :loading="isSubmitting"
        :disabled="!isValid"
      >
        Completar Triaje
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script lang="ts">
import { defineComponent, ref, computed, reactive, watch } from 'vue';

export interface TriageFormData {
  bloodPressure?: string;
  heartRate?: number;
  temperature?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  weight?: number;
  height?: number;
  painLevel?: number;
  chiefComplaint?: string;
  allergyStatus?: string;
  currentMedications?: string;
  notes?: string;
}

export interface TriageFormProps {
  pacienteNombre: string;
  estado?: 'borrador' | 'triaje' | 'pendiente';
  initialData?: TriageFormData;
  consultaId?: string;
}

export default defineComponent({
  name: 'TriageForm',

  props: {
    pacienteNombre: {
      type: String,
      required: true
    },
    estado: {
      type: String as () => 'borrador' | 'triaje' | 'pendiente',
      default: 'borrador'
    },
    initialData: {
      type: Object as () => TriageFormData,
      default: () => ({})
    },
    consultaId: {
      type: String,
      default: undefined
    }
  },

  emits: {
    submit: (data: TriageFormData & { isComplete: boolean }) => true,
    cancel: () => true,
    'save-draft': (data: TriageFormData) => true
  },

  setup(props, { emit }) {
    const formRef = ref<any>(null);
    const isValid = ref(false);
    const isSubmitting = ref(false);

    const form = reactive<TriageFormData>({
      ...props.initialData
    });

    // Validation rules
    const rules = {
      required: (v: any) => !!v || 'Campo requerido',
      bloodPressure: (v: string) => {
        if (!v) return true;
        const pattern = /^\d{2,3}\/\d{2,3}$/;
        return pattern.test(v) || 'Formato inválido (ej: 120/80)';
      },
      heartRate: (v: number) => {
        if (v === undefined || v === null) return true;
        return (v >= 30 && v <= 250) || 'Rango: 30-250 BPM';
      },
      temperature: (v: number) => {
        if (v === undefined || v === null) return true;
        return (v >= 35 && v <= 42) || 'Rango: 35-42°C';
      },
      respiratoryRate: (v: number) => {
        if (v === undefined || v === null) return true;
        return (v >= 8 && v <= 60) || 'Rango: 8-60 RPM';
      },
      oxygenSaturation: (v: number) => {
        if (v === undefined || v === null) return true;
        return (v >= 70 && v <= 100) || 'Rango: 70-100%';
      },
      weight: (v: number) => {
        if (v === undefined || v === null) return true;
        return (v >= 1 && v <= 500) || 'Rango: 1-500 kg';
      },
      height: (v: number) => {
        if (v === undefined || v === null) return true;
        return (v >= 30 && v <= 250) || 'Rango: 30-250 cm';
      }
    };

    // Detect abnormal values
    const abnormalValues = computed(() => {
      const alerts: string[] = [];

      if (form.bloodPressure) {
        const [systolic, diastolic] = form.bloodPressure.split('/').map(Number);
        if (systolic > 140 || systolic < 90) {
          alerts.push(`Presión arterial alta: ${form.bloodPressure}`);
        }
        if (diastolic > 90 || diastolic < 60) {
          alerts.push(`Presión arterial alta: ${form.bloodPressure}`);
        }
      }

      if (form.heartRate && (form.heartRate > 100 || form.heartRate < 60)) {
        alerts.push(`Frecuencia cardíaca fuera de rango: ${form.heartRate} BPM`);
      }

      if (form.temperature && (form.temperature > 37.5 || form.temperature < 36)) {
        alerts.push(`Temperatura fuera de rango: ${form.temperature}°C`);
      }

      if (form.oxygenSaturation && form.oxygenSaturation < 95) {
        alerts.push(`Saturación de oxígeno baja: ${form.oxygenSaturation}%`);
      }

      return alerts;
    });

    const estadoChipColor = computed(() => {
      return props.estado === 'triaje' ? 'warning' : 'info';
    });

    const handleSubmit = async (isComplete: boolean) => {
      if (!formRef.value || !(await formRef.value.validate())) {
        return;
      }

      isSubmitting.value = true;

      try {
        emit('submit', {
          ...form,
          isComplete
        });
      } finally {
        isSubmitting.value = false;
      }
    };

    const handleSaveDraft = () => handleSubmit(false);
    const handleComplete = () => handleSubmit(true);

    // Watch for abnormal values and show alerts
    watch(form, () => {
      if (abnormalValues.value.length > 0) {
        console.warn('Valores anormales detectados:', abnormalValues.value);
      }
    }, { deep: true });

    return {
      formRef,
      isValid,
      isSubmitting,
      form,
      rules,
      abnormalValues,
      estadoChipColor,
      handleSubmit,
      handleSaveDraft,
      handleComplete
    };
  }
});
</script>

<style scoped lang="scss">
.triage-form-card {
  max-width: 1200px;
  margin: 0 auto;
}

:deep(.v-slider) {
  .v-slider-track {
    background: linear-gradient(to right, 
      #4CAF50 0%, 
      #8BC34A 30%, 
      #FFC107 60%, 
      #F44336 100%
    );
  }
}
</style>
