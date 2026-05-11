// apps/web/src/composables/useCalendar.ts
import { ref, computed } from 'vue';
import type { EventInput } from '@fullcalendar/core';
import { useAppointmentsStore } from '@/stores/appointments';
import { useToast } from 'vue-toastification';
import { apiClient } from '@/services/api';

export function useCalendar() {
  const toast = useToast();
  const appointmentsStore = useAppointmentsStore();

  // Estado
  const currentDate = ref(new Date().toISOString());
  const currentView = ref('timeGridWeek');
  const showAppointmentModal = ref(false);
  const selectedAppointment = ref<EventInput | null>(null);
  const selectedDate = ref<string | null>(null);
  const isSaving = ref(false);

  // Configuración del calendario
  const calendarConfig = computed(() => ({
    initialView: currentView.value,
    locale: 'es',
    firstDay: 1,
    slotDuration: '00:30:00',
    slotMinTime: '07:00:00',
    slotMaxTime: '20:00:00'
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
    
    currentDate.value = date.toISOString();
  };

  const handleToday = () => {
    currentDate.value = new Date().toISOString();
  };

  // Manejo de citas
  const handleAppointmentClick = (event: CalendarEvent) => {
    selectedAppointment.value = event;
    showAppointmentModal.value = true;
  };

  const handleDateClick = (date: string) => {
    selectedDate.value = date;
    selectedAppointment.value = null;
    showAppointmentModal.value = true;
  };

  const handleNewAppointment = () => {
    selectedDate.value = new Date().toISOString();
    selectedAppointment.value = null;
    showAppointmentModal.value = true;
  };

  // Drag & Drop
  const handleAppointmentDrop = async (event: EventInput, deltaDays: number) => {
    try {
      const newStart = new Date(event.start as string);
      newStart.setDate(newStart.getDate() + deltaDays);

      const newEnd = event.end ? new Date(event.end as string) : null;
      if (newEnd) {
        newEnd.setDate(newEnd.getDate() + deltaDays);
      }

      await apiClient.put(`/api/v1/agenda/citas/${event.id}`, {
        fechaHora: newStart.toISOString(),
        fechaHoraFin: newEnd?.toISOString()
      });

      toast.success('Cita reprogramada exitosamente');
      
      // Actualizar store
      await appointmentsStore.updateAppointment(event.id as string, {
        fechaHora: newStart.toISOString(),
        fechaHoraFin: newEnd?.toISOString()
      });
    } catch (error) {
      toast.error('Error al reprogramar cita');
      console.error('Error rescheduling appointment:', error);
      await appointmentsStore.fetchAppointments({});
    }
  };

  // Resize
  const handleAppointmentResize = async (event: EventInput, deltaMinutes: number) => {
    try {
      const newEnd = new Date(event.end as string);
      newEnd.setMinutes(newEnd.getMinutes() + deltaMinutes);

      await apiClient.put(`/api/v1/agenda/citas/${event.id}`, {
        fechaHoraFin: newEnd.toISOString()
      });

      toast.success('Duración actualizada exitosamente');
    } catch (error) {
      toast.error('Error al actualizar duración');
      console.error('Error resizing appointment:', error);
      await appointmentsStore.fetchAppointments({});
    }
  };

  // Guardar cita
  const handleSaveAppointment = async (appointmentData: any) => {
    try {
      isSaving.value = true;

      if ((selectedAppointment.value as any)?.id) {
        // Actualizar
        await apiClient.put(`/api/v1/agenda/citas/${(selectedAppointment.value as any).id}`, appointmentData);
        toast.success('Cita actualizada exitosamente');
      } else {
        // Crear
        await apiClient.post('/api/v1/agenda/citas', appointmentData);
        toast.success('Cita creada exitosamente');
      }

      showAppointmentModal.value = false;
      await appointmentsStore.fetchAppointments({});
    } catch (error) {
      console.error('Error saving appointment:', error);
      toast.error('Error al guardar cita');
      throw error;
    } finally {
      isSaving.value = false;
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
      console.error('Error deleting appointment:', error);
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
    isSaving,
    
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
