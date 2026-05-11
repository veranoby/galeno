import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ref } from 'vue';
import WalletValidation from '../WalletValidation.vue';

// Types para los mocks
interface MockPatientHistory {
  consultas: Array<{
    id: string;
    createdAt: string;
    motivoConsulta?: string;
    diagnosticoCie10?: unknown;
    doctor: { nombre: string; especialidad?: string };
  }>;
  documentos: Array<{
    id: string;
    tipo: string;
    fechaEmision: string;
    downloadUrl: string;
    viewUrl: string;
  }>;
  paciente: { id: string; nombre: string };
}

// Mock del composable useHealthWallet
const mockTemporalToken = ref<string | null>(null);
const mockTemporalValidation = ref<{ valid: boolean; expiresAt?: string } | null>(null);
const mockPatientHistory = ref<MockPatientHistory | null>(null);

let mockRequestTemporalAccess = vi.fn();
const mockValidateTemporalToken = vi.fn();
let mockGetPatientHistory = vi.fn();
let mockGetPatientDocuments = vi.fn();
let mockRevokeTemporalAccess = vi.fn();

vi.mock('@/composables/useHealthWallet', () => ({
  useHealthWallet: () => ({
    temporalToken: mockTemporalToken,
    temporalValidation: mockTemporalValidation,
    patientHistory: mockPatientHistory,
    requestTemporalAccess: mockRequestTemporalAccess,
    validateTemporalToken: mockValidateTemporalToken,
    getPatientHistory: mockGetPatientHistory,
    getPatientDocuments: mockGetPatientDocuments,
    revokeTemporalAccess: mockRevokeTemporalAccess,
  }),
}));

// Mock de CSS
vi.mock('*.css', () => ({}));
vi.mock('*.scss', () => ({}));

describe('WalletValidation.vue', () => {
  const mockProps = {
    citaId: 'cita-123',
    doctorId: 'doctor-456',
    pacienteId: 'patient-789',
    patientName: 'Juan Pérez',
  };

  const mockHistoryData: MockPatientHistory = {
    consultas: [
      {
        id: 'consulta-1',
        createdAt: '2024-01-15T10:00:00Z',
        motivoConsulta: 'Dolor abdominal',
        diagnosticoCie10: [{ codigo: 'K59.9', descripcion: 'Dolor abdominal' }],
        doctor: { nombre: 'Dr. Smith', especialidad: 'Medicina General' },
      },
    ],
    documentos: [
      {
        id: 'doc-1',
        tipo: 'RECETA',
        fechaEmision: '2024-01-15T10:00:00Z',
        downloadUrl: '/api/v1/storage/download/doc-1',
        viewUrl: '/api/v1/storage/view/doc-1',
      },
    ],
    paciente: { id: 'patient-789', nombre: 'Juan Pérez' },
  };

  const mountWrapper = (props = mockProps) => {
    return mount(WalletValidation, {
      props,
      global: {
        stubs: {
          transition: false,
        },
      },
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Resetear refs
    mockTemporalToken.value = null;
    mockTemporalValidation.value = null;
    mockPatientHistory.value = null;

    // Setup default mock responses
    mockRequestTemporalAccess = vi.fn().mockResolvedValue({
      token: 'test-token-123',
      expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hora
    });

    mockGetPatientHistory = vi.fn().mockResolvedValue(mockHistoryData);
    mockGetPatientDocuments = vi.fn().mockResolvedValue(mockHistoryData.documentos);
    mockRevokeTemporalAccess = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Renderizado inicial', () => {
    it('no muestra nada si faltan props requeridos', () => {
      const wrapper = mount(WalletValidation, {
        props: { citaId: '', doctorId: '', pacienteId: '' },
      });
      expect(wrapper.find('.wallet-validation').exists()).toBe(false);
    });

    it('muestra el estado de solicitud cuando se monta con todos los props', () => {
      const wrapper = mountWrapper();
      expect(wrapper.find('.validation-request').exists()).toBe(true);
      expect(wrapper.find('.request-card h3').text()).toBe('Acceso al Historial del Paciente');
    });

    it('muestra el nombre del paciente si se proporciona', () => {
      const wrapper = mountWrapper();
      expect(wrapper.find('.patient-info .value').text()).toBe('Juan Pérez');
    });
  });

  describe('Solicitud de acceso', () => {
    it('solicita acceso temporal al hacer clic en el botón', async () => {
      const wrapper = mountWrapper();

      await wrapper.find('.btn-primary').trigger('click');
      await flushPromises();

      expect(mockRequestTemporalAccess).toHaveBeenCalledWith({
        citaId: 'cita-123',
        doctorId: 'doctor-456',
        pacienteId: 'patient-789',
      });
    });

    it('muestra estado de carga durante la solicitud', async () => {
      mockRequestTemporalAccess = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      const wrapper = mountWrapper();
      await wrapper.find('.btn-primary').trigger('click');

      expect(wrapper.find('.btn-primary').text()).toContain('Solicitando...');
    });

    it('transiciona al estado "granted" cuando la solicitud es exitosa', async () => {
      const wrapper = mountWrapper();
      await wrapper.find('.btn-primary').trigger('click');
      await flushPromises();

      expect(wrapper.find('.validation-granted').exists()).toBe(true);
      expect(wrapper.find('.granted-header h4').text()).toBe('Acceso Activo');
    });

    it('emite el evento "access-granted" con el token', async () => {
      const wrapper = mountWrapper();
      await wrapper.find('.btn-primary').trigger('click');
      await flushPromises();

      expect(wrapper.emitted('access-granted')).toBeTruthy();
      expect(wrapper.emitted('access-granted')?.[0]).toEqual(['test-token-123']);
    });

    it('muestra mensaje de error cuando la solicitud falla', async () => {
      mockRequestTemporalAccess = vi.fn().mockRejectedValue(
        new Error('Paciente sin Health Wallet activo')
      );

      const wrapper = mountWrapper();
      await wrapper.find('.btn-primary').trigger('click');
      await flushPromises();

      expect(wrapper.find('.validation-error').exists()).toBe(true);
      expect(wrapper.find('.error-card p').text()).toBe('Paciente sin Health Wallet activo');
    });

    it('emite el evento "error" cuando la solicitud falla', async () => {
      mockRequestTemporalAccess = vi.fn().mockRejectedValue(
        new Error('Error de conexión')
      );

      const wrapper = mountWrapper();
      await wrapper.find('.btn-primary').trigger('click');
      await flushPromises();

      expect(wrapper.emitted('error')).toBeTruthy();
      expect(wrapper.emitted('error')?.[0]).toEqual(['Error de conexión']);
    });
  });

  describe('Estado "granted" - Acceso concedido', () => {
    beforeEach(async () => {
      const wrapper = mountWrapper();
      await wrapper.find('.btn-primary').trigger('click');
      await flushPromises();
    });

    it('muestra el tiempo restante de expiración', async () => {
      const wrapper = mountWrapper();
      await wrapper.find('.btn-primary').trigger('click');
      await flushPromises();

      expect(wrapper.find('.expires-at').exists()).toBe(true);
      expect(wrapper.find('.expires-at').text()).toMatch(/\d+:\d{2}/);
    });

    it('muestra advertencia cuando quedan menos de 5 minutos', async () => {
      const wrapper = mountWrapper();
      await wrapper.find('.btn-primary').trigger('click');
      await flushPromises();

      // Avanzar tiempo 55 minutos
      vi.advanceTimersByTime(55 * 60 * 1000);
      await wrapper.vm.$nextTick();

      expect(wrapper.find('.expires-at').classes()).toContain('warning');
    });

    it('carga el historial del paciente', async () => {
      const wrapper = mountWrapper();
      await wrapper.find('.btn-primary').trigger('click');
      await flushPromises();

      expect(mockGetPatientHistory).toHaveBeenCalledWith('test-token-123');
    });

    it('muestra la pestaña de historial por defecto', async () => {
      const wrapper = mountWrapper();
      await wrapper.find('.btn-primary').trigger('click');
      await flushPromises();

      expect(wrapper.find('.panel-tabs button.active').text()).toBe('Historial');
    });

    it('muestra las consultas del paciente', async () => {
      const wrapper = mountWrapper();
      await wrapper.find('.btn-primary').trigger('click');
      await flushPromises();

      expect(wrapper.find('.consultas-list').exists()).toBe(true);
      expect(wrapper.findAll('.consulta-item').length).toBe(1);
      expect(wrapper.find('.consulta-motivo').text()).toBe('Dolor abdominal');
    });

    it('permite cambiar a la pestaña de documentos', async () => {
      const wrapper = mountWrapper();
      await wrapper.find('.btn-primary').trigger('click');
      await flushPromises();

      const documentsTab = wrapper.findAll('.panel-tabs button')[1];
      await documentsTab.trigger('click');

      expect(wrapper.find('.panel-tabs button.active').text()).toBe('Documentos');
    });

    it('muestra los documentos del paciente', async () => {
      const wrapper = mountWrapper();
      await wrapper.find('.btn-primary').trigger('click');
      await flushPromises();

      // Cambiar a pestaña documentos
      const documentsTab = wrapper.findAll('.panel-tabs button')[1];
      await documentsTab.trigger('click');

      expect(wrapper.find('.documents-list').exists()).toBe(true);
      expect(wrapper.findAll('.documento-item').length).toBe(1);
      expect(wrapper.find('.doc-type').text()).toBe('Receta');
    });

    it('muestra links de descarga y vista para documentos', async () => {
      const wrapper = mountWrapper();
      await wrapper.find('.btn-primary').trigger('click');
      await flushPromises();

      const documentsTab = wrapper.findAll('.panel-tabs button')[1];
      await documentsTab.trigger('click');

      expect(wrapper.find('.btn-view').attributes('href')).toBe('/api/v1/storage/view/doc-1');
      expect(wrapper.find('.btn-download').attributes('href')).toBe('/api/v1/storage/download/doc-1');
    });

    it('muestra estado vacío cuando no hay consultas', async () => {
      mockGetPatientHistory = vi.fn().mockResolvedValue({
        ...mockHistoryData,
        consultas: [],
      });

      const wrapper = mountWrapper();
      await wrapper.find('.btn-primary').trigger('click');
      await flushPromises();

      expect(wrapper.find('.empty-state').text()).toBe('No hay consultas previas registradas.');
    });
  });

  describe('Expiración del token', () => {
    it('transiciona a estado "expired" cuando el token expira', async () => {
      const wrapper = mountWrapper({
        ...mockProps,
        // Expira en 2 segundos
        citaId: 'cita-expires-soon',
      });

      mockRequestTemporalAccess = vi.fn().mockResolvedValue({
        token: 'expiring-token',
        expiresAt: new Date(Date.now() + 2000).toISOString(),
      });

      await wrapper.find('.btn-primary').trigger('click');
      await flushPromises();

      // Avanzar tiempo 2 segundos
      vi.advanceTimersByTime(2000);
      await flushPromises();

      expect(wrapper.find('.validation-expired').exists()).toBe(true);
      expect(wrapper.find('.expired-card h4').text()).toBe('Sesión Expirada');
    });

    it('emite el evento "access-expired" cuando expira', async () => {
      const wrapper = mountWrapper();

      mockRequestTemporalAccess = vi.fn().mockResolvedValue({
        token: 'expiring-token',
        expiresAt: new Date(Date.now() + 1000).toISOString(),
      });

      await wrapper.find('.btn-primary').trigger('click');
      await flushPromises();

      vi.advanceTimersByTime(1000);
      await flushPromises();

      expect(wrapper.emitted('access-expired')).toBeTruthy();
    });

    it('permite renovar el acceso desde el estado expirado', async () => {
      const wrapper = mountWrapper();

      mockRequestTemporalAccess = vi.fn()
        .mockResolvedValueOnce({
          token: 'first-token',
          expiresAt: new Date(Date.now() + 1000).toISOString(),
        })
        .mockResolvedValueOnce({
          token: 'renewed-token',
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        });

      // Primera solicitud
      await wrapper.find('.btn-primary').trigger('click');
      await flushPromises();

      // Expirar
      vi.advanceTimersByTime(1000);
      await flushPromises();

      // Renovar
      await wrapper.find('.btn-renew').trigger('click');
      await flushPromises();

      expect(mockRequestTemporalAccess).toHaveBeenCalledTimes(2);
      expect(wrapper.find('.validation-granted').exists()).toBe(true);
    });
  });

  describe('Auto-solicitud', () => {
    it('solicita acceso automáticamente si autoRequest es true', async () => {
      mountWrapper({ ...mockProps, autoRequest: true });

      await flushPromises();

      expect(mockRequestTemporalAccess).toHaveBeenCalled();
    });
  });

  describe('Limpieza', () => {
    it('revoca el acceso temporal al desmontar el componente', async () => {
      const wrapper = mountWrapper();
      await wrapper.find('.btn-primary').trigger('click');
      await flushPromises();

      wrapper.unmount();

      expect(mockRevokeTemporalAccess).toHaveBeenCalledWith('cita-123');
    });
  });

  describe('Manejo de errores', () => {
    it('permite reintentar desde el estado de error', async () => {
      mockRequestTemporalAccess = vi.fn()
        .mockRejectedValueOnce(new Error('Error temporal'))
        .mockResolvedValueOnce({
          token: 'retry-token',
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        });

      const wrapper = mountWrapper();

      // Primer intento falla
      await wrapper.find('.btn-primary').trigger('click');
      await flushPromises();

      expect(wrapper.find('.validation-error').exists()).toBe(true);

      // Reintentar
      await wrapper.find('.btn-retry').trigger('click');
      await flushPromises();

      expect(wrapper.find('.validation-granted').exists()).toBe(true);
    });
  });

  describe('Formato de datos', () => {
    it('formatea correctamente las fechas de consultas', async () => {
      const wrapper = mountWrapper();
      await wrapper.find('.btn-primary').trigger('click');
      await flushPromises();

      const dateText = wrapper.find('.consulta-date').text();
      // Formato esperado: DD MMM AAAA (ej: 15 ene. 2024)
      expect(dateText).toMatch(/\d{2}\s\w{3,4}\.\s\d{4}/);
    });

    it('formatea correctamente los diagnósticos CIE-10', async () => {
      const wrapper = mountWrapper();
      await wrapper.find('.btn-primary').trigger('click');
      await flushPromises();

      const diagText = wrapper.find('.diagnostico-value').text();
      expect(diagText).toContain('K59.9');
      expect(diagText).toContain('Dolor abdominal');
    });

    it('formatea correctamente los tipos de documentos', async () => {
      const wrapper = mountWrapper();
      await wrapper.find('.btn-primary').trigger('click');
      await flushPromises();

      const documentsTab = wrapper.findAll('.panel-tabs button')[1];
      await documentsTab.trigger('click');

      expect(wrapper.find('.doc-type').text()).toBe('Receta');
    });
  });
});
