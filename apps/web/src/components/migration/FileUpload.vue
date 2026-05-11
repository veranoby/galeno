// apps/web/src/components/migration/FileUpload.vue
<template>
  <v-card variant="outlined" class="mb-4">
    <v-card-title class="text-h6">
      <v-icon start color="primary">mdi-file-upload</v-icon>
      Paso 1: Cargar Archivo
    </v-card-title>

    <v-card-text>
      <v-alert type="info" variant="tonal" class="mb-4">
        <strong>Formatos soportados:</strong> CSV, JSON, Excel (.xlsx, .xls)
        <br>
        <strong>Tamaño máximo:</strong> 50MB
        <br>
        <strong>Recomendación:</strong> Asegúrate que la primera fila contenga los nombres de las columnas
      </v-alert>

      <!-- Target Model Selection -->
      <v-select
        v-model="internalTargetModel"
        :items="targetModelOptions"
        label="¿Qué tipo de datos deseas importar?"
        variant="outlined"
        prepend-inner-icon="mdi-database"
        class="mb-4"
        @update:model-value="$emit('target-model-changed', $event)"
      />

      <!-- File Upload Area -->
      <v-file-input
        v-model="internalFile"
        :accept="acceptedFormats"
        label="Selecciona tu archivo"
        variant="outlined"
        prepend-icon="mdi-upload"
        :loading="uploading"
        :error-messages="errorMessages"
        counter
        :max-size="52428800"
        show-size
        class="mb-4"
        @update:model-value="handleFileChange"
      >
        <template v-slot:selection="{ fileNames }">
          <v-chip
            v-for="(fileName, index) in fileNames"
            :key="index"
            class="mr-2"
            color="primary"
            variant="flat"
            size="small"
          >
            {{ fileName }}
          </v-chip>
        </template>
      </v-file-input>

      <!-- Drag and Drop Zone -->
      <v-card
        v-if="!internalFile"
        variant="outlined"
        class="text-center py-8"
        :class="{ 'drag-over': isDragOver }"
        @dragover.prevent="isDragOver = true"
        @dragleave.prevent="isDragOver = false"
        @drop.prevent="handleDrop"
        style="border: 2px dashed; cursor: pointer;"
      >
        <v-card-text>
          <v-icon size="64" color="grey" class="mb-4">mdi-cloud-upload</v-icon>
          <p class="text-h6 mb-2">
            Arrastra y suelta tu archivo aquí
          </p>
          <p class="text-body-2 text-grey">
            o haz clic para seleccionar
          </p>
        </v-card-text>
      </v-card>

      <!-- File Preview -->
      <v-card v-else variant="tonal" color="success" class="mb-4">
        <v-card-text class="d-flex align-center">
          <v-icon start color="success">mdi-check-circle</v-icon>
          <div>
            <strong>Archivo seleccionado:</strong>
            <div class="text-body-2">{{ internalFile?.name }}</div>
            <div class="text-caption text-grey">
              {{ formatFileSize(internalFile?.size || 0) }}
            </div>
          </div>
          <v-spacer></v-spacer>
          <v-btn
            icon="mdi-close"
            size="small"
            variant="text"
            @click="clearFile"
          />
        </v-card-text>
      </v-card>

      <!-- Sample Data Preview (if file selected) -->
      <v-card v-if="filePreview.length > 0" variant="outlined" class="mb-4">
        <v-card-title class="text-subtitle-1">
          <v-icon start size="small">mdi-table</v-icon>
          Vista Previa (primeras 5 filas)
        </v-card-title>
        <v-card-text>
          <v-table density="compact" hover>
            <thead>
              <tr>
                <th v-for="(header, index) in filePreview[0]" :key="index">
                  {{ header }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, rowIndex) in filePreview.slice(1, 6)" :key="rowIndex">
                <td v-for="(cell, cellIndex) in row" :key="cellIndex">
                  {{ cell }}
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-card-text>
      </v-card>
    </v-card-text>

    <v-card-actions>
      <v-spacer></v-spacer>
      <v-btn
        color="primary"
        :disabled="!internalFile || !internalTargetModel"
        :loading="uploading"
        @click="$emit('next')"
      >
        Continuar
        <v-icon end>mdi-arrow-right</v-icon>
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';

interface Props {
  file: File | null;
  targetModel: 'Paciente' | 'Consulta' | 'Cita';
}

interface Emits {
  (e: 'file-selected', file: File): void;
  (e: 'target-model-changed', model: 'Paciente' | 'Consulta' | 'Cita'): void;
  (e: 'next'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// State
const internalFile = ref<File | null>(props.file);
const internalTargetModel = ref<'Paciente' | 'Consulta' | 'Cita'>(props.targetModel);
const uploading = ref(false);
const isDragOver = ref(false);
const errorMessages = ref<string[]>([]);
const filePreview = ref<string[][]>([]);

// Computed
const acceptedFormats = computed(() => {
  return '.csv,.json,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/json,text/csv';
});

const targetModelOptions = computed(() => [
  { value: 'Paciente', title: '👥 Pacientes', subtitle: 'Importar directorio de pacientes' },
  { value: 'Consulta', title: '📋 Consultas', subtitle: 'Importar historial de consultas' },
  { value: 'Cita', title: '📅 Citas', subtitle: 'Importar agenda de citas' }
]);

// Watch
watch(() => props.file, (newFile) => {
  internalFile.value = newFile;
});

watch(() => props.targetModel, (newModel) => {
  internalTargetModel.value = newModel;
});

// Methods
const handleFileChange = async (file: File | File[] | null) => {
  errorMessages.value = [];
  filePreview.value = [];

  // Handle array case (v-file-input can return array)
  const selectedFile = Array.isArray(file) ? file[0] : file;

  if (!selectedFile) {
    emit('file-selected', null as any);
    return;
  }

  // Validate file type
  const validTypes = [
    'text/csv',
    'application/json',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ];

  const validExtensions = ['.csv', '.json', '.xlsx', '.xls'];
  const ext = selectedFile.name.slice((selectedFile.name.lastIndexOf('.') - 1 >>> 0) + 2);

  if (!validTypes.includes(selectedFile.type) && !validExtensions.includes(`.${ext}`)) {
    errorMessages.value = ['Tipo de archivo no válido. Solo CSV, JSON o Excel'];
    internalFile.value = null;
    return;
  }

  // Validate file size (50MB)
  if (selectedFile.size > 52428800) {
    errorMessages.value = ['El archivo excede el tamaño máximo de 50MB'];
    internalFile.value = null;
    return;
  }

  internalFile.value = selectedFile;
  emit('file-selected', selectedFile);

  // Generate preview for CSV files
  if (selectedFile.type === 'text/csv' || selectedFile.name.endsWith('.csv')) {
    await generateCSVPreview(selectedFile);
  }
};

const handleDrop = async (event: DragEvent) => {
  isDragOver.value = false;

  const files = event.dataTransfer?.files;
  if (files && files.length > 0) {
    internalFile.value = files[0];
    await handleFileChange(files[0]);
  }
};

const clearFile = () => {
  internalFile.value = null;
  filePreview.value = [];
  errorMessages.value = [];
  emit('file-selected', null as any);
};

const generateCSVPreview = async (file: File) => {
  try {
    const text = await file.text();
    const lines = text.split('\n').slice(0, 6); // First 6 lines (header + 5 rows)
    
    filePreview.value = lines.map(line => {
      // Simple CSV parsing (handles basic cases)
      return line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''));
    });
  } catch (error) {
    console.error('Error generating preview:', error);
  }
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};
</script>

<style scoped>
.drag-over {
  border-color: #2196F3 !important;
  background-color: rgba(33, 150, 243, 0.05);
}
</style>
