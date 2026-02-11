<template>
  <v-badge
    :color="statusColor"
    :content="text"
    :inline="inline"
    :dot="dot"
    :mode="mode"
  >
    <slot />
  </v-badge>
</template>

<script setup lang="ts">
/**
 * Status Badge Component
 *
 * Common statuses for Galeno:
 * - Pendiente (warning)
 * - Confirmada (success)
 * - Completada (info)
 * - Cancelada (error)
 */

interface Props {
  status: 'pendiente' | 'confirmada' | 'completada' | 'cancelada' | 'en_progreso' | 'no_presento';
  text?: string;
  inline?: boolean;
  dot?: boolean;
  mode?: 'basic' | 'comfortable' | 'elegant';
}

const props = withDefaults(defineProps<Props>(), {
  inline: false,
  dot: false,
  mode: 'comfortable'
});

const statusColor = computed(() => {
  switch (props.status) {
    case 'pendiente':
      return 'warning';
    case 'confirmada':
      return 'success';
    case 'completada':
      return 'info';
    case 'cancelada':
      return 'error';
    case 'en_progreso':
      return 'primary';
    case 'no_presento':
      return 'grey';
    default:
      return 'grey';
  }
});
</script>
