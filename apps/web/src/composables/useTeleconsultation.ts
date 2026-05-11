// apps/web/src/composables/useTeleconsultation.ts
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useJitsi } from './useJitsi';
import { usePiP } from './usePiP';
import { useSSE } from './useSSE';
import { useFirmaDigital } from './useFirmaDigital';
import { apiClient } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { useToast } from 'vue-toastification';

export interface ConsultationData {
  citaId: string;
  pacienteId: string;
  consultaId: string;
  paciente: {
    id: string;
    nombre: string;
    cedula: string;
    fechaNacimiento: string;
    telefono?: string;
    email?: string;
  };
  cita: {
    id: string;
    fecha: string;
    hora: string;
    tipo: string;
    estado: string;
    linkVideo?: string;
  };
  doctor: {
    id: string;
    nombre: string;
    especialidad: string;
  };
}

export interface ConsultationState {
  // Video Call State
  isCallActive: boolean;
  isPiPActive: boolean;
  isFullscreen: boolean;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'disconnected';
  
  // Consultation Data
  citaId: string;
  pacienteId: string;
  consultaId: string;
  duration: number; // seconds
  
  // Clinical Data
  hasNotes: boolean;
  hasDiagnosis: boolean;
  hasPrescription: boolean;
  hasExams: boolean;
  isSigned: boolean;
  
  // UI State
  activeTool: 'notes' | 'diagnosis' | 'prescription' | 'exams' | 'signature';
  showFinalizeDialog: boolean;
  isSaving: boolean;
}

export function useTeleconsultation() {
  const route = useRoute();
  const router = useRouter();
  const authStore = useAuthStore();
  const toast = useToast();
  
  // Estado de la consulta
  const data = ref<ConsultationData | null>(null);
  const isLoading = ref(true);
  const error = ref<string | null>(null);
  
  // Estado de la videollamada
  const isCallActive = ref(false);
  const duration = ref(0);
  const connectionQuality = ref<'excellent' | 'good' | 'poor' | 'disconnected'>('excellent');
  
  // Estado clínico
  const hasNotes = ref(false);
  const hasDiagnosis = ref(false);
  const hasPrescription = ref(false);
  const hasExams = ref(false);
  const isSigned = ref(false);
  
  // Estado UI
  const activeTool = ref<'notes' | 'diagnosis' | 'prescription' | 'exams' | 'signature'>('notes');
  const showFinalizeDialog = ref(false);
  const isSaving = ref(false);
  
  // Composables
  const { 
    initializeJitsi, 
    endCall: jitsiEndCall,
    isJitsiInitialized 
  } = useJitsi();
  
  const { 
    togglePiP: baseTogglePiP, 
    isSupported: isPiPSupported 
  } = usePiP();
  
  const { 
    connect: sseConnect, 
    disconnect: sseDisconnect 
  } = useSSE();
  
  const {
    firmarXML,
    validarFirmaServidor,
    certificadoInfo
  } = useFirmaDigital();

  // Estado PiP y Fullscreen
  const isPiPActive = ref(false);
  const isFullscreen = ref(false);

  // Cargar datos de la consulta
  const loadConsultationData = async () => {
    try {
      isLoading.value = true;
      error.value = null;
      
      const response = await apiClient.get<{ data: ConsultationData }>(
        `/api/v1/agenda/citas/${citaId.value}`
      );
      
      if (response.success && response.data) {
        data.value = response.data.data;
        
        // Inicializar videollamada
        const roomName = `galeno-${citaId.value}`;
        await initializeJitsi(roomName, {
          displayName: authStore.user?.nombre || 'Dr. Usuario',
          email: authStore.user?.email || ''
        });
        
        // Conectar SSE
        if (authStore.user?.id) {
          sseConnect(authStore.user.id);
        }
        
        toast.success('Teleconsulta cargada exitosamente');
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Error al cargar consulta';
      error.value = message;
      toast.error(message);
    } finally {
      isLoading.value = false;
    }
  };
  
  // Toggle PiP con manejo de estado
  const togglePiP = async () => {
    try {
      await baseTogglePiP();
      isPiPActive.value = !isPiPActive.value;
      toast.success(isPiPActive.value ? 'PiP activado' : 'PiP desactivado');
    } catch (e) {
      toast.error('Error al cambiar PiP');
    }
  };
  
  // Toggle Fullscreen
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        isFullscreen.value = true;
      } else {
        await document.exitFullscreen();
        isFullscreen.value = false;
      }
    } catch (e) {
      toast.error('Error al cambiar pantalla completa');
    }
  };
  
  // Finalizar consulta
  const finalizeConsultation = async () => {
    if (!canFinalize.value) {
      const missingFields = [];
      if (!hasNotes.value) missingFields.push('notas');
      if (!hasDiagnosis.value) missingFields.push('diagnóstico');
      if (!isSigned.value) missingFields.push('firma');
      
      toast.error(`Faltan campos requeridos: ${missingFields.join(', ')}`);
      throw new Error('No se puede finalizar: faltan datos requeridos');
    }
    
    try {
      isSaving.value = true;
      
      const response = await apiClient.put(
        `/api/v1/consultas/${data.value?.consultaId}/finalizar`,
        {
          notas: hasNotes.value,
          diagnosticos: hasDiagnosis.value,
          medicamentos: hasPrescription.value,
          examenes: hasExams.value,
          firma: isSigned.value
        }
      );
      
      if (response.success) {
        toast.success('Consulta finalizada exitosamente');
        endCall();
        
        // Redirigir a agenda
        setTimeout(() => {
          router.push('/agenda');
        }, 1000);
        
        return { success: true };
      }
      
      throw new Error('Error al finalizar consulta');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Error al finalizar consulta';
      toast.error(message);
      throw e;
    } finally {
      isSaving.value = false;
    }
  };
  
  // Guardar borrador
  const saveDraft = async () => {
    try {
      isSaving.value = true;
      
      await apiClient.post(
        `/api/v1/consultas/${data.value?.consultaId}/borrador`,
        {
          notas: hasNotes.value,
          diagnosticos: hasDiagnosis.value,
          medicamentos: hasPrescription.value,
          examenes: hasExams.value
        }
      );
      
      toast.success('Borrador guardado');
    } catch (e) {
      toast.error('Error al guardar borrador');
    } finally {
      isSaving.value = false;
    }
  };
  
  // Finalizar llamada
  const endCall = () => {
    jitsiEndCall();
    isCallActive.value = false;
    stopDurationTimer();
    toast.info('Videollamada finalizada');
  };
  
  // Manejar inicio de llamada
  const handleCallStarted = () => {
    isCallActive.value = true;
    startDurationTimer();
    toast.success('Teleconsulta iniciada');
  };
  
  // Manejar fin de llamada
  const handleCallEnded = () => {
    isCallActive.value = false;
    stopDurationTimer();
  };
  
  // Manejar participante
  const handleParticipantJoined = (participant: { name: string }) => {
    toast.info(`${participant.name} se ha unido a la consulta`);
  };
  
  // Manejar calidad de conexión
  const handleConnectionQualityChange = (quality: 'excellent' | 'good' | 'poor' | 'disconnected') => {
    connectionQuality.value = quality;
    
    const messages = {
      excellent: 'Conexión excelente',
      good: 'Conexión buena',
      poor: 'Conexión débil - considere reducir calidad de video',
      disconnected: 'Sin conexión - reconectando...'
    };
    
    if (quality === 'poor' || quality === 'disconnected') {
      toast.warning(messages[quality]);
    }
  };
  
  // Timer de duración
  let durationTimer: NodeJS.Timeout | null = null;
  
  const startDurationTimer = () => {
    stopDurationTimer();
    durationTimer = setInterval(() => {
      duration.value++;
    }, 1000);
  };
  
  const stopDurationTimer = () => {
    if (durationTimer) {
      clearInterval(durationTimer);
      durationTimer = null;
    }
  };
  
  // Validar si puede finalizar
  const canFinalize = computed(() => {
    return hasNotes.value && hasDiagnosis.value && isSigned.value;
  });
  
  // Formatear duración
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Estado de la consulta para UI
  const consultaEstadoClass = computed(() => {
    const classes: Record<string, string> = {
      pendiente: 'status-pending',
      en_proceso: 'status-in-progress',
      completada: 'status-completed',
      cancelada: 'status-cancelled'
    };
    return classes[data.value?.cita.estado || 'pendiente'] || 'status-pending';
  });
  
  const estadoIcon = computed(() => {
    const icons: Record<string, string> = {
      pendiente: 'mdi-clock-outline',
      en_proceso: 'mdi-video',
      completada: 'mdi-check-circle',
      cancelada: 'mdi-close-circle'
    };
    return icons[data.value?.cita.estado || 'pendiente'] || 'mdi-clock-outline';
  });
  
  const consultaEstadoText = computed(() => {
    const texts: Record<string, string> = {
      pendiente: 'Pendiente',
      en_proceso: 'En Proceso',
      completada: 'Completada',
      cancelada: 'Cancelada'
    };
    return texts[data.value?.cita.estado || 'pendiente'] || 'Pendiente';
  });
  
  // Volver
  const handleBack = () => {
    if (isCallActive.value) {
      toast.warning('Finalice la llamada antes de salir');
      return;
    }
    router.back();
  };
  
  // Watch para auto-guardado
  watch(
    [hasNotes, hasDiagnosis, hasPrescription, hasExams],
    () => {
      // Auto-save con debounce de 2 segundos
      const timeout = setTimeout(() => {
        if (data.value?.consultaId) {
          saveDraft();
        }
      }, 2000);
      
      return () => clearTimeout(timeout);
    },
    { deep: true }
  );
  
  // Lifecycle
  onMounted(() => {
    loadConsultationData();
  });
  
  onUnmounted(() => {
    stopDurationTimer();
    sseDisconnect();
    endCall();
  });
  
  return {
    // Data
    data,
    isLoading,
    error,
    
    // Call state
    isCallActive,
    duration,
    connectionQuality,
    
    // Clinical state
    hasNotes,
    hasDiagnosis,
    hasPrescription,
    hasExams,
    isSigned,
    canFinalize,
    
    // UI state
    activeTool,
    showFinalizeDialog,
    isSaving,
    isPiPActive,
    isFullscreen,
    isPiPSupported,
    
    // Computed
    consultaEstadoClass,
    estadoIcon,
    consultaEstadoText,
    formatDuration,
    
    // Methods
    togglePiP,
    toggleFullscreen,
    finalizeConsultation,
    saveDraft,
    endCall,
    loadConsultationData,
    handleCallStarted,
    handleCallEnded,
    handleParticipantJoined,
    handleConnectionQualityChange,
    handleBack,
    
    // Setters
    setHasNotes: (value: boolean) => { hasNotes.value = value; },
    setHasDiagnosis: (value: boolean) => { hasDiagnosis.value = value; },
    setHasPrescription: (value: boolean) => { hasPrescription.value = value; },
    setHasExams: (value: boolean) => { hasExams.value = value; },
    setIsSigned: (value: boolean) => { isSigned.value = value; },
    setActiveTool: (tool: typeof activeTool.value) => { activeTool.value = tool; },
    setShowFinalizeDialog: (value: boolean) => { showFinalizeDialog.value = value; }
  };
}

export default useTeleconsultation;
