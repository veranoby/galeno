// apps/web/src/composables/useWebRTC.ts
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useToast } from 'vue-toastification';

export interface WebRTCStats {
  bitrate: number;
  framerate: number;
  resolution: string;
  codec: string;
}

export interface Participant {
  id: string;
  name: string;
  isSpeaking: boolean;
  hasVideo: boolean;
  hasAudio: boolean;
  stream?: MediaStream;
}

export function useWebRTC() {
  const toast = useToast();

  // Estado
  const localStream = ref<MediaStream | null>(null);
  const remoteStreams = ref<MediaStream[]>([]);
  const participants = ref<Participant[]>([]);
  const isAudioEnabled = ref(true);
  const isVideoEnabled = ref(true);
  const isScreenSharing = ref(false);
  const screenStream = ref<MediaStream | null>(null);
  const stats = ref<WebRTCStats | null>(null);
  const error = ref<string | null>(null);

  // Getters
  const hasLocalMedia = computed(() => !!localStream.value);
  const participantCount = computed(() => participants.value.length);

  // Inicializar media local
  async function initializeLocalMedia(
    options: { audio?: boolean; video?: boolean } = { audio: true, video: true }
  ) {
    try {
      error.value = null;

      const constraints: MediaStreamConstraints = {
        audio: options.audio ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } : false,
        video: options.video ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        } : false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStream.value = stream;

      // Crear participante local
      participants.value.push({
        id: 'local',
        name: 'Tú',
        isSpeaking: false,
        hasVideo: options.video !== false,
        hasAudio: options.audio !== false,
        stream
      });

      toast.success('Cámara y micrófono inicializados');
      return stream;
    } catch (err: any) {
      error.value = err.message || 'Error al acceder a la cámara/micrófono';
      toast.error(error.value);
      throw err;
    }
  }

  // Toggle audio
  function toggleAudio() {
    if (!localStream.value) return;

    const audioTrack = localStream.value.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      isAudioEnabled.value = audioTrack.enabled;
      toast.success(isAudioEnabled.value ? 'Micrófono activado' : 'Micrófono silenciado');
    }
  }

  // Toggle video
  function toggleVideo() {
    if (!localStream.value) return;

    const videoTrack = localStream.value.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      isVideoEnabled.value = videoTrack.enabled;
      toast.success(isVideoEnabled.value ? 'Cámara activada' : 'Cámara desactivada');
    }
  }

  // Screen sharing
  async function toggleScreenShare() {
    try {
      if (isScreenSharing.value) {
        // Detener screen sharing
        if (screenStream.value) {
          screenStream.value.getTracks().forEach(track => track.stop());
          screenStream.value = null;
        }
        isScreenSharing.value = false;
        toast.info('Compartición de pantalla detenida');
      } else {
        // Iniciar screen sharing
        const screen = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 }
          },
          audio: false
        });

        screenStream.value = screen;
        isScreenSharing.value = true;

        // Detectar cuando el usuario detiene la compartición
        screen.getVideoTracks()[0].onended = () => {
          toggleScreenShare();
        };

        toast.success('Compartición de pantalla iniciada');
      }

      return screenStream.value;
    } catch (err: any) {
      error.value = err.message || 'Error al compartir pantalla';
      toast.error(error.value);
      throw err;
    }
  }

  // Get stats
  async function getStats(): Promise<WebRTCStats | null> {
    if (!localStream.value) return null;

    const videoTrack = localStream.value.getVideoTracks()[0];
    if (!videoTrack) return null;

    try {
      const settings = videoTrack.getSettings();
      stats.value = {
        bitrate: 0, // Would need WebRTC connection to get real bitrate
        framerate: settings.frameRate || 0,
        resolution: `${settings.width || 0}x${settings.height || 0}`,
        codec: videoTrack.label || 'unknown'
      };
      return stats.value;
    } catch (err) {
      console.error('Error getting stats:', err);
      return null;
    }
  }

  // Cleanup
  function cleanup() {
    if (localStream.value) {
      localStream.value.getTracks().forEach(track => track.stop());
      localStream.value = null;
    }

    if (screenStream.value) {
      screenStream.value.getTracks().forEach(track => track.stop());
      screenStream.value = null;
    }

    participants.value = [];
    remoteStreams.value = [];
    isAudioEnabled.value = true;
    isVideoEnabled.value = true;
    isScreenSharing.value = false;
    stats.value = null;
    error.value = null;
  }

  // Lifecycle
  onMounted(() => {
    // Auto-initialize on mount (optional)
    // initializeLocalMedia();
  });

  onUnmounted(() => {
    cleanup();
  });

  return {
    // State
    localStream,
    remoteStreams,
    participants,
    isAudioEnabled,
    isVideoEnabled,
    isScreenSharing,
    screenStream,
    stats,
    error,

    // Getters
    hasLocalMedia,
    participantCount,

    // Actions
    initializeLocalMedia,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    getStats,
    cleanup
  };
}

export default useWebRTC;
