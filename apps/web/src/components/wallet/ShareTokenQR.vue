<template>
  <v-card class="share-token-qr-component" variant="outlined">
    <v-card-title class="d-flex align-center">
      <v-icon color="primary" class="mr-2">mdi-qrcode-scan</v-icon>
      Acceder a Historial Compartido
    </v-card-title>

    <v-card-text>
      <!-- LOPDP Info Banner -->
      <v-alert
        type="info"
        variant="tonal"
        density="compact"
        class="mb-4"
      >
        <div class="d-flex align-start">
          <v-icon icon="mdi-shield-lock" class="mr-2" />
          <div>
            <strong>Acceso LOPDP Compliance</strong>
            <p class="text-caption mt-1 mb-0">
              Este token te otorga acceso temporal al historial médico del paciente con su consentimiento explícito
            </p>
          </div>
        </div>
      </v-alert>

      <!-- Tab System -->
      <v-tabs v-model="tabActivo" class="mb-4">
        <v-tab value="qr">
          <v-icon icon="mdi-qrcode" class="mr-2" />
          Escanear QR
        </v-tab>
        <v-tab value="manual">
          <v-icon icon="mdi-keyboard" class="mr-2" />
          Ingreso Manual
        </v-tab>
        <v-tab value="link">
          <v-icon icon="mdi-link" class="mr-2" />
          Usar Enlace
        </v-tab>
      </v-tabs>

      <v-window v-model="tabActivo">
        <!-- QR Scan Tab -->
        <v-window-item value="qr">
          <div class="qr-scan-container text-center py-6">
            <div v-if="!qrEscaneado" class="scan-placeholder">
              <v-icon icon="mdi-qrcode-scan" size="64" color="medium-emphasis" class="mb-2" />
              <p class="text-body-2 text-medium-emphasis mb-4">
                Escanea el código QR proporcionado por el paciente
              </p>
              <v-btn
                color="primary"
                variant="outlined"
                prepend-icon="mdi-camera"
                @click="iniciarEscaneoQR"
              >
                Abrir cámara
              </v-btn>
              <p class="text-caption text-medium-emphasis mt-3">
                También puedes subir una imagen del QR
              </p>
              <v-btn
                color="secondary"
                variant="text"
                size="small"
                class="mt-2"
                @click="triggerFileInput"
              >
                Subir imagen QR
              </v-btn>
              <input
                ref="fileInputRef"
                type="file"
                accept="image/*"
                style="display: none"
                @change="procesarImagenQR"
              />
            </div>

            <div v-else-if="procesandoQR" class="scan-processing">
              <v-progress-circular indeterminate color="primary" class="mb-2" />
              <p>Procesando código QR...</p>
            </div>

            <div v-else-if="errorQR" class="scan-error">
              <v-icon icon="mdi-alert-circle" size="48" color="error" class="mb-2" />
              <p class="text-error">{{ errorQR }}</p>
              <v-btn
                color="primary"
                variant="text"
                size="small"
                class="mt-2"
                @click="reiniciarEscaneo"
              >
                Reintentar
              </v-btn>
            </div>
          </div>
        </v-window-item>

        <!-- Manual Input Tab -->
        <v-window-item value="manual">
          <div class="manual-input-container py-4">
            <p class="text-body-2 text-medium-emphasis mb-4">
              Ingresa el ShareToken o SharedSessionID proporcionado por el paciente
            </p>

            <v-textarea
              v-model="tokenManual"
              label="ShareToken JWT o SharedSessionID"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              rows="3"
              variant="outlined"
              density="comfortable"
              hide-details="suspend"
              class="mb-3"
            />

            <v-btn
              color="primary"
              block
              :loading="intercambiando"
              :disabled="!tokenManual"
              @click="intercambiarTokenManual"
            >
              <v-icon icon="mdi-key" class="mr-2" />
              Intercambiar Token
            </v-btn>
          </div>
        </v-window-item>

        <!-- Link Tab -->
        <v-window-item value="link">
          <div class="link-container py-4">
            <p class="text-body-2 text-medium-emphasis mb-4">
              Si recibiste un enlace del paciente, haz clic en el botón abaixo
            </p>

            <v-alert type="info" variant="tonal" density="compact" class="mb-4">
              <v-icon icon="mdi-information" class="mr-2" />
              El enlace debe tener el formato:
              <code class="text-caption d-block mt-1">
                https://galeno.ec/wallet/share?token=...&session=...
              </code>
            </v-alert>

            <v-btn
              color="primary"
              block
              variant="outlined"
              prepend-icon="mdi-link-variant"
              @click="verificarEnlaceActual"
            >
              Verificar enlace actual
            </v-btn>
          </div>
        </v-window-item>
      </v-window>

      <!-- Session Info (after successful exchange) -->
      <div v-if="sesionActiva" class="session-info mt-6">
        <v-divider class="mb-4" />

        <v-alert type="success" variant="tonal" border="start">
          <div class="d-flex align-start">
            <v-icon icon="mdi-check-circle" class="mr-2" />
            <div class="flex-grow-1">
              <strong>¡Acceso concedido!</strong>
              <p class="mb-2">
                Tienes acceso temporal al historial de <strong>{{ sesionActiva.pacienteInfo.nombre }}</strong>
              </p>

              <v-list density="compact" class="bg-transparent">
                <v-list-item>
                  <template #prepend>
                    <v-icon icon="mdi-account" size="small" />
                  </template>
                  <v-list-item-title>Paciente</v-list-item-title>
                  <v-list-item-subtitle>{{ sesionActiva.pacienteInfo.nombre }}</v-list-item-subtitle>
                </v-list-item>

                <v-list-item>
                  <template #prepend>
                    <v-icon icon="mdi-clock-outline" size="small" />
                  </template>
                  <v-list-item-title>Expira en</v-list-item-title>
                  <v-list-item-subtitle :class="expiracionPronto ? 'text-warning' : 'text-success'">
                    {{ tiempoRestante }}
                  </v-list-item-subtitle>
                </v-list-item>

                <v-list-item>
                  <template #prepend>
                    <v-icon icon="mdi-lock-check" size="small" />
                  </template>
                  <v-list-item-title>Permisos</v-list-item-title>
                  <v-list-item-subtitle>
                    <v-chip-group>
                      <v-chip
                        v-if="sesionActiva.permisos?.verConsultas"
                        size="x-small"
                        color="primary"
                        variant="tonal"
                      >
                        Consultas
                      </v-chip>
                      <v-chip
                        v-if="sesionActiva.permisos?.verDocumentos"
                        size="x-small"
                        color="primary"
                        variant="tonal"
                      >
                        Documentos
                      </v-chip>
                      <v-chip
                        v-if="sesionActiva.permisos?.verAntecedentes"
                        size="x-small"
                        color="primary"
                        variant="tonal"
                      >
                        Antecedentes
                      </v-chip>
                      <v-chip
                        v-if="sesionActiva.permisos?.verRecetas"
                        size="x-small"
                        color="primary"
                        variant="tonal"
                      >
                        Recetas
                      </v-chip>
                      <v-chip
                        v-if="sesionActiva.permisos?.verExamenes"
                        size="x-small"
                        color="primary"
                        variant="tonal"
                      >
                        Exámenes
                      </v-chip>
                    </v-chip-group>
                  </v-list-item-subtitle>
                </v-list-item>
              </v-list>

              <div class="d-flex gap-2 mt-3">
                <v-btn
                  color="primary"
                  variant="tonal"
                  size="small"
                  prepend-icon="mdi-book-open-page-variant"
                  @click="$emit('ver-historial', sesionActiva)"
                >
                  Ver historial
                </v-btn>
                <v-btn
                  color="medium-emphasis"
                  variant="text"
                  size="small"
                  @click="reiniciarComponente"
                >
                  Nueva compartición
                </v-btn>
              </div>
            </div>
          </div>
        </v-alert>
      </div>

      <!-- Loading State -->
      <v-overlay
        v-model="intercambiando"
        class="align-center justify-center"
        contained
      >
        <v-card class="pa-4" max-width="300">
          <v-card-text class="text-center">
            <v-progress-circular indeterminate color="primary" class="mb-2" />
            <p>Intercambiando token...</p>
          </v-card-text>
        </v-card>
      </v-overlay>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useApi } from '@/composables/useApi';
import { useAuth } from '@/composables/useAuth';

interface Emits {
  (e: 'token-exchanged', session: any): void;
  (e: 'ver-historial', session: any): void;
  (e: 'error', error: string): void;
}

const emit = defineEmits<Emits>();

const api = useApi();
const auth = useAuth();

// State
const tabActivo = ref('qr');
const qrEscaneado = ref(false);
const procesandoQR = ref(false);
const errorQR = ref<string | null>(null);
const tokenManual = ref('');
const intercambiando = ref(false);
const sesionActiva = ref<any>(null);
const countdownInterval = ref<number | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);

// Computed
const expiracionPronto = computed(() => {
  if (!sesionActiva.value?.expiresAt) return false;
  const ahora = Date.now();
  const expiracion = new Date(sesionActiva.value.expiresAt).getTime();
  const cincoMinutos = 5 * 60 * 1000;
  return expiracion - ahora < cincoMinutos;
});

const tiempoRestante = computed(() => {
  if (!sesionActiva.value?.expiresAt) return '';

  const ahora = Date.now();
  const expiracion = new Date(sesionActiva.value.expiresAt).getTime();
  const restante = expiracion - ahora;

  if (restante <= 0) return 'Expirado';

  const minutos = Math.floor(restante / 60000);
  if (minutos < 1) return '< 1 min';
  if (minutos < 60) return `${minutos}m`;

  const horas = Math.floor(minutos / 60);
  const minutosRestantes = minutos % 60;
  return `${horas}h ${minutosRestantes}m`;
});

// Methods
function triggerFileInput() {
  fileInputRef.value?.click();
}

async function iniciarEscaneoQR() {
  // TODO: Implementar escaneo QR real con librería como html5-qrcode
  // Por ahora, simulamos el escaneo
  qrEscaneado.value = true;
  procesandoQR.value = true;

  // Simulación - en producción usar librería real
  setTimeout(() => {
    procesandoQR.value = false;
    // Simular QR exitoso con datos mock
    const mockToken = 'mock-jwt-token-12345';
    procesarQR(mockToken);
  }, 2000);
}

async function procesarImagenQR(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];

  if (!file) return;

  qrEscaneado.value = true;
  procesandoQR.value = true;

  try {
    // TODO: Implementar lectura de QR desde imagen
    // Usar librería como jsQR o @zxing/library
    const reader = new FileReader();
    reader.onload = async (e) => {
      const imageData = e.target?.result as string;

      // Simulación - en producción procesar imagen real
      setTimeout(() => {
        procesandoQR.value = false;
        const mockToken = 'mock-jwt-token-from-image';
        procesarQR(mockToken);
      }, 2000);
    };
    reader.readAsDataURL(file);
  } catch (error) {
    procesandoQR.value = false;
    errorQR.value = 'Error al procesar la imagen QR';
    console.error('Error processing QR image:', error);
  }
}

async function procesarQR(token: string) {
  if (!token) {
    errorQR.value = 'QR inválido o vacío';
    return;
  }

  procesandoQR.value = true;
  errorQR.value = null;

  try {
    await intercambiarToken(token);
    qrEscaneado.value = true;
  } catch (error: any) {
    procesandoQR.value = false;
    errorQR.value = error.response?.data?.message || 'Error al procesar QR';
    emit('error', errorQR.value);
  }
}

async function intercambiarTokenManual() {
  if (!tokenManual.value) return;

  intercambiando.value = true;

  try {
    await intercambiarToken(tokenManual.value);
  } catch (error: any) {
    console.error('Error exchanging token:', error);
    alert('Error al intercambiar token: ' + (error.response?.data?.message || error.message));
  } finally {
    intercambiando.value = false;
  }
}

async function intercambiarToken(token: string) {
  if (!auth.user?.id) {
    throw new Error('Usuario no autenticado');
  }

  intercambiando.value = true;

  try {
    const response = await api.post<{ data: any }>('/api/v1/wallet/share/exchange-token', {
      shareToken: token,
      doctorId: auth.user.id
    });

    sesionActiva.value = {
      sharedSessionId: response.data.sharedSessionId,
      expiresAt: response.data.expiresAt,
      permisos: response.data.permisos,
      pacienteInfo: response.data.pacienteInfo
    };

    emit('token-exchanged', sesionActiva.value);

    iniciarCountdown();
  } finally {
    intercambiando.value = false;
  }
}

function verificarEnlaceActual() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const session = params.get('session');

  if (token) {
    procesarQR(token);
  } else if (session) {
    // Si ya tenemos session, cargar información
    cargarSesion(session);
  } else {
    errorQR.value = 'No se encontró un token válido en el enlace';
  }
}

async function cargarSesion(sharedSessionId: string) {
  if (!auth.user?.id) return;

  intercambiando.value = true;

  try {
    const response = await api.get<{ data: any }>('/api/v1/wallet/share/session', {
      headers: {
        'X-Shared-Session-ID': sharedSessionId
      }
    });

    sesionActiva.value = response.data;
    emit('token-exchanged', sesionActiva.value);

    iniciarCountdown();
  } catch (error: any) {
    console.error('Error loading session:', error);
    errorQR.value = 'Error al cargar sesión: ' + (error.response?.data?.message || error.message);
  } finally {
    intercambiando.value = false;
  }
}

function reiniciarEscaneo() {
  qrEscaneado.value = false;
  errorQR.value = null;
  procesandoQR.value = false;
}

function reiniciarComponente() {
  reiniciarEscaneo();
  tokenManual.value = '';
  sesionActiva.value = null;
  tabActivo.value = 'qr';

  if (countdownInterval.value) {
    clearInterval(countdownInterval.value);
  }
}

function actualizarTiempoRestante() {
  // El computed se encarga de actualizar
  if (expiracionPronto.value) {
    // Mostrar advertencia de expiración próxima
  }
}

function iniciarCountdown() {
  if (countdownInterval.value) {
    clearInterval(countdownInterval.value);
  }
  countdownInterval.value = window.setInterval(() => {
    actualizarTiempoRestante();
  }, 1000);
}

onMounted(() => {
  // Verificar si hay token en la URL al montar
  verificarEnlaceActual();
});

onUnmounted(() => {
  if (countdownInterval.value) {
    clearInterval(countdownInterval.value);
  }
});
</script>

<style scoped>
.share-token-qr-component {
  max-width: 600px;
  margin: 0 auto;
}

.qr-scan-container {
  min-height: 300px;
}

.scan-placeholder,
.scan-processing,
.scan-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.scan-error {
  color: #ef4444;
}

.manual-input-container,
.link-container {
  min-height: 200px;
}

.session-info {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.gap-2 {
  gap: 0.5rem;
}

.flex-grow-1 {
  flex-grow: 1;
}

.bg-transparent {
  background: transparent !important;
}
</style>
