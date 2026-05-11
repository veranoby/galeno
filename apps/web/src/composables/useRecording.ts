// apps/web/src/composables/useRecording.ts
import { ref, computed } from 'vue';
import { useToast } from 'vue-toastification';

export interface RecordingState {
  isRecording: boolean;
  duration: number;
  blob?: Blob;
  url?: string;
}

export function useRecording() {
  const toast = useToast();

  // Estado
  const mediaRecorder = ref<MediaRecorder | null>(null);
  const chunks = ref<Blob[]>([]);
  const recordingState = ref<RecordingState>({
    isRecording: false,
    duration: 0
  });
  const error = ref<string | null>(null);

  // Getters
  const isRecording = computed(() => recordingState.value.isRecording);
  const recordingUrl = computed(() => recordingState.value.url);
  const recordingDuration = computed(() => recordingState.value.duration);

  // Iniciar grabación
  function startRecording(stream: MediaStream) {
    try {
      error.value = null;

      // Verificar soporte
      if (!MediaRecorder.isTypeSupported('video/webm')) {
        throw new Error('Formato de grabación no soportado');
      }

      // Crear MediaRecorder
      const recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm',
        videoBitsPerSecond: 2500000 // 2.5 Mbps
      });

      chunks.value = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.value.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks.value, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);

        recordingState.value = {
          isRecording: false,
          duration: recordingState.value.duration,
          blob,
          url
        };

        toast.success('Grabación completada');
      };

      recorder.onerror = (event: any) => {
        error.value = event.error?.message || 'Error en la grabación';
        toast.error(error.value);
        stopRecording();
      };

      // Iniciar grabación
      recorder.start(1000); // Guardar chunks cada segundo
      mediaRecorder.value = recorder;

      // Iniciar timer
      const startTime = Date.now();
      const timer = setInterval(() => {
        recordingState.value.duration = Math.floor((Date.now() - startTime) / 1000);
      }, 1000);

      recordingState.value = {
        isRecording: true,
        duration: 0
      };

      // Guardar referencia al timer
      (recorder as any)._timer = timer;

      toast.success('Grabación iniciada');
      return true;
    } catch (err: any) {
      error.value = err.message || 'Error al iniciar grabación';
      toast.error(error.value);
      return false;
    }
  }

  // Detener grabación
  function stopRecording() {
    if (!mediaRecorder.value || !recordingState.value.isRecording) {
      return null;
    }

    // Detener timer
    const timer = (mediaRecorder.value as any)._timer;
    if (timer) {
      clearInterval(timer);
    }

    // Detener grabación
    mediaRecorder.value.stop();
    mediaRecorder.value = null;

    return recordingState.value;
  }

  // Pausar grabación
  function pauseRecording() {
    if (!mediaRecorder.value || !recordingState.value.isRecording) return;

    mediaRecorder.value.pause();
    toast.info('Grabación pausada');
  }

  // Reanudar grabación
  function resumeRecording() {
    if (!mediaRecorder.value || !recordingState.value.isRecording) return;

    mediaRecorder.value.resume();
    toast.info('Grabación reanudada');
  }

  // Limpiar grabación
  function clearRecording() {
    if (recordingState.value.url) {
      URL.revokeObjectURL(recordingState.value.url);
    }

    chunks.value = [];
    recordingState.value = {
      isRecording: false,
      duration: 0
    };
    error.value = null;
  }

  // Descargar grabación
  function downloadRecording(filename = 'grabacion') {
    if (!recordingState.value.blob) {
      toast.error('No hay grabación para descargar');
      return;
    }

    const a = document.createElement('a');
    a.href = recordingState.value.url || '';
    a.download = `${filename}-${new Date().toISOString()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    toast.success('Grabación descargada');
  }

  return {
    // State
    isRecording,
    recordingUrl,
    recordingDuration,
    error,

    // Actions
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    clearRecording,
    downloadRecording
  };
}

export default useRecording;
