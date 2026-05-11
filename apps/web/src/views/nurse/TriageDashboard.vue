<template>
  <v-container fluid class="triage-dashboard">
    <!-- Header -->
    <div class="d-flex align-center justify-space-between mb-6">
      <div>
        <h1 class="text-h4 font-weight-bold">
          <v-icon start color="primary">mdi-hospital-box</v-icon>
          Triaje Colaborativo
        </h1>
        <p class="text-body-1 text-medium-emphasis mt-1">
          Captura de signos vitales y gestión de triaje
        </p>
      </div>
      <div class="d-flex align-center">
        <v-chip color="primary" variant="tonal" class="mr-3">
          <v-icon start>mdi-clock-outline</v-icon>
          {{ queueCount }} en cola
        </v-chip>
        <v-btn
          color="primary"
          variant="flat"
          @click="refreshQueue"
          :loading="isLoading"
        >
          <v-icon start>mdi-refresh</v-icon>
          Actualizar
        </v-btn>
      </div>
    </div>

    <!-- Loading State -->
    <v-progress-linear
      v-if="isLoading"
      indeterminate
      color="primary"
      location="top"
    />

    <!-- Alert for new triage notifications -->
    <v-alert
      v-if="showNewTriageAlert"
      type="success"
      variant="tonal"
      closable
      class="mb-4"
      @click:close="showNewTriageAlert = false"
    >
      <template v-slot:title>
        <div class="d-flex align-center">
          <v-icon start color="success">mdi-check-circle</v-icon>
          ¡Nuevo triaje completado!
        </div>
      </template>
      <template v-slot:text>
        El paciente {{ lastTriagePatient }} está listo para atención médica
      </template>
    </v-alert>

    <!-- Main Content -->
    <v-row>
      <!-- Queue List -->
      <v-col cols="12" lg="8">
        <v-card variant="outlined" elevation="0">
          <v-card-title class="d-flex align-center">
            <v-icon start color="primary">mdi-queue-music</v-icon>
            Cola de Triaje
            <v-spacer />
            <v-chip size="small" color="warning" variant="tonal">
              {{ triageCount }} en triaje
            </v-chip>
            <v-chip size="small" color="info" variant="tonal" class="ml-2">
              {{ pendienteCount }} pendientes
            </v-chip>
          </v-card-title>

          <v-card-text>
            <v-list v-if="queue.length > 0" class="bg-transparent">
              <v-list-item
                v-for="consulta in queue"
                :key="consulta.id"
                :active="selectedConsulta?.id === consulta.id"
                @click="selectConsulta(consulta)"
                class="mb-2"
                rounded="lg"
                variant="tonal"
              >
                <template v-slot:prepend>
                  <v-avatar :color="getStateColor(consulta.estado)" variant="tonal">
                    <v-icon color="white">
                      {{ getStateIcon(consulta.estado) }}
                    </v-icon>
                  </v-avatar>
                </template>

                <v-list-item-title class="font-weight-bold">
                  {{ consulta.paciente.nombre }}
                </v-list-item-title>

                <v-list-item-subtitle class="d-flex align-center mt-1">
                  <span class="mr-3">{{ consulta.paciente.cedula }}</span>
                  <v-chip size="x-small" :color="getStateColor(consulta.estado)">
                    {{ consulta.estado }}
                  </v-chip>
                  <span class="ml-3 text-caption">
                    {{ formatTimestamp(consulta.updatedAt) }}
                  </span>
                </v-list-item-subtitle>

                <template v-slot:append>
                  <v-icon color="medium-emphasis">mdi-chevron-right</v-icon>
                </template>
              </v-list-item>
            </v-list>

            <!-- Empty State -->
            <div v-else class="text-center py-8">
              <v-icon size="64" color="medium-emphasis" class="mb-4">
                mdi-clipboard-outline
              </v-icon>
              <p class="text-body-1 font-weight-bold mb-2">
                No hay pacientes en cola de triaje
              </p>
              <p class="text-body-2 text-medium-emphasis mb-4">
                Los pacientes aparecerán aquí cuando sean registrados
              </p>
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Triage Form Panel -->
      <v-col cols="12" lg="4">
        <v-card variant="outlined" elevation="0" class="sticky-top">
          <v-card-title>
            <v-icon start color="primary">mdi-heart-pulse</v-icon>
            Captura de Signos Vitales
          </v-card-title>

          <v-card-text>
            <TriageForm
              v-if="selectedConsulta"
              :paciente-nombre="selectedConsulta.paciente.nombre"
              :estado="selectedConsulta.estado"
              :consulta-id="selectedConsulta.id"
              :initial-data="selectedConsulta.triajeData"
              @submit="handleTriageSubmit"
              @cancel="selectedConsulta = null"
              @save-draft="handleTriageSaveDraft"
            />

            <!-- Empty State -->
            <div v-else class="text-center py-8">
              <v-icon size="64" color="medium-emphasis" class="mb-4">
                mdi-hand-click
              </v-icon>
              <p class="text-body-1 font-weight-bold mb-2">
                Seleccione un paciente
              </p>
              <p class="text-body-2 text-medium-emphasis">
                Haga clic en un paciente de la lista para comenzar el triaje
              </p>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted, onUnmounted } from 'vue';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuthStore } from '@/stores/auth';
import TriageForm from '@/components/consultation/TriageForm.vue';
import { useSSE } from '@/composables/useSSE';

interface Consulta {
  id: string;
  paciente: {
    id: string;
    nombre: string;
    cedula: string;
  };
  doctor: {
    id: string;
    nombre: string;
  };
  estado: 'borrador' | 'triaje' | 'pendiente';
  triajeData?: any;
  updatedAt: string | Date;
}

export default defineComponent({
  name: 'TriageDashboard',

  components: {
    TriageForm
  },

  setup() {
    const authStore = useAuthStore();
    const { connect, disconnect } = useSSE(authStore.user?.id || '');

    const isLoading = ref(false);
    const queue = ref<Consulta[]>([]);
    const selectedConsulta = ref<Consulta | null>(null);
    const showNewTriageAlert = ref(false);
    const lastTriagePatient = ref('');

    const queueCount = computed(() => queue.value.length);
    const triageCount = computed(() =>
      queue.value.filter(c => c.estado === 'triaje').length
    );
    const pendienteCount = computed(() =>
      queue.value.filter(c => c.estado === 'pendiente').length
    );

    // Fetch triage queue
    const fetchQueue = async () => {
      isLoading.value = true;
      try {
        const response = await fetch('/api/v1/consultas/triage/queue', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        });

        if (response.ok) {
          const result = await response.json();
          queue.value = result.data || [];
        }
      } catch (error) {
        console.error('Error fetching triage queue:', error);
      } finally {
        isLoading.value = false;
      }
    };

    // Submit triage data
    const handleTriageSubmit = async (triageData: any) => {
      if (!selectedConsulta.value) return;

      try {
        const response = await fetch(`/api/v1/consultas/${selectedConsulta.value.id}/triage`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          },
          body: JSON.stringify({ triageData })
        });

        if (response.ok) {
          const result = await response.json();
          
          // Update local queue
          const index = queue.value.findIndex(c => c.id === selectedConsulta.value?.id);
          if (index !== -1) {
            queue.value[index] = result.data;
          }

          // Show success message
          if (triageData.isComplete) {
            showNewTriageAlert.value = true;
            lastTriagePatient.value = selectedConsulta.value.paciente.nombre;
          }

          // Clear selection after short delay
          setTimeout(() => {
            selectedConsulta.value = null;
          }, 1000);
        } else {
          const error = await response.json();
          throw new Error(error.message || 'Error al guardar triaje');
        }
      } catch (error: any) {
        console.error('Error submitting triage:', error);
        alert(`Error: ${error.message}`);
      }
    };

    // Save draft
    const handleTriageSaveDraft = async (triageData: any) => {
      // Similar to submit but without isComplete flag
      await handleTriageSubmit(triageData);
    };

    // Select consultation for triage
    const selectConsulta = (consulta: Consulta) => {
      selectedConsulta.value = consulta;
    };

    // Refresh queue
    const refreshQueue = () => {
      fetchQueue();
    };

    // Format timestamp
    const formatTimestamp = (date: string | Date) => {
      try {
        return format(new Date(date), 'HH:mm', { locale: es });
      } catch (e) {
        return '';
      }
    };

    // Get state color
    const getStateColor = (estado: string) => {
      switch (estado) {
        case 'triaje': return 'warning';
        case 'pendiente': return 'info';
        case 'en_atencion': return 'success';
        default: return 'grey';
      }
    };

    // Get state icon
    const getStateIcon = (estado: string) => {
      switch (estado) {
        case 'triaje': return 'mdi-heart-pulse';
        case 'pendiente': return 'mdi-clock-outline';
        case 'en_atencion': return 'mdi-account-check';
        default: return 'mdi-file-outline';
      }
    };

    // Handle SSE notifications
    const handleSSEMessage = (event: CustomEvent) => {
      const data = event.detail;
      if (data.type === 'TRIAGE_COMPLETED') {
        // Refresh queue when new triage is completed
        fetchQueue();
      }
    };

    onMounted(() => {
      fetchQueue();
      connect();
      window.addEventListener('sse-message', handleSSEMessage as EventListener);
    });

    onUnmounted(() => {
      disconnect();
      window.removeEventListener('sse-message', handleSSEMessage as EventListener);
    });

    return {
      isLoading,
      queue,
      selectedConsulta,
      showNewTriageAlert,
      lastTriagePatient,
      queueCount,
      triageCount,
      pendienteCount,
      handleTriageSubmit,
      handleTriageSaveDraft,
      selectConsulta,
      refreshQueue,
      formatTimestamp,
      getStateColor,
      getStateIcon
    };
  }
});
</script>

<style scoped lang="scss">
.triage-dashboard {
  max-width: 1600px;
  margin: 0 auto;
}

.sticky-top {
  position: sticky;
  top: 24px;
}

:deep(.v-list-item) {
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    transform: translateX(4px);
  }
}
</style>
