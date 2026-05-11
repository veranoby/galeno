<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import useAntecedents, {
  type TipoAntecedente,
  type CreateAntecedenteDto,
  type UpdateAntecedenteDto,
  TIPO_LABELS
} from '@/composables/useAntecedents';
import AntecedentForm from '@/components/patient/AntecedentForm.vue';

const route = useRoute();
const pacienteId = computed(() => route.params.pacienteId as string);

// Composables
const {
  antecedentes,
  antecedentesFiltrados,
  antecedentesAgrupados,
  resumen,
  loading,
  error,
  filtroTipo,
  fetchAntecedentes,
  createAntecedente,
  updateAntecedente,
  deleteAntecedente,
  setFiltroTipo,
  clearFiltros,
  refresh
} = useAntecedents(pacienteId.value);

// Estado
const mostrandoForm = ref(false);
const editandoId = ref<string | null>(null);
const antecedenteSeleccionado = ref<any>(null);
const searchQuery = ref('');

// Computados
const tiposAntecedente: TipoAntecedente[] = ['personal', 'familiar', 'medicamento', 'habito', 'alergia'];

const totalCounts = computed(() => {
  if (!resumen.value) return {};
  return resumen.value.porTipo;
});

const hasAntecedentes = computed(() => antecedentes.value.length > 0);

// Métodos
const handleNew = () => {
  editandoId.value = null;
  antecedenteSeleccionado.value = null;
  mostrandoForm.value = true;
};

const handleEdit = (antecedente: any) => {
  editandoId.value = antecedente.id;
  antecedenteSeleccionado.value = antecedente;
  mostrandoForm.value = true;
};

const handleDelete = async (id: string) => {
  if (!confirm('¿Está seguro de eliminar este antecedente?')) return;

  try {
    await deleteAntecedente(id);
  } catch (e) {
    console.error('Error al eliminar:', e);
  }
};

const handleFormSubmit = async (data: CreateAntecedenteDto) => {
  try {
    if (editandoId.value) {
      await updateAntecedente(editandoId.value, data as UpdateAntecedenteDto);
    } else {
      await createAntecedente(data);
    }
    mostrandoForm.value = false;
    editandoId.value = null;
    antecedenteSeleccionado.value = null;
  } catch (e) {
    console.error('Error al guardar:', e);
  }
};

const handleFormCancel = () => {
  mostrandoForm.value = false;
  editandoId.value = null;
  antecedenteSeleccionado.value = null;
};

const handleSearch = async () => {
  if (searchQuery.value.trim()) {
    // El método search está disponible en el composable
    // Pero necesito implementarlo
  } else {
    await fetchAntecedentes();
  }
};

const handleTipoFilter = async (tipo: TipoAntecedente | null) => {
  setFiltroTipo(tipo);
};

// Lifecycle
onMounted(async () => {
  await refresh();
});
</script>

<template>
  <div class="antecedentes-view">
    <header class="view-header">
      <h1>Antecedentes del Paciente</h1>
      <button @click="handleNew" class="btn btn-primary">
        + Agregar Antecedente
      </button>
    </header>

    <!-- Filtros y búsqueda -->
    <div class="filters-bar">
      <!-- Tabs por tipo -->
      <div class="tipo-tabs">
        <button
          :class="['tipo-tab', { active: filtroTipo === null }]"
          @click="handleTipoFilter(null)"
        >
          Todos ({{ antecedentes.length }})
        </button>
        <button
          v-for="tipo in tiposAntecedente"
          :key="tipo"
          :class="['tipo-tab', { active: filtroTipo === tipo }]"
          @click="handleTipoFilter(tipo)"
        >
          {{ TIPO_LABELS[tipo] }} ({{ (totalCounts as any)[tipo] || 0 }})
        </button>
      </div>

      <!-- Búsqueda -->
      <div class="search-box">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Buscar antecedentes..."
          class="search-input"
          @input="handleSearch"
        >
      </div>
    </div>

    <!-- Error -->
    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <!-- Loading -->
    <div v-if="loading && !mostrandoForm" class="loading">
      Cargando antecedentes...
    </div>

    <!-- Formulario -->
    <div v-if="mostrandoForm" class="form-container">
      <h2>{{ editandoId ? 'Editar' : 'Nuevo' }} Antecedente</h2>
      <AntecedentForm
        :paciente-id="pacienteId"
        :antecedente="antecedenteSeleccionado"
        :submit-label="editandoId ? 'Actualizar' : 'Crear'"
        @submit="handleFormSubmit"
        @cancel="handleFormCancel"
      />
    </div>

    <!-- Lista de antecedentes -->
    <div v-else-if="hasAntecedentes" class="antecedentes-list">
      <div v-for="tipo in tiposAntecedente" :key="tipo" class="tipo-section">
        <template v-if="antecedentesAgrupados[tipo].length > 0">
          <h3 class="tipo-title">{{ TIPO_LABELS[tipo] }}</h3>

          <div class="antecedentes-cards">
            <div
              v-for="antecedente in antecedentesAgrupados[tipo]"
              :key="antecedente.id"
              class="antecedente-card"
            >
              <div class="card-header">
                <span class="card-categoria">{{ antecedente.categoria }}</span>
                <span class="card-actions">
                  <button @click="handleEdit(antecedente)" class="btn-icon" title="Editar">
                    ✏️
                  </button>
                  <button @click="handleDelete(antecedente.id)" class="btn-icon" title="Eliminar">
                    🗑️
                  </button>
                </span>
              </div>
              <div class="card-body">
                <p class="card-detalle">{{ antecedente.detalle }}</p>
                <div v-if="antecedente.grado" class="card-grado">
                  <strong>{{ tipo === 'familiar' ? 'Parentesco' : tipo === 'alergia' ? 'Severidad' : 'Grado' }}:</strong>
                  {{ antecedente.grado }}
                </div>
              </div>
              <div class="card-footer">
                <small>{{ new Date(antecedente.fechaRegistro).toLocaleDateString('es-EC') }}</small>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Estado vacío -->
    <div v-else class="empty-state">
      <p>No hay antecedentes registrados para este paciente.</p>
      <button @click="handleNew" class="btn btn-primary">
        + Agregar Primer Antecedente
      </button>
    </div>
  </div>
</template>

<style scoped>
.antecedentes-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem;
}

.view-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.view-header h1 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-weight: 500;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.15s ease-in-out;
  border: none;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
}

.filters-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
  margin-bottom: 1rem;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 0.5rem;
}

.tipo-tabs {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.tipo-tab {
  padding: 0.5rem 1rem;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 2rem;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.15s ease-in-out;
}

.tipo-tab:hover {
  background: #f3f4f6;
}

.tipo-tab.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.search-box {
  flex: 1;
  min-width: 200px;
}

.search-input {
  width: 100%;
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 0.875rem;
}

.error-message {
  padding: 0.75rem 1rem;
  background: #fee2e2;
  border: 1px solid #fecaca;
  border-radius: 0.375rem;
  color: #991b1b;
  margin-bottom: 1rem;
}

.loading {
  text-align: center;
  padding: 2rem;
  color: #6b7280;
}

.form-container {
  background: white;
  padding: 1.5rem;
  border-radius: 0.5rem;
  border: 1px solid #e5e7eb;
  margin-bottom: 1.5rem;
}

.form-container h2 {
  margin-top: 0;
  margin-bottom: 1rem;
  font-size: 1.125rem;
  font-weight: 600;
}

.antecedentes-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.tipo-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.tipo-title {
  font-size: 1rem;
  font-weight: 600;
  color: #374151;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.antecedentes-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}

.antecedente-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  overflow: hidden;
  transition: box-shadow 0.15s ease-in-out;
}

.antecedente-card:hover {
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.card-categoria {
  font-weight: 600;
  font-size: 0.875rem;
  color: #374151;
  text-transform: capitalize;
}

.card-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  padding: 0.25rem;
  border-radius: 0.25rem;
  transition: background 0.15s ease-in-out;
}

.btn-icon:hover {
  background: #e5e7eb;
}

.card-body {
  padding: 1rem;
}

.card-detalle {
  margin: 0 0 0.5rem 0;
  color: #4b5563;
  line-height: 1.5;
}

.card-grado {
  font-size: 0.875rem;
  color: #6b7280;
}

.card-footer {
  padding: 0.5rem 1rem;
  border-top: 1px solid #e5e7eb;
  font-size: 0.75rem;
  color: #9ca3af;
}

.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: #6b7280;
}

.empty-state p {
  margin-bottom: 1rem;
}

@media (max-width: 768px) {
  .filters-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .tipo-tabs {
    flex-wrap: wrap;
  }

  .antecedentes-cards {
    grid-template-columns: 1fr;
  }
}
</style>
