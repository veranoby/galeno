// apps/web/src/composables/useUbicacion.ts
/**
 * Composable para gestión de ubicaciones GPS y oficinas
 * Incluye geolocalización del navegador y búsqueda de oficinas cercanas
 */

import { ref } from 'vue';
import { useApi } from './useApi';
import type { ApiResponse } from '@galeno/shared-types';

export interface Oficina {
  id: string;
  nombre: string;
  direccion: string;
  latitud: number;
  longitud: number;
  radio: number;
  activo: boolean;
  distancia?: number;
}

export interface DoctorUbicacion {
  id: string;
  doctorId: string;
  oficinaId: string;
  diaSemana: string;
  horaInicio: string;
  horaFin: string;
  doctor?: {
    id: string;
    nombre: string;
    email: string;
  };
  oficina?: {
    id: string;
    nombre: string;
  };
}

export interface CreateOficinaDTO {
  nombre: string;
  direccion: string;
  latitud: number;
  longitud: number;
  radio?: number;
}

export interface UpdateOficinaDTO {
  nombre?: string;
  direccion?: string;
  latitud?: number;
  longitud?: number;
  radio?: number;
  activo?: boolean;
}

export interface AsignarDoctorDTO {
  doctorId: string;
  oficinaId: string;
  diaSemana: string;
  horaInicio: string;
  horaFin: string;
}

export function useUbicacion() {
  const oficinas = ref<Oficina[]>([]);
  const doctores = ref<DoctorUbicacion[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const { get, post, put, delete: deleteApi } = useApi();

  /**
   * Obtener geolocalización del navegador
   */
  function obtenerGeolocalizacion(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocalización no soportada'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => resolve(position),
        (err) => reject(err),
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutos
        }
      );
    });
  }

  /**
   * Buscar oficinas cercanas a una ubicación
   */
  async function buscarOficinasCercanas(
    lat: number,
    lng: number,
    radioKm: number = 10
  ): Promise<Oficina[]> {
    loading.value = true;
    error.value = null;

    try {
      const response = await get<ApiResponse<Oficina[]>>(
        `/api/v1/ubicacion/oficinas/cercanas?lat=${lat}&lng=${lng}&radio=${radioKm}`
      );
      if (response.success && response.data) {
        oficinas.value = response.data as unknown as Oficina[];
        return oficinas.value;
      }
      return [];
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Error de conexión';
      return [];
    } finally {
      loading.value = false;
    }
  }

  /**
   * Buscar oficinas cercanas usando geolocalización del navegador
   */
  async function buscarOficinasCercanasAuto(radioKm: number = 10): Promise<Oficina[]> {
    try {
      const position = await obtenerGeolocalizacion();
      return await buscarOficinasCercanas(
        position.coords.latitude,
        position.coords.longitude,
        radioKm
      );
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Error obteniendo ubicación';
      return [];
    }
  }

  /**
   * Obtener todas las oficinas activas
   */
  async function obtenerTodasLasOficinas(): Promise<Oficina[]> {
    loading.value = true;
    error.value = null;

    try {
      const response = await get<ApiResponse<Oficina[]>>(
        '/api/v1/ubicacion/oficinas'
      );
      if (response.success && response.data) {
        oficinas.value = response.data as unknown as Oficina[];
        return oficinas.value;
      }
      return [];
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Error de conexión';
      return [];
    } finally {
      loading.value = false;
    }
  }

  /**
   * Crear nueva oficina
   */
  async function crearOficina(data: CreateOficinaDTO): Promise<Oficina | null> {
    loading.value = true;
    error.value = null;

    try {
      const response = await post<ApiResponse<Oficina>>(
        '/api/v1/ubicacion/oficinas',
        data
      );
      if (response.success && response.data) {
        const nueva = response.data as unknown as Oficina;
        oficinas.value.push(nueva);
        return nueva;
      }
      return null;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Error de conexión';
      return null;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Actualizar oficina existente
   */
  async function actualizarOficina(
    id: string,
    data: UpdateOficinaDTO
  ): Promise<Oficina | null> {
    loading.value = true;
    error.value = null;

    try {
      const response = await put<ApiResponse<Oficina>>(
        `/api/v1/ubicacion/oficinas/${id}`,
        data
      );
      if (response.success && response.data) {
        const actualizada = response.data as unknown as Oficina;
        const index = oficinas.value.findIndex((o) => o.id === id);
        if (index !== -1) {
          oficinas.value[index] = actualizada;
        }
        return actualizada;
      }
      return null;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Error de conexión';
      return null;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Eliminar oficina (soft delete)
   */
  async function eliminarOficina(id: string): Promise<boolean> {
    loading.value = true;
    error.value = null;

    try {
      const response = await deleteApi<ApiResponse<void>>(
        `/api/v1/ubicacion/oficinas/${id}`
      );
      if (response.success) {
        oficinas.value = oficinas.value.filter((o) => o.id !== id);
        return true;
      }
      return false;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Error de conexión';
      return false;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Obtener doctores por oficina y día
   */
  async function obtenerDoctoresPorOficina(
    oficinaId: string,
    diaSemana: string
  ): Promise<DoctorUbicacion[]> {
    loading.value = true;
    error.value = null;

    try {
      const response = await get<ApiResponse<DoctorUbicacion[]>>(
        `/api/v1/ubicacion/oficinas/${oficinaId}/doctores?diaSemana=${diaSemana}`
      );
      if (response.success && response.data) {
        doctores.value = response.data as unknown as DoctorUbicacion[];
        return doctores.value;
      }
      return [];
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Error de conexión';
      return [];
    } finally {
      loading.value = false;
    }
  }

  /**
   * Asignar doctor a oficina
   */
  async function asignarDoctorAOficina(
    data: AsignarDoctorDTO
  ): Promise<DoctorUbicacion | null> {
    loading.value = true;
    error.value = null;

    try {
      const response = await post<ApiResponse<DoctorUbicacion>>(
        '/api/v1/ubicacion/doctores/asignar',
        data
      );
      if (response.success && response.data) {
        return response.data as unknown as DoctorUbicacion;
      }
      return null;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Error de conexión';
      return null;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Remover doctor de oficina
   */
  async function removerDoctorDeOficina(
    doctorId: string,
    oficinaId: string,
    diaSemana: string
  ): Promise<boolean> {
    loading.value = true;
    error.value = null;

    try {
      const response = await post<ApiResponse<void>>(
        '/api/v1/ubicacion/doctores/remover',
        { doctorId, oficinaId, diaSemana }
      );
      return response.success;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Error de conexión';
      return false;
    } finally {
      loading.value = false;
    }
  }

  return {
    // State
    oficinas,
    doctores,
    loading,
    error,

    // Geolocalización
    obtenerGeolocalizacion,

    // Búsqueda
    buscarOficinasCercanas,
    buscarOficinasCercanasAuto,
    obtenerTodasLasOficinas,

    // CRUD Oficinas
    crearOficina,
    actualizarOficina,
    eliminarOficina,

    // Doctores por oficina
    obtenerDoctoresPorOficina,
    asignarDoctorAOficina,
    removerDoctorDeOficina
  };
}
