<template>
  <v-chip
    :color="chipColor"
    :variant="variant"
    :size="size"
    :class="['ia-chip', `ia-chip-${tipo}`]"
    closable
    @click:close="emit('close')"
  >
    <v-icon :icon="icon" start class="mr-1" />
    <span class="ia-chip-text">{{ text }}</span>
    <span v-if="confidence !== undefined" class="ia-chip-confidence ml-2">
      {{ Math.round(confidence * 100) }}%
    </span>
  </v-chip>
</template>

<script setup lang="ts">
import { computed, defineProps, withDefaults, defineEmits } from 'vue';

/**
 * IA Copilot Chip Component
 *
 * Based on PRD - IA Copilot section
 * Colors indicate verification status:
 * - Azul (#1976D2): IA suggestion (needs verification)
 * - Verde (#43A047): Verified by human
 * - Amarillo (#F57C00): Requires attention
 * - Rojo (#C62828): Contradicts (needs attention)
 */

interface Props {
  tipo: 'azul' | 'verde' | 'amarillo' | 'rojo';
  text: string;
  confidence?: number;
  variant?: 'flat' | 'elevated' | 'tonal' | 'outlined';
  size?: 'x-small' | 'small' | 'default' | 'large';
}

const props = withDefaults(defineProps<Props>(), {
  confidence: undefined,
  variant: 'elevated',
  size: 'default'
});

const emit = defineEmits<{
  close: [];
}>();

const chipColor = computed(() => {
  switch (props.tipo) {
    case 'azul':
      return '#1976D2';
    case 'verde':
      return '#43A047';
    case 'amarillo':
      return '#F57C00';
    case 'rojo':
      return '#C62828';
    default:
      return 'grey';
  }
});

const icon = computed(() => {
  switch (props.tipo) {
    case 'azul':
      return 'mdi-robot';
    case 'verde':
      return 'mdi-check-circle';
    case 'amarillo':
      return 'mdi-alert-circle';
    case 'rojo':
      return 'mdi-alert-octagon';
    default:
      return 'mdi-help-circle';
  }
});
</script>

<style scoped>
.ia-chip {
  font-weight: 500;
}

.ia-chip-text {
  font-size: 0.875rem;
}

.ia-chip-confidence {
  font-size: 0.75rem;
  opacity: 0.9;
}
</style>
