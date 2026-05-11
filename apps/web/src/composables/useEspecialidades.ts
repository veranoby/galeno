// apps/web/src/composables/useEspecialidades.ts
/**
 * Composable para gestión de Especialidades Médicas
 * CRUD completo + asignación a doctores
 */

import { ref } from 'vue';
import { useApi } from './useApi';
import type { ApiResponse } from '@galeno/shared-types';

export interface Especialidad {
  id: string;
  nombre: string;
  nombreCorto: string;
  descripcion?: string;
  activo: boolean;
  herramientas?: any;
}

export interface DoctorEspecialidad {
  id: string;
  doctorId: string;
  especialidadId: string;
  principal: boolean;
  senescytValidada: boolean;
  especialidad?: Especialidad;
}

export interface CreateEspecialidadDTO {
  nombre: string;
  nombreCorto: string;
  descripcion?: string;
  herramientas?: any;
}

export interface UpdateEspecialidadDTO {
  nombre?: string;
  nombreCorto?: string;
  descripcion?: string;
  activo?: boolean;
  herramientas?: any;
}

export function useEspecialidades() {
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const { get, post, put, delete: deleteApi } = useApi();

  /**
   * Cargar todas las especialidades
   */
  async function cargarEspecialidades(): Promise<Especialidad[]> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await get<ApiResponse<Especialidad[]>>('/api/v1/especialidades');
      if (response.success && response.data) {
        return response.data as unknown as Especialidad[];
      }
      throw new Error(response.error || 'Error al cargar especialidades');
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Error de conexión';
      return [];
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Cargar especialidad por ID
   */
  async function cargarEspecialidad(id: string): Promise<Especialidad | null> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await get<ApiResponse<Especialidad>>(`/api/v1/especialidades/${id}`);
      if (response.success && response.data) {
        return response.data as unknown as Especialidad;
      }
      return null;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Error de conexión';
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Crear nueva especialidad
   */
  async function crearEspecialidad(data: CreateEspecialidadDTO): Promise<Especialidad | null> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await post<ApiResponse<Especialidad>>('/api/v1/especialidades', data);
      if (response.success && response.data) {
        return response.data as unknown as Especialidad;
      }
      throw new Error(response.error || 'Error al crear especialidad');
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Error de conexión';
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Actualizar especialidad
   */
  async function actualizarEspecialidad(
    id: string,
    data: UpdateEspecialidadDTO
  ): Promise<Especialidad | null> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await put<ApiResponse<Especialidad>>(
        `/api/v1/especialidades/${id}`,
        data
      );
      if (response.success && response.data) {
        return response.data as unknown as Especialidad;
      }
      throw new Error(response.error || 'Error al actualizar especialidad');
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Error de conexión';
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Eliminar especialidad (lógico - set activo = false)
   */
  async function eliminarEspecialidad(id: string): Promise<boolean> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await deleteApi<ApiResponse<void>>(`/api/v1/especialidades/${id}`);
      return response.success;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Error de conexión';
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Cargar especialidades de un doctor
   */
  async function cargarEspecialidadesDoctor(doctorId: string): Promise<DoctorEspecialidad[]> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await get<ApiResponse<DoctorEspecialidad[]>>(
        `/api/v1/especialidades/doctor/${doctorId}`
      );
      if (response.success && response.data) {
        return response.data as unknown as DoctorEspecialidad[];
      }
      return [];
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Error de conexión';
      return [];
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Asignar especialidad a doctor
   */
  async function asignarEspecialidad(
    doctorId: string,
    especialidadId: string,
    principal: boolean = false
  ): Promise<DoctorEspecialidad | null> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await post<ApiResponse<DoctorEspecialidad>>(
        `/api/v1/doctors/${doctorId}/especialidades`,
        {
          especialidadId,
          principal
        }
      );
      if (response.success && response.data) {
        return response.data as unknown as DoctorEspecialidad;
      }
      throw new Error(response.error || 'Error al asignar especialidad');
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Error de conexión';
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Remover especialidad de doctor
   */
  async function removerEspecialidad(
    doctorId: string,
    especialidadId: string
  ): Promise<boolean> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await deleteApi<ApiResponse<void>>(
        `/api/v1/doctors/${doctorId}/especialidades/${especialidadId}`
      );
      return response.success;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Error de conexión';
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  return {
    // State
    isLoading,
    error,

    // Especialidades CRUD
    cargarEspecialidades,
    cargarEspecialidad,
    crearEspecialidad,
    actualizarEspecialidad,
    eliminarEspecialidad,

    // Doctor-Especialidad
    cargarEspecialidadesDoctor,
    asignarEspecialidad,
    removerEspecialidad
  };
}
