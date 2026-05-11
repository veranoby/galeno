// apps/web/src/components/migration/MappingPreview.vue
<template>
  <v-card variant="outlined">
    <v-card-title class="text-h6">
      <v-icon start color="primary">mdi-brain</v-icon>
      Paso 2: Mapeo Inteligente con IA
    </v-card-title>

    <v-card-text>
      <v-alert type="info" variant="tonal" class="mb-4">
        <strong>Mapeo Automático con IA</strong>
        <br>
        Nuestra IA ha analizado tu archivo y sugiere el siguiente mapeo de columnas.
        Puedes revisar y ajustar manualmente si es necesario.
      </v-alert>

      <!-- Loading State -->
      <div v-if="loading" class="text-center py-8">
        <v-progress-circular
          :size="64"
          indeterminate
          color="primary"
          class="mb-4"
        />
        <p class="text-h6">
          Analizando archivo con Gemini IA...
        </p>
        <p class="text-body-2 text-grey">
          Esto puede tomar unos segundos
        </p>
      </div>

      <!-- Mapping Results -->
      <div v-else>
        <!-- Statistics -->
        <v-row class="mb-4">
          <v-col cols="12" md="3">
            <v-card variant="tonal" color="blue">
              <v-card-text class="text-center">
                <div class="text-h4">{{ statistics.totalRows || 0 }}</div>
                <div class="text-caption">Filas Totales</div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card variant="tonal" color="green">
              <v-card-text class="text-center">
                <div class="text-h4">{{ statistics.validRows || 0 }}</div>
                <div class="text-caption">Filas Válidas</div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card variant="tonal" color="orange">
              <v-card-text class="text-center">
                <div class="text-h4">{{ statistics.invalidRows || 0 }}</div>
                <div class="text-caption">Filas Inválidas</div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card variant="tonal" color="purple">
              <v-card-text class="text-center">
                <div class="text-h4">{{ ((statistics.avgConfidence || 0) * 100).toFixed(1) }}%</div>
                <div class="text-caption">Confianza Promedio</div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <!-- Mappings Table -->
        <v-card variant="outlined" class="mb-4">
          <v-card-title class="text-subtitle-1 d-flex align-center">
            <v-icon start size="small">mdi-map-check</v-icon>
            Mapeo de Columnas Sugerido
            <v-spacer></v-spacer>
            <v-btn
              size="small"
              variant="text"
              @click="showAllColumns = !showAllColumns"
            >
              {{ showAllColumns ? 'Ver Menos' : 'Ver Todas' }}
              <v-icon end>{{ showAllColumns ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
            </v-btn>
          </v-card-title>

          <v-card-text>
            <v-table density="comfortable" hover>
              <thead>
                <tr>
                  <th class="w-25">Columna Origen</th>
                  <th class="w-25">Campo Destino</th>
                  <th class="w-20">Transformación</th>
                  <th class="w-30">Confianza</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(mapping, index) in visibleMappings"
                  :key="index"
                  :class="{ 'bg-grey-lighten-4': !isMappingConfident(mapping) }"
                >
                  <td>
                    <v-select
                      v-model="mapping.sourceColumn"
                      :items="sourceColumns"
                      label="Origen"
                      variant="outlined"
                      density="compact"
                      size="small"
                      hide-details
                      @update:model-value="emitMappingChanges"
                    />
                  </td>
                  <td>
                    <v-chip
                      :color="getFieldColor(mapping.targetField)"
                      variant="tonal"
                      size="small"
                    >
                      {{ mapping.targetField }}
                    </v-chip>
                  </td>
                  <td>
                    <v-select
                      v-model="mapping.transformation"
                      :items="transformationOptions"
                      label="Transformación"
                      variant="outlined"
                      density="compact"
                      size="small"
                      clearable
                      hide-details
                      @update:model-value="emitMappingChanges"
                    />
                  </td>
                  <td>
                    <div class="d-flex align-center">
                      <v-progress-linear
                        :model-value="mapping.confidence * 100"
                        :color="getConfidenceColor(mapping.confidence)"
                        height="20"
                        rounded
                        class="mr-2"
                      >
                        <strong>{{ (mapping.confidence * 100).toFixed(0) }}%</strong>
                      </v-progress-linear>
                      <v-icon
                        v-if="!isMappingConfident(mapping)"
                        color="warning"
                        size="small"
                        class="ml-2"
                        title="Mapeo de baja confianza - revisar manualmente"
                      >
                        mdi-alert
                      </v-icon>
                    </div>
                  </td>
                </tr>
              </tbody>
            </v-table>

            <!-- Low Confidence Warning -->
            <v-alert
              v-if="hasLowConfidenceMappings"
              type="warning"
              variant="tonal"
              class="mt-4"
            >
              <strong>Atención:</strong> Hay {{ lowConfidenceCount }} mapeos con baja confianza (< 70%).
              Por favor revísalos manualmente y ajusta si es necesario.
            </v-alert>
          </v-card-text>
        </v-card>

        <!-- Manual Mapping Button -->
        <v-card variant="outlined" class="mb-4">
          <v-card-text class="text-center">
            <p class="text-body-2 mb-2">
              ¿El mapeo automático no es correcto?
            </p>
            <v-btn
              variant="outlined"
              color="primary"
              size="small"
              @click="showManualMappingDialog = true"
            >
              <v-icon start>mdi-hand-back-right</v-icon>
              Configurar Mapeo Manualmente
            </v-btn>
          </v-card-text>
        </v-card>
      </div>
    </v-card-text>

    <v-card-actions>
      <v-spacer></v-spacer>
      <v-btn
        variant="outlined"
        @click="$emit('previous')"
      >
        Atrás
      </v-btn>

      <v-btn
        v-if="!loading && mappings.length === 0"
        color="primary"
        @click="$emit('analyze')"
      >
        <v-icon start>mdi-brain</v-icon>
        Analizar con IA
      </v-btn>

      <v-btn
        v-else-if="!loading"
        color="primary"
        :disabled="mappings.length === 0"
        @click="$emit('next')"
      >
        Continuar
        <v-icon end>mdi-arrow-right</v-icon>
      </v-btn>
    </v-card-actions>

    <!-- Manual Mapping Dialog -->
    <v-dialog v-model="showManualMappingDialog" max-width="800px">
      <v-card>
        <v-card-title class="text-h6">
          <v-icon start>mdi-hand-back-right</v-icon>
          Mapeo Manual de Columnas
        </v-card-title>

        <v-card-text>
          <p class="text-body-2 mb-4">
            Asigna manualmente cada columna de origen a un campo destino.
          </p>

          <v-table density="compact">
            <thead>
              <tr>
                <th>Columna Origen</th>
                <th>Campo Destino</th>
                <th>Transformación</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(mapping, index) in localMappings" :key="index">
                <td>
                  <v-chip size="small" color="blue" variant="outlined">
                    {{ mapping.sourceColumn }}
                  </v-chip>
                </td>
                <td>
                  <v-select
                    v-model="mapping.targetField"
                    :items="targetFields"
                    label="Campo Destino"
                    variant="outlined"
                    density="compact"
                    size="small"
                    clearable
                    hide-details
                  />
                </td>
                <td>
                  <v-select
                    v-model="mapping.transformation"
                    :items="transformationOptions"
                    label="Transformación"
                    variant="outlined"
                    density="compact"
                    size="small"
                    clearable
                    hide-details
                  />
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-card-text>

        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="showManualMappingDialog = false">
            Cancelar
          </v-btn>
          <v-btn
            color="primary"
            @click="saveManualMappings"
          >
            Guardar Cambios
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';

interface Mapping {
  sourceColumn: string;
  targetField: string;
  confidence: number;
  transformation?: string;
}

interface Statistics {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  avgConfidence: number;
}

interface Props {
  loading: boolean;
  mappings: Mapping[];
  sourceColumns: string[];
  targetModel: 'Paciente' | 'Consulta' | 'Cita';
  statistics: Statistics;
}

interface Emits {
  (e: 'mappings-updated', mappings: Mapping[]): void;
  (e: 'analyze'): void;
  (e: 'previous'): void;
  (e: 'next'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// State
const showAllColumns = ref(false);
const showManualMappingDialog = ref(false);
const localMappings = ref<Mapping[]>([]);

// Computed
const visibleMappings = computed(() => {
  if (showAllColumns.value) {
    return props.mappings;
  }
  // Show first 5 mappings by default
  return props.mappings.slice(0, 5);
});

const hasLowConfidenceMappings = computed(() => {
  return props.mappings.some(m => m.confidence < 0.7);
});

const lowConfidenceCount = computed(() => {
  return props.mappings.filter(m => m.confidence < 0.7).length;
});

const transformationOptions = ref([
  { value: 'uppercase', title: 'Mayúsculas' },
  { value: 'lowercase', title: 'Minúsculas' },
  { value: 'trim', title: 'Eliminar espacios' },
  { value: 'date', title: 'Convertir a fecha' },
  { value: 'phone', title: 'Normalizar teléfono' },
  { value: 'number', title: 'Convertir a número' },
  { value: 'boolean', title: 'Convertir a booleano' }
]);

const targetFields = computed(() => {
  const fields: Record<string, string[]> = {
    Paciente: [
      'nombres', 'apellidos', 'cedula', 'fechaNacimiento',
      'genero', 'telefono', 'email', 'direccion', 'tipoSangre', 'notas'
    ],
    Consulta: [
      'pacienteId', 'doctorId', 'fecha', 'motivo',
      'evolucion', 'diagnostico', 'tratamiento'
    ],
    Cita: [
      'pacienteId', 'doctorId', 'fechaInicio', 'fechaFin',
      'estado', 'notas'
    ]
  };

  return fields[props.targetModel] || [];
});

// Watch
watch(() => props.mappings, (newMappings) => {
  localMappings.value = [...newMappings];
}, { immediate: true, deep: true });

// Methods
const emitMappingChanges = () => {
  emit('mappings-updated', props.mappings);
};

const saveManualMappings = () => {
  emit('mappings-updated', localMappings.value);
  showManualMappingDialog.value = false;
};

const getConfidenceColor = (confidence: number): string => {
  if (confidence >= 0.9) return 'success';
  if (confidence >= 0.7) return 'warning';
  return 'error';
};

const isMappingConfident = (mapping: Mapping): boolean => {
  return mapping.confidence >= 0.7;
};

const getFieldColor = (field: string): string => {
  const colors: Record<string, string> = {
    nombres: 'blue',
    apellidos: 'blue',
    cedula: 'green',
    fechaNacimiento: 'purple',
    telefono: 'orange',
    email: 'cyan',
    direccion: 'brown',
    genero: 'pink',
    tipoSangre: 'red'
  };

  return colors[field] || 'grey';
};
</script>

<style scoped>
.w-25 {
  width: 25%;
}

.w-20 {
  width: 20%;
}

.w-30 {
  width: 30%;
}

.bg-grey-lighten-4 {
  background-color: rgba(0, 0, 0, 0.02);
}
</style>
