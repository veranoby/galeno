<template>
  <div class="wallet-validation" v-if="showComponent">
    <!-- Estado: Solicitar acceso -->
    <div v-if="state === 'request'" class="validation-request">
      <div class="request-card">
        <h3>Acceso al Historial del Paciente</h3>
        <p class="request-description">
          Solicita acceso temporal al Health Wallet para revisar el historial médico durante la teleconsulta.
        </p>
        <div class="patient-info" v-if="patientName">
          <span class="label">Paciente:</span>
          <span class="value">{{ patientName }}</span>
        </div>
        <button
          @click="requestAccess"
          :disabled="loading"
          class="btn-primary"
        >
          <span v-if="loading">Solicitando...</span>
          <span v-else>Solicitar Acceso Temporal</span>
        </button>
        <p v-if="error" class="error-message">{{ error }}</p>
      </div>
    </div>

    <!-- Estado: Acceso concedido -->
    <div v-else-if="state === 'granted'" class="validation-granted">
      <div class="granted-header">
        <h4>Acceso Activo</h4>
        <span class="expires-at" :class="{ warning: timeRemaining < 300 }">
          Expira en: {{ formatTimeRemaining }}
        </span>
      </div>

      <div class="history-panel">
        <div class="panel-tabs">
          <button
            :class="{ active: activeTab === 'history' }"
            @click="activeTab = 'history'"
          >Historial</button>
          <button
            :class="{ active: activeTab === 'documents' }"
            @click="activeTab = 'documents'"
          >Documentos</button>
        </div>

        <!-- Tab: Historial -->
        <div v-if="activeTab === 'history'" class="tab-content">
          <div v-if="loadingHistory" class="loading-state">Cargando historial...</div>
          <div v-else-if="patientHistory?.consultas.length === 0" class="empty-state">
            No hay consultas previas registradas.
          </div>
          <div v-else class="consultas-list">
            <div
              v-for="consulta in patientHistory?.consultas"
              :key="consulta.id"
              class="consulta-item"
            >
              <div class="consulta-header">
                <span class="consulta-date">{{ formatDate(consulta.createdAt) }}</span>
                <span class="consulta-doctor">{{ consulta.doctor.nombre }}</span>
              </div>
              <p v-if="consulta.motivoConsulta" class="consulta-motivo">
                {{ consulta.motivoConsulta }}
              </p>
              <div v-if="consulta.diagnosticoCie10" class="consulta-diagnostico">
                <span class="diagnostico-label">Diagnóstico:</span>
                <span class="diagnostico-value">
                  {{ formatDiagnostico(consulta.diagnosticoCie10) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab: Documentos -->
        <div v-else-if="activeTab === 'documents'" class="tab-content">
          <div v-if="loadingDocuments" class="loading-state">Cargando documentos...</div>
          <div v-else-if="documents.length === 0" class="empty-state">
            No hay documentos disponibles.
          </div>
          <div v-else class="documents-list">
            <div
              v-for="doc in documents"
              :key="doc.id"
              class="documento-item"
            >
              <div class="documento-info">
                <span class="doc-type">{{ formatDocumentType(doc.tipo) }}</span>
                <span class="doc-date">{{ formatDate(doc.fechaEmision) }}</span>
              </div>
              <div class="documento-actions">
                <a :href="doc.viewUrl" target="_blank" class="btn-view">Ver</a>
                <a :href="doc.downloadUrl" class="btn-download" download>Descargar</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Estado: Error -->
    <div v-else-if="state === 'error'" class="validation-error">
      <div class="error-card">
        <span class="error-icon">⚠️</span>
        <h4>Error de Acceso</h4>
        <p>{{ errorMessage }}</p>
        <button @click="retry" class="btn-retry">Reintentar</button>
      </div>
    </div>

    <!-- Estado: Expirado -->
    <div v-else-if="state === 'expired'" class="validation-expired">
      <div class="expired-card">
        <span class="expired-icon">⏱️</span>
        <h4>Sesión Expirada</h4>
        <p>El tiempo de acceso al historial ha finalizado.</p>
        <button @click="requestAccess" class="btn-renew">Renovar Acceso</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useHealthWallet } from '@/composables/useHealthWallet';

// Props
interface Props {
  citaId: string;
  doctorId: string;
  pacienteId: string;
  patientName?: string;
  autoRequest?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  autoRequest: false,
});

// Emits
const emit = defineEmits<{
  (e: 'access-granted', token: string): void;
  (e: 'access-expired'): void;
  (e: 'error', message: string): void;
}>();

// Types
type ValidationState = 'request' | 'granted' | 'error' | 'expired';

// Composables
const {
  requestTemporalAccess,
  validateTemporalToken,
  getPatientHistory,
  getPatientDocuments,
  revokeTemporalAccess,
  temporalToken,
} = useHealthWallet();

// State
const state = ref<ValidationState>('request');
const activeTab = ref<'history' | 'documents'>('history');
const loading = ref(false);
const loadingHistory = ref(false);
const loadingDocuments = ref(false);
const error = ref<string | null>(null);
const errorMessage = ref('');
const patientHistory = ref<PatientHistory | null>(null);
const documents = ref<PatientHistory['documentos']>([]);
const expiresAt = ref<Date | null>(null);
const timeRemaining = ref<number>(0);

// Timer
let expirationTimer: ReturnType<typeof setInterval> | null = null;

// Computed
const showComponent = computed(() => !!props.citaId && !!props.doctorId && !!props.pacienteId);

const formatTimeRemaining = computed(() => {
  const minutes = Math.floor(timeRemaining.value / 60);
  const seconds = timeRemaining.value % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
});

// Methods
const requestAccess = async (): Promise<void> => {
  loading.value = true;
  error.value = null;

  try {
    const response = await requestTemporalAccess({
      citaId: props.citaId,
      doctorId: props.doctorId,
      pacienteId: props.pacienteId,
    });

    expiresAt.value = new Date(response.expiresAt);
    state.value = 'granted';
    emit('access-granted', response.token);
    startExpirationTimer();
    await loadPatientData(response.token);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al solicitar acceso';
    errorMessage.value = msg;
    state.value = 'error';
    emit('error', msg);
  } finally {
    loading.value = false;
  }
};

const loadPatientData = async (token: string): Promise<void> => {
  loadingHistory.value = true;
  loadingDocuments.value = true;

  try {
    const [history, docs] = await Promise.all([
      getPatientHistory(token),
      getPatientDocuments(token),
    ]);

    patientHistory.value = history;
    documents.value = docs;
  } catch (err) {
    console.error('Error loading patient data:', err);
  } finally {
    loadingHistory.value = false;
    loadingDocuments.value = false;
  }
};

const startExpirationTimer = (): void => {
  if (expirationTimer) clearInterval(expirationTimer);

  expirationTimer = setInterval(() => {
    if (!expiresAt.value) return;

    const now = new Date();
    const remaining = Math.floor((expiresAt.value.getTime() - now.getTime()) / 1000);

    timeRemaining.value = Math.max(0, remaining);

    if (remaining <= 0) {
      handleExpiration();
    }
  }, 1000);
};

const handleExpiration = (): void => {
  if (expirationTimer) clearInterval(expirationTimer);
  state.value = 'expired';
  emit('access-expired');
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-EC', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const formatDiagnostico = (diagnostico: unknown): string => {
  if (Array.isArray(diagnostico) && diagnostico.length > 0) {
    const first = diagnostico[0] as Record<string, unknown>;
    return first.codigo ? `${first.codigo} - ${first.descripcion || ''}` : String(diagnostico);
  }
  if (typeof diagnostico === 'object' && diagnostico !== null) {
    const d = diagnostico as Record<string, unknown>;
    return d.codigo ? `${d.codigo} - ${d.descripcion || ''}` : JSON.stringify(diagnostico);
  }
  return String(diagnostico || 'N/A');
};

const formatDocumentType = (tipo: string): string => {
  const types: Record<string, string> = {
    RECETA: 'Receta',
    EXAMEN: 'Examen',
    CERTIFICADO: 'Certificado',
    HISTORIA_CLINICA: 'Historia Clínica',
    INTERCONSULTA: 'Interconsulta',
  };
  return types[tipo] || tipo;
};

const retry = (): void => {
  state.value = 'request';
  errorMessage.value = '';
};

// Lifecycle
onMounted(() => {
  if (props.autoRequest && showComponent.value) {
    requestAccess();
  }
});

onUnmounted(() => {
  if (expirationTimer) clearInterval(expirationTimer);
  if (state.value === 'granted') {
    revokeTemporalAccess(props.citaId).catch(console.error);
  }
});

// Watch
watch(() => props.citaId, (newCitaId) => {
  if (newCitaId && props.autoRequest && showComponent.value) {
    requestAccess();
  }
});

// Type alias
interface PatientHistory {
  consultas: Array<{
    id: string;
    createdAt: string;
    motivoConsulta?: string;
    diagnosticoCie10?: unknown;
    doctor: { nombre: string };
  }>;
}
</script>

<style scoped>
.wallet-validation {
  width: 100%;
  max-width: 600px;
}

.validation-request .request-card {
  background: var(--color-surface);
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.validation-request h3 {
  margin: 0 0 0.75rem 0;
  color: var(--color-text);
}

.request-description {
  color: var(--color-text-secondary);
  margin-bottom: 1rem;
  line-height: 1.5;
}

.patient-info {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem;
  background: var(--color-background);
  border-radius: 8px;
  margin-bottom: 1rem;
}

.patient-info .label {
  font-weight: 600;
  color: var(--color-text-secondary);
}

.patient-info .value {
  font-weight: 500;
  color: var(--color-text);
}

.btn-primary {
  width: 100%;
  padding: 0.75rem 1.5rem;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.9;
}

.error-message {
  margin-top: 0.75rem;
  padding: 0.5rem;
  background: #fee;
  color: #c33;
  border-radius: 6px;
  font-size: 0.875rem;
}

/* Granted state */
.validation-granted {
  background: var(--color-surface);
  border-radius: 12px;
  overflow: hidden;
}

.granted-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  background: var(--color-primary-light);
  border-bottom: 1px solid var(--color-border);
}

.granted-header h4 {
  margin: 0;
  color: var(--color-text);
}

.expires-at {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
}

.expires-at.warning {
  color: #e67e22;
  font-weight: 600;
}

.history-panel {
  min-height: 300px;
}

.panel-tabs {
  display: flex;
  border-bottom: 1px solid var(--color-border);
}

.panel-tabs button {
  flex: 1;
  padding: 0.75rem;
  background: none;
  border: none;
  cursor: pointer;
  font-weight: 500;
  color: var(--color-text-secondary);
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.panel-tabs button.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

.tab-content {
  padding: 1rem;
  max-height: 400px;
  overflow-y: auto;
}

.consultas-list,
.documents-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.consulta-item,
.documento-item {
  padding: 0.75rem;
  background: var(--color-background);
  border-radius: 8px;
  border: 1px solid var(--color-border);
}

.consulta-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.consulta-date {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

.consulta-doctor {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-primary);
}

.consulta-motivo {
  margin: 0.5rem 0;
  font-size: 0.875rem;
  color: var(--color-text);
}

.consulta-diagnostico {
  display: flex;
  gap: 0.5rem;
  font-size: 0.8125rem;
}

.diagnostico-label {
  color: var(--color-text-secondary);
}

.diagnostico-value {
  color: var(--color-text);
}

.documento-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.documento-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.doc-type {
  font-weight: 500;
  color: var(--color-text);
}

.doc-date {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

.documento-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-view,
.btn-download {
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: 500;
  text-decoration: none;
  transition: opacity 0.2s;
}

.btn-view {
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.btn-download {
  background: var(--color-primary);
  color: white;
}

.btn-view:hover,
.btn-download:hover {
  opacity: 0.8;
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 2rem;
  color: var(--color-text-secondary);
}

/* Error state */
.validation-error,
.validation-expired {
  padding: 1.5rem;
}

.error-card,
.expired-card {
  background: var(--color-surface);
  border-radius: 12px;
  padding: 1.5rem;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.error-icon,
.expired-icon {
  font-size: 2rem;
  display: block;
  margin-bottom: 1rem;
}

.error-card h4,
.expired-card h4 {
  margin: 0 0 0.5rem 0;
  color: var(--color-text);
}

.error-card p,
.expired-card p {
  margin: 0 0 1rem 0;
  color: var(--color-text-secondary);
}

.btn-retry,
.btn-renew {
  padding: 0.75rem 1.5rem;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
}
</style>
