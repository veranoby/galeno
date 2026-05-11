# TASK-047E: Módulo Agenda - Arquitectura e Implementación

## 📋 Resumen Ejecutivo

**Librería Seleccionada:** Schedule-X (`@schedule-x/vue`)

**Justificación:**
- ✅ Bundle size más pequeño (~48 KB vs ~320 KB de FullCalendar)
- ✅ TypeScript nativo (72.5% coverage)
- ✅ Construido para Vue 3 Composition API
- ✅ Drag & drop nativo para reprogramar citas
- ✅ Soporte móvil excelente (médicos usan tablets)
- ✅ Mantenimiento activo (Jul 2025)
- ✅ License MIT (sin restricciones para healthcare)

---

## 1. Instalación y Configuración

### 1.1 Dependencias

```bash
cd apps/web
pnpm add @schedule-x/vue @schedule-x/calendar @schedule-x/theme-default
```

### 1.2 Estructura de Archivos

```
apps/web/src/
├── views/
│   └── schedule/
│       ├── Calendar.vue              # Vista principal
│       └── AgendaView.vue            # Vista de agenda (existe)
│
├── components/
│   └── schedule/
│       ├── CalendarView.vue          # Componente Schedule-X
│       ├── CalendarHeader.vue        # Header personalizado
│       ├── AppointmentModal.vue      # Modal de cita
│       ├── RecurringAppointmentModal.vue
│       └── TimeSlotPicker.vue
│
├── composables/
│   └── useCalendar.ts                # Lógica de calendario
│
└── stores/
    └── appointments.ts               # Pinia store para citas
```

---

## 2. Arquitectura del Componente

### 2.1 Calendar.vue - Vista Principal

```vue
<template>
  <div class="calendar-view">
    <!-- Header con controles -->
    <CalendarHeader
      :current-date="currentDate"
      :view="currentView"
      @view-change="handleViewChange"
      @date-navigate="handleDateNavigate"
      @today="handleToday"
      @new-appointment="handleNewAppointment"
    />

    <!-- Calendario Schedule-X -->
    <div class="calendar-container">
      <CalendarView
        ref="calendarRef"
        :config="calendarConfig"
        :events="appointments"
        @event-click="handleAppointmentClick"
        @event-drop="handleAppointmentDrop"
        @event-resize="handleAppointmentResize"
        @date-click="handleDateClick"
        @view-change="handleViewChange"
      />
    </div>

    <!-- Modal de Cita -->
    <AppointmentModal
      v-model="showAppointmentModal"
      :appointment="selectedAppointment"
      :initial-date="selectedDate"
      @save="handleSaveAppointment"
      @delete="handleDeleteAppointment"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { createCalendar } from '@schedule-x/vue';
import { esES } from '@schedule-x/locales';
import CalendarView from '@/components/schedule/CalendarView.vue';
import CalendarHeader from '@/components/schedule/CalendarHeader.vue';
import AppointmentModal from '@/components/schedule/AppointmentModal.vue';
import { useAppointmentsStore } from '@/stores/appointments';
import { useCalendar } from '@/composables/useCalendar';

const appointmentsStore = useAppointmentsStore();
const calendarRef = ref<InstanceType<typeof CalendarView>>();

const {
  calendarConfig,
  currentDate,
  currentView,
  showAppointmentModal,
  selectedAppointment,
  selectedDate,
  handleViewChange,
  handleDateNavigate,
  handleToday,
  handleAppointmentClick,
  handleAppointmentDrop,
  handleAppointmentResize,
  handleDateClick,
  handleSaveAppointment,
  handleDeleteAppointment,
  handleNewAppointment
} = useCalendar();

// Cargar citas al montar
onMounted(async () => {
  await appointmentsStore.fetchAppointments({
    startDate: new Date(),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 días
  });
});

const appointments = computed(() => appointmentsStore.appointments);
</script>

<style scoped>
.calendar-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.calendar-container {
  flex: 1;
  overflow: auto;
}
</style>
```

### 2.2 CalendarView.vue - Wrapper de Schedule-X

```vue
<template>
  <div ref="calendarEl" class="schedule-x-calendar"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { createCalendar, CalendarApp } from '@schedule-x/calendar';
import { themeDefault } from '@schedule-x/theme-default';
import { esES } from '@schedule-x/locales';
import { pluginDragAndDrop } from '@schedule-x/drag-and-drop';
import type { CalendarEvent, CalendarOptions } from '@schedule-x/calendar';

interface Props {
  config: CalendarOptions;
  events: CalendarEvent[];
}

const props = withDefaults(defineProps<Props>(), {
  config: () => ({}),
  events: () => []
});

const emit = defineEmits<{
  (e: 'event-click', event: CalendarEvent): void;
  (e: 'event-drop', event: CalendarEvent, deltaDays: number): void;
  (e: 'event-resize', event: CalendarEvent, deltaDays: number): void;
  (e: 'date-click', date: Date): void;
  (e: 'view-change', view: string): void;
}>();

const calendarEl = ref<HTMLDivElement>();
let calendar: CalendarApp | null = null;

onMounted(() => {
  if (!calendarEl.value) return;

  calendar = createCalendar({
    ...props.config,
    locale: esES,
    theme: themeDefault,
    plugins: [
      pluginDragAndDrop({
        onEventDrop: (event, deltaDays) => {
          emit('event-drop', event, deltaDays);
        },
        onEventResize: (event, deltaDays) => {
          emit('event-resize', event, deltaDays);
        }
      })
    ],
    callbacks: {
      onEventClick: (event) => emit('event-click', event),
      onDateClick: (date) => emit('date-click', date),
      onViewChange: (view) => emit('view-change', view.name)
    }
  });

  calendar.render(calendarEl.value);
});

// Actualizar eventos cuando cambien
watch(() => props.events, (newEvents) => {
  if (calendar) {
    calendar.setEvents(newEvents);
  }
}, { deep: true });

// Actualizar configuración
watch(() => props.config, (newConfig) => {
  if (calendar) {
    calendar.setOptions(newConfig);
  }
}, { deep: true });

onUnmounted(() => {
  if (calendar) {
    calendar.destroy();
    calendar = null;
  }
});
</script>

<style>
@import '@schedule-x/theme-default/dist/style.css';

.schedule-x-calendar {
  height: 100%;
  width: 100%;
}

/* Personalización de estilos */
.sx-event {
  border-radius: 4px;
  font-size: 12px;
  padding: 2px 4px;
}

.sx-event--doctor {
  background-color: #3b82f6;
  color: white;
}

.sx-event--teleconsulta {
  background-color: #10b981;
  color: white;
}

.sx-event--control {
  background-color: #f59e0b;
  color: white;
}
</style>
```

### 2.3 useCalendar.ts - Composable de Lógica

```typescript
// apps/web/src/composables/useCalendar.ts
import { ref, computed } from 'vue';
import type { CalendarEvent, CalendarOptions } from '@schedule-x/calendar';
import { useAppointmentsStore } from '@/stores/appointments';
import { useToast } from 'vue-toastification';
import { apiClient } from '@/services/api';

export function useCalendar() {
  const toast = useToast();
  const appointmentsStore = useAppointmentsStore();

  // Estado
  const currentDate = ref(new Date());
  const currentView = ref('month');
  const showAppointmentModal = ref(false);
  const selectedAppointment = ref<CalendarEvent | null>(null);
  const selectedDate = ref<Date | null>(null);

  // Configuración del calendario
  const calendarConfig = computed<CalendarOptions>(() => ({
    views: {
      month: {
        name: 'month',
        label: 'Mes'
      },
      week: {
        name: 'week',
        label: 'Semana',
        timeGrid: {
          slotSize: '30px', // Altura de cada slot de tiempo
          slotDuration: '00:30:00' // Slots de 30 minutos
        }
      },
      day: {
        name: 'day',
        label: 'Día',
        timeGrid: {
          slotSize: '30px',
          slotDuration: '00:15:00' // Slots de 15 minutos
        }
      }
    },
    defaultView: 'week',
    firstDayOfWeek: 1, // Lunes
    minTime: '07:00:00', // 7 AM
    maxTime: '20:00:00', // 8 PM
    isDark: false,
    timeZone: 'America/Guayaquil'
  }));

  // Navegación
  const handleViewChange = (view: string) => {
    currentView.value = view;
  };

  const handleDateNavigate = (direction: 'prev' | 'next') => {
    const date = new Date(currentDate.value);
    
    if (currentView.value === 'month') {
      date.setMonth(date.getMonth() + (direction === 'next' ? 1 : -1));
    } else if (currentView.value === 'week') {
      date.setDate(date.getDate() + (direction === 'next' ? 7 : -7));
    } else {
      date.setDate(date.getDate() + (direction === 'next' ? 1 : -1));
    }
    
    currentDate.value = date;
  };

  const handleToday = () => {
    currentDate.value = new Date();
  };

  // Manejo de citas
  const handleAppointmentClick = (event: CalendarEvent) => {
    selectedAppointment.value = event;
    showAppointmentModal.value = true;
  };

  const handleDateClick = (date: Date) => {
    selectedDate.value = date;
    selectedAppointment.value = null;
    showAppointmentModal.value = true;
  };

  const handleNewAppointment = () => {
    selectedDate.value = new Date();
    selectedAppointment.value = null;
    showAppointmentModal.value = true;
  };

  // Drag & Drop
  const handleAppointmentDrop = async (event: CalendarEvent, deltaDays: number) => {
    try {
      const newStart = new Date(event.start as string);
      newStart.setDate(newStart.getDate() + deltaDays);

      await apiClient.put(`/api/v1/agenda/citas/${event.id}`, {
        fechaHora: newStart.toISOString()
      });

      toast.success('Cita reprogramada exitosamente');
      
      // Actualizar store
      await appointmentsStore.updateAppointment(event.id, {
        fechaHora: newStart.toISOString()
      });
    } catch (error) {
      toast.error('Error al reprogramar cita');
      // Revertir cambio
      await appointmentsStore.fetchAppointments({});
    }
  };

  // Resize
  const handleAppointmentResize = async (event: CalendarEvent, deltaDays: number) => {
    try {
      const newEnd = new Date(event.end as string);
      newEnd.setDate(newEnd.getDate() + deltaDays);

      await apiClient.put(`/api/v1/agenda/citas/${event.id}`, {
        fechaHoraFin: newEnd.toISOString()
      });

      toast.success('Duración actualizada exitosamente');
    } catch (error) {
      toast.error('Error al actualizar duración');
      await appointmentsStore.fetchAppointments({});
    }
  };

  // Guardar cita
  const handleSaveAppointment = async (appointmentData: any) => {
    try {
      if (selectedAppointment.value?.id) {
        // Actualizar
        await apiClient.put(`/api/v1/agenda/citas/${selectedAppointment.value.id}`, appointmentData);
        toast.success('Cita actualizada exitosamente');
      } else {
        // Crear
        await apiClient.post('/api/v1/agenda/citas', appointmentData);
        toast.success('Cita creada exitosamente');
      }

      showAppointmentModal.value = false;
      await appointmentsStore.fetchAppointments({});
    } catch (error) {
      toast.error('Error al guardar cita');
      throw error;
    }
  };

  // Eliminar cita
  const handleDeleteAppointment = async (appointmentId: string) => {
    try {
      await apiClient.delete(`/api/v1/agenda/citas/${appointmentId}`);
      toast.success('Cita eliminada exitosamente');
      
      showAppointmentModal.value = false;
      await appointmentsStore.fetchAppointments({});
    } catch (error) {
      toast.error('Error al eliminar cita');
      throw error;
    }
  };

  return {
    // Estado
    calendarConfig,
    currentDate,
    currentView,
    showAppointmentModal,
    selectedAppointment,
    selectedDate,
    
    // Métodos
    handleViewChange,
    handleDateNavigate,
    handleToday,
    handleAppointmentClick,
    handleAppointmentDrop,
    handleAppointmentResize,
    handleDateClick,
    handleSaveAppointment,
    handleDeleteAppointment,
    handleNewAppointment
  };
}

export default useCalendar;
```

---

## 3. Pinia Store para Citas

```typescript
// apps/web/src/stores/appointments.ts
import { defineStore } from 'pinia';
import type { CalendarEvent } from '@schedule-x/calendar';
import { apiClient } from '@/services/api';

export interface Appointment extends CalendarEvent {
  id: string;
  pacienteId: string;
  pacienteNombre: string;
  doctorId: string;
  doctorNombre: string;
  tipo: 'presencial' | 'teleconsulta' | 'control';
  estado: 'programada' | 'confirmada' | 'en_progreso' | 'completada' | 'cancelada';
  motivo?: string;
  notas?: string;
  linkVideo?: string;
}

interface FetchFilters {
  startDate?: Date;
  endDate?: Date;
  doctorId?: string;
  estado?: string;
}

export const useAppointmentsStore = defineStore('appointments', () => {
  // Estado
  const appointments = ref<Appointment[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Fetch citas
  const fetchAppointments = async (filters: FetchFilters = {}) => {
    try {
      isLoading.value = true;
      error.value = null;

      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate.toISOString());
      if (filters.endDate) params.append('endDate', filters.endDate.toISOString());
      if (filters.doctorId) params.append('doctorId', filters.doctorId);
      if (filters.estado) params.append('estado', filters.estado);

      const response = await apiClient.get<Appointment[]>(
        `/api/v1/agenda/citas?${params.toString()}`
      );

      if (response.success && response.data) {
        appointments.value = response.data.map(mapToCalendarEvent);
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error al cargar citas';
    } finally {
      isLoading.value = false;
    }
  };

  // Actualizar cita
  const updateAppointment = async (id: string, data: Partial<Appointment>) => {
    const index = appointments.value.findIndex(a => a.id === id);
    if (index !== -1) {
      appointments.value[index] = { ...appointments.value[index], ...data };
    }
  };

  // Agregar cita
  const addAppointment = (appointment: Appointment) => {
    appointments.value.push(appointment);
  };

  // Eliminar cita
  const removeAppointment = (id: string) => {
    const index = appointments.value.findIndex(a => a.id === id);
    if (index !== -1) {
      appointments.value.splice(index, 1);
    }
  };

  return {
    // Estado
    appointments,
    isLoading,
    error,
    
    // Acciones
    fetchAppointments,
    updateAppointment,
    addAppointment,
    removeAppointment
  };
});

// Mapear citas del backend a formato Schedule-X
function mapToCalendarEvent(appointment: Appointment): CalendarEvent {
  return {
    id: appointment.id,
    title: `${appointment.pacienteNombre} - ${appointment.tipo}`,
    start: appointment.fechaHora,
    end: appointment.fechaHoraFin,
    color: getColorForType(appointment.tipo),
    cssClass: `sx-event--${appointment.tipo}`,
    // Datos personalizados
    pacienteId: appointment.pacienteId,
    pacienteNombre: appointment.pacienteNombre,
    doctorId: appointment.doctorId,
    doctorNombre: appointment.doctorNombre,
    tipo: appointment.tipo,
    estado: appointment.estado,
    motivo: appointment.motivo,
    notas: appointment.notas,
    linkVideo: appointment.linkVideo
  };
}

function getColorForType(tipo: string): string {
  const colors: Record<string, string> = {
    presencial: '#3b82f6',    // Azul
    teleconsulta: '#10b981',  // Verde
    control: '#f59e0b'        // Ámbar
  };
  return colors[tipo] || '#6b7280';
}
```

---

## 4. Backend - Endpoints Requeridos

### 4.1 Rutas Existentes (Verificar)

```typescript
// apps/api/src/routes/v1/agenda.routes.ts

// ✅ GET /api/v1/agenda/citas - Listar citas
// ✅ POST /api/v1/agenda/citas - Crear cita
// ✅ GET /api/v1/agenda/citas/:id - Obtener cita
// ✅ PUT /api/v1/agenda/citas/:id - Actualizar cita
// ✅ DELETE /api/v1/agenda/citas/:id - Eliminar cita

// ✅ GET /api/v1/agenda/disponibilidad - Verificar disponibilidad
// ✅ POST /api/v1/agenda/disponibilidad - Crear slot disponible
```

### 4.2 Endpoints Adicionales Sugeridos

```typescript
// GET /api/v1/agenda/citas?startDate=X&endDate=Y&doctorId=Z&estado=W
// Query params para filtrado avanzado

// POST /api/v1/agenda/citas/bulk
// Crear múltiples citas (para controles programados)

// GET /api/v1/agenda/estadisticas
// Estadísticas de citas por período
```

---

## 5. Características Clave para Agenda Médica

### 5.1 Tipos de Cita

| Tipo | Color | Duración | Descripción |
|------|-------|----------|-------------|
| Presencial | Azul (#3b82f6) | 30 min | Consulta en consultorio |
| Teleconsulta | Verde (#10b981) | 20 min | Videollamada |
| Control | Ámbar (#f59e0b) | 15 min | Seguimiento |
| Primera Vez | Morado (#8b5cf6) | 45 min | Consulta inicial |
| Emergencia | Rojo (#ef4444) | 60 min | Urgencia |

### 5.2 Estados de Cita

```typescript
type CitaEstado = 
  | 'programada'      // Cita agendada
  | 'confirmada'      // Paciente confirmó
  | 'en_progreso'     // En atención
  | 'completada'      // Finalizada
  | 'cancelada'       // Cancelada
  | 'no_presento';    // Paciente no asistió
```

### 5.3 Vistas del Calendario

| Vista | Uso | Time Slots |
|-------|-----|------------|
| **Mes** | Planificación general | Días completos |
| **Semana** | Agenda semanal | 30 minutos |
| **Día** | Agenda diaria | 15 minutos |
| **Agenda** | Lista de citas | N/A |

---

## 6. Checklist de Implementación

### Fase 1: Setup
- [ ] Instalar Schedule-X packages
- [ ] Crear estructura de carpetas
- [ ] Configurar Pinia store
- [ ] Crear composable useCalendar

### Fase 2: Componentes Básicos
- [ ] CalendarView.vue wrapper
- [ ] CalendarHeader.vue
- [ ] AppointmentModal.vue
- [ ] Integrar con backend API

### Fase 3: Drag & Drop
- [ ] Configurar plugin drag-and-drop
- [ ] Implementar handleAppointmentDrop
- [ ] Implementar handleAppointmentResize
- [ ] Validar disponibilidad al mover

### Fase 4: Features Avanzadas
- [ ] Recurring appointments
- [ ] Multi-doctor views (resource scheduler)
- [ ] Timezone handling
- [ ] Mobile responsive

### Fase 5: Testing
- [ ] Pruebas de integración
- [ ] Pruebas E2E de flujo completo
- [ ] Pruebas de responsive
- [ ] Accessibility testing

---

## 7. Métricas de Éxito

| Métrica | Objetivo | Cómo Medir |
|---------|----------|------------|
| Tiempo de carga inicial | < 2s | Lighthouse Performance |
| Drag & drop latency | < 100ms | Performance monitoring |
| Bundle size impacto | < 50 KB | Bundle analyzer |
| Mobile usability | 100% funcional | Test en iPad/Android |
| Accessibility | WCAG 2.1 AA | axe-core testing |

---

**Documento creado:** 2026-03-03  
**TASK-047E:** Módulo Agenda  
**Estado:** 📋 Arquitectura Completada  
**Próximo Hito:** Implementación de CalendarView.vue
