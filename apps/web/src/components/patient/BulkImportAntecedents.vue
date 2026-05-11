<template>
  <v-card class="bulk-import-antecedents" elevation="2" width="800">
    <v-card-title class="d-flex align-center py-4">
      <v-icon icon="mdi-database-import" size="large" class="mr-3" />
      <span>Importación Masiva de Antecedentes</span>
      <v-spacer />
      <v-btn 
        icon="mdi-close" 
        variant="text" 
        @click="$emit('close')"
        :aria-label="'Cerrar importación'"
      />
    </v-card-title>

    <v-card-subtitle class="py-2">
      Importe múltiples antecedentes desde archivos CSV o JSON
    </v-card-subtitle>

    <v-card-text class="pa-6">
      <!-- Dropzone for file upload -->
      <div
        class="dropzone d-flex flex-column align-center justify-center pa-8"
        :class="{ 'drag-over': dragOver }"
        @dragover.prevent="handleDragOver"
        @dragleave="handleDragLeave"
        @drop.prevent="handleDrop"
        @click="triggerFileInput"
      >
        <input
          ref="fileInputRef"
          type="file"
          accept=".csv,.json"
          @change="handleFileInput"
          hidden
        />

        <div v-if="!isFileSelected" class="text-center">
          <v-icon icon="mdi-cloud-upload" size="x-large" class="mb-4" color="primary" />
          <h3 class="text-h6 mb-2">Arrastre un archivo aquí o haga clic para seleccionar</h3>
          <p class="text-medium-emphasis mb-4">Formatos soportados: CSV, JSON</p>
          <v-btn 
            color="primary" 
            variant="elevated"
            @click.stop="triggerFileInput"
          >
            <v-icon start>mdi-folder-open</v-icon>
            Seleccionar Archivo
          </v-btn>
        </div>

        <div v-else class="file-info d-flex align-center justify-space-between w-100">
          <div class="d-flex align-center">
            <v-icon 
              :icon="getFileIcon(file!.type)" 
              size="large" 
              :color="getFileColor(file!.type)"
              class="mr-3"
            />
            <div>
              <div class="font-weight-medium">{{ fileName }}</div>
              <div class="text-caption text-medium-emphasis">{{ formatFileSize(file!.size) }}</div>
            </div>
          </div>
          <v-btn 
            color="error" 
            variant="text" 
            icon="mdi-delete"
            @click.stop="resetState"
            :aria-label="`Eliminar archivo ${fileName}`"
          />
        </div>
      </div>

      <!-- Error message -->
      <v-alert 
        v-if="error" 
        type="error" 
        variant="tonal" 
        class="mt-4"
        closable
        @click:close="error = null"
      >
        {{ error }}
      </v-alert>

      <!-- Summary and actions -->
      <div v-if="parsedData.length > 0" class="summary-section mt-6">
        <v-alert type="info" variant="outlined" class="mb-4">
          <div class="d-flex align-center">
            <v-icon start>mdi-checkbox-marked-circle</v-icon>
            <div>
              <strong>{{ parsedData.length }}</strong> registros encontrados
            </div>
          </div>
        </v-alert>

        <div class="d-flex justify-end gap-2">
          <v-btn 
            color="secondary" 
            variant="outlined"
            @click="showPreview"
          >
            <v-icon start>mdi-eye</v-icon>
            Previsualizar
          </v-btn>
          <v-btn 
            color="success" 
            variant="elevated"
            :loading="loading"
            @click="confirmImport"
          >
            <v-icon start>mdi-import</v-icon>
            Importar {{ parsedData.length }} Registros
          </v-btn>
        </div>
      </div>
    </v-card-text>

    <!-- Preview Modal -->
    <v-dialog 
      v-model="showPreviewModal" 
      max-width="900" 
      scrollable
      :persistent="loading"
    >
      <v-card>
        <v-card-title class="d-flex align-center">
          <v-icon icon="mdi-eye" size="large" class="mr-3" />
          <span>Previsualización de Datos</span>
          <v-spacer />
          <v-btn 
            icon="mdi-close" 
            variant="text" 
            @click="hidePreview"
            :disabled="loading"
          />
        </v-card-title>

        <v-card-text class="pa-0">
          <!-- Progress bar during import -->
          <v-progress-linear 
            v-if="loading" 
            :model-value="importProgress" 
            height="8" 
            striped 
            color="success"
          />

          <v-container v-if="loading" fluid class="pa-4">
            <div class="d-flex align-center justify-center py-4">
              <v-progress-circular 
                indeterminate 
                color="primary" 
                class="mr-4"
              />
              <div>
                <div class="text-h6">Procesando...</div>
                <div class="text-subtitle-2">
                  {{ importProgress }}% - {{ importSuccess }} de {{ importTotal }} registros completados
                </div>
              </div>
            </div>
          </v-container>

          <!-- Data preview table -->
          <v-data-table
            v-else
            :headers="previewHeaders"
            :items="previewData"
            :items-per-page="10"
            class="elevation-0"
            :footer-props="{ 'items-per-page-options': [5, 10, 20] }"
          >
            <template v-slot:item.detalle="{ item }">
              <span :title="item.detalle">
                {{ item.detalle.substring(0, 50) }}{{ item.detalle.length > 50 ? '...' : '' }}
              </span>
            </template>
            
            <template v-slot:footer.prepend>
              <div class="pa-4">
                <div class="d-flex align-center">
                  <v-icon icon="mdi-information" color="info" class="mr-2" />
                  <span>Total de registros: {{ parsedData.length }}</span>
                </div>
              </div>
            </template>
          </v-data-table>
        </v-card-text>

        <v-card-actions v-if="!loading" class="pa-4">
          <v-spacer />
          <v-btn 
            color="secondary" 
            variant="outlined" 
            @click="hidePreview"
          >
            Cancelar
          </v-btn>
          <v-btn 
            color="success" 
            variant="elevated" 
            @click="confirmImport"
          >
            <v-icon start>mdi-check</v-icon>
            Confirmar Importación
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { apiClient } from '@/services/api';
import type { CreateAntecedenteDto } from '@/composables/useAntecedents';

// Props
interface Props {
  pacienteId: string;
}

const props = defineProps<Props>();

// Emits
const emit = defineEmits<{
  importComplete: [success: boolean, message: string];
  close: [];
}>();

// Template refs
const fileInputRef = ref<HTMLInputElement | null>(null);

// State
const dragOver = ref(false);
const file = ref<File | null>(null);
const fileName = ref('');
const loading = ref(false);
const error = ref<string | null>(null);
const parsedData = ref<CreateAntecedenteDto[]>([]);
const showPreviewModal = ref(false);
const importProgress = ref(0);
const importTotal = ref(0);
const importSuccess = ref(0);
const importErrors = ref<{index: number; error: string}[]>([]);

// Computed
const isFileSelected = computed(() => !!file.value);
const canImport = computed(() => parsedData.value.length > 0 && !loading.value);

const previewHeaders = computed(() => [
  { title: 'Tipo', key: 'tipo', sortable: true },
  { title: 'Categoría', key: 'categoria', sortable: true },
  { title: 'Detalle', key: 'detalle', sortable: true },
  { title: 'Grado', key: 'grado', sortable: true },
  { title: 'Registrado Por', key: 'registradoPor', sortable: true }
]);

const previewData = computed(() => {
  return parsedData.value.map((item, index) => ({
    ...item,
    index
  }));
});

// Methods
const triggerFileInput = () => {
  if (fileInputRef.value) {
    fileInputRef.value.click();
  }
};

const handleDragOver = (event: DragEvent) => {
  event.preventDefault();
  dragOver.value = true;
};

const handleDragLeave = () => {
  dragOver.value = false;
};

const handleDrop = (event: DragEvent) => {
  event.preventDefault();
  dragOver.value = false;

  if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
    const droppedFile = event.dataTransfer.files[0];
    handleFileSelect(droppedFile);
  }
};

const handleFileInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    handleFileSelect(target.files[0]);
  }
};

const handleFileSelect = (selectedFile: File) => {
  // Validate file type
  const fileType = selectedFile.type.toLowerCase();
  if (!fileType.includes('csv') && !fileType.includes('json') && !selectedFile.name.toLowerCase().endsWith('.csv') && !selectedFile.name.toLowerCase().endsWith('.json')) {
    error.value = 'Formato de archivo no soportado. Por favor seleccione un archivo CSV o JSON.';
    return;
  }

  file.value = selectedFile;
  fileName.value = selectedFile.name;
  error.value = null;

  // Parse the file
  parseFile(selectedFile);
};

const parseFile = (selectedFile: File) => {
  const reader = new FileReader();

  reader.onload = (e) => {
    try {
      const content = e.target?.result as string;

      if (selectedFile.type.includes('csv') || selectedFile.name.toLowerCase().endsWith('.csv')) {
        parseCSV(content);
      } else if (selectedFile.type.includes('json') || selectedFile.name.toLowerCase().endsWith('.json')) {
        parseJSON(content);
      }
    } catch (err) {
      error.value = 'Error al procesar el archivo: ' + (err as Error).message;
    }
  };

  reader.onerror = () => {
    error.value = 'Error al leer el archivo';
  };

  reader.readAsText(selectedFile);
};

const parseCSV = (csvContent: string) => {
  try {
    const lines = csvContent.split(/\r?\n/).filter(line => line.trim() !== '');

    if (lines.length < 2) {
      throw new Error('El archivo CSV debe tener al menos una fila de encabezado y una de datos');
    }

    // Extract headers
    const headers = lines[0]
      .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/) // Handle commas inside quotes
      .map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());

    // Validate required headers
    const requiredHeaders = ['tipo', 'detalle'];
    for (const requiredHeader of requiredHeaders) {
      if (!headers.includes(requiredHeader)) {
        throw new Error(`Columna requerida "${requiredHeader}" no encontrada en el archivo CSV`);
      }
    }

    // Process data rows
    const data: CreateAntecedenteDto[] = [];
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '') continue; // Skip empty lines
      
      const values = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/); // Handle commas inside quotes
      const row: any = {};

      for (let j = 0; j < headers.length; j++) {
        if (j < values.length) {
          // Remove quotes and extra spaces
          const value = values[j].trim().replace(/^"|"$/g, '');
          row[headers[j]] = value === '' ? undefined : value;
        }
      }

      // Map to CreateAntecedenteDto
      const antecedente: CreateAntecedenteDto = {
        tipo: row.tipo,
        categoria: row.categoria,
        detalle: row.detalle,
        grado: row.grado,
        registradoPor: row.registradopor || 'doctor'
      };

      data.push(antecedente);
    }

    parsedData.value = data;
  } catch (err) {
    throw new Error(`Error al procesar CSV: ${(err as Error).message}`);
  }
};

const parseJSON = (jsonContent: string) => {
  try {
    const data = JSON.parse(jsonContent);

    if (!Array.isArray(data)) {
      throw new Error('El archivo JSON debe contener un array de antecedentes');
    }

    // Validate structure
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      if (!item.tipo || !item.detalle) {
        throw new Error(`Registro ${i + 1}: Los campos 'tipo' y 'detalle' son requeridos`);
      }
    }

    parsedData.value = data;
  } catch (err) {
    throw new Error(`Error al procesar JSON: ${(err as Error).message}`);
  }
};

const showPreview = () => {
  if (parsedData.value.length === 0) {
    error.value = 'No hay datos para previsualizar. Por favor, seleccione un archivo primero.';
    return;
  }

  showPreviewModal.value = true;
};

const hidePreview = () => {
  showPreviewModal.value = false;
};

const confirmImport = async () => {
  if (!canImport.value || !file.value) return;

  loading.value = true;
  error.value = null;
  importProgress.value = 0;
  importTotal.value = parsedData.value.length;
  importSuccess.value = 0;
  importErrors.value = [];

  try {
    // Create FormData to send the file
    const formData = new FormData();
    formData.append('file', file.value);

    // Create XMLHttpRequest to track upload progress
    const xhr = new XMLHttpRequest();

    // Track upload progress
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        importProgress.value = Math.round((event.loaded / event.total) * 100);
      }
    });

    // Set up the request
    xhr.open('POST', `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'}/patients/${props.pacienteId}/antecedents/import`);
    
    // Set authorization header
    const token = apiClient.accessToken;
    xhr.setRequestHeader('Authorization', `Bearer ${token || ''}`);

    // Handle response
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        if (xhr.status >= 200 && xhr.status < 300) {
          const response = JSON.parse(xhr.responseText);
          
          if (response.success && response.data) {
            importSuccess.value = response.data.imported || parsedData.value.length;
            
            if (response.data.errors && response.data.errors.length > 0) {
              importErrors.value = response.data.errors;
            }

            const successMsg = `Importación completada: ${importSuccess.value} antecedentes creados`;
            const errorMsg = response.data.errors && response.data.errors.length > 0
              ? `, ${response.data.errors.length} errores`
              : '';

            emit('importComplete', true, `${successMsg}${errorMsg}`);
          } else {
            throw new Error(response.error || 'Error desconocido durante la importación');
          }
        } else {
          const response = JSON.parse(xhr.responseText);
          throw new Error(response.error || 'Error desconocido durante la importación');
        }
        
        loading.value = false;
        hidePreview();
        resetState();
      }
    };

    // Handle errors
    xhr.onerror = function() {
      error.value = 'Error de red durante la importación';
      emit('importComplete', false, 'Error de red durante la importación');
      loading.value = false;
      hidePreview();
      resetState();
    };

    // Send the request
    xhr.send(formData);
  } catch (err) {
    error.value = 'Error durante la importación: ' + (err as Error).message;
    emit('importComplete', false, 'Error durante la importación: ' + (err as Error).message);
    loading.value = false;
    hidePreview();
    resetState();
  }
};

const resetState = () => {
  file.value = null;
  fileName.value = '';
  parsedData.value = [];
  error.value = null;
  importProgress.value = 0;
  importTotal.value = 0;
  importSuccess.value = 0;
  importErrors.value = [];
};

const getFileIcon = (fileType: string) => {
  if (fileType.includes('csv')) return 'mdi-file-delimited';
  if (fileType.includes('json')) return 'mdi-file-json';
  return 'mdi-file-document';
};

const getFileColor = (fileType: string) => {
  if (fileType.includes('csv')) return 'blue';
  if (fileType.includes('json')) return 'orange';
  return 'grey';
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Cleanup on unmount
defineExpose({
  resetState
});
</script>

<style scoped>
.bulk-import-antecedents {
  max-width: 800px;
  margin: 0 auto;
}

.dropzone {
  border: 2px dashed rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 200px;
}

.dropzone:hover {
  background-color: rgba(var(--v-theme-surface-variant), 0.05);
}

.dropzone.drag-over {
  border-color: rgb(var(--v-theme-primary));
  background-color: rgba(var(--v-theme-primary), 0.05);
}

.file-info {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
  padding: 12px 16px;
}

.summary-section {
  background-color: rgba(var(--v-theme-surface-variant), 0.05);
  border-radius: 8px;
  padding: 16px;
}
</style>