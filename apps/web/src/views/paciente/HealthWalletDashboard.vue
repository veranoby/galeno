<script setup lang="ts">
/**
 * HealthWalletDashboard.vue
 * Dashboard del paciente con Health Wallet, historial de documentos y conexiones
 * TASK-008D: Dashboard Paciente
 */

import { ref, onMounted, computed } from 'vue';
import { useApi } from '@/composables/useApi';
import QRCode from '@/components/wallet/QRCode.vue';
import Authorization from '@/components/wallet/Authorization.vue';

interface Props {
  pacienteId: string;
}

const props = defineProps<Props>();
const api = useApi();

const wallet = ref<any>(null);
const documentos = ref<any[]>([]);
const conexiones = ref<any[]>([]);
const isLoading = ref(true);
const error = ref<string>('');

type TabType = 'wallet' | 'documentos' | 'conexiones';
const activeTab = ref<TabType>('wallet');

const loadDashboard = async () => {
  isLoading.value = true;
  error.value = '';
  try {
    const walletResponse = await api.get(`/health-wallet/${props.pacienteId}`);
    if (walletResponse.data?.success) {
      wallet.value = walletResponse.data.data;
    }
    const docsResponse = await api.get(`/documentos/paciente/${props.pacienteId}`);
    if (docsResponse.data?.success) {
      documentos.value = docsResponse.data.data;
    }
    const conexionesResponse = await api.get(`/health-wallet/${props.pacienteId}/connections`);
    if (conexionesResponse.data?.success) {
      conexiones.value = conexionesResponse.data.data;
    }
  } catch (err: any) {
    error.value = err.response?.data?.error || err.message || 'Error al cargar';
  } finally {
    isLoading.value = false;
  }
};

const downloadDocumento = async (documentoId: string, nombre: string) => {
  try {
    const response = await api.get(`/storage/download/${documentoId}`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', nombre);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Error descargando:', err);
  }
};

const revokeConexion = async (conexionId: string) => {
  try {
    await api.post('/health-wallet/revoke-access', { conexionId });
    const resp = await api.get(`/health-wallet/${props.pacienteId}/connections`);
    if (resp.data?.success) conexiones.value = resp.data.data;
  } catch (err) {
    console.error('Error revocando:', err);
  }
};

const documentosPorTipo = computed(() => {
  const grouped: Record<string, any[]> = {};
  documentos.value.forEach(doc => {
    if (!grouped[doc.tipo]) grouped[doc.tipo] = [];
    grouped[doc.tipo].push(doc);
  });
  return grouped;
});

const estadisticas = computed(() => ({
  totalDocumentos: documentos.value.length,
  conexionesActivas: conexiones.value.filter(c => c.estado === 'activa').length,
  walletActivo: wallet.value?.activo ?? false,
}));

onMounted(() => loadDashboard());
</script>

<template>
  <div class="health-wallet-dashboard">
    <div class="dashboard-header">
      <h1>Health Wallet</h1>
      <p v-if="wallet" class="wallet-id">ID: {{ wallet.walletId }}</p>
    </div>

    <div v-if="isLoading" class="loading-container">
      <div class="spinner"></div>
      <p>Cargando...</p>
    </div>

    <div v-else-if="error" class="error-container">
      <p>{{ error }}</p>
      <button @click="loadDashboard" class="btn btn-primary">Reintentar</button>
    </div>

    <div v-else class="dashboard-content">
      <!-- Stats -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon documents">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div class="stat-info">
            <p class="stat-value">{{ estadisticas.totalDocumentos }}</p>
            <p class="stat-label">Documentos</p>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon connections">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div class="stat-info">
            <p class="stat-value">{{ estadisticas.conexionesActivas }}</p>
            <p class="stat-label">Conexiones</p>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" :class="{ active: estadisticas.walletActivo }">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          <div class="stat-info">
            <p class="stat-value">{{ estadisticas.walletActivo ? 'Activo' : 'Inactivo' }}</p>
            <p class="stat-label">Wallet</p>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="tabs-container">
        <button v-for="tab in ['wallet', 'documentos', 'conexiones']" :key="tab"
          class="tab-button" :class="{ active: activeTab === tab }"
          @click="activeTab = tab as TabType">
          {{ tab === 'wallet' ? 'QR' : tab.charAt(0).toUpperCase() + tab.slice(1) }}
        </button>
      </div>

      <!-- Content -->
      <div class="tab-content">
        <div v-if="activeTab === 'wallet'" class="wallet-tab">
          <QRCode :paciente-id="pacienteId" :size="250" />
        </div>

        <div v-else-if="activeTab === 'documentos'" class="documentos-tab">
          <div v-if="Object.keys(documentosPorTipo).length === 0" class="empty-state">
            <p>Sin documentos</p>
          </div>
          <div v-else class="documentos-list">
            <div v-for="(docs, tipo) in documentosPorTipo" :key="tipo" class="documentos-group">
              <h3>{{ tipo }}</h3>
              <div v-for="doc in docs" :key="doc.id" class="documento-card" @click="downloadDocumento(doc.id, doc.nombre)">
                <p><strong>{{ doc.nombre }}</strong></p>
                <p>{{ new Date(doc.fechaEmision).toLocaleDateString() }}</p>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="activeTab === 'conexiones'" class="conexiones-tab">
          <Authorization :paciente-id="pacienteId" @change="loadDashboard" />
          <div v-if="conexiones.length === 0" class="empty-state">
            <p>Sin conexiones</p>
          </div>
          <div v-else class="conexiones-list">
            <div v-for="c in conexiones" :key="c.id" class="conexion-card">
              <p>Dr. {{ c.doctor?.nombre || 'N/A' }} - {{ c.tipoAcceso }}</p>
              <span :class="'status ' + c.estado">{{ c.estado }}</span>
              <button v-if="c.estado === 'activa'" @click="revokeConexion(c.id)">Revocar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.health-wallet-dashboard { padding: 1.5rem; max-width: 1200px; margin: 0 auto; }
.dashboard-header { text-align: center; margin-bottom: 2rem; }
.dashboard-header h1 { font-size: 2rem; font-weight: 700; }
.wallet-id { font-family: monospace; color: #6b7280; }
.spinner { width: 40px; height: 40px; border: 3px solid #e5e7eb; border-top-color: #3b82f6; border-radius: 50%; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
.stat-card { background: white; padding: 1rem; border-radius: 8px; display: flex; align-items: center; gap: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.stat-icon { width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; background: #f3f4f6; }
.stat-icon.active { background: #d1fae5; }
.stat-icon.documents { background: #dbeafe; }
.stat-icon.connections { background: #fef3c7; }
.stat-value { font-size: 1.25rem; font-weight: 700; }
.stat-label { font-size: 0.875rem; color: #6b7280; }
.tabs-container { display: flex; gap: 0.5rem; margin-bottom: 1rem; background: #f3f4f6; padding: 0.25rem; border-radius: 8px; }
.tab-button { flex: 1; padding: 0.5rem; border: none; background: transparent; border-radius: 6px; cursor: pointer; }
.tab-button.active { background: white; font-weight: 500; }
.tab-content { background: white; padding: 1.5rem; border-radius: 12px; min-height: 300px; }
.wallet-tab { display: flex; flex-direction: column; align-items: center; gap: 1rem; }
.empty-state { text-align: center; padding: 2rem; color: #9ca3af; }
.documento-card { padding: 0.75rem; border: 1px solid #e5e7eb; border-radius: 6px; cursor: pointer; margin-bottom: 0.5rem; }
.documento-card:hover { background: #f9fafb; }
.conexion-card { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; border: 1px solid #e5e7eb; border-radius: 6px; margin-bottom: 0.5rem; }
.status.activa { color: #059669; }
.status.revocada { color: #dc2626; }
.btn { padding: 0.5rem 1rem; border-radius: 6px; border: none; cursor: pointer; }
.btn-primary { background: #3b82f6; color: white; }
</style>
