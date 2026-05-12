<template>
  <v-card elevation="2">
    <v-card-title>
      <span v-if="cita.id">{{ editing ? 'Editar Cita' : 'Ver Cita' }}</span>
      <span v-else>Crear Nueva Cita</span>
    </v-card-title>
    
    <v-card-text>
      <v-form @submit.prevent="saveCita">
        <v-row>
          <v-col cols="12" md="6">
            <v-text-field
              v-model="cita.fecha"
              label="Fecha"
              type="date"
              :rules="[required]"
              density="compact"
              :disabled="loading || viewOnly"
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="6">
            <v-text-field
              v-model="cita.horaInicio"
              label="Hora de inicio"
              type="time"
              :rules="[required]"
              density="compact"
              :disabled="loading || viewOnly"
            ></v-text-field>
          </v-col>
        </v-row>
        
        <v-row>
          <v-col cols="12" md="6">
            <v-autocomplete
              v-model="cita.pacienteId"
              :items="pacientes"
              item-title="nombreCompleto"
              item-value="id"
              label="Paciente"
              :rules="[required]"
              clearable
              density="compact"
              :loading="loadingPacientes"
              :disabled="loading || viewOnly"
            >
              <template #item="{ props, item }">
                <v-list-item
                  v-bind="props"
                  :subtitle="`DNI: ${item.raw.dni} | Teléfono: ${item.raw.telefono}`"
                ></v-list-item>
              </template>
            </v-autocomplete>
          </v-col>
          <v-col cols="12" md="6">
            <v-select
              v-model="cita.estado"
              :items="estadosCita"
              item-title="text"
              item-value="value"
              label="Estado"
              :rules="[required]"
              density="compact"
              :disabled="loading || viewOnly"
            ></v-select>
          </v-col>
        </v-row>
        
        <v-row>
          <v-col cols="12" md="6">
            <v-select
              v-model="cita.tipo"
              :items="tiposCita"
              item-title="text"
              item-value="value"
              label="Tipo de Cita"
              :rules="[required]"
              density="compact"
              :disabled="loading || viewOnly"
            ></v-select>
          </v-col>
          <v-col cols="12" md="6">
            <v-text-field
              v-model="cita.duracion"
              label="Duración (minutos)"
              type="number"
              min="15"
              max="240"
              :rules="[required, minValue(15)]"
              density="compact"
              :disabled="loading || viewOnly"
            ></v-text-field>
          </v-col>
        </v-row>
        
        <v-row>
          <v-col cols="12">
            <v-textarea
              v-model="cita.notas"
              label="Notas"
              rows="3"
              density="compact"
              :disabled="loading || viewOnly"
            ></v-textarea>
          </v-col>
        </v-row>
        
        <v-row>
          <v-col cols="12">
            <v-checkbox
              v-model="cita.recordatorioEnviado"
              label="Recordatorio enviado"
              density="compact"
              :disabled="loading || viewOnly"
            ></v-checkbox>
          </v-col>
        </v-row>
        
        <v-row>
          <v-col cols="12">
            <v-btn 
              v-if="!editing && !viewOnly"
              type="submit" 
              color="primary" 
              variant="flat"
              :disabled="!formValid || loading"
              :loading="saving"
            >
              Crear Cita
            </v-btn>
            
            <v-btn 
              v-else-if="editing && !viewOnly"
              type="submit" 
              color="primary" 
              variant="flat"
              :disabled="!formValid || loading"
              :loading="saving"
            >
              Actualizar Cita
            </v-btn>
            
            <v-btn 
              v-if="editing && !viewOnly"
              @click="$emit('cancel')"
              variant="outlined"
              class="ml-2"
              :disabled="loading"
            >
              Cancelar
            </v-btn>
            
            <v-btn 
              v-if="viewOnly"
              @click="$emit('close')"
              color="primary"
            >
              Cerrar
            </v-btn>
          </v-col>
        </v-row>
      </v-form>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useToast } from 'vue-toastification';
import { type Cita as CitaType, EstadoCita, TipoCita } from '@galeno/shared-types';
import { citasApi } from '@/services/citas';

interface Paciente {
  id: string;
  nombreCompleto: string;
  dni: string;
  telefono: string;
}

const props = defineProps<{
  citaData?: CitaType | null;
  editing?: boolean;
  viewOnly?: boolean;
}>();

const emit = defineEmits(['save', 'cancel', 'close']);

const toast = useToast();

// Estados
const pacientes = ref<Paciente[]>([]);
const loadingPacientes = ref(false);
const loading = ref(false);
const saving = ref(false);

// Datos del formulario
const cita = reactive<CitaType>({
  fecha: '',
  horaInicio: '',
  pacienteId: '',
  estado: EstadoCita.PROGRAMADA,
  tipo: TipoCita.PRESENCIAL,
  duracion: 30,
  notas: '',
  recordatorioEnviado: false
});

// Opciones
const estadosCita = [
  { text: 'Programada', value: 'programada' },
  { text: 'Confirmada', value: 'confirmada' },
  { text: 'En Progreso', value: 'en_progreso' },
  { text: 'Completada', value: 'completada' },
  { text: 'Cancelada', value: 'cancelada' },
  { text: 'No Presentó', value: 'no_presento' }
];

const tiposCita = [
  { text: 'Presencial', value: 'presencial' },
  { text: 'Teleconsulta', value: 'teleconsulta' },
  { text: 'Emergencia', value: 'emergencia' }
];

// Computed properties
const formValid = computed(() => {
  return cita.fecha &&
         cita.horaInicio &&
         cita.pacienteId &&
         cita.estado &&
         cita.tipo &&
         (cita.duracion ?? 0) >= 15;
});

// Validaciones
const required = (value: string) => !!value || 'Campo requerido';
const minValue = (min: number) => (value: number) => value >= min || `Mínimo ${min} minutos`;

// Métodos
const loadPacientes = async () => {
  loadingPacientes.value = true;
  try {
    // En la implementación real, aquí llamarías a la API para obtener pacientes
    // const response = await pacienteService.getPacientes();
    // pacientes.value = response.data || [];
    
    // Datos temporales hasta que tengamos el servicio de pacientes
    pacientes.value = [
      { id: '1', nombreCompleto: 'Juan Pérez', dni: '12345678', telefono: '987654321' },
      { id: '2', nombreCompleto: 'María García', dni: '87654321', telefono: '912345678' },
      { id: '3', nombreCompleto: 'Carlos López', dni: '11223344', telefono: '956789123' },
      { id: '4', nombreCompleto: 'Ana Rodríguez', dni: '44332211', telefono: '987123456' }
    ];
  } catch (error) {
    toast.error('Error al cargar pacientes');
  } finally {
    loadingPacientes.value = false;
  }
};

const saveCita = async () => {
  if (!formValid.value) {
    toast.error('Por favor complete todos los campos requeridos');
    return;
  }

  saving.value = true;
  try {
    let response;
    
    if (props.citaData?.id) {
      // Actualizar cita existente
      response = await citasApi.updateCita(props.citaData.id, cita);
      if (response.success) {
        toast.success('Cita actualizada exitosamente');
      }
    } else {
      // Crear nueva cita
      // En la implementación real, el medicoId debería obtenerse del store de autenticación
      const citaNueva = { ...cita, medicoId: 'current-doctor-id' };
      response = await citasApi.createCita(citaNueva);
      if (response.success) {
        toast.success('Cita creada exitosamente');
      }
    }
    
    if (!response.success) {
      throw new Error(response.error || 'Error al guardar la cita');
    }
    
    emit('save', response.data || { ...cita, id: props.citaData?.id || 'new' });
  } catch (error) {
    console.error('Error al guardar la cita:', error);
    toast.error('Error al guardar la cita');
  } finally {
    saving.value = false;
  }
};

// Inicialización
onMounted(async () => {
  await loadPacientes();
  
  if (props.citaData) {
    Object.assign(cita, props.citaData);
  } else {
    // Fecha por defecto: hoy
    const today = new Date();
    cita.fecha = today.toISOString().split('T')[0];
  }
});
</script>