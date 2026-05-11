<template>
  <div class="tools-panel">
    <!-- Herramientas Principales -->
    <div class="tools-section">
      <div class="tool-btn"
           v-for="tool in mainTools"
           :key="tool.id"
           @click="handleToolAction(tool.id)"
           :title="tool.tooltip">
        <v-icon :icon="tool.icon" :color="tool.color" />
        <span class="tool-label">{{ tool.label }}</span>
        <span class="tool-shortcut">{{ tool.shortcut }}</span>
      </div>
    </div>

    <v-divider />

    <!-- Herramientas Secundarias -->
    <div class="tools-section">
      <div class="tool-btn"
           v-for="tool in secondaryTools"
           :key="tool.id"
           @click="handleToolAction(tool.id)"
           :title="tool.tooltip">
        <v-icon :icon="tool.icon" size="small" />
        <span class="tool-label small">{{ tool.label }}</span>
      </div>
    </div>

    <v-divider />

    <!-- Estado de Consulta -->
    <div class="status-section">
      <div class="status-label">Estado</div>
      <v-select
        :model-value="estado"
        :items="estadosOptions"
        variant="outlined"
        density="compact"
        hide-details
        @update:model-value="$emit('cambiar-estado', $event)"
        class="status-select"
      >
        <template v-slot:prepend-inner>
          <v-icon :icon="getEstadoIcon(estado)" :color="getEstadoColor(estado)" size="small" />
        </template>
      </v-select>
    </div>

    <v-divider />

    <!-- Firma -->
    <div class="sign-section" v-if="!firmado">
      <v-btn
        color="primary"
        variant="tonal"
        block
        size="small"
        @click="$emit('firma')"
      >
        <v-icon icon="mdi-draw-pen" start />
        Firmar
      </v-btn>
    </div>

    <div class="sign-section" v-else>
      <v-chip color="success" size="small" block>
        <v-icon icon="mdi-check-circle" start />
        Firmada
      </v-chip>
      <div class="text-caption text-center text-grey-darken-1 mt-1">
        {{ formatFecha(fechaFirma) }}
      </div>
    </div>

    <v-divider />

    <!-- Atajos de Teclado -->
    <div class="shortcuts-section">
      <div class="section-header">
        <span class="text-caption font-weight-medium">Atajos</span>
      </div>
      <div class="shortcuts-list">
        <div
          v-for="(shortcut, index) in shortcutsList"
          :key="index"
          class="shortcut-item"
        >
          <span class="shortcut-action">{{ shortcut.action }}</span>
          <span class="shortcut-keys">{{ shortcut.keys }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

// Props
interface Props {
  estado?: string;
  firmado?: boolean;
  fechaFirma?: Date | string;
}

const props = withDefaults(defineProps<Props>(), {
  estado: 'pendiente',
  firmado: false
});

// Emits
const emit = defineEmits<{
  'ia-assistant': [];
  'receta': [];
  'documentos': [];
  'historial': [];
  'interconsulta': [];
  'cambiar-estado': [estado: string];
  'firma': [];
}>();

// Método para manejar acciones de herramientas
const handleToolAction = (toolId: string) => {
  switch (toolId) {
    case 'ia':
      emit('ia-assistant');
      break;
    case 'receta':
      emit('receta');
      break;
    case 'docs':
      emit('documentos');
      break;
    case 'historial':
      emit('historial');
      break;
    case 'interconsulta':
      emit('interconsulta');
      break;
  }
};

// Herramientas principales
const mainTools = [
  {
    id: 'ia',
    label: 'IA',
    icon: 'mdi-robot',
    color: 'purple',
    action: 'ia-assistant' as const,
    tooltip: 'Asistente IA (Ctrl+K)',
    shortcut: 'Ctrl+K'
  },
  {
    id: 'receta',
    label: 'Receta',
    icon: 'mdi-pill',
    color: 'primary',
    action: 'receta' as const,
    tooltip: 'Receta rápida (Ctrl+R)',
    shortcut: 'Ctrl+R'
  },
  {
    id: 'docs',
    label: 'Docs',
    icon: 'mdi-file-document-multiple',
    color: 'info',
    action: 'documentos' as const,
    tooltip: 'Documentos (Ctrl+D)',
    shortcut: 'Ctrl+D'
  }
];

// Herramientas secundarias
const secondaryTools = [
  {
    id: 'historial',
    label: 'Historial',
    icon: 'mdi-history',
    action: 'historial' as const,
    tooltip: 'Ver historial'
  },
  {
    id: 'interconsulta',
    label: 'Intercons.',
    icon: 'mdi-forum',
    action: 'interconsulta' as const,
    tooltip: 'Solicitar interconsulta'
  }
];

// Estados de consulta
const estadosOptions = [
  { title: 'Borrador', value: 'borrador' },
  { title: 'Triaje', value: 'triaje' },
  { title: 'Pendiente', value: 'pendiente' },
  { title: 'En Atención', value: 'en_atencion' },
  { title: 'Finalizada', value: 'finalizada' },
  { title: 'Interconsulta', value: 'interconsulta' }
];

// Lista de atajos
const shortcutsList = [
  { action: 'IA Assistant', keys: 'Ctrl+K' },
  { action: 'Receta', keys: 'Ctrl+R' },
  { action: 'Documentos', keys: 'Ctrl+D' },
  { action: 'Historial', keys: 'Ctrl+H' },
  { action: 'Guardar', keys: 'Ctrl+S' },
  { action: 'Sidebar', keys: 'Ctrl+B' }
] as const;

// Métodos
const getEstadoIcon = (estado: string): string => {
  const iconos: Record<string, string> = {
    borrador: 'mdi-file-document-outline',
    triaje: 'mdi-pulse',
    pendiente: 'mdi-clock-outline',
    en_atencion: 'mdi-doctor',
    finalizada: 'mdi-check-circle',
    interconsulta: 'mdi-forum'
  };
  return iconos[estado] || 'mdi-help-circle';
};

const getEstadoColor = (estado: string): string => {
  const colores: Record<string, string> = {
    borrador: 'grey',
    triaje: 'info',
    pendiente: 'warning',
    en_atencion: 'primary',
    finalizada: 'success',
    interconsulta: 'purple'
  };
  return colores[estado] || 'grey';
};

const formatFecha = (fecha?: Date | string): string => {
  if (!fecha) return '';
  return new Date(fecha).toLocaleDateString('es-EC', {
    day: 'numeric',
    month: 'short'
  });
};
</script>

<style scoped>
.tools-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0.5rem 0;
}

.tools-section {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.5rem 1rem;
}

.tool-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
  user-select: none;
}

.tool-btn:hover {
  background-color: #f5f5f5;
}

.tool-label {
  flex: 1;
  font-size: 0.75rem;
  font-weight: 500;
}

.tool-label.small {
  font-size: 0.7rem;
}

.tool-shortcut {
  font-size: 0.65rem;
  color: #999;
  font-family: monospace;
}

.status-section {
  padding: 0.5rem 1rem;
}

.status-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #666;
  margin-bottom: 0.25rem;
}

.status-select {
  font-size: 0.75rem;
}

.sign-section {
  padding: 0.5rem 1rem;
}

.shortcuts-section {
  flex: 1;
  padding: 0.5rem 1rem;
  overflow-y: auto;
}

.section-header {
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #e0e0e0;
  margin-bottom: 0.5rem;
}

.shortcuts-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.shortcut-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.7rem;
}

.shortcut-action {
  color: #666;
}

.shortcut-keys {
  font-family: monospace;
  font-size: 0.65rem;
  background-color: #f5f5f5;
  padding: 0.125rem 0.25rem;
  border-radius: 3px;
  color: #666;
}

/* Scrollbar */
:deep(.shortcuts-section)::-webkit-scrollbar {
  width: 3px;
}

:deep(.shortcuts-section)::-webkit-scrollbar-thumb {
  background-color: #ddd;
  border-radius: 3px;
}
</style>
