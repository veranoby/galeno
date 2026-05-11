<template>
  <div class="container mx-auto px-4 py-8">
    <h1 class="text-3xl font-bold mb-6">Gestión de Plan</h1>
    
    <!-- Current Plan Card -->
    <div class="bg-white rounded-lg shadow-md p-6 mb-8">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-semibold">Tu Plan Actual</h2>
        <span 
          class="px-3 py-1 rounded-full text-sm font-medium"
          :class="getPlanBadgeClass(currentPlan?.plan)"
        >
          {{ currentPlan?.plan }}
        </span>
      </div>
      
      <div v-if="currentPlan" class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="border rounded-lg p-4">
          <h3 class="font-medium text-gray-700 mb-2">Doctores</h3>
          <div class="text-2xl font-bold">{{ currentPlan.usage.doctors.current }} / {{ currentPlan.usage.doctors.limit }}</div>
          <div class="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div 
              class="bg-blue-600 h-2 rounded-full" 
              :style="{ width: `${Math.min(100, (currentPlan.usage.doctors.current / currentPlan.usage.doctors.limit) * 100)}%` }"
            ></div>
          </div>
        </div>
        
        <div class="border rounded-lg p-4">
          <h3 class="font-medium text-gray-700 mb-2">Asistentes</h3>
          <div class="text-2xl font-bold">{{ currentPlan.usage.assistants.current }} / {{ currentPlan.usage.assistants.limit }}</div>
          <div class="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div 
              class="bg-green-600 h-2 rounded-full" 
              :style="{ width: `${Math.min(100, (currentPlan.usage.assistants.current / currentPlan.usage.assistants.limit) * 100)}%` }"
            ></div>
          </div>
        </div>
        
        <div class="border rounded-lg p-4">
          <h3 class="font-medium text-gray-700 mb-2">Almacenamiento</h3>
          <div class="text-2xl font-bold">{{ currentPlan.usage.storage.usedMB }} / {{ currentPlan.usage.storage.limitMB }} MB</div>
          <div class="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div 
              class="bg-purple-600 h-2 rounded-full" 
              :style="{ width: `${Math.min(100, currentPlan.usage.storage.percentageUsed)}%` }"
            ></div>
          </div>
        </div>
      </div>
      
      <div v-else class="text-gray-500">Cargando información del plan...</div>
    </div>
    
    <!-- Available Plans -->
    <div class="bg-white rounded-lg shadow-md p-6">
      <h2 class="text-xl font-semibold mb-4">Planes Disponibles</h2>
      
      <div v-if="availablePlans.length > 0" class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div 
          v-for="plan in availablePlans" 
          :key="plan.plan"
          class="border rounded-lg p-6 hover:shadow-lg transition-shadow"
          :class="{ 'ring-2 ring-blue-500': plan.plan === currentPlan?.plan }"
        >
          <h3 class="text-lg font-semibold mb-2">{{ plan.plan }}</h3>
          <p class="text-gray-600 mb-4">{{ plan.descripcion }}</p>
          
          <div class="mb-4">
            <div class="flex justify-between mb-1">
              <span class="text-sm">Doctores:</span>
              <span class="text-sm font-medium">{{ plan.limites.maxDoctores }}</span>
            </div>
            <div class="flex justify-between mb-1">
              <span class="text-sm">Asistentes:</span>
              <span class="text-sm font-medium">{{ plan.limites.maxAsistentes }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm">Almacenamiento:</span>
              <span class="text-sm font-medium">{{ plan.limites.maxAlmacenamientoMB }} MB</span>
            </div>
          </div>
          
          <button 
            @click="confirmChangePlan(plan.plan)"
            :disabled="plan.plan === currentPlan?.plan"
            class="w-full py-2 px-4 rounded-md font-medium"
            :class="plan.plan === currentPlan?.plan 
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
              : 'bg-blue-600 text-white hover:bg-blue-700'"
          >
            {{ plan.plan === currentPlan?.plan ? 'Plan Actual' : 'Cambiar a este plan' }}
          </button>
        </div>
      </div>
      
      <div v-else class="text-gray-500">Cargando planes disponibles...</div>
    </div>
    
    <!-- Plan Change Confirmation Modal -->
    <div v-if="showConfirmationModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 class="text-lg font-semibold mb-4">Confirmar Cambio de Plan</h3>
        
        <p class="mb-4">
          ¿Estás seguro de que deseas cambiar de <strong>{{ currentPlan?.plan }}</strong> a <strong>{{ selectedPlan }}</strong>?
        </p>
        
        <div v-if="isDowngrade" class="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
          <p><strong>Advertencia:</strong> Este es un cambio de categoría inferior. Asegúrate de que tu uso actual no exceda los límites del nuevo plan.</p>
        </div>
        
        <div class="flex justify-end space-x-3">
          <button 
            @click="showConfirmationModal = false"
            class="px-4 py-2 border border-gray-300 rounded-md"
          >
            Cancelar
          </button>
          <button 
            @click="changePlan"
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Confirmar Cambio
          </button>
        </div>
      </div>
    </div>
    
    <!-- Custom Limits Modal for CLINICA_SME -->
    <div v-if="showCustomLimitsModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 class="text-lg font-semibold mb-4">Configurar Límites Personalizados</h3>
        
        <p class="mb-4">Ingresa los límites personalizados para tu plan CLINICA_SME:</p>
        
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1">Máximo de Doctores</label>
            <input 
              v-model="customLimits.maxDoctores"
              type="number"
              min="1"
              class="w-full p-2 border rounded-md"
              placeholder="Número de doctores"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-1">Máximo de Asistentes</label>
            <input 
              v-model="customLimits.maxAsistentes"
              type="number"
              min="0"
              class="w-full p-2 border rounded-md"
              placeholder="Número de asistentes"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-1">Máximo de Almacenamiento (MB)</label>
            <input 
              v-model="customLimits.maxAlmacenamientoMB"
              type="number"
              min="0"
              class="w-full p-2 border rounded-md"
              placeholder="Capacidad en MB"
            />
          </div>
        </div>
        
        <div class="flex justify-end space-x-3 mt-6">
          <button 
            @click="showCustomLimitsModal = false"
            class="px-4 py-2 border border-gray-300 rounded-md"
          >
            Cancelar
          </button>
          <button 
            @click="confirmChangePlan(selectedPlan)"
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { usePlanStore } from '@/stores/plan';
import { useAuthStore } from '@/stores/auth';

const planStore = usePlanStore();
const authStore = useAuthStore();

const currentPlan = ref<any>(null);
const availablePlans = ref<any[]>([]);
const showConfirmationModal = ref(false);
const showCustomLimitsModal = ref(false);
const selectedPlan = ref('');
const customLimits = ref({
  maxDoctores: 0,
  maxAsistentes: 0,
  maxAlmacenamientoMB: 0
});

const isDowngrade = computed(() => {
  if (!currentPlan.value || !selectedPlan.value) return false;
  
  const planPriority: Record<string, number> = {
    'FREE': 1,
    'PREMIUM': 2,
    'CLINICA_SME': 3
  };
  
  return planPriority[currentPlan.value.plan] > planPriority[selectedPlan.value];
});

onMounted(async () => {
  await loadPlanData();
});

const loadPlanData = async () => {
  try {
    currentPlan.value = await planStore.getCurrentPlan();
    availablePlans.value = ((await planStore.getAvailablePlans()) as any).plans;
  } catch (error) {
    console.error('Error loading plan data:', error);
  }
};

const getPlanBadgeClass = (plan: string) => {
  switch (plan) {
    case 'FREE':
      return 'bg-gray-100 text-gray-800';
    case 'PREMIUM':
      return 'bg-blue-100 text-blue-800';
    case 'CLINICA_SME':
      return 'bg-purple-100 text-purple-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const confirmChangePlan = async (plan: string) => {
  selectedPlan.value = plan;
  
  // If changing to CLINICA_SME, show custom limits modal first
  if (plan === 'CLINICA_SME') {
    showCustomLimitsModal.value = true;
  } else {
    showConfirmationModal.value = true;
  }
};

const changePlan = async () => {
  try {
    const payload: any = {
      plan: selectedPlan.value
    };
    
    // Add custom limits if changing to CLINICA_SME
    if (selectedPlan.value === 'CLINICA_SME') {
      payload.customLimits = customLimits.value;
    }
    
    const result = (await planStore.changePlan(payload)) as any;
    
    // Show success message
    alert(result.message || `Plan cambiado exitosamente a ${selectedPlan.value}`);
    
    // Reload plan data
    await loadPlanData();
    
    // Close modals
    showConfirmationModal.value = false;
    showCustomLimitsModal.value = false;
  } catch (error: any) {
    console.error('Error changing plan:', error);
    alert(error.message || 'Error al cambiar el plan. Por favor inténtalo de nuevo.');
  }
};
</script>