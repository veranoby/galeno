/**
 * useQRManager.ts
 * Composable para gestión de códigos QR del Health Wallet
 * TASK-008C: Interfaz de QR Dinámico con timer de expiración (24h)
 * 
 * Features:
 * - Generación de QR con expiración configurable
 * - Timer de cuenta regresiva visible
 * - Indicadores de estado (válido, por expirar, expirado)
 * - Regeneración de QR
 * - Integración con Health Wallet API
 */

import { ref, computed, onUnmounted, watch } from 'vue';
import { useApi } from '@/composables/useApi';
import { useHealthWallet } from '@/composables/useHealthWallet';

// Types
export type QRStatus = 'valid' | 'expiring-soon' | 'expired' | 'loading' | 'error';

export interface QRGenerationOptions {
  pacienteId: string;
  forPharmacy?: boolean;
  durationHours?: number;
}

export interface QRManagerState {
  qrDataUrl: string | null;
  expiresAt: Date | null;
  timeRemaining: string;
  status: QRStatus;
  error: string | null;
  isLoading: boolean;
  isExpired: boolean;
  isExpiringSoon: boolean;
  percentageRemaining: number;
}

export interface QRManagerActions {
  generateQR: (options: QRGenerationOptions) => Promise<void>;
  refreshQR: () => void;
  resetQR: () => void;
  getStatusColor: () => string;
  getStatusIcon: () => string;
}

// Constants
const DEFAULT_DURATION_HOURS = 24; // 24h default for Health Wallet
const PHARMACY_DEFAULT_DURATION = 1; // 1h for pharmacy QR
const EXPIRING_SOON_THRESHOLD_HOURS = 1; // Show warning when < 1h remaining

/**
 * Composable para gestión de QR dinámico con expiración
 */
export function useQRManager() {
  const api = useApi();
  const healthWallet = useHealthWallet();

  // State
  const qrDataUrl = ref<string | null>(null);
  const expiresAt = ref<Date | null>(null);
  const timeRemaining = ref<string>('');
  const status = ref<QRStatus>('loading');
  const error = ref<string | null>(null);
  const isLoading = ref(false);
  const initialDuration = ref<number>(DEFAULT_DURATION_HOURS);

  // Timer interval reference
  let expirationInterval: number | null = null;

  // Computed properties
  const isExpired = computed(() => {
    if (!expiresAt.value) return false;
    return new Date() > expiresAt.value;
  });

  const isExpiringSoon = computed(() => {
    if (!expiresAt.value) return false;
    const now = Date.now();
    const threshold = EXPIRING_SOON_THRESHOLD_HOURS * 60 * 60 * 1000;
    const remaining = expiresAt.value.getTime() - now;
    return remaining > 0 && remaining < threshold;
  });

  const percentageRemaining = computed(() => {
    if (!expiresAt.value || !initialDuration.value) return 0;

    const now = Date.now();
    const expirationTime = expiresAt.value.getTime();
    const creationTime = expirationTime - (initialDuration.value * 60 * 60 * 1000);
    const totalDuration = expirationTime - creationTime;
    const remaining = expirationTime - now;

    if (remaining <= 0) return 0;
    return Math.min(100, Math.max(0, (remaining / totalDuration) * 100));
  });

  const currentStatus = computed<QRStatus>(() => {
    if (isLoading.value) return 'loading';
    if (error.value) return 'error';
    if (isExpired.value) return 'expired';
    if (isExpiringSoon.value) return 'expiring-soon';
    return 'valid';
  });

  // Methods
  const updateTimeRemaining = () => {
    if (!expiresAt.value) {
      timeRemaining.value = '';
      return;
    }

    const now = Date.now();
    const remaining = expiresAt.value.getTime() - now;

    if (remaining <= 0) {
      timeRemaining.value = 'Expirado';
      status.value = 'expired';
      stopExpirationCheck();
      return;
    }

    const hours = Math.floor(remaining / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
    const seconds = Math.floor((remaining % (60 * 1000)) / 1000);

    if (hours > 0) {
      timeRemaining.value = `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      timeRemaining.value = `${minutes}m ${seconds}s`;
    } else {
      timeRemaining.value = `${seconds}s`;
    }
  };

  const startExpirationCheck = () => {
    if (expirationInterval) {
      clearInterval(expirationInterval);
    }

    // Update immediately
    updateTimeRemaining();

    // Then update every second
    expirationInterval = window.setInterval(() => {
      updateTimeRemaining();
      if (isExpired.value) {
        stopExpirationCheck();
      }
    }, 1000);
  };

  const stopExpirationCheck = () => {
    if (expirationInterval) {
      clearInterval(expirationInterval);
      expirationInterval = null;
    }
  };

  const extractExpirationFromQR = (qrDataUrl: string): Date | null => {
    try {
      // QR data is in format: data:image/png;base64,<base64-data>
      const base64Data = qrDataUrl.split(',')[1];
      if (!base64Data) return null;

      const jsonString = atob(base64Data);
      const qrContent = JSON.parse(jsonString);

      if (qrContent.expirationTime) {
        return new Date(qrContent.expirationTime);
      }
      return null;
    } catch (e) {
      console.warn('No se pudo extraer la fecha de expiración del QR', e);
      return null;
    }
  };

  const generateQR = async (options: QRGenerationOptions) => {
    const { pacienteId, forPharmacy = false, durationHours } = options;

    if (!pacienteId) {
      error.value = 'ID de paciente no proporcionado';
      status.value = 'error';
      throw new Error('pacienteId es requerido');
    }

    isLoading.value = true;
    error.value = null;
    status.value = 'loading';
    stopExpirationCheck();

    try {
      // Determine endpoint and duration
      const endpoint = forPharmacy ? '/pharmacy/generate-qr' : '/health-wallet/qr';
      const duration = durationHours ?? (forPharmacy ? PHARMACY_DEFAULT_DURATION : DEFAULT_DURATION_HOURS);

      // Store initial duration for percentage calculation
      initialDuration.value = duration;

      const body = forPharmacy
        ? { pacienteId, durationHours: duration }
        : { pacienteId };

      const response = await api.post<{ success: boolean; data?: { qr: string } }>(endpoint, body);

      if (response.data?.success && response.data?.data?.qr) {
        qrDataUrl.value = response.data.data.qr;

        // Extract expiration date from QR
        const extractedExpiration = extractExpirationFromQR(response.data.data.qr);
        if (extractedExpiration) {
          expiresAt.value = extractedExpiration;
          updateTimeRemaining();
          startExpirationCheck();
          status.value = 'valid';
        } else {
          // Fallback: calculate expiration based on duration
          expiresAt.value = new Date(Date.now() + (duration * 60 * 60 * 1000));
          updateTimeRemaining();
          startExpirationCheck();
          status.value = 'valid';
        }
      } else {
        throw new Error('Respuesta inválida del servidor');
      }
    } catch (err: any) {
      error.value = err.response?.data?.error || err.message || 'Error al generar QR';
      status.value = 'error';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const refreshQR = async (options?: Omit<QRGenerationOptions, 'pacienteId'>) => {
    // Preserve current pacienteId if available
    // This method is called from the component with full options
    if (options) {
      await generateQR(options as QRGenerationOptions);
    }
  };

  const resetQR = () => {
    stopExpirationCheck();
    qrDataUrl.value = null;
    expiresAt.value = null;
    timeRemaining.value = '';
    status.value = 'loading';
    error.value = null;
    isLoading.value = false;
    initialDuration.value = DEFAULT_DURATION_HOURS;
  };

  const getStatusColor = (): string => {
    switch (currentStatus.value) {
      case 'valid':
        return '#10b981'; // green-500
      case 'expiring-soon':
        return '#f59e0b'; // amber-500
      case 'expired':
        return '#ef4444'; // red-500
      case 'loading':
        return '#3b82f6'; // blue-500
      case 'error':
        return '#ef4444'; // red-500
      default:
        return '#6b7280'; // gray-500
    }
  };

  const getStatusIcon = (): string => {
    switch (currentStatus.value) {
      case 'valid':
        return 'check-circle';
      case 'expiring-soon':
        return 'alert-circle';
      case 'expired':
        return 'clock-alert';
      case 'loading':
        return 'loading';
      case 'error':
        return 'alert-octagon';
      default:
        return 'help-circle';
    }
  };

  // Watch status changes
  watch(currentStatus, (newStatus) => {
    // Status change tracking - can be used for analytics or debugging
  });

  // Cleanup on unmount
  onUnmounted(() => {
    stopExpirationCheck();
  });

  return {
    // State
    qrDataUrl,
    expiresAt,
    timeRemaining,
    status: currentStatus,
    error,
    isLoading,
    isExpired,
    isExpiringSoon,
    percentageRemaining,

    // Actions
    generateQR,
    refreshQR,
    resetQR,
    getStatusColor,
    getStatusIcon,

    // Constants
    DEFAULT_DURATION_HOURS,
    EXPIRING_SOON_THRESHOLD_HOURS,
  };
}
