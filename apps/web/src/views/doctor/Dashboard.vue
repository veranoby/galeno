<template>
  <v-container fluid class="dashboard-container pa-6">
    <!-- Header -->
    <v-row class="mb-6">
      <v-col cols="12">
        <div class="d-flex align-center justify-space-between">
          <h1 class="text-h4 font-weight-bold">Dashboard</h1>
          <div class="d-flex align-center gap-3">
            <v-btn variant="elevated" color="primary" prepend-icon="mdi-plus" @click="crearNuevaConsulta">
              Nueva Consulta
            </v-btn>
            <v-menu>
              <template v-slot:activator="{ props }">
                <v-btn variant="outlined" v-bind="props" icon>
                  <v-icon>mdi-dots-vertical</v-icon>
                </v-btn>
              </template>
              <v-list>
                <v-list-item @click="verMiPerfil">
                  <v-list-item-title>Mi Perfil</v-list-item-title>
                </v-list-item>
                <v-list-item @click="verMiAgenda">
                  <v-list-item-title>Mi Agenda</v-list-item-title>
                </v-list-item>
                <v-list-item @click="verMisPacientes">
                  <v-list-item-title>Mis Pacientes</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-menu>
          </div>
        </div>
        <p class="text-subtitle-1 text-medium-emphasis mt-2">
          Bienvenido de nuevo, {{ user?.nombre || 'Dr.' }}. Aquí tienes un resumen de tus actividades.
        </p>
      </v-col>
    </v-row>

    <!-- Metrics Cards -->
    <v-row class="mb-6">
      <v-col cols="12" sm="6" md="3">
        <v-card class="metric-card" color="blue-lighten-5">
          <v-card-text class="pa-4">
            <div class="d-flex justify-space-between align-center">
              <div>
                <p class="text-caption text-medium-emphasis">Consultas Hoy</p>
                <p class="text-h4 font-weight-bold">{{ metricas.consultasHoy }}</p>
              </div>
              <v-icon size="x-large" color="primary">mdi-stethoscope</v-icon>
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" md="3">
        <v-card class="metric-card" color="green-lighten-5">
          <v-card-text class="pa-4">
            <div class="d-flex justify-space-between align-center">
              <div>
                <p class="text-caption text-medium-emphasis">Esta Semana</p>
                <p class="text-h4 font-weight-bold">{{ metricas.consultasSemana }}</p>
              </div>
              <v-icon size="x-large" color="green">mdi-calendar-week</v-icon>
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" md="3">
        <v-card class="metric-card" color="orange-lighten-5">
          <v-card-text class="pa-4">
            <div class="d-flex justify-space-between align-center">
              <div>
                <p class="text-caption text-medium-emphasis">Pendientes</p>
                <p class="text-h4 font-weight-bold">{{ metricas.consultasPendientes }}</p>
              </div>
              <v-icon size="x-large" color="orange">mdi-clock-time-four-outline</v-icon>
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" md="3">
        <v-card class="metric-card" color="purple-lighten-5">
          <v-card-text class="pa-4">
            <div class="d-flex justify-space-between align-center">
              <div>
                <p class="text-caption text-medium-emphasis">Este Mes</p>
                <p class="text-h4 font-weight-bold">{{ metricas.consultasMes }}</p>
              </div>
              <v-icon size="x-large" color="purple">mdi-calendar-month</v-icon>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Main Content -->
    <v-row>
      <!-- Consultas Pendientes -->
      <v-col cols="12" md="8">
        <v-card class="mb-6">
          <v-card-title class="d-flex justify-space-between align-center">
            <span>Consultas Pendientes</span>
            <v-btn variant="text" @click="verTodasLasConsultas">Ver todas</v-btn>
          </v-card-title>
          
          <v-card-text>
            <v-table v-if="consultasPendientes.length > 0" density="comfortable">
              <thead>
                <tr>
                  <th class="text-left">Paciente</th>
                  <th class="text-left">Motivo</th>
                  <th class="text-left">Fecha/Hora</th>
                  <th class="text-left">Estado</th>
                  <th class="text-left">Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="consulta in consultasPendientes" :key="consulta.id">
                  <td>
                    <div class="d-flex align-center">
                      <v-avatar size="36" color="primary" class="mr-3">
                        <span class="text-white text-subtitle-2">{{ getInitials(consulta.paciente.nombre) }}</span>
                      </v-avatar>
                      <div>
                        <div class="font-weight-medium">{{ consulta.paciente.nombre }}</div>
                        <div class="text-caption text-medium-emphasis">{{ consulta.paciente.cedula }}</div>
                      </div>
                    </div>
                  </td>
                  <td>{{ truncate(consulta.motivoConsulta, 30) }}</td>
                  <td>{{ formatDate(consulta.createdAt) }}</td>
                  <td>
                    <v-chip :color="getEstadoColor(consulta.estado)" size="small">
                      {{ getEstadoLabel(consulta.estado) }}
                    </v-chip>
                  </td>
                  <td>
                    <v-btn variant="text" size="small" @click="irAConsulta(consulta.id)">
                      <v-icon>mdi-eye</v-icon>
                    </v-btn>
                  </td>
                </tr>
              </tbody>
            </v-table>
            
            <div v-else class="text-center py-8">
              <v-icon size="x-large" class="mb-4">mdi-clipboard-text-outline</v-icon>
              <p class="text-h6">No hay consultas pendientes</p>
              <p class="text-medium-emphasis">Todas las consultas han sido atendidas</p>
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Agenda Próxima -->
      <v-col cols="12" md="4">
        <v-card class="mb-6">
          <v-card-title class="d-flex justify-space-between align-center">
            <span>Próximas Citas</span>
            <v-btn variant="text" @click="verMiAgenda">Ver agenda</v-btn>
          </v-card-title>
          
          <v-card-text>
            <div v-if="citasProximas.length > 0">
              <v-list density="compact">
                <v-list-item 
                  v-for="cita in citasProximas" 
                  :key="cita.id"
                  class="mb-2"
                  @click="verCita(cita.id)"
                >
                  <template v-slot:prepend>
                    <v-avatar size="40" color="secondary">
                      <span class="text-white text-subtitle-2">{{ getInitials(cita.paciente.nombre) }}</span>
                    </v-avatar>
                  </template>
                  
                  <v-list-item-title class="font-weight-medium">
                    {{ cita.paciente.nombre }}
                  </v-list-item-title>
                  <v-list-item-subtitle>
                    {{ formatDateTime(cita.fechaHora) }}
                  </v-list-item-subtitle>
                  
                  <template v-slot:append>
                    <v-chip 
                      :color="cita.tipo === 'presencial' ? 'primary' : 'info'" 
                      size="x-small"
                    >
                      {{ cita.tipo === 'presencial' ? 'Presencial' : 'Teleconsulta' }}
                    </v-chip>
                  </template>
                </v-list-item>
              </v-list>
            </div>
            
            <div v-else class="text-center py-6">
              <v-icon size="x-large" class="mb-4">mdi-calendar-blank-outline</v-icon>
              <p class="text-h6">No hay citas próximas</p>
              <p class="text-medium-emphasis">No tienes citas programadas</p>
            </div>
          </v-card-text>
        </v-card>

        <!-- Accesos Rápidos -->
        <v-card>
          <v-card-title>Accesos Rápidos</v-card-title>
          
          <v-card-text>
            <v-row>
              <v-col cols="6">
                <v-btn 
                  variant="outlined" 
                  block 
                  class="d-flex flex-column h-100"
                  @click="buscarPaciente"
                >
                  <v-icon size="x-large" class="mb-2">mdi-account-search</v-icon>
                  <span>Buscar Paciente</span>
                </v-btn>
              </v-col>
              <v-col cols="6">
                <v-btn 
                  variant="outlined" 
                  block 
                  class="d-flex flex-column h-100"
                  @click="verMisPacientes"
                >
                  <v-icon size="x-large" class="mb-2">mdi-account-group</v-icon>
                  <span>Mis Pacientes</span>
                </v-btn>
              </v-col>
              <v-col cols="6">
                <v-btn 
                  variant="outlined" 
                  block 
                  class="d-flex flex-column h-100"
                  @click="verEstadisticas"
                >
                  <v-icon size="x-large" class="mb-2">mdi-chart-line</v-icon>
                  <span>Estadísticas</span>
                </v-btn>
              </v-col>
              <v-col cols="6">
                <v-btn 
                  variant="outlined" 
                  block 
                  class="d-flex flex-column h-100"
                  @click="verInterconsultas"
                >
                  <v-icon size="x-large" class="mb-2">mdi-message-processing</v-icon>
                  <span>Interconsultas</span>
                </v-btn>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { apiClient } from '@/services/api';
import { ClinicalAlert, CitaProxima } from '@galeno/shared-types';
import { useSSE } from '@/composables/useSSE.js';

// Types
interface Usuario {
  id: string;
  nombre: string;
  email: string;
  especialidad?: string;
}

interface Consulta {
  id: string;
  paciente: {
    id: string;
    nombre: string;
    cedula: string;
  };
  motivoConsulta?: string;
  createdAt: string;
  estado: string;
}

type Cita = CitaProxima;

interface Metricas {
  consultasHoy: number;
  consultasSemana: number;
  consultasPendientes: number;
  consultasMes: number;
}

// Reactive data
const router = useRouter();
const loading = ref(true);
const user = ref<Usuario | null>(null);
const metricas = ref<Metricas>({
  consultasHoy: 0,
  consultasSemana: 0,
  consultasPendientes: 0,
  consultasMes: 0
});
const consultasPendientes = ref<Consulta[]>([]);
const citasProximas = ref<Cita[]>([]);

// Initialize SSE for real-time updates
let sseConnection: ReturnType<typeof useSSE> | null = null;

// Methods
const cargarDashboard = async () => {
  try {
    // Load user info
    const profileResponse = await apiClient.get<{data: Usuario}>('/api/v1/users/profile');
    if (profileResponse.success && profileResponse.data) {
      user.value = profileResponse.data.data;
    }

    // Load metrics
    const metricsResponse = await apiClient.get<{data: Metricas}>('/api/v1/doctor/dashboard/metrics');
    if (metricsResponse.success && metricsResponse.data) {
      metricas.value = metricsResponse.data.data;
    }

    // Load pending consultations
    const consultasResponse = await apiClient.get<{data: Consulta[]}>('/api/v1/consultas?estado=pendiente,en_atencion&limit=5');
    if (consultasResponse.success && consultasResponse.data) {
      consultasPendientes.value = consultasResponse.data.data;
    }

    // Load upcoming appointments from the new endpoint
    if (user.value?.id) {
      const citasResponse = await apiClient.get<{data: Cita[]}>('/api/v1/agenda/citas/proximas?limit=5');
      if (citasResponse.success && citasResponse.data) {
        citasProximas.value = citasResponse.data.data || [];
      } else {
        // Fallback to empty array if there's an error
        citasProximas.value = [];
      }
    } else {
      citasProximas.value = [];
    }
  } catch (error) {
    console.error('Error cargando dashboard:', error);
  } finally {
    loading.value = false;
  }
};

// Refresh pending consultations when triage is completed
const actualizarConsultasPendientes = async () => {
  try {
    const consultasResponse = await apiClient.get<{data: Consulta[]}>('/api/v1/consultas?estado=pendiente,en_atencion&limit=5');
    if (consultasResponse.success && consultasResponse.data) {
      consultasPendientes.value = consultasResponse.data.data;
      // Update the pending consultations metric
      metricas.value.consultasPendientes = consultasResponse.data.data.length;
    }
  } catch (error) {
    console.error('Error actualizando consultas pendientes:', error);
  }
};

// Navigation methods
const crearNuevaConsulta = () => {
  router.push('/consultas/nueva');
};

const verMiPerfil = () => {
  router.push('/perfil');
};

const verMiAgenda = () => {
  router.push('/agenda');
};

const verMisPacientes = () => {
  router.push('/pacientes');
};

const verTodasLasConsultas = () => {
  router.push('/consultas');
};

const irAConsulta = (id: string) => {
  router.push(`/consultas/${id}`);
};

const verCita = (id: string) => {
  router.push(`/agenda/citas/${id}`);
};

const buscarPaciente = () => {
  router.push('/pacientes/buscar');
};

const verEstadisticas = () => {
  router.push('/estadisticas');
};

const verInterconsultas = () => {
  router.push('/interconsultas');
};

// Helper methods
const getInitials = (name?: string) => {
  if (!name) return '';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().substr(0, 2);
};

const truncate = (str: string, length: number) => {
  if (!str) return '';
  return str.length > length ? str.substring(0, length) + '...' : str;
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('es-EC', {
    day: '2-digit',
    month: 'short'
  });
};

const formatDateTime = (dateStr: string) => {
  return new Date(dateStr).toLocaleString('es-EC', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getEstadoColor = (estado: string) => {
  const colores: Record<string, string> = {
    pendiente: 'warning',
    en_atencion: 'primary',
    finalizada: 'success',
    triaje: 'info'
  };
  return colores[estado] || 'grey';
};

const getEstadoLabel = (estado: string) => {
  const labels: Record<string, string> = {
    pendiente: 'Pendiente',
    en_atencion: 'En Atención',
    finalizada: 'Finalizada',
    triaje: 'Triaje'
  };
  return labels[estado] || estado;
};

// Lifecycle
onMounted(async () => {
  await cargarDashboard();
  
  // Initialize SSE connection if user is loaded
  if (user.value?.id) {
    sseConnection = useSSE(user.value.id);
    sseConnection.connect();
    
    // Listen for triage completion events
    window.addEventListener('sse-TRIAGE_COMPLETED', handleTriageCompletion);
  }
});

onUnmounted(() => {
  // Disconnect SSE when component is unmounted
  if (sseConnection) {
    sseConnection.disconnect();
  }
  
  // Remove event listener
  window.removeEventListener('sse-TRIAGE_COMPLETED', handleTriageCompletion);
});

// Handle triage completion events
const handleTriageCompletion = (event: Event) => {
  console.log('Triage completion received:', (event as CustomEvent).detail);
  // Refresh pending consultations when triage is completed
  actualizarConsultasPendientes();
};
</script>

<style scoped>
.dashboard-container {
  background-color: #fafafa;
  min-height: calc(100vh - 64px); /* Adjust based on header height */
}

.metric-card {
  border-left: 4px solid;
}

.metric-card.blue-lighten-5 {
  border-left-color: #bbdefb;
}

.metric-card.green-lighten-5 {
  border-left-color: #c8e6c9;
}

.metric-card.orange-lighten-5 {
  border-left-color: #ffe0b2;
}

.metric-card.purple-lighten-5 {
  border-left-color: #e1bee7;
}
</style>