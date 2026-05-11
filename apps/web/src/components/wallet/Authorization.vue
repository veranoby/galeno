<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useApi } from '@/composables/useApi';

interface Doctor {
  id: string;
  nombre: string;
  especialidad?: string | null;
}

interface ConsentRequest {
  id: string;
  pacienteId: string;
  doctorId: string;
  tipoAcceso: string;
  permisos: any;
  estado: string;
  fechaAutorizacion: Date | null;
  fechaExpiracion: Date | null;
  revocadaEn: Date | null;
  doctor: Doctor;
}

const props = defineProps<{
  pacienteId: string;
}>();

const emit = defineEmits<{
  (e: 'consent-granted', conexion: ConsentRequest): void;
  (e: 'consent-denied', conexion: ConsentRequest): void;
  (e: 'consent-revoked', conexion: ConsentRequest): void;
}>();

const api = useApi();
const loading = ref(false);
const requests = ref<ConsentRequest[]>([]);
const authorizedDoctors = ref<ConsentRequest[]>([]);
const error = ref<string | null>(null);

const hasPendingRequests = computed(() =>
  requests.value.some(r => r.estado === 'pendiente' || r.estado === 'activa')
);

async function loadConsentRequests() {
  loading.value = true;
  error.value = null;
  try {
    const response = await api.get<{ data: ConsentRequest[] }>(`/api/v1/health-wallet/${props.pacienteId}/consent-requests`);
    requests.value = response.data || [];
  } catch (err) {
    error.value = 'Error al cargar solicitudes de consentimiento';
    console.error('Error loading consent requests:', err);
  } finally {
    loading.value = false;
  }
}

async function loadAuthorizedDoctors() {
  loading.value = true;
  error.value = null;
  try {
    const response = await api.get<{ data: ConsentRequest[] }>(`/api/v1/health-wallet/${props.pacienteId}/connections`);
    authorizedDoctors.value = response.data || [];
  } catch (err) {
    error.value = 'Error al cargar doctores autorizados';
    console.error('Error loading authorized doctors:', err);
  } finally {
    loading.value = false;
  }
}

async function respondToConsent(conexionId: string, granted: boolean) {
  loading.value = true;
  error.value = null;
  try {
    const response = await api.post<{ data: ConsentRequest }>('/api/v1/health-wallet/grant-access', {
      conexionId,
      granted
    });

    const conexion = response.data;
    if (granted) {
      emit('consent-granted', conexion);
    } else {
      emit('consent-denied', conexion);
    }

    // Refresh lists
    await loadConsentRequests();
    await loadAuthorizedDoctors();
  } catch (err) {
    error.value = granted
      ? 'Error al conceder acceso'
      : 'Error al denegar acceso';
    console.error('Error responding to consent:', err);
  } finally {
    loading.value = false;
  }
}

async function revokeAccess(conexionId: string) {
  if (!confirm('¿Estás seguro de revocar el acceso a este doctor?')) {
    return;
  }

  loading.value = true;
  error.value = null;
  try {
    const response = await api.post<{ data: ConsentRequest }>('/api/v1/health-wallet/revoke-access', {
      conexionId
    });

    emit('consent-revoked', response.data);

    // Refresh lists
    await loadConsentRequests();
    await loadAuthorizedDoctors();
  } catch (err) {
    error.value = 'Error al revocar acceso';
    console.error('Error revoking access:', err);
  } finally {
    loading.value = false;
  }
}

function getAccessLevel(tipoAcceso: string): string {
  switch (tipoAcceso) {
    case 'COMPLETO':
      return 'Acceso completo a toda tu historia médica';
    case 'LIMITADO':
      return 'Acceso limitado a consultas específicas';
    case 'EMERGENCIA':
      return 'Acceso solo a datos vitales (emergencias)';
    default:
      return tipoAcceso;
  }
}

onMounted(() => {
  loadConsentRequests();
  loadAuthorizedDoctors();
});
</script>

<template>
  <div class="authorization-panel">
    <!-- Error Alert -->
    <div v-if="error" class="alert alert-error">
      {{ error }}
      <button @click="error = null" class="alert-close">×</button>
    </div>

    <!-- Pending Requests -->
    <section v-if="requests.length > 0" class="section">
      <h2 class="section-title">
        Solicitudes de Acceso Pendientes
        <span v-if="hasPendingRequests" class="badge badge-warning">{{ requests.length }}</span>
      </h2>

      <div v-if="loading && requests.length === 0" class="loading-state">
        Cargando solicitudes...
      </div>

      <div v-else class="requests-list">
        <div
          v-for="request in requests"
          :key="request.id"
          class="request-card"
          :class="{ 'request-active': request.estado === 'activa' }"
        >
          <div class="request-header">
            <div class="doctor-info">
              <h3 class="doctor-name">{{ request.doctor?.nombre }}</h3>
              <p v-if="request.doctor?.especialidad" class="doctor-specialty">
                {{ request.doctor.especialidad }}
              </p>
            </div>
            <span :class="['status-badge', `status-${request.estado}`]">
              {{ request.estado === 'activa' ? 'Activo' : 'Pendiente' }}
            </span>
          </div>

          <div class="request-details">
            <p class="access-level">
              <strong>Nivel de acceso:</strong> {{ getAccessLevel(request.tipoAcceso) }}
            </p>

            <p v-if="request.fechaAutorizacion" class="authorization-date">
              Autorizado: {{ new Date(request.fechaAutorizacion).toLocaleDateString() }}
            </p>

            <p v-if="request.fechaExpiracion" class="expiration-date">
              Expira: {{ new Date(request.fechaExpiracion).toLocaleDateString() }}
            </p>
          </div>

          <div class="request-actions">
            <button
              v-if="request.estado !== 'revocada'"
              @click="revokeAccess(request.id)"
              :disabled="loading"
              class="btn btn-danger"
            >
              {{ loading ? 'Procesando...' : 'Revocar Acceso' }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Authorized Doctors -->
    <section v-if="authorizedDoctors.length > 0" class="section">
      <h2 class="section-title">
        Doctores Autorizados
        <span class="badge badge-success">{{ authorizedDoctors.length }}</span>
      </h2>

      <div class="doctors-grid">
        <div
          v-for="conexion in authorizedDoctors"
          :key="conexion.id"
          class="doctor-card"
        >
          <div class="doctor-avatar">
            {{ conexion.doctor?.nombre?.charAt(0) || '?' }}
          </div>
          <div class="doctor-details">
            <h4 class="doctor-name">{{ conexion.doctor?.nombre }}</h4>
            <p v-if="conexion.doctor?.especialidad" class="doctor-specialty">
              {{ conexion.doctor.especialidad }}
            </p>
            <p class="access-type">{{ getAccessLevel(conexion.tipoAcceso) }}</p>
          </div>
          <button
            @click="revokeAccess(conexion.id)"
            :disabled="loading"
            class="btn btn-outline btn-sm"
            title="Revocar acceso"
          >
            Revocar
          </button>
        </div>
      </div>
    </section>

    <!-- Empty State -->
    <div v-if="!loading && requests.length === 0 && authorizedDoctors.length === 0" class="empty-state">
      <svg class="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
      <h3>No hay solicitudes pendientes</h3>
      <p>Cuando un doctor solicite acceso a tu historial médico, aparecerá aquí.</p>
    </div>
  </div>
</template>

<style scoped>
.authorization-panel {
  max-width: 800px;
  margin: 0 auto;
  padding: 1.5rem;
}

/* Alert */
.alert {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.alert-error {
  background: #fee;
  color: #c33;
  border: 1px solid #fcc;
}

.alert-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: inherit;
  opacity: 0.7;
}

.alert-close:hover {
  opacity: 1;
}

/* Section */
.section {
  margin-bottom: 2rem;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: #1f2937;
}

/* Badge */
.badge {
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 500;
}

.badge-warning {
  background: #fef3c7;
  color: #92400e;
}

.badge-success {
  background: #d1fae5;
  color: #065f46;
}

/* Request Card */
.requests-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.request-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 1.25rem;
  transition: all 0.2s;
}

.request-card:hover {
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
}

.request-active {
  border-color: #10b981;
  background: #f0fdf4;
}

.request-header {
  display: flex;
  justify-content: space-between;
  align-items: start;
  margin-bottom: 1rem;
}

.doctor-info h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
}

.doctor-specialty {
  color: #6b7280;
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.status-activa {
  background: #d1fae5;
  color: #065f46;
}

.status-pendiente {
  background: #fef3c7;
  color: #92400e;
}

.request-details {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
  color: #4b5563;
  font-size: 0.875rem;
}

.request-actions {
  display: flex;
  gap: 0.75rem;
}

/* Buttons */
.btn {
  padding: 0.625rem 1.25rem;
  border-radius: 8px;
  font-weight: 500;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-danger {
  background: #ef4444;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #dc2626;
}

.btn-outline {
  background: transparent;
  border: 1px solid #d1d5db;
  color: #374151;
}

.btn-outline:hover:not(:disabled) {
  background: #f9fafb;
  border-color: #9ca3af;
}

.btn-sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.8125rem;
}

/* Doctors Grid */
.doctors-grid {
  display: grid;
  gap: 1rem;
}

.doctor-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 1rem;
}

.doctor-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 1.25rem;
}

.doctor-details {
  flex: 1;
}

.doctor-details .doctor-name {
  font-size: 1rem;
  font-weight: 600;
  color: #111827;
  margin-bottom: 0.25rem;
}

.access-type {
  color: #6b7280;
  font-size: 0.8125rem;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 3rem 1.5rem;
}

.empty-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 1rem;
  color: #d1d5db;
}

.empty-state h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.5rem;
}

.empty-state p {
  color: #6b7280;
}

/* Loading State */
.loading-state {
  text-align: center;
  padding: 2rem;
  color: #6b7280;
}
</style>
