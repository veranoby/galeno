// apps/web/src/composables/useTranscription.ts
import { ref, computed } from 'vue';
import { useToast } from 'vue-toastification';

export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

export function useTranscription() {
  const toast = useToast();

  // Estado
  const isTranscribing = ref(false);
  const transcript = ref<TranscriptionSegment[]>([]);
  const currentText = ref('');
  const error = ref<string | null>(null);
  const recognition = ref<any>(null);

  // Getters
  const fullTranscript = computed(() => {
    return transcript.value.map(s => s.text).join(' ');
  });

  // Inicializar reconocimiento de voz
  function initializeSpeechRecognition() {
    try {
      // Verificar soporte
      const SpeechRecognition = (window as any).SpeechRecognition || 
                                (window as any).webkitSpeechRecognition;

      if (!SpeechRecognition) {
        error.value = 'Reconocimiento de voz no soportado en este navegador';
        return null;
      }

      const recognitionInstance = new SpeechRecognition();
      recognitionInstance.continuous = true;
      recognitionInstance.interimResults = true;
      recognitionInstance.lang = 'es-EC';

      recognitionInstance.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalTranscript) {
          transcript.value.push({
            start: Date.now(),
            end: Date.now(),
            text: finalTranscript
          });
        }

        currentText.value = interimTranscript;
      };

      recognitionInstance.onerror = (event: any) => {
        error.value = event.error;
        toast.error(`Error en transcripción: ${event.error}`);
      };

      recognitionInstance.onend = () => {
        if (isTranscribing.value) {
          recognitionInstance.start();
        }
      };

      recognition.value = recognitionInstance;
      return recognitionInstance;
    } catch (err: any) {
      error.value = err.message || 'Error al inicializar transcripción';
      toast.error(error.value);
      return null;
    }
  }

  // Iniciar transcripción
  function startTranscription() {
    if (!recognition.value) {
      initializeSpeechRecognition();
    }

    if (!recognition.value) {
      return false;
    }

    try {
      recognition.value.start();
      isTranscribing.value = true;
      error.value = null;
      toast.success('Transcripción iniciada');
      return true;
    } catch (err: any) {
      error.value = err.message || 'Error al iniciar transcripción';
      toast.error(error.value);
      return false;
    }
  }

  // Detener transcripción
  function stopTranscription() {
    if (!recognition.value) return;

    try {
      recognition.value.stop();
      isTranscribing.value = false;
      toast.info('Transcripción detenida');
    } catch (err: any) {
      error.value = err.message;
    }
  }

  // Limpiar transcripción
  function clearTranscript() {
    transcript.value = [];
    currentText.value = '';
    error.value = null;
  }

  // Exportar transcripción
  function exportTranscript(format: 'txt' | 'json' = 'txt') {
    const content = format === 'json' 
      ? JSON.stringify(transcript.value, null, 2)
      : fullTranscript.value;

    const blob = new Blob([content], { 
      type: format === 'json' ? 'application/json' : 'text/plain' 
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcripcion-${new Date().toISOString()}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Transcripción exportada');
  }

  return {
    // State
    isTranscribing,
    transcript,
    currentText,
    fullTranscript,
    error,

    // Actions
    initializeSpeechRecognition,
    startTranscription,
    stopTranscription,
    clearTranscript,
    exportTranscript
  };
}

export default useTranscription;
