<template>
  <v-container fluid class="oficinas-container pa-6">
    <!-- Header -->
    <v-row class="mb-6">
      <v-col cols="12">
        <div class="d-flex align-center justify-space-between">
          <div>
            <h1 class="text-h4 font-weight-bold">Oficinas Médicas</h1>
            <p class="text-subtitle-1 text-medium-emphasis mt-2">
              Gestión de oficinas y ubicaciones GPS
            </p>
          </div>
          <v-btn
            variant="elevated"
            color="primary"
            prepend-icon="mdi-plus"
            @click="abrirDialogoCrear"
          >
            Nueva Oficina
          </v-btn>
        </div>
      </v-col>
    </v-row>

    <!-- Mapa placeholder -->
    <v-row class="mb-6">
      <v-col cols="12">
        <v-card variant="outlined" class="pa-4">
          <div class="mapa-placeholder d-flex align-center justify-center">
            <v-icon size="64" color="primary" class="mr-4">mdi-map</v-icon>
            <div>
              <p class="text-h6">Mapa de Oficinas</p>
              <p class="text-body-2 text-medium-emphasis">
                {{ oficinas.length }} oficinas registradas
              </p>
              <v-btn
                size="small"
                variant="text"
                class="mt-2"
                prepend-icon="mdi-crosshairs-gps"
                @click="buscarCercanas"
              >
                Buscar cercanas a mi ubicación
              </v-btn>
            </div>
          </div>
        </v-card>
      </v-col>
    </v-row>

    <!-- Lista de Oficinas -->
    <v-row>
      <v-col cols="12">
        <v-card>
          <v-card-text>
            <v-data-table
              :headers="headers"
              :items="oficinas"
              :loading="loading"
              loading-text="Cargando oficinas..."
              class="elevation-0"
            >
              <!-- Coordenadas -->
              <template v-slot:item.ubicacion="{ item }">
                <div class="text-caption">
                  <div>Lat: {{ item.latitud.toFixed(6) }}</div>
                  <div>Lng: {{ item.longitud.toFixed(6) }}</div>
                </div>
              </template>

              <!-- Radio -->
              <template v-slot:item.radio="{ item }">
                <v-chip size="small" color="primary" variant="tonal">
                  {{ item.radio }} km
                </v-chip>
              </template>

              <!-- Estado -->
              <template v-slot:item.activo="{ item }">
                <v-chip
                  :color="item.activo ? 'success' : 'grey'"
                  size="small"
                  variant="tonal"
                >
                  {{ item.activo ? 'Activa' : 'Inactiva' }}
                </v-chip>
              </template>

              <!-- Acciones -->
              <template v-slot:item.actions="{ item }">
                <v-btn
                  size="small"
                  variant="text"
                  icon="mdi-map-marker"
                  class="mr-2"
                  @click="verEnMapa(item)"
                />
                <v-btn
                  size="small"
                  variant="text"
                  icon="mdi-account-plus"
                  class="mr-2"
                  @click="abrirDialogoAsignar(item)"
                />
                <v-btn
                  size="small"
                  variant="text"
                  icon="mdi-pencil"
                  class="mr-2"
                  @click="abrirDialogoEditar(item)"
                />
                <v-btn
                  size="small"
                  variant="text"
                  :icon="item.activo ? 'mdi-eye-off' : 'mdi-eye'"
                  :color="item.activo ? 'warning' : 'success'"
                  @click="toggleActivo(item)"
                />
              </template>
            </v-data-table>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Diálogo Crear/Editar Oficina -->
    <v-dialog v-model="dialogo" max-width="600px" persistent>
      <v-card>
        <v-card-title>
          {{ modoEdicion ? 'Editar' : 'Nueva' }} Oficina
        </v-card-title>

        <v-card-text>
          <v-form v-model="formularioValido" ref="formRef">
            <v-text-field
              v-model="form.nombre"
              label="Nombre de la oficina"
              placeholder="Ej: Centro Médico Norte"
              :rules="[v => !!v || 'El nombre es requerido']"
              class="mb-4"
            />

            <v-textarea
              v-model="form.direccion"
              label="Dirección completa"
              placeholder="Ej: Av. Principal 123, Ciudad"
              :rules="[v => !!v || 'La dirección es requerida']"
              rows="2"
              class="mb-4"
            />

            <v-row>
              <v-col cols="6">
                <v-text-field
                  v-model.number="form.latitud"
                  label="Latitud"
                  type="number"
                  step="0.000001"
                  placeholder="-0.180653"
                  :rules="[
                    v => !!v || 'Latitud requerida',
                    v => v >= -90 && v <= 90 || 'Rango: -90 a 90'
                  ]"
                />
              </v-col>
              <v-col cols="6">
                <v-text-field
                  v-model.number="form.longitud"
                  label="Longitud"
                  type="number"
                  step="0.000001"
                  placeholder="-78.467833"
                  :rules="[
                    v => !!v || 'Longitud requerida',
                    v => v >= -180 && v <= 180 || 'Rango: -180 a 180'
                  ]"
                />
              </v-col>
            </v-row>

            <v-text-field
              v-model.number="form.radio"
              label="Radio de cobertura (km)"
              type="number"
              min="1"
              max="100"
              default="5"
              class="mb-4"
              hint="Distancia máxima para búsqueda de oficinas cercanas"
            />

            <v-alert
              v-if="coordenadasActuales"
              type="info"
              variant="tonal"
              class="mt-4"
            >
              <div class="d-flex align-center justify-space-between">
                <div>
                  <strong>Coordenadas actuales:</strong>
                  <div class="text-caption">
                    Lat: {{ coordenadasActuales.lat }}, Lng: {{ coordenadasActuales.lng }}
                  </div>
                </div>
                <v-btn
                  size="small"
                  variant="text"
                  @click="usarCoordenadasActuales"
                >
                  Usar estas
                </v-btn>
              </div>
            </v-alert>
          </v-form>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="cerrarDialogo">
            Cancelar
          </v-btn>
          <v-btn
            variant="elevated"
            color="primary"
            :loading="loading"
            :disabled="!formularioValido"
            @click="guardarOficina"
          >
            {{ modoEdicion ? 'Actualizar' : 'Crear' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Diálogo Asignar Doctor -->
    <v-dialog v-model="dialogoAsignar" max-width="500px" persistent>
      <v-card>
        <v-card-title>
          Asignar Doctor a Oficina
        </v-card-title>

        <v-card-text>
          <v-form v-model="formularioAsignarValido" ref="formAsignarRef">
            <v-select
              v-model="asignarForm.doctorId"
              :items="doctoresDisponibles"
              label="Doctor"
              item-title="nombre"
              item-value="id"
              :rules="[v => !!v || 'El doctor es requerido']"
              class="mb-4"
            />

            <v-select
              v-model="asignarForm.diaSemana"
              :items="diasSemana"
              label="Día de la semana"
              :rules="[v => !!v || 'El día es requerido']"
              class="mb-4"
            />

            <v-row>
              <v-col cols="6">
                <v-text-field
                  v-model="asignarForm.horaInicio"
                  label="Hora inicio"
                  type="time"
                  :rules="[v => !!v || 'Hora inicio requerida']"
                />
              </v-col>
              <v-col cols="6">
                <v-text-field
                  v-model="asignarForm.horaFin"
                  label="Hora fin"
                  type="time"
                  :rules="[v => !!v || 'Hora fin requerida']"
                />
              </v-col>
            </v-row>
          </v-form>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialogoAsignar = false">
            Cancelar
          </v-btn>
          <v-btn
            variant="elevated"
            color="primary"
            :loading="loading"
            :disabled="!formularioAsignarValido"
            @click="guardarAsignacion"
          >
            Asignar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

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
import { useUbicacion, type Oficina } from '@/composables/useUbicacion';

// Estado
const loading = ref(false);
const dialogo = ref(false);
const dialogoAsignar = ref(false);
const modoEdicion = ref(false);
const formularioValido = ref(false);
const formularioAsignarValido = ref(false);
const formRef = ref<HTMLFormElement>();
const formAsignarRef = ref<HTMLFormElement>();
const oficinaAEliminar = ref<Oficina | null>(null);
const oficinaSeleccionada = ref<Oficina | null>(null);
const coordenadasActuales = ref<{ lat: number; lng: number } | null>(null);

// Formulario oficina
const form = ref<{
  id?: string;
  nombre: string;
  direccion: string;
  latitud: number;
  longitud: number;
  radio: number;
}>({
  nombre: '',
  direccion: '',
  latitud: 0,
  longitud: 0,
  radio: 5
});

// Formulario asignación
const asignarForm = ref<{
  doctorId: string;
  diaSemana: string;
  horaInicio: string;
  horaFin: string;
}>({
  doctorId: '',
  diaSemana: '',
  horaInicio: '',
  horaFin: ''
});

// Snackbar
const snackbar = ref(false);
const snackbarColor = ref('success');
const snackbarMessage = ref('');

// Datos estáticos
const diasSemana = [
  { title: 'Lunes', value: 'LUN' },
  { title: 'Martes', value: 'MAR' },
  { title: 'Miércoles', value: 'MIE' },
  { title: 'Jueves', value: 'JUE' },
  { title: 'Viernes', value: 'VIE' },
  { title: 'Sábado', value: 'SAB' },
  { title: 'Domingo', value: 'DOM' }
];

const doctoresDisponibles = ref([
  { id: 'doc1', nombre: 'Dr. Juan Pérez' },
  { id: 'doc2', nombre: 'Dra. María García' }
]);

// Headers de la tabla
const headers = [
  { title: 'Nombre', key: 'nombre', sortable: true },
  { title: 'Dirección', key: 'direccion', sortable: true },
  { title: 'Ubicación', key: 'ubicacion', sortable: false },
  { title: 'Radio', key: 'radio', sortable: true },
  { title: 'Estado', key: 'activo', sortable: true },
  { title: 'Acciones', key: 'actions', sortable: false, align: 'end' as const }
];

// Composable
const {
  oficinas,
  loading: loadingComposable,
  buscarOficinasCercanas,
  buscarOficinasCercanasAuto,
  obtenerTodasLasOficinas,
  crearOficina,
  actualizarOficina,
  eliminarOficina,
  asignarDoctorAOficina,
  obtenerGeolocalizacion
} = useUbicacion();

// Cargar oficinas
async function loadOficinas() {
  loading.value = true;
  await obtenerTodasLasOficinas();
  loading.value = false;
}

// Buscar oficinas cercanas
async function buscarCercanas() {
  try {
    const result = await buscarOficinasCercanasAuto(50);
    mostrarSnackbar(
      `Se encontraron ${result.length} oficinas cercanas`,
      'success'
    );
  } catch (err) {
    mostrarSnackbar('Error obteniendo ubicación', 'error');
  }
}

// Obtener coordenadas actuales
async function obtenerCoordenadas() {
  try {
    const position = await obtenerGeolocalizacion();
    coordenadasActuales.value = {
      lat: position.coords.latitude,
      lng: position.coords.longitude
    };
  } catch (err) {
    coordenadasActuales.value = null;
  }
}

// Usar coordenadas actuales
function usarCoordenadasActuales() {
  if (coordenadasActuales.value) {
    form.value.latitud = coordenadasActuales.value.lat;
    form.value.longitud = coordenadasActuales.value.lng;
  }
}

// Abrir diálogo crear
function abrirDialogoCrear() {
  modoEdicion.value = false;
  form.value = {
    nombre: '',
    direccion: '',
    latitud: 0,
    longitud: 0,
    radio: 5
  };
  coordenadasActuales.value = null;
  obtenerCoordenadas();
  dialogo.value = true;
}

// Abrir diálogo editar
function abrirDialogoEditar(item: Oficina) {
  modoEdicion.value = true;
  form.value = {
    id: item.id,
    nombre: item.nombre,
    direccion: item.direccion,
    latitud: item.latitud,
    longitud: item.longitud,
    radio: item.radio
  };
  dialogo.value = true;
}

// Abrir diálogo asignar
function abrirDialogoAsignar(item: Oficina) {
  oficinaSeleccionada.value = item;
  asignarForm.value = {
    doctorId: '',
    diaSemana: '',
    horaInicio: '',
    horaFin: ''
  };
  dialogoAsignar.value = true;
}

// Cerrar diálogo
function cerrarDialogo() {
  dialogo.value = false;
  formRef.value?.reset();
}

// Guardar oficina
async function guardarOficina() {
  if (!formRef.value?.validate()) return;

  loading.value = true;

  try {
    if (modoEdicion.value && form.value.id) {
      await actualizarOficina(form.value.id, form.value);
      mostrarSnackbar('Oficina actualizada correctamente', 'success');
    } else {
      await crearOficina(form.value);
      mostrarSnackbar('Oficina creada correctamente', 'success');
    }

    cerrarDialogo();
    await loadOficinas();
  } catch (error) {
    mostrarSnackbar('Error al guardar oficina', 'error');
  } finally {
    loading.value = false;
  }
}

// Guardar asignación
async function guardarAsignacion() {
  if (!formAsignarRef.value?.validate()) return;
  if (!oficinaSeleccionada.value) return;

  loading.value = true;

  try {
    await asignarDoctorAOficina({
      ...asignarForm.value,
      oficinaId: oficinaSeleccionada.value.id
    });
    mostrarSnackbar('Doctor asignado correctamente', 'success');
    dialogoAsignar.value = false;
  } catch (error) {
    mostrarSnackbar('Error al asignar doctor', 'error');
  } finally {
    loading.value = false;
  }
}

// Toggle activo/inactivo
async function toggleActivo(item: Oficina) {
  try {
    await actualizarOficina(item.id, { activo: !item.activo });
    mostrarSnackbar(
      item.activo ? 'Oficina desactivada' : 'Oficina activada',
      'success'
    );
    await loadOficinas();
  } catch (error) {
    mostrarSnackbar('Error al cambiar estado', 'error');
  }
}

// Ver en mapa
function verEnMapa(item: Oficina) {
  const url = `https://www.google.com/maps?q=${item.latitud},${item.longitud}`;
  window.open(url, '_blank');
  mostrarSnackbar('Abriendo ubicación en Google Maps', 'info');
}

// Mostrar snackbar
function mostrarSnackbar(message: string, color: string) {
  snackbarMessage.value = message;
  snackbarColor.value = color;
  snackbar.value = true;
}

// Lifecycle
onMounted(() => {
  loadOficinas();
});
</script>

<style scoped>
.oficinas-container {
  max-width: 1400px;
}

.mapa-placeholder {
  min-height: 200px;
  background-color: rgb(var(--v-theme-background));
  border-radius: 8px;
  border: 2px dashed rgb(var(--v-theme-primary));
}
</style>
