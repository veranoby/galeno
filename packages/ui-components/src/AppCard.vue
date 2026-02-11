<template>
  <v-card
    :elevation="elevation"
    :rounded="rounded"
    :color="color"
    :variant="variant"
    :loading="loading"
    :disabled="disabled"
  >
    <!-- Card Header -->
    <v-card-title v-if="title || $slots.title" class="d-flex align-center">
      <slot name="title-icon">
        <v-icon v-if="titleIcon" :icon="titleIcon" class="mr-2" />
      </slot>
      <slot name="title">
        {{ title }}
      </slot>
      <v-spacer />
      <slot name="title-actions" />
    </v-card-title>

    <!-- Card Subtitle -->
    <v-card-subtitle v-if="subtitle || $slots.subtitle">
      <slot name="subtitle">
        {{ subtitle }}
      </slot>
    </v-card-subtitle>

    <!-- Card Content -->
    <v-card-text :class="textClass">
      <slot />
    </v-card-text>

    <!-- Card Actions -->
    <v-card-actions v-if="$slots.actions">
      <slot name="actions" />
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
interface Props {
  title?: string;
  subtitle?: string;
  titleIcon?: string;
  color?: string;
  elevation?: number | string;
  rounded?: string | number;
  variant?: 'flat' | 'elevated' | 'tonal' | 'outlined' | 'text' | 'plain';
  loading?: boolean;
  disabled?: boolean;
  textClass?: string;
}

withDefaults(defineProps<Props>(), {
  elevation: 2,
  rounded: 'lg',
  variant: 'elevated',
  loading: false,
  disabled: false,
  textClass: 'pa-4'
});
</script>
