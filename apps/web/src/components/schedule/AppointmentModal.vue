<!-- apps/web/src/components/schedule/AppointmentModal.vue -->
<template>
  <v-dialog v-model="dialog" max-width="600" persistent>
    <v-card>
      <v-card-title class="text-h5 py-4">
        <v-icon start>{{ isEditing ? 'mdi-calendar-edit' : 'mdi-calendar-plus' }}</v-icon>
        {{ isEditing ? 'Editar Cita' : 'Nueva Cita' }}
      </v-card-title>

      <v-card-text>
        <v-form ref="formRef" v-slot="{ isValid }">
          <!-- Paciente -->
          <v-autocomplete
            v-model="formData.pacienteId"
            :items="pacientes"
            item-title="nombre"
            item-value="id"
            label="Paciente"
            variant="outlined"
            :rules="[rules.required]"
            :loading="loadingPacientes"
            hide-details
            class="mb-4"
          />

          <!-- Doctor -->
          <v-autocomplete
            v-model="formData.doctorId"
            :items="doctores"
            item-title="nombre"
            item-value="id"
            label="Doctor"
            variant="outlined"
            :rules="[rules.required]"
            :loading="loadingDoctores"
            hide-details
            class="mb-4"
          />

          <!-- Tipo de Cita -->
          <v-select
            v-model="formData.tipo"
            :items="tiposCita"
            label="Tipo de Cita"
            variant="outlined"
            :rules="[rules.required]"
            hide-details
            class="mb-4"
          >
            <template v-slot:item="{ props: itemProps, item }">
              <v-list-item v-bind="itemProps">
                <template v-slot:prepend>
                  <v-icon :color="getColorForType(item.value)" size="small" start>
                    mdi-circle
                  </v-icon>
                </template>
              </v-list-item>
            </template>
          </v-select>

          <!-- Fecha y Hora -->
          <v-row dense>
            <v-col cols="6">
              <v-text-field
                v-model="formData.fecha"
                label="Fecha"
                type="date"
                variant="outlined"
                :rules="[rules.required]"
                hide-details
              />
            </v-col>
            <v-col cols="6">
              <v-text-field
                v-model="formData.horaInicio"
                label="Hora Inicio"
                type="time"
                variant="outlined"
                :rules="[rules.required]"
                hide-details
              />
            </v-col>
          </v-row>

          <v-row dense class="mt-2">
            <v-col cols="6">
              <v-text-field
                v-model="formData.horaFin"
                label="Hora Fin"
                type="time"
                variant="outlined"
                :rules="[rules.required]"
                hide-details
              />
            </v-col>
            <v-col cols="6">
              <v-select
                v-model="formData.estado"
                :items="estadosCita"
                label="Estado"
                variant="outlined"
                hide-details
              />
            </v-col>
          </v-row>

          <!-- Motivo -->
          <v-textarea
            v-model="formData.motivo"
            label="Motivo de la Consulta"
            variant="outlined"
            rows="3"
            auto-grow
            hide-details
            class="mt-4"
          />

          <!-- Link de Video (para teleconsulta) -->
          <v-text-field
            v-if="formData.tipo === 'teleconsulta'"
            v-model="formData.linkVideo"
            label="Link de Videollamada"
            variant="outlined"
            placeholder="https://meet.jit.si/..."
            hide-details
            class="mt-4"
          />

          <!-- Notas -->
          <v-textarea
            v-model="formData.notas"
            label="Notas"
            variant="outlined"
            rows="2"
            auto-grow
            hide-details
            class="mt-4"
          />
        </v-form>
      </v-card-text>

      <v-card-actions class="pa-4">
        <v-spacer />
        <v-btn
          variant="text"
          @click="handleClose"
          :disabled="isSaving"
        >
          Cancelar
        </v-btn>
        <v-btn
          v-if="isEditing"
          color="error"
          variant="text"
          @click="handleDelete"
          :disabled="isSaving"
        >
          Eliminar
        </v-btn>
        <v-btn
          color="primary"
          variant="elevated"
          :loading="isSaving"
          :disabled="!isValid"
          @click="handleSave"
        >
          <v-icon start>{{ isEditing ? 'mdi-content-save' : 'mdi-plus' }}</v-icon>
          {{ isEditing ? 'Guardar' : 'Crear' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { CalendarEvent } from '@schedule-x/calendar';
import { apiClient } from '@/services/api';

interface Props {
  modelValue: boolean;
  appointment: CalendarEvent | null;
  initialDate: string | null;
}

const props = withDefaults(defineProps<Props>(), {
  appointment: null,
  initialDate: null
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'save', data: any): void;
  (e: 'delete', id: string): void;
}>();

const dialog = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

const formRef = ref<HTMLFormElement | null>(null);
const isSaving = ref(false);
const loadingPacientes = ref(false);
const loadingDoctores = ref(false);

const pacientes = ref<any[]>([]);
const doctores = ref<any[]>([]);

const tiposCita = [
  { title: 'Presencial', value: 'presencial' },
  { title: 'Teleconsulta', value: 'teleconsulta' },
  { title: 'Control', value: 'control' },
  { title: 'Primera Vez', value: 'primera_vez' },
  { title: 'Emergencia', value: 'emergencia' }
];

const estadosCita = [
  { title: 'Programada', value: 'programada' },
  { title: 'Confirmada', value: 'confirmada' },
  { title: 'En Progreso', value: 'en_progreso' },
  { title: 'Completada', value: 'completada' },
  { title: 'Cancelada', value: 'cancelada' },
  { title: 'No Presentó', value: 'no_presento' }
];

const formData = ref({
  pacienteId: '',
  doctorId: '',
  tipo: 'presencial' as any,
  estado: 'programada' as any,
  fecha: '',
  horaInicio: '',
  horaFin: '',
  motivo: '',
  linkVideo: '',
  notas: ''
});

const rules = {
  required: (value: any) => !!value || 'Este campo es requerido'
};

const isEditing = computed(() => !!props.appointment);

// Cargar datos cuando se abre el modal
watch(() => props.modelValue, async (value) => {
  if (value) {
    await loadPacientes();
    await loadDoctores();
    
    if (props.appointment) {
      // Modo edición
      const appt = props.appointment as any;
      formData.value = {
        pacienteId: appt.pacienteId || '',
        doctorId: appt.doctorId || '',
        tipo: appt.tipo || 'presencial',
        estado: appt.estado || 'programada',
        fecha: new Date(appt.start).toISOString().split('T')[0],
        horaInicio: new Date(appt.start).toTimeString().slice(0, 5),
        horaFin: new Date(appt.end).toTimeString().slice(0, 5),
        motivo: appt.motivo || '',
        linkVideo: appt.linkVideo || '',
        notas: appt.notas || ''
      };
    } else if (props.initialDate) {
      // Modo creación con fecha inicial
      const date = new Date(props.initialDate);
      formData.value = {
        pacienteId: '',
        doctorId: '',
        tipo: 'presencial',
        estado: 'programada',
        fecha: date.toISOString().split('T')[0],
        horaInicio: '09:00',
        horaFin: '09:30',
        motivo: '',
        linkVideo: '',
        notas: ''
      };
    }
  }
}, { immediate: true });

const loadPacientes = async () => {
  try {
    loadingPacientes.value = true;
    const response = await apiClient.get<any[]>('/api/v1/pacientes');
    if (response.success && response.data) {
      pacientes.value = response.data;
    }
  } catch (error) {
    console.error('Error loading pacientes:', error);
  } finally {
    loadingPacientes.value = false;
  }
};

const loadDoctores = async () => {
  try {
    loadingDoctores.value = true;
    const response = await apiClient.get<any[]>('/api/v1/doctores');
    if (response.success && response.data) {
      doctores.value = response.data;
    }
  } catch (error) {
    console.error('Error loading doctores:', error);
  } finally {
    loadingDoctores.value = false;
  }
};

const getColorForType = (type: string) => {
  const colors: Record<string, string> = {
    presencial: '#3b82f6',
    teleconsulta: '#10b981',
    control: '#f59e0b',
    primera_vez: '#8b5cf6',
    emergencia: '#ef4444'
  };
  return colors[type] || '#6b7280';
};

const handleSave = () => {
  if (!formRef.value?.validate()) return;

  isSaving.value = true;

  // Construir objeto para enviar
  const start = new Date(`${formData.value.fecha}T${formData.value.horaInicio}`);
  const end = new Date(`${formData.value.fecha}T${formData.value.horaFin}`);

  const data = {
    pacienteId: formData.value.pacienteId,
    doctorId: formData.value.doctorId,
    tipo: formData.value.tipo,
    estado: formData.value.estado,
    fechaHora: start.toISOString(),
    fechaHoraFin: end.toISOString(),
    motivo: formData.value.motivo,
    linkVideo: formData.value.linkVideo,
    notas: formData.value.notas
  };

  emit('save', data);
};

const handleDelete = () => {
  if (!props.appointment) return;
  
  const confirmed = confirm('¿Está seguro de eliminar esta cita?');
  if (confirmed) {
    emit('delete', (props.appointment as any).id);
  }
};

const handleClose = () => {
  dialog.value = false;
};
</script>
