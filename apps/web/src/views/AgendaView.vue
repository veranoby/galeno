<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <h1 class="text-h4 mb-4">Agenda Médica</h1>
        <p class="text-body-1">Gestión de disponibilidad y citas</p>
      </v-col>
    </v-row>
    
    <v-row>
      <!-- Panel de disponibilidad -->
      <v-col cols="12" md="6">
        <DisponibilidadManager />
      </v-col>
      
      <!-- Panel de creación de citas -->
      <v-col cols="12" md="6">
        <CitaForm 
          v-if="showCitaForm" 
          :cita-data="selectedCita"
          :editing="!!selectedCita"
          @save="handleCitaSave"
          @cancel="resetCitaForm"
        />
        <v-card v-else elevation="2">
          <v-card-title class="d-flex justify-space-between align-center">
            <span>Nueva Cita</span>
            <v-btn 
              variant="outlined" 
              size="small" 
              @click="createCita"
              prepend-icon="mdi-plus"
            >
              Crear Cita
            </v-btn>
          </v-card-title>
          <v-card-text>
            <p class="text-body-2">Haga clic en "Crear Cita" para agregar una nueva cita o seleccione una cita del calendario para editarla.</p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
    
    <v-row class="mt-4">
      <!-- Calendario de citas -->
      <v-col cols="12">
        <CalendarioCitas 
          @edit-cita="editCita"
          @create-cita="createCita"
        />
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useToast } from 'vue-toastification';
import DisponibilidadManager from '@/components/agenda/DisponibilidadManager.vue';
import CitaForm from '@/components/agenda/CitaForm.vue';
import CalendarioCitas from '@/components/agenda/CalendarioCitas.vue';
import { type Cita as CitaType } from '@/services/citas';

const toast = useToast();

// Estados
const showCitaForm = ref(false);
const selectedCita = ref<CitaType | null>(null);

// Métodos
const handleCitaSave = (cita: CitaType) => {
  // La actualización ya se hizo en el backend a través del formulario
  if (cita.id) {
    toast.success('Cita actualizada exitosamente');
  } else {
    toast.success('Cita creada exitosamente');
  }
  
  resetCitaForm();
};

const resetCitaForm = () => {
  showCitaForm.value = false;
  selectedCita.value = null;
};

const editCita = (cita: CitaType) => {
  selectedCita.value = cita;
  showCitaForm.value = true;
};

const createCita = () => {
  selectedCita.value = null;
  showCitaForm.value = true;
};
</script>