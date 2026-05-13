<!-- apps/web/src/components/teleconference/ConsultationTools.vue -->
<template>
  <div class="consultation-tools" :class="{ 'compact': compactMode }">
    <!-- Tools Header -->
    <div class="tools-header">
      <h2 class="tools-title">
        <v-icon start color="primary">mdi-tools</v-icon>
        Herramientas Clínicas
      </h2>
      <div class="tools-actions">
        <v-chip
          size="small"
          :color="hasUnsavedChanges ? 'warning' : 'success'"
          class="mr-2"
        >
          <v-icon start size="x-small">
            {{ hasUnsavedChanges ? 'mdi-circle' : 'mdi-check-circle' }}
          </v-icon>
          {{ hasUnsavedChanges ? 'Cambios sin guardar' : 'Guardado' }}
        </v-chip>
        <v-btn
          icon="mdi-content-save"
          size="small"
          variant="text"
          :loading="isSaving"
          :disabled="!hasUnsavedChanges"
          @click="handleSaveDraft"
        >
          <v-tooltip activator="parent" location="bottom">
            Guardar borrador
          </v-tooltip>
        </v-btn>
      </div>
    </div>

    <!-- Tabs Navigation -->
    <v-tabs
      v-model="activeTool"
      color="primary"
      align-tabs="start"
      density="compact"
      class="tools-tabs"
    >
      <v-tab value="evolucion">
        <v-icon start size="small">mdi-file-document</v-icon>
        Evolución
      </v-tab>
      <v-tab value="cie10">
        <v-icon start size="small">mdi-stethoscope</v-icon>
        CIE-10
      </v-tab>
      <v-tab value="tratamiento">
        <v-icon start size="small">mdi-pill</v-icon>
        Tratamiento
      </v-tab>
      <v-tab value="examenes">
        <v-icon start size="small">mdi-test-tube</v-icon>
        Exámenes
      </v-tab>
    </v-tabs>

    <!-- Tools Content -->
    <v-window v-model="activeTool" class="tools-window">
      <!-- Evolución / Notas -->
      <v-window-item value="evolucion">
        <div class="tool-content">
          <div class="tool-header">
            <h3 class="tool-subtitle">Notas de Evolución</h3>
            <v-chip size="x-small" color="info">
              <v-icon start size="x-small">mdi-clock-outline</v-icon>
              Auto-guardado: 30s
            </v-chip>
          </div>

          <v-textarea
            v-model="localNotas"
            label="Escribe la evolución del paciente..."
            variant="outlined"
            density="comfortable"
            rows="10"
            counter
            maxlength="5000"
            :hint="`${localNotas.length}/5000 caracteres`"
            persistent-hint
            @update:model-value="handleNotesChange"
          >
            <template v-slot:prepend>
              <v-icon color="grey-lighten-1">mdi-text-box-edit-outline</v-icon>
            </template>
          </v-textarea>

          <!-- IA Suggestions -->
          <div v-if="localNotas" class="ia-suggestions">
            <IaChipsPanel
              :diagnostico="localDiagnosticos"
              :evolucion="localNotas"
              @on-tratamiento-sugerido="handleTreatmentSuggested"
              @on-sugerencia-eliminada="handleSuggestionDeleted"
            />
          </div>
        </div>
      </v-window-item>

      <!-- CIE-10 Diagnosis -->
      <v-window-item value="cie10">
        <div class="tool-content">
          <div class="tool-header">
            <h3 class="tool-subtitle">Diagnósticos CIE-10</h3>
            <v-chip size="small" color="primary">
              {{ localDiagnosticos.length }} registrado(s)
            </v-chip>
          </div>

          <DiagnosisChip
            v-model="localDiagnosticos"
            @add="handleDiagnosisAdded"
            @remove="handleDiagnosisRemoved"
          />

          <v-alert
            type="info"
            variant="tonal"
            density="compact"
            class="mt-3"
            border="start"
          >
            <template v-slot:prepend>
              <v-icon size="small">mdi-lightbulb</v-icon>
            </template>
            Los diagnósticos se guardan automáticamente. Escribe en evolución para recibir sugerencias IA.
          </v-alert>
        </div>
      </v-window-item>

      <!-- Tratamiento / Medicamentos -->
      <v-window-item value="tratamiento">
        <div class="tool-content">
          <div class="tool-header">
            <h3 class="tool-subtitle">Tratamiento y Medicamentos</h3>
            <v-chip size="small" color="primary">
              {{ localMedicamentos.length }} medicamento(s)
            </v-chip>
          </div>

          <PrescriptionPanel
            v-model="localMedicamentos"
            @add="handleMedicationAdded"
            @remove="handleMedicationRemoved"
          />

          <!-- Tratamiento texto libre -->
          <div class="mt-4">
            <v-textarea
              v-model="localTratamiento"
              label="Indicaciones adicionales del tratamiento..."
              variant="outlined"
              density="comfortable"
              rows="4"
              counter
              maxlength="2000"
              :hint="`${localTratamiento.length}/2000 caracteres`"
              persistent-hint
              @update:model-value="markDirty"
            />
          </div>
        </div>
      </v-window-item>

      <!-- Exámenes -->
      <v-window-item value="examenes">
        <div class="tool-content">
          <div class="tool-header">
            <h3 class="tool-subtitle">Exámenes Solicitados</h3>
            <v-chip size="small" color="primary">
              {{ localExamenes.length }} examen(es)
            </v-chip>
          </div>

          <ExamsPanel
            v-model="localExamenes"
            @add="handleExamAdded"
            @remove="handleExamRemoved"
          />
        </div>
      </v-window-item>
    </v-window>

    <!-- Sync Status Footer -->
    <div class="sync-status-footer" v-if="syncStatus.isSyncing || syncStatus.error">
      <v-progress-linear
        v-if="syncStatus.isSyncing"
        :model-value="syncStatus.syncProgress"
        color="primary"
        height="3"
        indeterminate
      />
      <v-alert
        v-if="syncStatus.error"
        type="error"
        variant="tonal"
        density="compact"
        class="mb-0 mt-2"
        :text="syncStatus.error"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import DiagnosisChip from '@/components/consultation/DiagnosisChip.vue';
import PrescriptionPanel from '@/components/consultation/PrescriptionPanel.vue';
import ExamsPanel from '@/components/consultation/ExamsPanel.vue';
import IaChipsPanel from '@/components/consultation/IaChipsPanel.vue';
import { useConsultationSync, type CIE10Diagnosis, type MedicamentoData, type ExamenData } from '@/composables/useConsultationSync';
import { useToast } from 'vue-toastification';

interface Props {
  citaId: string;
  pacienteId: string;
  consultaId: string;
  compactMode?: boolean;
  initialData?: {
    notas?: string;
    diagnosticos?: CIE10Diagnosis[];
    medicamentos?: MedicamentoData[];
    examenes?: ExamenData[];
    evolucion?: string;
    tratamiento?: string;
  };
}

const props = withDefaults(defineProps<Props>(), {
  compactMode: false
});

const emit = defineEmits<{
  (e: 'data-changed', data: {
    notas: string;
    diagnosticos: CIE10Diagnosis[];
    medicamentos: MedicamentoData[];
    examenes: ExamenData[];
    evolucion: string;
    tratamiento: string;
  }): void;
  (e: 'save-requested'): void;
  (e: 'finalize-requested'): void;
}>();

const toast = useToast();
const activeTool = ref('evolucion');

// Use consultation sync composable
const {
  data,
  syncStatus,
  hasUnsavedChanges,
  updateField,
  saveDraft,
  setDiagnosticos,
  setMedicamentos,
  setExamenes,
  addDiagnostico,
  removeDiagnostico,
  addMedicamento,
  removeMedicamento,
  addExamen,
  removeExamen
} = useConsultationSync(
  {
    citaId: props.citaId,
    pacienteId: props.pacienteId,
    consultaId: props.consultaId,
    ...props.initialData
  },
  {
    autoSaveInterval: 30000, // 30 seconds
    enableOffline: true,
    debounceDelay: 2000
  }
);

// Local computed refs for v-model
const localNotas = computed({
  get: () => data.value.notas,
  set: (value) => updateField('notas', value)
});

const localDiagnosticos = computed({
  get: () => data.value.diagnosticos,
  set: (value) => setDiagnosticos(value)
});

const localMedicamentos = computed({
  get: () => data.value.medicamentos,
  set: (value) => setMedicamentos(value)
});

const localExamenes = computed({
  get: () => data.value.examenes,
  set: (value) => setExamenes(value)
});

const localEvolucion = computed({
  get: () => data.value.evolucion,
  set: (value) => updateField('evolucion', value)
});

const localTratamiento = computed({
  get: () => data.value.tratamiento,
  set: (value) => updateField('tratamiento', value)
});

const isSaving = ref(false);

// Mark data as dirty
const markDirty = () => {
  // Handled automatically by composable
};

// Handle notes change
const handleNotesChange = (value: string) => {
  updateField('notas', value);
  updateField('evolucion', value); // Sync evolution with notes
};

// Handle diagnosis added
const handleDiagnosisAdded = (diagnostico: any) => {
  addDiagnostico(diagnostico);
  toast.success('Diagnóstico agregado');
};

// Handle diagnosis removed
const handleDiagnosisRemoved = (index: number) => {
  removeDiagnostico(index);
};

// Handle medication added
const handleMedicationAdded = (medicamento: any) => {
  addMedicamento(medicamento);
  toast.success('Medicamento agregado');
};

// Handle medication removed
const handleMedicationRemoved = (index: number) => {
  removeMedicamento(index);
};

// Handle exam added
const handleExamAdded = (examen: any) => {
  addExamen(examen);
  toast.success('Examen agregado');
};

// Handle exam removed
const handleExamRemoved = (index: number) => {
  removeExamen(index);
};

// Handle treatment suggested by IA
const handleTreatmentSuggested = (tratamiento: any) => {
  console.log('Treatment suggestion:', tratamiento);
  toast.info('Sugerencia de tratamiento recibida de IA');
};

// Handle suggestion deleted
const handleSuggestionDeleted = (tipo: string, contenido: string) => {
  console.log('Suggestion deleted:', tipo, contenido);
};

// Handle save draft
const handleSaveDraft = async () => {
  try {
    isSaving.value = true;
    const success = await saveDraft();
    if (success) {
      emit('save-requested');
    }
  } catch (error) {
    console.error('Error saving draft:', error);
  } finally {
    isSaving.value = false;
  }
};

// Emit data changes to parent
watch(
  () => data.value,
  (newData) => {
    emit('data-changed', {
      notas: newData.notas,
      diagnosticos: newData.diagnosticos,
      medicamentos: newData.medicamentos,
      examenes: newData.examenes,
      evolucion: newData.evolucion,
      tratamiento: newData.tratamiento
    });
  },
  { deep: true }
);

// Expose methods to parent
defineExpose({
  hasUnsavedChanges,
  syncStatus,
  getData: () => data.value,
  saveDraft: handleSaveDraft,
  setActiveTool: (tool: string) => {
    activeTool.value = tool;
  }
});

onMounted(() => {
  console.log('[ConsultationTools] Mounted', {
    consultaId: props.consultaId,
    citaId: props.citaId
  });
});
</script>

<style scoped lang="scss">
.consultation-tools {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f8fafc;
  overflow: hidden;

  &.compact {
    .tools-header {
      padding: 12px 16px;
    }

    .tool-content {
      padding: 12px;
    }
  }
}

.tools-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: white;
  border-bottom: 1px solid #e2e8f0;

  .tools-title {
    display: flex;
    align-items: center;
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: #1e293b;
  }

  .tools-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }
}

.tools-tabs {
  background: white;
  border-bottom: 1px solid #e2e8f0;
}

.tools-window {
  flex: 1;
  overflow: hidden;
}

.tool-content {
  padding: 20px;
  height: calc(100% - 80px);
  overflow-y: auto;
}

.tool-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.tool-subtitle {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #334155;
}

.ia-suggestions {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e2e8f0;
}

.sync-status-footer {
  padding: 8px 16px;
  background: white;
  border-top: 1px solid #e2e8f0;
}
</style>
