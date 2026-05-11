<template>
  <div class="waiting-room-panel" role="complementary" aria-label="Panel de Sala de Espera">
    <!-- Header con badge -->
    <header class="panel-header">
      <h3 class="panel-title">
        <span class="title-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </span>
        Sala de Espera
      </h3>
      <span 
        v-if="waitingPatients.length > 0"
        class="patient-badge"
        :class="{ 'badge-pulse': waitingPatients.length > 0 }"
        aria-label="{{ waitingPatients.length }} pacientes esperando"
      >
        {{ waitingPatients.length }}
      </span>
    </header>

    <!-- Lista de pacientes -->
    <div class="panel-content">
      <!-- Sin pacientes -->
      <div v-if="waitingPatients.length === 0 && !isLoading" class="empty-state">
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        <p class="empty-text">No hay pacientes esperando</p>
        <p class="empty-subtext">Los pacientes aparecerán aquí cuando entren a la sala de espera</p>
      </div>

      <!-- Loading -->
      <div v-else-if="isLoading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>Cargando pacientes...</p>
      </div>

      <!-- Lista de pacientes -->
      <ul v-else class="patients-list" role="list">
        <li
          v-for="patient in waitingPatients"
          :key="patient.citaId"
          class="patient-item"
          :class="`patient-${patient.estado}`"
          role="listitem"
        >
          <!-- Información del paciente -->
          <div class="patient-info">
            <div class="patient-avatar">
              {{ getPatientInitials(patient.paciente?.nombre || 'Paciente') }}
            </div>
            
            <div class="patient-details">
              <h4 class="patient-name">
                {{ patient.paciente?.nombre || 'Paciente' }}
              </h4>
              
              <div class="patient-meta">
                <span class="meta-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                  {{ formatWaitTime(patient.enteredAt) }}
                </span>
                
                <span 
                  v-if="patient.expiresAt"
                  class="meta-item"
                  :class="{ 'meta-warning': getTimeRemaining(patient.expiresAt) < 180 }"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  {{ formatExpiresIn(patient.expiresAt) }}
                </span>
              </div>

              <!-- Estado -->
              <div class="patient-status">
                <span 
                  class="status-badge"
                  :class="`status-${patient.estado}`"
                >
                  {{ formatEstado(patient.estado) }}
                </span>
              </div>
            </div>
          </div>

          <!-- Acciones -->
          <div class="patient-actions">
            <!-- Botón Admitir -->
            <button
              v-if="patient.estado === 'waiting'"
              class="btn-admit"
              @click="handleAdmit(patient.citaId)"
              :disabled="isActionLoading.get(patient.citaId)"
              aria-label="Admitir paciente"
              title="Admitir a consulta"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              Admitir
            </button>

            <!-- Botón Iniciar Sesión -->
            <button
              v-else-if="patient.estado === 'admitted'"
              class="btn-start"
              @click="handleStartSession(patient.citaId)"
              :disabled="isActionLoading.get(patient.citaId)"
              aria-label="Iniciar sesión de consulta"
              title="Iniciar videollamada"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Iniciar
            </button>

            <!-- Botón Finalizar -->
            <button
              v-else-if="patient.estado === 'in-session'"
              class="btn-end"
              @click="handleEndSession(patient.citaId)"
              :disabled="isActionLoading.get(patient.citaId)"
              aria-label="Finalizar consulta"
              title="Finalizar consulta"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                <line x1="12" y1="2" x2="12" y2="12" />
              </svg>
              Finalizar
            </button>

            <!-- Botón Rechazar -->
            <button
              v-if="patient.estado === 'waiting' || patient.estado === 'admitted'"
              class="btn-reject"
              @click="openRejectModal(patient.citaId)"
              :disabled="isActionLoading.get(patient.citaId)"
              aria-label="Rechazar paciente"
              title="Rechazar solicitud"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M15 9l-6 6M9 9l6 6" />
              </svg>
            </button>

            <!-- Ir a consulta -->
            <button
              v-if="patient.estado === 'in-session' || patient.estado === 'admitted'"
              class="btn-join"
              @click="handleJoinConsultation(patient.citaId)"
              :disabled="isActionLoading.get(patient.citaId)"
              aria-label="Ir a consulta"
              title="Ir a videollamada"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </li>
      </ul>
    </div>

    <!-- Modal de Rechazo -->
    <transition name="modal">
      <div
        v-if="showRejectModal"
        class="modal-overlay"
        @click="closeRejectModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div class="modal-content" @click.stop>
          <h3 id="modal-title" class="modal-title">Rechazar Paciente</h3>
          
          <div class="modal-body">
            <label for="reject-reason" class="modal-label">
              Motivo del rechazo (opcional):
            </label>
            <textarea
              id="reject-reason"
              v-model="rejectReason"
              class="modal-textarea"
              placeholder="Ej: El doctor no está disponible en este momento..."
              rows="4"
            ></textarea>
          </div>

          <div class="modal-actions">
            <button
              class="btn-modal-cancel"
              @click="closeRejectModal"
            >
              Cancelar
            </button>
            <button
              class="btn-modal-reject"
              @click="confirmReject"
              :disabled="isRejecting"
            >
              {{ isRejecting ? 'Rechazando...' : 'Confirmar Rechazo' }}
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Notificación Toast -->
    <transition name="toast">
      <div
        v-if="toast.visible"
        class="toast-notification"
        :class="`toast-${toast.type}`"
        role="status"
        aria-live="polite"
      >
        <span>{{ toast.message }}</span>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useWaitingRoom, WaitingRoomState } from '@/composables/useWaitingRoom';
import { useApi } from '@/composables/useApi';

const router = useRouter();
const authStore = useAuthStore();

const { post, get, isLoading } = useApi();

// Estado
const waitingPatients = ref<Array<{
  citaId: string;
  pacienteId: string;
  doctorId: string;
  estado: string;
  enteredAt: string;
  expiresAt: string;
  paciente?: { id: string; nombre: string };
}>>([]);
const isActionLoading = ref(new Map<string, boolean>());
const showRejectModal = ref(false);
const rejectReason = ref('');
const currentRejectCitaId = ref<string | null>(null);
const isRejecting = ref(false);
const toast = ref({
  visible: false,
  message: '',
  type: 'info' as 'info' | 'success' | 'warning' | 'error',
});

// Computed
const doctorId = computed(() => authStore.user?.id || '');

// Métodos
const getPatientInitials = (name: string): string => {
  return name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
};

const formatWaitTime = (enteredAt: string): string => {
  const entered = new Date(enteredAt);
  const now = new Date();
  const diff = Math.floor((now.getTime() - entered.getTime()) / 1000);
  
  if (diff < 60) {
    return `${diff}s`;
  }
  
  const mins = Math.floor(diff / 60);
  if (mins < 60) {
    return `${mins}m`;
  }
  
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}h ${remainingMins}m`;
};

const getTimeRemaining = (expiresAt: string): number => {
  const expires = new Date(expiresAt);
  const now = new Date();
  return Math.max(0, Math.floor((expires.getTime() - now.getTime()) / 1000));
};

const formatExpiresIn = (expiresAt: string): string => {
  const remaining = getTimeRemaining(expiresAt);
  
  if (remaining < 60) {
    return `${remaining}s restantes`;
  }
  
  const mins = Math.floor(remaining / 60);
  return `${mins}m restantes`;
};

const formatEstado = (estado: string): string => {
  const labels: Record<string, string> = {
    [WaitingRoomState.WAITING]: 'Esperando',
    [WaitingRoomState.ADMITTED]: 'Admitido',
    [WaitingRoomState.IN_SESSION]: 'En consulta',
    [WaitingRoomState.ENDED]: 'Finalizado',
    [WaitingRoomState.TIMEOUT]: 'Expirado',
  };
  return labels[estado] || estado;
};

const showToast = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
  toast.value = { visible: true, message, type };
  setTimeout(() => {
    toast.value.visible = false;
  }, 4000);
};

const fetchActiveRooms = async () => {
  if (!doctorId.value) return;

  try {
    const response = await get<Array<{
      citaId: string;
      pacienteId: string;
      doctorId: string;
      estado: string;
      enteredAt: string;
      expiresAt: string;
    }>>('/api/v1/teleconsulta/waiting-room/doctor/active');

    if (response.success && response.data) {
      // Enriquecer con información del paciente
      const enriched = await Promise.all(
        response.data.map(async (room) => {
          // Obtener información de la cita para tener datos del paciente
          const citaResponse = await get<{
            paciente?: { id: string; nombre: string };
          }>(`/api/v1/agenda/citas/${room.citaId}`);
          
          return {
            ...room,
            paciente: citaResponse?.success ? citaResponse.data?.paciente : undefined,
          };
        })
      );

      waitingPatients.value = enriched;
    }
  } catch (error) {
    console.error('Error fetching active rooms:', error);
  }
};

const handleAdmit = async (citaId: string) => {
  setIsLoading(citaId, true);
  
  try {
    const response = await post(`/api/v1/teleconsulta/waiting-room/${citaId}/admit`, {});
    
    if (response.success) {
      showToast('Paciente admitido exitosamente', 'success');
      await fetchActiveRooms();
      
      // Emitir evento para notificación sonora
      window.dispatchEvent(new CustomEvent('waiting-room-patient-admitted', {
        detail: { citaId },
      }));
    } else {
      showToast(response.error || 'Error al admitir paciente', 'error');
    }
  } catch (error) {
    showToast('Error al admitir paciente', 'error');
  } finally {
    setIsLoading(citaId, false);
  }
};

const handleStartSession = async (citaId: string) => {
  setIsLoading(citaId, true);
  
  try {
    const response = await post(`/api/v1/teleconsulta/waiting-room/${citaId}/start-session`, {});
    
    if (response.success) {
      showToast('Sesión iniciada', 'success');
      await fetchActiveRooms();
    } else {
      showToast(response.error || 'Error al iniciar sesión', 'error');
    }
  } catch (error) {
    showToast('Error al iniciar sesión', 'error');
  } finally {
    setIsLoading(citaId, false);
  }
};

const handleEndSession = async (citaId: string) => {
  if (!confirm('¿Estás seguro de finalizar esta consulta?')) {
    return;
  }

  setIsLoading(citaId, true);
  
  try {
    const response = await fetch(`/api/v1/teleconsulta/waiting-room/${citaId}`, {
      method: 'DELETE',
    }).then(r => r.json());
    
    if (response.success) {
      showToast('Consulta finalizada', 'success');
      await fetchActiveRooms();
    } else {
      showToast(response.error || 'Error al finalizar consulta', 'error');
    }
  } catch (error) {
    showToast('Error al finalizar consulta', 'error');
  } finally {
    setIsLoading(citaId, false);
  }
};

const handleJoinConsultation = (citaId: string) => {
  router.push(`/teleconsulta/${citaId}/video`);
};

const openRejectModal = (citaId: string) => {
  currentRejectCitaId.value = citaId;
  rejectReason.value = '';
  showRejectModal.value = true;
};

const closeRejectModal = () => {
  showRejectModal.value = false;
  currentRejectCitaId.value = null;
  rejectReason.value = '';
};

const confirmReject = async () => {
  if (!currentRejectCitaId.value) return;

  isRejecting.value = true;
  
  try {
    const response = await post(
      `/api/v1/teleconsulta/waiting-room/${currentRejectCitaId.value}/reject`,
      { reason: rejectReason.value || undefined }
    );
    
    if (response.success) {
      showToast('Paciente rechazado', 'warning');
      closeRejectModal();
      await fetchActiveRooms();
    } else {
      showToast(response.error || 'Error al rechazar paciente', 'error');
    }
  } catch (error) {
    showToast('Error al rechazar paciente', 'error');
  } finally {
    isRejecting.value = false;
  }
};

const setIsLoading = (citaId: string, loading: boolean) => {
  const map = new Map(isActionLoading.value);
  map.set(citaId, loading);
  isActionLoading.value = map;
};

// Escuchar eventos SSE
const handleSSEEvent = (event: CustomEvent) => {
  const detail = event.detail;
  
  // Solo procesar si es evento de waiting room
  if (detail.type && detail.type.startsWith('WAITING_ROOM_')) {
    fetchActiveRooms();
    
    if (detail.type === 'WAITING_ROOM_UPDATE') {
      showToast('Un paciente ha entrado a la sala de espera', 'info');
    }
  }
};

// Polling interval
let pollingTimer: NodeJS.Timeout | null = null;

onMounted(() => {
  fetchActiveRooms();
  
  // Polling cada 5 segundos
  pollingTimer = setInterval(fetchActiveRooms, 5000);
  
  // Escuchar eventos SSE
  window.addEventListener('sse-WAITING_ROOM_UPDATE', handleSSEEvent as EventListener);
});

onUnmounted(() => {
  if (pollingTimer) {
    clearInterval(pollingTimer);
  }
  window.removeEventListener('sse-WAITING_ROOM_UPDATE', handleSSEEvent as EventListener);
});
</script>

<style scoped>
.waiting-room-panel {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
}

.title-icon {
  width: 20px;
  height: 20px;
}

.patient-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 8px;
  background: #fc8181;
  color: white;
  font-size: 0.75rem;
  font-weight: 700;
  border-radius: 12px;
}

.badge-pulse {
  animation: pulse-badge 2s infinite;
}

@keyframes pulse-badge {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

.panel-content {
  padding: 1rem;
  max-height: 500px;
  overflow-y: auto;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  text-align: center;
  color: #a0aec0;
}

.empty-icon {
  width: 64px;
  height: 64px;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.empty-text {
  font-size: 1rem;
  font-weight: 500;
  margin: 0 0 0.5rem 0;
  color: #4a5568;
}

.empty-subtext {
  font-size: 0.875rem;
  margin: 0;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: #718096;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e2e8f0;
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.patients-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.patient-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  background: #f7fafc;
  border-radius: 8px;
  border-left: 4px solid transparent;
  transition: all 0.2s;
}

.patient-item:hover {
  background: #edf2f7;
}

.patient-waiting {
  border-left-color: #ecc94b;
}

.patient-admitted {
  border-left-color: #4299e1;
}

.patient-in-session {
  border-left-color: #48bb78;
}

.patient-info {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex: 1;
  min-width: 0;
}

.patient-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 1rem;
  flex-shrink: 0;
}

.patient-details {
  flex: 1;
  min-width: 0;
}

.patient-name {
  font-size: 0.95rem;
  font-weight: 600;
  color: #1a202c;
  margin: 0 0 0.25rem 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.patient-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: #718096;
}

.meta-item svg {
  width: 14px;
  height: 14px;
}

.meta-warning {
  color: #e53e3e;
}

.patient-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 9999px;
  text-transform: capitalize;
}

.status-waiting {
  background: #fefcbf;
  color: #975a16;
}

.status-admitted {
  background: #bee3f8;
  color: #2c5282;
}

.status-in-session {
  background: #c6f6d5;
  color: #22543d;
}

.status-ended {
  background: #e2e8f0;
  color: #4a5568;
}

.status-timeout {
  background: #fed7d7;
  color: #742a2a;
}

.patient-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.btn-admit,
.btn-start,
.btn-end {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-admit {
  background: #48bb78;
  color: white;
}

.btn-admit:hover:not(:disabled) {
  background: #38a169;
}

.btn-start {
  background: #4299e1;
  color: white;
}

.btn-start:hover:not(:disabled) {
  background: #3182ce;
}

.btn-end {
  background: #ed8936;
  color: white;
}

.btn-end:hover:not(:disabled) {
  background: #dd6b20;
}

.btn-reject,
.btn-join {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  background: white;
  color: #718096;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-reject:hover:not(:disabled) {
  border-color: #f56565;
  color: #f56565;
  background: #fff5f5;
}

.btn-join:hover:not(:disabled) {
  border-color: #4299e1;
  color: #4299e1;
  background: #ebf8ff;
}

.btn-admit:disabled,
.btn-start:disabled,
.btn-end:disabled,
.btn-reject:disabled,
.btn-join:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-admit svg,
.btn-start svg,
.btn-end svg,
.btn-reject svg,
.btn-join svg {
  width: 18px;
  height: 18px;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  width: 100%;
  max-width: 500px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.modal-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1a202c;
  margin: 0 0 1.5rem 0;
}

.modal-body {
  margin-bottom: 1.5rem;
}

.modal-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #4a5568;
  margin-bottom: 0.5rem;
}

.modal-textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.95rem;
  font-family: inherit;
  resize: vertical;
  transition: border-color 0.2s;
}

.modal-textarea:focus {
  outline: none;
  border-color: #667eea;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.btn-modal-cancel {
  padding: 0.75rem 1.5rem;
  background: transparent;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  color: #4a5568;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-modal-cancel:hover {
  border-color: #cbd5e0;
  background: #f7fafc;
}

.btn-modal-reject {
  padding: 0.75rem 1.5rem;
  background: #f56565;
  border: none;
  border-radius: 8px;
  color: white;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-modal-reject:hover:not(:disabled) {
  background: #e53e3e;
}

.btn-modal-reject:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Toast */
.toast-notification {
  position: fixed;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  padding: 1rem 2rem;
  border-radius: 8px;
  color: white;
  font-weight: 500;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  z-index: 1100;
}

.toast-info {
  background: #4299e1;
}

.toast-success {
  background: #48bb78;
}

.toast-warning {
  background: #ed8936;
}

.toast-error {
  background: #f56565;
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(20px);
}

/* Modal transitions */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-content,
.modal-leave-to .modal-content {
  transform: scale(0.95);
}

/* Responsive */
@media (max-width: 768px) {
  .patient-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .patient-actions {
    width: 100%;
    justify-content: flex-end;
  }

  .btn-admit,
  .btn-start,
  .btn-end {
    padding: 0.5rem 0.75rem;
    font-size: 0.8rem;
  }
}
</style>
