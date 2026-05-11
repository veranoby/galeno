<template>
  <v-card
    class="triage-card"
    :class="{
      'triage-card--new': isNew,
      'triage-card--urgent': isUrgent
    }"
    variant="outlined"
    elevation="0"
  >
    <!-- Notification Badge for new triage -->
    <v-badge
      v-if="isNew"
      color="error"
      content="NUEVO"
      floating
      offset-x="10"
      offset-y="10"
      class="badge-new"
    />

    <v-card-title class="d-flex align-start justify-space-between">
      <div class="patient-info">
        <div class="d-flex align-center mb-1">
          <v-avatar size="40" color="primary" class="mr-3">
            <v-icon color="white">mdi-account</v-icon>
          </v-avatar>
          <div>
            <h3 class="text-body-1 font-weight-bold mb-0">
              {{ pacienteNombre }}
            </h3>
            <p class="text-caption text-medium-emphasis mb-0">
              {{ pacienteCedula }}
            </p>
          </div>
        </div>
      </div>
      <v-chip
        :color="estadoColor"
        :variant="estadoVariant"
        size="small"
        class="estado-chip"
      >
        {{ estado }}
      </v-chip>
    </v-card-title>

    <v-card-text class="pt-2">
      <!-- Triage Data Summary -->
      <div v-if="triajeData" class="triage-summary">
        <v-row dense>
          <!-- Blood Pressure -->
          <v-col cols="6" md="4">
            <div class="vital-sign">
              <v-icon size="x-small" color="error" start>mdi-heart</v-icon>
              <span class="text-caption">{{ triajeData.bloodPressure || 'N/A' }}</span>
              <span class="text-overline text-disabled d-block">PA (mmHg)</span>
            </div>
          </v-col>

          <!-- Heart Rate -->
          <v-col cols="6" md="4">
            <div class="vital-sign">
              <v-icon size="x-small" color="error" start>mdi-heart-box</v-icon>
              <span class="text-caption">{{ triajeData.heartRate || 'N/A' }}</span>
              <span class="text-overline text-disabled d-block">BPM</span>
            </div>
          </v-col>

          <!-- Temperature -->
          <v-col cols="6" md="4">
            <div class="vital-sign">
              <v-icon size="x-small" color="warning" start>mdi-thermometer</v-icon>
              <span class="text-caption">{{ triajeData.temperature || 'N/A' }}</span>
              <span class="text-overline text-disabled d-block">°C</span>
            </div>
          </v-col>

          <!-- Respiratory Rate -->
          <v-col cols="6" md="4">
            <div class="vital-sign">
              <v-icon size="x-small" color="info" start>mdi-lungs</v-icon>
              <span class="text-caption">{{ triajeData.respiratoryRate || 'N/A' }}</span>
              <span class="text-overline text-disabled d-block">RPM</span>
            </div>
          </v-col>

          <!-- Oxygen Saturation -->
          <v-col cols="6" md="4">
            <div class="vital-sign">
              <v-icon size="x-small" color="success" start>mdi-air-purifier</v-icon>
              <span class="text-caption">{{ triajeData.oxygenSaturation || 'N/A' }}</span>
              <span class="text-overline text-disabled d-block">SpO₂ %</span>
            </div>
          </v-col>

          <!-- Pain Level -->
          <v-col cols="6" md="4">
            <div class="vital-sign">
              <v-icon
                size="x-small"
                :color="painColor"
                start
              >
                {{ painIcon }}
              </v-icon>
              <span class="text-caption">{{ triajeData.painLevel ?? 'N/A' }}</span>
              <span class="text-overline text-disabled d-block">Dolor</span>
            </div>
          </v-col>
        </v-row>

        <!-- Chief Complaint -->
        <div v-if="triajeData.chiefComplaint" class="mt-3">
          <div class="text-caption text-medium-emphasis mb-1">
            <v-icon size="x-small" start>mdi-clipboard-text</v-icon>
            Motivo de Consulta:
          </div>
          <p class="text-body-2 mb-0">
            {{ triajeData.chiefComplaint }}
          </p>
        </div>

        <!-- Allergies Alert -->
        <v-alert
          v-if="triajeData.allergyStatus && triajeData.allergyStatus.toLowerCase() !== 'sin alergias'"
          type="warning"
          variant="tonal"
          density="compact"
          class="mt-3"
          icon="mdi-alert-circle"
        >
          <span class="text-caption">{{ triajeData.allergyStatus }}</span>
        </v-alert>
      </div>

      <!-- No Triage Data -->
      <div v-else class="text-center py-4">
        <v-icon size="48" color="medium-emphasis" class="mb-2">
          mdi-clipboard-outline
        </v-icon>
        <p class="text-body-2 text-medium-emphasis mb-0">
          Triaje no completado
        </p>
        <p class="text-caption text-disabled mb-0">
          Esperando captura de signos vitales
        </p>
      </div>

      <!-- Timestamp -->
      <div class="d-flex align-center mt-3 pt-3 border-t">
        <v-icon size="x-small" class="mr-1" color="medium-emphasis">
          mdi-clock-outline
        </v-icon>
        <span class="text-caption text-medium-emphasis">
          {{ formattedTimestamp }}
        </span>
        <v-spacer />
        <v-chip
          v-if="timeAgo"
          size="x-small"
          variant="text"
          color="medium-emphasis"
        >
          {{ timeAgo }}
        </v-chip>
      </div>
    </v-card-text>

    <v-card-actions class="pa-2">
      <v-btn
        variant="text"
        color="primary"
        size="small"
        @click="$emit('view-details')"
        block
      >
        <v-icon start size="small">mdi-eye</v-icon>
        Ver Detalles
      </v-btn>
      <v-btn
        v-if="estado === 'pendiente'"
        variant="flat"
        color="primary"
        size="small"
        @click="$emit('admit-patient')"
        class="ml-2"
      >
        <v-icon start size="small">mdi-account-arrow-right</v-icon>
        Admitir
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script lang="ts">
import { defineComponent, computed, ref, watch } from 'vue';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export interface TriageData {
  bloodPressure?: string;
  heartRate?: number;
  temperature?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  weight?: number;
  height?: number;
  painLevel?: number;
  chiefComplaint?: string;
  allergyStatus?: string;
  currentMedications?: string;
  notes?: string;
  isComplete?: boolean;
}

export interface TriageCardProps {
  consultaId: string;
  pacienteNombre: string;
  pacienteCedula: string;
  estado: 'triaje' | 'pendiente' | 'en_atencion';
  triajeData?: TriageData | null;
  timestamp?: string | Date;
  isNew?: boolean;
}

export default defineComponent({
  name: 'TriageCard',

  props: {
    consultaId: {
      type: String,
      required: true
    },
    pacienteNombre: {
      type: String,
      required: true
    },
    pacienteCedula: {
      type: String,
      required: true
    },
    estado: {
      type: String as () => 'triaje' | 'pendiente' | 'en_atencion',
      required: true
    },
    triajeData: {
      type: Object as () => TriageData | null,
      default: null
    },
    timestamp: {
      type: [String, Date],
      default: undefined
    },
    isNew: {
      type: Boolean,
      default: false
    }
  },

  emits: ['view-details', 'admit-patient'],

  setup(props) {
    const localTimestamp = ref<string | Date>(props.timestamp || new Date());

    const estadoColor = computed(() => {
      switch (props.estado) {
        case 'triaje':
          return 'warning';
        case 'pendiente':
          return 'info';
        case 'en_atencion':
          return 'success';
        default:
          return 'grey';
      }
    });

    const estadoVariant = computed(() => {
      return props.isNew ? 'flat' : 'tonal';
    });

    const formattedTimestamp = computed(() => {
      if (!localTimestamp.value) return '';
      try {
        return format(new Date(localTimestamp.value), 'dd MMM yyyy, hh:mm a', { locale: es });
      } catch (e) {
        return '';
      }
    });

    const timeAgo = computed(() => {
      if (!localTimestamp.value) return '';
      try {
        return formatDistanceToNow(new Date(localTimestamp.value), { 
          addSuffix: true,
          locale: es 
        });
      } catch (e) {
        return '';
      }
    });

    const isUrgent = computed(() => {
      if (!props.triajeData) return false;
      // Check for urgent vital signs
      const { oxygenSaturation, heartRate, bloodPressure } = props.triajeData;
      
      if (oxygenSaturation && oxygenSaturation < 90) return true;
      if (heartRate && (heartRate > 120 || heartRate < 50)) return true;
      
      if (bloodPressure) {
        const [systolic, diastolic] = bloodPressure.split('/').map(Number);
        if (systolic > 180 || diastolic > 120) return true;
      }
      
      return false;
    });

    const painColor = computed(() => {
      if (props.triajeData?.painLevel === undefined || props.triajeData?.painLevel === null) {
        return 'medium-emphasis';
      }
      const pain = props.triajeData.painLevel;
      if (pain <= 3) return 'success';
      if (pain <= 6) return 'warning';
      return 'error';
    });

    const painIcon = computed(() => {
      if (props.triajeData?.painLevel === undefined || props.triajeData?.painLevel === null) {
        return 'mdi-help-circle';
      }
      const pain = props.triajeData.painLevel;
      if (pain <= 3) return 'mdi-emoticon-happy-outline';
      if (pain <= 6) return 'mdi-emoticon-neutral-outline';
      return 'mdi-emoticon-sad-outline';
    });

    // Watch for timestamp changes
    watch(() => props.timestamp, (newVal) => {
      if (newVal) {
        localTimestamp.value = newVal;
      }
    });

    return {
      estadoColor,
      estadoVariant,
      formattedTimestamp,
      timeAgo,
      isUrgent,
      painColor,
      painIcon
    };
  }
});
</script>

<style scoped lang="scss">
.triage-card {
  position: relative;
  transition: all 0.3s ease;
  border-radius: 12px !important;
  overflow: hidden;

  &:hover {
    border-color: rgb(var(--v-theme-primary)) !important;
    transform: translateY(-2px);
  }

  &--new {
    border-left: 4px solid rgb(var(--v-theme-error)) !important;
    animation: pulse 2s infinite;
  }

  &--urgent {
    border-left: 4px solid rgb(var(--v-theme-error)) !important;
    background-color: rgba(var(--v-theme-error), 0.05) !important;
  }
}

.badge-new {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1;
}

.patient-info {
  flex: 1;
  min-width: 0;
}

.vital-sign {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 8px;
  background-color: rgba(var(--v-theme-surface-variant), 0.5);
  border-radius: 8px;
  height: 100%;

  .text-caption {
    font-weight: 600;
    font-size: 0.875rem !important;
  }
}

.estado-chip {
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(244, 67, 54, 0.4);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(244, 67, 54, 0);
  }
}
</style>
