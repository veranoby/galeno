<template>
  <v-container class="simple-interconsultation-container">
    <v-row class="align-center mb-4">
      <v-col cols="12" md="8">
        <h1 class="text-h4 font-weight-bold">
          <v-icon icon="mdi-forum-outline" size="large" class="mr-2" />
          Interconsulta Simplificada
        </h1>
        <p class="text-subtitle-1 text-grey-darken-1">
          Flujo simplificado para solicitudes de interconsulta médica
        </p>
      </v-col>
      <v-col cols="12" md="4" class="text-right">
        <v-btn
          color="primary"
          size="large"
          @click="mostrarDialogoNueva = true"
        >
          <v-icon start>mdi-plus</v-icon>
          Nueva Interconsulta
        </v-btn>
      </v-col>
    </v-row>

    <!-- Filtros -->
    <v-card variant="outlined" class="mb-4">
      <v-card-text>
        <v-row dense>
          <v-col cols="12" sm="4">
            <v-select
              v-model="filtros.estado"
              :items="estadosOptions"
              label="Estado"
              variant="outlined"
              density="compact"
              clearable
              hide-details
            />
          </v-col>
          <v-col cols="12" sm="4">
            <v-text-field
              v-model="filtros.busqueda"
              label="Buscar"
              variant="outlined"
              density="compact"
              prepend-inner-icon="mdi-magnify"
              clearable
              @keyup.enter="cargarInterconsultas"
            />
          </v-col>
          <v-col cols="12" sm="4">
            <v-btn
              variant="tonal"
              color="primary"
              block
              @click="cargarInterconsultas"
            >
              <v-icon start>mdi-refresh</v-icon>
              Actualizar
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- Lista de interconsultas -->
    <v-card variant="outlined">
      <v-card-text>
        <div v-if="loading" class="text-center pa-8">
          <v-progress-circular
            indeterminate
            color="primary"
            size="48"
          />
          <p class="mt-4 text-subtitle-2">Cargando interconsultas...</p>
        </div>
        <div v-else-if="interconsultas.length === 0" class="text-center pa-8">
          <v-icon icon="mdi-forum-remove" size="64" color="grey-lighten-1" class="mb-4" />
          <p class="text-subtitle-1 text-grey-darken-1">No hay interconsultas para mostrar</p>
        </div>
        <v-data-table
          v-else
          :headers="headers"
          :items="interconsultas"
          :loading="loading"
          item-value="id"
          class="elevation-0"
        >
          <template v-slot:item.estado="{ item }">
            <v-chip
              :color="getEstadoColor(item.estado)"
              size="small"
              variant="tonal"
            >
              <v-icon start size="x-small" :icon="getEstadoIcon(item.estado)" />
              {{ item.estado }}
            </v-chip>
          </template>
          <template v-slot:item.fechaCreacion="{ item }">
            {{ formatFecha(item.fechaCreacion) }}
          </template>
          <template v-slot:item.acciones="{ item }">
            <v-btn
              icon="mdi-eye"
              size="small"
              variant="text"
              @click="verDetalle(item)"
              title="Ver detalle"
            />
            <v-btn
              v-if="item.estado === 'pendiente' || item.estado === 'en_proceso'"
              icon="mdi-check"
              size="small"
              variant="text"
              color="success"
              @click="cerrarInterconsulta(item)"
              title="Cerrar interconsulta"
            />
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <!-- Diálogo Nueva Interconsulta -->
    <v-dialog v-model="mostrarDialogoNueva" max-width="600" persistent>
      <v-card>
        <v-card-title class="text-h6 py-4 bg-primary text-white">
          <v-icon icon="mdi-plus-circle" start class="mr-2" />
          Nueva Interconsulta
          <v-btn
            icon="mdi-close"
            variant="text"
            color="white"
            @click="cancelarNuevaInterconsulta"
          />
        </v-card-title>
        <v-card-text class="pa-4">
          <v-form ref="formNueva">
            <v-select
              v-model="nuevaInterconsulta.pacienteId"
              :items="pacientes"
              item-title="nombre"
              item-value="id"
              label="Paciente"
              variant="outlined"
              :rules="[rules.required]"
              :loading="loadingPacientes"
              hint="Seleccione el paciente para la interconsulta"
            >
              <template v-slot:prepend-inner>
                <v-icon>mdi-account</v-icon>
              </template>
            </v-select>
            <v-select
              v-model="nuevaInterconsulta.especialidadDestino"
              :items="especialidades"
              label="Especialidad Destino"
              variant="outlined"
              :rules="[rules.required]"
              hint="Especialidad del doctor que recibirá la interconsulta"
            >
              <template v-slot:prepend-inner>
                <v-icon>mdi-stethoscope</v-icon>
              </template>
            </v-select>
            <v-textarea
              v-model="nuevaInterconsulta.motivo"
              label="Motivo de la Interconsulta"
              variant="outlined"
              :rules="[rules.required]"
              rows="4"
              auto-grow
              hint="Describa el motivo de la interconsulta"
            >
              <template v-slot:prepend-inner>
                <v-icon>mdi-text-box-outline</v-icon>
              </template>
            </v-textarea>
          </v-form>
        </v-card-text>
        <v-card-actions class="pa-4 pt-0">
          <v-spacer />
          <v-btn
            variant="tonal"
            @click="cancelarNuevaInterconsulta"
          >
            Cancelar
          </v-btn>
          <v-btn
            color="primary"
            variant="elevated"
            :loading="creando"
            @click="crearInterconsulta"
          >
            <v-icon start>mdi-send</v-icon>
            Crear
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Diálogo Detalle Interconsulta -->
    <v-dialog v-model="mostrarDialogoDetalle" max-width="700" persistent>
      <v-card>
        <v-card-title class="text-h6 py-4 bg-primary text-white">
          <v-icon icon="mdi-information" start class="mr-2" />
          Detalle de Interconsulta
          <v-btn
            icon="mdi-close"
            variant="text"
            color="white"
            @click="mostrarDialogoDetalle = false"
          />
        </v-card-title>
        <v-card-text class="pa-4">
          <div v-if="interconsultaSeleccionada" class="detalle-content">
            <v-alert
              type="info"
              variant="tonal"
              density="compact"
              class="mb-4"
              border="start"
            >
              <template v-slot:prepend>
                <v-icon>mdi-identifier</v-icon>
              </template>
              <div>
                <strong>ID:</strong> {{ interconsultaSeleccionada.id }}<br>
                <strong>Estado:</strong>
                <v-chip
                  :color="getEstadoColor(interconsultaSeleccionada.estado)"
                  size="x-small"
                  class="ml-2"
                >
                  {{ interconsultaSeleccionada.estado }}
                </v-chip>
              </div>
            </v-alert>

            <v-row dense>
              <v-col cols="12" sm="6">
                <div class="text-caption text-grey-darken-1">Paciente</div>
                <div class="text-body-1">{{ interconsultaSeleccionada.pacienteNombre }}</div>
              </v-col>
              <v-col cols="12" sm="6">
                <div class="text-caption text-grey-darken-1">Especialidad Destino</div>
                <div class="text-body-1">{{ interconsultaSeleccionada.especialidadDestino }}</div>
              </v-col>
              <v-col cols="12" sm="6">
                <div class="text-caption text-grey-darken-1">Solicitante</div>
                <div class="text-body-1">{{ interconsultaSeleccionada.solicitanteNombre }}</div>
              </v-col>
              <v-col cols="12" sm="6">
                <div class="text-caption text-grey-darken-1">Fecha de Creación</div>
                <div class="text-body-1">{{ formatFecha(interconsultaSeleccionada.fechaCreacion) }}</div>
              </v-col>
            </v-row>

            <v-divider class="my-4" />

            <div class="mb-4">
              <div class="text-caption text-grey-darken-1 mb-1">Motivo</div>
              <v-card variant="outlined" class="pa-3 bg-grey-lighten-5">
                {{ interconsultaSeleccionada.motivo || 'Sin motivo especificado' }}
              </v-card>
            </div>

            <div v-if="interconsultaSeleccionada.respuesta">
              <div class="text-caption text-grey-darken-1 mb-1">Respuesta</div>
              <v-card variant="outlined" class="pa-3 bg-grey-lighten-5">
                {{ interconsultaSeleccionada.respuesta }}
              </v-card>
            </div>
          </div>
        </v-card-text>
        <v-card-actions class="pa-4 pt-0">
          <v-spacer />
          <v-btn
            v-if="interconsultaSeleccionada?.estado === 'pendiente' || interconsultaSeleccionada?.estado === 'en_proceso'"
            color="success"
            variant="elevated"
            @click="cerrarInterconsulta(interconsultaSeleccionada)"
          >
            <v-icon start>mdi-check</v-icon>
            Cerrar Interconsulta
          </v-btn>
          <v-btn
            variant="tonal"
            @click="mostrarDialogoDetalle = false"
          >
            Cerrar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useApi } from '@/composables/useApi';
import { apiClient } from '@/services/api';

interface Interconsulta {
  id: string;
  pacienteId: string;
  pacienteNombre: string;
  especialidadDestino: string;
  motivo: string;
  estado: 'pendiente' | 'en_proceso' | 'completada' | 'cerrada';
  fechaCreacion: string;
  solicitanteId: string;
  solicitanteNombre: string;
  respuesta?: string;
}

interface Paciente {
  id: string;
  nombre: string;
}

const api = useApi();

const interconsultas = ref<Interconsulta[]>([]);
const loading = ref(false);
const mostrarDialogoNueva = ref(false);
const mostrarDialogoDetalle = ref(false);
const creando = ref(false);
const loadingPacientes = ref(false);

const pacientes = ref<Paciente[]>([]);
const especialidades = ref<string[]>([
  'Medicina General',
  'Cardiología',
  'Dermatología',
  'Endocrinología',
  'Gastroenterología',
  'Ginecología',
  'Hematología',
  'Infectología',
  'Nefrología',
  'Neumología',
  'Neurología',
  'Oftalmología',
  'Oncología',
  'Pediatría',
  'Psiquiatría',
  'Reumatología',
  'Traumatología',
  'Urología'
]);

const interconsultaSeleccionada = ref<Interconsulta | null>(null);

const filtros = ref({
  estado: null as string | null,
  busqueda: ''
});

const nuevaInterconsulta = ref({
  pacienteId: '',
  especialidadDestino: '',
  motivo: ''
});

const formNueva = ref<HTMLFormElement | null>(null);

const estadosOptions = [
  { title: 'Pendiente', value: 'pendiente' },
  { title: 'En Proceso', value: 'en_proceso' },
  { title: 'Completada', value: 'completada' },
  { title: 'Cerrada', value: 'cerrada' }
];

const headers = [
  { title: 'ID', key: 'id', sortable: true },
  { title: 'Paciente', key: 'pacienteNombre', sortable: true },
  { title: 'Especialidad', key: 'especialidadDestino', sortable: true },
  { title: 'Estado', key: 'estado', sortable: true },
  { title: 'Fecha', key: 'fechaCreacion', sortable: true },
  { title: 'Acciones', key: 'acciones', sortable: false, align: 'center' }
];

// Form validation rules
const rules = {
  required: (value: string) => !!value || 'Este campo es requerido'
};

const getEstadoColor = (estado: string) => {
  const colors: Record<string, string> = {
    pendiente: 'warning',
    en_proceso: 'info',
    completada: 'success',
    cerrada: 'grey'
  };
  return colors[estado] || 'grey';
};

const getEstadoIcon = (estado: string) => {
  const icons: Record<string, string> = {
    pendiente: 'mdi-clock-outline',
    en_proceso: 'mdi-progress-clock',
    completada: 'mdi-check-circle',
    cerrada: 'mdi-close-circle'
  };
  return icons[estado] || 'mdi-help-circle';
};

const formatFecha = (fecha: string): string => {
  if (!fecha) return '-';
  return new Date(fecha).toLocaleDateString('es-EC', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const cargarPacientes = async () => {
  loadingPacientes.value = true;
  try {
    const response = await apiClient.get<any>('/patient/list');
    if (response.success && response.data?.data) {
      pacientes.value = response.data.data.map((p: any) => ({
        id: p.id,
        nombre: p.nombre
      }));
    }
  } catch (error) {
    console.error('Error cargando pacientes:', error);
  } finally {
    loadingPacientes.value = false;
  }
};

const cargarInterconsultas = async () => {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    if (filtros.value.estado) params.append('estado', filtros.value.estado);
    if (filtros.value.busqueda) params.append('busqueda', filtros.value.busqueda);

    const response = await apiClient.get<Interconsulta[]>(
      `/interconsultas/simple?${params.toString()}`
    );
    interconsultas.value = response.success ? response.data || [] : [];
  } catch (error) {
    console.error('Error cargando interconsultas:', error);
    interconsultas.value = [];
  } finally {
    loading.value = false;
  }
};

const crearInterconsulta = async () => {
  if (!formNueva.value?.valid) return;

  creando.value = true;
  try {
    const response = await apiClient.post<Interconsulta>(
      '/interconsultas/simple',
      nuevaInterconsulta.value
    );

    if (response.success) {
      mostrarDialogoNueva.value = false;
      nuevaInterconsulta.value = {
        pacienteId: '',
        especialidadDestino: '',
        motivo: ''
      };
      await cargarInterconsultas();
    }
  } catch (error) {
    console.error('Error creando interconsulta:', error);
  } finally {
    creando.value = false;
  }
};

const cerrarInterconsulta = async (item: Interconsulta) => {
  try {
    const response = await apiClient.patch<{ id: string; estado: string; mensaje: string }>(
      `/interconsultas/simple/${item.id}/cerrar`
    );

    if (response.success) {
      await cargarInterconsultas();
      if (mostrarDialogoDetalle.value) {
        mostrarDialogoDetalle.value = false;
      }
    }
  } catch (error) {
    console.error('Error cerrando interconsulta:', error);
  }
};

const verDetalle = async (item: Interconsulta) => {
  interconsultaSeleccionada.value = item;
  mostrarDialogoDetalle.value = true;
};

const cancelarNuevaInterconsulta = () => {
  mostrarDialogoNueva.value = false;
  nuevaInterconsulta.value = {
    pacienteId: '',
    especialidadDestino: '',
    motivo: ''
  };
  if (formNueva.value) {
    formNueva.value.reset();
  }
};

// Lifecycle
onMounted(() => {
  cargarPacientes();
  cargarInterconsultas();
});
</script>

<style scoped>
.simple-interconsultation-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 1rem 0;
}

.detalle-content {
  min-height: 200px;
}

.v-data-table {
  border-radius: 8px;
}

@media (max-width: 599px) {
  .simple-interconsultation-container {
    padding: 0.5rem;
  }

  .text-h4 {
    font-size: 1.25rem;
  }

  .v-btn {
    width: 100%;
    margin-bottom: 0.5rem;
  }
}
</style>
