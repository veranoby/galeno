<template>
  <v-card elevation="2">
    <v-card-title class="d-flex justify-space-between align-center">
      <span>Calendario de Citas</span>
      <div class="d-flex gap-2">
        <v-btn
          icon="mdi-chevron-left"
          size="small"
          variant="text"
          @click="previousPeriod"
          :disabled="loading"
        ></v-btn>
        <v-btn
          @click="today"
          variant="outlined"
          size="small"
          :disabled="loading"
        >
          Hoy
        </v-btn>
        <v-btn
          icon="mdi-chevron-right"
          size="small"
          variant="text"
          @click="nextPeriod"
          :disabled="loading"
        ></v-btn>
        
        <v-menu location="bottom">
          <template #activator="{ props }">
            <v-btn
              variant="outlined"
              size="small"
              v-bind="props"
              :disabled="loading"
            >
              {{ capitalize(calendarType) }}
            </v-btn>
          </template>
          <v-list>
            <v-list-item @click="setCalendarType('day')" :disabled="loading">
              <v-list-item-title>Día</v-list-item-title>
            </v-list-item>
            <v-list-item @click="setCalendarType('week')" :disabled="loading">
              <v-list-item-title>Semana</v-list-item-title>
            </v-list-item>
            <v-list-item @click="setCalendarType('month')" :disabled="loading">
              <v-list-item-title>Mes</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </div>
    </v-card-title>
    
    <v-card-text>
      <v-skeleton-loader
        v-if="loading"
        type="image, actions"
        height="500"
      ></v-skeleton-loader>
      
      <v-calendar
        v-else
        ref="calendarRef"
        v-model="currentDate"
        :events="eventosCitas"
        :event-start="getEventStart"
        :event-end="getEventEnd"
        :event-color="getEventColor"
        :type="calendarType"
        @click:event="handleEventClick"
        @change="updateRange"
      >
        <template #event="{ event, timeToY, minutesToPixels }">
          <div 
            class="event-card"
            :class="{ 'event-all-day': event.allDay }"
            @click.stop="openCitaDetails(event)"
          >
            <div class="event-header">
              <v-icon size="x-small" :color="getEventTypeColor(event.extendedProps.tipo)">
                {{ getEventTypeIcon(event.extendedProps.tipo) }}
              </v-icon>
              <strong class="ml-1">{{ event.time }}</strong>
            </div>
            <div class="event-content">
              <div class="event-title">{{ event.title }}</div>
              <div class="event-paciente text-caption">{{ event.extendedProps.pacienteNombre }}</div>
            </div>
          </div>
        </template>
      </v-calendar>
    </v-card-text>
    
    <!-- Diálogo para detalles de cita -->
    <v-dialog v-model="dialogVisible" max-width="600px">
      <v-card v-if="selectedCita">
        <v-card-title class="d-flex justify-space-between align-center">
          <span>Detalles de la Cita</span>
          <v-btn icon @click="dialogVisible = false" :disabled="loadingActions">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        
        <v-card-text>
          <v-row>
            <v-col cols="12">
              <h3>{{ selectedCita.titulo }}</h3>
            </v-col>
          </v-row>
          
          <v-row>
            <v-col cols="6">
              <v-chip :color="getStatusColor(selectedCita.estado)" label size="small">
                {{ getStatusText(selectedCita.estado) }}
              </v-chip>
            </v-col>
            <v-col cols="6" class="text-right">
              <v-chip :color="getTipoColor(selectedCita.tipo)" label size="small">
                {{ getTipoText(selectedCita.tipo) }}
              </v-chip>
            </v-col>
          </v-row>
          
          <v-row class="mt-2">
            <v-col cols="12">
              <v-list>
                <v-list-item>
                  <v-list-item-title>Fecha y Hora</v-list-item-title>
                  <v-list-item-subtitle>{{ formatDateWithTime(selectedCita.fecha, selectedCita.horaInicio) }}</v-list-item-subtitle>
                </v-list-item>
                
                <v-list-item>
                  <v-list-item-title>Paciente</v-list-item-title>
                  <v-list-item-subtitle>{{ selectedCita.pacienteNombre }}</v-list-item-subtitle>
                </v-list-item>
                
                <v-list-item>
                  <v-list-item-title>Duración</v-list-item-title>
                  <v-list-item-subtitle>{{ selectedCita.duracion }} minutos</v-list-item-subtitle>
                </v-list-item>
                
                <v-list-item v-if="selectedCita.notas">
                  <v-list-item-title>Notas</v-list-item-title>
                  <v-list-item-subtitle>{{ selectedCita.notas }}</v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </v-col>
          </v-row>
        </v-card-text>
        
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn 
            @click="editarCita(selectedCita)" 
            color="primary"
            :disabled="loadingActions"
          >
            Editar
          </v-btn>
          <v-btn 
            @click="eliminarCita(selectedCita)" 
            color="error"
            :disabled="loadingActions"
          >
            Eliminar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useToast } from 'vue-toastification';
import { citasApi, type Cita as CitaType } from '@/services/citas';

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  color: string;
  extendedProps: {
    pacienteNombre: string;
    tipo: string;
    estado: string;
    duracion: number;
    notas?: string;
  };
}

const toast = useToast();

// Estados
const currentDate = ref(new Date().toISOString().substr(0, 10));
const calendarType = ref<'day' | 'week' | 'month'>('week');
const dialogVisible = ref(false);
const selectedCita = ref<CitaType | null>(null);
const citas = ref<CitaType[]>([]);
const loading = ref(false);
const loadingActions = ref(false);

// Referencias
const calendarRef = ref();

// Computed properties
const eventosCitas = computed<CalendarEvent[]>(() => {
  return citas.value.map(cita => ({
    id: cita.id || '',
    title: cita.titulo,
    start: `${cita.fecha}T${cita.horaInicio}`,
    end: `${cita.fecha}T${cita.horaFin}`,
    color: getEventColorByType(cita.tipo),
    extendedProps: {
      pacienteNombre: cita.pacienteNombre,
      tipo: cita.tipo,
      estado: cita.estado,
      duracion: cita.duracion,
      notas: cita.notas
    }
  }));
});

// Métodos
const loadCitas = async (startDate: string, endDate: string) => {
  loading.value = true;
  try {
    // En la implementación real, reemplazar con el ID del médico autenticado
    const medicoId = 'current-doctor-id'; // Este debería obtenerse del store de autenticación
    const response = await citasApi.getCitas(medicoId, startDate, endDate);
    
    if (response.success) {
      citas.value = response.data || [];
    } else {
      throw new Error(response.error || 'Error al cargar las citas');
    }
  } catch (error) {
    console.error('Error al cargar las citas:', error);
    toast.error('Error al cargar las citas');
  } finally {
    loading.value = false;
  }
};

const getEventStart = (event: CalendarEvent) => event.start;
const getEventEnd = (event: CalendarEvent) => event.end;

const getEventColor = (event: CalendarEvent) => event.color;

const getEventColorByType = (tipo: string) => {
  switch (tipo) {
    case 'presencial':
      return '#42A5F5'; // Azul
    case 'teleconsulta':
      return '#66BB6A'; // Verde
    case 'emergencia':
      return '#EF5350'; // Rojo
    default:
      return '#9CCC65'; // Verde claro
  }
};

const getEventTypeColor = (tipo: string) => {
  switch (tipo) {
    case 'presencial':
      return 'blue';
    case 'teleconsulta':
      return 'green';
    case 'emergencia':
      return 'red';
    default:
      return 'grey';
  }
};

const getEventTypeIcon = (tipo: string) => {
  switch (tipo) {
    case 'presencial':
      return 'mdi-account';
    case 'teleconsulta':
      return 'mdi-video';
    case 'emergencia':
      return 'mdi-alert';
    default:
      return 'mdi-help-circle';
  }
};

const getStatusColor = (estado: string) => {
  switch (estado) {
    case 'programada':
      return 'info';
    case 'confirmada':
      return 'success';
    case 'en_progreso':
      return 'warning';
    case 'completada':
      return 'primary';
    case 'cancelada':
      return 'error';
    case 'no_presento':
      return 'warning';
    default:
      return 'grey';
  }
};

const getStatusText = (estado: string) => {
  switch (estado) {
    case 'programada':
      return 'Programada';
    case 'confirmada':
      return 'Confirmada';
    case 'en_progreso':
      return 'En Progreso';
    case 'completada':
      return 'Completada';
    case 'cancelada':
      return 'Cancelada';
    case 'no_presento':
      return 'No Presentó';
    default:
      return estado;
  }
};

const getTipoColor = (tipo: string) => {
  switch (tipo) {
    case 'presencial':
      return 'blue';
    case 'teleconsulta':
      return 'green';
    case 'emergencia':
      return 'red';
    default:
      return 'grey';
  }
};

const getTipoText = (tipo: string) => {
  switch (tipo) {
    case 'presencial':
      return 'Presencial';
    case 'teleconsulta':
      return 'Teleconsulta';
    case 'emergencia':
      return 'Emergencia';
    default:
      return tipo;
  }
};

const formatDateWithTime = (date: string, time: string) => {
  const dateObj = new Date(date);
  const options: Intl.DateTimeFormatOptions = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  
  const dateTimeStr = `${date}T${time}`;
  return new Date(dateTimeStr).toLocaleDateString('es-ES', options);
};

const previousPeriod = () => {
  calendarRef.value?.prev();
};

const nextPeriod = () => {
  calendarRef.value?.next();
};

const today = () => {
  currentDate.value = new Date().toISOString().substr(0, 10);
};

const setCalendarType = (type: 'day' | 'week' | 'month') => {
  calendarType.value = type;
};

const capitalize = (str: string) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

const updateRange = ({ start, end }: { start: Date; end: Date }) => {
  // Convertir fechas a formato YYYY-MM-DD para la API
  const startDate = start.toISOString().split('T')[0];
  const endDate = end.toISOString().split('T')[0];
  
  // Cargar citas para el nuevo rango
  loadCitas(startDate, endDate);
};

const handleEventClick = ({ nativeEvent, event }: { nativeEvent: Event; event: CalendarEvent }) => {
  nativeEvent.stopPropagation();
  const cita = citas.value.find(c => c.id === event.id);
  if (cita) {
    openCitaDetails(cita);
  }
};

const openCitaDetails = (cita: CitaType) => {
  selectedCita.value = cita;
  dialogVisible.value = true;
};

const editarCita = (cita: CitaType) => {
  // Emitir evento para que el padre maneje la edición
  emit('edit-cita', cita);
  dialogVisible.value = false;
};

const eliminarCita = async (cita: CitaType) => {
  if (!cita.id) return;
  
  if (!confirm(`¿Está seguro de eliminar la cita con ${cita.pacienteNombre}?`)) {
    return;
  }
  
  loadingActions.value = true;
  try {
    const response = await citasApi.deleteCita(cita.id);
    
    if (response.success) {
      citas.value = citas.value.filter(c => c.id !== cita.id);
      toast.success('Cita eliminada exitosamente');
      dialogVisible.value = false;
    } else {
      throw new Error(response.error || 'Error al eliminar la cita');
    }
  } catch (error) {
    console.error('Error al eliminar la cita:', error);
    toast.error('Error al eliminar la cita');
  } finally {
    loadingActions.value = false;
  }
};

// Definir emisión de eventos
const emit = defineEmits(['edit-cita', 'create-cita']);

// Inicialización
onMounted(() => {
  // Cargar citas para la semana actual
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);
  const weekAhead = new Date(today);
  weekAhead.setDate(today.getDate() + 7);
  
  const startDate = weekAgo.toISOString().split('T')[0];
  const endDate = weekAhead.toISOString().split('T')[0];
  
  loadCitas(startDate, endDate);
});
</script>

<style scoped>
.event-card {
  position: absolute;
  top: 2px;
  left: 2px;
  right: 2px;
  bottom: 2px;
  padding: 4px;
  overflow: hidden;
  border-radius: 4px;
  cursor: pointer;
  background: white;
  box-shadow: 0 1px 3px rgba(0,0,0,0.12);
}

.event-all-day {
  background: rgba(66, 165, 245, 0.1);
}

.event-header {
  display: flex;
  align-items: center;
  font-size: 0.75rem;
}

.event-content {
  margin-top: 2px;
}

.event-title {
  font-size: 0.8rem;
  font-weight: bold;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.event-paciente {
  font-size: 0.7rem;
  color: #666;
}
</style>