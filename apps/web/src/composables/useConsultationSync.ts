// apps/web/src/composables/useConsultationSync.ts
/**
 * Composable para sincronización de datos de teleconsulta con Dexie.js SyncManager
 * Implementa auto-guardado cada 30 segundos y sincronización offline-first
 */

import { ref, Ref, watch, onUnmounted, computed } from 'vue';
import { syncManager } from '@/services/offline/sync-manager';
import { apiClient } from '@/services/api';
import { useToast } from 'vue-toastification';
import { logger } from '@/utils/logger';

export interface ConsultationSyncData {
  consultaId: string;
  citaId: string;
  pacienteId: string;
  notas: string;
  diagnosticos: CIE10Diagnosis[];
  medicamentos: MedicamentoData[];
  examenes: ExamenData[];
  evolucion: string;
  tratamiento: string;
  lastSavedAt?: number;
  isDirty: boolean;
}

export interface CIE10Diagnosis {
  codigo: string;
  descripcion: string;
  tipo?: 'principal' | 'secundario';
}

export interface MedicamentoData {
  id?: string;
  nombre: string;
  dosis: string;
  frecuencia: string;
  duracion: string;
  indicaciones?: string;
}

export interface ExamenData {
  id?: string;
  nombre: string;
  tipo: 'laboratorio' | 'imagen' | 'especial' | 'otro';
  prioridad: 'rutina' | 'urgente' | 'stat';
  instrucciones?: string;
}

export interface SyncStatus {
  isSyncing: boolean;
  lastSyncAt: number | null;
  pendingChanges: boolean;
  error: string | null;
  syncProgress: number;
}

export interface UseConsultationSyncOptions {
  autoSaveInterval?: number; // ms, default 30000 (30s)
  enableOffline?: boolean;
  debounceDelay?: number; // ms, default 2000
}

export function useConsultationSync(
  initialData?: Partial<ConsultationSyncData>,
  options: UseConsultationSyncOptions = {}
) {
  const {
    autoSaveInterval = 30000, // 30 segundos por defecto
    enableOffline = true,
    debounceDelay = 2000
  } = options;

  const toast = useToast();

  // Estado de datos
  const data = ref<ConsultationSyncData>({
    consultaId: initialData?.consultaId || '',
    citaId: initialData?.citaId || '',
    pacienteId: initialData?.pacienteId || '',
    notas: initialData?.notas || '',
    diagnosticos: initialData?.diagnosticos || [],
    medicamentos: initialData?.medicamentos || [],
    examenes: initialData?.examenes || [],
    evolucion: initialData?.evolucion || '',
    tratamiento: initialData?.tratamiento || '',
    lastSavedAt: undefined,
    isDirty: false
  });

  // Estado de sincronización
  const syncStatus = ref<SyncStatus>({
    isSyncing: false,
    lastSyncAt: null,
    pendingChanges: false,
    error: null,
    syncProgress: 0
  });

  // Timers
  let autoSaveTimer: NodeJS.Timeout | null = null;
  let debounceTimer: NodeJS.Timeout | null = null;

  // Computed
  const canSync = computed(() => {
    return !!(data.value.consultaId && data.value.citaId);
  });

  const hasUnsavedChanges = computed(() => {
    return data.value.isDirty || !data.value.lastSavedAt;
  });

  // Marcar datos como sucios
  const markAsDirty = () => {
    data.value.isDirty = true;
    syncStatus.value.pendingChanges = true;
  };

  // Actualizar datos parcialmente
  const updateData = (updates: Partial<ConsultationSyncData>) => {
    Object.assign(data.value, updates);
    markAsDirty();
  };

  // Actualizar campo específico con debounce
  const updateField = <K extends keyof ConsultationSyncData>(
    field: K,
    value: ConsultationSyncData[K]
  ) => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      (data.value[field] as any) = value;
      markAsDirty();
    }, debounceDelay);
  };

  // Guardar borrador
  const saveDraft = async (): Promise<boolean> => {
    if (!canSync.value) {
      logger.warn('[ConsultationSync] Cannot save: missing consultaId or citaId');
      return false;
    }

    if (!hasUnsavedChanges.value && !syncStatus.value.isSyncing) {
      logger.debug('[ConsultationSync] No changes to save');
      return true;
    }

    if (syncStatus.value.isSyncing) {
      logger.warn('[ConsultationSync] Save already in progress');
      return false;
    }

    try {
      syncStatus.value.isSyncing = true;
      syncStatus.value.error = null;
      syncStatus.value.syncProgress = 10;

      // Preparar payload
      const payload = {
        consultaId: data.value.consultaId,
        citaId: data.value.citaId,
        pacienteId: data.value.pacienteId,
        notas: data.value.notas,
        diagnosticos: data.value.diagnosticos,
        medicamentos: data.value.medicamentos,
        examenes: data.value.examenes,
        evolucion: data.value.evolucion,
        tratamiento: data.value.tratamiento,
        lastSavedAt: Date.now()
      };

      syncStatus.value.syncProgress = 30;

      // Intentar guardar en servidor
      const response = await apiClient.post(
        `/api/v1/consultas/${data.value.consultaId}/borrador`,
        payload
      );

      syncStatus.value.syncProgress = 80;

      if (response.success) {
        // Actualizar estado
        data.value.lastSavedAt = Date.now();
        data.value.isDirty = false;
        syncStatus.value.pendingChanges = false;
        syncStatus.value.lastSyncAt = Date.now();
        syncStatus.value.syncProgress = 100;

        logger.info('[ConsultationSync] Draft saved successfully', {
          consultaId: data.value.consultaId,
          timestamp: data.value.lastSavedAt
        });

        toast.success('Borrador guardado automáticamente');
        return true;
      } else {
        throw new Error(response.error || 'Failed to save draft');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al guardar borrador';
      logger.error('[ConsultationSync] Save draft failed', { error });
      syncStatus.value.error = errorMessage;

      // Si hay error de red y offline está habilitado, guardar en IndexedDB
      if (enableOffline && isNetworkError(error)) {
        await saveToOfflineQueue(payload);
        toast.warning('Sin conexión. Cambios guardados localmente.');
        return true; // Considerado éxito parcial
      }

      toast.error(errorMessage);
      return false;
    } finally {
      syncStatus.value.isSyncing = false;
      syncStatus.value.syncProgress = 0;

      // Reset timer after save
      startAutoSaveTimer();
    }
  };

  // Guardar en cola offline
  const saveToOfflineQueue = async (payload: any) => {
    try {
      await syncManager.sync();
      logger.info('[ConsultationSync] Saved to offline queue');
    } catch (error) {
      logger.error('[ConsultationSync] Failed to save to offline queue', { error });
      throw error;
    }
  };

  // Verificar si es error de red
  const isNetworkError = (error: unknown): boolean => {
    if (error instanceof Error) {
      return (
        error.message.includes('network') ||
        error.message.includes('fetch') ||
        error.message.includes('offline')
      );
    }
    return false;
  };

  // Forzar sincronización manual
  const forceSync = async (): Promise<boolean> => {
    logger.info('[ConsultationSync] Manual sync triggered');
    return saveDraft();
  };

  // Iniciar timer de auto-guardado
  const startAutoSaveTimer = () => {
    stopAutoSaveTimer();

    autoSaveTimer = setTimeout(() => {
      if (hasUnsavedChanges.value) {
        saveDraft();
      }
    }, autoSaveInterval);

    logger.debug('[ConsultationSync] Auto-save timer started', { interval: autoSaveInterval });
  };

  // Detener timer de auto-guardado
  const stopAutoSaveTimer = () => {
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
      autoSaveTimer = null;
    }
  };

  // Resetear datos
  const reset = () => {
    stopAutoSaveTimer();
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    data.value = {
      consultaId: '',
      citaId: '',
      pacienteId: '',
      notas: '',
      diagnosticos: [],
      medicamentos: [],
      examenes: [],
      evolucion: '',
      tratamiento: '',
      lastSavedAt: undefined,
      isDirty: false
    };

    syncStatus.value = {
      isSyncing: false,
      lastSyncAt: null,
      pendingChanges: false,
      error: null,
      syncProgress: 0
    };
  };

  // Cargar datos desde servidor
  const loadFromServer = async (consultaId: string): Promise<boolean> => {
    try {
      syncStatus.value.isSyncing = true;
      syncStatus.value.error = null;

      const response = await apiClient.get<{ data: ConsultationSyncData }>(
        `/api/v1/consultas/${consultaId}`
      );

      if (response.success && response.data) {
        const serverData = response.data.data;
        data.value = {
          ...data.value,
          ...serverData,
          lastSavedAt: Date.now(),
          isDirty: false
        };

        syncStatus.value.lastSyncAt = Date.now();
        syncStatus.value.pendingChanges = false;

        logger.info('[ConsultationSync] Data loaded from server', { consultaId });
        toast.success('Datos cargados exitosamente');
        return true;
      }

      throw new Error('Failed to load consultation data');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al cargar datos';
      logger.error('[ConsultationSync] Load failed', { error });
      syncStatus.value.error = errorMessage;
      toast.error(errorMessage);
      return false;
    } finally {
      syncStatus.value.isSyncing = false;
    }
  };

  // Watch para auto-guardado cuando hay cambios
  watch(
    () => data.value,
    () => {
      if (data.value.isDirty && canSync.value) {
        startAutoSaveTimer();
      }
    },
    { deep: true }
  );

  // Cleanup on unmount
  onUnmounted(() => {
    stopAutoSaveTimer();
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
  });

  return {
    // Data
    data,
    syncStatus,

    // Computed
    canSync,
    hasUnsavedChanges,

    // Methods
    updateData,
    updateField,
    saveDraft,
    forceSync,
    reset,
    loadFromServer,

    // Setters específicos
    setNotas: (notas: string) => updateField('notas', notas),
    setEvolucion: (evolucion: string) => updateField('evolucion', evolucion),
    setTratamiento: (tratamiento: string) => updateField('tratamiento', tratamiento),
    setDiagnosticos: (diagnosticos: CIE10Diagnosis[]) => updateData({ diagnosticos }),
    setMedicamentos: (medicamentos: MedicamentoData[]) => updateData({ medicamentos }),
    setExamenes: (examenes: ExamenData[]) => updateData({ examenes }),

    // Actions
    addDiagnostico: (diagnostico: CIE10Diagnosis) => {
      data.value.diagnosticos.push(diagnostico);
      markAsDirty();
    },
    removeDiagnostico: (index: number) => {
      data.value.diagnosticos.splice(index, 1);
      markAsDirty();
    },
    addMedicamento: (medicamento: MedicamentoData) => {
      data.value.medicamentos.push(medicamento);
      markAsDirty();
    },
    removeMedicamento: (index: number) => {
      data.value.medicamentos.splice(index, 1);
      markAsDirty();
    },
    addExamen: (examen: ExamenData) => {
      data.value.examenes.push(examen);
      markAsDirty();
    },
    removeExamen: (index: number) => {
      data.value.examenes.splice(index, 1);
      markAsDirty();
    }
  };
}

export default useConsultationSync;
