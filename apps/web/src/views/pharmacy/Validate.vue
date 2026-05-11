<script setup lang="ts">
/**
 * pharmacy/Validate.vue
 * TASK-019: Validación QR Farmacias
 * 
 * Pharmacy QR validation view with:
 * - Role-based access (FARMACIA only)
 * - Cryptographic QR validation
 * - Limited patient information display
 * - Expiration timer with regeneration
 */

import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useApi } from '@/composables/useApi';

interface PharmacyQRResponse {
  isValid: boolean;
  expiresAt: string;
  walletId: string;
  patientInfo: {
    id: string;
    nombre: string;
    cedula: string;
    fechaNacimiento: Date;
    email: string | null;
    telefono: string | null;
  };
}

interface QRError {
  code: string;
  message: string;
}

const router = useRouter();
const authStore = useAuthStore();
const api = useApi();

// State
const isLoading = ref(false);
const isScanning = ref(false);
const error = ref<string | null>(null);
const qrError = ref<QRError | null>(null);
const validationResult = ref<PharmacyQRResponse | null>(null);
const scannedQRData = ref<string>('');
const timeRemaining = ref<string>('');
const isExpired = ref(false);
const isExpiringSoon = ref(false);

// Timer interval
let expirationInterval: number | null = null;

// Computed
const canRegenerate = computed(() => {
  return isExpired.value || isExpiringSoon.value;
});

const validationStatus = computed(() => {
  if (isLoading.value) return 'loading';
  if (error.value) return 'error';
  if (validationResult.value?.isValid) return 'valid';
  return 'invalid';
});

const patientAge = computed(() => {
  if (!validationResult.value?.patientInfo.fechaNacimiento) return '';
  
  const birthDate = new Date(validationResult.value.patientInfo.fechaNacimiento);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return `${age} años`;
});

const statusClass = computed(() => {
  if (isExpired.value) return 'expired';
  if (isExpiringSoon.value) return 'warning';
  return 'valid';
});

const statusText = computed(() => {
  if (isExpired.value) return 'Expirado';
  if (isExpiringSoon.value) return 'Expirando pronto';
  return 'Válido';
});

// Methods
const verifyPharmacyRole = () => {
  const userRole = authStore.user?.rol;
  if (userRole !== 'FARMACIA') {
    error.value = 'Acceso restringido: Solo personal de farmacia autorizado';
    setTimeout(() => {
      router.push('/hub');
    }, 3000);
    return false;
  }
  return true;
};

const calculateTimeRemaining = (expiresAt: string) => {
  const now = Date.now();
  const expiration = new Date(expiresAt).getTime();
  const remaining = expiration - now;

  if (remaining <= 0) {
    timeRemaining.value = 'Expirado';
    isExpired.value = true;
    isExpiringSoon.value = false;
    stopExpirationCheck();
    return;
  }

  isExpired.value = false;
  
  // Check if expiring soon (less than 5 minutes)
  isExpiringSoon.value = remaining < 5 * 60 * 1000;

  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

  if (hours > 0) {
    timeRemaining.value = `${hours}h ${minutes}m ${seconds}s`;
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

  expirationInterval = window.setInterval(() => {
    if (validationResult.value?.expiresAt) {
      calculateTimeRemaining(validationResult.value.expiresAt);
    }
  }, 1000);
};

const stopExpirationCheck = () => {
  if (expirationInterval) {
    clearInterval(expirationInterval);
    expirationInterval = null;
  }
};

const validateQR = async (qrData: string) => {
  if (!qrData || qrData.trim() === '') {
    error.value = 'Por favor escanee o ingrese el código QR';
    return;
  }

  isLoading.value = true;
  error.value = null;
  qrError.value = null;
  validationResult.value = null;

  try {
    const response = await api.post<PharmacyQRResponse>('/pharmacy/validate-qr', {
      qrData: qrData.trim()
    });

    if (response.success && response.data) {
      validationResult.value = response.data;
      scannedQRData.value = qrData;
      
      // Start expiration timer
      calculateTimeRemaining(response.data.expiresAt);
      startExpirationCheck();
    } else {
      throw new Error(response.error || 'Error al validar QR');
    }
  } catch (err: any) {
    console.error('QR validation error:', err);
    
    // Handle specific error types
    if (err.response?.data?.error) {
      qrError.value = {
        code: err.response.data.error,
        message: err.response.data.message || 'Error de validación'
      };
      
      if (err.response.data.error === 'QR Expired') {
        isExpired.value = true;
      }
    } else {
      error.value = err.message || 'Error de conexión con el servidor';
    }
  } finally {
    isLoading.value = false;
    isScanning.value = false;
  }
};

const handleQRScan = (scannedData: string) => {
  scannedQRData.value = scannedData;
  validateQR(scannedData);
};

const handleManualEntry = () => {
  const qrData = prompt('Ingrese el código QR manualmente:');
  if (qrData) {
    validateQR(qrData);
  }
};

const regenerateQR = () => {
  // Reset state for new scan
  validationResult.value = null;
  scannedQRData.value = '';
  error.value = null;
  qrError.value = null;
  isExpired.value = false;
  isExpiringSoon.value = false;
  timeRemaining.value = '';
  stopExpirationCheck();
  isScanning.value = true;
};

const printValidation = () => {
  if (!validationResult.value) return;
  window.print();
};

// Lifecycle
onMounted(() => {
  if (!verifyPharmacyRole()) {
    return;
  }
  isScanning.value = true;
});

onUnmounted(() => {
  stopExpirationCheck();
});
</script>

<template>
  <div class="pharmacy-validate-container">
    <!-- Header -->
    <div class="validate-header">
      <div class="header-content">
        <h1>
          <svg xmlns="http://www.w3.org/2000/svg" class="icon-header" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          Validación QR - Farmacia
        </h1>
        <p class="subtitle">Verificación criptográfica de códigos QR del Health Wallet</p>
      </div>
    </div>

    <!-- Role Warning -->
    <div v-if="error && error.includes('Acceso restringido')" class="alert alert-error">
      <svg xmlns="http://www.w3.org/2000/svg" class="icon-alert" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <div>
        <h3>Acceso Denegado</h3>
        <p>{{ error }}</p>
      </div>
    </div>

    <!-- Main Content -->
    <div v-else class="validate-content">
      <!-- Scanning Section -->
      <div v-if="!validationResult && !isLoading" class="scan-section">
        <div class="scan-card">
          <div class="scan-icon">
            <svg xmlns="http://www.w3.org/2000/svg" class="icon-qr" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h2M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
          </div>
          
          <h2>Escanear Código QR</h2>
          <p class="scan-description">
            Escanee el código QR del paciente para validar su autenticidad y verificar el período de validez
          </p>

          <div class="scan-actions">
            <button @click="handleManualEntry" class="btn btn-primary btn-lg">
              <svg xmlns="http://www.w3.org/2000/svg" class="icon-btn" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Ingresar QR Manualmente
            </button>
            
            <div class="scan-hint">
              <svg xmlns="http://www.w3.org/2000/svg" class="icon-hint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>El paciente debe mostrar el código QR desde su Health Wallet</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="loading-section">
        <div class="loading-spinner">
          <div class="spinner"></div>
          <p>Validando código QR...</p>
          <p class="loading-subtitle">Verificando firma criptográfica y período de validez</p>
        </div>
      </div>

      <!-- Error State -->
      <div v-if="qrError" class="error-section">
        <div class="error-card">
          <svg xmlns="http://www.w3.org/2000/svg" class="icon-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3>Error de Validación</h3>
          <p class="error-code">{{ qrError.code }}</p>
          <p class="error-message">{{ qrError.message }}</p>
          
          <button @click="regenerateQR" class="btn btn-primary">
            <svg xmlns="http://www.w3.org/2000/svg" class="icon-btn" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Intentar Nuevamente
          </button>
        </div>
      </div>

      <!-- Validation Result -->
      <div v-if="validationResult" class="result-section">
        <!-- Success Banner -->
        <div class="success-banner" :class="{ 'expiring-soon': isExpiringSoon, 'expired': isExpired }">
          <svg v-if="!isExpired" xmlns="http://www.w3.org/2000/svg" class="icon-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" class="icon-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div class="banner-content">
            <h3 v-if="!isExpired">
              <span v-if="isExpiringSoon">⚠️ QR Válido - Expirando Pronto</span>
              <span v-else>✓ QR Válido y Auténtico</span>
            </h3>
            <h3 v-else>✗ QR Expirado</h3>
            <p>
              <span v-if="!isExpired">El código QR ha sido verificado criptográficamente</span>
              <span v-else>El código QR ha expirado. Solicite al paciente que genere uno nuevo.</span>
            </p>
          </div>
        </div>

        <div class="result-grid">
          <!-- Patient Info Card -->
          <div class="info-card">
            <div class="card-header">
              <h4>
                <svg xmlns="http://www.w3.org/2000/svg" class="icon-card" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Información del Paciente
              </h4>
              <span class="access-badge">Acceso Limitado</span>
            </div>
            
            <div class="patient-info">
              <div class="info-row">
                <span class="label">Nombre:</span>
                <span class="value">{{ validationResult.patientInfo.nombre }}</span>
              </div>
              <div class="info-row">
                <span class="label">Cédula:</span>
                <span class="value">{{ validationResult.patientInfo.cedula }}</span>
              </div>
              <div class="info-row">
                <span class="label">Fecha de Nacimiento:</span>
                <span class="value">
                  {{ new Date(validationResult.patientInfo.fechaNacimiento).toLocaleDateString('es-EC') }}
                  ({{ patientAge }})
                </span>
              </div>
              <div class="info-row" v-if="validationResult.patientInfo.email">
                <span class="label">Email:</span>
                <span class="value">{{ validationResult.patientInfo.email }}</span>
              </div>
              <div class="info-row" v-if="validationResult.patientInfo.telefono">
                <span class="label">Teléfono:</span>
                <span class="value">{{ validationResult.patientInfo.telefono }}</span>
              </div>
            </div>

            <div class="access-notice">
              <svg xmlns="http://www.w3.org/2000/svg" class="icon-notice" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>
                <strong>Nota:</strong> Por privacidad, el acceso de farmacia no incluye historial médico completo, 
                antecedentes ni consultas. Solo información básica de identificación.
              </p>
            </div>
          </div>

          <!-- QR Validity Card -->
          <div class="info-card">
            <div class="card-header">
              <h4>
                <svg xmlns="http://www.w3.org/2000/svg" class="icon-card" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Validez del QR
              </h4>
            </div>
            
            <div class="validity-info">
              <div class="validity-row">
                <span class="label">Wallet ID:</span>
                <span class="value code">{{ validationResult.walletId }}</span>
              </div>
              <div class="validity-row">
                <span class="label">Estado:</span>
                <span class="value" :class="statusClass">
                  {{ statusText }}
                </span>
              </div>
              <div class="validity-row">
                <span class="label">Tiempo Restante:</span>
                <span class="value timer" :class="{ 'warning': isExpiringSoon, 'expired': isExpired }">
                  {{ timeRemaining }}
                </span>
              </div>
              <div class="validity-row">
                <span class="label">Expira:</span>
                <span class="value">
                  {{ new Date(validationResult.expiresAt).toLocaleString('es-EC') }}
                </span>
              </div>
            </div>

            <div class="validity-actions">
              <button 
                @click="regenerateQR" 
                class="btn btn-primary"
                :disabled="!canRegenerate"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="icon-btn" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {{ isExpired ? 'Validar Nuevo QR' : 'Regenerar QR' }}
              </button>
              
              <button @click="printValidation" class="btn btn-secondary">
                <svg xmlns="http://www.w3.org/2000/svg" class="icon-btn" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Imprimir Comprobante
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pharmacy-validate-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.validate-header {
  margin-bottom: 2rem;
}

.header-content h1 {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 1.875rem;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 0.5rem;
}

.icon-header {
  width: 2rem;
  height: 2rem;
  color: #10b981;
}

.subtitle {
  color: #6b7280;
  font-size: 1rem;
}

/* Alerts */
.alert {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  border-radius: 0.5rem;
  margin-bottom: 2rem;
}

.alert-error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #991b1b;
}

.icon-alert {
  width: 1.5rem;
  height: 1.5rem;
  flex-shrink: 0;
}

.alert h3 {
  font-weight: 600;
  margin-bottom: 0.25rem;
}

/* Scan Section */
.scan-section {
  display: flex;
  justify-content: center;
  padding: 3rem 0;
}

.scan-card {
  background: white;
  padding: 3rem;
  border-radius: 1rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  text-align: center;
  max-width: 500px;
}

.scan-icon {
  margin-bottom: 1.5rem;
}

.icon-qr {
  width: 5rem;
  height: 5rem;
  color: #3b82f6;
}

.scan-card h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 0.75rem;
}

.scan-description {
  color: #6b7280;
  margin-bottom: 2rem;
  line-height: 1.5;
}

.scan-actions {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.scan-hint {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: #eff6ff;
  border-radius: 0.5rem;
  color: #1e40af;
  font-size: 0.875rem;
}

.icon-hint {
  width: 1.25rem;
  height: 1.25rem;
  flex-shrink: 0;
}

/* Loading */
.loading-section {
  display: flex;
  justify-content: center;
  padding: 4rem 0;
}

.loading-spinner {
  text-align: center;
}

.spinner {
  width: 3rem;
  height: 3rem;
  border: 3px solid #e5e7eb;
  border-top-color: #10b981;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-spinner p {
  color: #374151;
  font-weight: 500;
}

.loading-subtitle {
  color: #6b7280;
  font-size: 0.875rem;
  margin-top: 0.5rem;
}

/* Error */
.error-section {
  display: flex;
  justify-content: center;
  padding: 3rem 0;
}

.error-card {
  background: white;
  padding: 2rem;
  border-radius: 0.75rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  text-align: center;
  max-width: 400px;
}

.icon-error {
  width: 3rem;
  height: 3rem;
  color: #ef4444;
  margin: 0 auto 1rem;
}

.error-card h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 0.5rem;
}

.error-code {
  font-weight: 600;
  color: #ef4444;
  margin-bottom: 0.5rem;
}

.error-message {
  color: #6b7280;
  margin-bottom: 1.5rem;
}

/* Result Section */
.result-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.success-banner {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
  border-radius: 0.75rem;
  background: #ecfdf5;
  border: 2px solid #10b981;
}

.success-banner.expiring-soon {
  background: #fffbeb;
  border-color: #f59e0b;
}

.success-banner.expired {
  background: #fef2f2;
  border-color: #ef4444;
}

.icon-success {
  width: 2.5rem;
  height: 2.5rem;
  flex-shrink: 0;
}

.success-banner:not(.expired) .icon-success {
  color: #10b981;
}

.success-banner.expiring-soon .icon-success {
  color: #f59e0b;
}

.success-banner.expired .icon-success {
  color: #ef4444;
}

.banner-content h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.success-banner:not(.expired) .banner-content h3 {
  color: #065f46;
}

.success-banner.expiring-soon .banner-content h3 {
  color: #92400e;
}

.success-banner.expired .banner-content h3 {
  color: #991b1b;
}

.banner-content p {
  color: #6b7280;
}

/* Result Grid */
.result-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 1.5rem;
}

.info-card {
  background: white;
  border-radius: 0.75rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.card-header h4 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.125rem;
  font-weight: 600;
  color: #1f2937;
}

.icon-card {
  width: 1.25rem;
  height: 1.25rem;
  color: #3b82f6;
}

.access-badge {
  background: #fef3c7;
  color: #92400e;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.patient-info,
.validity-info {
  padding: 1.5rem;
}

.info-row,
.validity-row {
  display: flex;
  padding: 0.75rem 0;
  border-bottom: 1px solid #f3f4f6;
}

.info-row:last-child,
.validity-row:last-child {
  border-bottom: none;
}

.label {
  font-weight: 500;
  color: #6b7280;
  width: 180px;
  flex-shrink: 0;
}

.value {
  color: #1f2937;
  font-weight: 400;
}

.value.code {
  font-family: monospace;
  font-size: 0.875rem;
  background: #f3f4f6;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
}

.timer {
  font-weight: 700;
  font-size: 1.125rem;
}

.timer.warning {
  color: #f59e0b;
}

.timer.expired {
  color: #ef4444;
}

.access-notice {
  display: flex;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  background: #eff6ff;
  border-top: 1px solid #dbeafe;
  color: #1e40af;
  font-size: 0.875rem;
  line-height: 1.5;
}

.icon-notice {
  width: 1.25rem;
  height: 1.25rem;
  flex-shrink: 0;
}

.validity-actions {
  display: flex;
  gap: 1rem;
  padding: 1rem 1.5rem;
  background: #f9fafb;
  border-top: 1px solid #e5e7eb;
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  border-radius: 0.5rem;
  font-weight: 500;
  font-size: 0.875rem;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.icon-btn {
  width: 1.25rem;
  height: 1.25rem;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-secondary {
  background: white;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-secondary:hover:not(:disabled) {
  background: #f9fafb;
}

.btn-lg {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
}

/* Responsive */
@media (max-width: 768px) {
  .pharmacy-validate-container {
    padding: 1rem;
  }

  .result-grid {
    grid-template-columns: 1fr;
  }

  .info-row,
  .validity-row {
    flex-direction: column;
    gap: 0.25rem;
  }

  .label {
    width: 100%;
  }

  .validity-actions {
    flex-direction: column;
  }

  .btn {
    width: 100%;
    justify-content: center;
  }
}

/* Print styles */
@media print {
  .scan-section,
  .scan-actions,
  .validity-actions {
    display: none;
  }

  .success-banner {
    border: 2px solid #000;
  }

  .info-card {
    box-shadow: none;
    border: 1px solid #000;
  }
}
</style>
