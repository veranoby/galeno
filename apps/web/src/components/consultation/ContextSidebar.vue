<template>
  <div class="context-sidebar">
    <!-- Loading State -->
    <div v-if="loading" class="loading-state pa-4">
      <v-skeleton-loader type="list-item-avatar-three-line, list-item-two-line, list-item" />
    </div>

    <!-- Content when loaded -->
    <template v-else>
      <!-- Info del Paciente -->
      <div class="patient-section">
        <div class="section-title">
          <v-icon icon="mdi-account" size="small" class="mr-1" />
          Paciente
        </div>

        <v-list density="compact" class="patient-info">
          <v-list-item>
            <v-list-item-title class="font-weight-medium">
              {{ paciente?.nombre || 'N/A' }}
            </v-list-item-title>
            <v-list-item-subtitle v-if="paciente?.cedula">
              HC: {{ paciente.cedula }}
            </v-list-item-subtitle>
          </v-list-item>

          <v-list-item>
            <v-list-item-title class="text-caption text-grey-darken-1">
              Edad: {{ calcularEdad(paciente?.fechaNacimiento) }} años
            </v-list-item-title>
          </v-list-item>

          <v-list-item v-if="paciente?.telefono">
            <template v-slot:prepend>
              <v-icon icon="mdi-phone" size="x-small" />
            </template>
            <v-list-item-title class="text-caption">
              {{ paciente.telefono }}
            </v-list-item-title>
          </v-list-item>

          <v-list-item v-if="paciente?.email">
            <template v-slot:prepend>
              <v-icon icon="mdi-email" size="x-small" />
            </template>
            <v-list-item-title class="text-caption">
              {{ paciente.email }}
            </v-list-item-title>
          </v-list-item>
        </v-list>
      </div>

      <v-divider />

      <!-- Última Consulta -->
      <div class="last-consultation-section" v-if="ultimaConsulta">
        <div class="section-title">
          <v-icon icon="mdi-history" size="small" class="mr-1" />
          Última Consulta
        </div>

        <v-card
          variant="outlined"
          class="last-consulta-card"
          @click="irAConsulta(ultimaConsulta.id)"
          hover
        >
          <v-card-text class="pa-3">
            <div class="d-flex align-center justify-space-between mb-2">
              <span class="text-caption text-grey-darken-1">
                {{ formatDate(ultimaConsulta.createdAt) }}
              </span>
              <v-chip
                :color="getEstadoColor(ultimaConsulta.estado)"
                size="x-small"
              >
                {{ getEstadoLabel(ultimaConsulta.estado) }}
              </v-chip>
            </div>

            <div class="text-body-2 mb-1" v-if="ultimaConsulta.motivoConsulta">
              {{ ultimaConsulta.motivoConsulta }}
            </div>

            <div class="text-caption text-grey-darken-1">
              Dr. {{ ultimaConsulta.doctor?.nombre || 'N/A' }}
            </div>
          </v-card-text>
        </v-card>
      </div>

      <v-divider v-if="ultimaConsulta" />

      <!-- Alertas -->
      <div class="alerts-section" v-if="alertas && alertas.length > 0">
        <div class="section-title">
          <v-icon icon="mdi-bell" size="small" class="mr-1" />
          Alertas ({{ alertas.length }})
        </div>

        <v-list density="compact" class="alerts-list">
          <v-list-item
            v-for="alerta in alertas.slice(0, 3)"
            :key="alerta.id"
            class="alert-item"
          >
            <template v-slot:prepend>
              <v-icon
                :icon="getAlertaIcon(alerta.type)"
                :color="getAlertaColor(alerta.severity)"
                size="small"
              />
            </template>

            <v-list-item-title class="text-caption">
              {{ alerta.title }}
            </v-list-item-title>
            <v-list-item-subtitle class="text-caption text-grey-darken-1">
              {{ alerta.description }}
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>

        <v-btn
          v-if="alertas.length > 3"
          variant="text"
          size="small"
          block
          class="mt-1"
          @click="$emit('ver-mas-alertas')"
        >
          Ver {{ alertas.length - 3 }} más
        </v-btn>
      </div>

      <v-divider v-if="alertas && alertas.length > 0" />

      <!-- Acciones Rápidas -->
      <div class="actions-section">
        <div class="section-title">
          <v-icon icon="mdi-lightning-bolt" size="small" class="mr-1" />
          Acciones
        </div>

        <div class="actions-grid">
          <v-btn
            variant="outlined"
            size="small"
            class="action-btn"
            @click="$emit('ver-historial')"
          >
            <v-icon icon="mdi-history" size="small" />
            <span class="text-caption">Historial</span>
          </v-btn>

          <v-btn
            variant="outlined"
            size="small"
            class="action-btn"
            @click="$emit('ver-documentos')"
          >
            <v-icon icon="mdi-file-document" size="small" />
            <span class="text-caption">Docs</span>
          </v-btn>

          <v-btn
            variant="outlined"
            size="small"
            class="action-btn"
            @click="$emit('ver-recetas')"
          >
            <v-icon icon="mdi-pill" size="small" />
            <span class="text-caption">Recetas</span>
          </v-btn>

          <v-btn
            variant="outlined"
            size="small"
            class="action-btn"
            @click="$emit('ver-antecedentes')"
          >
            <v-icon icon="mdi-heart-pulse" size="small" />
            <span class="text-caption">Antec.</span>
          </v-btn>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { apiClient } from '@/services/api';

// Interfaces
import { ClinicalAlert } from '@galeno/shared-types';

interface Paciente {
  id: string;
  nombre: string;
  cedula: string;
  fechaNacimiento: Date | string;
  telefono?: string;
  email?: string;
}

interface Consulta {
  id: string;
  createdAt: Date | string;
  estado: string;
  motivoConsulta?: string;
  doctor?: {
    nombre: string;
  };
}

interface Alerta extends ClinicalAlert {}

// Props
interface Props {
  pacienteId?: string;
  consultaId?: string;
}

const props = defineProps<Props>();

// Reactive data
const paciente = ref<Paciente | null>(null);
const ultimaConsulta = ref<Consulta | null>(null);
const alertas = ref<Alerta[]>([]);
const loading = ref(true);

// Emits
const emit = defineEmits<{
  'ver-mas-alertas': [];
  'ver-historial': [];
  'ver-documentos': [];
  'ver-recetas': [];
  'ver-antecedentes': [];
}>();

// Router
const router = useRouter();

// Methods
const cargarContexto = async () => {
  if (!props.pacienteId && !props.consultaId) {
    loading.value = false;
    return;
  }

  try {
    // Load patient data
    if (props.pacienteId) {
      const pacienteResponse = await apiClient.get<{data: Paciente}>(`/api/v1/pacientes/${props.pacienteId}`);
      if (pacienteResponse.success && pacienteResponse.data) {
        paciente.value = pacienteResponse.data.data;
      }
    }

    // Load last consultation
    if (props.pacienteId) {
      const consultasResponse = await apiClient.get<{data: Consulta[]}>(`/api/v1/consultas?pacienteId=${props.pacienteId}&limit=1`);
      if (consultasResponse.success && consultasResponse.data?.data && consultasResponse.data.data.length > 0) {
        ultimaConsulta.value = consultasResponse.data.data[0];
      }
    }

    // Load clinical alerts from the new endpoint
    if (props.pacienteId) {
      const alertasResponse = await apiClient.get<{data: Alerta[]}>(`/api/v1/pacientes/${props.pacienteId}/alertas`);
      if (alertasResponse.success && alertasResponse.data?.data) {
        alertas.value = alertasResponse.data.data || [];
      }
    }
  } catch (error) {
    console.error('Error cargando contexto del paciente:', error);
  } finally {
    loading.value = false;
  }
};

// Lifecycle
onMounted(() => {
  cargarContexto();
});

// Métodos
const calcularEdad = (fechaNacimiento?: Date | string): number => {
  if (!fechaNacimiento) return 0;

  const fecha = new Date(fechaNacimiento);
  const hoy = new Date();
  let edad = hoy.getFullYear() - fecha.getFullYear();
  const mes = hoy.getMonth() - fecha.getMonth();

  if (mes < 0 || (mes === 0 && hoy.getDate() < fecha.getDate())) {
    edad--;
  }

  return edad;
};

const formatDate = (date: Date | string): string => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('es-EC', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const getEstadoColor = (estado: string): string => {
  const colores: Record<string, string> = {
    borrador: 'grey',
    triaje: 'info',
    pendiente: 'warning',
    en_atencion: 'primary',
    finalizada: 'success',
    interconsulta: 'purple'
  };
  return colores[estado] || 'grey';
};

const getEstadoLabel = (estado: string): string => {
  const labels: Record<string, string> = {
    borrador: 'Borrador',
    triaje: 'Triaje',
    pendiente: 'Pendiente',
    en_atencion: 'En Atención',
    finalizada: 'Finalizada',
    interconsulta: 'Interconsulta'
  };
  return labels[estado] || estado;
};

const getAlertaIcon = (tipo: string): string => {
  const iconos: Record<string, string> = {
    allergy: 'mdi-allergy',
    medication: 'mdi-pill',
    chronic_condition: 'mdi-heart-pulse',
    vital_risk: 'mdi-alert-circle',
    drug_interaction: 'mdi-flask',
    medical_history: 'mdi-history',
    warning: 'mdi-alert',
    error: 'mdi-alert-circle',
    info: 'mdi-information',
    success: 'mdi-check-circle'
  };
  return iconos[tipo] || 'mdi-information';
};

const getAlertaColor = (severity: string): string => {
  const colores: Record<string, string> = {
    critical: 'error',
    high: 'warning',
    medium: 'info',
    low: 'success',
    warning: 'warning',
    error: 'error',
    info: 'info',
    success: 'success'
  };
  return colores[severity] || 'info';
};

const irAConsulta = (consultaId: string) => {
  router.push(`/consultas/${consultaId}`);
};
</script>

<style scoped>
.context-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.section-title {
  display: flex;
  align-items: center;
  padding: 0.5rem 1rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #666;
}

.patient-section,
.last-consultation-section,
.alerts-section,
.actions-section {
  padding: 0.5rem 0;
}

.patient-info {
  padding: 0;
}

.last-consulta-card {
  margin: 0.5rem 1rem;
  cursor: pointer;
  transition: transform 0.2s;
}

.last-consulta-card:hover {
  transform: translateX(4px);
}

.alerts-list {
  padding: 0;
}

.alert-item {
  padding: 0.5rem 1rem;
  min-height: auto !important;
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
  padding: 0.5rem 1rem 1rem;
}

.action-btn {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  height: auto;
  padding: 0.5rem;
}

/* Scrollbar personalizado */
:deep(.v-list) {
  overflow-y: auto;
}

:deep(.v-list)::-webkit-scrollbar {
  width: 4px;
}

:deep(.v-list)::-webkit-scrollbar-thumb {
  background-color: #ddd;
  border-radius: 4px;
}

:deep(.v-list)::-webkit-scrollbar-track {
  background-color: transparent;
}
</style>
