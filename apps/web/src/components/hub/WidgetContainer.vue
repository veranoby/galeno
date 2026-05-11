<!-- apps/web/src/components/hub/WidgetContainer.vue -->
<template>
  <v-card
    class="widget-container"
    :class="{ 'compact': compactMode, 'dragging': isDragging }"
    variant="outlined"
    rounded="lg"
  >
    <!-- Widget Header (Drag Handle) -->
    <div class="widget-header" :class="{ 'drag-handle': draggable }">
      <div class="widget-title">
        <v-icon v-if="draggable" start color="grey" class="drag-icon">
          mdi-drag
        </v-icon>
        <v-icon :color="widget.color || 'primary'">
          {{ widgetIcon }}
        </v-icon>
        <span class="font-weight-bold">{{ widget.title }}</span>
      </div>

      <div class="widget-actions">
        <v-btn
          icon
          size="small"
          variant="text"
          @click="$emit('refresh')"
        >
          <v-icon>mdi-refresh</v-icon>
        </v-btn>
        <v-menu>
          <template v-slot:activator="{ props }">
            <v-btn
              icon
              size="small"
              variant="text"
              v-bind="props"
            >
              <v-icon>mdi-dots-vertical</v-icon>
            </v-btn>
          </template>
          <v-list>
            <v-list-item @click="$emit('toggle-visibility')">
              <v-list-item-title>
                {{ visible ? 'Ocultar' : 'Mostrar' }}
              </v-list-item-title>
            </v-list-item>
            <v-list-item @click="$emit('settings')">
              <v-list-item-title>Configuración</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </div>
    </div>

    <!-- Widget Content -->
    <div class="widget-content">
      <slot />
    </div>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useHub } from '@/composables/useHub';

interface Widget {
  id: string;
  type: string;
  title: string;
  color?: string;
  visible: boolean;
}

interface Props {
  widget: Widget;
  draggable?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  draggable: true
});

const emit = defineEmits<{
  (e: 'refresh'): void;
  (e: 'toggle-visibility'): void;
  (e: 'settings'): void;
  (e: 'update', value: { x: number; y: number }): void;
}>();

const { compactMode } = useHub();

const widgetIcon = computed(() => {
  const icons: Record<string, string> = {
    appointments: 'mdi-calendar',
    patients: 'mdi-account-group',
    consultas: 'mdi-file-document',
    notifications: 'mdi-bell',
    stats: 'mdi-chart-bar',
    quickactions: 'mdi-lightning-bolt'
  };
  return icons[props.widget.type] || 'mdi-widgets';
});

const isDragging = ref(false);
</script>

<style scoped lang="scss">
.widget-container {
  height: 100%;
  transition: all 0.3s ease;

  &.compact {
    .widget-header {
      padding: 8px 12px;
    }

    .widget-content {
      padding: 12px;
    }
  }

  &.dragging {
    opacity: 0.5;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  }
}

.widget-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #e0e0e0;

  &.drag-handle {
    cursor: move;
  }

  .drag-icon {
    cursor: move;
  }
}

.widget-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.widget-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.widget-content {
  padding: 16px;
}
</style>
