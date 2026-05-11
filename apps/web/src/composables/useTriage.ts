// apps/web/src/composables/useTriage.ts
/**
 * Composable para captura de triaje colaborativo
 * Integra con backend triaje API + SSE notifications
 */

import { ref, computed } from 'vue';
import { useApi } from './useApi';
import { useTriageNotifications } from './useTriageNotifications';
import type { ApiResponse } from '@galeno/shared-types';

export interface SignosVitales {
  bloodPressure?: string;
  heartRate?: number;
  temperature?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  weight?: number;
  height?: number;
}

export interface TriageCaptureData {
  pacienteId: string;
  consultaId?: string;
  signosVitales: SignosVitales;
  motivo: string;
  sintomas: string[];
  prioridad: 'baja' | 'media' | 'alta';
  allergyStatus?: string;
  currentMedications?: string;
  painLevel?: number;
  notes?: string;
  isComplete?: boolean;
}

export interface TriageResult {
  id: string;
  estado: string;
  pacienteId: string;
  doctorId?: string;
  triajeData: any;
  fechaCaptura: string;
}

export function useTriage() {
  const loading = ref(false);
  const error = ref<string | null>(null);
  const triajeActual = ref<TriageResult | null>(null);
  const { get, post } = useApi();

  // SSE notifications para doctores
  const { notifications } = useTriageNotifications({
    autoRefresh: true,
    showNotifications: true
  });

  /**
   * Capturar datos de triaje
   */
  async function capturarTriaje(
    consultaId: string,
    data: TriageCaptureData,
    isComplete: boolean = false
  ): Promise<TriageResult | null> {
    loading.value = true;
    error.value = null;

    try {
      const triageData = {
        bloodPressure: data.signosVitales.bloodPressure,
        heartRate: data.signosVitales.heartRate,
        temperature: data.signosVitales.temperature,
        respiratoryRate: data.signosVitales.respiratoryRate,
        oxygenSaturation: data.signosVitales.oxygenSaturation,
        weight: data.signosVitales.weight,
        height: data.signosVitales.height,
        chiefComplaint: data.motivo,
        allergyStatus: data.allergyStatus,
        currentMedications: data.currentMedications,
        painLevel: data.painLevel,
        notes: data.notes,
        isComplete
      };

      const response = await post<ApiResponse<any>>(
        `/api/v1/consultas/${consultaId}/triage`,
        { triageData, isComplete }
      );

      if (response.success && response.data) {
        triajeActual.value = response.data as unknown as TriageResult;
        return triajeActual.value;
      }

      throw new Error(response.error || 'Error al capturar triaje');
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Error de conexión';
      return null;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Asignar doctor a triaje completado
   */
  async function asignarDoctor(
    consultaId: string,
    doctorId: string
  ): Promise<boolean> {
    loading.value = true;
    error.value = null;

    try {
      const response = await post<ApiResponse<void>>(
        `/api/v1/consultas/${consultaId}/asignar`,
        { doctorId }
      );
      return response.success;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Error de conexión';
      return false;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Obtener cola de triaje (pacientes pendientes)
   */
  async function obtenerColaTriaje(): Promise<any[]> {
    loading.value = true;
    error.value = null;

    try {
      const response = await get<ApiResponse<any[]>>(
        '/api/v1/triage/queue'
      );
      if (response.success && response.data) {
        return response.data as unknown as any[];
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
   * Calcular nivel de prioridad basado en signos vitales
   */
  function calcularPrioridad(signos: SignosVitales): 'baja' | 'media' | 'alta' {
    // Criterios de alta prioridad
    if (
      (signos.oxygenSaturation && signos.oxygenSaturation < 90) ||
      (signos.heartRate && (signos.heartRate > 120 || signos.heartRate < 50)) ||
      (signos.temperature && signos.temperature > 39)
    ) {
      return 'alta';
    }

    // Criterios de media prioridad
    if (
      (signos.oxygenSaturation && signos.oxygenSaturation < 95) ||
      (signos.heartRate && (signos.heartRate > 100 || signos.heartRate < 60)) ||
      (signos.temperature && signos.temperature > 38)
    ) {
      return 'media';
    }

    return 'baja';
  }

  /**
   * Notificaciones de triaje completado (para doctores)
   */
  const notificacionesTriaje = computed(() => notifications.value);

  return {
    // State
    loading,
    error,
    triajeActual,
    notificacionesTriaje,

    // Actions
    capturarTriaje,
    asignarDoctor,
    obtenerColaTriaje,

    // Utils
    calcularPrioridad
  };
}
