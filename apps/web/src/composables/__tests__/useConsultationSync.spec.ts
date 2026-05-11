/**
 * Tests para el composable useConsultationSync
 * Pruebas unitarias para sincronización de teleconsulta con auto-save
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, nextTick } from 'vue';
import { useConsultationSync } from '../useConsultationSync';

// Mock dependencies
vi.mock('@/services/api', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}));

vi.mock('@/services/offline/sync-manager', () => ({
  syncManager: {
    sync: vi.fn()
  }
}));

vi.mock('vue-toastification', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn()
  })
}));

describe('useConsultationSync', () => {
  const mockInitialData = {
    consultaId: 'consulta-123',
    citaId: 'cita-456',
    pacienteId: 'paciente-789',
    notas: 'Notas iniciales',
    evolucion: 'Evolución inicial',
    tratamiento: 'Tratamiento inicial'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with provided data', () => {
    const { data, canSync } = useConsultationSync(mockInitialData);

    expect(data.value.consultaId).toBe('consulta-123');
    expect(data.value.citaId).toBe('cita-456');
    expect(data.value.pacienteId).toBe('paciente-789');
    expect(data.value.notas).toBe('Notas iniciales');
    expect(canSync.value).toBe(true);
  });

  it('should initialize with empty data when no initial data provided', () => {
    const { data, canSync } = useConsultationSync();

    expect(data.value.consultaId).toBe('');
    expect(data.value.citaId).toBe('');
    expect(data.value.notas).toBe('');
    expect(canSync.value).toBe(false);
  });

  it('should mark data as dirty when updating fields', async () => {
    const { updateField, data, hasUnsavedChanges } = useConsultationSync(mockInitialData);

    expect(data.value.isDirty).toBe(false);
    expect(hasUnsavedChanges.value).toBe(false);

    updateField('notas', 'Nuevas notas');
    await nextTick();

    expect(data.value.isDirty).toBe(true);
    expect(hasUnsavedChanges.value).toBe(true);
  });

  it('should update field with debounce', async () => {
    const { updateField, data } = useConsultationSync(mockInitialData, {
      debounceDelay: 100
    });

    updateField('notas', 'Test 1');
    expect(data.value.notas).toBe('Notas iniciales'); // Not updated yet due to debounce

    await vi.advanceTimersByTimeAsync(100);
    expect(data.value.notas).toBe('Test 1');
  });

  it('should save draft successfully', async () => {
    const { apiClient } = await import('@/services/api');
    vi.mocked(apiClient.post).mockResolvedValue({ success: true, data: {} });

    const { saveDraft, syncStatus } = useConsultationSync(mockInitialData);

    const result = await saveDraft();

    expect(result).toBe(true);
    expect(syncStatus.value.isSyncing).toBe(false);
    expect(syncStatus.value.lastSyncAt).toBeTruthy();
    expect(apiClient.post).toHaveBeenCalledWith(
      `/api/v1/consultas/${mockInitialData.consultaId}/borrador`,
      expect.objectContaining({
        consultaId: 'consulta-123',
        citaId: 'cita-456'
      })
    );
  });

  it('should handle save draft failure', async () => {
    const { apiClient } = await import('@/services/api');
    vi.mocked(apiClient.post).mockResolvedValue({ success: false, error: 'Save failed' });

    const { saveDraft, syncStatus } = useConsultationSync(mockInitialData);

    const result = await saveDraft();

    expect(result).toBe(false);
    expect(syncStatus.value.error).toBe('Save failed');
  });

  it('should handle network error and save to offline queue', async () => {
    const { apiClient } = await import('@/services/api');
    const { syncManager } = await import('@/services/offline/sync-manager');

    vi.mocked(apiClient.post).mockRejectedValue(new Error('Network error'));
    vi.mocked(syncManager.sync).mockResolvedValue({ success: true });

    const { saveDraft } = useConsultationSync(mockInitialData, { enableOffline: true });

    const result = await saveDraft();

    expect(result).toBe(true); // Partial success
    expect(syncManager.sync).toHaveBeenCalled();
  });

  it('should auto-save after interval', async () => {
    const { apiClient } = await import('@/services/api');
    vi.mocked(apiClient.post).mockResolvedValue({ success: true });

    const { updateField, saveDraft } = useConsultationSync(mockInitialData, {
      autoSaveInterval: 1000
    });

    // Trigger change
    updateField('notas', 'New notes');
    await nextTick();

    // Fast-forward time
    await vi.advanceTimersByTimeAsync(1000);

    // Should have called saveDraft (via auto-save)
    expect(apiClient.post).toHaveBeenCalled();
  });

  it('should add and remove diagnosticos', () => {
    const { addDiagnostico, removeDiagnostico, data } = useConsultationSync(mockInitialData);

    const newDiagnostico = {
      codigo: 'A00.0',
      descripcion: 'Cólera',
      tipo: 'principal' as const
    };

    expect(data.value.diagnosticos.length).toBe(0);

    addDiagnostico(newDiagnostico);
    expect(data.value.diagnosticos.length).toBe(1);
    expect(data.value.diagnosticos[0]).toEqual(newDiagnostico);

    removeDiagnostico(0);
    expect(data.value.diagnosticos.length).toBe(0);
  });

  it('should add and remove medicamentos', () => {
    const { addMedicamento, removeMedicamento, data } = useConsultationSync(mockInitialData);

    const newMedicamento = {
      nombre: 'Paracetamol',
      dosis: '500mg',
      frecuencia: 'cada 8 horas',
      duracion: '5 días'
    };

    expect(data.value.medicamentos.length).toBe(0);

    addMedicamento(newMedicamento);
    expect(data.value.medicamentos.length).toBe(1);

    removeMedicamento(0);
    expect(data.value.medicamentos.length).toBe(0);
  });

  it('should add and remove examenes', () => {
    const { addExamen, removeExamen, data } = useConsultationSync(mockInitialData);

    const newExamen = {
      nombre: 'Hemograma completo',
      tipo: 'laboratorio' as const,
      prioridad: 'rutina' as const
    };

    expect(data.value.examenes.length).toBe(0);

    addExamen(newExamen);
    expect(data.value.examenes.length).toBe(1);

    removeExamen(0);
    expect(data.value.examenes.length).toBe(0);
  });

  it('should load data from server', async () => {
    const { apiClient } = await import('@/services/api');
    const serverData = {
      data: {
        consultaId: 'consulta-123',
        citaId: 'cita-456',
        pacienteId: 'paciente-789',
        notas: 'Notas del servidor',
        diagnosticos: [],
        medicamentos: [],
        examenes: [],
        evolucion: 'Evolución del servidor',
        tratamiento: 'Tratamiento del servidor'
      }
    };

    vi.mocked(apiClient.get).mockResolvedValue(serverData);

    const { loadFromServer, data } = useConsultationSync();

    const result = await loadFromServer('consulta-123');

    expect(result).toBe(true);
    expect(data.value.notas).toBe('Notas del servidor');
    expect(data.value.lastSavedAt).toBeTruthy();
  });

  it('should reset all data', () => {
    const { data, syncStatus, updateField, reset } = useConsultationSync(mockInitialData);

    updateField('notas', 'Test');

    reset();

    expect(data.value.notas).toBe('');
    expect(data.value.isDirty).toBe(false);
    expect(syncStatus.value.isSyncing).toBe(false);
    expect(syncStatus.value.lastSyncAt).toBe(null);
  });

  it('should track sync progress', async () => {
    const { apiClient } = await import('@/services/api');
    vi.mocked(apiClient.post).mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return { success: true };
    });

    const { saveDraft, syncStatus } = useConsultationSync(mockInitialData);

    // Start save (don't await yet)
    const savePromise = saveDraft();

    expect(syncStatus.value.isSyncing).toBe(true);

    await savePromise;

    expect(syncStatus.value.isSyncing).toBe(false);
  });

  it('should provide specific setter methods', () => {
    const {
      setNotas,
      setEvolucion,
      setTratamiento,
      setDiagnosticos,
      setMedicamentos,
      setExamenes,
      data
    } = useConsultationSync(mockInitialData);

    setNotas('Nuevas notas');
    expect(data.value.notas).toBe('Nuevas notas');

    setEvolucion('Nueva evolución');
    expect(data.value.evolucion).toBe('Nueva evolución');

    setTratamiento('Nuevo tratamiento');
    expect(data.value.tratamiento).toBe('Nuevo tratamiento');

    setDiagnosticos([{ codigo: 'B00.0', descripcion: 'Herpes' }]);
    expect(data.value.diagnosticos.length).toBe(1);

    setMedicamentos([{ nombre: 'Ibuprofeno', dosis: '400mg', frecuencia: 'cada 12h', duracion: '3 días' }]);
    expect(data.value.medicamentos.length).toBe(1);

    setExamenes([{ nombre: 'Rayos X', tipo: 'imagen', prioridad: 'urgente' }]);
    expect(data.value.examenes.length).toBe(1);
  });
});
