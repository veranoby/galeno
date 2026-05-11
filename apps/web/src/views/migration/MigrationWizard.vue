// apps/web/src/views/migration/MigrationWizard.vue
<template>
  <v-container fluid class="fill-height">
    <v-row justify="center" align="center">
      <v-col cols="12" md="10" lg="8">
        <v-card elevation="2">
          <v-card-title class="text-h5 bg-primary white--text">
            <v-icon start>mdi-database-import</v-icon>
            Migración Inteligente de Datos
          </v-card-title>

          <v-card-text class="pt-4">
            <v-stepper v-model="currentStep" elevation="0" class="bg-transparent">
              <v-stepper-header>
                <v-stepper-item
                  :complete="currentStep > 1"
                  :value="1"
                  color="primary"
                >
                  <template v-slot:default>
                    <div>
                      <v-icon>mdi-upload</v-icon>
                      <v-stepper-item-title>Cargar Archivo</v-stepper-item-title>
                    </div>
                  </template>
                </v-stepper-item>

                <v-stepper-item
                  :complete="currentStep > 2"
                  :value="2"
                  color="primary"
                >
                  <template v-slot:default>
                    <div>
                      <v-icon>mdi-brain</v-icon>
                      <v-stepper-item-title>Mapeo con IA</v-stepper-item-title>
                    </div>
                  </template>
                </v-stepper-item>

                <v-stepper-item
                  :complete="currentStep > 3"
                  :value="3"
                  color="primary"
                >
                  <template v-slot:default>
                    <div>
                      <v-icon>mdi-check-all</v-icon>
                      <v-stepper-item-title>Revisar y Migrar</v-stepper-item-title>
                    </div>
                  </template>
                </v-stepper-item>

                <v-stepper-item
                  :complete="currentStep > 4"
                  :value="4"
                  color="primary"
                >
                  <template v-slot:default>
                    <div>
                      <v-icon>mdi-progress-download</v-icon>
                      <v-stepper-item-title>Procesando</v-stepper-item-title>
                    </div>
                  </template>
                </v-stepper-item>
              </v-stepper-header>

              <v-divider></v-divider>

              <v-stepper-window v-model="currentStep">
                <!-- Step 1: Upload File -->
                <v-stepper-window-item :value="1">
                  <FileUpload
                    :file="selectedFile"
                    :target-model="targetModel"
                    @file-selected="handleFileSelected"
                    @target-model-changed="handleTargetModelChanged"
                    @next="goToStep(2)"
                  />
                </v-stepper-window-item>

                <!-- Step 2: AI Mapping -->
                <v-stepper-window-item :value="2">
                  <MappingPreview
                    :loading="analyzing"
                    :mappings="mappings"
                    :source-columns="sourceColumns"
                    :target-model="targetModel"
                    :statistics="mappingStatistics"
                    @mappings-updated="handleMappingsUpdated"
                    @analyze="handleAnalyze"
                    @previous="goToStep(1)"
                    @next="goToStep(3)"
                  />
                </v-stepper-window-item>

                <!-- Step 3: Review and Confirm -->
                <v-stepper-window-item :value="3">
                  <v-card variant="outlined" class="mb-4">
                    <v-card-title class="text-h6">
                      <v-icon start color="success">mdi-check-circle</v-icon>
                      Revisar Antes de Migrar
                    </v-card-title>
                    <v-card-text>
                      <v-alert type="info" variant="tonal" class="mb-4">
                        <strong>Resumen de la migración:</strong>
                        <ul class="mt-2">
                          <li>Archivo: {{ selectedFile?.name }}</li>
                          <li>Tipo: {{ selectedFile?.type }}</li>
                          <li>Modelo destino: {{ targetModel }}</li>
                          <li>Filas totales: {{ mappingStatistics.totalRows || 0 }}</li>
                          <li>Filas válidas: {{ mappingStatistics.validRows || 0 }}</li>
                          <li>Confianza promedio: {{ ((mappingStatistics.avgConfidence || 0) * 100).toFixed(1) }}%</li>
                        </ul>
                      </v-alert>

                      <v-alert
                        v-if="mappingStatistics.invalidRows > 0"
                        type="warning"
                        variant="tonal"
                      >
                        <strong>Advertencia:</strong> {{ mappingStatistics.invalidRows }} filas tienen errores de validación.
                        Serán omitidas durante la migración.
                      </v-alert>
                    </v-card-text>
                  </v-card>

                  <v-card variant="outlined" class="mb-4">
                    <v-card-title class="text-h6">
                      <v-icon start color="primary">mdi-map</v-icon>
                      Mapeo de Columnas
                    </v-card-title>
                    <v-card-text>
                      <v-table density="compact" hover>
                        <thead>
                          <tr>
                            <th>Columna Origen</th>
                            <th>Campo Destino</th>
                            <th>Transformación</th>
                            <th>Confianza</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="(mapping, index) in mappings" :key="index">
                            <td>
                              <v-chip size="small" color="blue" variant="outlined">
                                {{ mapping.sourceColumn }}
                              </v-chip>
                            </td>
                            <td>
                              <v-chip size="small" color="green" variant="tonal">
                                {{ mapping.targetField }}
                              </v-chip>
                            </td>
                            <td>
                              <v-chip v-if="mapping.transformation" size="small" color="orange" variant="outlined">
                                {{ mapping.transformation }}
                              </v-chip>
                              <span v-else class="text-grey">-</span>
                            </td>
                            <td>
                              <v-progress-linear
                                :model-value="mapping.confidence * 100"
                                :color="getConfidenceColor(mapping.confidence)"
                                height="20"
                                rounded
                              >
                                <strong>{{ (mapping.confidence * 100).toFixed(0) }}%</strong>
                              </v-progress-linear>
                            </td>
                          </tr>
                        </tbody>
                      </v-table>
                    </v-card-text>
                  </v-card>
                </v-stepper-window-item>

                <!-- Step 4: Processing -->
                <v-stepper-window-item :value="4">
                  <v-card variant="outlined" class="text-center py-8">
                    <v-card-text>
                      <v-progress-circular
                        :size="100"
                        :model-value="migrationProgress"
                        color="primary"
                        width="10"
                        class="mb-4"
                      >
                        {{ migrationProgress }}%
                      </v-progress-circular>

                      <h3 class="text-h6 mb-2">
                        {{ migrationStatusText }}
                      </h3>
                      <p class="text-body-2 text-grey">
                        {{ migrationDetailsText }}
                      </p>

                      <v-alert
                        v-if="migrationResult"
                        :type="migrationResult.success ? 'success' : 'error'"
                        variant="tonal"
                        class="mt-6"
                      >
                        <strong>{{ migrationResult.success ? '¡Migración completada!' : 'Error en migración' }}</strong>
                        <div v-if="migrationResult.success" class="mt-2">
                          <ul>
                            <li>Filas procesadas: {{ migrationResult.totalRows }}</li>
                            <li>Filas importadas: {{ migrationResult.importedRows }}</li>
                            <li>Filas fallidas: {{ migrationResult.failedRows }}</li>
                            <li>Tiempo: {{ formatDuration(migrationResult.duration) }}</li>
                          </ul>
                        </div>
                        <div v-else>
                          <p class="mt-2">{{ migrationResult.errors?.[0] }}</p>
                        </div>
                      </v-alert>
                    </v-card-text>
                  </v-card>
                </v-stepper-window-item>
              </v-stepper-window>
            </v-stepper>
          </v-card-text>

          <v-card-actions class="pa-4">
            <v-spacer></v-spacer>
            <v-btn
              v-if="currentStep === 1"
              color="primary"
              :disabled="!selectedFile || !targetModel"
              @click="goToStep(2)"
            >
              Continuar
              <v-icon end>mdi-arrow-right</v-icon>
            </v-btn>

            <v-btn
              v-if="currentStep === 3"
              color="success"
              :loading="processing"
              @click="startMigration"
            >
              <v-icon start>mdi-play</v-icon>
              Iniciar Migración
            </v-btn>

            <v-btn
              v-if="currentStep === 4 && migrationResult"
              color="primary"
              @click="resetWizard"
            >
              Nueva Migración
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import FileUpload from '../../components/migration/FileUpload.vue';
import MappingPreview from '../../components/migration/MappingPreview.vue';
import { useToast } from 'vue-toastification';

interface Mapping {
  sourceColumn: string;
  targetField: string;
  confidence: number;
  transformation?: string;
}

interface MappingStatistics {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  avgConfidence: number;
}

interface MigrationResult {
  success: boolean;
  totalRows: number;
  importedRows: number;
  failedRows: number;
  errors?: string[];
  warnings?: string[];
  duration: number;
}

const toast = useToast();

// State
const currentStep = ref(1);
const selectedFile = ref<File | null>(null);
const targetModel = ref<'Paciente' | 'Consulta' | 'Cita'>('Paciente');
const analyzing = ref(false);
const processing = ref(false);
const mappings = ref<Mapping[]>([]);
const sourceColumns = ref<string[]>([]);
const mappingStatistics = ref<MappingStatistics>({
  totalRows: 0,
  validRows: 0,
  invalidRows: 0,
  avgConfidence: 0
});
const migrationProgress = ref(0);
const migrationResult = ref<MigrationResult | null>(null);

// Computed
const migrationStatusText = computed(() => {
  if (migrationResult.value) {
    return migrationResult.value.success ? 'Completado' : 'Fallido';
  }
  if (migrationProgress.value < 30) return 'Analizando archivo...';
  if (migrationProgress.value < 60) return 'Transformando datos...';
  if (migrationProgress.value < 90) return 'Importando registros...';
  return 'Finalizando...';
});

const migrationDetailsText = computed(() => {
  if (migrationResult.value) {
    return migrationResult.value.success
      ? `${migrationResult.value.importedRows} registros importados exitosamente`
      : 'Error durante el proceso';
  }
  return 'Por favor espere mientras procesamos su migración';
});

// Methods
const handleFileSelected = (file: File) => {
  selectedFile.value = file;
};

const handleTargetModelChanged = (model: 'Paciente' | 'Consulta' | 'Cita') => {
  targetModel.value = model;
};

const handleMappingsUpdated = (updatedMappings: Mapping[]) => {
  mappings.value = updatedMappings;
};

const handleAnalyze = async () => {
  if (!selectedFile.value) return;

  analyzing.value = true;
  try {
    // Simular análisis (en producción, llamar al backend)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Mock data - en producción esto viene del backend
    mappings.value = [
      {
        sourceColumn: 'nombre',
        targetField: 'nombres',
        confidence: 0.95,
        transformation: 'uppercase'
      },
      {
        sourceColumn: 'apellido',
        targetField: 'apellidos',
        confidence: 0.93,
        transformation: 'uppercase'
      },
      {
        sourceColumn: 'cedula',
        targetField: 'cedula',
        confidence: 0.98,
        transformation: 'trim'
      },
      {
        sourceColumn: 'fecha_nacimiento',
        targetField: 'fechaNacimiento',
        confidence: 0.90,
        transformation: 'date'
      },
      {
        sourceColumn: 'telefono',
        targetField: 'telefono',
        confidence: 0.85,
        transformation: 'phone'
      },
      {
        sourceColumn: 'email',
        targetField: 'email',
        confidence: 0.92,
        transformation: 'lowercase'
      }
    ];

    sourceColumns.value = ['nombre', 'apellido', 'cedula', 'fecha_nacimiento', 'telefono', 'email'];

    mappingStatistics.value = {
      totalRows: 1250,
      validRows: 1198,
      invalidRows: 52,
      avgConfidence: 0.92
    };

    toast.success('Análisis completado exitosamente');
    goToStep(2);
  } catch (error) {
    toast.error('Error analizando archivo');
    console.error(error);
  } finally {
    analyzing.value = false;
  }
};

const startMigration = async () => {
  processing.value = true;
  migrationProgress.value = 0;
  migrationResult.value = null;

  try {
    // Simular progreso de migración
    const progressInterval = setInterval(() => {
      if (migrationProgress.value < 95) {
        migrationProgress.value += 5;
      }
    }, 500);

    // Simular migración (en producción, llamar al backend y hacer polling)
    await new Promise(resolve => setTimeout(resolve, 5000));

    clearInterval(progressInterval);
    migrationProgress.value = 100;

    migrationResult.value = {
      success: true,
      totalRows: mappingStatistics.value.totalRows,
      importedRows: mappingStatistics.value.validRows,
      failedRows: mappingStatistics.value.invalidRows,
      errors: [],
      warnings: [],
      duration: 5234
    };

    toast.success('Migración completada exitosamente');
    goToStep(4);
  } catch (error: any) {
    migrationResult.value = {
      success: false,
      totalRows: 0,
      importedRows: 0,
      failedRows: 0,
      errors: [error.message || 'Error desconocido'],
      warnings: [],
      duration: 0
    };
    toast.error('Error en migración');
    console.error(error);
  } finally {
    processing.value = false;
  }
};

const goToStep = (step: number) => {
  currentStep.value = step;
};

const resetWizard = () => {
  currentStep.value = 1;
  selectedFile.value = null;
  targetModel.value = 'Paciente';
  mappings.value = [];
  sourceColumns.value = [];
  mappingStatistics.value = {
    totalRows: 0,
    validRows: 0,
    invalidRows: 0,
    avgConfidence: 0
  };
  migrationProgress.value = 0;
  migrationResult.value = null;
};

const getConfidenceColor = (confidence: number): string => {
  if (confidence >= 0.9) return 'success';
  if (confidence >= 0.7) return 'warning';
  return 'error';
};

const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
};
</script>

<style scoped>
.fill-height {
  min-height: calc(100vh - 64px);
}

.v-stepper {
  background: transparent !important;
  box-shadow: none !important;
}
</style>
