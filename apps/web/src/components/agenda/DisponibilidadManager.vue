<template>
  <v-card elevation="2">
    <v-card-title class="d-flex justify-space-between align-center">
      <span>Disponibilidad del Médico</span>
      <v-btn 
        variant="outlined" 
        size="small" 
        @click="addSlot"
        prepend-icon="mdi-plus"
        :loading="loading"
      >
        Agregar Slot
      </v-btn>
    </v-card-title>
    
    <v-card-text>
      <v-form @submit.prevent="saveDisponibilidad">
        <v-row>
          <v-col cols="12" md="6">
            <v-select
              v-model="selectedDia"
              :items="diasSemana"
              item-title="text"
              item-value="value"
              label="Día de la semana"
              clearable
              density="compact"
              :disabled="loading"
            ></v-select>
          </v-col>
          <v-col cols="12" md="6">
            <v-select
              v-model="tipoCita"
              :items="tiposCita"
              label="Tipo de cita"
              density="compact"
              :disabled="loading"
            ></v-select>
          </v-col>
        </v-row>
        
        <v-row>
          <v-col cols="12" md="4">
            <v-text-field
              v-model="horaInicio"
              label="Hora de inicio"
              type="time"
              density="compact"
              :disabled="loading"
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="4">
            <v-text-field
              v-model="horaFin"
              label="Hora de fin"
              type="time"
              density="compact"
              :disabled="loading"
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="4">
            <v-text-field
              v-model="duracionMinutos"
              label="Duración (min)"
              type="number"
              min="15"
              max="120"
              step="15"
              density="compact"
              :disabled="loading"
            ></v-text-field>
          </v-col>
        </v-row>
        
        <v-row>
          <v-col cols="12">
            <v-btn 
              type="submit" 
              color="primary" 
              variant="flat"
              :disabled="!isValidSlot || loading"
              :loading="saving"
            >
              {{ editingId !== null ? 'Actualizar' : 'Agregar' }} Disponibilidad
            </v-btn>
            
            <v-btn 
              v-if="editingId !== null"
              @click="cancelEdit"
              variant="outlined"
              class="ml-2"
              :disabled="loading"
            >
              Cancelar
            </v-btn>
          </v-col>
        </v-row>
      </v-form>
      
      <!-- Lista de slots disponibles -->
      <v-divider class="my-4"></v-divider>
      
      <v-skeleton-loader
        v-if="loading"
        type="list-item-avatar-three-line, list-item-avatar-three-line, list-item-avatar-three-line"
      ></v-skeleton-loader>
      
      <div v-else-if="disponibilidadSlots.length === 0" class="text-center py-4 text-grey">
        No hay horarios de disponibilidad configurados
      </div>
      
      <v-list v-else>
        <v-list-item
          v-for="slot in disponibilidadSlots"
          :key="slot.id"
          class="mb-2"
          rounded="lg"
          border
        >
          <template #prepend>
            <v-avatar color="primary" size="40">
              <span class="text-white">{{ getDiaAbreviado(slot.diaSemana) }}</span>
            </v-avatar>
          </template>
          
          <v-list-item-title>
            <strong>{{ getNombreDia(slot.diaSemana) }}</strong>
            <span> | {{ slot.horaInicio }} - {{ slot.horaFin }}</span>
          </v-list-item-title>
          
          <v-list-item-subtitle>
            Duración: {{ slot.duracionMinutos }} min | Tipo: {{ slot.tipo }}
          </v-list-item-subtitle>
          
          <template #append>
            <v-btn
              icon="mdi-pencil"
              size="small"
              variant="text"
              :disabled="loading"
              @click="editSlot(slot)"
            ></v-btn>
            <v-btn
              icon="mdi-delete"
              size="small"
              variant="text"
              color="error"
              :disabled="loading"
              @click="deleteSlot(slot)"
            ></v-btn>
          </template>
        </v-list-item>
      </v-list>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useToast } from 'vue-toastification';
import { citasApi, type SlotDisponibilidad } from '@/services/citas';
import { useAuthStore } from '@/stores/auth';

const toast = useToast();
const authStore = useAuthStore();

// Estados
const selectedDia = ref<number | null>(null);
const horaInicio = ref('09:00');
const horaFin = ref('17:00');
const duracionMinutos = ref(30);
const tipoCita = ref<'presencial' | 'teleconsulta'>('presencial');
const editingId = ref<string | null>(null);
const loading = ref(false);
const saving = ref(false);

// Datos
const disponibilidadSlots = ref<SlotDisponibilidad[]>([]);

// Opciones
const diasSemana = [
  { text: 'Lunes', value: 1 },
  { text: 'Martes', value: 2 },
  { text: 'Miércoles', value: 3 },
  { text: 'Jueves', value: 4 },
  { text: 'Viernes', value: 5 },
  { text: 'Sábado', value: 6 },
  { text: 'Domingo', value: 0 }
];

const tiposCita = [
  { text: 'Presencial', value: 'presencial' },
  { text: 'Teleconsulta', value: 'teleconsulta' }
];

// Computed properties
const isValidSlot = computed(() => {
  if (selectedDia.value === null) return false;
  if (!horaInicio.value || !horaFin.value) return false;
  if (horaInicio.value >= horaFin.value) return false;
  return true;
});

// Métodos
const loadDisponibilidad = async () => {
  const doctorId = authStore.user?.id;
  if (!doctorId) return;

  loading.value = true;
  try {
    const response = await citasApi.getDisponibilidad(doctorId);
    if (response.success) {
      disponibilidadSlots.value = response.data || [];
    } else {
      throw new Error(response.error || 'Error al cargar la disponibilidad');
    }
  } catch (error) {
    console.error('Error al cargar la disponibilidad:', error);
    toast.error('Error al cargar la disponibilidad');
  } finally {
    loading.value = false;
  }
};

const addSlot = () => {
  resetForm();
};

const editSlot = (slot: SlotDisponibilidad) => {
  selectedDia.value = slot.diaSemana;
  horaInicio.value = slot.horaInicio;
  horaFin.value = slot.horaFin;
  duracionMinutos.value = slot.duracionMinutos;
  tipoCita.value = slot.tipo;
  editingId.value = slot.id;
};

const deleteSlot = async (slot: SlotDisponibilidad) => {
  if (!slot.id) return;
  
  if (!confirm('¿Está seguro de eliminar este slot de disponibilidad?')) {
    return;
  }
  
  loading.value = true;
  try {
    const response = await citasApi.eliminarDisponibilidad(slot.id);
    
    if (response.success) {
      disponibilidadSlots.value = disponibilidadSlots.value.filter(s => s.id !== slot.id);
      toast.success('Slot de disponibilidad eliminado');
    } else {
      throw new Error(response.error || 'Error al eliminar el slot');
    }
  } catch (error) {
    console.error('Error al eliminar el slot:', error);
    toast.error('Error al eliminar el slot de disponibilidad');
  } finally {
    loading.value = false;
  }
};

const cancelEdit = () => {
  editingId.value = null;
  resetForm();
};

const resetForm = () => {
  selectedDia.value = null;
  horaInicio.value = '09:00';
  horaFin.value = '17:00';
  duracionMinutos.value = 30;
  tipoCita.value = 'presencial';
  editingId.value = null;
};

const saveDisponibilidad = async () => {
  if (!isValidSlot.value || !authStore.user?.id) {
    toast.error('Por favor complete todos los campos requeridos correctamente');
    return;
  }

  saving.value = true;
  try {
    const data: Partial<SlotDisponibilidad> & { doctorId: string } = {
      doctorId: authStore.user.id,
      diaSemana: selectedDia.value!,
      horaInicio: horaInicio.value,
      horaFin: horaFin.value,
      duracionMinutos: duracionMinutos.value,
      tipo: tipoCita.value,
      activo: true
    };

    let response;
    if (editingId.value) {
      response = await citasApi.actualizarDisponibilidad(editingId.value, data);
      if (response.success && response.data) {
        const index = disponibilidadSlots.value.findIndex(s => s.id === editingId.value);
        if (index !== -1) {
          disponibilidadSlots.value[index] = response.data;
        }
        toast.success('Slot de disponibilidad actualizado');
      }
    } else {
      response = await citasApi.crearDisponibilidad(data);
      if (response.success && response.data) {
        disponibilidadSlots.value.push(response.data);
        toast.success('Slot de disponibilidad agregado');
      }
    }
    
    if (!response?.success) {
      throw new Error(response?.error || 'Error al guardar el slot');
    }
    
    resetForm();
  } catch (error) {
    console.error('Error al guardar el slot:', error);
    toast.error('Error al guardar el slot de disponibilidad');
  } finally {
    saving.value = false;
  }
};

const getNombreDia = (dia: number) => {
  const diaObj = diasSemana.find(d => d.value === dia);
  return diaObj ? diaObj.text : '';
};

const getDiaAbreviado = (dia: number) => {
  const diaObj = diasSemana.find(d => d.value === dia);
  return diaObj ? diaObj.text.charAt(0) : '';
};

// Inicialización
onMounted(() => {
  loadDisponibilidad();
});
</script>
