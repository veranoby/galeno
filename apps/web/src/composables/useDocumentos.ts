// apps/web/src/composables/useDocumentos.ts
/**
 * Composable para gestión de documentos médicos
 * CRUD completo + filtrado por estado (vigente/caducado)
 */

import { ref, computed } from 'vue';
import { useApi } from './useApi';
import type { ApiResponse } from '@galeno/shared-types';

export interface Documento {
  id: string;
  titulo: string;
  descripcion?: string;
  tipo: 'receta' | 'examen' | 'certificado';
  url: string;
  fechaCaducidad?: string;
  estado: 'activo' | 'caducado' | 'anulado';
  pacienteId: string;
  consultaId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDocumentoDTO {
  titulo: string;
  descripcion?: string;
  tipo: 'receta' | 'examen' | 'certificado';
  url: string;
  pacienteId: string;
  consultaId?: string;
  fechaCaducidad?: string;
}

export function useDocumentos() {
  const documentos = ref<Documento[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const { get, post, delete: deleteApi } = useApi();

  /**
   * Cargar documentos de un paciente
   */
  async function cargarDocumentos(pacienteId: string): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const response = await get<ApiResponse<Documento[]>>(
        `/api/v1/documentos?pacienteId=${pacienteId}`
      );
      if (response.success && response.data) {
        documentos.value = response.data as unknown as Documento[];
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Error de conexión';
    } finally {
      loading.value = false;
    }
  }

  /**
   * Crear nuevo documento
   */
  async function crearDocumento(
    data: CreateDocumentoDTO
  ): Promise<Documento | null> {
    loading.value = true;
    error.value = null;

    try {
      const response = await post<ApiResponse<Documento>>(
        '/api/v1/documentos',
        data
      );
      if (response.success && response.data) {
        documentos.value.push(response.data as unknown as Documento);
        return response.data as unknown as Documento;
      }
      throw new Error(response.error || 'Error al crear documento');
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Error de conexión';
      return null;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Eliminar documento
   */
  async function eliminarDocumento(id: string): Promise<boolean> {
    loading.value = true;
    error.value = null;

    try {
      const response = await deleteApi<ApiResponse<void>>(
        `/api/v1/documentos/${id}`
      );
      if (response.success) {
        documentos.value = documentos.value.filter((d) => d.id !== id);
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
   * Documentos vigentes (activos)
   */
  const documentosVigentes = computed(() =>
    documentos.value.filter((d) => d.estado === 'activo')
  );

  /**
   * Documentos caducados
   */
  const documentosCaducados = computed(() =>
    documentos.value.filter((d) => d.estado === 'caducado')
  );

  /**
   * Documentos anulados
   */
  const documentosAnulados = computed(() =>
    documentos.value.filter((d) => d.estado === 'anulado')
  );

  /**
   * Verificar si un documento está próximo a caducar (30 días)
   */
  function esProximoCaducar(documento: Documento): boolean {
    const fechaCaducidad = documento.fechaCaducidad;
    if (!fechaCaducidad) return false;

    const hoy = new Date();
    const caducidad = new Date(fechaCaducidad);
    const diasRestantes =
      (caducidad.getTime() - hoy.getTime()) / (1000 * 3600 * 24);

    return diasRestantes >= 0 && diasRestantes <= 30;
  }

  /**
   * Documentos próximos a caducar
   */
  const documentosProximosCaducar = computed(() =>
    documentos.value.filter(
      (d) => d.estado === 'activo' && esProximoCaducar(d)
    )
  );

  return {
    // State
    documentos,
    loading,
    error,

    // Actions
    cargarDocumentos,
    crearDocumento,
    eliminarDocumento,

    // Computed - Filtros por estado
    documentosVigentes,
    documentosCaducados,
    documentosAnulados,
    documentosProximosCaducar,

    // Utils
    esProximoCaducar
  };
}
