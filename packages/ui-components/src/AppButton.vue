<template>
  <v-btn
    :color="color"
    :variant="variant"
    :size="size"
    :loading="loading"
    :disabled="disabled"
    v-bind="$attrs"
    @click="handleClick"
  >
    <slot />
  </v-btn>
</template>

<script setup lang="ts">
interface Props {
  color?: string;
  variant?: 'text' | 'flat' | 'elevated' | 'tonal' | 'outlined' | 'plain';
  size?: 'x-small' | 'small' | 'default' | 'large' | 'x-large';
  loading?: boolean;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  color: 'primary',
  variant: 'elevated',
  size: 'default',
  loading: false,
  disabled: false,
});

const emit = defineEmits<{
  click: [event: MouseEvent];
}>();

function handleClick(event: MouseEvent) {
  if (!props.loading && !props.disabled) {
    emit('click', event);
  }
}
</script>
