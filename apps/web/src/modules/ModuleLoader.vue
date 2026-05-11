<!-- apps/web/src/modules/ModuleLoader.vue -->
<template>
  <div v-if="error" class="module-error">
    <v-alert type="error" :text="error" />
  </div>
  <component
    v-else-if="moduleComponent"
    :is="moduleComponent"
    :context="moduleContext"
    :emit-event="handleModuleEvent"
  />
  <div v-else class="module-loading">
    <v-progress-circular indeterminate />
    <p class="mt-4">{{ $t('modules.loading') || 'Cargando módulo...' }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { moduleRegistry } from './registry';
import type { ModuleContext, ModuleEvent } from '@/types/module';

interface Props {
  moduleId: string;
  context: ModuleContext;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'event', event: ModuleEvent): void;
  (e: 'loaded'): void;
  (e: 'error', error: Error): void;
}>();

const error = ref<string | null>(null);
const moduleComponent = computed(() => {
  return moduleRegistry.getComponent(props.moduleId);
});

const moduleContext = computed(() => props.context);

// Verificar que el módulo existe
watch(() => props.moduleId, (moduleId) => {
  error.value = null;

  if (!moduleRegistry.hasModule(moduleId)) {
    error.value = `Módulo no encontrado: ${moduleId}`;
    emit('error', new Error(error.value));
    return;
  }

  emit('loaded');
}, { immediate: true });

/**
 * Maneja los eventos emitidos por el módulo
 */
function handleModuleEvent(event: ModuleEvent): void {
  emit('event', event);
}

onMounted(() => {
  console.debug(`[ModuleLoader] Loading module: ${props.moduleId}`);
});

onUnmounted(() => {
  console.debug(`[ModuleLoader] Unloading module: ${props.moduleId}`);
});
</script>

<style scoped>
.module-error {
  padding: 1rem;
}

.module-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
}
</style>
