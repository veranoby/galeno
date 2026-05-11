<template>
  <div class="waiting-room-view" role="main" aria-label="Sala de Espera Virtual">
    <!-- Header -->
    <header class="waiting-room-header">
      <h1 class="waiting-room-title">
        <span v-if="isWaiting" aria-live="polite">Sala de Espera</span>
        <span v-else-if="isAdmitted" aria-live="polite">¡Bienvenido/a!</span>
        <span v-else aria-live="polite">Teleconsulta</span>
      </h1>
      <p class="waiting-room-subtitle">
        {{ subtitleText }}
      </p>
    </header>

    <!-- Main Content -->
    <main class="waiting-room-content">
      <!-- Estado: Esperando -->
      <section
        v-if="isWaiting"
        class="waiting-state"
        aria-live="polite"
        aria-atomic="true"
      >
        <div class="waiting-animation">
          <div class="pulse-circle"></div>
          <div class="pulse-circle delay-1"></div>
          <div class="pulse-circle delay-2"></div>
        </div>

        <div class="waiting-info">
          <h2 class="waiting-title">Esperando al doctor...</h2>
          <p class="waiting-message">
            El doctor te admitirá en breve. Por favor, mantén esta ventana abierta.
          </p>

          <!-- Timer de espera -->
          <div class="waiting-timer" role="timer" aria-label="Tiempo restante">
            <div class="timer-display">
              <span class="timer-label">Tiempo restante:</span>
              <span 
                class="timer-value"
                :class="{ 'timer-warning': timeRemaining < 180 }"
              >
                {{ formatTime(timeRemaining) }}
              </span>
            </div>
            <div class="timer-bar">
              <div 
                class="timer-progress"
                :class="{ 'timer-progress-warning': timeRemaining < 180 }"
                :style="{ width: `${timerProgress}%` }"
              ></div>
            </div>
          </div>

          <!-- Tiempo transcurrido -->
          <div class="elapsed-time">
            <span class="elapsed-label">Tiempo de espera:</span>
            <span class="elapsed-value">{{ formatTime(timeElapsed) }}</span>
          </div>
        </div>

        <!-- Estado de conexión -->
        <div class="connection-status" aria-live="polite">
          <span 
            class="status-indicator"
            :class="connectionStatusClass"
          ></span>
          <span class="status-text">{{ connectionStatusText }}</span>
        </div>

        <!-- Cancelar espera -->
        <button
          class="btn-cancel"
          @click="handleCancel"
          :disabled="isLoading"
          aria-label="Cancelar espera y salir"
        >
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
          Cancelar espera
        </button>
      </section>

      <!-- Estado: Admitido -->
      <section
        v-else-if="isAdmitted"
        class="admitted-state"
        aria-live="polite"
        aria-atomic="true"
      >
        <div class="admitted-animation">
          <svg class="checkmark" viewBox="0 0 52 52">
            <circle class="checkmark-circle" cx="26" cy="26" r="25" fill="none"/>
            <path class="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
          </svg>
        </div>

        <div class="admitted-info">
          <h2 class="admitted-title">¡El doctor te ha admitido!</h2>
          <p class="admitted-message">
            Preparando la videollamada...
          </p>
        </div>

        <!-- Loading de Jitsi -->
        <div class="jitsi-loading">
          <div class="loading-spinner"></div>
          <p>Cargando sala de videoconferencia...</p>
        </div>
      </section>

      <!-- Estado: Rechazado -->
      <section
        v-else-if="isRejected"
        class="rejected-state"
        aria-live="polite"
        aria-atomic="true"
      >
        <div class="rejected-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M15 9l-6 6M9 9l6 6" />
          </svg>
        </div>

        <div class="rejected-info">
          <h2 class="rejected-title">Consulta no disponible</h2>
          <p class="rejected-message">
            {{ rejectMessage || 'El doctor no pudo aceptar tu solicitud en este momento.' }}
          </p>
        </div>

        <button
          class="btn-primary"
          @click="handleGoHome"
          aria-label="Volver al inicio"
        >
          Volver al inicio
        </button>
      </section>

      <!-- Estado: Timeout -->
      <section
        v-else-if="isTimeout"
        class="timeout-state"
        aria-live="polite"
        aria-atomic="true"
      >
        <div class="timeout-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
        </div>

        <div class="timeout-info">
          <h2 class="timeout-title">Tiempo de espera agotado</h2>
          <p class="timeout-message">
            Has superado el tiempo máximo de espera (15 minutos).
            Por favor, contacta con el doctor para reprogramar.
          </p>
        </div>

        <button
          class="btn-primary"
          @click="handleGoHome"
          aria-label="Volver al inicio"
        >
          Volver al inicio
        </button>
      </section>

      <!-- Estado: En sesión -->
      <section
        v-else-if="isInSession"
        class="session-state"
        aria-live="polite"
        aria-atomic="true"
      >
        <div class="session-info">
          <h2 class="session-title">En consulta</h2>
          <p class="session-message">
            La videollamada está en progreso.
          </p>
        </div>
      </section>

      <!-- Error -->
      <section
        v-if="error"
        class="error-state"
        role="alert"
        aria-live="assertive"
      >
        <div class="error-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
        </div>
        <p class="error-message">{{ error }}</p>
        <button
          class="btn-primary"
          @click="handleRetry"
          :disabled="isLoading"
        >
          Reintentar
        </button>
      </section>
    </main>

    <!-- Toast Notification -->
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
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useWaitingRoom, WaitingRoomState } from '@/composables/useWaitingRoom';
import { useApi } from '@/composables/useApi';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const citaId = computed(() => route.params.citaId as string);
const userId = computed(() => authStore.user?.id || '');
const userRole = computed<'paciente' | 'doctor'>(() => 'paciente');

// Composable
const {
  status,
  error,
  isLoading,
  isAdmitted,
  isWaiting,
  isEnded,
  timeRemaining,
  timeElapsed,
  joinWaitingRoom,
  fetchStatus,
  validateAccess,
  cancelWaiting,
  initializeSSE,
  startPolling,
  cleanup,
} = useWaitingRoom({
  userId: userId.value,
  userRole: userRole.value,
  autoReconnect: true,
  pollingInterval: 3000,
});

// Estado local
const isRejected = ref(false);
const isTimeout = ref(false);
const isInSession = ref(false);
const rejectMessage = ref('');
const toast = ref({
  visible: false,
  message: '',
  type: 'info' as 'info' | 'success' | 'warning' | 'error',
});

// Computed
const subtitleText = computed(() => {
  if (isWaiting.value) {
    return 'Tu consulta está siendo preparada';
  }
  if (isAdmitted.value) {
    return 'Conectando con el doctor...';
  }
  return '';
});

const connectionStatusClass = computed(() => {
  if (isLoading.value) return 'status-connecting';
  if (error.value) return 'status-error';
  return 'status-connected';
});

const connectionStatusText = computed(() => {
  if (isLoading.value) return 'Conectando...';
  if (error.value) return 'Error de conexión';
  return 'Conectado';
});

const timerProgress = computed(() => {
  const totalTime = 15 * 60; // 15 minutos en segundos
  if (timeRemaining.value <= 0) return 0;
  return Math.min(100, (timeRemaining.value / totalTime) * 100);
});

// Métodos
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const showToast = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
  toast.value = { visible: true, message, type };
  setTimeout(() => {
    toast.value.visible = false;
  }, 4000);
};

const handleCancel = async () => {
  await cancelWaiting();
  router.push('/agenda');
};

const handleGoHome = () => {
  router.push('/agenda');
};

const handleRetry = async () => {
  if (citaId.value) {
    await initialize();
  }
};

const handleAdmitted = () => {
  showToast('¡El doctor te ha admitido!', 'success');
  // Redirigir a la videollamada después de un breve delay
  setTimeout(() => {
    router.push(`/teleconsulta/${citaId.value}/video`);
  }, 2000);
};

const handleRejected = (event: CustomEvent<{ citaId: string; motivo?: string }>) => {
  isRejected.value = true;
  rejectMessage.value = event.detail.motivo || '';
  showToast('Tu solicitud fue rechazada', 'error');
};

const handleTimeout = () => {
  isTimeout.value = true;
  showToast('Tiempo de espera agotado', 'warning');
};

// Watch para cambios de estado
watch(isAdmitted, (newVal) => {
  if (newVal) {
    handleAdmitted();
  }
});

watch(isEnded, (newVal) => {
  if (newVal && status.value?.estado === WaitingRoomState.ENDED && !isRejected.value) {
    // Verificar si fue rechazado
    if (status.value.estado === WaitingRoomState.ENDED) {
      isRejected.value = true;
    }
  }
});

// Escuchar eventos globales
onMounted(() => {
  window.addEventListener('waiting-room-admitted', handleAdmitted as EventListener);
  window.addEventListener('waiting-room-rejected', handleRejected as EventListener);
  window.addEventListener('waiting-room-timeout', handleTimeout as EventListener);
});

// Cleanup
onMounted(() => {
  initialize();
});

// Cleanup on unmount
import { onUnmounted } from 'vue';
onUnmounted(() => {
  window.removeEventListener('waiting-room-admitted', handleAdmitted as EventListener);
  window.removeEventListener('waiting-room-rejected', handleRejected as EventListener);
  window.removeEventListener('waiting-room-timeout', handleTimeout as EventListener);
  cleanup();
});

// Inicializar
const initialize = async () => {
  if (!citaId.value || !userId.value) {
    error.value = 'Datos de cita no válidos';
    return;
  }

  try {
    // Validar acceso
    const access = await validateAccess(citaId.value);
    
    if (!access?.valid) {
      error.value = access?.reason || 'No tienes acceso a esta consulta';
      return;
    }

    // Inicializar SSE
    initializeSSE();

    // Intentar obtener estado existente
    const existingStatus = await fetchStatus(citaId.value);

    if (existingStatus) {
      // Ya existe una sala, usar estado actual
      updateLocalState(existingStatus.estado);
    } else {
      // Crear nueva sala de espera
      await joinWaitingRoom(citaId.value);
    }

    // Iniciar polling
    startPolling();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Error al inicializar';
  }
};

const updateLocalState = (estado: string) => {
  switch (estado) {
    case WaitingRoomState.ENDED:
      isRejected.value = true;
      break;
    case WaitingRoomState.TIMEOUT:
      isTimeout.value = true;
      break;
    case WaitingRoomState.IN_SESSION:
      isInSession.value = true;
      break;
  }
};
</script>

<style scoped>
.waiting-room-view {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 2rem;
}

.waiting-room-header {
  text-align: center;
  color: white;
  margin-bottom: 2rem;
}

.waiting-room-title {
  font-size: 2rem;
  font-weight: 700;
  margin: 0 0 0.5rem 0;
}

.waiting-room-subtitle {
  font-size: 1.1rem;
  opacity: 0.9;
  margin: 0;
}

.waiting-room-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  max-width: 600px;
  margin: 0 auto;
  width: 100%;
}

/* Waiting State */
.waiting-state {
  background: white;
  border-radius: 16px;
  padding: 3rem 2rem;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 100%;
}

.waiting-animation {
  position: relative;
  width: 120px;
  height: 120px;
  margin: 0 auto 2rem;
}

.pulse-circle {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 3px solid #667eea;
  animation: pulse 2s ease-out infinite;
}

.delay-1 {
  animation-delay: 0.4s;
}

.delay-2 {
  animation-delay: 0.8s;
}

@keyframes pulse {
  0% {
    width: 0;
    height: 0;
    opacity: 1;
  }
  100% {
    width: 100%;
    height: 100%;
    opacity: 0;
  }
}

.waiting-title {
  font-size: 1.5rem;
  color: #1a202c;
  margin: 0 0 1rem 0;
}

.waiting-message {
  color: #4a5568;
  margin: 0 0 2rem 0;
  line-height: 1.6;
}

.waiting-timer {
  background: #f7fafc;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1rem;
}

.timer-display {
  display: flex;
  justify-content: center;
  align-items: baseline;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.timer-label {
  color: #4a5568;
  font-size: 0.9rem;
}

.timer-value {
  font-size: 2rem;
  font-weight: 700;
  color: #667eea;
  font-variant-numeric: tabular-nums;
}

.timer-warning {
  color: #e53e3e;
}

.timer-bar {
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
}

.timer-progress {
  height: 100%;
  background: linear-gradient(90deg, #667eea, #764ba2);
  border-radius: 4px;
  transition: width 1s linear;
}

.timer-progress-warning {
  background: linear-gradient(90deg, #f56565, #e53e3e);
}

.elapsed-time {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  color: #718096;
  font-size: 0.9rem;
}

.elapsed-value {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.connection-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin: 1.5rem 0;
  padding: 0.75rem 1.5rem;
  background: #f7fafc;
  border-radius: 8px;
}

.status-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.status-connected {
  background: #48bb78;
}

.status-connecting {
  background: #ecc94b;
  animation: blink 1s infinite;
}

.status-error {
  background: #f56565;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.status-text {
  color: #4a5568;
  font-size: 0.9rem;
}

.btn-cancel {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: transparent;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  color: #718096;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 1.5rem;
}

.btn-cancel:hover:not(:disabled) {
  border-color: #f56565;
  color: #f56565;
}

.btn-cancel:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.icon {
  width: 18px;
  height: 18px;
}

/* Admitted State */
.admitted-state {
  background: white;
  border-radius: 16px;
  padding: 3rem 2rem;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 100%;
}

.admitted-animation {
  width: 100px;
  height: 100px;
  margin: 0 auto 2rem;
}

.checkmark {
  width: 100%;
  height: 100%;
}

.checkmark-circle {
  stroke: #48bb78;
  stroke-width: 2;
  stroke-dasharray: 166;
  stroke-dashoffset: 166;
  animation: stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards;
}

.checkmark-check {
  stroke: #48bb78;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-dasharray: 48;
  stroke-dashoffset: 48;
  animation: stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.8s forwards;
}

@keyframes stroke {
  100% { stroke-dashoffset: 0; }
}

.admitted-title {
  font-size: 1.5rem;
  color: #1a202c;
  margin: 0 0 1rem 0;
}

.admitted-message {
  color: #4a5568;
  margin: 0;
}

.jitsi-loading {
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid #e2e8f0;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e2e8f0;
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Rejected State */
.rejected-state,
.timeout-state {
  background: white;
  border-radius: 16px;
  padding: 3rem 2rem;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 100%;
}

.rejected-icon,
.timeout-icon {
  width: 80px;
  height: 80px;
  margin: 0 auto 1.5rem;
  color: #f56565;
}

.rejected-title,
.timeout-title {
  font-size: 1.5rem;
  color: #1a202c;
  margin: 0 0 1rem 0;
}

.rejected-message,
.timeout-message {
  color: #4a5568;
  line-height: 1.6;
  margin: 0 0 2rem 0;
}

.btn-primary {
  padding: 1rem 2rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 8px;
  color: white;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(102, 126, 234, 0.4);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Error State */
.error-state {
  background: white;
  border-radius: 16px;
  padding: 2rem;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 100%;
}

.error-icon {
  width: 60px;
  height: 60px;
  margin: 0 auto 1rem;
  color: #f56565;
}

.error-message {
  color: #4a5568;
  margin: 0 0 1.5rem 0;
}

/* Toast Notification */
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
  z-index: 1000;
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

/* Responsive */
@media (max-width: 640px) {
  .waiting-room-view {
    padding: 1rem;
  }

  .waiting-room-title {
    font-size: 1.5rem;
  }

  .waiting-state,
  .admitted-state,
  .rejected-state,
  .timeout-state {
    padding: 2rem 1.5rem;
  }
}
</style>
