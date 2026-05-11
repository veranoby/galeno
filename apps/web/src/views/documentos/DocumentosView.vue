<template>
  <v-container fluid class="documentos-container pa-6">
    <!-- Header -->
    <v-row class="mb-6">
      <v-col cols="12">
        <div class="d-flex align-center justify-space-between">
          <div>
            <h1 class="text-h4 font-weight-bold">Documentos</h1>
            <p class="text-subtitle-1 text-medium-emphasis mt-2">
              Gestión de documentos médicos con caducidad automática
            </p>
          </div>
          <v-btn
            variant="elevated"
            color="primary"
            prepend-icon="mdi-plus"
            @click="abrirDialogoCrear"
          >
            Nuevo Documento
          </v-btn>
        </div>
      </v-col>
    </v-row>

    <!-- Resumen de estados -->
    <v-row class="mb-6">
      <v-col cols="12" sm="6" md="3">
        <v-card color="success-lighten-5" variant="tonal">
          <v-card-text class="d-flex align-center justify-space-between">
            <div>
              <p class="text-caption">Vigentes</p>
              <p class="text-h4 font-weight-bold">
                {{ documentosVigentes.length }}
              </p>
            </div>
            <v-icon size="x-large" color="success">mdi-file-check</v-icon>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" md="3">
        <v-card color="warning-lighten-5" variant="tonal">
          <v-card-text class="d-flex align-center justify-space-between">
            <div>
              <p class="text-caption">Próximos a caducar</p>
              <p class="text-h4 font-weight-bold">
                {{ documentosProximosCaducar.length }}
              </p>
            </div>
            <v-icon size="x-large" color="warning">mdi-clock-alert</v-icon>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" md="3">
        <v-card color="error-lighten-5" variant="tonal">
          <v-card-text class="d-flex align-center justify-space-between">
            <div>
              <p class="text-caption">Caducados</p>
              <p class="text-h4 font-weight-bold">
                {{ documentosCaducados.length }}
              </p>
            </div>
            <v-icon size="x-large" color="error">mdi-file-remove</v-icon>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" md="3">
        <v-card color="grey-lighten-5" variant="tonal">
          <v-card-text class="d-flex align-center justify-space-between">
            <div>
              <p class="text-caption">Total</p>
              <p class="text-h4 font-weight-bold">
                {{ documentos.length }}
              </p>
            </div>
            <v-icon size="x-large" color="default">mdi-file-multiple</v-icon>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Filtros -->
    <v-row class="mb-4">
      <v-col cols="12" sm="4">
        <v-select
          v-model="filtroEstado"
          :items="estadosFilter"
          label="Filtrar por estado"
          density="compact"
          variant="outlined"
          hide-details
        />
      </v-col>
      <v-col cols="12" sm="4">
        <v-select
          v-model="filtroTipo"
          :items="tiposFilter"
          label="Filtrar por tipo"
          density="compact"
          variant="outlined"
          hide-details
        />
      </v-col>
      <v-col cols="12" sm="4">
        <v-text-field
          v-model="busqueda"
          label="Buscar por título"
          density="compact"
          variant="outlined"
          prepend-inner-icon="mdi-magnify"
          hide-details
          clearable
        />
      </v-col>
    </v-row>

    <!-- Tabla de Documentos -->
    <v-row>
      <v-col cols="12">
        <v-card>
          <v-card-text>
            <v-data-table
              :headers="headers"
              :items="documentosFiltrados"
              :loading="loading"
              loading-text="Cargando documentos..."
              class="elevation-0"
            >
              <!-- Tipo -->
              <template v-slot:item.tipo="{ item }">
                <v-chip
                  :color="getTipoColor(item.tipo)"
                  size="small"
                  variant="tonal"
                >
                  {{ getTipoLabel(item.tipo) }}
                </v-chip>
              </template>

              <!-- Estado -->
              <template v-slot:item.estado="{ item }">
                <v-chip
                  :color="getEstadoColor(item.estado)"
                  size="small"
                  variant="tonal"
                >
                  {{ getEstadoLabel(item.estado) }}
                </v-chip>
              </template>

              <!-- Fecha Caducidad -->
              <template v-slot:item.fechaCaducidad="{ item }">
                <div v-if="item.fechaCaducidad">
                  <div :class="esProximoCaducar(item) ? 'text-warning font-weight-bold' : ''">
                    {{ formatearFecha(item.fechaCaducidad) }}
                  </div>
                  <v-chip
                    v-if="esProximoCaducar(item)"
                    color="warning"
                    size="x-small"
                    class="mt-1"
                  >
                    Próximo a caducar
                  </v-chip>
                </div>
                <span v-else class="text-grey">Sin caducidad</span>
              </template>

              <!-- Acciones -->
              <template v-slot:item.actions="{ item }">
                <v-btn
                  size="small"
                  variant="text"
                  icon="mdi-download"
                  class="mr-2"
                  @click="descargarDocumento(item)"
                />
                <v-btn
                  size="small"
                  variant="text"
                  icon="mdi-eye"
                  class="mr-2"
                  @click="verDocumento(item)"
                />
                <v-btn
                  size="small"
                  variant="text"
                  icon="mdi-delete"
                  color="error"
                  @click="confirmarEliminar(item)"
                />
              </template>
            </v-data-table>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Diálogo Crear -->
    <v-dialog v-model="dialogo" max-width="600px" persistent>
      <v-card>
        <v-card-title>
          Nuevo Documento
        </v-card-title>

        <v-card-text>
          <v-form v-model="formularioValido" ref="formRef">
            <v-text-field
              v-model="form.titulo"
              label="Título"
              placeholder="Ej: Receta Médica"
              :rules="[v => !!v || 'El título es requerido']"
              class="mb-4"
            />

            <v-textarea
              v-model="form.descripcion"
              label="Descripción"
              placeholder="Descripción del documento..."
              rows="2"
              class="mb-4"
            />

            <v-select
              v-model="form.tipo"
              :items="tiposDisponibles"
              label="Tipo de documento"
              :rules="[v => !!v || 'El tipo es requerido']"
              class="mb-4"
            />

            <v-text-field
              v-model="form.url"
              label="URL del documento"
              placeholder="https://..."
              :rules="[v => !!v || 'La URL es requerida']"
              class="mb-4"
            />

            <v-text-field
              v-model="form.fechaCaducidad"
              type="date"
              label="Fecha de caducidad (opcional)"
              hint="Dejar vacío para documentos sin caducidad"
              class="mb-4"
            />
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
            @click="guardarDocumento"
          >
            Crear
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Diálogo Confirmar Eliminar -->
    <v-dialog v-model="dialogoEliminar" max-width="400px">
      <v-card>
        <v-card-title class="text-h5">
          ¿Eliminar documento?
        </v-card-title>
        <v-card-text>
          Esta acción no se puede deshacer.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialogoEliminar = false">
            Cancelar
          </v-btn>
          <v-btn
            variant="elevated"
            color="error"
            :loading="loading"
            @click="eliminarDocumento"
          >
            Eliminar
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
import { ref, computed, onMounted } from 'vue';
import { useDocumentos, type Documento } from '@/composables/useDocumentos';

// Estado
const loading = ref(false);
const dialogo = ref(false);
const dialogoEliminar = ref(false);
const formularioValido = ref(false);
const formRef = ref<HTMLFormElement>();
const documentoAEliminar = ref<Documento | null>(null);
const busqueda = ref('');
const filtroEstado = ref('todos');
const filtroTipo = ref('todos');

// Formulario
const form = ref<{
  titulo: string;
  descripcion: string;
  tipo: 'receta' | 'examen' | 'certificado';
  url: string;
  fechaCaducidad: string;
}>({
  titulo: '',
  descripcion: '',
  tipo: 'receta',
  url: '',
  fechaCaducidad: ''
});

// Snackbar
const snackbar = ref(false);
const snackbarColor = ref('success');
const snackbarMessage = ref('');

// Opciones
const estadosFilter = [
  { title: 'Todos', value: 'todos' },
  { title: 'Vigentes', value: 'activo' },
  { title: 'Próximos a caducar', value: 'proximo' },
  { title: 'Caducados', value: 'caducado' },
  { title: 'Anulados', value: 'anulado' }
];

const tiposFilter = [
  { title: 'Todos', value: 'todos' },
  { title: 'Receta', value: 'receta' },
  { title: 'Examen', value: 'examen' },
  { title: 'Certificado', value: 'certificado' }
];

const tiposDisponibles = [
  { title: 'Receta', value: 'receta' },
  { title: 'Examen', value: 'examen' },
  { title: 'Certificado', value: 'certificado' }
];

// Headers de la tabla
const headers = [
  { title: 'Título', key: 'titulo', sortable: true },
  { title: 'Tipo', key: 'tipo', sortable: true },
  { title: 'Fecha Caducidad', key: 'fechaCaducidad', sortable: true },
  { title: 'Estado', key: 'estado', sortable: true },
  { title: 'Creado', key: 'createdAt', sortable: true },
  { title: 'Acciones', key: 'actions', sortable: false, align: 'end' as const }
];

// Composable
const {
  documentos,
  loading: loadingComposable,
  cargarDocumentos,
  crearDocumento,
  eliminarDocumento: eliminarDoc,
  documentosVigentes,
  documentosCaducados,
  documentosProximosCaducar,
  esProximoCaducar
} = useDocumentos();

// Documentos filtrados
const documentosFiltrados = computed(() => {
  let filtrados = [...documentos.value];

  // Filtro por búsqueda
  if (busqueda.value) {
    filtrados = filtrados.filter((d) =>
      d.titulo.toLowerCase().includes(busqueda.value.toLowerCase())
    );
  }

  // Filtro por estado
  if (filtroEstado.value !== 'todos') {
    if (filtroEstado.value === 'proximo') {
      filtrados = filtrados.filter((d) => esProximoCaducar(d));
    } else {
      filtrados = filtrados.filter((d) => d.estado === filtroEstado.value);
    }
  }

  // Filtro por tipo
  if (filtroTipo.value !== 'todos') {
    filtrados = filtrados.filter((d) => d.tipo === filtroTipo.value);
  }

  return filtrados;
});

// Helpers de UI
function getTipoColor(tipo: string): string {
  const colors: Record<string, string> = {
    receta: 'blue',
    examen: 'purple',
    certificado: 'teal'
  };
  return colors[tipo] || 'grey';
}

function getTipoLabel(tipo: string): string {
  const labels: Record<string, string> = {
    receta: 'Receta',
    examen: 'Examen',
    certificado: 'Certificado'
  };
  return labels[tipo] || tipo;
}

function getEstadoColor(estado: string): string {
  const colors: Record<string, string> = {
    activo: 'success',
    caducado: 'error',
    anulado: 'grey'
  };
  return colors[estado] || 'grey';
}

function getEstadoLabel(estado: string): string {
  const labels: Record<string, string> = {
    activo: 'Vigente',
    caducado: 'Caducado',
    anulado: 'Anulado'
  };
  return labels[estado] || estado;
}

function formatearFecha(fecha: string): string {
  return new Date(fecha).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// Acciones
function abrirDialogoCrear() {
  form.value = {
    titulo: '',
    descripcion: '',
    tipo: 'receta',
    url: '',
    fechaCaducidad: ''
  };
  dialogo.value = true;
}

function cerrarDialogo() {
  dialogo.value = false;
  formRef.value?.reset();
}

async function guardarDocumento() {
  if (!formRef.value?.validate()) return;

  loading.value = true;

  try {
    await crearDocumento({
      ...form.value,
      pacienteId: 'paciente-123' // TODO: Obtener del contexto
    });
    mostrarSnackbar('Documento creado correctamente', 'success');
    cerrarDialogo();
  } catch (error) {
    mostrarSnackbar('Error al crear documento', 'error');
  } finally {
    loading.value = false;
  }
}

function confirmarEliminar(item: Documento) {
  documentoAEliminar.value = item;
  dialogoEliminar.value = true;
}

async function eliminarDocumento() {
  if (!documentoAEliminar.value) return;

  loading.value = true;

  try {
    await eliminarDoc(documentoAEliminar.value.id);
    mostrarSnackbar('Documento eliminado correctamente', 'success');
    dialogoEliminar.value = false;
    documentoAEliminar.value = null;
  } catch (error) {
    mostrarSnackbar('Error al eliminar documento', 'error');
  } finally {
    loading.value = false;
  }
}

function descargarDocumento(item: Documento) {
  window.open(item.url, '_blank');
  mostrarSnackbar('Descargando documento...', 'success');
}

function verDocumento(item: Documento) {
  // TODO: Implementar visor de documentos
  mostrarSnackbar('Visor de documentos en desarrollo', 'info');
}

function mostrarSnackbar(message: string, color: string) {
  snackbarMessage.value = message;
  snackbarColor.value = color;
  snackbar.value = true;
}

// Lifecycle
onMounted(() => {
  cargarDocumentos('paciente-123'); // TODO: Obtener del contexto
});
</script>

<style scoped>
.documentos-container {
  max-width: 1400px;
}
</style>
