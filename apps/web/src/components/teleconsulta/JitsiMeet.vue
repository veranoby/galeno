<template>
  <div class="jitsi-meet-container" ref="containerRef">
    <!-- Waiting Room State -->
    <div v-if="waitingRoomEnabled && !isWaitingRoomAdmitted" class="jitsi-waiting-room">
      <div class="waiting-animation">
        <div class="pulse-circle"></div>
        <div class="pulse-circle delay-1"></div>
        <div class="pulse-circle delay-2"></div>
      </div>
      <p class="waiting-message">Esperando al doctor...</p>
      <p class="waiting-submessage">La videollamada comenzará cuando el doctor te admita</p>
    </div>
    
    <!-- Normal States -->
    <template v-else>
      <div v-if="!isActive" class="jitsi-placeholder">
        <p>Conectando a videollamada...</p>
      </div>
      <div v-if="error" class="jitsi-error">
        <p>Error al conectar: {{ error }}</p>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, PropType, computed } from 'vue';
import { usePiP } from '@/composables/usePiP';

interface JitsiConfig {
  roomName: string;
  userInfo: {
    displayName: string;
    email?: string;
    avatar?: string;
  };
  configOverwrite?: Record<string, any>;
  interfaceConfigOverwrite?: Record<string, any>;
  jwt?: string;
}

const props = defineProps({
  roomName: {
    type: String,
    required: true
  },
  userInfo: {
    type: Object as PropType<JitsiConfig['userInfo']>,
    required: true
  },
  configOverwrite: {
    type: Object as PropType<Record<string, any>>,
    default: () => ({})
  },
  interfaceConfigOverwrite: {
    type: Object as PropType<Record<string, any>>,
    default: () => ({})
  },
  jwt: {
    type: String,
    default: undefined
  },
  enablePip: {
    type: Boolean,
    default: false
  },
  domain: {
    type: String,
    default: 'meet.jit.si'
  },
  /**
   * Habilitar sala de espera virtual
   * Si es true, no inicia la videollamada hasta que el doctor admita al paciente
   */
  waitingRoomEnabled: {
    type: Boolean,
    default: false
  },
  /**
   * Estado de la sala de espera (solo lectura)
   * waiting | admitted | in-session | ended | timeout
   */
  waitingRoomStatus: {
    type: String as PropType<'waiting' | 'admitted' | 'in-session' | 'ended' | 'timeout'>,
    default: undefined
  }
});

const emit = defineEmits<{
  (e: 'call-started'): void;
  (e: 'call-ended'): void;
  (e: 'participant-joined', participant: any): void;
  (e: 'participant-left', participantId: string): void;
  (e: 'error', error: Error): void;
  (e: 'pip-changed', active: boolean): void;
  (e: 'waiting-room-admitted'): void;
}>();

const containerRef = ref<HTMLDivElement>();
const isActive = ref(false);
const error = ref<string | null>(null);
const jitsiApi = ref<any>(null);
const isWaitingRoomAdmitted = ref(false);

// Singleton for script loading
let scriptLoadingPromise: Promise<void> | null = null;

const loadJitsiScript = (): Promise<void> => {
  if ((window as any).JitsiMeetExternalAPI) {
    return Promise.resolve();
  }

  if (scriptLoadingPromise) {
    return scriptLoadingPromise;
  }

  scriptLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://${props.domain}/external_api.js`;
    script.async = true;
    script.onload = () => {
      scriptLoadingPromise = null;
      resolve();
    };
    script.onerror = () => {
      scriptLoadingPromise = null;
      reject(new Error('Failed to load Jitsi Meet API'));
    };
    document.head.appendChild(script);
  });

  return scriptLoadingPromise;
};

// PiP Integration
const { isPiPActive, togglePiP, isSupported: isPiPSupported } = usePiP(
  containerRef as any, // Treat container as video element for Document PiP
  { fallbackToOverlay: false }
);

watch(isPiPActive, (active) => {
  emit('pip-changed', active);
});

// Initialize Jitsi Meet
const initializeJitsi = async () => {
  try {
    error.value = null;
    
    // Si waiting room está habilitada, esperar admisión
    if (props.waitingRoomEnabled && !isWaitingRoomAdmitted.value) {
      // No inicializar hasta que el doctor admita
      console.log('[JitsiMeet] Esperando admisión de sala de espera...');
      return;
    }
    
    await loadJitsiScript();

    const JitsiMeetExternalAPI = (window as any).JitsiMeetExternalAPI;

    const options = {
      roomName: props.roomName,
      width: '100%',
      height: '100%',
      parentNode: containerRef.value,
      userInfo: props.userInfo,
      configOverwrite: {
        startWithAudioMuted: false,
        startWithVideoMuted: false,
        prejoinPageEnabled: false,
        disableDeepLinking: true,
        ...props.configOverwrite
      },
      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        DEFAULT_BACKGROUND: '#f0f4f8',
        TOOLBAR_BUTTONS: [
          'microphone', 'camera', 'closedcaptions', 'desktop',
          'fullscreen', 'fodeviceselection', 'hangup',
          'profile', 'chat', 'recording', 'livestreaming',
          'etherpad', 'sharedvideo', 'settings', 'raisehand',
          'videoquality', 'filmstrip', 'invite', 'feedback',
          'stats', 'shortcuts', 'tileview', 'videobackgroundblur',
          'download', 'help', 'mute-everyone', 'security'
        ],
        ...props.interfaceConfigOverwrite
      }
    };

    if (props.jwt) {
      (options as any).jwt = props.jwt;
    }

    jitsiApi.value = new JitsiMeetExternalAPI(props.domain, options);

    // Set up event listeners
    jitsiApi.value.addEventListeners({
      readyToClose: () => {
        handleCallEnded();
      },
      participantLeft: async (participant: any) => {
        emit('participant-left', participant.id);
      },
      participantJoined: async (participant: any) => {
        emit('participant-joined', participant);
      },
      videoConferenceJoined: () => {
        isActive.value = true;
        emit('call-started');
      },
      videoConferenceLeft: () => {
        handleCallEnded();
      },
      videoNotAvailable: () => {
        error.value = 'Cámara no disponible';
        emit('error', new Error('Camera not available'));
      },
      audioNotAvailable: () => {
        error.value = 'Micrófono no disponible';
        emit('error', new Error('Microphone not available'));
      }
    });

  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Error desconocido';
    emit('error', err as Error);
  }
};

const handleCallEnded = () => {
  isActive.value = false;
  emit('call-ended');
};

const endCall = () => {
  if (jitsiApi.value) {
    jitsiApi.value.executeCommand('hangup');
  }
};

// Expose methods to parent
defineExpose({
  endCall,
  togglePiP,
  isPiPActive,
  isPiPSupported
});

// Watch for room name changes
watch(() => props.roomName, (newRoomName, oldRoomName) => {
  if (newRoomName !== oldRoomName && isActive.value) {
    // Room changed - need to reinitialize
    if (jitsiApi.value) {
      jitsiApi.value.dispose();
    }
    initializeJitsi();
  }
});

// Watch for waiting room status changes
watch(() => props.waitingRoomStatus, (newStatus) => {
  if (newStatus === 'admitted' && !isWaitingRoomAdmitted.value) {
    isWaitingRoomAdmitted.value = true;
    emit('waiting-room-admitted');
    // Inicializar Jitsi cuando es admitido
    initializeJitsi();
  }
});

// Escuchar evento global de admisión
const handleWaitingRoomAdmitted = () => {
  if (!isWaitingRoomAdmitted.value) {
    isWaitingRoomAdmitted.value = true;
    emit('waiting-room-admitted');
    initializeJitsi();
  }
};

onMounted(() => {
  initializeJitsi();
  
  // Suscribirse a evento de admisión
  window.addEventListener('waiting-room-admitted', handleWaitingRoomAdmitted as EventListener);
});

onBeforeUnmount(() => {
  if (jitsiApi.value) {
    jitsiApi.value.dispose();
  }
  
  // Limpiar event listener
  window.removeEventListener('waiting-room-admitted', handleWaitingRoomAdmitted as EventListener);
});
</script>

<style scoped>
.jitsi-meet-container {
  width: 100%;
  height: 100%;
  position: relative;
  background-color: #000;
}

/* Waiting Room Styles */
.jitsi-waiting-room {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 2rem;
  text-align: center;
}

.waiting-animation {
  position: relative;
  width: 120px;
  height: 120px;
  margin-bottom: 2rem;
}

.pulse-circle {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 3px solid rgba(255, 255, 255, 0.8);
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

.waiting-message {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
}

.waiting-submessage {
  font-size: 1rem;
  opacity: 0.9;
  margin: 0;
}

/* Existing Styles */
.jitsi-meet-container {
  width: 100%;
  height: 100%;
  position: relative;
  background-color: #000;
}

.jitsi-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: white;
  font-family: system-ui, -apple-system, sans-serif;
}

.jitsi-error {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #ef5350;
  background-color: #ffebee;
  padding: 20px;
  text-align: center;
}

/* Deep selector for Jitsi iframe */
:deep(iframe) {
  border: none;
  width: 100%;
  height: 100%;
}
</style>
