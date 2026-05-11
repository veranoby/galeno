<template>
  <v-container fluid class="share-consent-container">
    <div class="share-consent-header">
      <h1 class="text-h4 mb-2">Compartir mi Historial Médico</h1>
      <p class="text-body-2 text-medium-emphasis">
        Genera un token seguro para compartir tus datos de salud con un profesional
      </p>
    </div>

    <!-- LOPDP Compliance Banner -->
    <div class="lopdp-banner mb-6">
      <v-alert
        type="info"
        variant="tonal"
        density="compact"
        border="start"
      >
        <div class="d-flex align-start">
          <v-icon icon="mdi-shield-check" class="mr-2" />
          <div>
            <strong>Protegido por LOPDP</strong> (Lei Orgánica de Protección de Datos Personales - Ecuador)
            <ul class="mt-2 mb-0 pl-4">
              <li><strong>Art. 14:</strong> Tu consentimiento explícito es requerido</li>
              <li><strong>Art. 15:</strong> Puedes elegir permisos granulares</li>
              <li><strong>Art. 16:</strong> Puedes revocar acceso en cualquier momento</li>
            </ul>
          </div>
        </div>
      </v-alert>
    </div>

    <v-row>
      <!-- Step 1: Select Doctor -->
      <v-col cols="12" md="6">
        <v-card class="step-card" variant="outlined">
          <v-card-title class="d-flex align-center">
            <v-icon color="primary" class="mr-2">mdi-account-plus</v-icon>
            1. Seleccionar Doctor
          </v-card-title>
          <v-card-text>
            <v-autocomplete
              v-model="selectedDoctorId"
              :items="doctorsList"
              item-title="nombre"
              item-value="id"
              label="Buscar doctor por nombre o especialidad"
              placeholder="Ej: Dr. Juan Pérez, Cardiología..."
              clearable
              hide-details
              density="comfortable"
            >
              <template #item="{ props: itemProps, item }">
                <v-list-item v-bind="itemProps">
                  <template #subtitle>
                    {{ item.raw.especialidad || 'Medicina General' }}
                  </template>
                </v-list-item>
              </template>
            </v-autocomplete>

            <div v-if="selectedDoctorId" class="selected-doctor-info mt-3">
              <v-alert type="success" variant="tonal" density="compact">
                <strong>Doctor seleccionado:</strong>
                {{ getSelectedDoctorName }}
              </v-alert>
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Step 2: Select Permissions -->
      <v-col cols="12" md="6">
        <v-card class="step-card" variant="outlined">
          <v-card-title class="d-flex align-center">
            <v-icon color="primary" class="mr-2">mdi-lock-open-check</v-icon>
            2. Permisos de Acceso
          </v-card-title>
          <v-card-text>
            <p class="text-caption text-medium-emphasis mb-3">
              Selecciona qué información podrá ver el doctor
            </p>

            <v-list density="compact" class="permissions-list">
              <v-list-item>
                <template #prepend>
                  <v-checkbox-btn
                    v-model="permisos.verConsultas"
                    color="primary"
                  />
                </template>
                <v-list-item-title>
                  <v-icon icon="mdi-clipboard-text" size="small" class="mr-2" />
                  Consultas médicas
                </v-list-item-title>
                <template #append>
                  <v-chip size="x-small" color="primary" variant="tonal">Recomendado</v-chip>
                </template>
              </v-list-item>

              <v-list-item>
                <template #prepend>
                  <v-checkbox-btn
                    v-model="permisos.verDocumentos"
                    color="primary"
                  />
                </template>
                <v-list-item-title>
                  <v-icon icon="mdi-file-document" size="small" class="mr-2" />
                  Documentos y archivos
                </v-list-item-title>
              </v-list-item>

              <v-list-item>
                <template #prepend>
                  <v-checkbox-btn
                    v-model="permisos.verAntecedentes"
                    color="primary"
                  />
                </template>
                <v-list-item-title>
                  <v-icon icon="mdi-history" size="small" class="mr-2" />
                  Antecedentes médicos
                </v-list-item-title>
              </v-list-item>

              <v-list-item>
                <template #prepend>
                  <v-checkbox-btn
                    v-model="permisos.verRecetas"
                    color="primary"
                  />
                </template>
                <v-list-item-title>
                  <v-icon icon="mdi-pill" size="small" class="mr-2" />
                  Recetas médicas
                </v-list-item-title>
              </v-list-item>

              <v-list-item>
                <template #prepend>
                  <v-checkbox-btn
                    v-model="permisos.verExamenes"
                    color="primary"
                  />
                </template>
                <v-list-item-title>
                  <v-icon icon="mdi-test-tube" size="small" class="mr-2" />
                  Exámenes de laboratorio
                </v-list-item-title>
              </v-list-item>

              <v-list-item>
                <template #prepend>
                  <v-checkbox-btn
                    v-model="permisos.descargarDocumentos"
                    color="primary"
                  />
                </template>
                <v-list-item-title>
                  <v-icon icon="mdi-download" size="small" class="mr-2" />
                  Permitir descarga de documentos
                </v-list-item-title>
                <template #append>
                  <v-chip size="x-small" color="warning" variant="tonal">Opcional</v-chip>
                </template>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Step 3: Motivo y TTL -->
      <v-col cols="12">
        <v-card class="step-card" variant="outlined">
          <v-card-title class="d-flex align-center">
            <v-icon color="primary" class="mr-2">mdi-text-box-edit</v-icon>
            3. Motivo de la compartición
          </v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="12" md="8">
                <v-textarea
                  v-model="motivoComparticion"
                  label="Motivo por el cual compartes tu historial"
                  placeholder="Ej: Segunda opinión médica, consulta con especialista, referencia..."
                  rows="2"
                  counter="200"
                  maxlength="200"
                  hide-details="suspend"
                  density="comfortable"
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-select
                  v-model="ttlSeleccionado"
                  :items="ttlOptions"
                  label="Duración del acceso"
                  density="comfortable"
                  hide-details
                >
                  <template #item="{ props: itemProps, item }">
                    <v-list-item v-bind="itemProps">
                      <template #subtitle>
                        {{ item.raw.descripcion }}
                      </template>
                    </v-list-item>
                  </template>
                </v-select>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Step 4: Generate Token -->
      <v-col cols="12">
        <v-card class="step-card generate-card" color="primary" variant="tonal">
          <v-card-text class="text-center py-6">
            <v-btn
              size="x-large"
              color="primary"
              :loading="loading"
              :disabled="!canGenerate"
              @click="generarShareToken"
              class="px-8"
            >
              <v-icon icon="mdi-qrcode" class="mr-2" />
              Generar Token de Compartición
            </v-btn>

            <div v-if="!canGenerate" class="text-caption mt-2 text-medium-emphasis">
              <v-icon icon="mdi-information" size="small" class="mr-1" />
              Selecciona un doctor y al menos un permiso para continuar
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Generated Token Dialog -->
    <v-dialog v-model="dialogMostrado" max-width="600" persistent>
      <v-card>
        <v-card-title class="d-flex align-center justify-space-between">
          <div class="d-flex align-center">
            <v-icon color="success" class="mr-2">mdi-check-circle</v-icon>
            ¡Token Generado Exitosamente!
          </div>
          <v-btn icon variant="text" size="small" @click="cerrarDialog">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>

        <v-card-text class="pt-4">
          <!-- QR Code -->
          <div class="qr-container text-center mb-4">
            <img
              v-if="tokenGenerado?.qrData"
              :src="tokenGenerado.qrData"
              alt="ShareToken QR"
              class="qr-image"
            />
            <p class="text-caption text-medium-emphasis mt-2">
              Escanea este QR o comparte el enlace con el doctor
            </p>
          </div>

          <!-- Token Info -->
          <v-alert type="success" variant="tonal" density="compact" class="mb-4">
            <div class="d-flex justify-space-between align-center">
              <div>
                <strong>SharedSessionID:</strong><br>
                <code class="text-caption">{{ tokenGenerado?.sharedSessionId }}</code>
              </div>
              <v-btn
                size="small"
                variant="text"
                icon="mdi-content-copy"
                @click="copiarSessionId"
                title="Copiar Session ID"
              />
            </div>
          </v-alert>

          <!-- Expiration Warning -->
          <v-alert type="warning" variant="tonal" density="compact" class="mb-4">
            <v-icon icon="mdi-clock-alert" class="mr-2" />
            <strong>Expira en:</strong> {{ tiempoRestante }}
            <br>
            <span class="text-caption">
              El token es válido por {{ ttlSeleccionadoLabel }}. Después de este tiempo, deberás generar uno nuevo.
            </span>
          </v-alert>

          <!-- Actions -->
          <div class="d-flex gap-2 flex-wrap">
            <v-btn
              v-if="shareUrl"
              color="primary"
              variant="outlined"
              prepend-icon="mdi-link"
              @click="copiarEnlace"
              block
            >
              Copiar enlace
            </v-btn>
            <v-btn
              color="secondary"
              variant="outlined"
              prepend-icon="mdi-download"
              @click="descargarQR"
              block
            >
              Descargar QR
            </v-btn>
          </div>

          <!-- Instructions for Doctor -->
          <v-alert type="info" variant="tonal" density="compact" class="mt-4">
            <strong>Instrucciones para el doctor:</strong>
            <ol class="mt-1 mb-0 pl-4">
              <li>El doctor debe escanear este QR o hacer clic en el enlace</li>
              <li>Intercambiará el token por un SharedSessionID</li>
              <li>Podrá acceder a tu historial con los permisos que seleccionaste</li>
            </ol>
          </v-alert>
        </v-card-text>

        <v-card-actions>
          <v-btn color="primary" variant="text" block @click="cerrarDialog">
            Entendido
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Active Sessions -->
    <v-row v-if="sesionesActivas.length > 0" class="mt-8">
      <v-col cols="12">
        <v-card variant="outlined">
          <v-card-title class="d-flex align-center">
            <v-icon color="primary" class="mr-2">mdi-clock-outline</v-icon>
            Sesiones Compartidas Activas
          </v-card-title>
          <v-card-text>
            <v-list>
              <v-list-item
                v-for="sesion in sesionesActivas"
                :key="sesion.sharedSessionId"
                border
                class="mb-2"
              >
                <template #prepend>
                  <v-avatar color="primary">
                    <v-icon icon="mdi-doctor</v-icon>
                  </v-avatar>
                </template>
                <v-list-item-title>{{ sesion.doctorNombre }}</v-list-item-title>
                <v-list-item-subtitle>
                  {{ sesion.doctorEspecialidad }} • Expira: {{ formatearFecha(sesion.expiresAt) }}
                </v-list-item-subtitle>
                <template #append>
                  <v-chip
                    size="small"
                    :color="esExpiracionPronto(sesion.expiresAt) ? 'warning' : 'success'"
                    variant="tonal"
                  >
                    {{ calcularTiempoRestante(sesion.expiresAt) }}
                  </v-chip>
                  <v-btn
                    size="small"
                    color="error"
                    variant="text"
                    icon="mdi-cancel"
                    @click="revocarSesion(sesion.sharedSessionId)"
                    title="Revocar acceso"
                  />
                </template>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useApi } from '@/composables/useApi';
import { useAuth } from '@/composables/useAuth';

interface Doctor {
  id: string;
  nombre: string;
  especialidad?: string | null;
}

interface ShareTokenResponse {
  token: string;
  sharedSessionId: string;
  expiresAt: string;
  qrData: string;
}

interface SesionActiva {
  sharedSessionId: string;
  doctorId: string;
  doctorNombre: string;
  doctorEspecialidad?: string;
  expiresAt: string;
  permisos: {
    verConsultas: boolean;
    verDocumentos: boolean;
    verAntecedentes: boolean;
    verRecetas: boolean;
    verExamenes: boolean;
    descargarDocumentos: boolean;
  };
}

const api = useApi();
const auth = useAuth();

// State
const doctorsList = ref<Doctor[]>([]);
const selectedDoctorId = ref<string | null>(null);
const loading = ref(false);
const dialogMostrado = ref(false);
const tokenGenerado = ref<ShareTokenResponse | null>(null);
const sesionesActivas = ref<SesionActiva[]>([]);
const countdownInterval = ref<number | null>(null);

// Permisos
const permisos = ref({
  verConsultas: true,
  verDocumentos: false,
  verAntecedentes: true,
  verRecetas: false,
  verExamenes: false,
  descargarDocumentos: false
});

// Motivo y TTL
const motivoComparticion = ref('');
const ttlSeleccionado = ref(900); // 15 minutos default

const ttlOptions = [
  { value: 300, descripcion: '5 minutos - Acceso rápido' },
  { value: 900, descripcion: '15 minutos - Estándar' },
  { value: 1800, descripcion: '30 minutos - Consulta extendida' },
  { value: 3600, descripcion: '1 hora - Revisión completa' }
];

// Computed
const canGenerate = computed(() => {
  return (
    selectedDoctorId.value !== null &&
    (permisos.value.verConsultas ||
      permisos.value.verDocumentos ||
      permisos.value.verAntecedentes ||
      permisos.value.verRecetas ||
      permisos.value.verExamenes)
  );
});

const getSelectedDoctorName = computed(() => {
  const doctor = doctorsList.value.find(d => d.id === selectedDoctorId.value);
  return doctor ? `${doctor.nombre} - ${doctor.especialidad || 'Medicina General'}` : '';
});

const ttlSeleccionadoLabel = computed(() => {
  const option = ttlOptions.find(o => o.value === ttlSeleccionado.value);
  return option ? option.descripcion.split(' - ')[0] : '15 minutos';
});

const shareUrl = computed(() => {
  if (!tokenGenerado.value) return '';
  const baseUrl = import.meta.env.VITE_API_URL || window.location.origin;
  return `${baseUrl}/wallet/share?token=${tokenGenerado.value.token}&session=${tokenGenerado.value.sharedSessionId}`;
});

const tiempoRestante = ref('');

// Methods
async function cargarDoctores() {
  try {
    // TODO: Implementar endpoint para listar doctores
    // Por ahora, usamos un mock
    doctorsList.value = [
      { id: 'DOC-1', nombre: 'Dr. Juan Pérez', especialidad: 'Cardiología' },
      { id: 'DOC-2', nombre: 'Dra. María García', especialidad: 'Pediatría' },
      { id: 'DOC-3', nombre: 'Dr. Carlos López', especialidad: 'Medicina General' }
    ];
  } catch (error) {
    console.error('Error cargando doctores:', error);
  }
}

async function cargarSesionesActivas() {
  try {
    const response = await api.get<{ data: SesionActiva[] }>('/api/v1/wallet/share/sessions');
    sesionesActivas.value = (response.data as any)?.data || [];
    iniciarCountdown();
  } catch (error) {
    console.error('Error cargando sesiones activas:', error);
  }
}

async function generarShareToken() {
  if (!canGenerate.value || !auth.user?.id) return;

  loading.value = true;

  try {
    const response = await api.post<{ data: ShareTokenResponse }>('/api/v1/wallet/share/generate-token', {
      doctorSolicitanteId: selectedDoctorId.value,
      permisos: permisos.value,
      motivoComparticion: motivoComparticion.value || 'Compartición estándar',
      ttlSeconds: ttlSeleccionado.value
    });

    tokenGenerado.value = (response.data as any)?.data || null;
    dialogMostrado.value = true;

    // Recargar sesiones activas
    await cargarSesionesActivas();
  } catch (error: any) {
    console.error('Error generando token:', error);
    alert('Error al generar token: ' + (error.response?.data?.message || error.message));
  } finally {
    loading.value = false;
  }
}

async function revocarSesion(sharedSessionId: string) {
  if (!confirm('¿Estás seguro de revocar el acceso a esta sesión? El doctor ya no podrá ver tu historial.')) {
    return;
  }

  try {
    await api.post('/api/v1/wallet/share/revoke', {
      sharedSessionId
    });

    // Recargar sesiones
    await cargarSesionesActivas();
  } catch (error: any) {
    console.error('Error revocando sesión:', error);
    alert('Error al revocar acceso: ' + (error.response?.data?.message || error.message));
  }
}

function copiarSessionId() {
  if (tokenGenerado.value?.sharedSessionId) {
    navigator.clipboard.writeText(tokenGenerado.value.sharedSessionId);
  }
}

function copiarEnlace() {
  if (shareUrl.value) {
    navigator.clipboard.writeText(shareUrl.value);
  }
}

function descargarQR() {
  if (tokenGenerado.value?.qrData) {
    const link = document.createElement('a');
    link.href = tokenGenerado.value.qrData;
    link.download = `sharetoken-${tokenGenerado.value.sharedSessionId}.png`;
    link.click();
  }
}

function cerrarDialog() {
  dialogMostrado.value = false;
  tokenGenerado.value = null;
}

function formatearFecha(fecha: string): string {
  return new Date(fecha).toLocaleString('es-EC');
}

function esExpiracionPronto(fecha: string): boolean {
  const ahora = Date.now();
  const expiracion = new Date(fecha).getTime();
  const cincoMinutos = 5 * 60 * 1000;
  return expiracion - ahora < cincoMinutos;
}

function calcularTiempoRestante(fecha: string): string {
  const ahora = Date.now();
  const expiracion = new Date(fecha).getTime();
  const restante = expiracion - ahora;

  if (restante <= 0) return 'Expirado';

  const minutos = Math.floor(restante / 60000);
  if (minutos < 1) return '< 1 min';
  if (minutos < 60) return `${minutos} min`;

  const horas = Math.floor(minutos / 60);
  const minutosRestantes = minutos % 60;
  return `${horas}h ${minutosRestantes}m`;
}

function actualizarTiempoRestante() {
  if (tokenGenerado.value?.expiresAt) {
    const ahora = Date.now();
    const expiracion = new Date(tokenGenerado.value.expiresAt).getTime();
    const restante = expiracion - ahora;

    if (restante <= 0) {
      tiempoRestante.value = 'Expirado';
      if (countdownInterval.value) {
        clearInterval(countdownInterval.value);
      }
      return;
    }

    const minutos = Math.floor(restante / 60000);
    const segundos = Math.floor((restante % 60000) / 1000);
    tiempoRestante.value = `${minutos}m ${segundos}s`;
  }
}

function iniciarCountdown() {
  if (countdownInterval.value) {
    clearInterval(countdownInterval.value);
  }
  countdownInterval.value = window.setInterval(() => {
    actualizarTiempoRestante();
    cargarSesionesActivas(); // Recargar para verificar expiraciones
  }, 1000);
}

onMounted(() => {
  cargarDoctores();
  cargarSesionesActivas();
  iniciarCountdown();
});
</script>

<style scoped>
.share-consent-container {
  max-width: 1200px;
}

.share-consent-header {
  margin-bottom: 2rem;
}

.lopdp-banner {
  max-width: 800px;
}

.step-card {
  height: 100%;
}

.generate-card {
  border-width: 2px !important;
}

.permissions-list {
  background: transparent !important;
  padding: 0 !important;
}

.qr-container {
  background: #f5f5f5;
  padding: 1.5rem;
  border-radius: 8px;
}

.qr-image {
  max-width: 250px;
  height: auto;
  border: 4px solid #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.gap-2 {
  gap: 0.5rem;
}

.flex-wrap {
  flex-wrap: wrap;
}
</style>
