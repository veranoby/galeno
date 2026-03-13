/**
 * useWalletBackup Composable
 *
 * Composable para respaldo y restauración encriptada del Health Wallet
 * Implementa TASK-GAP-003: Health Wallet Backup
 *
 * Características:
 * - Encripción AES-256-GCM usando WebCrypto API (client-side)
 * - Derivación de clave PBKDF2 desde password
 * - Descarga local segura de backup
 * - Restauración desde archivo encriptado
 * - Validación de password
 *
 * Security:
 * - Password nunca se envía al servidor
 * - Encripción ocurre en el cliente
 * - Solo datos encriptados se transmiten
 *
 * @module composables/wallet/backup
 */

import { ref, reactive } from 'vue';
import { useApi } from '@/composables/useApi';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Estructura del backup encriptado
 */
export interface EncryptedBackup {
  version: number;
  algorithm: 'AES-256-GCM';
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  salt: string;
  iv: string;
  authTag: string;
  ciphertext: string;
  createdAt: string;
  expiresAt?: string;
}

/**
 * Historial básico del paciente
 */
export interface BasicHistory {
  paciente: {
    id: string;
    nombre: string;
    cedula: string;
    fechaNacimiento: string;
  };
  consultas: Array<{
    id: string;
    fecha: string;
    motivoConsulta: string | null;
    diagnosticoCie10: any;
    doctorNombre: string;
    doctorEspecialidad: string | null;
  }>;
  documentos: Array<{
    id: string;
    tipo: string;
    fechaEmision: string;
    nombre: string | null;
  }>;
  healthWallet: {
    walletId: string;
    activo: boolean;
    version: number;
  };
}

/**
 * Metadata del backup
 */
export interface BackupMetadata {
  version: number;
  algorithm: string;
  kdf: string;
  iterations: number;
  createdAt: Date;
  expiresAt?: Date;
  isExpired: boolean;
}

/**
 * Resultado de validación de password
 */
export interface ValidationResult {
  isValid: boolean;
}

// ============================================================================
// CRYPTO UTILITIES (Client-side WebCrypto API)
// ============================================================================

/**
 * Deriva una clave desde password usando PBKDF2
 */
async function deriveKey(password: string, salt: ArrayBuffer, iterations: number): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encripta datos usando AES-256-GCM
 */
async function encryptData(data: BasicHistory, password: string): Promise<EncryptedBackup> {
  // 1. Generar salt y IV aleatorios
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // 2. Derivar clave
  const key = await deriveKey(password, salt.buffer, 100000);

  // 3. Serializar datos
  const encoder = new TextEncoder();
  const plaintext = encoder.encode(JSON.stringify(data));

  // 4. Encriptar
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext
  );

  // 5. Convertir a base64
  const saltBase64 = btoa(String.fromCharCode(...salt));
  const ivBase64 = btoa(String.fromCharCode(...iv));
  const ciphertextBase64 = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));

  // Nota: AES-GCM incluye el auth tag en el ciphertext
  // El tag es de 16 bytes al final

  return {
    version: 1,
    algorithm: 'AES-256-GCM',
    kdf: 'PBKDF2-SHA256',
    iterations: 100000,
    salt: saltBase64,
    iv: ivBase64,
    authTag: ciphertextBase64.slice(-24), // Últimos 16 bytes = auth tag en base64
    ciphertext: ciphertextBase64,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  };
}

/**
 * Desencripta datos usando AES-256-GCM
 */
async function decryptData(encryptedBackup: EncryptedBackup, password: string): Promise<BasicHistory> {
  // 1. Decodificar desde base64
  const salt = Uint8Array.from(atob(encryptedBackup.salt), c => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(encryptedBackup.iv), c => c.charCodeAt(0));
  const ciphertext = Uint8Array.from(atob(encryptedBackup.ciphertext), c => c.charCodeAt(0));

  // 2. Derivar clave
  const key = await deriveKey(password, salt.buffer, encryptedBackup.iterations);

  // 3. Desencriptar
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  // 4. Parsear JSON
  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(plaintext));
}

// ============================================================================
// COMPOSABLE
// ============================================================================

export function useWalletBackup() {
  const { post, get, isLoading: apiLoading } = useApi();

  // State
  const encryptedBackup = ref<EncryptedBackup | null>(null);
  const decryptedHistory = ref<BasicHistory | null>(null);
  const backupMetadata = ref<BackupMetadata | null>(null);
  const passwordValidation = ref<ValidationResult | null>(null);

  const loading = reactive({
    encrypt: false,
    decrypt: false,
    download: false,
    restore: false,
    validate: false,
    metadata: false
  });

  const error = ref<string | null>(null);

  // Methods

  /**
   * Encripta datos de historial localmente
   */
  const encryptBackup = async (data: BasicHistory, password: string): Promise<EncryptedBackup> => {
    loading.encrypt = true;
    error.value = null;

    try {
      const result = await encryptData(data, password);
      encryptedBackup.value = result;
      return result;
    } catch (err) {
      error.value = 'Error al encriptar backup';
      throw err;
    } finally {
      loading.encrypt = false;
    }
  };

  /**
   * Desencripta backup localmente
   */
  const decryptBackup = async (backup: EncryptedBackup, password: string): Promise<BasicHistory> => {
    loading.decrypt = true;
    error.value = null;

    try {
      const result = await decryptData(backup, password);
      decryptedHistory.value = result;
      return result;
    } catch (err) {
      error.value = 'Password incorrecto o backup corrupto';
      throw err;
    } finally {
      loading.decrypt = false;
    }
  };

  /**
   * Solicita creación de backup al servidor
   */
  const createBackup = async (pacienteId: string, password: string): Promise<EncryptedBackup> => {
    loading.encrypt = true;
    error.value = null;

    try {
      const response = await post<EncryptedBackup>(
        '/wallet/backup/create',
        { pacienteId, password }
      );

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Error al crear backup');
      }

      encryptedBackup.value = response.data;
      return response.data;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Error al crear backup';
      throw err;
    } finally {
      loading.encrypt = false;
    }
  };

  /**
   * Descarga archivo de backup encriptado
   */
  const downloadBackup = async (pacienteId: string, password: string): Promise<void> => {
    loading.download = true;
    error.value = null;

    try {
      // Usar fetch directamente para manejar la descarga de blob
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
      const token = localStorage.getItem('auth_token');
      
      const response = await fetch(`${apiBaseUrl}/wallet/backup/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ pacienteId, password })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al descargar backup');
      }

      // Crear blob y trigger descarga
      const blob = await response.blob();
      let url: string | null = null;

      try {
        url = window.URL.createObjectURL(blob);

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const link = document.createElement('a');
        link.href = url;
        link.download = `galeno-backup-${timestamp}.json`;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } finally {
        // Siempre liberar el ObjectURL, incluso si hay error
        if (url) {
          window.URL.revokeObjectURL(url);
        }
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Error al descargar backup';
      throw err;
    } finally {
      loading.download = false;
    }
  };

  /**
   * Restaura backup desde servidor
   */
  const restoreBackup = async (backup: EncryptedBackup, password: string): Promise<BasicHistory> => {
    loading.restore = true;
    error.value = null;

    try {
      const response = await post<BasicHistory>(
        '/wallet/backup/restore',
        { encryptedBackup: backup, password }
      );

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Error al restaurar backup');
      }

      decryptedHistory.value = response.data;
      return response.data;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Error al restaurar backup';
      throw err;
    } finally {
      loading.restore = false;
    }
  };

  /**
   * Valida password contra backup
   */
  const validatePassword = async (backup: EncryptedBackup, password: string): Promise<boolean> => {
    loading.validate = true;
    error.value = null;

    try {
      const response = await post<ValidationResult>(
        '/wallet/backup/validate',
        { encryptedBackup: backup, password }
      );

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Error al validar password');
      }

      passwordValidation.value = response.data;
      return response.data.isValid;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Error al validar password';
      return false;
    } finally {
      loading.validate = false;
    }
  };

  /**
   * Obtiene metadata de backup
   */
  const getMetadata = async (backup: EncryptedBackup): Promise<BackupMetadata> => {
    loading.metadata = true;
    error.value = null;

    try {
      const response = await post<BackupMetadata>(
        '/wallet/backup/metadata',
        { encryptedBackup: backup }
      );

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Error al obtener metadata');
      }

      backupMetadata.value = response.data;
      return response.data;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Error al obtener metadata';
      throw err;
    } finally {
      loading.metadata = false;
    }
  };

  /**
   * Obtiene historial básico para preview
   */
  const getHistoryPreview = async (pacienteId: string): Promise<BasicHistory> => {
    loading.decrypt = true;
    error.value = null;

    try {
      const response = await get<BasicHistory>(
        `/wallet/backup/history/${pacienteId}`
      );

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Error al obtener historial');
      }

      decryptedHistory.value = response.data;
      return response.data;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Error al obtener historial';
      throw err;
    } finally {
      loading.decrypt = false;
    }
  };

  /**
   * Carga backup desde archivo JSON
   */
  const loadBackupFromFile = async (file: File): Promise<EncryptedBackup> => {
    loading.decrypt = true;
    error.value = null;

    try {
      const text = await file.text();
      const backup: EncryptedBackup = JSON.parse(text);

      // Validar estructura
      if (
        !backup.version ||
        !backup.algorithm ||
        !backup.ciphertext ||
        !backup.salt ||
        !backup.iv
      ) {
        throw new Error('Archivo de backup inválido');
      }

      encryptedBackup.value = backup;
      return backup;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Error al cargar archivo';
      throw err;
    } finally {
      loading.decrypt = false;
    }
  };

  /**
   * Limpia estado
   */
  const clearBackup = () => {
    encryptedBackup.value = null;
    decryptedHistory.value = null;
    backupMetadata.value = null;
    passwordValidation.value = null;
    error.value = null;
  };

  return {
    // State
    encryptedBackup,
    decryptedHistory,
    backupMetadata,
    passwordValidation,
    loading,
    error,
    isLoading: apiLoading,

    // Methods
    encryptBackup,
    decryptBackup,
    createBackup,
    downloadBackup,
    restoreBackup,
    validatePassword,
    getMetadata,
    getHistoryPreview,
    loadBackupFromFile,
    clearBackup
  };
}
