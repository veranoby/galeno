<template>
  <v-card 
    :class="['antecedent-card', `type-${antecedente.tipo}`, { compact }]" 
    variant="outlined"
    rounded="lg"
    :aria-label="getAriaLabel(antecedente)"
    role="article"
    tabindex="0"
  >
    <!-- Header con tipo y categoría -->
    <v-card-title class="pa-3 pb-2">
      <div class="d-flex align-center justify-space-between w-100">
        <div class="d-flex align-center">
          <v-icon 
            :icon="getIconByType(antecedente.tipo)" 
            :color="getColorByType(antecedente.tipo)"
            size="large"
            class="mr-2"
            aria-hidden="true"
          />
          <div>
            <span class="text-h6 font-weight-bold">{{ getTipoLabel(antecedente.tipo) }}</span>
            <span 
              v-if="antecedente.categoria" 
              class="text-caption ml-2 px-2 py-1 rounded"
              :style="{ backgroundColor: getCategoryColor(antecedente.tipo, antecedente.categoria) + '20' }"
              :aria-label="`Categoría: ${capitalize(antecedente.categoria)}`"
            >
              {{ capitalize(antecedente.categoria) }}
            </span>
          </div>
        </div>
        
        <!-- Grado para tipos específicos -->
        <div 
          v-if="showGrado(antecedente.tipo) && antecedente.grado" 
          class="text-caption font-weight-medium"
          :style="{ color: getGradoColor(antecedente.tipo) }"
          :aria-label="`${getGradoLabel(antecedente.tipo)}: ${antecedente.grado}`"
        >
          {{ getGradoLabel(antecedente.tipo) }}: {{ antecedente.grado }}
        </div>
      </div>
    </v-card-title>

    <!-- Contenido principal -->
    <v-card-text class="pa-3 pt-0">
      <p 
        class="text-body-1 mb-2"
        :class="{ 'text--secondary': compact }"
        :aria-label="`Detalle: ${antecedente.detalle}`"
      >
        {{ antecedente.detalle }}
      </p>

      <!-- Metadatos (ocultos en vista compacta) -->
      <div 
        v-if="!compact" 
        class="metadata mt-2 d-flex flex-wrap gap-3 text-caption text-medium-emphasis"
        role="region"
        aria-label="Información adicional"
      >
        <div class="d-flex align-center" role="listitem">
          <v-icon icon="mdi-calendar" size="small" class="mr-1" aria-hidden="true" />
          <time :datetime="formatDateISO(antecedente.fechaRegistro)" :aria-label="`Fecha de registro: ${formatDate(antecedente.fechaRegistro)}`">
            {{ formatDate(antecedente.fechaRegistro) }}
          </time>
        </div>
        
        <div class="d-flex align-center" role="listitem">
          <v-icon icon="mdi-account" size="small" class="mr-1" aria-hidden="true" />
          <span :aria-label="`Registrado por: ${getRegistradoPorLabel(antecedente.registradoPor)}`">{{ getRegistradoPorLabel(antecedente.registradoPor) }}</span>
        </div>
      </div>
    </v-card-text>

    <!-- Acciones -->
    <v-card-actions v-if="showActions" class="pa-3 pt-0">
      <v-spacer />
      
      <v-btn
        v-if="editable"
        icon
        variant="text"
        size="small"
        :aria-label="`Editar antecedente ${getTipoLabel(antecedente.tipo)}`"
        @click="handleEdit"
        :title="`Editar antecedente ${getTipoLabel(antecedente.tipo)}`"
      >
        <v-icon>mdi-pencil</v-icon>
      </v-btn>
      
      <v-btn
        icon
        variant="text"
        size="small"
        :aria-label="`Eliminar antecedente ${getTipoLabel(antecedente.tipo)}`"
        @click="handleDelete"
        :title="`Eliminar antecedente ${getTipoLabel(antecedente.tipo)}`"
      >
        <v-icon>mdi-delete</v-icon>
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import { type PropType } from 'vue';
import type { Antecedente, TipoAntecedente, RegistradoPor } from '@/composables/useAntecedents';

// Props
interface Props {
  antecedente: Antecedente;
  compact?: boolean;
  showActions?: boolean;
  editable?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  compact: false,
  showActions: true,
  editable: true
});

// Emits
const emit = defineEmits<{
  edit: [antecedente: Antecedente];
  delete: [id: string];
}>();

// Métodos
const handleEdit = () => {
  emit('edit', props.antecedente);
};

const handleDelete = () => {
  emit('delete', props.antecedente.id);
};

// Funciones auxiliares
const getTipoLabel = (tipo: TipoAntecedente): string => {
  const labels: Record<TipoAntecedente, string> = {
    personal: 'Personal',
    familiar: 'Familiar',
    medicamento: 'Medicamento',
    habito: 'Hábito',
    alergia: 'Alergia'
  };
  return labels[tipo];
};

const getIconByType = (tipo: TipoAntecedente): string => {
  const icons: Record<TipoAntecedente, string> = {
    personal: 'mdi-account',
    familiar: 'mdi-account-multiple',
    medicamento: 'mdi-pill',
    habito: 'mdi-heart-pulse',
    alergia: 'mdi-alert-circle'
  };
  return icons[tipo];
};

const getColorByType = (tipo: TipoAntecedente): string => {
  const colors: Record<TipoAntecedente, string> = {
    personal: '#2196F3', // blue
    familiar: '#4CAF50', // green
    medicamento: '#F44336', // red
    habito: '#FF9800', // orange
    alergia: '#9C27B0'  // purple
  };
  return colors[tipo];
};

const getCategoryColor = (tipo: TipoAntecedente, categoria: string): string => {
  const colors: Record<TipoAntecedente, Record<string, string>> = {
    personal: {
      patológico: '#2196F3',
      quirúrgico: '#3F51B5',
      traumático: '#9C27B0',
      alérgico: '#E91E63',
      ginecoobstétrico: '#FF9800',
      otros: '#795548'
    },
    familiar: {
      padre: '#4CAF50',
      madre: '#E91E63',
      hermanos: '#FF9800',
      abuelos: '#9C27B0',
      tíos: '#607D8B',
      otros: '#795548'
    },
    medicamento: {
      actual: '#4CAF50',
      previo: '#9E9E9E'
    },
    habito: {
      tabaco: '#795548',
      alcohol: '#FF5722',
      drogas: '#607D8B',
      cafeína: '#FF9800',
      ejercicio: '#4CAF50',
      dieta: '#8BC34A',
      sueño: '#3F51B5',
      otros: '#9E9E9E'
    },
    alergia: {
      medicamento: '#F44336',
      alimento: '#FF9800',
      ambiente: '#4CAF50',
      otros: '#9E9E9E'
    }
  };
  
  return colors[tipo]?.[categoria] || '#9E9E9E';
};

const showGrado = (tipo: TipoAntecedente): boolean => {
  return tipo === 'familiar' || tipo === 'alergia';
};

const getGradoLabel = (tipo: TipoAntecedente): string => {
  if (tipo === 'familiar') return 'Parentesco';
  if (tipo === 'alergia') return 'Severidad';
  return 'Grado';
};

const getGradoColor = (tipo: TipoAntecedente): string => {
  if (tipo === 'familiar') return '#4CAF50'; // green
  if (tipo === 'alergia') return '#F44336'; // red
  return '#9E9E9E'; // gray
};

const getRegistradoPorLabel = (registradoPor: RegistradoPor): string => {
  const labels: Record<RegistradoPor, string> = {
    paciente: 'Paciente',
    enfermera: 'Enfermera',
    doctor: 'Doctor'
  };
  return labels[registradoPor];
};

const capitalize = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const getAriaLabel = (antecedente: Antecedente): string => {
  return `Antecedente ${getTipoLabel(antecedente.tipo)}: ${antecedente.detalle.substring(0, 50)}${antecedente.detalle.length > 50 ? '...' : ''}`;
};

const formatDateISO = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toISOString().split('T')[0];
};
</script>

<style scoped>
.antecedent-card {
  transition: all 0.2s ease-in-out;
  border-left-width: 4px;
  border-left-style: solid;
}

.type-personal {
  border-left-color: #2196F3;
}

.type-familiar {
  border-left-color: #4CAF50;
}

.type-medicamento {
  border-left-color: #F44336;
}

.type-habito {
  border-left-color: #FF9800;
}

.type-alergia {
  border-left-color: #9C27B0;
}

.compact .metadata {
  display: none;
}

.metadata .v-icon {
  opacity: 0.7;
}
</style>