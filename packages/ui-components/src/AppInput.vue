<template>
  <v-text-field
    v-model="internalValue"
    :label="label"
    :placeholder="placeholder"
    :hint="hint"
    :persistent-hint="persistentHint"
    :error-messages="errorMessages"
    :disabled="disabled"
    :readonly="readonly"
    :loading="loading"
    :color="color"
    :variant="variant"
    :density="density"
    :type="type"
    :prepend-icon="prependIcon"
    :append-icon="appendIcon"
    :clearable="clearable"
    :rules="rules"
    :counter="counter"
    @click:append="emit('click:append')"
    @click:prepend="emit('click:prepend')"
    @click:clear="emit('click:clear')"
    @update:model-value="handleInput"
  >
    <template v-if="$slots.prepend" #prepend>
      <slot name="prepend" />
    </template>
    <template v-if="$slots.append" #append>
      <slot name="append" />
    </template>
  </v-text-field>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  modelValue: string | number;
  label?: string;
  placeholder?: string;
  hint?: string;
  persistentHint?: boolean;
  errorMessages?: string | string[];
  disabled?: boolean;
  readonly?: boolean;
  loading?: boolean;
  color?: string;
  variant?: 'filled' | 'outlined' | 'plain' | 'underlined';
  density?: 'compact' | 'comfortable' | 'default';
  type?: string;
  prependIcon?: string;
  appendIcon?: string;
  clearable?: boolean;
  rules?: ((value: string) => true | string)[];
  counter?: number;
}

const props = withDefaults(defineProps<Props>(), {
  persistentHint: false,
  disabled: false,
  readonly: false,
  loading: false,
  color: 'primary',
  variant: 'outlined',
  density: 'comfortable',
  type: 'text',
  clearable: false
});

const emit = defineEmits<{
  'update:modelValue': [value: string | number];
  'click:append': [];
  'click:prepend': [];
  'click:clear': [];
}>();

const internalValue = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

function handleInput(value: string | number) {
  emit('update:modelValue', value);
}
</script>
