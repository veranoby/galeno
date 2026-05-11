<!-- apps/web/src/components/schedule/CalendarView.vue -->
<template>
  <div class="fullcalendar-container">
    <FullCalendar
      ref="calendarRef"
      :options="calendarOptions"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import FullCalendar from '@fullcalendar/vue3';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import type { CalendarOptions, EventApi, DateSelectArg, EventClickArg } from '@fullcalendar/core';

interface Props {
  events: any[];
  initialView?: string;
  headerToolbar?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  events: () => [],
  initialView: 'timeGridWeek',
  headerToolbar: true
});

const emit = defineEmits<{
  (e: 'event-click', event: any): void;
  (e: 'event-drop', event: any, deltaDays: number): void;
  (e: 'event-resize', event: any, deltaMinutes: number): void;
  (e: 'date-click', date: Date): void;
  (e: 'date-select', selection: DateSelectArg): void;
  (e: 'view-change', view: string): void;
}>();

const calendarRef = ref<any>();

// Configuración del calendario
const calendarOptions = computed<CalendarOptions>(() => ({
  plugins: [
    dayGridPlugin,
    timeGridPlugin,
    interactionPlugin
  ],
  initialView: props.initialView,
  locale: esLocale,
  firstDay: 1, // Lunes
  headerToolbar: props.headerToolbar ? {
    left: 'prev,next today',
    center: 'title',
    right: 'dayGridMonth,timeGridWeek,timeGridDay'
  } : false,
  buttonText: {
    today: 'Hoy',
    month: 'Mes',
    week: 'Semana',
    day: 'Día'
  },
  allDaySlot: true,
  slotDuration: '00:30:00', // Slots de 30 minutos
  slotMinTime: '07:00:00', // 7 AM
  slotMaxTime: '20:00:00', // 8 PM
  height: '100%',
  expandRows: true,
  nowIndicator: true,
  selectable: true,
  editable: true,
  droppable: true,
  eventResizableFromStart: true,
  dayMaxEvents: true,
  dayMaxEventRows: 3,
  initialEvents: props.events,
  
  // Event Handlers
  eventClick: (info: EventClickArg) => {
    emit('event-click', {
      id: info.event.id,
      title: info.event.title,
      start: info.event.start,
      end: info.event.end,
      extendedProps: info.event.extendedProps
    });
  },
  
  eventDrop: (info: any) => {
    const deltaDays = info.delta.days || 0;
    emit('event-drop', {
      id: info.event.id,
      title: info.event.title,
      start: info.event.start,
      end: info.event.end,
      extendedProps: info.event.extendedProps
    }, deltaDays);
  },
  
  eventResize: (info: any) => {
    const deltaMinutes = (info.endDelta?.milliseconds || 0) / 60000;
    emit('event-resize', {
      id: info.event.id,
      title: info.event.title,
      start: info.event.start,
      end: info.event.end,
      extendedProps: info.event.extendedProps
    }, deltaMinutes);
  },
  
  dateClick: (info: any) => {
    emit('date-click', new Date(info.date));
  },
  
  select: (info: DateSelectArg) => {
    emit('date-select', info);
  },
  
  datesSet: (info: any) => {
    emit('view-change', info.view.type);
  }
}));

// Actualizar eventos cuando cambien
watch(() => props.events, (newEvents) => {
  if (calendarRef.value) {
    const calendarApi = calendarRef.value.getApi();
    
    // Remover eventos existentes
    calendarApi.getEvents().forEach((event: EventApi) => {
      event.remove();
    });
    
    // Agregar nuevos eventos
    newEvents.forEach((event) => {
      calendarApi.addEvent(event);
    });
  }
}, { deep: true, immediate: true });

// Exponer métodos del calendario
defineExpose({
  getApi: () => calendarRef.value?.getApi(),
  changeView: (view: string) => calendarRef.value?.getApi()?.changeView(view),
  today: () => calendarRef.value?.getApi()?.today(),
  prev: () => calendarRef.value?.getApi()?.prev(),
  next: () => calendarRef.value?.getApi()?.next(),
  addEvent: (event: any) => calendarRef.value?.getApi()?.addEvent(event),
  getEventById: (id: string) => calendarRef.value?.getApi()?.getEventById(id),
  removeAllEvents: () => calendarRef.value?.getApi()?.removeAllEvents()
});
</script>

<style>
@import '@fullcalendar/core/main.css';
@import '@fullcalendar/daygrid/main.css';
@import '@fullcalendar/timegrid/main.css';
@import '@fullcalendar/list/main.css';

.fullcalendar-container {
  height: 100%;
  width: 100%;
}

/* Personalización de estilos */
.fc {
  font-family: inherit;
  font-size: 14px;
}

.fc-toolbar {
  padding: 16px;
  background-color: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.fc-toolbar-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1a1a2e;
}

.fc-button-primary {
  background-color: #3b82f6;
  border-color: #3b82f6;
}

.fc-button-primary:hover {
  background-color: #2563eb;
  border-color: #2563eb;
}

.fc-button-primary:not(:disabled).fc-button-active {
  background-color: #1d4ed8;
  border-color: #1d4ed8;
}

.fc-event {
  border-radius: 4px;
  font-size: 12px;
  padding: 2px 4px;
  cursor: pointer;
  border: none;
}

.fc-event:hover {
  opacity: 0.8;
}

/* Colores por tipo de cita */
.fc-event-presencial {
  background-color: #3b82f6 !important;
}

.fc-event-teleconsulta {
  background-color: #10b981 !important;
}

.fc-event-control {
  background-color: #f59e0b !important;
}

.fc-event-primera_vez {
  background-color: #8b5cf6 !important;
}

.fc-event-emergencia {
  background-color: #ef4444 !important;
}

/* Now indicator */
.fc-timegrid-now-indicator-line {
  border-color: #ef4444;
  border-width: 2px;
}

.fc-timegrid-now-indicator-arrow {
  color: #ef4444;
}

/* Responsive */
@media (max-width: 768px) {
  .fc-toolbar {
    flex-direction: column;
    gap: 8px;
  }

  .fc-toolbar-title {
    font-size: 1rem;
  }

  .fc-button {
    padding: 4px 8px;
    font-size: 12px;
  }

  .fc-daygrid-day-number {
    font-size: 12px;
  }

  .fc-col-header-cell-cushion {
    font-size: 12px;
  }
}
</style>
