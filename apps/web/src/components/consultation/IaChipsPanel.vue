<template>
  <div class="ia-chips-panel">
    <div class="panel-header">
      <h3 class="panel-title">
        <v-icon icon="mdi-robot" class="mr-2" color="#1976D2" />
        Asistente IA
      </h3>
      
      <v-btn 
        icon 
        variant="text" 
        size="x-small"
        @click="toggleExpanded"
      >
        <v-icon>{{ expanded ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
      </v-btn>
    </div>
    
    <v-expand-transition>
      <div v-if="expanded" class="panel-content">
        <!-- Medicamentos sugeridos (verde) -->
        <div v-if="tratamientoSugerido?.medicamentos?.length" class="suggestions-section">
          <h4 class="section-title">
            <v-icon icon="mdi-pill" color="#43A047" size="small" class="mr-1" />
            Medicamentos
          </h4>
          <div class="chips-container">
            <IaChip
              v-for="medicamento in tratamientoSugerido.medicamentos"
              :key="'med-' + medicamento.nombre"
              tipo="verde"
              :text="`${medicamento.nombre} - ${medicamento.dosis}`"
              :confidence="0.85"
              @close="removeSuggestion('medicamento', medicamento.nombre)"
            />
          </div>
        </div>
        
        <!-- Exámenes sugeridos (amarillo) -->
        <div v-if="tratamientoSugerido?.examenes?.length" class="suggestions-section">
          <h4 class="section-title">
            <v-icon icon="mdi-test-tube" color="#F57C00" size="small" class="mr-1" />
            Exámenes
          </h4>
          <div class="chips-container">
            <IaChip
              v-for="examen in tratamientoSugerido.examenes"
              :key="'exam-' + examen.nombre"
              tipo="amarillo"
              :text="examen.nombre"
              :confidence="0.78"
              @close="removeSuggestion('examen', examen.nombre)"
            />
          </div>
        </div>
        
        <!-- Alertas (rojo) -->
        <div v-if="tratamientoSugerido?.alertas?.length" class="suggestions-section">
          <h4 class="section-title">
            <v-icon icon="mdi-alert" color="#C62828" size="small" class="mr-1" />
            Alertas
          </h4>
          <div class="chips-container">
            <IaChip
              v-for="alerta in tratamientoSugerido.alertas"
              :key="'alert-' + alerta.mensaje"
              tipo="rojo"
              :text="alerta.mensaje"
              :confidence="0.92"
              @close="removeSuggestion('alerta', alerta.mensaje)"
            />
          </div>
        </div>
        
        <!-- Cargar sugerencias de tratamiento -->
        <div v-if="showTreatmentButton" class="treatment-button-section">
          <v-btn
            :loading="loadingTreatment"
            variant="elevated"
            color="#1976D2"
            @click="loadTreatmentSuggestions"
            block
          >
            <v-icon icon="mdi-robot" start />
            Obtener Sugerencias de Tratamiento
          </v-btn>
        </div>
      </div>
    </v-expand-transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { apiClient } from '@/services/api';
import IaChip from '@galeno/ui-components/src/IaChip.vue';

// Define interfaces to match backend
interface MedicamentoSugerido {
  nombre: string;
  dosis: string;
  tipo: string;
}

interface ExamenSugerido {
  nombre: string;
  urgencia: string;
}

interface AlertaSugerida {
  mensaje: string;
  tipo: string;
}

interface TratamientoSugerido {
  medicamentos: MedicamentoSugerido[];
  examenes: ExamenSugerido[];
  alertas: AlertaSugerida[];
}

interface Props {
  diagnostico?: string;
  evolucion?: string;
  showTreatmentButton?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  diagnostico: '',
  evolucion: '',
  showTreatmentButton: true
});

const emit = defineEmits<{
  'tratamiento-sugerido': [tratamiento: TratamientoSugerido];
  'sugerencia-eliminada': [tipo: string, contenido: string];
}>();

const expanded = ref(true);
const loadingTreatment = ref(false);
const tratamientoSugerido = ref<TratamientoSugerido | null>(null);

const toggleExpanded = () => {
  expanded.value = !expanded.value;
};

const loadTreatmentSuggestions = async () => {
  if (!props.diagnostico || !props.evolucion) {
    // Show error message
    return;
  }

  loadingTreatment.value = true;

  try {
    const response = await apiClient.post<TratamientoSugerido>('/api/ia/tratamiento', {
      diagnostico: props.diagnostico,
      evolucion: props.evolucion
    });

    if (response.success && response.data) {
      tratamientoSugerido.value = response.data;
      emit('tratamiento-sugerido', response.data);
    }
  } catch (error) {
    console.error('Error obteniendo sugerencias de tratamiento:', error);
    // Show error message to user
  } finally {
    loadingTreatment.value = false;
  }
};

const removeSuggestion = (tipo: string, contenido: string) => {
  emit('sugerencia-eliminada', tipo, contenido);
  // In a real implementation, we might want to update the local state
};
</script>

<style scoped>
.ia-chips-panel {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: white;
  box-shadow: 0 2px 1px -1px rgba(0,0,0,0.2), 0 1px 1px 0 rgba(0,0,0,0.14), 0 1px 3px 0 rgba(0,0,0,0.12);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #eee;
  background-color: #f5f9ff;
  border-radius: 8px 8px 0 0;
}

.panel-title {
  display: flex;
  align-items: center;
  font-size: 0.9rem !important;
  font-weight: 600;
  color: #1976D2;
  margin: 0;
}

.panel-content {
  padding: 12px;
}

.suggestions-section {
  margin-bottom: 16px;
}

.section-title {
  display: flex;
  align-items: center;
  font-size: 0.85rem !important;
  font-weight: 600;
  color: #555;
  margin: 0 0 8px 0;
}

.chips-container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.treatment-button-section {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px dashed #e0e0e0;
}
</style>