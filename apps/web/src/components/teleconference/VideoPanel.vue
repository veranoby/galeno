<!-- apps/web/src/components/teleconference/VideoPanel.vue -->
<template>
  <div class="video-panel" :class="{ 'pip-mode': pipActive, 'fullscreen-mode': fullscreen }">
    <!-- Video Container -->
    <div ref="videoContainer" class="video-container">
      <!-- Jitsi Meet Component -->
      <JitsiMeet
        v-if="shouldShowVideo"
        ref="jitsiRef"
        :room-name="roomName"
        :user-info="userInfo"
        :config-overwrite="configOverwrite"
        :interface-config-overwrite="interfaceConfigOverwrite"
        :jwt="jwt"
        :enable-pip="pipActive"
        :domain="jitsiDomain"
        :waiting-room-enabled="false"
        @call-started="handleCallStarted"
        @call-ended="handleCallEnded"
        @video-conference-joined="handleVideoConferenceJoined"
        @video-conference-left="handleVideoConferenceLeft"
        @participant-joined="handleParticipantJoined"
        @participant-left="handleParticipantLeft"
        @error="handleError"
      />

      <!-- Loading State -->
      <div v-if="isLoading && !error" class="video-loading">
        <v-progress-circular indeterminate color="primary" size="64" />
        <p class="mt-4">Conectando a la videollamada...</p>
      </div>

      <!-- Error State -->
      <div v-if="error" class="video-error">
        <v-icon size="64" color="error">mdi-video-off</v-icon>
        <p class="mt-4">{{ error }}</p>
        <v-btn color="primary" variant="tonal" class="mt-4" @click="reconnect">
          <v-icon start>mdi-refresh</v-icon>
          Reconectar
        </v-btn>
      </div>
    </div>

    <!-- Controls Bar -->
    <div class="controls-bar" :class="{ 'hidden': controlsHidden }">
      <!-- Audio Control -->
      <v-btn
        :icon="isAudioEnabled ? 'mdi-microphone' : 'mdi-microphone-off'"
        :color="isAudioEnabled ? 'default' : 'error'"
        variant="tonal"
        size="large"
        @click="toggleAudio"
        :disabled="!isCallActive"
      >
        <v-tooltip activator="parent" location="top">
          {{ isAudioEnabled ? 'Silenciar' : 'Activar micrófono' }}
        </v-tooltip>
      </v-btn>

      <!-- Video Control -->
      <v-btn
        :icon="isVideoEnabled ? 'mdi-video' : 'mdi-video-off'"
        :color="isVideoEnabled ? 'default' : 'error'"
        variant="tonal"
        size="large"
        @click="toggleVideo"
        :disabled="!isCallActive"
      >
        <v-tooltip activator="parent" location="top">
          {{ isVideoEnabled ? 'Apagar cámara' : 'Encender cámara' }}
        </v-tooltip>
      </v-btn>

      <!-- Screen Share -->
      <v-btn
        :icon="isScreenSharing ? 'mdi-monitor-off' : 'mdi-monitor'"
        :color="isScreenSharing ? 'warning' : 'default'"
        variant="tonal"
        size="large"
        @click="toggleScreenShare"
        :disabled="!isCallActive"
      >
        <v-tooltip activator="parent" location="top">
          {{ isScreenSharing ? 'Detener compartir pantalla' : 'Compartir pantalla' }}
        </v-tooltip>
      </v-btn>

      <!-- Participants Counter -->
      <div class="participants-count">
        <v-icon size="small" start>mdi-account-group</v-icon>
        {{ participantsCount }}
      </div>

      <!-- Connection Quality Indicator -->
      <div class="connection-quality" :class="connectionQualityClass">
        <v-icon size="small">{{ connectionQualityIcon }}</v-icon>
        <span class="quality-text">{{ connectionQualityText }}</span>
      </div>

      <!-- End Call Button -->
      <v-btn
        icon="mdi-phone-hangup"
        color="error"
        variant="elevated"
        size="large"
        @click="endCall"
        :disabled="!isCallActive"
        class="ml-auto"
      >
        <v-tooltip activator="parent" location="top">
          Finalizar llamada
        </v-tooltip>
      </v-btn>
    </div>

    <!-- PiP Toggle (when not in PiP mode) -->
    <v-btn
      v-if="enablePip && !pipActive"
      icon
      size="small"
      variant="text"
      class="pip-toggle-btn"
      @click="togglePiP"
    >
      <v-icon>mdi-picture-in-picture-bottom-right</v-icon>
    </v-btn>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import JitsiMeet from '../teleconsulta/JitsiMeet.vue';
import { usePiP } from '@/composables/usePiP';
import { useToast } from 'vue-toastification';

interface Props {
  citaId: string;
  pipActive?: boolean;
  fullscreen?: boolean;
  enablePip?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  pipActive: false,
  fullscreen: false,
  enablePip: true
});

const emit = defineEmits<{
  (e: 'call-started'): void;
  (e: 'call-ended'): void;
  (e: 'participant-joined', participant: { name: string }): void;
  (e: 'error', error: string): void;
}>();
const videoContainer = ref<HTMLDivElement | null>(null);
const jitsiRef = ref<InstanceType<typeof JitsiMeet>>();

// Estado
const isLoading = ref(true);
const error = ref<string | null>(null);
const isCallActive = ref(false);
const isAudioEnabled = ref(true);
const isVideoEnabled = ref(true);
const isScreenSharing = ref(false);
const participantsCount = ref(1);
const controlsHidden = ref(false);
const shouldShowVideo = ref(true);

// Configuración
const jitsiDomain = 'meet.jit.si';
const roomName = computed(() => `galeno-${props.citaId}`);
const userInfo = computed(() => ({
  displayName: 'Dr. Usuario', // TODO: From auth store
  email: '' // TODO: From auth store
}));

const configOverwrite = {
  startWithAudioMuted: false,
  startWithVideoMuted: false,
  disableModeratorIndicator: true,
  enableEmailInStats: false,
  prejoinPageEnabled: false,
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
};

const interfaceConfigOverwrite = {
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
};

const jwt = ref<string | undefined>(undefined);

// PiP composable
const { togglePiP, isSupported: isPiPSupported } = usePiP();

// Connection quality
const connectionQuality = ref<'excellent' | 'good' | 'poor' | 'disconnected'>('excellent');

const connectionQualityClass = computed(() => ({
  'quality-excellent': connectionQuality.value === 'excellent',
  'quality-good': connectionQuality.value === 'good',
  'quality-poor': connectionQuality.value === 'poor',
  'quality-disconnected': connectionQuality.value === 'disconnected'
}));

const connectionQualityIcon = computed(() => {
  const icons = {
    excellent: 'mdi-wifi',
    good: 'mdi-wifi-strength-3',
    poor: 'mdi-wifi-strength-1',
    disconnected: 'mdi-wifi-off'
  };
  return icons[connectionQuality.value];
});

const connectionQualityText = computed(() => {
  const texts = {
    excellent: 'Excelente',
    good: 'Buena',
    poor: 'Débil',
    disconnected: 'Sin conexión'
  };
  return texts[connectionQuality.value];
});

// Event handlers from Jitsi
const handleCallStarted = () => {
  isCallActive.value = true;
  isLoading.value = false;
  emit('call-started');
  toast.success('Videollamada iniciada');
};

const handleCallEnded = () => {
  isCallActive.value = false;
  isScreenSharing.value = false;
  participantsCount.value = 1;
  emit('call-ended');
  toast.info('Videollamada finalizada');
};

const handleVideoConferenceJoined = () => {
  isLoading.value = false;
  console.log('Video conference joined');
};

const handleVideoConferenceLeft = () => {
  handleCallEnded();
};

const handleParticipantJoined = (participant: { name: string }) => {
  participantsCount.value++;
  emit('participant-joined', participant);
};

const handleParticipantLeft = () => {
  participantsCount.value = Math.max(1, participantsCount.value - 1);
};

const handleError = (err: Error) => {
  error.value = err.message;
  isLoading.value = false;
  emit('error', err.message);
  toast.error(`Error en videollamada: ${err.message}`);
};

// Controls
const toggleAudio = () => {
  isAudioEnabled.value = !isAudioEnabled.value;
  jitsiRef.value?.executeCommand('toggleAudio');
};

const toggleVideo = () => {
  isVideoEnabled.value = !isVideoEnabled.value;
  jitsiRef.value?.executeCommand('toggleVideo');
};

const toggleScreenShare = async () => {
  try {
    jitsiRef.value?.executeCommand('toggleScreenShare');
    isScreenSharing.value = !isScreenSharing.value;
  } catch (err) {
    toast.error('Error al compartir pantalla');
  }
};

const endCall = () => {
  jitsiRef.value?.hangUp();
};

const reconnect = () => {
  error.value = null;
  isLoading.value = true;
  shouldShowVideo.value = false;
  
  setTimeout(() => {
    shouldShowVideo.value = true;
  }, 100);
};

// Auto-hide controls when inactive
let controlsTimeout: NodeJS.Timeout | null = null;

const resetControlsTimeout = () => {
  if (controlsTimeout) {
    clearTimeout(controlsTimeout);
  }
  
  controlsHidden.value = false;
  
  controlsTimeout = setTimeout(() => {
    if (isCallActive.value && !props.pipActive) {
      controlsHidden.value = true;
    }
  }, 3000);
};

// Watch for PiP changes
watch(() => props.pipActive, (newVal) => {
  if (newVal && isPiPSupported.value) {
    togglePiP();
  }
});

// Lifecycle
onMounted(() => {
  resetControlsTimeout();
});

onUnmounted(() => {
  if (controlsTimeout) {
    clearTimeout(controlsTimeout);
  }
  if (isCallActive.value) {
    endCall();
  }
});

// Expose methods for parent component
defineExpose({
  endCall,
  toggleAudio,
  toggleVideo,
  toggleScreenShare,
  isCallActive,
  participantsCount
});
</script>

<style scoped>
.video-panel {
  position: relative;
  width: 100%;
  height: 100%;
  background-color: #1a1a2e;
  overflow: hidden;
}

.video-panel.pip-mode {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 320px;
  height: 240px;
  z-index: 9999;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  border-radius: 12px;
  overflow: hidden;
}

.video-panel.fullscreen-mode {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
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

.controls-bar {
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
}

.controls-bar.hidden {
  opacity: 0;
  pointer-events: none;
}

.controls-bar:hover {
  opacity: 1;
}

.participants-count {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  color: white;
  font-size: 14px;
}

.connection-quality {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  color: white;
  font-size: 12px;
}

.quality-excellent {
  background-color: rgba(16, 185, 129, 0.3);
}

.quality-good {
  background-color: rgba(59, 130, 246, 0.3);
}

.quality-poor {
  background-color: rgba(245, 158, 11, 0.3);
}

.quality-disconnected {
  background-color: rgba(239, 68, 68, 0.3);
}

.pip-toggle-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 100;
  background-color: rgba(0, 0, 0, 0.5);
  color: white;
}

/* Responsive */
@media (max-width: 768px) {
  .controls-bar {
    flex-wrap: wrap;
    justify-content: center;
    padding: 12px;
    gap: 8px;
  }

  .participants-count,
  .connection-quality {
    order: -1;
    width: 100%;
    justify-content: center;
    margin-bottom: 8px;
  }
}
</style>
