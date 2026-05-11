import { ref, computed, type Ref } from 'vue';
import { apiClient } from '@galeno/api-client';

/**
 * Tipos de antecedente
 */
export type TipoAntecedente = 'personal' | 'familiar' | 'medicamento' | 'habito' | 'alergia';

/**
 * Tipo de quién registró el antecedente
 */
export type RegistradoPor = 'paciente' | 'enfermera' | 'doctor';

/**
 * Interfaz de un antecedente
 */
export interface Antecedente {
  id: string;
  pacienteId: string;
  tipo: TipoAntecedente;
  categoria: string | null;
  detalle: string;
  grado: string | null;
  fechaRegistro: string;
  registradoPor: RegistradoPor;
  createdAt: string;
}

/**
 * DTO para crear un antecedente
 */
export interface CreateAntecedenteDto {
  tipo: TipoAntecedente;
  categoria?: string;
  detalle: string;
  grado?: string;
  registradoPor?: RegistradoPor;
}

/**
 * DTO para actualizar un antecedente
 */
export interface UpdateAntecedenteDto {
  tipo?: TipoAntecedente;
  categoria?: string;
  detalle?: string;
  grado?: string;
}

/**
 * Resumen de antecedentes por tipo
 */
export interface AntecedentesResumen {
  total: number;
  porTipo: Record<TipoAntecedente, number>;
}

/**
 * Categorías permitidas por tipo de antecedente
 */
export const CATEGORIAS_POR_TIPO: Record<TipoAntecedente, string[]> = {
  personal: ['patológico', 'quirúrgico', 'traumático', 'alérgico', 'ginecoobstétrico', 'otros'],
  familiar: ['padre', 'madre', 'hermanos', 'abuelos', 'tíos', 'otros'],
  medicamento: ['actual', 'previo'],
  habito: ['tabaco', 'alcohol', 'drogas', 'cafeína', 'ejercicio', 'dieta', 'sueño', 'otros'],
  alergia: ['medicamento', 'alimento', 'ambiente', 'otros']
};

/**
 * Etiquetas de tipos de antecedente
 */
export const TIPO_LABELS: Record<TipoAntecedente, string> = {
  personal: 'Personal',
  familiar: 'Familiar',
  medicamento: 'Medicamento',
  habito: 'Hábito',
  alergia: 'Alergia'
};

/**
 * Composable useAntecedents
 *
 * Maneja el estado y operaciones de antecedentes del paciente.
 */
export function useAntecedents(pacienteId: string) {
  // Estado
  const antecedentes = ref<Antecedente[]>([]) as Ref<Antecedente[]>;
  const resumen = ref<AntecedentesResumen | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const filtroTipo = ref<TipoAntecedente | null>(null);

  // Computados
  const antecedentesFiltrados = computed(() => {
    if (!filtroTipo.value) {
      return antecedentes.value;
    }
    return antecedentes.value.filter(a => a.tipo === filtroTipo.value);
  });

  const antecedentesAgrupados = computed(() => {
    const grupos: Record<TipoAntecedente, Antecedente[]> = {
      personal: [],
      familiar: [],
      medicamento: [],
      habito: [],
      alergia: []
    };

    for (const antecedente of antecedentes.value) {
      grupos[antecedente.tipo].push(antecedente);
    }

    return grupos;
  });

  /**
   * Obtener todos los antecedentes del paciente
   */
  const fetchAntecedentes = async (tipo?: TipoAntecedente) => {
    loading.value = true;
    error.value = null;

    try {
      const query = tipo ? `?tipo=${tipo}` : '';
      const response = await apiClient.get<{ data: Antecedente[] }>(
        `/patient/${pacienteId}/antecedentes${query}`
      );

      if (response.success && response.data) {
        antecedentes.value = response.data.data;
      } else {
        error.value = response.error || 'Error al cargar antecedentes';
      }
    } catch (e) {
      error.value = 'Error al cargar antecedentes';
      console.error(e);
    } finally {
      loading.value = false;
    }
  };

  /**
   * Obtener resumen de antecedentes
   */
  const fetchResumen = async () => {
    try {
      const response = await apiClient.get<{ data: AntecedentesResumen }>(
        `/patient/${pacienteId}/antecedentes/resumen`
      );

      if (response.success && response.data) {
        resumen.value = response.data.data;
      }
    } catch (e) {
      console.error('Error al cargar resumen:', e);
    }
  };

  /**
   * Buscar antecedentes
   */
  const searchAntecedentes = async (query: string) => {
    if (!query.trim()) {
      return await fetchAntecedentes();
    }

    loading.value = true;
    error.value = null;

    try {
      const response = await apiClient.get<{ data: Antecedente[] }>(
        `/patient/${pacienteId}/antecedentes/search?q=${encodeURIComponent(query)}`
      );

      if (response.success && response.data) {
        antecedentes.value = response.data.data;
      } else {
        error.value = response.error || 'Error al buscar antecedentes';
      }
    } catch (e) {
      error.value = 'Error al buscar antecedentes';
      console.error(e);
    } finally {
      loading.value = false;
    }
  };

  /**
   * Crear un nuevo antecedente
   */
  const createAntecedente = async (data: CreateAntecedenteDto) => {
    loading.value = true;
    error.value = null;

    try {
      const response = await apiClient.post<{ data: Antecedente }>(
        `/patient/${pacienteId}/antecedentes`,
        data
      );

      if (response.success && response.data) {
        antecedentes.value.unshift(response.data.data);
        await fetchResumen();
        return response.data.data;
      } else {
        error.value = response.error || 'Error al crear antecedente';
        throw new Error(error.value);
      }
    } catch (e) {
      error.value = 'Error al crear antecedente';
      throw e;
    } finally {
      loading.value = false;
    }
  };

  /**
   * Actualizar un antecedente
   */
  const updateAntecedente = async (id: string, data: UpdateAntecedenteDto) => {
    loading.value = true;
    error.value = null;

    try {
      // Necesitamos agregar método put al apiClient, usar patch por ahora
      const response = await (apiClient as any).put(
        `/patient/${pacienteId}/antecedentes/${id}`,
        data
      );

      if (response.success && response.data) {
        const index = antecedentes.value.findIndex((a: any) => a.id === id);
        if (index !== -1) {
          antecedentes.value[index] = response.data.data;
        }
        return response.data.data;
      } else {
        error.value = response.error || 'Error al actualizar antecedente';
        throw new Error(error.value || 'Error al actualizar antecedente');
      }
    } catch (e) {
      error.value = 'Error al actualizar antecedente';
      throw e;
    } finally {
      loading.value = false;
    }
  };

  /**
   * Eliminar un antecedente
   */
  const deleteAntecedente = async (id: string) => {
    loading.value = true;
    error.value = null;

    try {
      const response = await apiClient.delete(
        `/patient/${pacienteId}/antecedentes/${id}`
      );

      if (response.success) {
        antecedentes.value = antecedentes.value.filter(a => a.id !== id);
        await fetchResumen();
      } else {
        error.value = response.error || 'Error al eliminar antecedente';
        throw new Error(error.value);
      }
    } catch (e) {
      error.value = 'Error al eliminar antecedente';
      throw e;
    } finally {
      loading.value = false;
    }
  };

  /**
   * Filtrar por tipo
   */
  const setFiltroTipo = (tipo: TipoAntecedente | null) => {
    filtroTipo.value = tipo;
  };

  /**
   * Limpiar filtros
   */
  const clearFiltros = () => {
    filtroTipo.value = null;
  };

  /**
   * Refrescar datos
   */
  const refresh = async () => {
    await Promise.all([
      fetchAntecedentes(),
      fetchResumen()
    ]);
  };

  return {
    // Estado
    antecedentes,
    antecedentesFiltrados,
    antecedentesAgrupados,
    resumen,
    loading,
    error,
    filtroTipo,

    // Métodos
    fetchAntecedentes,
    fetchResumen,
    searchAntecedentes,
    createAntecedente,
    updateAntecedente,
    deleteAntecedente,
    setFiltroTipo,
    clearFiltros,
    refresh
  };
}

export default useAntecedents;
