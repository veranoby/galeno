<template>
  <div class="container mx-auto px-4 py-8">
    <h1 class="text-3xl font-bold mb-6">Panel de Auditoría</h1>
    
    <!-- Filters Section -->
    <div class="bg-white rounded-lg shadow-md p-6 mb-8">
      <h2 class="text-xl font-semibold mb-4">Filtros de Búsqueda</h2>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Usuario</label>
          <input 
            v-model="filters.userId"
            type="text"
            placeholder="ID de usuario"
            class="w-full p-2 border rounded-md"
          />
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Acción</label>
          <select 
            v-model="filters.action"
            class="w-full p-2 border rounded-md"
          >
            <option value="">Todas las acciones</option>
            <option v-for="action in auditActions" :key="action" :value="action">
              {{ action }}
            </option>
          </select>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Tipo de Recurso</label>
          <select 
            v-model="filters.resourceType"
            class="w-full p-2 border rounded-md"
          >
            <option value="">Todos los tipos</option>
            <option v-for="type in resourceTypes" :key="type" :value="type">
              {{ type }}
            </option>
          </select>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Fecha Desde</label>
          <input 
            v-model="filters.startDate"
            type="date"
            class="w-full p-2 border rounded-md"
          />
        </div>
      </div>
      
      <div class="mt-4 flex space-x-3">
        <button 
          @click="applyFilters"
          class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Aplicar Filtros
        </button>
        <button 
          @click="resetFilters"
          class="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
        >
          Limpiar
        </button>
      </div>
    </div>
    
    <!-- Stats Summary -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div class="bg-white rounded-lg shadow-md p-6">
        <h3 class="text-lg font-medium text-gray-900">Total Eventos</h3>
        <p class="mt-2 text-3xl font-semibold text-blue-600">{{ summary.totalEvents }}</p>
      </div>
      
      <div class="bg-white rounded-lg shadow-md p-6">
        <h3 class="text-lg font-medium text-gray-900">Acciones Hoy</h3>
        <p class="mt-2 text-3xl font-semibold text-green-600">{{ summary.todayEvents }}</p>
      </div>
      
      <div class="bg-white rounded-lg shadow-md p-6">
        <h3 class="text-lg font-medium text-gray-900">Usuarios Activos</h3>
        <p class="mt-2 text-3xl font-semibold text-purple-600">{{ summary.activeUsers }}</p>
      </div>
      
      <div class="bg-white rounded-lg shadow-md p-6">
        <h3 class="text-lg font-medium text-gray-900">Alertas</h3>
        <p class="mt-2 text-3xl font-semibold text-red-600">{{ summary.alerts }}</p>
      </div>
    </div>
    
    <!-- Audit Logs Table -->
    <div class="bg-white rounded-lg shadow-md overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-200">
        <h2 class="text-xl font-semibold">Registros de Auditoría</h2>
      </div>
      
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fecha
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Usuario
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acción
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Recurso
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                IP
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Detalles
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="log in auditLogs" :key="log.id">
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ formatDate(log.timestamp) }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {{ log.userId }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                <span 
                  class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                  :class="getActionClass(log.action)"
                >
                  {{ log.action }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                <span v-if="log.resourceType">{{ log.resourceType }}:{{ log.resourceId }}</span>
                <span v-else>N/A</span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ log.ip || 'N/A' }}
              </td>
              <td class="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" :title="getMetadataString(log.metadata)">
                {{ getMetadataString(log.metadata) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <!-- Pagination -->
      <div class="px-6 py-4 bg-white border-t border-gray-200 flex items-center justify-between">
        <div class="text-sm text-gray-700">
          Mostrando <span class="font-medium">{{ currentPage * pageSize + 1 }}</span> a 
          <span class="font-medium">{{ Math.min((currentPage + 1) * pageSize, summary.totalEvents) }}</span> de 
          <span class="font-medium">{{ summary.totalEvents }}</span> resultados
        </div>
        <div class="flex space-x-2">
          <button
            @click="prevPage"
            :disabled="currentPage === 0"
            class="px-3 py-1 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Anterior
          </button>
          <button
            @click="nextPage"
            :disabled="(currentPage + 1) * pageSize >= summary.totalEvents"
            class="px-3 py-1 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useAuditStore } from '@/stores/audit';

// Define props and emits if needed
interface Props {
  // Define props here
}

interface Emits {
  // Define emits here
}

// Props and emits
// const props = defineProps<Props>();
// const emit = defineEmits<Emits>();

// Stores
const auditStore = useAuditStore();

// Reactive data
const auditLogs = ref<any[]>([]);
const currentPage = ref(0);
const pageSize = ref(20);
const summary = ref({
  totalEvents: 0,
  todayEvents: 0,
  activeUsers: 0,
  alerts: 0
});

const filters = ref({
  userId: '',
  action: '',
  resourceType: '',
  startDate: '',
  endDate: ''
});

const auditActions = ref([
  'LOGIN', 'LOGOUT', 'RESOURCE_ACCESS', 'RESOURCE_CREATE', 
  'RESOURCE_UPDATE', 'RESOURCE_DELETE', 'PERMISSION_CHANGE', 
  'ROLE_CHANGE', 'PLAN_CHANGE', 'PAYMENT_ACTION'
]);

const resourceTypes = ref([
  'PACIENTE', 'CONSULTA', 'DOCUMENTO', 'USUARIO', 'PLAN', 'PAGO'
]);

// Computed properties
const totalPages = computed(() => Math.ceil(summary.value.totalEvents / pageSize.value));

// Methods
const loadAuditLogs = async () => {
  try {
    const response = await auditStore.getAuditLogs({
      userId: filters.value.userId || undefined,
      action: filters.value.action || undefined,
      resourceType: filters.value.resourceType || undefined,
      startDate: filters.value.startDate || undefined,
      endDate: filters.value.endDate || undefined,
      limit: pageSize.value,
      offset: currentPage.value * pageSize.value
    }) as any;
    
    auditLogs.value = response.logs;
    summary.value.totalEvents = response.totalCount || response.logs.length;
  } catch (error) {
    console.error('Error loading audit logs:', error);
  }
};

const loadSummary = async () => {
  try {
    // In a real implementation, we would call an API to get summary data
    // For now, we'll simulate with sample data
    summary.value.todayEvents = 42;
    summary.value.activeUsers = 12;
    summary.value.alerts = 3;
  } catch (error) {
    console.error('Error loading summary:', error);
  }
};

const applyFilters = () => {
  currentPage.value = 0;
  loadAuditLogs();
};

const resetFilters = () => {
  filters.value = {
    userId: '',
    action: '',
    resourceType: '',
    startDate: '',
    endDate: ''
  };
  currentPage.value = 0;
  loadAuditLogs();
};

const nextPage = () => {
  if ((currentPage.value + 1) * pageSize.value < summary.value.totalEvents) {
    currentPage.value++;
    loadAuditLogs();
  }
};

const prevPage = () => {
  if (currentPage.value > 0) {
    currentPage.value--;
    loadAuditLogs();
  }
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleString();
};

const getActionClass = (action: string) => {
  const classes: Record<string, string> = {
    'LOGIN': 'bg-green-100 text-green-800',
    'LOGOUT': 'bg-blue-100 text-blue-800',
    'RESOURCE_ACCESS': 'bg-yellow-100 text-yellow-800',
    'RESOURCE_CREATE': 'bg-indigo-100 text-indigo-800',
    'RESOURCE_UPDATE': 'bg-purple-100 text-purple-800',
    'RESOURCE_DELETE': 'bg-red-100 text-red-800',
    'PERMISSION_CHANGE': 'bg-pink-100 text-pink-800',
    'PLAN_CHANGE': 'bg-teal-100 text-teal-800',
    'PAYMENT_ACTION': 'bg-orange-100 text-orange-800'
  };
  
  return classes[action] || 'bg-gray-100 text-gray-800';
};

const getMetadataString = (metadata: any) => {
  if (!metadata) return '';
  
  // Convert metadata object to a readable string
  return Object.entries(metadata)
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ');
};

// Lifecycle hooks
onMounted(async () => {
  await loadSummary();
  await loadAuditLogs();
});
</script>