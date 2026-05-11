/**
 * Composable para gestión de Sala de Espera Virtual
 *
 * Proporciona funciones para:
 * - Unirse a la sala de espera (paciente)
 * - Obtener estado de la sala
 * - Admitir/rechazar pacientes (doctor)
 * - Escuchar eventos SSE en tiempo real
 * - Manejar timeout y expiración
 */

import { ref, computed, onUnmounted } from 'vue';
import { useApi } from './useApi';
import { useSSE } from './useSSE';
import type { Ref } from 'vue';

/**
 * Estados de la sala de espera
 */
export enum WaitingRoomState {
  WAITING = 'waiting',
  ADMITTED = 'admitted',
  IN_SESSION = 'in-session',
  ENDED = 'ended',
  TIMEOUT = 'timeout',
}

/**
 * Estado de la sala de espera
 */
export interface WaitingRoomStatus {
  estado: WaitingRoomState;
  timeRemaining?: number;
  timeElapsed?: number;
  enteredAt: string;
  expiresAt: string;
  paciente?: {
    id: string;
    nombre: string;
  };
}

/**
 * Datos de la sala de espera
 */
export interface WaitingRoom {
  id: string;
  citaId: string;
  pacienteId: string;
  doctorId: string;
  estado: WaitingRoomState;
  enteredAt: string;
  admittedAt?: string;
  sessionStartedAt?: string;
  endedAt?: string;
  rejectReason?: string;
  expiresAt: string;
  admissionAttempts: number;
}

/**
 * Evento SSE de sala de espera
 */
export interface WaitingRoomSSEEvent {
  type: 'WAITING_ROOM_UPDATE' | 'WAITING_ROOM_ADMITTED' | 'WAITING_ROOM_REJECTED' | 'WAITING_ROOM_TIMEOUT';
  data: {
    citaId: string;
    estado: WaitingRoomState;
    timestamp: number;
    motivo?: string;
  };
}

export interface UseWaitingRoomOptions {
  /** ID del usuario actual */
  userId: string;
  /** Rol del usuario (paciente o doctor) */
  userRole?: 'paciente' | 'doctor';
  /** Habilitar auto-reconexión SSE */
  autoReconnect?: boolean;
  /** Intervalo de polling para estado (ms) */
  pollingInterval?: number;
}

/**
 * Composable para gestión de Sala de Espera
 */
export function useWaitingRoom(options: UseWaitingRoomOptions) {
  const { userId, autoReconnect = true, pollingInterval = 5000 } = options;

  const { get, post, del, error: apiError, isLoading } = useApi();
  const { connected: sseConnected, connect: connectSSE, disconnect: disconnectSSE } = useSSE(userId, {
    reconnectInterval: 3000,
    maxReconnectInterval: 30000,
    heartbeatTimeout: 60000,
  });

  // Estado reactivo
  const currentCitaId: Ref<string | null> = ref(null);
  const status: Ref<WaitingRoomStatus | null> = ref(null);
  const waitingRoom: Ref<WaitingRoom | null> = ref(null);
  const error: Ref<string | null> = ref(null);
  const isAdmitted: Ref<boolean> = computed(() => 
    status.value?.estado === WaitingRoomState.ADMITTED ||
    status.value?.estado === WaitingRoomState.IN_SESSION
  );
  const isWaiting: Ref<boolean> = computed(() => 
    status.value?.estado === WaitingRoomState.WAITING
  );
  const isEnded: Ref<boolean> = computed(() => 
    status.value?.estado === WaitingRoomState.ENDED ||
    status.value?.estado === WaitingRoomState.TIMEOUT
  );
  const timeRemaining: Ref<number> = computed(() => status.value?.timeRemaining || 0);
  const timeElapsed: Ref<number> = computed(() => status.value?.timeElapsed || 0);

  // Polling interval
  let pollingTimer: NodeJS.Timeout | null = null;

  /**
   * Unirse a la sala de espera (paciente)
   */
  const joinWaitingRoom = async (citaId: string): Promise<WaitingRoom | null> => {
    error.value = null;
    currentCitaId.value = citaId;

    const response = await post<WaitingRoom>(
      `/api/v1/teleconsulta/waiting-room`,
      { citaId }
    );

    if (response.success && response.data) {
      waitingRoom.value = response.data;
      await fetchStatus(citaId);
      return response.data;
    } else {
      error.value = response.error || 'Error al unirse a la sala de espera';
      return null;
    }
  };

  /**
   * Obtener estado de la sala de espera
   */
  const fetchStatus = async (citaId: string): Promise<WaitingRoomStatus | null> => {
    error.value = null;

    const response = await get<WaitingRoomStatus>(
      `/api/v1/teleconsulta/waiting-room/${citaId}/status`
    );

    if (response.success && response.data) {
      status.value = response.data;
      return response.data;
    } else {
      error.value = response.error || 'Error al obtener estado';
      return null;
    }
  };

  /**
   * Validar acceso a la sala de espera
   */
  const validateAccess = async (citaId: string): Promise<{ valid: boolean; role?: string; reason?: string } | null> => {
    error.value = null;

    const response = await get<{ valid: boolean; role?: string; reason?: string }>(
      `/api/v1/teleconsulta/waiting-room/${citaId}/validate`
    );

    if (response.success && response.data) {
      return response.data;
    } else {
      error.value = response.error || 'Error al validar acceso';
      return null;
    }
  };

  /**
   * Admitir paciente (doctor)
   */
  const admitPatient = async (citaId: string): Promise<WaitingRoom | null> => {
    error.value = null;

    const response = await post<WaitingRoom>(
      `/api/v1/teleconsulta/waiting-room/${citaId}/admit`,
      {}
    );

    if (response.success && response.data) {
      waitingRoom.value = response.data;
      await fetchStatus(citaId);
      return response.data;
    } else {
      error.value = response.error || 'Error al admitir paciente';
      return null;
    }
  };

  /**
   * Rechazar paciente (doctor)
   */
  const rejectPatient = async (citaId: string, reason?: string): Promise<WaitingRoom | null> => {
    error.value = null;

    const response = await post<WaitingRoom>(
      `/api/v1/teleconsulta/waiting-room/${citaId}/reject`,
      { reason }
    );

    if (response.success && response.data) {
      waitingRoom.value = response.data;
      await fetchStatus(citaId);
      return response.data;
    } else {
      error.value = response.error || 'Error al rechazar paciente';
      return null;
    }
  };

  /**
   * Iniciar sesión (doctor)
   */
  const startSession = async (citaId: string): Promise<WaitingRoom | null> => {
    error.value = null;

    const response = await post<WaitingRoom>(
      `/api/v1/teleconsulta/waiting-room/${citaId}/start-session`,
      {}
    );

    if (response.success && response.data) {
      waitingRoom.value = response.data;
      await fetchStatus(citaId);
      return response.data;
    } else {
      error.value = response.error || 'Error al iniciar sesión';
      return null;
    }
  };

  /**
   * Terminar sesión (doctor)
   */
  const endSession = async (citaId: string): Promise<WaitingRoom | null> => {
    error.value = null;

    const response = await del<WaitingRoom>(
      `/api/v1/teleconsulta/waiting-room/${citaId}`
    );

    if (response.success && response.data) {
      waitingRoom.value = response.data;
      await fetchStatus(citaId);
      return response.data;
    } else {
      error.value = response.error || 'Error al terminar sesión';
      return null;
    }
  };

  /**
   * Cancelar espera (paciente)
   */
  const cancelWaiting = async (): Promise<void> => {
    error.value = null;
    // El paciente puede salir simplemente cerrando la ventana
    // No necesitamos hacer una llamada API específica
    currentCitaId.value = null;
    status.value = null;
    waitingRoom.value = null;
  };

  /**
   * Manejar eventos SSE
   */
  const handleSSEEvent = (event: CustomEvent<WaitingRoomSSEEvent>): void => {
    const sseEvent = event.detail;

    // Solo procesar eventos para la cita actual
    if (sseEvent.data.citaId !== currentCitaId.value) {
      return;
    }

    console.log('[WaitingRoom] SSE Event received:', sseEvent);

    // Actualizar estado según el evento
    switch (sseEvent.type) {
      case 'WAITING_ROOM_ADMITTED':
        status.value = {
          ...status.value,
          estado: WaitingRoomState.ADMITTED,
        } as WaitingRoomStatus;
        // Emitir evento global para notificaciones
        window.dispatchEvent(new CustomEvent('waiting-room-admitted', {
          detail: { citaId: currentCitaId.value },
        }));
        break;

      case 'WAITING_ROOM_REJECTED':
        status.value = {
          ...status.value,
          estado: WaitingRoomState.ENDED,
        } as WaitingRoomStatus;
        window.dispatchEvent(new CustomEvent('waiting-room-rejected', {
          detail: { 
            citaId: currentCitaId.value,
            motivo: sseEvent.data.motivo,
          },
        }));
        break;

      case 'WAITING_ROOM_TIMEOUT':
        status.value = {
          ...status.value,
          estado: WaitingRoomState.TIMEOUT,
        } as WaitingRoomStatus;
        window.dispatchEvent(new CustomEvent('waiting-room-timeout', {
          detail: { citaId: currentCitaId.value },
        }));
        break;

      case 'WAITING_ROOM_UPDATE':
        status.value = {
          ...status.value,
          estado: sseEvent.data.estado,
        } as WaitingRoomStatus;
        break;
    }
  };

  /**
   * Iniciar polling de estado
   */
  const startPolling = (): void => {
    stopPolling();

    pollingTimer = setInterval(async () => {
      if (currentCitaId.value) {
        await fetchStatus(currentCitaId.value);
      }
    }, pollingInterval);
  };

  /**
   * Detener polling de estado
   */
  const stopPolling = (): void => {
    if (pollingTimer) {
      clearInterval(pollingTimer);
      pollingTimer = null;
    }
  };

  /**
   * Inicializar conexión SSE
   */
  const initializeSSE = (): void => {
    if (autoReconnect && !sseConnected.value) {
      connectSSE();
    }

    // Suscribirse a eventos de waiting room
    window.addEventListener('sse-WAITING_ROOM_ADMITTED', handleSSEEvent as EventListener);
    window.addEventListener('sse-WAITING_ROOM_REJECTED', handleSSEEvent as EventListener);
    window.addEventListener('sse-WAITING_ROOM_TIMEOUT', handleSSEEvent as EventListener);
    window.addEventListener('sse-WAITING_ROOM_UPDATE', handleSSEEvent as EventListener);
  };

  /**
   * Limpiar recursos
   */
  const cleanup = (): void => {
    stopPolling();
    disconnectSSE();

    window.removeEventListener('sse-WAITING_ROOM_ADMITTED', handleSSEEvent as EventListener);
    window.removeEventListener('sse-WAITING_ROOM_REJECTED', handleSSEEvent as EventListener);
    window.removeEventListener('sse-WAITING_ROOM_TIMEOUT', handleSSEEvent as EventListener);
    window.removeEventListener('sse-WAITING_ROOM_UPDATE', handleSSEEvent as EventListener);

    currentCitaId.value = null;
    status.value = null;
    waitingRoom.value = null;
    error.value = null;
  };

  // Limpiar al desmontar
  onUnmounted(() => {
    cleanup();
  });

  return {
    // Estado
    status,
    waitingRoom,
    error,
    apiError,
    isLoading,
    sseConnected,
    
    // Computed
    isAdmitted,
    isWaiting,
    isEnded,
    timeRemaining,
    timeElapsed,
    currentCitaId,
    
    // Métodos
    joinWaitingRoom,
    fetchStatus,
    validateAccess,
    admitPatient,
    rejectPatient,
    startSession,
    endSession,
    cancelWaiting,
    initializeSSE,
    startPolling,
    stopPolling,
    cleanup,
  };
}
