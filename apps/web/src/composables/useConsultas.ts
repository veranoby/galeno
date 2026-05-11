// apps/web/src/composables/useConsultas.ts
import { ref } from 'vue';
import apiClient from '@/services/api';
import type { EstadoConsulta } from '@galeno/shared-types';

export interface Consulta {
  id: string;
  pacienteId: string;
  paciente: {
    id: string;
    nombre: string;
    cedula: string;
    email?: string;
    telefono?: string;
  };
  doctor?: {
    id: string;
    nombre: string;
    especialidad?: string;
  };
  estado: EstadoConsulta;
  motivoConsulta?: string;
  createdAt: string | Date;
  esPrimeraVez?: boolean;
}

export interface FetchParams {
  estado?: EstadoConsulta;
  page?: number;
  limit?: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function useConsultas() {
  const consultas = ref<Consulta[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const pagination = ref<PaginationMeta>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  });

  const fetchConsultas = async (params?: FetchParams) => {
    loading.value = true;
    error.value = null;

    try {
      const queryParams = new URLSearchParams();

      if (params?.estado) {
        queryParams.append('estado', params.estado);
      }

      if (params?.page) {
        queryParams.append('page', params.page.toString());
      }

      if (params?.limit) {
        queryParams.append('limit', params.limit.toString());
      }

      const response = await apiClient.get<{
        consultas: Consulta[];
        pagination: PaginationMeta;
      }>(`/consultas?${queryParams.toString()}`);

      if (response.success && response.data) {
        consultas.value = response.data.consultas || [];
        pagination.value = response.data.pagination || {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0
        };
      } else {
        error.value = response.error || 'Error al cargar consultas';
      }
    } catch (e: any) {
      error.value = e.message || 'Error de conexión';
      console.error('Error fetching consultas:', e);
    } finally {
      loading.value = false;
    }
  };

  return {
    consultas,
    loading,
    error,
    pagination,
    fetchConsultas
  };
}

export default useConsultas;
