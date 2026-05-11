<!-- apps/web/src/views/teleconference/Consultation.vue -->
<template>
  <div class="teleconsultation-view" :class="{ 'fullscreen': isFullscreen }">
    <!-- Top Bar -->
    <div class="teleconsultation-topbar">
      <div class="topbar-left">
        <v-btn
          icon="mdi-arrow-left"
          variant="text"
          size="small"
          @click="handleBack"
          aria-label="Volver"
        />
        <div class="consulta-info">
          <h1 class="consulta-title">Teleconsulta</h1>
          <div class="consulta-status" :class="consultaEstadoClass">
            <v-icon size="small">{{ estadoIcon }}</v-icon>
            <span class="status-text">{{ consultaEstadoText }}</span>
          </div>
        </div>
      </div>

      <div class="topbar-actions">
        <!-- PiP Toggle -->
        <v-btn
          :icon="isPiPActive ? 'mdi-picture-in-picture-exit' : 'mdi-picture-in-picture-bottom-right'"
          variant="tonal"
          size="small"
          :disabled="!isPiPSupported"
          @click="handleTogglePiP"
          class="mr-2"
        >
          <v-tooltip activator="parent" location="bottom">
            {{ isPiPActive ? 'Salir de PiP' : 'Picture-in-Picture' }}
          </v-tooltip>
        </v-btn>

        <!-- Fullscreen Toggle -->
        <v-btn
          :icon="isFullscreen ? 'mdi-fullscreen-exit' : 'mdi-fullscreen'"
          variant="tonal"
          size="small"
          @click="handleToggleFullscreen"
          class="mr-2"
        >
          <v-tooltip activator="parent" location="bottom">
            {{ isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa' }}
          </v-tooltip>
        </v-btn>

        <!-- Timer -->
        <div class="consulta-timer">
          <v-icon size="small" class="mr-1">mdi-timer-outline</v-icon>
          <span class="timer-text">{{ formatDuration(consultaDuration) }}</span>
        </div>
      </div>
    </div>

    <!-- Main Content - Split Layout -->
    <div class="teleconsultation-content">
      <!-- Left Panel: Video -->
      <div class="video-panel" :class="{ 'pip-active': isPiPActive }">
        <div ref="videoContainerRef" class="video-container">
          <JitsiMeet
            v-if="shouldShowVideo"
            ref="jitsiRef"
            :room-name="secureRoomName"
            :user-info="userInfo"
            :config-overwrite="jitsiConfigOverwrite"
            :interface-config-overwrite="jitsiInterfaceConfig"
            :jwt="jwtToken"
            :domain="jitsiDomain"
            :waiting-room-enabled="false"
            @call-started="handleCallStarted"
            @call-ended="handleCallEnded"
            @video-conference-joined="handleVideoConferenceJoined"
            @video-conference-left="handleVideoConferenceLeft"
            @participant-joined="handleParticipantJoined"
            @participant-left="handleParticipantLeft"
            @error="handleJitsiError"
          />

          <!-- Loading State -->
          <div v-if="isVideoLoading && !videoError" class="video-loading">
            <v-progress-circular indeterminate color="primary" size="64" />
            <p class="mt-4">Conectando a la videollamada...</p>
          </div>

          <!-- Error State -->
          <div v-if="videoError" class="video-error">
            <v-icon size="64" color="error">mdi-video-off</v-icon>
            <p class="mt-4">{{ videoError }}</p>
            <v-btn color="primary" variant="tonal" class="mt-4" @click="reconnectVideo">
              <v-icon start>mdi-refresh</v-icon>
              Reconectar
            </v-btn>
          </div>
        </div>

        <!-- Video Controls Overlay -->
        <div class="video-controls" :class="{ 'hidden': controlsHidden }">
          <v-btn
            :icon="isAudioEnabled ? 'mdi-microphone' : 'mdi-microphone-off'"
            :color="isAudioEnabled ? 'default' : 'error'"
            variant="tonal"
            size="large"
            @click="toggleAudio"
            :disabled="!isCallActive"
          />
          <v-btn
            :icon="isVideoEnabled ? 'mdi-video' : 'mdi-video-off'"
            :color="isVideoEnabled ? 'default' : 'error'"
            variant="tonal"
            size="large"
            @click="toggleVideo"
            :disabled="!isCallActive"
          />
          <v-btn
            icon="mdi-phone-hangup"
            color="error"
            variant="elevated"
            size="large"
            @click="handleEndCall"
            :disabled="!isCallActive"
          />
        </div>
      </div>

      <!-- Right Panel: Clinical Workspace -->
      <div class="workspace-panel">
        <ConsultationTools
          ref="toolsRef"
          :cita-id="citaId"
          :paciente-id="pacienteId"
          :consulta-id="consultaId"
          :compact-mode="isPiPActive"
          :initial-data="initialClinicalData"
          @data-changed="handleClinicalDataChanged"
          @save-requested="handleSaveComplete"
          @finalize-requested="handleFinalizeRequested"
        />
      </div>
    </div>

    <!-- Finalization Dialog -->
    <v-dialog
      v-model="showFinalizeDialog"
      max-width="650"
      persistent
      scrollable
    >
      <v-card>
        <v-card-title class="text-h6">
          <v-icon color="primary" start>mdi-check-circle</v-icon>
          Finalizar Teleconsulta
        </v-card-title>

        <v-card-text>
          <p class="mb-4">
            ¿Estás seguro de finalizar esta teleconsulta? Esta acción no se puede deshacer.
          </p>

          <!-- Summary Checklist -->
          <v-card variant="outlined" class="mb-4">
            <v-card-subtitle class="font-weight-bold">
              Resumen de la consulta
            </v-card-subtitle>
            <v-list density="compact">
              <v-list-item>
                <template v-slot:prepend>
                  <v-icon :color="clinicalData.hasNotes ? 'success' : 'error'" size="small">
                    {{ clinicalData.hasNotes ? 'mdi-check-circle' : 'mdi-alert-circle' }}
                  </v-icon>
                </template>
                <v-list-item-title>
                  Notas de evolución
                  <span class="text-caption text-grey ml-2">
                    {{ clinicalData.notesLength }} caracteres
                  </span>
                </v-list-item-title>
              </v-list-item>

              <v-list-item>
                <template v-slot:prepend>
                  <v-icon :color="clinicalData.hasDiagnosis ? 'success' : 'warning'" size="small">
                    {{ clinicalData.hasDiagnosis ? 'mdi-check-circle' : 'mdi-alert-circle' }}
                  </v-icon>
                </template>
                <v-list-item-title>
                  Diagnósticos CIE-10
                  <span class="text-caption text-grey ml-2">
                    {{ clinicalData.diagnosisCount }} registrado(s)
                  </span>
                </v-list-item-title>
              </v-list-item>

              <v-list-item>
                <template v-slot:prepend>
                  <v-icon :color="clinicalData.hasMedications ? 'success' : 'success'" size="small">
                    {{ clinicalData.hasMedications ? 'mdi-check-circle' : 'mdi-information' }}
                  </v-icon>
                </template>
                <v-list-item-title>
                  Medicamentos recetados
                  <span class="text-caption text-grey ml-2">
                    {{ clinicalData.medicationCount }}
                  </span>
                </v-list-item-title>
              </v-list-item>

              <v-list-item>
                <template v-slot:prepend>
                  <v-icon :color="clinicalData.hasExams ? 'success' : 'success'" size="small">
                    {{ clinicalData.hasExams ? 'mdi-check-circle' : 'mdi-information' }}
                  </v-icon>
                </template>
                <v-list-item-title>
                  Exámenes solicitados
                  <span class="text-caption text-grey ml-2">
                    {{ clinicalData.examsCount }}
                  </span>
                </v-list-item-title>
              </v-list-item>
            </v-list>
          </v-card>

          <v-alert
            v-if="!canFinalize"
            type="warning"
            variant="tonal"
            border="start"
          >
            <strong>Campos requeridos incompletos:</strong>
            <ul class="mt-2 mb-0">
              <li v-if="!clinicalData.hasNotes">Notas de evolución (requerido)</li>
              <li v-if="!clinicalData.hasDiagnosis">Al menos un diagnóstico CIE-10 (requerido)</li>
            </ul>
          </v-alert>

          <v-alert
            v-else
            type="success"
            variant="tonal"
            border="start"
          >
            <v-icon start>mdi-check-circle</v-icon>
            Todos los campos requeridos están completos
          </v-alert>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="showFinalizeDialog = false"
          >
            Cancelar
          </v-btn>
          <v-btn
            color="primary"
            :loading="isFinalizing"
            :disabled="!canFinalize"
            @click="confirmFinalize"
          >
            <v-icon start>mdi-check-all</v-icon>
            Finalizar Consulta
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Connection Status Snackbar -->
    <v-snackbar
      v-model="showConnectionSnackbar"
      :color="connectionStatusColor"
      :timeout="connectionStatus === 'disconnected' ? -1 : 5000"
      location="top"
    >
      <v-icon :color="connectionStatusColor">{{ connectionStatusIcon }}</v-icon>
      {{ connectionStatusText }}

      <template v-slot:actions>
        <v-btn
          v-if="connectionStatus === 'poor'"
          variant="text"
          size="small"
          @click="reduceVideoQuality"
        >
          Reducir calidad
        </v-btn>
        <v-btn
          v-if="connectionStatus === 'disconnected'"
          variant="text"
          size="small"
          @click="reconnectVideo"
        >
          Reconectar
        </v-btn>
      </template>
    </v-snackbar>

    <!-- Auto-save Indicator -->
    <v-snackbar
      v-model="showAutoSaveSnackbar"
      color="success"
      timeout="2000"
      location="bottom"
    >
      <v-icon start>mdi-check-circle</v-icon>
      Borrador guardado automáticamente
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { apiClient } from '@/services/api';
import { useToast } from 'vue-toastification';
import { usePiP } from '@/composables/usePiP';
import { useSSE } from '@/composables/useSSE';
import { generateSecureRoomName } from '@/utils/crypto';
import JitsiMeet from '@/components/teleconsulta/JitsiMeet.vue';
import ConsultationTools from '@/components/teleconference/ConsultationTools.vue';
import {
  type CIE10Diagnosis,
  type MedicamentoData,
  type ExamenData
} from '@/composables/useConsultationSync';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const toast = useToast();

// Route params
const citaId = computed(() => route.params.citaId as string);
const pacienteId = ref('');
const consultaId = ref('');

// Video container ref for PiP
const videoContainerRef = ref<HTMLDivElement | null>(null);
const jitsiRef = ref<InstanceType<typeof JitsiMeet>>();
const toolsRef = ref<InstanceType<typeof ConsultationTools>>();

// Video State
const isCallActive = ref(false);
const isVideoLoading = ref(true);
const videoError = ref<string | null>(null);
const isAudioEnabled = ref(true);
const isVideoEnabled = ref(true);
const shouldShowVideo = ref(true);
const controlsHidden = ref(false);
const secureRoomName = ref('');
const jwtToken = ref<string | undefined>(undefined);
const jitsiDomain = 'meet.jit.si';

// PiP State
const isPiPActive = ref(false);
const { togglePiP, isSupported: isPiPSupported } = usePiP(undefined, { fallbackToOverlay: true });

// Fullscreen State
const isFullscreen = ref(false);

// Duration Timer
const consultaDuration = ref(0);
let durationTimer: NodeJS.Timeout | null = null;

// SSE
const { connect: sseConnect, disconnect: sseDisconnect } = useSSE();

// Clinical Data
const clinicalData = ref({
  hasNotes: false,
  notesLength: 0,
  hasDiagnosis: false,
  diagnosisCount: 0,
  hasMedications: false,
  medicationCount: 0,
  hasExams: false,
  examsCount: 0
});

const initialClinicalData = ref<{
  notas?: string;
  diagnosticos?: CIE10Diagnosis[];
  medicamentos?: MedicamentoData[];
  examenes?: ExamenData[];
  evolucion?: string;
  tratamiento?: string;
}>({});

// Finalization
const showFinalizeDialog = ref(false);
const isFinalizing = ref(false);

// Connection Status
const connectionStatus = ref<'excellent' | 'good' | 'poor' | 'disconnected'>('excellent');
const showConnectionSnackbar = ref(false);
const showAutoSaveSnackbar = ref(false);

// Controls timeout
let controlsTimeout: NodeJS.Timeout | null = null;

// Jitsi Config
const userInfo = computed(() => ({
  displayName: authStore.user?.nombre || 'Doctor',
  email: authStore.user?.email || ''
}));

const jitsiConfigOverwrite = computed(() => ({
  startWithAudioMuted: false,
  startWithVideoMuted: false,
  prejoinPageEnabled: false,
  disableDeepLinking: true,
  enableWelcomePage: false,
  enableClosePage: false,
  enableNoisyMicDetection: true,
  toolbarButtons: [
    'camera',
    'chat',
    'closedcaptions',
    'desktop',
    'download',
    'feedback',
    'filmstrip',
    'fullscreen',
    'hangup',
    'microphone',
    'tileview',
    'videoquality'
  ]
}));

const jitsiInterfaceConfig = computed(() => ({
  DEFAULT_BACKGROUND: '#1a1a2e',
  filmStripOnly: false,
  SHOW_JITSI_WATERMARK: false,
  SHOW_WATERMARK_FOR_GUESTS: false,
  TOOLBAR_BUTTONS: [
    'microphone',
    'camera',
    'desktop',
    'hangup',
    'participants',
    'chat',
    'tileview'
  ]
}));

// Computed Properties
const consultaEstadoClass = computed(() => {
  const classes: Record<string, string> = {
    pendiente: 'status-pending',
    en_proceso: 'status-in-progress',
    en_atencion: 'status-in-progress',
    completada: 'status-completed',
    finalizada: 'status-completed',
    cancelada: 'status-cancelled'
  };
  return classes['en_atencion'] || 'status-in-progress';
});

const estadoIcon = computed(() => {
  const icons: Record<string, string> = {
    pendiente: 'mdi-clock-outline',
    en_proceso: 'mdi-video',
    en_atencion: 'mdi-video',
    completada: 'mdi-check-circle',
    finalizada: 'mdi-check-circle',
    cancelada: 'mdi-close-circle'
  };
  return icons['en_atencion'] || 'mdi-video';
});

const consultaEstadoText = computed(() => {
  const texts: Record<string, string> = {
    pendiente: 'Pendiente',
    en_proceso: 'En Proceso',
    en_atencion: 'En Atención',
    completada: 'Completada',
    finalizada: 'Finalizada',
    cancelada: 'Cancelada'
  };
  return texts['en_atencion'] || 'En Atención';
});

const canFinalize = computed(() => {
  return clinicalData.value.hasNotes && clinicalData.value.hasDiagnosis;
});

const connectionStatusColor = computed(() => {
  const colors = {
    excellent: 'success',
    good: 'info',
    poor: 'warning',
    disconnected: 'error'
  };
  return colors[connectionStatus.value];
});

const connectionStatusIcon = computed(() => {
  const icons = {
    excellent: 'mdi-wifi',
    good: 'mdi-wifi-strength-3',
    poor: 'mdi-wifi-strength-1',
    disconnected: 'mdi-wifi-off'
  };
  return icons[connectionStatus.value];
});

const connectionStatusText = computed(() => {
  const texts = {
    excellent: 'Conexión excelente',
    good: 'Conexión buena',
    poor: 'Conexión débil - considere reducir calidad de video',
    disconnected: 'Sin conexión - reconectando...'
  };
  return texts[connectionStatus.value];
});

// Methods
const handleTogglePiP = async () => {
  try {
    await togglePiP(videoContainerRef);
    isPiPActive.value = !isPiPActive.value;
    toast.success(isPiPActive.value ? 'PiP activado' : 'PiP desactivado');
  } catch (error) {
    console.error('Error toggling PiP:', error);
    toast.error('Error al cambiar PiP');
  }
};

const handleToggleFullscreen = async () => {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      isFullscreen.value = true;
    } else {
      await document.exitFullscreen();
      isFullscreen.value = false;
    }
  } catch (error) {
    console.error('Error toggling fullscreen:', error);
    toast.error('Error al cambiar pantalla completa');
  }
};

const initializeVideoCall = async () => {
  try {
    isVideoLoading.value = true;
    videoError.value = null;

    // Generate secure room name
    const JITSI_SALT = import.meta.env.VITE_JITSI_SALT || 'galeno-default-salt';
    secureRoomName.value = generateSecureRoomName(citaId.value, JITSI_SALT);

    console.log('[Consultation] Video call initialized', {
      citaId: citaId.value,
      roomName: secureRoomName.value
    });
  } catch (error) {
    console.error('Error initializing video call:', error);
    videoError.value = 'Error al inicializar videollamada';
    toast.error('Error al inicializar videollamada');
  } finally {
    isVideoLoading.value = false;
  }
};

const handleCallStarted = () => {
  isCallActive.value = true;
  isVideoLoading.value = false;
  startDurationTimer();
  resetControlsTimeout();
  toast.success('Teleconsulta iniciada');
};

const handleCallEnded = () => {
  isCallActive.value = false;
  stopDurationTimer();
  toast.info('Videollamada finalizada');
};

const handleVideoConferenceJoined = () => {
  isVideoLoading.value = false;
  console.log('[Consultation] Video conference joined');
};

/**
 * CRITICAL: Handle videoConferenceLeft event
 * This triggers the state transition from "en_atencion" to "finalizada"
 */
const handleVideoConferenceLeft = async () => {
  console.log('[Consultation] Video conference left - triggering state transition');
  handleCallEnded();

  // Automatically transition consultation state to "finalizada"
  try {
    await transitionConsultationState('finalizada');
    toast.info('La videollamada finalizó. La consulta ha sido marcada como finalizada.');
  } catch (error) {
    console.error('Error transitioning consultation state:', error);
  }
};

const handleParticipantJoined = (participant: { name: string }) => {
  console.log('[Consultation] Participant joined:', participant);
  toast.info(`${participant.name} se ha unido a la consulta`);
};

const handleParticipantLeft = () => {
  console.log('[Consultation] Participant left');
};

const handleJitsiError = (error: Error) => {
  console.error('[Consultation] Jitsi error:', error);
  videoError.value = error.message;
  toast.error(`Error en videollamada: ${error.message}`);
};

const handleEndCall = () => {
  jitsiRef.value?.endCall();
  handleCallEnded();
};

const toggleAudio = () => {
  isAudioEnabled.value = !isAudioEnabled.value;
  (jitsiRef.value as any)?.executeCommand('toggleAudio');
};

const toggleVideo = () => {
  isVideoEnabled.value = !isVideoEnabled.value;
  (jitsiRef.value as any)?.executeCommand('toggleVideo');
};

const reconnectVideo = () => {
  videoError.value = null;
  isVideoLoading.value = true;
  shouldShowVideo.value = false;

  setTimeout(() => {
    shouldShowVideo.value = true;
  }, 100);
};

const reduceVideoQuality = () => {
  // TODO: Implement video quality reduction
  toast.info('Calidad de video reducida');
  showConnectionSnackbar.value = false;
};

// Duration Timer
const startDurationTimer = () => {
  stopDurationTimer();
  durationTimer = setInterval(() => {
    consultaDuration.value++;
  }, 1000);
};

const stopDurationTimer = () => {
  if (durationTimer) {
    clearInterval(durationTimer);
    durationTimer = null;
  }
};

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// Controls auto-hide
const resetControlsTimeout = () => {
  if (controlsTimeout) {
    clearTimeout(controlsTimeout);
  }

  controlsHidden.value = false;

  controlsTimeout = setTimeout(() => {
    if (isCallActive.value && !isPiPActive.value) {
      controlsHidden.value = true;
    }
  }, 3000);
};

// Load consultation data
const loadConsultationData = async () => {
  try {
    const response = await apiClient.get<{
      data: {
        id: string;
        citaId: string;
        pacienteId: string;
        notas?: string;
        diagnosticoCie10?: CIE10Diagnosis[];
        tratamiento?: string;
        evolucion?: string;
      };
    }>(`/api/v1/consultas/${citaId.value}`);

    if (response.success && response.data) {
      const data = response.data.data;
      consultaId.value = data.id;
      pacienteId.value = data.pacienteId;

      initialClinicalData.value = {
        notas: data.notas || '',
        diagnosticos: data.diagnosticoCie10 || [],
        medicamentos: [],
        examenes: [],
        evolucion: data.evolucion || '',
        tratamiento: data.tratamiento || ''
      };

      console.log('[Consultation] Data loaded:', {
        consultaId: consultaId.value,
        pacienteId: pacienteId.value
      });
    }
  } catch (error) {
    console.error('Error loading consultation data:', error);
    // Continue with empty data - will be created on save
  }
};

// Transition consultation state
const transitionConsultationState = async (estado: 'en_atencion' | 'finalizada') => {
  try {
    await apiClient.put(`/api/v1/consultas/${consultaId.value}/estado`, {
      estado
    });
    console.log('[Consultation] State transitioned to:', estado);
  } catch (error) {
    console.error('Error transitioning state:', error);
    throw error;
  }
};

// Handle clinical data changes
const handleClinicalDataChanged = (data: {
  notas: string;
  diagnosticos: CIE10Diagnosis[];
  medicamentos: MedicamentoData[];
  examenes: ExamenData[];
  evolucion: string;
  tratamiento: string;
}) => {
  clinicalData.value = {
    hasNotes: data.notas.trim().length > 0,
    notesLength: data.notas.length,
    hasDiagnosis: data.diagnosticos.length > 0,
    diagnosisCount: data.diagnosticos.length,
    hasMedications: data.medicamentos.length > 0,
    medicationCount: data.medicamentos.length,
    hasExams: data.examenes.length > 0,
    examsCount: data.examenes.length
  };
};

// Handle save complete
const handleSaveComplete = () => {
  showAutoSaveSnackbar.value = true;
};

// Handle finalize requested
const handleFinalizeRequested = () => {
  showFinalizeDialog.value = true;
};

// Confirm finalize
const confirmFinalize = async () => {
  try {
    isFinalizing.value = true;

    // Get final data from tools
    const finalData = toolsRef.value?.getData();

    // Save final consultation data
    await apiClient.put(`/api/v1/consultas/${consultaId.value}/finalizar`, {
      notas: finalData?.notas,
      diagnosticoCie10: finalData?.diagnosticos,
      medicamentos: finalData?.medicamentos,
      examenes: finalData?.examenes,
      evolucion: finalData?.evolucion,
      tratamiento: finalData?.tratamiento
    });

    // Transition state to finalizada
    await transitionConsultationState('finalizada');

    toast.success('Consulta finalizada exitosamente');
    showFinalizeDialog.value = false;

    // End call if still active
    if (isCallActive.value) {
      handleEndCall();
    }

    // Redirect to agenda
    setTimeout(() => {
      router.push('/agenda');
    }, 1500);
  } catch (error) {
    console.error('Error finalizing consultation:', error);
    toast.error('Error al finalizar consulta');
  } finally {
    isFinalizing.value = false;
  }
};

const handleBack = () => {
  if (isCallActive.value) {
    if (confirm('La consulta está en curso. ¿Estás seguro de que deseas salir?')) {
      router.push('/agenda');
    }
  } else {
    router.push('/agenda');
  }
};

// Watch fullscreen state
watch(() => document.fullscreenElement, (elem) => {
  isFullscreen.value = !!elem;
});

// Lifecycle
onMounted(async () => {
  // Initialize SSE connection
  if (authStore.user?.id) {
    sseConnect(authStore.user.id);
  }

  // Load consultation data
  await loadConsultationData();

  // Initialize video call
  await initializeVideoCall();

  // Transition state to "en_atencion"
  if (consultaId.value) {
    await transitionConsultationState('en_atencion');
  }
});

onUnmounted(() => {
  stopDurationTimer();
  sseDisconnect();

  if (controlsTimeout) {
    clearTimeout(controlsTimeout);
  }

  if (isCallActive.value) {
    handleEndCall();
  }
});
</script>

<style scoped lang="scss">
.teleconsultation-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f5f5f5;
  overflow: hidden;

  &.fullscreen {
    .teleconsultation-topbar {
      z-index: 1001;
    }
  }
}

.teleconsultation-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: white;
  border-bottom: 1px solid #e0e0e0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  z-index: 100;

  .topbar-left {
    display: flex;
    align-items: center;
    gap: 12px;

    .consulta-info {
      display: flex;
      flex-direction: column;
    }

    .consulta-title {
      font-size: 1.25rem;
      font-weight: 600;
      margin: 0;
    }

    .consulta-status {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.875rem;
      padding: 4px 8px;
      border-radius: 12px;

      &.status-pending {
        background-color: #fef3c7;
        color: #92400e;
      }

      &.status-in-progress {
        background-color: #dbeafe;
        color: #1e40af;
      }

      &.status-completed {
        background-color: #d1fae5;
        color: #065f46;
      }

      &.status-cancelled {
        background-color: #fee2e2;
        color: #991b1b;
      }
    }
  }

  .topbar-actions {
    display: flex;
    align-items: center;
    gap: 8px;

    .consulta-timer {
      display: flex;
      align-items: center;
      padding: 6px 12px;
      background-color: #f3f4f6;
      border-radius: 20px;
      font-size: 0.875rem;
      font-weight: 500;
    }
  }
}

.teleconsultation-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.video-panel {
  flex: 1;
  min-width: 0;
  background-color: #1a1a2e;
  position: relative;

  &.pip-active {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 480px;
    height: 320px;
    z-index: 9999;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    border-radius: 12px;
  }
}

.video-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-loading,
.video-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
}

.video-error {
  background-color: rgba(229, 62, 62, 0.1);
  padding: 32px;
  border-radius: 8px;
}

.video-controls {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent);
  transition: opacity 0.3s ease;
  opacity: 1;

  &.hidden {
    opacity: 0;
    pointer-events: none;
  }

  &:hover {
    opacity: 1;
  }
}

.workspace-panel {
  flex: 1;
  min-width: 0;
  background-color: white;
  border-left: 1px solid #e0e0e0;
  overflow: auto;
}

/* Responsive */
@media (max-width: 960px) {
  .teleconsultation-content {
    flex-direction: column;
  }

  .video-panel {
    flex: none;
    height: 40vh;
  }

  .workspace-panel {
    flex: 1;
  }

  .video-panel.pip-active {
    width: 320px;
    height: 240px;
  }
}

@media (max-width: 600px) {
  .teleconsultation-topbar {
    flex-wrap: wrap;
    gap: 8px;
  }

  .topbar-left {
    flex: 1;
  }

  .topbar-actions {
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .video-panel {
    height: 35vh;
  }
}
</style>
