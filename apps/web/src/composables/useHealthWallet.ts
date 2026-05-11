import { ref, reactive } from 'vue';
import { useApi } from '@/composables/useApi';
import type { 
  Notification, 
  NotificationType, 
  TipoDocumento,
  ApiResponse
} from '@galeno/shared-types';

// Types
interface HealthWallet {
  id: string;
  pacienteId: string;
  walletId: string;
  version: number;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Paciente {
  id: string;
  nombre: string;
  cedula: string;
  fechaNacimiento: string;
  telefono?: string;
  email?: string;
}

interface ConexionPaciente {
  id: string;
  pacienteId: string;
  doctorId: string;
  autorizadoPor: string;
  fechaAutorizacion: string;
  estado: string;
  tipoAcceso: string;
  permisos: Record<string, any>;
  revocadaEn?: string;
  doctor: {
    nombre: string;
    especialidad: string | null;
  };
}

interface HealthWalletNotification {
  id: string;
  titulo: string;
  cuerpo: string;
  datos: Record<string, any>;
  tipo: string;
  leido: boolean;
  createdAt: string;
}

interface QRValidationResult {
  wallet: HealthWallet;
  paciente: Paciente;
  isValid: boolean;
  expiresAt: Date;
}

interface ConsentRequest {
  pacienteId: string;
  doctorId: string;
  tipoAcceso: string;
  permisos: Record<string, any>;
}

interface GrantConsentParams {
  conexionId: string;
  granted: boolean;
}

interface RevokeAccessParams {
  conexionId: string;
}

interface GeneratePharmacyQRParams {
  pacienteId: string;
  durationHours?: number;
}

// Composable
export function useHealthWallet() {
  const { get, post, patch, delete: del, isLoading: apiLoading } = useApi();
  
  // State
  const walletInfo = ref<{ wallet: HealthWallet; paciente: Paciente; connections: ConexionPaciente[] } | null>(null);
  const walletQR = ref<string | null>(null);
  const pharmacyQR = ref<string | null>(null);
  const walletNotifications = ref<HealthWalletNotification[]>([]);
  
  const loading = reactive({
    wallet: false,
    qr: false,
    connections: false,
    requests: false,
    notifications: false
  });
  
  // Methods
  const createHealthWallet = async (pacienteId: string) => {
    loading.wallet = true;
    try {
      const response = await post<any>(`/health-wallet/wallet/create/${pacienteId}`, {});
      return response.data;
    } finally {
      loading.wallet = false;
    }
  };

  const getWalletDetails = async (pacienteId: string) => {
    loading.wallet = true;
    try {
      const response = await get<any>(`/health-wallet/wallet/details/${pacienteId}`);
      if (response.success && response.data) {
        walletInfo.value = response.data;
      }
      return response.data;
    } finally {
      loading.wallet = false;
    }
  };

  const generateWalletQR = async (pacienteId: string) => {
    loading.qr = true;
    try {
      const response = await get<{ qrCode: string }>(`/health-wallet/wallet/qr/${pacienteId}`);
      if (response.success && response.data) {
        walletQR.value = response.data.qrCode;
        return response.data.qrCode;
      }
      return null;
    } finally {
      loading.qr = false;
    }
  };

  const validateWalletQR = async (qrData: string) => {
    const response = await post<QRValidationResult>('/health-wallet/wallet/qr/validate', { qrData });
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || 'Error validating wallet QR');
  };

  const generatePharmacyQR = async ({ pacienteId, durationHours = 1 }: GeneratePharmacyQRParams) => {
    const response = await post<{ qrCode: string }>('/health-wallet/pharmacy/qr/generate', {
      pacienteId,
      durationHours
    });
    if (response.success && response.data) {
      pharmacyQR.value = response.data.qrCode;
      return response.data.qrCode;
    }
    throw new Error(response.error || 'Error generating pharmacy QR');
  };

  const requestAccess = async (request: ConsentRequest) => {
    const response = await post<any>('/health-wallet/access/request', request);
    if (response.success) return response.data;
    throw new Error(response.error || 'Error requesting access');
  };

  const requestConsent = async (request: ConsentRequest) => {
    const response = await post<any>('/health-wallet/consent/request', request);
    if (response.success) return response.data;
    throw new Error(response.error || 'Error requesting consent');
  };

  const respondToConsent = async ({ conexionId, granted }: GrantConsentParams) => {
    const response = await post<any>('/health-wallet/consent/respond', {
      conexionId,
      granted
    });
    if (response.success) return response.data;
    throw new Error(response.error || 'Error responding to consent');
  };

  const getConsentRequests = async (pacienteId: string) => {
    loading.requests = true;
    try {
      const response = await get<any[]>(`/health-wallet/consent/requests/${pacienteId}`);
      return response.data;
    } finally {
      loading.requests = false;
    }
  };

  const getAuthorizedDoctors = async (pacienteId: string) => {
    const response = await get<any[]>(`/health-wallet/authorized/doctors/${pacienteId}`);
    if (response.success) return response.data;
    throw new Error(response.error || 'Error getting authorized doctors');
  };

  const revokeAccess = async ({ conexionId }: RevokeAccessParams) => {
    const response = await post<any>(`/health-wallet/access/revoke/${conexionId}`, {});
    if (response.success) return response.data;
    throw new Error(response.error || 'Error revoking access');
  };

  const revokeConsent = async (conexionId: string) => {
    const response = await post<any>(`/health-wallet/consent/revoke/${conexionId}`, {});
    if (response.success) return response.data;
    throw new Error(response.error || 'Error revoking consent');
  };

  const getHealthNotifications = async () => {
    loading.notifications = true;
    try {
      const response = await get<HealthWalletNotification[]>('/health-wallet/notifications');
      if (response.success && response.data) {
        walletNotifications.value = response.data;
      }
      return response.data;
    } finally {
      loading.notifications = false;
    }
  };

  const markNotificationAsRead = async (notificationId: string) => {
    const response = await patch<any>(`/health-wallet/notifications/${notificationId}/read`, {});
    if (response.success) {
      // Update local state
      const notification = walletNotifications.value.find(n => n.id === notificationId);
      if (notification) {
        notification.leido = true;
      }
      return response.data;
    }
    throw new Error(response.error || 'Error marking notification as read');
  };

  // ============= TEMPORAL ACCESS FOR TELECONSULTA (TASK-039) =============

  interface TemporalTokenRequest {
    citaId: string;
    doctorId: string;
    pacienteId: string;
  }

  interface TemporalTokenResponse {
    token: string;
    expiresAt: string;
  }

  interface ValidationResult {
    valid: boolean;
    error?: string;
    citaId?: string;
    doctorId?: string;
    pacienteId?: string;
    expiresAt?: string;
  }

  interface PatientHistory {
    consultas: Array<{
      id: string;
      createdAt: string;
      motivoConsulta?: string;
      diagnosticoCie10?: any;
      doctor: {
        nombre: string;
        especialidad?: string;
      };
    }>;
    documentos: Array<{
      id: string;
      tipo: TipoDocumento;
      fechaEmision: string;
      consultaId?: string;
      downloadUrl: string;
      viewUrl: string;
    }>;
    paciente: {
      id: string;
      nombre: string;
    };
  }

  const temporalToken = ref<string | null>(null);
  const temporalValidation = ref<ValidationResult | null>(null);
  const patientHistory = ref<PatientHistory | null>(null);

  /**
   * Solicita un token de acceso temporal para teleconsulta
   */
  const requestTemporalAccess = async (params: TemporalTokenRequest): Promise<TemporalTokenResponse> => {
    const response = await post<TemporalTokenResponse>('/wallet/temporal/request', params);
    if (response.success && response.data) {
      temporalToken.value = response.data.token;
      return response.data;
    }
    throw new Error(response.error || 'Error requesting temporal access');
  };

  /**
   * Valida un token de acceso temporal
   */
  const validateTemporalToken = async (token: string): Promise<ValidationResult> => {
    const response = await get<ValidationResult>(`/wallet/temporal/validate/${token}`);
    if (response.success && response.data) {
      temporalValidation.value = response.data;
      return response.data;
    }
    return { valid: false, error: response.error || 'Token inválido' };
  };

  /**
   * Obtiene el historial del paciente usando token temporal
   */
  const getPatientHistory = async (token: string): Promise<PatientHistory> => {
    const response = await get<PatientHistory>(`/wallet/temporal/history?token=${encodeURIComponent(token)}`);
    if (response.success && response.data) {
      patientHistory.value = response.data;
      return response.data;
    }
    throw new Error(response.error || 'Error fetching patient history');
  };

  /**
   * Obtiene la lista de documentos del paciente
   */
  const getPatientDocuments = async (token: string): Promise<PatientHistory['documentos']> => {
    const response = await get<PatientHistory['documentos']>(`/wallet/temporal/documents?token=${encodeURIComponent(token)}`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || 'Error fetching documents');
  };

  /**
   * Revoca el acceso temporal después de la consulta
   */
  const revokeTemporalAccess = async (citaId: string): Promise<void> => {
    const response = await post<any>('/wallet/temporal/revoke', { citaId });
    if (!response.success) {
      throw new Error(response.error || 'Error revoking access');
    }
    temporalToken.value = null;
    temporalValidation.value = null;
    patientHistory.value = null;
  };

  /**
   * Verifica si hay una conexión temporal activa
   */
  const checkActiveConnection = async (citaId: string): Promise<boolean> => {
    const response = await get<{ hasActiveConnection: boolean }>(`/wallet/temporal/check/${citaId}`);
    return response.success && response.data?.hasActiveConnection === true;
  };

  return {
    // State
    walletInfo,
    walletQR,
    pharmacyQR,
    notifications: walletNotifications,
    temporalToken,
    temporalValidation,
    patientHistory,
    loading,

    // Methods
    createHealthWallet,
    getWalletDetails,
    generateWalletQR,
    validateWalletQR,
    generatePharmacyQR,
    requestAccess,
    requestConsent,
    respondToConsent,
    getConsentRequests,
    getAuthorizedDoctors,
    revokeAccess,
    revokeConsent,
    getNotifications: getHealthNotifications,
    markNotificationAsRead,

    // Temporal Access (TASK-039)
    requestTemporalAccess,
    validateTemporalToken,
    getPatientHistory,
    getPatientDocuments,
    revokeTemporalAccess,
    checkActiveConnection,
  };
}