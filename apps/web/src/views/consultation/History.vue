<template>
  <v-container fluid>
    <div class="d-flex align-center justify-space-between mb-4">
      <div>
        <h1 class="text-h4">Historial de Consultas</h1>
        <p class="text-body-1 text-grey-darken-1">Consulta y filtra el historial médico</p>
      </div>
      <v-btn color="primary" variant="elevated" to="/consultas">
        <v-icon start>mdi-plus</v-icon>
        Nueva Consulta
      </v-btn>
    </div>

    <!-- Filters Card -->
    <v-card class="mb-4">
      <v-card-text>
        <v-row>
          <!-- Search -->
          <v-col cols="12" md="4">
            <v-text-field
              v-model="filters.search"
              prepend-icon="mdi-magnify"
              label="Buscar..."
              single-line
              hide-details
              variant="outlined"
              density="compact"
              clearable
              @update:model-value="onSearchChange"
            />
          </v-col>

          <!-- Estado Filter -->
          <v-col cols="12" sm="6" md="2">
            <v-select
              v-model="filters.estado"
              :items="estadoOptions"
              label="Estado"
              variant="outlined"
              density="compact"
              hide-details
              clearable
              @update:model-value="fetchConsultas"
            />
          </v-col>

          <!-- Date From -->
          <v-col cols="12" sm="6" md="2">
            <v-text-field
              v-model="filters.from"
              label="Desde"
              type="date"
              variant="outlined"
              density="compact"
              hide-details
              @update:model-value="fetchConsultas"
            />
          </v-col>

          <!-- Date To -->
          <v-col cols="12" sm="6" md="2">
            <v-text-field
              v-model="filters.to"
              label="Hasta"
              type="date"
              variant="outlined"
              density="compact"
              hide-details
              @update:model-value="fetchConsultas"
            />
          </v-col>

          <!-- Clear Filters -->
          <v-col cols="12" sm="6" md="2">
            <v-btn
              block
              color="grey"
              variant="tonal"
              @click="clearFilters"
            >
              <v-icon start>mdi-filter-remove</v-icon>
              Limpiar
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- Results Info -->
    <v-alert
      v-if="hasActiveFilters"
      type="info"
      variant="tonal"
      density="compact"
      class="mb-4"
    >
      Mostrando {{ pagination.total }} resultado(s)
      <v-btn
        v-if="pagination.total > 0"
        size="small"
        variant="text"
        @click="clearFilters"
      >
        Limpiar filtros
      </v-btn>
    </v-alert>

    <!-- Consultas Table -->
    <v-card>
      <v-data-table-server
        :headers="headers"
        :items="consultas"
        :items-length="pagination.total"
        :loading="cargando"
        item-value="id"
        :page="pagination.page"
        :items-per-page="pagination.itemsPerPage"
        @update:page="onPageChange"
        @update:items-per-page="onItemsPerPageChange"
        hover
      >
        <!-- Fecha Column -->
        <template v-slot:item.createdAt="{ item }">
          {{ formatDate(item.createdAt) }}
        </template>

        <!-- Status Column -->
        <template v-slot:item.estado="{ item }">
          <v-chip :color="getEstadoColor(item.estado)" size="small">
            {{ getEstadoLabel(item.estado) }}
          </v-chip>
        </template>

        <!-- Signed Column -->
        <template v-slot:item.firmado="{ item }">
          <v-icon v-if="item.firmado" color="success" icon="mdi-check-circle" size="small" />
          <v-icon v-else color="grey" icon="mdi-circle-outline" size="small" />
        </template>

        <!-- Actions Column -->
        <template v-slot:item.acciones="{ item }">
          <v-btn
            icon="mdi-eye"
            size="small"
            variant="text"
            @click="verDetalle(item)"
          />
        </template>
      </v-data-table-server>
    </v-card>

    <!-- Detalle Dialog -->
    <v-dialog v-model="dialogoDetalleAbierto" max-width="800">
      <v-card v-if="consultaSeleccionada">
        <v-toolbar color="primary" density="comfortable">
          <v-toolbar-title class="text-white">Detalle de Consulta</v-toolbar-title>
          <v-spacer />
          <v-btn icon="mdi-close" variant="text" @click="dialogoDetalleAbierto = false" />
        </v-toolbar>

        <v-card-text class="pa-4">
          <v-list>
            <v-list-item>
              <v-list-item-title>Paciente</v-list-item-title>
              <v-list-item-subtitle>
                {{ consultaSeleccionada.paciente?.nombre }}
                ({{ consultaSeleccionada.paciente?.cedula }})
              </v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Doctor</v-list-item-title>
              <v-list-item-subtitle>
                {{ consultaSeleccionada.doctor?.nombre }}
                <span v-if="consultaSeleccionada.doctor?.especialidad" class="text-caption text-grey">
                  - {{ consultaSeleccionada.doctor.especialidad }}
                </span>
              </v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Fecha</v-list-item-title>
              <v-list-item-subtitle>{{ formatDateTime(consultaSeleccionada.createdAt) }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Estado</v-list-item-title>
              <v-list-item-subtitle>{{ getEstadoLabel(consultaSeleccionada.estado) }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item v-if="consultaSeleccionada.motivoConsulta">
              <v-list-item-title>Motivo</v-list-item-title>
              <v-list-item-subtitle>{{ consultaSeleccionada.motivoConsulta }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item v-if="consultaSeleccionada.evolucion">
              <v-list-item-title>Evolución</v-list-item-title>
              <v-list-item-subtitle>{{ consultaSeleccionada.evolucion }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item v-if="consultaSeleccionada.firmado">
              <v-list-item-title>Firma</v-list-item-title>
              <v-list-item-subtitle class="text-success">
                Firmada electrónicamente
                <span v-if="consultaSeleccionada.fechaFirma">
                  el {{ formatDateTime(consultaSeleccionada.fechaFirma) }}
                </span>
              </v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn @click="dialogoDetalleAbierto = false">Cerrar</v-btn>
          <v-btn
            color="primary"
            :to="`/consultas/${consultaSeleccionada.id}`"
          >
            Ver Completa
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Snackbar -->
    <v-snackbar v-model="snackbar.visible" :color="snackbar.color">
      {{ snackbar.mensaje }}
      <template v-slot:actions>
        <v-btn variant="text" @click="snackbar.visible = false">Cerrar</v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { apiClient } from '@/services/api';

// Interfaces
interface Consulta {
  id: string;
  pacienteId: string;
  paciente: {
    id: string;
    nombre: string;
    cedula: string;
  };
  doctorId: string;
  doctor: {
    id: string;
    nombre: string;
    especialidad?: string;
  };
  estado: string;
  motivoConsulta?: string;
  evolucion?: string;
  firmado: boolean;
  fechaFirma?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface Filters {
  search: string;
  estado: string | null;
  from: string;
  to: string;
}

// Estado
const consultas = ref<Consulta[]>([]);
const cargando = ref(false);
const dialogoDetalleAbierto = ref(false);
const consultaSeleccionada = ref<Consulta | null>(null);

const filters = ref<Filters>({
  search: '',
  estado: null,
  from: '',
  to: ''
});

const pagination = ref({
  page: 1,
  itemsPerPage: 20,
  total: 0
});

const snackbar = ref({
  visible: false,
  mensaje: '',
  color: 'info'
});

// Estado options
const estadoOptions = [
  { title: 'Borrador', value: 'borrador' },
  { title: 'Triaje', value: 'triaje' },
  { title: 'Pendiente', value: 'pendiente' },
  { title: 'En Atención', value: 'en_atencion' },
  { title: 'Finalizada', value: 'finalizada' },
  { title: 'Interconsulta', value: 'interconsulta' }
];

// Table headers
const headers = [
  { title: 'Fecha', key: 'createdAt', sortable: true },
  { title: 'Paciente', key: 'paciente.nombre', sortable: true },
  { title: 'Doctor', key: 'doctor.nombre', sortable: true },
  { title: 'Estado', key: 'estado', sortable: true },
  { title: 'Firmada', key: 'firmado', sortable: true, align: 'center' as const },
  { title: 'Acciones', key: 'acciones', sortable: false, align: 'end' as const },
];

// Computed
const hasActiveFilters = computed(() => {
  return filters.value.search ||
         filters.value.estado ||
         filters.value.from ||
         filters.value.to;
});

// Métodos
const fetchConsultas = async () => {
  cargando.value = true;
  try {
    const params: Record<string, string> = {
      page: pagination.value.page.toString(),
      limit: pagination.value.itemsPerPage.toString()
    };

    if (filters.value.estado) {
      params.estado = filters.value.estado;
    }
    if (filters.value.from) {
      params.from = filters.value.from;
    }
    if (filters.value.to) {
      params.to = filters.value.to;
    }
    if (filters.value.search) {
      params.search = filters.value.search;
    }

    const queryParams = new URLSearchParams(params).toString();
    const response = await apiClient.get<any>(`/api/v1/consultas?${queryParams}`);

    if (response.success && response.data) {
      consultas.value = response.data.data || [];
      pagination.value.total = response.data.pagination?.total || 0;
    }
  } catch (error) {
    console.error('Error al cargar consultas:', error);
    mostrarSnackbar('Error al cargar consultas', 'error');
  } finally {
    cargando.value = false;
  }
};

// Debounced search
let searchTimeout: ReturnType<typeof setTimeout> | null = null;
const onSearchChange = () => {
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  searchTimeout = setTimeout(() => {
    pagination.value.page = 1;
    fetchConsultas();
  }, 500);
};

const onPageChange = (page: number) => {
  pagination.value.page = page;
  fetchConsultas();
};

const onItemsPerPageChange = (itemsPerPage: number) => {
  pagination.value.itemsPerPage = itemsPerPage;
  pagination.value.page = 1;
  fetchConsultas();
};

const clearFilters = () => {
  filters.value = {
    search: '',
    estado: null,
    from: '',
    to: ''
  };
  pagination.value.page = 1;
  fetchConsultas();
};

const verDetalle = (consulta: Consulta) => {
  consultaSeleccionada.value = consulta;
  dialogoDetalleAbierto.value = true;
};

// Helpers
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

const formatDate = (date: Date | string): string => {
  return new Date(date).toLocaleDateString('es-EC', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const formatDateTime = (date: Date | string | null | undefined): string => {
  if (!date) return '-';
  return new Date(date).toLocaleString('es-EC', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const mostrarSnackbar = (mensaje: string, color: string = 'info') => {
  snackbar.value = {
    visible: true,
    mensaje,
    color
  };
};

// Lifecycle
onMounted(() => {
  fetchConsultas();
});
</script>

<style scoped>
/* Estilos específicos si son necesarios */
</style>
