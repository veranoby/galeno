<script setup lang="ts">
/**
 * QRCode.vue
 * Componente para mostrar y generar códigos QR del Health Wallet
 * TASK-008C: Interfaz de QR Dinámico con timer de expiración (24h)
 * TASK-019: Validación QR Farmacias - Added pharmacy QR support
 * 
 * Features:
 * - Timer de expiración visible (24h default)
 * - Botón de regeneración de QR
 * - Indicador visual de estado (válido, por expirar, expirado)
 * - Integrado con Health Wallet
 */

import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { useApi } from '@/composables/useApi';
import { useQRManager, type QRGenerationOptions } from '@/composables/useQRManager';

interface Props {
  pacienteId: string;
  size?: number;
  showRefresh?: boolean;
  autoGenerate?: boolean;
  forPharmacy?: boolean;
  durationHours?: number;
}

interface Emits {
  (e: 'generated', qrData: string): void;
  (e: 'error', error: string): void;
  (e: 'expired'): void;
  (e: 'status-change', status: string): void;
}

const props = withDefaults(defineProps<Props>(), {
  size: 200,
  showRefresh: true,
  autoGenerate: true,
  forPharmacy: false,
  durationHours: 24, // Default 24h for Health Wallet
});

const emit = defineEmits<Emits>();
const api = useApi();

// Use QR Manager composable
const qrManager = useQRManager();

// Local state
const wasExpired = ref(false);

// Computed properties
const qrDataUrl = computed(() => qrManager.qrDataUrl || '');
const isLoading = computed(() => qrManager.isLoading);
const error = computed(() => qrManager.error || '');
const expiresAt = computed(() => qrManager.expiresAt);
const timeRemaining = computed(() => qrManager.timeRemaining);
const isExpired = computed(() => qrManager.isExpired);
const isExpiringSoon = computed(() => qrManager.isExpiringSoon);
const percentageRemaining = computed(() => qrManager.percentageRemaining);
const statusColor = computed(() => qrManager.getStatusColor());

// Watch for expiration events
watch(isExpired, (newValue, oldValue) => {
  if (newValue && !oldValue) {
    emit('expired');
  }
});

// Watch for status changes
watch(qrManager.status, (newStatus) => {
  emit('status-change', newStatus);
});

const generateQR = async () => {
  if (!props.pacienteId) {
    emit('error', 'ID de paciente no proporcionado');
    return;
  }

  const options: QRGenerationOptions = {
    pacienteId: props.pacienteId,
    forPharmacy: props.forPharmacy,
    durationHours: props.durationHours,
  };

  try {
    await qrManager.generateQR(options);
    if (qrManager.qrDataUrl) {
      emit('generated', qrManager.qrDataUrl);
    }
  } catch (err: any) {
    emit('error', err.message || 'Error al generar QR');
  }
};

const refreshQR = async () => {
  const options: QRGenerationOptions = {
    pacienteId: props.pacienteId,
    forPharmacy: props.forPharmacy,
    durationHours: props.durationHours,
  };
  await qrManager.refreshQR(options);
};

const getStatusText = (): string => {
  switch (qrManager.status) {
    case 'valid':
      return 'QR Válido';
    case 'expiring-soon':
      return 'Por Expirar';
    case 'expired':
      return 'Expirado';
    case 'loading':
      return 'Generando...';
    case 'error':
      return 'Error';
    default:
      return 'Desconocido';
  }
};

const getStatusAriaLabel = (): string => {
  const statusText = getStatusText();
  return `${statusText}, ${timeRemaining.value || ''}`;
};

onMounted(() => {
  if (props.autoGenerate) {
    generateQR();
  }
});

onUnmounted(() => {
  qrManager.resetQR();
});
</script>

<template>
  <div 
    class="qr-code-container" 
    role="region" 
    aria-label="Código QR Health Wallet"
    :aria-busy="isLoading"
  >
    <!-- Loading state -->
    <div v-if="isLoading" class="qr-loading" role="status" aria-live="polite">
      <div class="spinner"></div>
      <p>Generando código QR...</p>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="qr-error" role="alert" aria-live="assertive">
      <svg xmlns="http://www.w3.org/2000/svg" class="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p>{{ error }}</p>
      <button 
        v-if="showRefresh" 
        @click="refreshQR" 
        class="btn btn-error"
        aria-label="Reintentar generación de QR"
      >
        Reintentar
      </button>
    </div>

    <!-- Expired state -->
    <div v-else-if="isExpired" class="qr-expired" role="alert" aria-live="assertive">
      <svg xmlns="http://www.w3.org/2000/svg" class="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p>El código QR ha expirado</p>
      <button 
        v-if="showRefresh" 
        @click="refreshQR" 
        class="btn btn-primary"
        aria-label="Generar nuevo código QR"
      >
        Generar nuevo QR
      </button>
    </div>

    <!-- QR Code display -->
    <div 
      v-else-if="qrDataUrl" 
      class="qr-display" 
      :class="{ 'expiring-soon': isExpiringSoon, 'pharmacy-qr': props.forPharmacy }"
      :aria-label="getStatusAriaLabel()"
    >
      <!-- Status indicator bar -->
      <div class="status-bar" :style="{ backgroundColor: statusColor }" role="progressbar" :aria-valuenow="percentageRemaining" aria-valuemin="0" aria-valuemax="100">
        <div class="status-bar-fill" :style="{ width: `${percentageRemaining}%`, backgroundColor: statusColor }"></div>
      </div>

      <!-- Status badge -->
      <div class="status-badge" :class="qrManager.status">
        <span class="status-dot" :style="{ backgroundColor: statusColor }"></span>
        <span class="status-text">{{ getStatusText() }}</span>
      </div>

      <img
        :src="qrDataUrl"
        alt="Health Wallet QR Code"
        class="qr-image"
        :style="{ width: `${size}px`, height: `${size}px` }"
        loading="lazy"
      />

      <!-- Pharmacy badge -->
      <div v-if="props.forPharmacy" class="pharmacy-badge" role="img" aria-label="QR para farmacia">
        <svg xmlns="http://www.w3.org/2000/svg" class="icon-badge" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
        <span>QR Farmacia</span>
      </div>

      <!-- Expiration info with timer -->
      <div v-if="expiresAt" class="qr-expiration" aria-live="polite">
        <div class="expiration-time" :class="{ 'warning': isExpiringSoon, 'expired': isExpired }">
          <svg xmlns="http://www.w3.org/2000/svg" class="icon-sm" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span class="timer-display">{{ timeRemaining }}</span>
        </div>
        <p class="expiration-label">
          <span v-if="props.forPharmacy">Válido por {{ props.durationHours }} hora(s)</span>
          <span v-else>Válido por 24 horas</span>
        </p>
      </div>

      <!-- Refresh button -->
      <button 
        v-if="showRefresh" 
        @click="refreshQR" 
        class="qr-refresh" 
        title="Generar nuevo QR"
        aria-label="Regenerar código QR"
        :disabled="isLoading"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
    </div>

    <!-- Empty state -->
    <div v-else class="qr-empty" role="status">
      <svg xmlns="http://www.w3.org/2000/svg" class="icon-lg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h2M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
      </svg>
      <p>No hay código QR generado</p>
      <button 
        v-if="showRefresh" 
        @click="generateQR" 
        class="btn btn-primary"
        aria-label="Generar código QR"
      >
        Generar QR
      </button>
    </div>
  </div>
</template>

<style scoped>
.qr-code-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  max-width: 320px;
  width: 100%;
}

.qr-loading,
.qr-error,
.qr-expired,
.qr-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  text-align: center;
  color: #6b7280;
  width: 100%;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.qr-error {
  color: #ef4444;
}

.qr-error .icon {
  width: 40px;
  height: 40px;
  color: #ef4444;
}

.qr-expired {
  color: #f59e0b;
}

.qr-expired .icon {
  width: 40px;
  height: 40px;
  color: #f59e0b;
}

.qr-display {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  width: 100%;
}

.qr-display.expiring-soon .qr-image {
  animation: pulse 2s ease-in-out infinite;
  border-color: #f59e0b;
}

.qr-display.pharmacy-qr .qr-image {
  border-color: #10b981;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4);
  }
  50% {
    opacity: 0.8;
    box-shadow: 0 0 0 10px rgba(245, 158, 11, 0);
  }
}

.qr-image {
  border: 4px solid #f3f4f6;
  border-radius: 8px;
  padding: 0.5rem;
  background: white;
  transition: border-color 0.3s ease;
}

/* Status Bar - Progress indicator */
.status-bar {
  width: 100%;
  height: 4px;
  background: #e5e7eb;
  border-radius: 2px;
  overflow: hidden;
  position: relative;
}

.status-bar-fill {
  height: 100%;
  transition: width 1s linear, background-color 0.3s ease;
  border-radius: 2px;
}

/* Status Badge */
.status-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  background: #f3f4f6;
  transition: all 0.3s ease;
}

.status-badge.valid {
  background: #d1fae5;
  color: #065f46;
}

.status-badge.expiring-soon {
  background: #fef3c7;
  color: #92400e;
}

.status-badge.expired {
  background: #fee2e2;
  color: #991b1b;
}

.status-badge.loading {
  background: #dbeafe;
  color: #1e40af;
}

.status-badge.error {
  background: #fee2e2;
  color: #991b1b;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  animation: pulse-dot 2s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

.status-text {
  white-space: nowrap;
}

.qr-expiration {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.875rem;
}

.expiration-time {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-weight: 600;
  color: #10b981;
  transition: color 0.3s ease;
}

.expiration-time.warning {
  color: #f59e0b;
}

.expiration-time.expired {
  color: #ef4444;
}

.timer-display {
  font-family: 'Courier New', monospace;
  font-weight: 700;
}

.expiration-label {
  color: #6b7280;
  font-size: 0.75rem;
}

.qr-refresh {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #3b82f6;
  color: white;
  border: 2px solid white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.2s;
  padding: 0;
}

.qr-refresh:hover:not(:disabled) {
  background: #2563eb;
  transform: scale(1.1);
}

.qr-refresh:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.qr-refresh svg {
  width: 16px;
  height: 16px;
}

.pharmacy-badge {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  background: #10b981;
  color: white;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  white-space: nowrap;
  z-index: 10;
}

.icon-badge {
  width: 14px;
  height: 14px;
}

.qr-empty .icon-lg {
  width: 48px;
  height: 48px;
  color: #9ca3af;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: background 0.2s;
  font-weight: 500;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-error {
  background: #ef4444;
  color: white;
}

.btn-error:hover {
  background: #dc2626;
}

.icon {
  width: 40px;
  height: 40px;
}

.icon-sm {
  width: 16px;
  height: 16px;
}

.icon-lg {
  width: 48px;
  height: 48px;
}

/* Responsive adjustments */
@media (max-width: 640px) {
  .qr-code-container {
    max-width: 100%;
    padding: 1rem;
  }
}
</style>
