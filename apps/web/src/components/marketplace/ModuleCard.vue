<template>
  <div
    class="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden border"
    :class="{ 'ring-2 ring-blue-500': module.popular, 'border-gray-200': !module.popular }"
  >
    <!-- Header with Icon and Badge -->
    <div class="p-6 border-b border-gray-100">
      <div class="flex items-start justify-between">
        <div class="flex items-center space-x-4">
          <div
            class="w-12 h-12 rounded-lg flex items-center justify-center"
            :class="getIconBackgroundClass(module.category)"
          >
            <v-icon :icon="module.icon" size="24" :color="getIconColor(module.category)"></v-icon>
          </div>
          <div>
            <h3 class="text-lg font-semibold text-gray-900">{{ module.name }}</h3>
            <div class="flex items-center space-x-2 mt-1">
              <span
                class="text-xs px-2 py-0.5 rounded-full font-medium"
                :class="getCategoryBadgeClass(module.category)"
              >
                {{ getCategoryLabel(module.category) }}
              </span>
              <span v-if="module.popular" class="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 font-medium">
                Popular
              </span>
            </div>
          </div>
        </div>
        <div class="text-right">
          <div class="text-2xl font-bold text-gray-900">${{ module.price }}</div>
          <div class="text-xs text-gray-500">/mes</div>
        </div>
      </div>
    </div>

    <!-- Description -->
    <div class="p-6">
      <p class="text-gray-600 text-sm mb-4">{{ module.description }}</p>

      <!-- Features -->
      <ul class="space-y-2 mb-4">
        <li
          v-for="(feature, index) in module.features"
          :key="index"
          class="flex items-start space-x-2 text-sm text-gray-700"
        >
          <v-icon icon="mdi-check" size="16" class="text-green-500 mt-0.5 flex-shrink-0"></v-icon>
          <span>{{ feature }}</span>
        </li>
      </ul>

      <!-- Plan Requirement -->
      <div
        v-if="!activationStatus.canActivate && !activationStatus.active"
        class="bg-red-50 border border-red-200 rounded-md p-3 mb-4"
      >
        <div class="flex items-start space-x-2">
          <v-icon icon="mdi-alert-circle" size="16" class="text-red-500 mt-0.5 flex-shrink-0"></v-icon>
          <p class="text-xs text-red-700">{{ activationStatus.activationBlockedReason }}</p>
        </div>
      </div>

      <!-- Active Status -->
      <div
        v-if="activationStatus.active"
        class="bg-green-50 border border-green-200 rounded-md p-3 mb-4"
      >
        <div class="flex items-center space-x-2">
          <v-icon icon="mdi-check-circle" size="16" class="text-green-500"></v-icon>
          <span class="text-sm font-medium text-green-700">Módulo activado</span>
        </div>
        <div v-if="activationStatus.activatedAt" class="text-xs text-green-600 mt-1">
          Activado el {{ formatDate(activationStatus.activatedAt) }}
        </div>
      </div>
    </div>

    <!-- Action Button -->
    <div class="p-6 border-t border-gray-100 bg-gray-50">
      <button
        v-if="!activationStatus.active"
        @click="handleActivate"
        :disabled="!activationStatus.canActivate || isLoading"
        class="w-full py-2.5 px-4 rounded-md font-medium transition-colors flex items-center justify-center space-x-2"
        :class="getButtonClass()"
      >
        <v-icon v-if="isLoading" icon="mdi-loading" size="18" class="animate-spin"></v-icon>
        <span v-else>
          {{ activationStatus.canActivate ? 'Activar módulo' : 'Plan requerido' }}
        </span>
      </button>

      <button
        v-else
        @click="handleDeactivate"
        :disabled="isLoading"
        class="w-full py-2.5 px-4 rounded-md font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors flex items-center justify-center space-x-2"
      >
        <v-icon v-if="isLoading" icon="mdi-loading" size="18" class="animate-spin"></v-icon>
        <span v-else>Desactivar módulo</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { MarketplaceModule, ModuleActivationStatus, ModuleCategory } from '@/services/marketplace';

interface Props {
  module: MarketplaceModule;
  activationStatus: ModuleActivationStatus;
}

const props = defineProps<Props>();

interface Emits {
  (e: 'activate', moduleId: string): void;
  (e: 'deactivate', moduleId: string): void;
}

const emit = defineEmits<Emits>();

const isLoading = ref(false);

const getCategoryLabel = (category: ModuleCategory): string => {
  const labels: Record<ModuleCategory, string> = {
    communication: 'Comunicación',
    ai: 'Inteligencia Artificial',
    video: 'Video',
    migration: 'Migración'
  };
  return labels[category];
};

const getIconBackgroundClass = (category: ModuleCategory): string => {
  const classes: Record<ModuleCategory, string> = {
    communication: 'bg-green-100',
    ai: 'bg-purple-100',
    video: 'bg-blue-100',
    migration: 'bg-orange-100'
  };
  return classes[category];
};

const getIconColor = (category: ModuleCategory): string => {
  const colors: Record<ModuleCategory, string> = {
    communication: '#16a34a',
    ai: '#9333ea',
    video: '#2563eb',
    migration: '#ea580c'
  };
  return colors[category];
};

const getCategoryBadgeClass = (category: ModuleCategory): string => {
  const classes: Record<ModuleCategory, string> = {
    communication: 'bg-green-100 text-green-800',
    ai: 'bg-purple-100 text-purple-800',
    video: 'bg-blue-100 text-blue-800',
    migration: 'bg-orange-100 text-orange-800'
  };
  return classes[category];
};

const getButtonClass = (): string => {
  if (!props.activationStatus.canActivate) {
    return 'bg-gray-200 text-gray-500 cursor-not-allowed';
  }
  return 'bg-blue-600 text-white hover:bg-blue-700';
};

const formatDate = (date: Date): string => {
  return new Date(date).toLocaleDateString('es-EC', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const handleActivate = async () => {
  if (!props.activationStatus.canActivate || isLoading.value) return;

  isLoading.value = true;
  try {
    emit('activate', props.module.id);
  } finally {
    isLoading.value = false;
  }
};

const handleDeactivate = async () => {
  if (isLoading.value) return;

  isLoading.value = true;
  try {
    emit('deactivate', props.module.id);
  } finally {
    isLoading.value = false;
  }
};
</script>
