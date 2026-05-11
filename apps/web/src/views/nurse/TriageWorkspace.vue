<template>
  <v-container fluid class="triage-workspace pa-6">
    <!-- Header -->
    <v-row class="mb-6">
      <v-col cols="12">
        <div class="d-flex align-center justify-space-between">
          <div>
            <h1 class="text-h4 font-weight-bold">
              <v-icon start color="primary">mdi-hospital-box</v-icon>
              Triaje Colaborativo
            </h1>
            <p class="text-subtitle-1 text-medium-emphasis mt-2">
              Captura de signos vitales y gestión de triaje
            </p>
          </div>
          <div class="d-flex align-center gap-3">
            <v-chip color="primary" variant="tonal">
              <v-icon start>mdi-clock-outline</v-icon>
              {{ colaTriaje.length }} en cola
            </v-chip>
            <v-btn
              variant="outlined"
              prepend-icon="mdi-refresh"
              :loading="loading"
              @click="cargarCola"
            >
              Actualizar
            </v-btn>
          </div>
        </div>
      </v-col>
    </v-row>

    <!-- Alerta nuevo triaje completado (SSE) -->
    <v-alert
      v-if="nuevaNotificacion"
      type="success"
      variant="tonal"
      closable
      class="mb-4"
      @click:close="nuevaNotificacion = false"
    >
      <template v-slot:title>
        <div class="d-flex align-center">
          <v-icon start color="success">mdi-check-circle</v-icon>
          ¡Triaje completado!
        </div>
      </template>
      <template v-slot:text>
        Paciente listo para atención médica
      </template>
    </v-alert>

    <!-- Lista de pacientes en cola -->
    <v-row class="mb-6">
      <v-col cols="12">
        <v-card>
          <v-card-title>
            <v-icon start color="primary">mdi-format-list-bulleted</v-icon>
            Pacientes en Cola de Triaje
          </v-card-title>

          <v-card-text>
            <v-data-table
              :headers="headersCola"
              :items="colaTriaje"
              :loading="loading"
              loading-text="Cargando cola..."
              no-data-text="No hay pacientes en cola"
              class="elevation-0"
              @click:row="seleccionarPaciente"
            >
              <!-- Prioridad -->
              <template v-slot:item.prioridad="{ item }">
                <v-chip
                  :color="getPrioridadColor(item.prioridad)"
                  size="small"
                  variant="tonal"
                >
                  {{ getPrioridadLabel(item.prioridad) }}
                </v-chip>
              </template>

              <!-- Estado -->
              <template v-slot:item.estado="{ item }">
                <v-chip
                  :color="item.estado === 'completado' ? 'success' : 'warning'"
                  size="small"
                  variant="tonal"
                >
                  {{ item.estado === 'completado' ? 'Completado' : 'En proceso' }}
                </v-chip>
              </template>

              <!-- Acciones -->
              <template v-slot:item.actions="{ item }">
                <v-btn
                  size="small"
                  variant="text"
                  icon="mdi-plus"
                  color="primary"
                  @click.stop="iniciarTriaje(item)"
                />
              </template>
            </v-data-table>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Formulario de Triaje -->
    <v-row v-if="pacienteSeleccionado">
      <v-col cols="12">
        <v-card class="mb-4">
          <v-card-title class="d-flex align-center">
            <v-icon start color="primary">mdi-account</v-icon>
            Paciente: {{ pacienteSeleccionado.nombre }}
            <v-spacer />
            <v-btn
              size="small"
              variant="text"
              icon="mdi-close"
              @click="pacienteSeleccionado = null"
            />
          </v-card-title>
        </v-card>

        <CollaborativeTriage
          ref="triageFormRef"
          @guardar-borrador="guardarBorrador"
          @completar="completarTriaje"
          @cancelar="cancelarTriaje"
        />
      </v-col>
    </v-row>

    <!-- Notificación Toast -->
    <v-snackbar
      v-model="snackbar"
      :color="snackbarColor"
      :timeout="3000"
      location="top right"
    >
      {{ snackbarMessage }}
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useTriage } from '@/composables/useTriage';
import CollaborativeTriage from '@/components/triage/CollaborativeTriage.vue';

// Estado
const loading = ref(false);
const colaTriaje = ref<any[]>([]);
const pacienteSeleccionado = ref<any | null>(null);
const triageFormRef = ref<InstanceType<typeof CollaborativeTriage> | null>(null);
const nuevaNotificacion = ref(false);

// Snackbar
const snackbar = ref(false);
const snackbarColor = ref('success');
const snackbarMessage = ref('');

// Headers de la tabla
const headersCola = [
  { title: 'Paciente', key: 'nombre', sortable: true },
  { title: 'Cédula', key: 'cedula', sortable: true },
  { title: 'Prioridad', key: 'prioridad', sortable: true },
  { title: 'Estado', key: 'estado', sortable: true },
  { title: 'Hora llegada', key: 'horaLlegada', sortable: true },
  { title: 'Acciones', key: 'actions', sortable: false, align: 'end' as const }
];

// Composable
const {
  capturarTriaje,
  obtenerColaTriaje,
  calcularPrioridad
} = useTriage();

// Cargar cola de triaje
async function cargarCola() {
  loading.value = true;
  const data = await obtenerColaTriaje();
  colaTriaje.value = data;
  loading.value = false;
}

// Seleccionar paciente de la tabla
function seleccionarPaciente(_item: any, _event: Event) {
  // Implementar selección desde tabla
}

// Iniciar triaje para un paciente
function iniciarTriaje(paciente: any) {
  pacienteSeleccionado.value = paciente;
}

// Guardar borrador
async function guardarBorrador(data: any) {
  if (!pacienteSeleccionado.value?.consultaId) {
    mostrarSnackbar('Seleccione un paciente primero', 'warning');
    return;
  }

  loading.value = true;

  try {
    const prioridad = calcularPrioridad({
      bloodPressure: data.bloodPressure,
      heartRate: data.heartRate,
      temperature: data.temperature,
      respiratoryRate: data.respiratoryRate,
      oxygenSaturation: data.oxygenSaturation,
      weight: data.weight,
      height: data.height
    });

    await capturarTriaje(pacienteSeleccionado.value.consultaId, {
      pacienteId: pacienteSeleccionado.value.pacienteId,
      consultaId: pacienteSeleccionado.value.consultaId,
      signosVitales: {
        bloodPressure: data.bloodPressure,
        heartRate: data.heartRate,
        temperature: data.temperature,
        respiratoryRate: data.respiratoryRate,
        oxygenSaturation: data.oxygenSaturation,
        weight: data.weight,
        height: data.height
      },
      motivo: data.motivo,
      sintomas: data.sintomas,
      prioridad,
      allergyStatus: data.allergyStatus,
      currentMedications: data.currentMedications,
      painLevel: data.painLevel,
      notes: data.notes,
      isComplete: false
    });

    mostrarSnackbar('Borrador guardado correctamente', 'success');
    await cargarCola();
  } catch (error) {
    mostrarSnackbar('Error al guardar borrador', 'error');
  } finally {
    loading.value = false;
  }
}

// Completar triaje
async function completarTriaje(data: any) {
  if (!pacienteSeleccionado.value?.consultaId) {
    mostrarSnackbar('Seleccione un paciente primero', 'warning');
    return;
  }

  loading.value = true;

  try {
    const prioridad = calcularPrioridad({
      bloodPressure: data.bloodPressure,
      heartRate: data.heartRate,
      temperature: data.temperature,
      respiratoryRate: data.respiratoryRate,
      oxygenSaturation: data.oxygenSaturation,
      weight: data.weight,
      height: data.height
    });

    await capturarTriaje(
      pacienteSeleccionado.value.consultaId,
      {
        pacienteId: pacienteSeleccionado.value.pacienteId,
        consultaId: pacienteSeleccionado.value.consultaId,
        signosVitales: {
          bloodPressure: data.bloodPressure,
          heartRate: data.heartRate,
          temperature: data.temperature,
          respiratoryRate: data.respiratoryRate,
          oxygenSaturation: data.oxygenSaturation,
          weight: data.weight,
          height: data.height
        },
        motivo: data.motivo,
        sintomas: data.sintomas,
        prioridad,
        allergyStatus: data.allergyStatus,
        currentMedications: data.currentMedications,
        painLevel: data.painLevel,
        notes: data.notes,
        isComplete: true
      },
      true
    );

    mostrarSnackbar('Triaje completado - Doctor notificado', 'success');
    pacienteSeleccionado.value = null;
    triageFormRef.value?.resetForm();
    await cargarCola();
  } catch (error) {
    mostrarSnackbar('Error al completar triaje', 'error');
  } finally {
    loading.value = false;
  }
}

// Cancelar triaje
function cancelarTriaje() {
  pacienteSeleccionado.value = null;
  triageFormRef.value?.resetForm();
}

// Helpers UI
function getPrioridadColor(prioridad: string): string {
  const colors: Record<string, string> = {
    baja: 'success',
    media: 'warning',
    alta: 'error'
  };
  return colors[prioridad] || 'default';
}

function getPrioridadLabel(prioridad: string): string {
  const labels: Record<string, string> = {
    baja: 'Baja',
    media: 'Media',
    alta: 'Alta'
  };
  return labels[prioridad] || prioridad;
}

// Mostrar snackbar
function mostrarSnackbar(message: string, color: string) {
  snackbarMessage.value = message;
  snackbarColor.value = color;
  snackbar.value = true;
}

// Lifecycle
onMounted(() => {
  cargarCola();
});
</script>

<style scoped>
.triage-workspace {
  max-width: 1400px;
}
</style>
