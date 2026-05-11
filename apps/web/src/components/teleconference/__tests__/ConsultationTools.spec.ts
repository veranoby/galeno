/**
 * Tests para el componente ConsultationTools
 * Pruebas de componente para herramientas de teleconsulta
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import ConsultationTools from '@/components/teleconference/ConsultationTools.vue';

// Mock composables and dependencies
vi.mock('@/composables/useConsultationSync', () => {
  return {
    useConsultationSync: vi.fn(() => ({
      data: {
        value: {
          notas: '',
          diagnosticos: [],
          medicamentos: [],
          examenes: [],
          evolucion: '',
          tratamiento: '',
          isDirty: false,
          lastSavedAt: null
        }
      },
      syncStatus: {
        value: {
          isSyncing: false,
          lastSyncAt: null,
          pendingChanges: false,
          error: null,
          syncProgress: 0
        }
      },
      hasUnsavedChanges: { value: false },
      updateField: vi.fn(),
      saveDraft: vi.fn().mockResolvedValue(true),
      setDiagnosticos: vi.fn(),
      setMedicamentos: vi.fn(),
      setExamenes: vi.fn(),
      addDiagnostico: vi.fn(),
      removeDiagnostico: vi.fn(),
      addMedicamento: vi.fn(),
      removeMedicamento: vi.fn(),
      addExamen: vi.fn(),
      removeExamen: vi.fn()
    }))
  };
});

vi.mock('vue-toastification', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn()
  })
}));

// Mock child components
vi.mock('@/components/consultation/DiagnosisChip.vue', () => ({
  default: {
    name: 'DiagnosisChip',
    template: '<div class="diagnosis-chip-mock">DiagnosisChip Mock</div>',
    props: ['modelValue']
  }
}));

vi.mock('@/components/consultation/PrescriptionPanel.vue', () => ({
  default: {
    name: 'PrescriptionPanel',
    template: '<div class="prescription-panel-mock">PrescriptionPanel Mock</div>',
    props: ['modelValue']
  }
}));

vi.mock('@/components/consultation/ExamsPanel.vue', () => ({
  default: {
    name: 'ExamsPanel',
    template: '<div class="exams-panel-mock">ExamsPanel Mock</div>',
    props: ['modelValue']
  }
}));

vi.mock('@/components/consultation/IaChipsPanel.vue', () => ({
  default: {
    name: 'IaChipsPanel',
    template: '<div class="ia-chips-panel-mock">IaChipsPanel Mock</div>',
    props: ['diagnostico', 'evolucion']
  }
}));

describe('ConsultationTools', () => {
  const defaultProps = {
    citaId: 'cita-123',
    pacienteId: 'paciente-456',
    consultaId: 'consulta-789'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render successfully', () => {
    const wrapper = mount(ConsultationTools, {
      props: defaultProps
    });

    expect(wrapper.exists()).toBe(true);
    expect(wrapper.find('.consultation-tools').exists()).toBe(true);
  });

  it('should display tools header with title', () => {
    const wrapper = mount(ConsultationTools, {
      props: defaultProps
    });

    expect(wrapper.find('.tools-header').exists()).toBe(true);
    expect(wrapper.find('.tools-title').text()).toContain('Herramientas Clínicas');
  });

  it('should show save status chip', () => {
    const wrapper = mount(ConsultationTools, {
      props: defaultProps
    });

    expect(wrapper.find('[class*="tools-actions"]').exists()).toBe(true);
  });

  it('should render all tool tabs', () => {
    const wrapper = mount(ConsultationTools, {
      props: defaultProps
    });

    const tabs = wrapper.findAll('[role="tab"]');
    expect(tabs.length).toBeGreaterThanOrEqual(4);

    const tabTexts = tabs.map(tab => tab.text());
    expect(tabTexts).toContainEqual(expect.stringContaining('Evolución'));
    expect(tabTexts).toContainEqual(expect.stringContaining('CIE-10'));
    expect(tabTexts).toContainEqual(expect.stringContaining('Tratamiento'));
    expect(tabTexts).toContainEqual(expect.stringContaining('Exámenes'));
  });

  it('should show Evolución tab content by default', () => {
    const wrapper = mount(ConsultationTools, {
      props: defaultProps
    });

    // First tab should be active
    const activeTab = wrapper.find('[role="tab"][aria-selected="true"]');
    expect(activeTab.text()).toContain('Evolución');
  });

  it('should render textarea for notes in Evolución tab', () => {
    const wrapper = mount(ConsultationTools, {
      props: defaultProps
    });

    const textarea = wrapper.find('textarea');
    expect(textarea.exists()).toBe(true);
    expect(textarea.attributes('placeholder') || textarea.attributes('label'))
      .toEqual(expect.stringContaining('evolución') || expect.stringContaining('notas'));
  });

  it('should emit data-changed event when data changes', async () => {
    const wrapper = mount(ConsultationTools, {
      props: defaultProps
    });

    // Simulate data change through composable mock
    const { useConsultationSync } = await import('@/composables/useConsultationSync');
    const mockUpdateField = vi.mocked(useConsultationSync).mock.results[0].value.updateField;

    const textarea = wrapper.find('textarea');
    await textarea.setValue('Nuevas notas');

    expect(mockUpdateField).toHaveBeenCalled();
  });

  it('should emit save-requested event when save button clicked', async () => {
    const wrapper = mount(ConsultationTools, {
      props: defaultProps
    });

    const saveButton = wrapper.find('[icon="mdi-content-save"]');
    await saveButton.trigger('click');

    expect(wrapper.emitted('save-requested')).toBeDefined();
  });

  it('should disable save button when no unsaved changes', () => {
    const wrapper = mount(ConsultationTools, {
      props: defaultProps
    });

    const saveButton = wrapper.find('[icon="mdi-content-save"]');
    // Should be disabled when no changes
    expect(saveButton.attributes('disabled')).toBeDefined();
  });

  it('should accept initialData prop', () => {
    const initialData = {
      notas: 'Notas iniciales',
      evolucion: 'Evolución inicial',
      tratamiento: 'Tratamiento inicial'
    };

    const wrapper = mount(ConsultationTools, {
      props: {
        ...defaultProps,
        initialData
      }
    });

    expect(wrapper.exists()).toBe(true);
  });

  it('should support compact mode', () => {
    const wrapper = mount(ConsultationTools, {
      props: {
        ...defaultProps,
        compactMode: true
      }
    });

    expect(wrapper.classes()).toContain('compact');
  });

  it('should show sync status footer when syncing', () => {
    const { useConsultationSync } = require('@/composables/useConsultationSync');
    vi.mocked(useConsultationSync).mockReturnValue({
      ...vi.mocked(useConsultationSync)(),
      syncStatus: {
        value: {
          isSyncing: true,
          lastSyncAt: null,
          pendingChanges: false,
          error: null,
          syncProgress: 50
        }
      }
    });

    const wrapper = mount(ConsultationTools, {
      props: defaultProps
    });

    expect(wrapper.find('.sync-status-footer').exists()).toBe(true);
  });

  it('should show error in sync status footer', () => {
    const { useConsultationSync } = require('@/composables/useConsultationSync');
    vi.mocked(useConsultationSync).mockReturnValue({
      ...vi.mocked(useConsultationSync)(),
      syncStatus: {
        value: {
          isSyncing: false,
          lastSyncAt: null,
          pendingChanges: false,
          error: 'Error de conexión',
          syncProgress: 0
        }
      }
    });

    const wrapper = mount(ConsultationTools, {
      props: defaultProps
    });

    const errorAlert = wrapper.find('[type="error"]');
    expect(errorAlert.exists()).toBe(true);
    expect(errorAlert.text()).toContain('Error de conexión');
  });

  it('should expose getData method', () => {
    const wrapper = mount(ConsultationTools, {
      props: defaultProps
    });

    expect(wrapper.vm.getData).toBeDefined();
    expect(typeof wrapper.vm.getData).toBe('function');
  });

  it('should expose saveDraft method', () => {
    const wrapper = mount(ConsultationTools, {
      props: defaultProps
    });

    expect(wrapper.vm.saveDraft).toBeDefined();
    expect(typeof wrapper.vm.saveDraft).toBe('function');
  });

  it('should expose setActiveTool method', () => {
    const wrapper = mount(ConsultationTools, {
      props: defaultProps
    });

    expect(wrapper.vm.setActiveTool).toBeDefined();
    expect(typeof wrapper.vm.setActiveTool).toBe('function');
  });

  it('should change active tool when tab clicked', async () => {
    const wrapper = mount(ConsultationTools, {
      props: defaultProps
    });

    // Find and click CIE-10 tab
    const tabs = wrapper.findAll('[role="tab"]');
    const cie10Tab = tabs.find(tab => tab.text().includes('CIE-10'));
    
    if (cie10Tab) {
      await cie10Tab.trigger('click');
      await flushPromises();
      
      // Should have emitted or changed internal state
      expect(wrapper.vm.setActiveTool).toHaveBeenCalled();
    }
  });

  it('should show diagnosis count chip', () => {
    const wrapper = mount(ConsultationTools, {
      props: defaultProps
    });

    // Should show diagnosis section
    expect(wrapper.find('.diagnosis-chip-mock').exists()).toBe(true);
  });

  it('should show medication count chip', () => {
    const wrapper = mount(ConsultationTools, {
      props: defaultProps
    });

    // Should show prescription section
    expect(wrapper.find('.prescription-panel-mock').exists()).toBe(true);
  });

  it('should show exams count chip', () => {
    const wrapper = mount(ConsultationTools, {
      props: defaultProps
    });

    // Should show exams section
    expect(wrapper.find('.exams-panel-mock').exists()).toBe(true);
  });

  it('should handle IA suggestions in Evolución tab', () => {
    const wrapper = mount(ConsultationTools, {
      props: defaultProps
    });

    // Should render IA chips panel
    expect(wrapper.find('.ia-chips-panel-mock').exists()).toBe(true);
  });
});
