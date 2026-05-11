<template>
  <v-container fluid class="especialidades-container pa-6">
    <!-- Header -->
    <v-row class="mb-6">
      <v-col cols="12">
        <div class="d-flex align-center justify-space-between">
          <div>
            <h1 class="text-h4 font-weight-bold">Especialidades Médicas</h1>
            <p class="text-subtitle-1 text-medium-emphasis mt-2">
              Gestión del catálogo de especialidades
            </p>
          </div>
          <v-btn
            variant="elevated"
            color="primary"
            prepend-icon="mdi-plus"
            @click="abrirDialogoCrear"
          >
            Nueva Especialidad
          </v-btn>
        </div>
      </v-col>
    </v-row>

    <!-- Tabla de Especialidades -->
    <v-row>
      <v-col cols="12">
        <v-card>
          <v-card-text>
            <v-data-table
              :headers="headers"
              :items="especialidades"
              :loading="isLoading"
              loading-text="Cargando especialidades..."
              class="elevation-0"
            >
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

    <!-- Diálogo Crear/Editar -->
    <v-dialog v-model="dialogo" max-width="600px" persistent>
      <v-card>
        <v-card-title>
          {{ modoEdicion ? 'Editar' : 'Nueva' }} Especialidad
        </v-card-title>

        <v-card-text>
          <v-form v-model="formularioValido" ref="formRef">
            <v-text-field
              v-model="form.nombre"
              label="Nombre de la especialidad"
              placeholder="Ej: Medicina Interna"
              :rules="[v => !!v || 'El nombre es requerido']"
              class="mb-4"
            />

            <v-text-field
              v-model="form.nombreCorto"
              label="Nombre corto"
              placeholder="Ej: MED_INT"
              :rules="[v => !!v || 'El nombre corto es requerido']"
              class="mb-4"
            />

            <v-textarea
              v-model="form.descripcion"
              label="Descripción"
              placeholder="Descripción de la especialidad..."
              rows="3"
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
            :loading="isLoading"
            :disabled="!formularioValido"
            @click="guardarEspecialidad"
          >
            {{ modoEdicion ? 'Actualizar' : 'Crear' }}
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
import { useEspecialidades, type Especialidad } from '@/composables/useEspecialidades';

// Estado
const especialidades = ref<Especialidad[]>([]);
const isLoading = ref(false);
const dialogo = ref(false);
const modoEdicion = ref(false);
const formularioValido = ref(false);
const formRef = ref<HTMLFormElement>();

// Formulario
const form = ref<{
  id?: string;
  nombre: string;
  nombreCorto: string;
  descripcion?: string;
}>({
  nombre: '',
  nombreCorto: ''
});

// Snackbar
const snackbar = ref(false);
const snackbarColor = ref('success');
const snackbarMessage = ref('');

// Headers de la tabla
const headers = [
  { title: 'Nombre', key: 'nombre', sortable: true },
  { title: 'Nombre Corto', key: 'nombreCorto', sortable: true },
  { title: 'Descripción', key: 'descripcion', sortable: false },
  { title: 'Estado', key: 'activo', sortable: true },
  { title: 'Acciones', key: 'actions', sortable: false, align: 'end' as const }
];

// Composable
const {
  cargarEspecialidades,
  crearEspecialidad,
  actualizarEspecialidad,
  eliminarEspecialidad
} = useEspecialidades();

// Cargar especialidades
async function loadEspecialidades() {
  isLoading.value = true;
  const data = await cargarEspecialidades();
  especialidades.value = data;
  isLoading.value = false;
}

// Abrir diálogo para crear
function abrirDialogoCrear() {
  modoEdicion.value = false;
  form.value = { nombre: '', nombreCorto: '' };
  dialogo.value = true;
}

// Abrir diálogo para editar
function abrirDialogoEditar(item: Especialidad) {
  modoEdicion.value = true;
  form.value = {
    id: item.id,
    nombre: item.nombre,
    nombreCorto: item.nombreCorto,
    descripcion: item.descripcion
  };
  dialogo.value = true;
}

// Cerrar diálogo
function cerrarDialogo() {
  dialogo.value = false;
  formRef.value?.reset();
}

// Guardar especialidad
async function guardarEspecialidad() {
  if (!formRef.value?.validate()) return;

  isLoading.value = true;

  try {
    if (modoEdicion.value && form.value.id) {
      await actualizarEspecialidad(form.value.id, {
        nombre: form.value.nombre,
        nombreCorto: form.value.nombreCorto,
        descripcion: form.value.descripcion
      });
      mostrarSnackbar('Especialidad actualizada correctamente', 'success');
    } else {
      await crearEspecialidad({
        nombre: form.value.nombre,
        nombreCorto: form.value.nombreCorto,
        descripcion: form.value.descripcion
      });
      mostrarSnackbar('Especialidad creada correctamente', 'success');
    }

    cerrarDialogo();
    await loadEspecialidades();
  } catch (error) {
    mostrarSnackbar('Error al guardar especialidad', 'error');
  } finally {
    isLoading.value = false;
  }
}

// Toggle activo/inactivo
async function toggleActivo(item: Especialidad) {
  try {
    await actualizarEspecialidad(item.id, { activo: !item.activo });
    mostrarSnackbar(
      item.activo ? 'Especialidad desactivada' : 'Especialidad activada',
      'success'
    );
    await loadEspecialidades();
  } catch (error) {
    mostrarSnackbar('Error al cambiar estado', 'error');
  }
}

// Mostrar snackbar
function mostrarSnackbar(message: string, color: string) {
  snackbarMessage.value = message;
  snackbarColor.value = color;
  snackbar.value = true;
}

// Lifecycle
onMounted(() => {
  loadEspecialidades();
});
</script>

<style scoped>
.especialidades-container {
  max-width: 1400px;
}

.metric-card {
  transition: transform 0.2s;
}

.metric-card:hover {
  transform: translateY(-2px);
}
</style>
