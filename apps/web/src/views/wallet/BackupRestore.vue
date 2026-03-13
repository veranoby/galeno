<template>
  <div class="backup-restore-container">
    <div class="backup-restore-header">
      <h1 class="title">
        <i class="fas fa-shield-alt"></i>
        Respaldo del Health Wallet
      </h1>
      <p class="subtitle">
        Respaldá y restaurá de forma segura tu historial médico encriptado
      </p>
    </div>

    <!-- Alertas de seguridad -->
    <div class="security-alert">
      <div class="alert-icon">
        <i class="fas fa-lock"></i>
      </div>
      <div class="alert-content">
        <h3>Encripción AES-256-GCM</h3>
        <p>
          Tu historial médico se encripta localmente con tecnología militar.
          Solo vos tenés la clave para acceder a tus datos.
        </p>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <button
        :class="['tab', { active: activeTab === 'backup' }]"
        @click="activeTab = 'backup'"
      >
        <i class="fas fa-download"></i>
        Crear Respaldo
      </button>
      <button
        :class="['tab', { active: activeTab === 'restore' }]"
        @click="activeTab = 'restore'"
      >
        <i class="fas fa-upload"></i>
        Restaurar Respaldo
      </button>
    </div>

    <!-- Panel de Crear Respaldo -->
    <div v-if="activeTab === 'backup'" class="panel backup-panel">
      <!-- Selección de paciente -->
      <div class="form-section">
        <h2>1. Seleccionar Paciente</h2>
        <div class="form-group">
          <label for="paciente">Paciente</label>
          <select
            id="paciente"
            v-model="selectedPacienteId"
            class="form-control"
            :disabled="loading.pacientes"
          >
            <option value="">Seleccionar paciente...</option>
            <option
              v-for="paciente in pacientes"
              :key="paciente.id"
              :value="paciente.id"
            >
              {{ paciente.nombre }} ({{ paciente.cedula }})
            </option>
          </select>
        </div>
      </div>

      <!-- Password de encripción -->
      <div class="form-section">
        <h2>2. Contraseña de Encripción</h2>
        <div class="form-group">
          <label for="password">Contraseña</label>
          <div class="password-input-group">
            <input
              :type="showPassword ? 'text' : 'password'"
              id="password"
              v-model="password"
              class="form-control"
              placeholder="Mínimo 8 caracteres"
              :disabled="!selectedPacienteId"
            />
            <button
              type="button"
              class="btn-toggle-password"
              @click="showPassword = !showPassword"
              :disabled="!selectedPacienteId"
            >
              <i :class="showPassword ? 'fas fa-eye-slash' : 'fas fa-eye'"></i>
            </button>
          </div>
          <p class="help-text">
            <i class="fas fa-info-circle"></i>
            Esta contraseña se usará para encriptar tus datos. Guardala en un lugar seguro.
          </p>
        </div>

        <div class="form-group">
          <label for="confirmPassword">Confirmar Contraseña</label>
          <input
            :type="showPassword ? 'text' : 'password'"
            id="confirmPassword"
            v-model="confirmPassword"
            class="form-control"
            placeholder="Repetir contraseña"
            :disabled="!selectedPacienteId"
          />
        </div>

        <!-- Validación de password -->
        <div class="password-requirements">
          <div :class="['requirement', { valid: passwordRequirements.length }]">
            <i :class="passwordRequirements.length ? 'fas fa-check' : 'fas fa-times'"></i>
            Mínimo 8 caracteres
          </div>
          <div :class="['requirement', { valid: passwordRequirements.hasNumber }]">
            <i :class="passwordRequirements.hasNumber ? 'fas fa-check' : 'fas fa-times'"></i>
            Al menos un número
          </div>
          <div :class="['requirement', { valid: passwordRequirements.hasMatch }]">
            <i :class="passwordRequirements.hasMatch ? 'fas fa-check' : 'fas fa-times'"></i>
            Las contraseñas coinciden
          </div>
        </div>
      </div>

      <!-- Preview del historial -->
      <div v-if="selectedPacienteId && passwordRequirements.valid" class="form-section">
        <h2>3. Vista Previa del Historial</h2>
        <div class="preview-card">
          <div class="preview-header">
            <h3>
              <i class="fas fa-file-medical"></i>
              Historial Médico
            </h3>
            <span class="badge">{{ selectedPacienteNombre }}</span>
          </div>
          <div class="preview-stats">
            <div class="stat">
              <span class="stat-value">{{ historyPreview.consultas.length }}</span>
              <span class="stat-label">Consultas</span>
            </div>
            <div class="stat">
              <span class="stat-value">{{ historyPreview.documentos.length }}</span>
              <span class="stat-label">Documentos</span>
            </div>
            <div class="stat">
              <span class="stat-value">{{ historyPreview.healthWallet.walletId }}</span>
              <span class="stat-label">Wallet ID</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Botón de descarga -->
      <div class="form-actions">
        <button
          class="btn btn-primary"
          :disabled="!canCreateBackup || walletBackup.loading.download"
          @click="handleDownloadBackup"
        >
          <i v-if="walletBackup.loading.download" class="fas fa-spinner fa-spin"></i>
          <i v-else class="fas fa-download"></i>
          {{ walletBackup.loading.download ? 'Descargando...' : 'Descargar Respaldo Encriptado' }}
        </button>
      </div>
    </div>

    <!-- Panel de Restaurar Respaldo -->
    <div v-if="activeTab === 'restore'" class="panel restore-panel">
      <!-- Carga de archivo -->
      <div class="form-section">
        <h2>1. Cargar Archivo de Respaldo</h2>
        <div class="file-upload-area" @dragover.prevent @drop.prevent="handleFileDrop">
          <input
            type="file"
            id="backupFile"
            ref="fileInput"
            accept=".json"
            @change="handleFileSelect"
            class="file-input"
          />
          <label for="backupFile" class="file-upload-label">
            <i class="fas fa-cloud-upload-alt"></i>
            <p>Arrastrá tu archivo aquí o hacé clic para seleccionar</p>
            <span class="file-name" v-if="selectedFile">{{ selectedFile.name }}</span>
          </label>
        </div>
      </div>

      <!-- Metadata del backup -->
      <div v-if="loadedBackup" class="form-section">
        <h2>2. Información del Respaldo</h2>
        <div class="metadata-card">
          <div class="metadata-row">
            <span class="label">Versión:</span>
            <span class="value">{{ loadedBackup.version }}</span>
          </div>
          <div class="metadata-row">
            <span class="label">Algoritmo:</span>
            <span class="value">{{ loadedBackup.algorithm }}</span>
          </div>
          <div class="metadata-row">
            <span class="label">Derivación:</span>
            <span class="value">{{ loadedBackup.kdf }} ({{ loadedBackup.iterations.toLocaleString() }} iteraciones)</span>
          </div>
          <div class="metadata-row">
            <span class="label">Creado:</span>
            <span class="value">{{ formatDate(loadedBackup.createdAt) }}</span>
          </div>
          <div v-if="loadedBackup.expiresAt" class="metadata-row">
            <span class="label">Expira:</span>
            <span :class="['value', { expired: isExpired(loadedBackup.expiresAt) }]">
              {{ formatDate(loadedBackup.expiresAt) }}
              <span v-if="isExpired(loadedBackup.expiresAt)" class="expired-badge">EXPIRADO</span>
            </span>
          </div>
        </div>
      </div>

      <!-- Password de desencripción -->
      <div v-if="loadedBackup" class="form-section">
        <h2>3. Contraseña de Desencripción</h2>
        <div class="form-group">
          <label for="restorePassword">Contraseña</label>
          <div class="password-input-group">
            <input
              :type="showRestorePassword ? 'text' : 'password'"
              id="restorePassword"
              v-model="restorePassword"
              class="form-control"
              placeholder="Contraseña usada para encriptar"
            />
            <button
              type="button"
              class="btn-toggle-password"
              @click="showRestorePassword = !showRestorePassword"
            >
              <i :class="showRestorePassword ? 'fas fa-eye-slash' : 'fas fa-eye'"></i>
            </button>
          </div>
        </div>

        <div class="form-actions">
          <button
            class="btn btn-secondary"
            :disabled="!restorePassword || walletBackup.loading.validate"
            @click="handleValidatePassword"
          >
            <i v-if="walletBackup.loading.validate" class="fas fa-spinner fa-spin"></i>
            <i v-else class="fas fa-check-circle"></i>
            {{ walletBackup.loading.validate ? 'Validando...' : 'Validar Contraseña' }}
          </button>
        </div>

        <!-- Resultado de validación -->
        <div v-if="passwordValidated" class="validation-result success">
          <i class="fas fa-check-circle"></i>
          Contraseña válida
        </div>
        <div v-if="passwordValidateError" class="validation-result error">
          <i class="fas fa-times-circle"></i>
          {{ passwordValidateError }}
        </div>
      </div>

      <!-- Botón de restauración -->
      <div v-if="passwordValidated" class="form-actions">
        <button
          class="btn btn-primary"
          :disabled="walletBackup.loading.restore"
          @click="handleRestoreBackup"
        >
          <i v-if="walletBackup.loading.restore" class="fas fa-spinner fa-spin"></i>
          <i v-else class="fas fa-upload"></i>
          {{ walletBackup.loading.restore ? 'Restaurando...' : 'Restaurar Respaldo' }}
        </button>
      </div>
    </div>

    <!-- Mensajes de error -->
    <div v-if="walletBackup.error" class="error-message">
      <i class="fas fa-exclamation-triangle"></i>
      {{ walletBackup.error }}
    </div>

    <!-- Modal de confirmación -->
    <div v-if="showConfirmModal" class="modal-overlay" @click="showConfirmModal = false">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h3>Confirmar Restauración</h3>
        </div>
        <div class="modal-body">
          <p>
            ¿Estás seguro que deseas restaurar este respaldo? Esta acción cargará el historial médico
            encriptado en el sistema.
          </p>
          <div class="warning-box">
            <i class="fas fa-exclamation-triangle"></i>
            <p>
              Asegurate de que el archivo de respaldo sea legítimo y de una fuente confiable.
            </p>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showConfirmModal = false">Cancelar</button>
          <button class="btn btn-primary" @click="confirmRestore">Confirmar</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useWalletBackup, type EncryptedBackup, type BasicHistory } from '@/composables/useWalletBackup';
import { useApi } from '@/composables/useApi';
import { useRole } from '@/composables/useRole';
import { formatDate, isExpired } from '@/utils/date';

// ============================================================================
// STATE
// ============================================================================

const walletBackup = useWalletBackup();
const { get } = useApi();
const { isDoctor, rol } = useRole();

const activeTab = ref<'backup' | 'restore'>('backup');

// Backup state
const selectedPacienteId = ref('');
const pacientes = ref<Array<{ id: string; nombre: string; cedula: string }>>([]);
const password = ref('');
const confirmPassword = ref('');
const showPassword = ref(false);
const loading = reactive({
  pacientes: false
});

// Restore state
const selectedFile = ref<File | null>(null);
const loadedBackup = ref<EncryptedBackup | null>(null);
const restorePassword = ref('');
const showRestorePassword = ref(false);
const passwordValidated = ref(false);
const passwordValidateError = ref('');
const showConfirmModal = ref(false);

// History preview
const historyPreview = ref<BasicHistory>({
  paciente: { id: '', nombre: '', cedula: '', fechaNacimiento: '' },
  consultas: [],
  documentos: [],
  healthWallet: { walletId: '', activo: false, version: 1 }
});

// ============================================================================
// COMPUTED
// ============================================================================

const passwordRequirements = computed(() => {
  const length = password.value.length >= 8;
  const hasNumber = /\d/.test(password.value);
  const hasMatch = password.value === confirmPassword.value && password.value.length > 0;

  return {
    length,
    hasNumber,
    hasMatch,
    valid: length && hasMatch
  };
});

const canCreateBackup = computed(() => {
  return selectedPacienteId.value && passwordRequirements.value.valid;
});

const selectedPacienteNombre = computed(() => {
  const paciente = pacientes.value.find(p => p.id === selectedPacienteId.value);
  return paciente?.nombre || '';
});

// ============================================================================
// METHODS
// ============================================================================

// Load pacientes
const loadPacientes = async () => {
  loading.pacientes = true;
  try {
    if (isDoctor.value) {
      // Doctor ve sus pacientes con conexión activa
      const response = await get<any[]>('/pacientes');
      if (response.success && response.data) {
        pacientes.value = response.data;
      }
    } else if (rol.value === 'PATIENT') {
      // Paciente ve su propio perfil
      const response = await get<any>('/pacientes/me');
      if (response.success && response.data) {
        pacientes.value = [response.data];
      }
    }
  } catch (error) {
    console.error('Error loading pacientes:', error);
  } finally {
    loading.pacientes = false;
  }
};

// Load history preview
const loadHistoryPreview = async () => {
  if (!selectedPacienteId.value) return;

  try {
    const response = await walletBackup.getHistoryPreview(selectedPacienteId.value);
    historyPreview.value = response;
  } catch (error) {
    console.error('Error loading history preview:', error);
  }
};

// Handle file selection
const handleFileSelect = (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files[0]) {
    handleFile(input.files[0]);
  }
};

// Handle file drop
const handleFileDrop = (event: DragEvent) => {
  if (event.dataTransfer?.files && event.dataTransfer.files[0]) {
    handleFile(event.dataTransfer.files[0]);
  }
};

// Handle file processing
const handleFile = async (file: File) => {
  selectedFile.value = file;

  try {
    loadedBackup.value = await walletBackup.loadBackupFromFile(file);
    passwordValidated.value = false;
    passwordValidateError.value = '';
    restorePassword.value = '';
  } catch (error) {
    console.error('Error loading backup file:', error);
  }
};

// Handle download backup
const handleDownloadBackup = async () => {
  if (!canCreateBackup.value) return;

  try {
    await walletBackup.downloadBackup(selectedPacienteId.value, password.value);
  } catch (error) {
    console.error('Error downloading backup:', error);
  }
};

// Handle validate password
const handleValidatePassword = async () => {
  if (!loadedBackup.value || !restorePassword.value) return;

  try {
    const isValid = await walletBackup.validatePassword(loadedBackup.value, restorePassword.value);
    passwordValidated.value = isValid;

    if (isValid) {
      passwordValidateError.value = '';
    } else {
      passwordValidateError.value = 'Contraseña incorrecta';
    }
  } catch (error) {
    passwordValidateError.value = 'Error al validar contraseña';
  }
};

// Handle restore backup
const handleRestoreBackup = () => {
  showConfirmModal.value = true;
};

// Confirm restore
const confirmRestore = async () => {
  if (!loadedBackup.value || !restorePassword.value) return;

  try {
    await walletBackup.restoreBackup(loadedBackup.value, restorePassword.value);
    showConfirmModal.value = false;
    // Show success message
    alert('Respaldo restaurado exitosamente');
  } catch (error) {
    console.error('Error restoring backup:', error);
    showConfirmModal.value = false;
  }
};

// ============================================================================
// LIFECYCLE
// ============================================================================

onMounted(() => {
  loadPacientes();
});

watch(selectedPacienteId, () => {
  if (selectedPacienteId.value) {
    loadHistoryPreview();
  }
});
</script>

<style scoped lang="scss">
.backup-restore-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

.backup-restore-header {
  text-align: center;
  margin-bottom: 2rem;

  .title {
    font-size: 2rem;
    color: #1a1a1a;
    margin-bottom: 0.5rem;

    i {
      color: #007bff;
      margin-right: 0.5rem;
    }
  }

  .subtitle {
    color: #666;
    font-size: 1rem;
  }
}

.security-alert {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: #e8f4fd;
  border-radius: 8px;
  margin-bottom: 2rem;

  .alert-icon {
    font-size: 2rem;
    color: #007bff;
  }

  .alert-content {
    h3 {
      font-size: 1rem;
      margin-bottom: 0.25rem;
      color: #1a1a1a;
    }

    p {
      font-size: 0.875rem;
      color: #666;
      margin: 0;
    }
  }
}

.tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 2rem;
  border-bottom: 2px solid #e0e0e0;

  .tab {
    flex: 1;
    padding: 1rem;
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: 1rem;
    color: #666;
    transition: all 0.3s ease;

    i {
      margin-right: 0.5rem;
    }

    &:hover {
      background: #f5f5f5;
    }

    &.active {
      color: #007bff;
      border-bottom: 2px solid #007bff;
      margin-bottom: -2px;
    }
  }
}

.panel {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.form-section {
  margin-bottom: 2rem;

  h2 {
    font-size: 1.25rem;
    color: #1a1a1a;
    margin-bottom: 1rem;
  }
}

.form-group {
  margin-bottom: 1rem;

  label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: #333;
  }

  .form-control {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 1rem;

    &:disabled {
      background: #f5f5f5;
      cursor: not-allowed;
    }
  }

  .password-input-group {
    position: relative;
    display: flex;

    .btn-toggle-password {
      position: absolute;
      right: 0.75rem;
      top: 50%;
      transform: translateY(-50%);
      background: transparent;
      border: none;
      cursor: pointer;
      color: #666;

      &:disabled {
        cursor: not-allowed;
        opacity: 0.5;
      }
    }
  }

  .help-text {
    font-size: 0.875rem;
    color: #666;
    margin-top: 0.5rem;

    i {
      margin-right: 0.25rem;
    }
  }
}

.password-requirements {
  margin-top: 1rem;
  padding: 1rem;
  background: #f9f9f9;
  border-radius: 4px;

  .requirement {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: #999;
    margin-bottom: 0.5rem;

    i {
      font-size: 0.75rem;
    }

    &.valid {
      color: #28a745;
    }
  }
}

.preview-card {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1rem;
  background: #fff;

  .preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;

    h3 {
      font-size: 1rem;
      color: #1a1a1a;
      margin: 0;

      i {
        margin-right: 0.5rem;
        color: #007bff;
      }
    }

    .badge {
      background: #007bff;
      color: #fff;
      padding: 0.25rem 0.75rem;
      border-radius: 12px;
      font-size: 0.75rem;
    }
  }

  .preview-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;

    .stat {
      text-align: center;

      .stat-value {
        display: block;
        font-size: 1.5rem;
        font-weight: 600;
        color: #007bff;
      }

      .stat-label {
        font-size: 0.75rem;
        color: #666;
      }
    }
  }
}

.file-upload-area {
  border: 2px dashed #ddd;
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  transition: all 0.3s ease;

  &:hover {
    border-color: #007bff;
    background: #f0f7ff;
  }

  .file-input {
    display: none;
  }

  .file-upload-label {
    cursor: pointer;
    display: block;

    i {
      font-size: 3rem;
      color: #007bff;
      margin-bottom: 1rem;
    }

    p {
      color: #666;
      margin-bottom: 0.5rem;
    }

    .file-name {
      display: block;
      font-size: 0.875rem;
      color: #333;
      font-weight: 500;
    }
  }
}

.metadata-card {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1rem;
  background: #f9f9f9;

  .metadata-row {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0;
    border-bottom: 1px solid #e0e0e0;

    &:last-child {
      border-bottom: none;
    }

    .label {
      font-weight: 500;
      color: #666;
    }

    .value {
      color: #333;
      font-family: monospace;

      &.expired {
        color: #dc3545;
      }

      .expired-badge {
        background: #dc3545;
        color: #fff;
        padding: 0.125rem 0.5rem;
        border-radius: 4px;
        font-size: 0.75rem;
        margin-left: 0.5rem;
      }
    }
  }
}

.form-actions {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;

  .btn {
    flex: 1;
    padding: 1rem;
    border: none;
    border-radius: 4px;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;

    i {
      margin-right: 0.5rem;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    &.btn-primary {
      background: #007bff;
      color: #fff;

      &:hover:not(:disabled) {
        background: #0056b3;
      }
    }

    &.btn-secondary {
      background: #6c757d;
      color: #fff;

      &:hover:not(:disabled) {
        background: #545b62;
      }
    }
  }
}

.validation-result {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  border-radius: 4px;
  margin-top: 1rem;

  i {
    font-size: 1.25rem;
  }

  &.success {
    background: #d4edda;
    color: #155724;
  }

  &.error {
    background: #f8d7da;
    color: #721c24;
  }
}

.error-message {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  background: #f8d7da;
  color: #721c24;
  border-radius: 4px;
  margin-top: 1rem;

  i {
    font-size: 1.25rem;
  }
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;

  .modal {
    background: #fff;
    border-radius: 8px;
    max-width: 500px;
    width: 90%;
    max-height: 90vh;
    overflow: auto;

    .modal-header {
      padding: 1.5rem;
      border-bottom: 1px solid #e0e0e0;

      h3 {
        margin: 0;
        color: #1a1a1a;
      }
    }

    .modal-body {
      padding: 1.5rem;

      p {
        color: #666;
        line-height: 1.6;
      }

      .warning-box {
        display: flex;
        gap: 1rem;
        padding: 1rem;
        background: #fff3cd;
        border-radius: 4px;
        margin-top: 1rem;

        i {
          color: #856404;
          font-size: 1.25rem;
        }

        p {
          margin: 0;
          color: #856404;
        }
      }
    }

    .modal-footer {
      padding: 1.5rem;
      border-top: 1px solid #e0e0e0;
      display: flex;
      gap: 1rem;
      justify-content: flex-end;

      .btn {
        padding: 0.75rem 1.5rem;
        border: none;
        border-radius: 4px;
        font-size: 1rem;
        cursor: pointer;

        &.btn-secondary {
          background: #6c757d;
          color: #fff;
        }

        &.btn-primary {
          background: #007bff;
          color: #fff;
        }
      }
    }
  }
}
</style>
