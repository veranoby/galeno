<!-- apps/web/src/views/schedule/Calendar.vue -->
<template>
  <div class="calendar-view" :class="{ 'fullscreen': isFullscreen }">
    <!-- Header -->
    <div class="calendar-header">
      <div class="header-left">
        <h1 class="text-h4 font-weight-bold">
          <v-icon icon="mdi-calendar-month" size="large" class="mr-2" />
          Agenda Médica
        </h1>
      </div>

      <div class="header-actions">
        <!-- Navegación -->
        <v-btn-group variant="outlined" density="compact" class="mr-4">
          <v-btn icon @click="handleDateNavigate('prev')" title="Anterior">
            <v-icon>mdi-chevron-left</v-icon>
          </v-btn>
          <v-btn @click="handleToday" title="Hoy">
            Hoy
          </v-btn>
          <v-btn icon @click="handleDateNavigate('next')" title="Siguiente">
            <v-icon>mdi-chevron-right</v-icon>
          </v-btn>
        </v-btn-group>

        <!-- Selector de Vista -->
        <v-btn-toggle
          v-model="viewIndex"
          variant="outlined"
          density="compact"
          mandatory
          class="mr-4"
        >
          <v-btn
            v-for="(view, index) in views"
            :key="view.value"
            :value="index"
            @click="handleViewChange(view.value)"
          >
            {{ view.label }}
          </v-btn>
        </v-btn-toggle>

        <!-- Acciones -->
        <v-btn
          icon
          variant="text"
          @click="toggleFullscreen"
          class="mr-2"
          title="Pantalla completa"
        >
          <v-icon>{{ isFullscreen ? 'mdi-fullscreen-exit' : 'mdi-fullscreen' }}</v-icon>
        </v-btn>

        <v-btn
          color="primary"
          variant="elevated"
          @click="handleNewAppointment"
        >
          <v-icon start>mdi-plus</v-icon>
          Nueva Cita
        </v-btn>
      </div>
    </div>

    <!-- Calendario -->
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
      v-model="showModal"
      :appointment="selectedAppointment"
      :initial-date="selectedDate"
      @save="handleSaveAppointment"
      @delete="handleDeleteAppointment"
    />

    <!-- Loading Overlay -->
    <v-overlay
      v-model="isLoading"
      class="align-center justify-center"
      persistent
    >
      <v-progress-circular indeterminate size="64" color="primary" />
      <div class="mt-4 text-h6">Cargando citas...</div>
    </v-overlay>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import CalendarView from '@/components/schedule/CalendarView.vue';
import AppointmentModal from '@/components/schedule/AppointmentModal.vue';
import { useCalendar } from '@/composables/useCalendar';
import { useAppointmentsStore } from '@/stores/appointments';

const calendarRef = ref<InstanceType<typeof CalendarView>>();
const appointmentsStore = useAppointmentsStore();

const {
  calendarConfig,
  currentDate,
  currentView,
  showAppointmentModal: showModal,
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

const isFullscreen = ref(false);
const isLoading = ref(false);

const views = [
  { label: 'Mes', value: 'month' },
  { label: 'Semana', value: 'week' },
  { label: 'Día', value: 'day' }
];

const viewIndex = ref(1); // Default: Semana

const appointments = computed(() => appointmentsStore.appointments);

const toggleFullscreen = async () => {
  if (!document.fullscreenElement) {
    await document.documentElement.requestFullscreen();
    isFullscreen.value = true;
  } else {
    await document.exitFullscreen();
    isFullscreen.value = false;
  }
};

// Cargar citas al montar
onMounted(async () => {
  try {
    isLoading.value = true;
    
    // Cargar citas de los próximos 30 días
    const startDate = new Date();
    const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await appointmentsStore.fetchAppointments({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    });
    
    // Escuchar cambios en el calendario para recargar citas
    watch(currentDate, async () => {
      const viewRange = calendarRef.value?.getApi()?.currentData.dateProfile;
      if (viewRange) {
        await appointmentsStore.fetchAppointments({
          startDate: viewRange.currentRange.start.toISOString(),
          endDate: viewRange.currentRange.end.toISOString()
        });
      }
    });
  } catch (error) {
    console.error('Error loading appointments:', error);
  } finally {
    isLoading.value = false;
  }
});
</script>

<style scoped>
.calendar-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #f5f5f5;
}

.calendar-view.fullscreen {
  height: 100vh;
  margin: 0;
  padding: 0;
}

.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background-color: white;
  border-bottom: 1px solid #e0e0e0;
  flex-wrap: wrap;
  gap: 16px;
}

.header-left h1 {
  display: flex;
  align-items: center;
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.calendar-container {
  flex: 1;
  overflow: hidden;
  padding: 16px;
  background-color: white;
  margin: 16px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* Responsive */
@media (max-width: 960px) {
  .calendar-header {
    flex-direction: column;
    align-items: stretch;
  }

  .header-actions {
    justify-content: center;
  }

  .calendar-container {
    margin: 8px;
    padding: 8px;
  }
}

@media (max-width: 600px) {
  .header-left h1 {
    font-size: 1.25rem;
  }

  .v-btn-group {
    width: 100%;
  }

  .v-btn-toggle {
    width: 100%;
  }

  .v-btn-toggle .v-btn {
    flex: 1;
  }
}
</style>
