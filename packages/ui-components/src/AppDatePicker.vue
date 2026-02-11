<template>
  <v-menu
    v-model="isOpen"
    :close-on-content-click="false"
    transition="scale-transition"
    offset-y
    min-width="auto"
  >
    <template #activator="{ props }">
      <v-text-field
        :model-value="formattedDate"
        :label="label"
        :hint="hint"
        :persistent-hint="persistentHint"
        :error-messages="errorMessages"
        :disabled="disabled"
        :readonly="readonly"
        :loading="loading"
        :color="color"
        :variant="variant"
        :density="density"
        :prepend-icon="prependIcon"
        :clearable="clearable"
        @click:clear="handleClear"
        v-bind="props"
      />
    </template>
    <v-date-picker
      :model-value="internalValue"
      :min="min"
      :max="max"
      :disabled="disabled"
      :color="color"
      @update:model-value="handleSelect"
    >
      <v-spacer />
      <v-btn variant="text" color="primary" @click="isOpen = false">
        Cancelar
      </v-btn>
      <v-btn variant="text" color="primary" @click="handleConfirm">
        Confirmar
      </v-btn>
    </v-date-picker>
  </v-menu>
</template>

<script setup lang="ts">
interface Props {
  modelValue: Date | string | null;
  label?: string;
  hint?: string;
  persistentHint?: boolean;
  errorMessages?: string | string[];
  disabled?: boolean;
  readonly?: boolean;
  loading?: boolean;
  color?: string;
  variant?: 'filled' | 'outlined' | 'plain' | 'underlined';
  density?: 'compact' | 'comfortable' | 'default';
  prependIcon?: string;
  clearable?: boolean;
  min?: string;
  max?: string;
  format?: 'short' | 'long' | 'full';
}

const props = withDefaults(defineProps<Props>(), {
  persistentHint: false,
  disabled: false,
  readonly: false,
  loading: false,
  color: 'primary',
  variant: 'outlined',
  density: 'comfortable',
  clearable: true,
  format: 'short'
});

const emit = defineEmits<{
  'update:modelValue': [value: Date | null];
}>();

const isOpen = ref(false);
const pendingValue = ref<Date | string | null>(props.modelValue);

const internalValue = computed({
  get: () => pendingValue.value ? new Date(pendingValue.value) : null,
  set: (value) => {
    pendingValue.value = value;
  }
});

const formattedDate = computed(() => {
  if (!props.modelValue) return '';
  const date = new Date(props.modelValue);
  if (isNaN(date.getTime())) return '';

  switch (props.format) {
    case 'short':
      return date.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });
    case 'long':
      return date.toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' });
    case 'full':
      return date.toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    default:
      return date.toLocaleDateString('es-EC');
  }
});

function handleSelect(value: Date | string | null) {
  pendingValue.value = value;
}

function handleConfirm() {
  emit('update:modelValue', pendingValue.value);
  isOpen.value = false;
}

function handleClear() {
  emit('update:modelValue', null);
}
</script>
