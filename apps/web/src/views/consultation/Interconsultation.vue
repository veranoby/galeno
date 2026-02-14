<template>
  <v-container class="interconsultation-container">
    <v-row class="align-center mb-4">
      <v-col cols="12" md="8">
        <h1 class="text-h4 font-weight-bold">
          <v-icon icon="mdi-forum-outline" size="large" class="mr-2" />
          Interconsultas 1-a-1
        </h1>
        <p class="text-subtitle-1 text-grey-darken-1">
          Sistema de solicitudes y respuestas de interconsultas médicas
        </p>
      </v-col>
    </v-row>

    <!-- Buscador y filtros -->
    <v-card variant="outlined" class="mb-4">
      <v-card-title>
        <v-icon icon="mdi-filter" start />
        Filtros de Búsqueda
      </v-card-title>
      <v-card-text>
        <v-row dense>
          <v-col cols="12" sm="6" md="4">
            <v-select
              v-model="filtros.estado"
              :items="estadosOptions"
              label="Estado"
              variant="outlined"
              density="compact"
              clearable
              hide-details
            >
              <template v-slot:prepend-inner>
                <v-icon>mdi-filter-variant</v-icon>
              </template>
            </v-select>
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-text-field
              v-model="filtros.busqueda"
              label="Buscar por ID o nombre"
              variant="outlined"
              density="compact"
              prepend-inner-icon="mdi-magnify"
              clearable
              @keyup.enter="cargarInterconsultas"
            />
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-select
              v-model="filtros.tipo"
              :items="tiposOptions"
              label="Tipo"
              variant="outlined"
              density="compact"
              clearable
              hide-details
            >
              <template v-slot:prepend-inner>
                <v-icon>mdi-shape</v-icon>
              </template>
            </v-select>
          </v-col>
          <v-col cols="12" sm="6" md="3">
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
          <v-col cols="12" sm="6" md="1">
            <v-btn
              variant="tonal"
              @click="limpiarFiltros"
            >
              <v-icon start>mdi-filter-remove</v-icon>
              Limpiar
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- Lista de interconsultas -->
    <v-card variant="outlined" class="mb-4">
      <v-card-title>
        <v-icon icon="mdi-forum" start />
        Interconsultas
        <v-chip v-if="totalItems > 0" size="small" color="primary" class="ml-2">
          {{ totalItems }}
        </v-chip>
      </v-card-title>
      <v-card-text v-if="loading" class="text-center pa-8">
        <v-progress-circular
          indeterminate
          color="primary"
          size="48"
        />
        <p class="mt-4 text-subtitle-2">Cargando interconsultas...</p>
      </v-card-text>
      <v-card-text v-else-if="interconsultas.length === 0" class="text-center pa-8">
        <v-icon icon="mdi-forum-remove" size="64" color="grey-lighten-1" class="mb-4" />
        <p class="text-subtitle-1 text-grey-darken-1">No hay interconsultas para mostrar</p>
      </v-card-text>
      <v-card-text v-else>
        <v-list density="compact">
          <v-list-item
            v-for="interconsulta in interconsultas"
            :key="interconsulta.id"
            @click="seleccionarInterconsulta(interconsulta)"
            :ripple="true"
          >
            <template v-slot:prepend>
              <v-icon
                :color="colorEstado(interconsulta.estado)"
                :icon="iconoEstado(interconsulta.estado)"
              />
            </template>
            <v-list-item-title>
              <div class="d-flex align-center">
                <span class="font-weight-medium">{{ interconsulta.consulta?.paciente?.nombre || 'Sin paciente' }}</span>
                <v-chip size="small" :color="colorEstado(interconsulta.estado)" class="ml-2">
                  {{ interconsulta.estado }}
                </v-chip>
                <span v-if="interconsulta.destinoDoctor" class="text-caption text-grey-darken-1 ml-2">
                  → Dr. {{ interconsulta.destinoDoctor.nombre }}
                </span>
              </div>
            </v-list-item-title>
            <v-list-item-subtitle>
              <div class="d-flex flex-column">
                <span class="text-caption">
                  <v-icon icon="mdi-calendar" size="x-small" class="mr-1" />
                  Solicitada: {{ formatFecha(interconsulta.createdAt) }}
                </span>
                <span class="text-caption">
                  <v-icon icon="mdi-clock" size="x-small" class="mr-1" />
                  {{ interconsulta.mensaje || 'Sin mensaje' }}
                </span>
              </div>
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>
      </v-card-text>
      <v-card-actions v-if="interconsultas.length > 0">
        <v-pagination
          v-if="totalPages > 1"
          v-model="pagina"
          :length="totalPages"
          :total-visible="Math.min(interconsultas.length, itemsPerPage)"
          class="my-2"
        />
      </v-card-actions>
    </v-card>

    <!-- Diálogo de respuesta -->
    <v-dialog
      v-model="dialogoRespuestaAbierto"
      max-width="700"
      persistent
    >
      <v-card class="interconsulta-dialog-card">
        <v-card-title class="text-h6 py-4 bg-primary text-white">
          <v-icon icon="mdi-reply" start class="mr-2" />
          Responder Interconsulta
          <v-btn
            icon="mdi-close"
            variant="text"
            color="white"
            @click="dialogoRespuestaAbierto = false"
          />
        </v-card-title>
        <v-card-text class="pa-4">
          <v-alert type="info" variant="tonal" density="compact" class="mb-4" border="start">
            <template v-slot:prepend>
              <v-icon>mdi-information</v-icon>
            </template>
            <div>
              <strong>Interconsulta seleccionada:</strong>
              <div class="text-caption mt-1">
                Paciente: {{ interconsultaSeleccionada?.consulta?.paciente?.nombre || 'N/A' }}<br>
                Estado actual: {{ interconsultaSeleccionada?.estado || 'N/A' }}
              </div>
            </div>
          </v-alert>

          <v-form ref="formRespuesta" @submit.prevent="enviarRespuesta">
            <v-textarea
              v-model="respuestaForm.respuesta"
              label="Respuesta"
              variant="outlined"
              rows="4"
              auto-grow
              :rules="[rules.required]"
              hint="Proporciona tu respuesta profesional a la interconsulta"
            />
            <v-select
              v-model="respuestaForm.estado"
              :items="estadosRespuestaOptions"
              label="Estado"
              variant="outlined"
              density="compact"
              :rules="[rules.required]"
            >
              <template v-slot:prepend-inner>
                <v-icon>mdi-check-circle</v-icon>
              </template>
            </v-select>
          </v-form>
        </v-card-text>
        <v-card-actions class="pa-4 pt-0">
          <v-spacer />
          <v-btn
            variant="tonal"
            @click="dialogoRespuestaAbierto = false"
          >
            Cancelar
          </v-btn>
          <v-btn
            color="primary"
            variant="elevated"
            :loading="enviandoRespuesta"
            @click="enviarRespuesta"
          >
            <v-icon start>mdi-send</v-icon>
            Enviar Respuesta
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { interconsultaService } from '@/services/interconsulta';
import type { Interconsulta } from '@/types/models';

// Estado
const loading = ref(false);
const interconsultas = ref<Interconsulta[]>([]);
const interconsultaSeleccionada = ref<any>(null);
const dialogoRespuestaAbierto = ref(false);
const pagina = ref(1);
const itemsPerPage = 10;

// Filtros
const filtros = ref({
  estado: null as string | null,
  busqueda: '',
  tipo: null as string | null
});

// Respuesta
const respuestaForm = ref({
  respuesta: '',
  estado: '' as string
});
const enviandoRespuesta = ref(false);

// Form validation rules
const rules = {
  required: (value: string) => !!value || 'Este campo es requerido'
};

// Computed
const totalItems = computed(() => interconsultas.value.length);
const totalPages = computed(() => Math.ceil(interconsultas.value.length / itemsPerPage));

const estadosOptions = [
  { title: 'Pendiente', value: 'pendiente' },
  { title: 'Aceptada', value: 'aceptada' },
  { title: 'Rechazada', value: 'rechazada' },
  { title: 'Completada', value: 'completada' }
];

const tiposOptions = [
  { title: 'Todas', value: null },
  { title: 'Recibidas', value: 'recibidas' },
  { title: 'Enviadas', value: 'enviadas' }
];

const estadosRespuestaOptions = [
  { title: 'Aceptar', value: 'aceptada' },
  { title: 'Rechazar', value: 'rechazada' },
  { title: 'Completar', value: 'completada' }
];

// Methods
const cargarInterconsultas = async () => {
  loading.value = true;
  try {
    const result = await interconsultaService.obtenerInterconsultas(filtros.value);
    interconsultas.value = result;
    pagina.value = 1;
  } catch (error) {
    console.error('Error cargando interconsultas:', error);
  } finally {
    loading.value = false;
  }
};

const seleccionarInterconsulta = (interconsulta: Interconsulta) => {
  interconsultaSeleccionada.value = interconsulta;
  dialogoRespuestaAbierto.value = true;
  respuestaForm.value = {
    respuesta: '',
    estado: ''
  };
};

const limpiarFiltros = () => {
  filtros.value = {
    estado: null,
    busqueda: '',
    tipo: null
  };
  cargarInterconsultas();
};

const colorEstado = (estado: string) => {
  switch (estado) {
    case 'pendiente': return 'info';
    case 'aceptada': return 'success';
    case 'rechazada': return 'error';
    case 'completada': return 'grey';
    default: return 'grey';
  }
};

const iconoEstado = (estado: string) => {
  switch (estado) {
    case 'pendiente': return 'mdi-clock-outline';
    case 'aceptada': return 'mdi-check-circle';
    case 'rechazada': return 'mdi-close-circle';
    case 'completada': return 'mdi-check-circle-outline';
    default: return 'mdi-help-circle';
  }
};

const enviarRespuesta = async () => {
  if (!interconsultaSeleccionada.value) return;

  enviandoRespuesta.value = true;
  try {
    await interconsultaService.responderInterconsulta(
      interconsultaSeleccionada.value.id,
      respuestaForm.value
    );
    dialogoRespuestaAbierto.value = false;
    // Recargar lista
    await cargarInterconsultas();
  } catch (error) {
    console.error('Error enviando respuesta:', error);
  } finally {
    enviandoRespuesta.value = false;
  }
};

const formatFecha = (date: Date | string): string => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('es-EC', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

// Lifecycle
onMounted(() => {
  cargarInterconsultas();
});
</script>

<style scoped>
.interconsultation-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem 0;
}
</style>
