// apps/web/src/services/citas.ts
import { apiClient } from '@/services/api';
import type { Cita, ApiResponse } from '@galeno/shared-types';
import { transformarCitaParaFrontend, transformarCitasParaFrontend } from '@/utils/citaTransformers';

// Re-exportar tipo Cita desde shared-types
export type { Cita };

export interface SlotDisponibilidad {
  id: string;
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
  duracionMinutos: number;
  tipo: 'presencial' | 'teleconsulta';
  activo: boolean;
}

export interface CrearCitaDto {
  doctorId: string;
  pacienteId: string;
  fechaHora: Date;
  tipo: 'presencial' | 'teleconsulta';
  ubicacionId?: string;
}

export interface ActualizarCitaDto {
  fechaHora?: Date;
  tipo?: 'presencial' | 'teleconsulta';
  estado?: string;
  ubicacionId?: string;
}

// API Service
export const citasApi = {
  // Citas
  async getCitas(doctorId: string, startDate?: string, endDate?: string): Promise<{ success: boolean; data: Cita[]; error?: string }> {
    const queryParams = new URLSearchParams({ doctorId });
    if (startDate) queryParams.append('fechaDesde', startDate);
    if (endDate) queryParams.append('fechaHasta', endDate);

    const response: ApiResponse<any> = await apiClient.get(`/api/v1/agenda/citas?${queryParams}`);

    if (response.success && response.data) {
      const citasData = Array.isArray(response.data) ? response.data : (response.data.data || []);
      return {
        success: true,
        data: transformarCitasParaFrontend(citasData)
      };
    }
    return { success: false, error: response.error, data: [] };
  },

  async getCita(id: string): Promise<{ success: boolean; data: Cita; error?: string }> {
    const response: ApiResponse<any> = await apiClient.get(`/api/v1/agenda/citas/${id}`);

    if (response.success && response.data) {
      return {
        success: true,
        data: transformarCitaParaFrontend(response.data)
      };
    }
    return { success: false, error: response.error, data: null as any };
  },

  async crearCita(datos: CrearCitaDto): Promise<{ success: boolean; data: Cita; error?: string }> {
    const response: ApiResponse<any> = await apiClient.post('/api/v1/agenda/citas', datos);

    if (response.success && response.data) {
      return {
        success: true,
        data: transformarCitaParaFrontend(response.data)
      };
    }
    return { success: false, error: response.error, data: null as any };
  },

  async actualizarCita(id: string, datos: ActualizarCitaDto): Promise<{ success: boolean; data: Cita; error?: string }> {
    const response: ApiResponse<any> = await apiClient.put(`/api/v1/agenda/citas/${id}`, datos);

    if (response.success && response.data) {
      return {
        success: true,
        data: transformarCitaParaFrontend(response.data)
      };
    }
    return { success: false, error: response.error, data: null as any };
  },

  async updateCita(id: string, datos: Partial<Cita>): Promise<{ success: boolean; data: Cita; error?: string }> {
    // Convertir Partial<Cita> a ActualizarCitaDto compatible
    const actualizarDatos: ActualizarCitaDto = {};
    if (datos.fechaHora) actualizarDatos.fechaHora = datos.fechaHora as Date;
    if (datos.tipo) actualizarDatos.tipo = datos.tipo;
    if (datos.estado) actualizarDatos.estado = datos.estado;
    if (datos.ubicacionId) actualizarDatos.ubicacionId = datos.ubicacionId;
    return await this.actualizarCita(id, actualizarDatos);
  },

  async deleteCita(id: string): Promise<{ success: boolean; error?: string }> {
    const response: ApiResponse<any> = await apiClient.delete(`/api/v1/agenda/citas/${id}`);
    return { success: response.success, error: response.error };
  },

  async eliminarCita(id: string): Promise<{ success: boolean; error?: string }> {
    return await this.deleteCita(id);
  },

  async createCita(datos: CrearCitaDto): Promise<{ success: boolean; data: Cita; error?: string }> {
    return await this.crearCita(datos);
  },

  async cancelarCita(id: string): Promise<{ success: boolean; data: Cita; error?: string }> {
    const response: ApiResponse<any> = await apiClient.patch(`/api/v1/agenda/citas/${id}/cancelar`, {});

    if (response.success && response.data) {
      return {
        success: true,
        data: transformarCitaParaFrontend(response.data)
      };
    }
    return { success: false, error: response.error, data: null as any };
  },

  // Disponibilidad
  async getDisponibilidad(doctorId: string): Promise<{ success: boolean; data: SlotDisponibilidad[]; error?: string }> {
    const response: ApiResponse<SlotDisponibilidad[]> = await apiClient.get(`/api/v1/agenda/disponibilidad?doctorId=${doctorId}`);
    return { success: response.success, data: response.data || [], error: response.error };
  },

  async getSlotDisponibilidad(id: string): Promise<{ success: boolean; data: SlotDisponibilidad; error?: string }> {
    const response: ApiResponse<SlotDisponibilidad> = await apiClient.get(`/api/v1/agenda/disponibilidad/${id}`);
    return { success: response.success, data: response.data || null as any, error: response.error };
  },

  async crearDisponibilidad(datos: Partial<SlotDisponibilidad>): Promise<{ success: boolean; data: SlotDisponibilidad; error?: string }> {
    const response: ApiResponse<SlotDisponibilidad> = await apiClient.post('/api/v1/agenda/disponibilidad', datos);
    return { success: response.success, data: response.data || null as any, error: response.error };
  },

  async actualizarDisponibilidad(id: string, datos: Partial<SlotDisponibilidad>): Promise<{ success: boolean; data: SlotDisponibilidad; error?: string }> {
    const response: ApiResponse<SlotDisponibilidad> = await apiClient.put(`/api/v1/agenda/disponibilidad/${id}`, datos);
    return { success: response.success, data: response.data || null as any, error: response.error };
  },

  async eliminarDisponibilidad(id: string): Promise<{ success: boolean; error?: string }> {
    const response: ApiResponse<any> = await apiClient.delete(`/api/v1/agenda/disponibilidad/${id}`);
    return { success: response.success, error: response.error };
  }
};

// Alias para compatibilidad con código existente
export const citaService = citasApi;