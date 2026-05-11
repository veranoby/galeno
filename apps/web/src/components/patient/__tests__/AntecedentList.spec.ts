import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ref } from 'vue';
import AntecedentList from '../AntecedentList.vue';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import type { Antecedente, AntecedentesResumen } from '@/composables/useAntecedents';

// Define a variable that can be updated per test
let mockReturnValues = {
  antecedentes: ref([]),
  resumen: ref(null),
  loading: ref(false),
  error: ref(null),
  fetchAntecedentes: vi.fn().mockResolvedValue(undefined),
  fetchResumen: vi.fn().mockResolvedValue(undefined),
  searchAntecedentes: vi.fn().mockResolvedValue(undefined),
  refresh: vi.fn().mockResolvedValue(undefined),
};

// Mock CSS imports
vi.mock('vuetify/lib/components/VBtn/VBtn.css', () => ({}));
vi.mock('vuetify/lib/components/VCard/VCard.css', () => ({}));
vi.mock('vuetify/lib/components/VIcon/VIcon.css', () => ({}));
vi.mock('vuetify/lib/components/VChip/VChip.css', () => ({}));
vi.mock('vuetify/lib/components/VAlert/VAlert.css', () => ({}));
vi.mock('vuetify/lib/components/VTextField/VTextField.css', () => ({}));

vi.mock('@/composables/useAntecedents', () => ({
  useAntecedents: vi.fn(() => mockReturnValues),
}));

// Mock de vuetify
const vuetify = createVuetify({
  components,
  directives,
});

describe('AntecedentList.vue', () => {
  const mockPacienteId = 'patient-1';
  
  const mockAntecedentes: Antecedente[] = [
    {
      id: '1',
      pacienteId: mockPacienteId,
      tipo: 'personal',
      categoria: 'patológico',
      detalle: 'Historia de hipertensión arterial',
      grado: null,
      fechaRegistro: '2023-05-15T10:30:00Z',
      registradoPor: 'doctor',
      createdAt: '2023-05-15T10:30:00Z',
    },
    {
      id: '2',
      pacienteId: mockPacienteId,
      tipo: 'familiar',
      categoria: 'padre',
      detalle: 'Padre con diabetes',
      grado: 'Primer grado',
      fechaRegistro: '2023-05-16T11:30:00Z',
      registradoPor: 'doctor',
      createdAt: '2023-05-16T11:30:00Z',
    },
  ];

  const mockResumen: AntecedentesResumen = {
    total: 2,
    porTipo: {
      personal: 1,
      familiar: 1,
      medicamento: 0,
      habito: 0,
      alergia: 0,
    },
  };

  const mountOptions = {
    global: {
      plugins: [vuetify],
    },
    props: {
      pacienteId: mockPacienteId,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock values to default
    mockReturnValues = {
      antecedentes: ref([]),
      resumen: ref(null),
      loading: ref(false),
      error: ref(null),
      fetchAntecedentes: vi.fn().mockResolvedValue(undefined),
      fetchResumen: vi.fn().mockResolvedValue(undefined),
      searchAntecedentes: vi.fn().mockResolvedValue(undefined),
      refresh: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('renders initial loading state', () => {
    // Update the mock return values for this test
    mockReturnValues = {
      antecedentes: ref([]),
      resumen: ref(null),
      loading: ref(true), // Set loading to true for this test
      error: ref(null),
      fetchAntecedentes: vi.fn().mockResolvedValue(undefined),
      fetchResumen: vi.fn().mockResolvedValue(undefined),
      searchAntecedentes: vi.fn().mockResolvedValue(undefined),
      refresh: vi.fn().mockResolvedValue(undefined),
    };

    const wrapper = mount(AntecedentList, mountOptions);

    expect(wrapper.find('.v-progress-circular').exists()).toBe(true);
  });

  it('renders antecedentes when loaded', async () => {
    // Update the mock return values for this test
    mockReturnValues = {
      antecedentes: ref(mockAntecedentes),
      resumen: ref(mockResumen),
      loading: ref(false),
      error: ref(null),
      fetchAntecedentes: vi.fn().mockResolvedValue(undefined),
      fetchResumen: vi.fn().mockResolvedValue(undefined),
      searchAntecedentes: vi.fn().mockResolvedValue(undefined),
      refresh: vi.fn().mockResolvedValue(undefined),
    };

    const wrapper = mount(AntecedentList, mountOptions);
    await flushPromises();

    // Verificar que se muestren los antecedentes
    expect(wrapper.findAll('.antecedent-card')).toHaveLength(2);
    expect(wrapper.text()).toContain('Historia de hipertensión arterial');
    expect(wrapper.text()).toContain('Padre con diabetes');
  });

  it('shows summary when showSummary is true', async () => {
    // Update the mock return values for this test
    mockReturnValues = {
      antecedentes: ref(mockAntecedentes),
      resumen: ref(mockResumen),
      loading: ref(false),
      error: ref(null),
      fetchAntecedentes: vi.fn().mockResolvedValue(undefined),
      fetchResumen: vi.fn().mockResolvedValue(undefined),
      searchAntecedentes: vi.fn().mockResolvedValue(undefined),
      refresh: vi.fn().mockResolvedValue(undefined),
    };

    const wrapper = mount(AntecedentList, {
      ...mountOptions,
      props: {
        pacienteId: mockPacienteId,
        showSummary: true,
      },
    });
    await flushPromises();

    // Verificar que se muestre el resumen
    expect(wrapper.text()).toContain('Personal');
    expect(wrapper.text()).toContain('Familiar');
    expect(wrapper.text()).toContain('1');
  });

  it('filters by type when chip is selected', async () => {
    const fetchAntecedentesMock = vi.fn().mockResolvedValue(undefined);

    // Update the mock return values for this test
    mockReturnValues = {
      antecedentes: ref(mockAntecedentes),
      resumen: ref(mockResumen),
      loading: ref(false),
      error: ref(null),
      fetchAntecedentes: fetchAntecedentesMock,
      fetchResumen: vi.fn().mockResolvedValue(undefined),
      searchAntecedentes: vi.fn().mockResolvedValue(undefined),
      refresh: vi.fn().mockResolvedValue(undefined),
    };

    const wrapper = mount(AntecedentList, mountOptions);
    await flushPromises();

    // Simular clic en el chip de tipo familiar
    const familiarChip = wrapper.find('.v-chip[value="familiar"]');
    await familiarChip.trigger('click');

    // Verificar que se haya llamado a fetchAntecedentes con el tipo correcto
    expect(fetchAntecedentesMock).toHaveBeenCalledWith('familiar');
  });

  it('emits filter-change event when filter changes', async () => {
    // Update the mock return values for this test
    mockReturnValues = {
      antecedentes: mockAntecedentes,
      resumen: mockResumen,
      loading: false,
      error: null,
      fetchAntecedentes: vi.fn().mockResolvedValue(undefined),
      fetchResumen: vi.fn().mockResolvedValue(undefined),
      searchAntecedentes: vi.fn().mockResolvedValue(undefined),
      refresh: vi.fn().mockResolvedValue(undefined),
    };

    const wrapper = mount(AntecedentList, mountOptions);
    await flushPromises();

    // Simular clic en el chip de tipo familiar
    const familiarChip = wrapper.find('.v-chip[value="familiar"]');
    await familiarChip.trigger('click');

    // Verificar que se emitió el evento filter-change
    expect(wrapper.emitted('filter-change')).toBeTruthy();
    expect(wrapper.emitted('filter-change')![0]).toEqual(['familiar']);
  });

  it('shows search bar when showSearch is true', () => {
    const wrapper = mount(AntecedentList, {
      ...mountOptions,
      props: {
        pacienteId: mockPacienteId,
        showSearch: true,
      },
    });

    expect(wrapper.find('.search-bar').exists()).toBe(true);
  });

  it('emits search event when search query changes', async () => {
    const searchAntecedentesMock = vi.fn().mockResolvedValue(undefined);

    // Update the mock return values for this test
    mockReturnValues = {
      antecedentes: mockAntecedentes,
      resumen: mockResumen,
      loading: false,
      error: null,
      fetchAntecedentes: vi.fn().mockResolvedValue(undefined),
      fetchResumen: vi.fn().mockResolvedValue(undefined),
      searchAntecedentes: searchAntecedentesMock,
      refresh: vi.fn().mockResolvedValue(undefined),
    };

    const wrapper = mount(AntecedentList, {
      ...mountOptions,
      props: {
        pacienteId: mockPacienteId,
        showSearch: true,
      },
    });
    await flushPromises();

    // Simular cambio en el campo de búsqueda
    const searchInput = wrapper.find('input');
    await searchInput.setValue('hipertensión');

    // Esperar a que se procese el cambio
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verificar que se haya emitido el evento search
    expect(wrapper.emitted('search')).toBeTruthy();
    expect(wrapper.emitted('search')![0]).toEqual(['hipertensión']);
  });

  it('shows empty state when no antecedentes exist', async () => {
    // Update the mock return values for this test
    mockReturnValues = {
      antecedentes: [],
      resumen: { total: 0, porTipo: { personal: 0, familiar: 0, medicamento: 0, habito: 0, alergia: 0 } },
      loading: false,
      error: null,
      fetchAntecedentes: vi.fn().mockResolvedValue(undefined),
      fetchResumen: vi.fn().mockResolvedValue(undefined),
      searchAntecedentes: vi.fn().mockResolvedValue(undefined),
      refresh: vi.fn().mockResolvedValue(undefined),
    };

    const wrapper = mount(AntecedentList, mountOptions);
    await flushPromises();

    // Verificar que se muestre el estado vacío
    expect(wrapper.text()).toContain('No hay antecedentes');
    expect(wrapper.text()).toContain('Aún no se han registrado antecedentes para este paciente.');
  });

  it('emits create event when add button is clicked in empty state', async () => {
    // Update the mock return values for this test
    mockReturnValues = {
      antecedentes: [],
      resumen: { total: 0, porTipo: { personal: 0, familiar: 0, medicamento: 0, habito: 0, alergia: 0 } },
      loading: false,
      error: null,
      fetchAntecedentes: vi.fn().mockResolvedValue(undefined),
      fetchResumen: vi.fn().mockResolvedValue(undefined),
      searchAntecedentes: vi.fn().mockResolvedValue(undefined),
      refresh: vi.fn().mockResolvedValue(undefined),
    };

    const wrapper = mount(AntecedentList, mountOptions);
    await flushPromises();

    // Simular clic en el botón de agregar
    const addButton = wrapper.find('button');
    await addButton.trigger('click');

    // Verificar que se haya emitido el evento create
    expect(wrapper.emitted('create')).toBeTruthy();
  });

  it('emits edit event when edit is triggered from card', async () => {
    // Update the mock return values for this test
    mockReturnValues = {
      antecedentes: mockAntecedentes,
      resumen: mockResumen,
      loading: false,
      error: null,
      fetchAntecedentes: vi.fn().mockResolvedValue(undefined),
      fetchResumen: vi.fn().mockResolvedValue(undefined),
      searchAntecedentes: vi.fn().mockResolvedValue(undefined),
      refresh: vi.fn().mockResolvedValue(undefined),
    };

    const wrapper = mount(AntecedentList, mountOptions);
    await flushPromises();

    // Simular emisión de evento edit desde un card
    const card = wrapper.getComponent({ name: 'AntecedentCard' });
    card.vm.$emit('edit', mockAntecedentes[0]);

    // Verificar que se haya emitido el evento edit
    expect(wrapper.emitted('edit')).toBeTruthy();
    expect(wrapper.emitted('edit')![0]).toEqual([mockAntecedentes[0]]);
  });

  it('emits delete event when delete is triggered from card', async () => {
    // Update the mock return values for this test
    mockReturnValues = {
      antecedentes: mockAntecedentes,
      resumen: mockResumen,
      loading: false,
      error: null,
      fetchAntecedentes: vi.fn().mockResolvedValue(undefined),
      fetchResumen: vi.fn().mockResolvedValue(undefined),
      searchAntecedentes: vi.fn().mockResolvedValue(undefined),
      refresh: vi.fn().mockResolvedValue(undefined),
    };

    const wrapper = mount(AntecedentList, mountOptions);
    await flushPromises();

    // Simular emisión de evento delete desde un card
    const card = wrapper.getComponent({ name: 'AntecedentCard' });
    card.vm.$emit('delete', '1');

    // Verificar que se haya emitido el evento delete
    expect(wrapper.emitted('delete')).toBeTruthy();
    expect(wrapper.emitted('delete')![0]).toEqual(['1']);
  });

  it('shows error state when error occurs', async () => {
    // Update the mock return values for this test
    mockReturnValues = {
      antecedentes: [],
      resumen: null,
      loading: false,
      error: 'Error al cargar antecedentes',
      fetchAntecedentes: vi.fn().mockResolvedValue(undefined),
      fetchResumen: vi.fn().mockResolvedValue(undefined),
      searchAntecedentes: vi.fn().mockResolvedValue(undefined),
      refresh: vi.fn().mockResolvedValue(undefined),
    };

    const wrapper = mount(AntecedentList, mountOptions);
    await flushPromises();

    // Verificar que se muestre el mensaje de error
    expect(wrapper.text()).toContain('Error al cargar antecedentes');
  });

  it('calls refresh when retry button is clicked in error state', async () => {
    const refreshMock = vi.fn().mockResolvedValue(undefined);

    // Update the mock return values for this test
    mockReturnValues = {
      antecedentes: [],
      resumen: null,
      loading: false,
      error: 'Error al cargar antecedentes',
      fetchAntecedentes: vi.fn().mockResolvedValue(undefined),
      fetchResumen: vi.fn().mockResolvedValue(undefined),
      searchAntecedentes: vi.fn().mockResolvedValue(undefined),
      refresh: refreshMock,
    };

    const wrapper = mount(AntecedentList, mountOptions);
    await flushPromises();

    // Simular clic en el botón de reintento
    const retryButton = wrapper.find('button');
    await retryButton.trigger('click');

    // Verificar que se haya llamado a refresh
    expect(refreshMock).toHaveBeenCalled();
  });
});