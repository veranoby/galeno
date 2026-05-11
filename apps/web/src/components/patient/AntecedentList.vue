<template>
  <div class="antecedent-list-container">
    <!-- Filtros y búsqueda -->
    <div class="filters-section pa-4" role="search" aria-labelledby="filters-heading">
      <h2 id="filters-heading" class="sr-only">Filtros de antecedentes</h2>
      
      <!-- Filtros por tipo -->
      <div class="type-filters mb-4" role="group" aria-labelledby="type-filters-label">
        <span id="type-filters-label" class="sr-only">Filtrar por tipo de antecedente</span>
        <v-chip-group
          v-model="selectedFilter"
          mandatory
          selected-class="primary--text"
          :aria-label="`Filtrar antecedentes por tipo`"
          role="radiogroup"
        >
          <v-chip
            v-for="tipo in tiposAntecedente"
            :key="tipo"
            :value="tipo"
            variant="outlined"
            :class="{ active: selectedFilter === tipo }"
            :aria-label="`Mostrar antecedentes de tipo ${getTipoLabel(tipo)}`"
          >
            <v-icon start :icon="getIconByType(tipo)" :color="getColorByType(tipo)" />
            {{ getTipoLabel(tipo) }}
            <v-badge
              v-if="resumen && resumen.porTipo[tipo]"
              :content="resumen.porTipo[tipo]"
              inline
              class="ml-1"
              :aria-label="`${resumen.porTipo[tipo]} antecedentes de tipo ${getTipoLabel(tipo)}`"
            />
          </v-chip>
          
          <v-chip
            value="all"
            variant="outlined"
            :class="{ active: selectedFilter === 'all' }"
            aria-label="Mostrar todos los antecedentes"
          >
            <v-icon start icon="mdi-filter-variant-remove" />
            Todos
          </v-chip>
        </v-chip-group>
      </div>

      <!-- Barra de búsqueda -->
      <div v-if="showSearch" class="search-bar mb-4">
        <v-text-field
          v-model="searchQuery"
          prepend-inner-icons="mdi-magnify"
          placeholder="Buscar antecedentes..."
          clearable
          density="comfortable"
          hide-details
          single-line
          :aria-label="`Buscar antecedentes`"
          :aria-describedby="searchDescriptionId"
        />
        <span :id="searchDescriptionId" class="sr-only">Ingrese texto para buscar en los antecedentes</span>
      </div>

      <!-- Resumen por tipo -->
      <div v-if="showSummary && resumen" class="summary-section mb-4" role="region" aria-labelledby="summary-heading">
        <h3 id="summary-heading" class="sr-only">Resumen de antecedentes por tipo</h3>
        <v-row>
          <v-col
            v-for="(count, tipo) in resumen.porTipo"
            :key="tipo"
            cols="auto"
          >
            <v-card variant="tonal" rounded="pill" class="pa-3" :aria-label="`${count} antecedentes de tipo ${getTipoLabel(tipo as TipoAntecedente)}`">
              <v-icon :icon="getIconByType(tipo as TipoAntecedente)" :color="getColorByType(tipo as TipoAntecedente)" />
              <span class="ml-2 font-weight-bold">{{ count }}</span>
              <span class="text-caption ml-1">{{ getTipoLabel(tipo as TipoAntecedente) }}</span>
            </v-card>
          </v-col>
        </v-row>
      </div>
    </div>

    <!-- Contenido principal -->
    <div class="content-section pa-4" role="main" :aria-busy="loading">
      <!-- Estado de carga -->
      <div v-if="loading" class="d-flex justify-center py-8" role="status" aria-live="polite">
        <v-progress-circular indeterminate color="primary" />
        <span class="sr-only">Cargando antecedentes...</span>
      </div>

      <!-- Mensaje de error -->
      <div v-else-if="error" class="error-message pa-4 text-center" role="alert">
        <v-alert type="error" variant="tonal">
          <p>{{ error }}</p>
          <v-btn @click="refresh" variant="outlined" class="mt-2">
            Reintentar
          </v-btn>
        </v-alert>
      </div>

      <!-- Lista de antecedentes -->
      <div v-else-if="filteredAntecedentes.length > 0" class="antecedentes-grid" role="list" :aria-label="`Lista de ${filteredAntecedentes.length} antecedentes`">
        <transition-group
          name="antecedent-list"
          tag="div"
          class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          <div
            v-for="antecedente in filteredAntecedentes"
            :key="antecedente.id"
            class="antecedent-item"
            role="listitem"
          >
            <AntecedentCard
              :antecedente="antecedente"
              :compact="false"
              :show-actions="true"
              :editable="true"
              @edit="$emit('edit', $event)"
              @delete="$emit('delete', $event)"
            />
          </div>
        </transition-group>
      </div>

      <!-- Estado vacío -->
      <div v-else class="empty-state pa-8 text-center" role="status">
        <v-icon size="x-large" icon="mdi-clipboard-text-off-outline" class="mb-4" aria-hidden="true" />
        <h3 class="text-h6 font-weight-bold mb-2">No hay antecedentes</h3>
        <p class="text-medium-emphasis mb-4">
          {{
            selectedFilter === 'all' 
              ? 'Aún no se han registrado antecedentes para este paciente.' 
              : `No se encontraron antecedentes de tipo ${getTipoLabel(selectedFilter as TipoAntecedente)}.`
          }}
        </p>
        <v-btn
          color="primary"
          variant="elevated"
          @click="$emit('create')"
          :aria-label="`Agregar nuevo antecedente de tipo ${selectedFilter === 'all' ? 'general' : getTipoLabel(selectedFilter as TipoAntecedente)}`"
        >
          <v-icon start icon="mdi-plus" />
          Agregar antecedente
        </v-btn>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import type { PropType } from 'vue';
import type { Antecedente, TipoAntecedente, AntecedentesResumen } from '@/composables/useAntecedents';
import AntecedentCard from './AntecedentCard.vue';
import { useAntecedents } from '@/composables/useAntecedents';

// Tipos
type TipoFiltro = TipoAntecedente | 'all';

// Props
interface Props {
  pacienteId: string;
  initialFilter?: TipoFiltro | null;
  showSearch?: boolean;
  showSummary?: boolean;
  maxItems?: number;
}

const props = withDefaults(defineProps<Props>(), {
  initialFilter: null,
  showSearch: true,
  showSummary: true,
  maxItems: 50
});

// Emits
const emit = defineEmits<{
  'filter-change': [tipo: TipoFiltro | null];
  'search': [query: string];
  'create': [];
  'edit': [antecedente: Antecedente];
  'delete': [id: string];
}>();

// Composables
const { 
  antecedentes, 
  resumen, 
  loading, 
  error, 
  fetchAntecedentes, 
  fetchResumen, 
  searchAntecedentes,
  refresh
} = useAntecedents(props.pacienteId);

// Estado local
const selectedFilter = ref<TipoFiltro>('all');
const searchQuery = ref('');
const searchDescriptionId = `search-description-${Math.random().toString(36).substr(2, 9)}`;

// Tipos disponibles
const tiposAntecedente: TipoAntecedente[] = ['personal', 'familiar', 'medicamento', 'habito', 'alergia'];

// Computados
const filteredAntecedentes = computed(() => {
  let result = [...antecedentes.value];

  // Aplicar filtro de tipo si no es 'all'
  if (selectedFilter.value !== 'all') {
    result = result.filter(a => a.tipo === selectedFilter.value);
  }

  // Limitar cantidad si se especifica
  if (props.maxItems > 0) {
    result = result.slice(0, props.maxItems);
  }

  return result;
});

// Métodos
const getTipoLabel = (tipo: TipoFiltro): string => {
  if (tipo === 'all') return 'Todos';
  
  const labels: Record<TipoAntecedente, string> = {
    personal: 'Personal',
    familiar: 'Familiar',
    medicamento: 'Medicamento',
    habito: 'Hábito',
    alergia: 'Alergia'
  };
  return labels[tipo];
};

const getIconByType = (tipo: TipoFiltro): string => {
  if (tipo === 'all') return 'mdi-filter-variant-remove';
  
  const icons: Record<TipoAntecedente, string> = {
    personal: 'mdi-account',
    familiar: 'mdi-account-multiple',
    medicamento: 'mdi-pill',
    habito: 'mdi-heart-pulse',
    alergia: 'mdi-alert-circle'
  };
  return icons[tipo];
};

const getColorByType = (tipo: TipoFiltro): string => {
  if (tipo === 'all') return '#9E9E9E';
  
  const colors: Record<TipoAntecedente, string> = {
    personal: '#2196F3', // blue
    familiar: '#4CAF50', // green
    medicamento: '#F44336', // red
    habito: '#FF9800', // orange
    alergia: '#9C27B0'  // purple
  };
  return colors[tipo];
};

// Efectos
watch(selectedFilter, (newFilter) => {
  if (newFilter === 'all') {
    fetchAntecedentes();
  } else {
    fetchAntecedentes(newFilter as TipoAntecedente);
  }
  emit('filter-change', newFilter === 'all' ? null : newFilter);
});

watch(searchQuery, (newQuery) => {
  if (newQuery) {
    searchAntecedentes(newQuery);
  } else {
    if (selectedFilter.value === 'all') {
      fetchAntecedentes();
    } else {
      fetchAntecedentes(selectedFilter.value as TipoAntecedente);
    }
  }
  emit('search', newQuery);
});

onMounted(async () => {
  // Establecer filtro inicial si se proporciona
  if (props.initialFilter) {
    selectedFilter.value = props.initialFilter;
  }
  
  // Cargar datos iniciales
  await Promise.all([
    fetchAntecedentes(props.initialFilter === 'all' || !props.initialFilter ? undefined : props.initialFilter),
    fetchResumen()
  ]);
});
</script>

<style scoped>
.antecedent-list-container {
  display: flex;
  flex-direction: column;
  min-height: 500px;
}

.filters-section {
  background-color: rgb(var(--v-theme-surface));
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
}

.content-section {
  flex: 1;
  background-color: rgb(var(--v-theme-background));
}

.type-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.type-filters .v-chip {
  transition: all 0.2s ease;
}

.type-filters .v-chip.active {
  transform: translateY(-2px);
}

.search-bar {
  max-width: 500px;
}

.summary-section {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.antecedentes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.antecedent-item {
  transition: transform 0.2s ease;
}

.antecedent-item:hover {
  transform: translateY(-2px);
}

/* Transiciones */
.antecedent-list-move,
.antecedent-list-enter-active,
.antecedent-list-leave-active {
  transition: all 0.3s ease;
}

.antecedent-list-enter-from {
  opacity: 0;
  transform: translateY(30px);
}

.antecedent-list-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

/* Asegurar que las transiciones no afecten el layout */
.antecedent-list-leave-active {
  position: absolute;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
}

.error-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
}
</style>