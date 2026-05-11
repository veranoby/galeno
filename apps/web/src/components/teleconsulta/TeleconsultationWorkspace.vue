<template>
  <div class="teleconsultation-workspace">
    <!-- Workspace Header -->
    <div class="workspace-header">
      <div class="header-content">
        <h2 class="workspace-title">Consulta Virtual</h2>
        <div class="patient-badges">
          <v-chip color="primary" size="small" class="mr-2">
            <v-icon start>mdi-account</v-icon>
            {{ pacienteNombre }}
          </v-chip>
          <v-chip :color="estadoColor" size="small">
            <v-icon start>{{ estadoIcon }}</v-icon>
            {{ estadoText }}
          </v-chip>
        </div>
      </div>

      <div class="header-actions">
        <v-btn
          color="success"
          :disabled="!canFinalize"
          @click="handleFinalize"
          class="mr-2"
        >
          <v-icon start>mdi-check-all</v-icon>
          Finalizar
        </v-btn>
        <v-btn
          variant="outlined"
          @click="handleSaveDraft"
          :loading="isSaving"
        >
          <v-icon start>mdi-content-save</v-icon>
          Guardar Borrador
        </v-btn>
      </div>
    </div>

    <!-- Workspace Content -->
    <div class="workspace-content">
      <!-- Left Column: Patient Context -->
      <div class="context-sidebar">
        <ContextSidebar
          :paciente-id="pacienteId"
          :consulta-id="consultaId"
          :compact="isCompactMode"
        />
      </div>

      <!-- Center Column: Clinical Tools -->
      <div class="clinical-tools-panel">
        <!-- Tabs for different tools -->
        <v-tabs v-model="activeTool" color="primary" align-tabs="start">
          <v-tab value="notes">
            <v-icon start>mdi-file-document</v-icon>
            Notas
          </v-tab>
          <v-tab value="diagnosis">
            <v-icon start>mdi-stethoscope</v-icon>
            Diagnóstico
          </v-tab>
          <v-tab value="prescription">
            <v-icon start>mdi-pill</v-icon>
            Receta
          </v-tab>
          <v-tab value="exams">
            <v-icon start>mdi-test-tube</v-icon>
            Exámenes
          </v-tab>
          <v-tab value="signature">
            <v-icon start>mdi-signature</v-icon>
            Firma
          </v-tab>
        </v-tabs>

        <v-window v-model="activeTool" class="tool-window">
          <!-- Notas Clínicas -->
          <v-window-item value="notes">
            <div class="tool-content">
              <h3 class="tool-title">Notas de la Consulta</h3>
              
              <v-textarea
                v-model="notasConsulta"
                label="Escribe las notas clínicas..."
                rows="12"
                variant="outlined"
                density="comfortable"
                counter
                maxlength="5000"
                @update:model-value="handleNotesChange"
              />

              <!-- IA Suggestions -->
              <IaChipsPanel
                v-if="notasConsulta"
                :diagnostico="diagnosticos"
                :evolucion="notasConsulta"
                @on-tratamiento-sugerido="handleTratamientoSugerido"
                @on-sugerencia-eliminada="handleSugerenciaEliminada"
              />
            </div>
          </v-window-item>

          <!-- Diagnóstico -->
          <v-window-item value="diagnosis">
            <div class="tool-content">
              <h3 class="tool-title">Diagnóstico CIE-10</h3>
              
              <DiagnosisChip
                v-model="diagnosticos"
                @add="handleAddDiagnostico"
                @remove="handleRemoveDiagnostico"
              />

              <v-alert
                type="info"
                variant="tonal"
                density="compact"
                class="mt-3"
              >
                <v-icon start>mdi-lightbulb</v-icon>
                Escribe en notas clínicas para recibir sugerencias de diagnóstico IA
              </v-alert>
            </div>
          </v-window-item>

          <!-- Receta -->
          <v-window-item value="prescription">
            <div class="tool-content">
              <h3 class="tool-title">Medicamentos</h3>
              
              <PrescriptionPanel
                v-model="medicamentos"
                @add="handleAddMedicamento"
                @remove="handleRemoveMedicamento"
              />
            </div>
          </v-window-item>

          <!-- Exámenes -->
          <v-window-item value="exams">
            <div class="tool-content">
              <h3 class="tool-title">Exámenes Solicitados</h3>
              
              <ExamsPanel
                v-model="examenes"
                @add="handleAddExamen"
                @remove="handleRemoveExamen"
              />
            </div>
          </v-window-item>

          <!-- Firma -->
          <v-window-item value="signature">
            <div class="tool-content">
              <h3 class="tool-title">Firma Electrónica</h3>
              
              <FirmaElectronica
                v-model="firmaData"
                :disabled="!canSign"
                @signed="handleSigned"
                @error="handleSignatureError"
              />

              <v-alert
                v-if="!canSign"
                type="warning"
                variant="tonal"
                density="compact"
                class="mt-3"
              >
                <v-icon start>mdi-alert</v-icon>
                Completa las notas clínicas antes de firmar
              </v-alert>
            </div>
          </v-window-item>
        </v-window>
      </div>
    </div>

    <!-- Finalization Dialog -->
    <v-dialog
      v-model="showFinalizeDialog"
      max-width="500"
      persistent
    >
      <v-card>
        <v-card-title>
          <v-icon color="primary" start>mdi-check-circle</v-icon>
          Confirmar Finalización
        </v-card-title>

        <v-card-text>
          <p>¿Estás seguro de que deseas finalizar esta teleconsulta?</p>
          
          <v-list density="compact" class="mt-3">
            <v-list-item>
              <template v-slot:prepend>
                <v-icon :color="hasNotes ? 'success' : 'error'" size="small">
                  {{ hasNotes ? 'mdi-check-circle' : 'mdi-alert-circle' }}
                </v-icon>
              </template>
              <v-list-item-title>
                Notas clínicas {{ hasNotes ? 'completas' : 'pendientes' }}
              </v-list-item-title>
            </v-list-item>

            <v-list-item>
              <template v-slot:prepend>
                <v-icon :color="diagnosticos.length > 0 ? 'success' : 'warning'" size="small">
                  {{ diagnosticos.length > 0 ? 'mdi-check-circle' : 'mdi-alert-circle' }}
                </v-icon>
              </template>
              <v-list-item-title>
                {{ diagnosticos.length }} diagnóstico(s) {{ diagnosticos.length > 0 ? 'registrado(s)' : 'pendiente(s)' }}
              </v-list-item-title>
            </v-list-item>

            <v-list-item>
              <template v-slot:prepend>
                <v-icon :color="isSigned ? 'success' : 'error'" size="small">
                  {{ isSigned ? 'mdi-check-circle' : 'mdi-alert-circle' }}
                </v-icon>
              </template>
              <v-list-item-title>
                Firma electrónica {{ isSigned ? 'completada' : 'pendiente' }}
              </v-list-item-title>
            </v-list-item>
          </v-list>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="showFinalizeDialog = false"
          >
            Cancelar
          </v-btn>
          <v-btn
            color="primary"
            :disabled="!canFinalize"
            @click="confirmFinalize"
          >
            Finalizar Consulta
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import ContextSidebar from '@/components/consultation/ContextSidebar.vue';
import IaChipsPanel from '@/components/consultation/IaChipsPanel.vue';
import DiagnosisChip from '@/components/consultation/DiagnosisChip.vue';
import PrescriptionPanel from '@/components/consultation/PrescriptionPanel.vue';
import ExamsPanel from '@/components/consultation/ExamsPanel.vue';
import FirmaElectronica from '@/components/firma/FirmaElectronica.vue';
import { useToast } from 'vue-toastification';

// Props
interface Props {
  citaId: string;
  pacienteId: string;
  consultaId: string;
  isCallActive?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isCallActive: false
});

// Emits
const emit = defineEmits<{
  finalize: []
  saveDraft: []
}>();

// State
const toast = useToast();
const activeTool = ref('notes');
const isSaving = ref(false);
const showFinalizeDialog = ref(false);

// Clinical data
const notasConsulta = ref('');
const diagnosticos = ref<any[]>([]);
const medicamentos = ref<any[]>([]);
const examenes = ref<any[]>([]);
const firmaData = ref<any>(null);

// Computed
const pacienteNombre = computed(() => 'Paciente'); // TODO: Load from API
const estadoColor = computed(() => props.isCallActive ? 'success' : 'grey');
const estadoIcon = computed(() => props.isCallActive ? 'mdi-video' : 'mdi-video-off');
const estadoText = computed(() => props.isCallActive ? 'En curso' : 'Finalizada');

const hasNotes = computed(() => notasConsulta.value.trim().length > 0);
const isSigned = computed(() => !!firmaData.value?.signed);
const canSign = computed(() => hasNotes.value);
const canFinalize = computed(() => hasNotes.value && isSigned.value);

const isCompactMode = computed(() => false); // TODO: Detect screen size

// Methods
const handleNotesChange = () => {
  // Auto-save draft after 2 seconds of inactivity
  // TODO: Implement debounce
};

const handleInsertDiagnostico = (diagnostico: any) => {
  diagnosticos.value.push(diagnostico);
  toast.success('Diagnóstico agregado');
};

const handleInsertMedicamento = (medicamento: any) => {
  medicamentos.value.push(medicamento);
  toast.success('Medicamento agregado');
};

const handleInsertExamen = (examen: any) => {
  examenes.value.push(examen);
  toast.success('Examen agregado');
};

const handleAddDiagnostico = (diagnostico: any) => {
  diagnosticos.value.push(diagnostico);
};

const handleRemoveDiagnostico = (index: number) => {
  diagnosticos.value.splice(index, 1);
};

const handleAddMedicamento = (medicamento: any) => {
  medicamentos.value.push(medicamento);
};

const handleRemoveMedicamento = (index: number) => {
  medicamentos.value.splice(index, 1);
};

const handleAddExamen = (examen: any) => {
  examenes.value.push(examen);
};

const handleRemoveExamen = (index: number) => {
  examenes.value.splice(index, 1);
};

const handleSigned = (data: any) => {
  firmaData.value = data;
  toast.success('Documento firmado exitosamente');
};

const handleSignatureError = (mensaje: string) => {
  console.error('Signature error:', mensaje);
  toast.error('Error al firmar el documento');
};

const handleTratamientoSugerido = (tratamiento: any) => {
  // TODO: Handle treatment suggestion
  console.log('Treatment suggestion:', tratamiento);
  toast.info('Sugerencia de tratamiento recibida');
};

const handleSugerenciaEliminada = (tipo: string, contenido: string) => {
  // TODO: Handle deleted suggestion
  console.log('Suggestion deleted:', tipo, contenido);
};

const handleFinalize = () => {
  showFinalizeDialog.value = true;
};

const handleSaveDraft = async () => {
  try {
    isSaving.value = true;
    
    // TODO: Save to API
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast.success('Borrador guardado');
    emit('saveDraft');
  } catch (error) {
    console.error('Error saving draft:', error);
    toast.error('Error al guardar borrador');
  } finally {
    isSaving.value = false;
  }
};

const confirmFinalize = async () => {
  try {
    // TODO: Finalize consultation via API
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast.success('Consulta finalizada exitosamente');
    showFinalizeDialog.value = false;
    emit('finalize');
  } catch (error) {
    console.error('Error finalizing consultation:', error);
    toast.error('Error al finalizar consulta');
  }
};

// Expose methods to parent
defineExpose({
  hasNotes: hasNotes.value,
  isSigned: isSigned.value,
  finalizeConsultation: async () => {
    if (canFinalize.value) {
      await confirmFinalize();
    } else {
      throw new Error('Cannot finalize: missing notes or signature');
    }
  }
});

// Watch for changes
watch([notasConsulta, diagnosticos, medicamentos, examenes], () => {
  // TODO: Auto-save draft
}, { deep: true });
</script>

<style scoped lang="scss">
.teleconsultation-workspace {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f5f7fa;
  overflow: hidden;
}

.workspace-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: white;
  border-bottom: 1px solid #e0e0e0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.header-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.workspace-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #1a1a1a;
}

.patient-badges {
  display: flex;
  gap: 8px;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.workspace-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.context-sidebar {
  width: 320px;
  border-right: 1px solid #e0e0e0;
  background: white;
  overflow-y: auto;
}

.clinical-tools-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tool-window {
  flex: 1;
  overflow: hidden;
}

.tool-content {
  padding: 20px;
  height: calc(100% - 60px);
  overflow-y: auto;
}

.tool-title {
  margin: 0 0 16px 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #333;
}
</style>
