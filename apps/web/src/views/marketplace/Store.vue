<template>
  <div class="container mx-auto px-4 py-8">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900 mb-2">Marketplace de Módulos</h1>
      <p class="text-gray-600">
        Potencia tu práctica médica con módulos add-on. Activa y desactiva según tus necesidades.
      </p>
    </div>

    <!-- Current Plan Alert -->
    <div v-if="currentPlan" class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <v-icon icon="mdi-information-circle" size="24" class="text-blue-600"></v-icon>
          <div>
            <p class="text-sm font-medium text-blue-900">
              Plan actual: <span class="font-bold">{{ currentPlan.plan }}</span>
            </p>
            <p class="text-xs text-blue-700 mt-1">
              {{ getPlanModuleMessage(currentPlan.plan) }}
            </p>
          </div>
        </div>
        <router-link
          to="/plan-management"
          class="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          Gestionar plan →
        </router-link>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <v-icon icon="mdi-loading" size="48" class="animate-spin text-blue-600"></v-icon>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4">
      <div class="flex items-start space-x-3">
        <v-icon icon="mdi-alert-circle" size="24" class="text-red-600 mt-0.5"></v-icon>
        <div>
          <h3 class="text-sm font-medium text-red-900">Error al cargar módulos</h3>
          <p class="text-xs text-red-700 mt-1">{{ error }}</p>
        </div>
      </div>
    </div>

    <!-- Modules Grid -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <ModuleCard
        v-for="moduleData in modulesWithStatus"
        :key="moduleData.module.id"
        :module="moduleData.module"
        :activation-status="moduleData.status"
        @activate="handleActivate"
        @deactivate="handleDeactivate"
      />
    </div>

    <!-- Empty State -->
    <div v-if="!loading && modulesWithStatus.length === 0" class="text-center py-12">
      <v-icon icon="mdi-store-outline" size="64" class="text-gray-400 mb-4"></v-icon>
      <h3 class="text-lg font-medium text-gray-900 mb-2">No hay módulos disponibles</h3>
      <p class="text-gray-600">Vuelve pronto para ver nuevos módulos.</p>
    </div>

    <!-- Toast Notification -->
    <div
      v-if="notification.show"
      class="fixed bottom-4 right-4 z-50 animate-fade-in"
    >
      <div
        class="rounded-lg shadow-lg p-4 flex items-center space-x-3"
        :class="notification.type === 'success' ? 'bg-green-600' : 'bg-red-600'"
      >
        <v-icon
          :icon="notification.type === 'success' ? 'mdi-check-circle' : 'mdi-alert-circle'"
          size="24"
          class="text-white"
        ></v-icon>
        <span class="text-white font-medium">{{ notification.message }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import ModuleCard from '@/components/marketplace/ModuleCard.vue';
import { marketplaceService, type MarketplaceModule, type ModuleActivationStatus } from '@/services/marketplace';
import { usePlanStore } from '@/stores/plan';

interface ModuleWithStatus {
  module: MarketplaceModule;
  status: ModuleActivationStatus;
}

const planStore = usePlanStore();

const modules = ref<MarketplaceModule[]>([]);
const activationStatuses = ref<ModuleActivationStatus[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const notification = ref<{ show: boolean; type: 'success' | 'error'; message: string }>({
  show: false,
  type: 'success',
  message: ''
});

const currentPlan = computed(() => planStore.currentPlan);

const modulesWithStatus = computed<ModuleWithStatus[]>(() => {
  return modules.value.map(module => {
    const status = activationStatuses.value.find(s => s.moduleId === module.id);
    return {
      module,
      status: status || {
        moduleId: module.id,
        active: false,
        canActivate: false,
        activationBlockedReason: 'No disponible'
      }
    };
  });
});

onMounted(async () => {
  await loadMarketplaceData();
});

const loadMarketplaceData = async () => {
  try {
    loading.value = true;
    error.value = null;

    // Load current plan
    await planStore.getCurrentPlan();

    // Load modules and activation status in parallel
    const [modulesData, statusData] = await Promise.all([
      marketplaceService.getAllModules(),
      marketplaceService.getActivationStatus()
    ]);

    modules.value = modulesData;
    activationStatuses.value = statusData;
  } catch (err: any) {
    console.error('Error loading marketplace data:', err);
    error.value = err.message || 'Error al cargar los módulos';
  } finally {
    loading.value = false;
  }
};

const handleActivate = async (moduleId: string) => {
  try {
    const result = await marketplaceService.activateModule(moduleId as any);

    if (result.success) {
      showNotification('success', result.message);
      await loadMarketplaceData(); // Reload to update status
    } else {
      showNotification('error', result.message);
    }
  } catch (err: any) {
    console.error('Error activating module:', err);
    showNotification('error', err.message || 'Error al activar el módulo');
  }
};

const handleDeactivate = async (moduleId: string) => {
  try {
    const result = await marketplaceService.deactivateModule(moduleId as any);

    if (result.success) {
      showNotification('success', result.message);
      await loadMarketplaceData(); // Reload to update status
    } else {
      showNotification('error', result.message);
    }
  } catch (err: any) {
    console.error('Error deactivating module:', err);
    showNotification('error', err.message || 'Error al desactivar el módulo');
  }
};

const showNotification = (type: 'success' | 'error', message: string) => {
  notification.value = { show: true, type, message };
  setTimeout(() => {
    notification.value.show = false;
  }, 3000);
};

const getPlanModuleMessage = (plan: string): string => {
  const messages: Record<string, string> = {
    FREE: 'Actualiza a PREMIUM para acceder a todos los módulos',
    PREMIUM: 'Tienes acceso a todos los módulos disponibles',
    CLINICA_SME: 'Tienes acceso a todos los módulos disponibles'
  };
  return messages[plan] || '';
};
</script>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
