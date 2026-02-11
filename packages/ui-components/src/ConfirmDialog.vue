<template>
  <v-dialog v-model="isOpen" :max-width="maxWidth" persistent>
    <v-card :title="title">
      <v-card-text>
        {{ message }}
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn
          :text="true"
          :color="cancelColor"
          @click="handleCancel"
        >
          {{ cancelText }}
        </v-btn>
        <v-btn
          :color="confirmColor"
          @click="handleConfirm"
        >
          {{ confirmText }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
interface Props {
  modelValue: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: string;
  cancelColor?: string;
  maxWidth?: string | number;
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Confirmar',
  confirmText: 'Confirmar',
  cancelText: 'Cancelar',
  confirmColor: 'primary',
  cancelColor: 'grey',
  maxWidth: 500,
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  confirm: [];
  cancel: [];
}>();

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

function handleConfirm() {
  emit('confirm');
  isOpen.value = false;
}

function handleCancel() {
  emit('cancel');
  isOpen.value = false;
}
</script>
