<template>
  <v-container fluid class="pa-0">
    <!-- Toolbar -->
    <v-toolbar density="compact" class="mb-4">
      <v-toolbar-title>Agenda</v-toolbar-title>
      <v-spacer />
      <v-btn 
        color="primary" 
        prepend-icon="mdi-plus" 
        @click="crearCita"
      >
        Nueva Cita
      </v-btn>
    </v-toolbar>

    <!-- Main Content -->
    <v-row>
      <!-- Left Panel: Availability Management -->
      <v-col cols="12" md="4">
        <v-card class="pa-4">
          <v-card-title class="d-flex justify-space-between align-center">
            <span>Disponibilidad</span>
            <v-btn 
              icon 
              size="x-small" 
              variant="text"
              @click="cargarDisponibilidad"
            >
              <v-icon>mdi-refresh</v-icon>
            </v-btn>
          </v-card-title>
          
          <DisponibilidadManager 
            :doctor-id="doctorId"
            @disponibilidad-actualizada="cargarDisponibilidad"
          />
        </v-card>
      </v-col>

      <!-- Right Panel: Calendar and Appointments -->
      <v-col cols="12" md="8">
        <v-card class="pa-4">
          <v-card-title class="d-flex justify-space-between align-center">
            <span>Citas Programadas</span>
            <v-btn 
              icon 
              size="x-small" 
              variant="text"
              @click="cargarCitas"
            >
              <v-icon>mdi-refresh</v-icon>
            </v-btn>
          </v-card-title>
          
          <CalendarioCitas 
            :doctor-id="doctorId"
            @cita-actualizada="cargarCitas"
          />
        </v-card>
      </v-col>
    </v-row>

    <!-- Cita Dialog -->
    <v-dialog v-model="dialogCita" max-width="600px">
      <v-card>
        <v-card-title>
          <span class="headline">{{ editMode ? 'Editar Cita' : 'Nueva Cita' }}</span>
        </v-card-title>
        <v-card-text>
          <CitaForm 
            :cita="citaSeleccionada" 
            :edit-mode="editMode"
            @cita-guardada="onCitaGuardada"
            @cerrar="cerrarDialog"
          />
        </v-card-text>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import DisponibilidadManager from '@/components/agenda/DisponibilidadManager.vue';
import CalendarioCitas from '@/components/agenda/CalendarioCitas.vue';
import CitaForm from '@/components/agenda/CitaForm.vue';
import { citasApi } from '@/services/citas';

// Types
interface Cita {
  id: string;
  paciente: {
    id: string;
    nombre: string;
    cedula: string;
  };
  fechaHora: Date;
  tipo: 'presencial' | 'teleconsulta';
  estado: string;
  doctorId: string;
  pacienteId: string;
  ubicacionId?: string;
  slotId?: string;
}

// Reactive data
const route = useRoute();
const dialogCita = ref(false);
const editMode = ref(false);
const citaSeleccionada = ref<Cita | null>(null);
const disponibilidad = ref([]);
const citas = ref<Cita[]>([]);

// Computed
const doctorId = computed(() => {
  // En un entorno real, esto vendría del store de usuario autenticado
  return localStorage.getItem('doctorId') || 'doctor-default-id';
});

// Methods
const cargarDisponibilidad = async () => {
  try {
    const response = await citasApi.getDisponibilidad(doctorId.value);
    if (response.success) {
      disponibilidad.value = response.data;
    }
  } catch (error) {
    console.error('Error cargando disponibilidad:', error);
  }
};

const cargarCitas = async () => {
  try {
    const response = await citasApi.getCitas(doctorId.value);
    if (response.success) {
      citas.value = response.data;
    }
  } catch (error) {
    console.error('Error cargando citas:', error);
  }
};

const crearCita = () => {
  citaSeleccionada.value = null;
  editMode.value = false;
  dialogCita.value = true;
};

const editarCita = (cita: Cita) => {
  citaSeleccionada.value = cita;
  editMode.value = true;
  dialogCita.value = true;
};

const onCitaGuardada = () => {
  cerrarDialog();
  cargarCitas(); // Refrescar la lista de citas
  cargarDisponibilidad(); // Refrescar disponibilidad también
};

const cerrarDialog = () => {
  dialogCita.value = false;
};

// Lifecycle
onMounted(() => {
  cargarDisponibilidad();
  cargarCitas();
});
</script>

<style scoped>
.pa-0 {
  padding: 0;
}
</style>