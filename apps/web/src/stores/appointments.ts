// apps/web/src/stores/appointments.ts
import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { EventInput } from '@fullcalendar/core';
import { apiClient } from '@/services/api';

export type CitaTipo = 'presencial' | 'teleconsulta' | 'control' | 'primera_vez' | 'emergencia';
export type CitaEstado = 'programada' | 'confirmada' | 'en_progreso' | 'completada' | 'cancelada' | 'no_presento';

export interface Appointment extends EventInput {
  id: string;
  pacienteId: string;
  pacienteNombre: string;
  doctorId: string;
  doctorNombre: string;
  tipo: CitaTipo;
  estado: CitaEstado;
  motivo?: string;
  notas?: string;
  linkVideo?: string;
  fechaHora: string;
  fechaHoraFin: string;
}

interface FetchFilters {
  startDate?: string;
  endDate?: string;
  doctorId?: string;
  estado?: string;
  tipo?: string;
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
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.doctorId) params.append('doctorId', filters.doctorId);
      if (filters.estado) params.append('estado', filters.estado);
      if (filters.tipo) params.append('tipo', filters.tipo);

      const response = await apiClient.get<Appointment[]>(
        `/api/v1/agenda/citas?${params.toString()}`
      );

      if (response.success && response.data) {
        appointments.value = response.data.map(mapToCalendarEvent);
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error al cargar citas';
      console.error('Error fetching appointments:', e);
    } finally {
      isLoading.value = false;
    }
  };

  // Actualizar cita
  const updateAppointment = async (id: string, data: Partial<Appointment>) => {
    const index = appointments.value.findIndex((a: Appointment) => a.id === id);
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
    const index = appointments.value.findIndex((a: Appointment) => a.id === id);
    if (index !== -1) {
      appointments.value.splice(index, 1);
    }
  };

  // Obtener cita por ID
  const getAppointment = (id: string): Appointment | undefined => {
    return appointments.value.find((a: Appointment) => a.id === id);
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
    removeAppointment,
    getAppointment
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

function getColorForType(tipo: CitaTipo): string {
  const colors: Record<CitaTipo, string> = {
    presencial: '#3b82f6',    // Azul
    teleconsulta: '#10b981',  // Verde
    control: '#f59e0b',       // Ámbar
    primera_vez: '#8b5cf6',   // Morado
    emergencia: '#ef4444'     // Rojo
  };
  return colors[tipo] || '#6b7280';
}
