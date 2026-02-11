<template>
  <v-select
    v-model="internalValue"
    :items="items"
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
    :item-title="itemTitle"
    :item-value="itemValue"
    :return-object="returnObject"
    :multiple="multiple"
    :chips="chips"
    :clearable="clearable"
    :rules="rules"
    @update:model-value="handleInput"
  >
    <template v-if="$slots.prepend" #prepend>
      <slot name="prepend" />
    </template>
    <template v-if="$slots.append" #append>
      <slot name="append" />
    </template>
    <template v-if="$slots.item" #item="{ item, props }">
      <slot name="item" :item="item" :props="props" />
    </template>
    <template v-if="$slots.selection" #selection="{ item }">
      <slot name="selection" :item="item" />
    </template>
  </v-select>
</template>

<script setup lang="ts">
interface Props {
  modelValue: unknown;
  items: unknown[];
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
  itemTitle?: string;
  itemValue?: string;
  returnObject?: boolean;
  multiple?: boolean;
  chips?: boolean;
  clearable?: boolean;
  rules?: ((value: unknown) => true | string)[];
}

const props = withDefaults(defineProps<Props>(), {
  persistentHint: false,
  disabled: false,
  readonly: false,
  loading: false,
  color: 'primary',
  variant: 'outlined',
  density: 'comfortable',
  itemTitle: 'title',
  itemValue: 'value',
  returnObject: false,
  multiple: false,
  chips: false,
  clearable: false
});

const emit = defineEmits<{
  'update:modelValue': [value: unknown];
}>();

const internalValue = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

function handleInput(value: unknown) {
  emit('update:modelValue', value);
}
</script>
