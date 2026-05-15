<template>
  <WorkspaceLayout
    v-if="!loading && !error"
    :title="titulo"
    :saving="guardando"
    @save="guardarConsulta"
    @print="imprimirConsulta"
    @more="mostrarMasOpciones"
    @sidebar-toggle="onSidebarToggle"
  >
    <!-- Toolbar Personalizado -->
    <template #toolbar-title>
      <div class="d-flex align-center gap-2">
        <h2 class="text-h6">{{ consulta?.paciente?.nombre || 'Consulta' }}</h2>
        <v-chip :color="getEstadoColor(consulta?.estado)" size="x-small">
          {{ getEstadoLabel(consulta?.estado) }}
        </v-chip>
      </div>
    </template>

    <template #toolbar-center>
      <div class="d-flex align-center gap-2">
        <v-chip size="small" variant="outlined">
          <v-icon icon="mdi-calendar" size="x-small" start />
          {{ formatDate(consulta?.createdAt) }}
        </v-chip>
        <v-chip size="small" variant="outlined" v-if="consulta?.doctor">
          <v-icon icon="mdi-doctor" size="x-small" start />
          Dr. {{ consulta.doctor.nombre }}
        </v-chip>
      </div>
    </template>

    <!-- Panel Lateral - Contexto del Paciente -->
    <template #sidebar>
      <ContextSidebar
        :paciente-id="consulta?.paciente?.id"
        :consulta-id="route.params.id as string"
        @ver-mas-alertas="verMasAlertas"
        @ver-historial="verHistorial"
        @ver-documentos="verDocumentos"
        @ver-recetas="verRecetas"
        @ver-antecedentes="verAntecedentes"
      />
    </template>

    <!-- Área Principal - Contenido de la Consulta -->
    <template #default>
      <div class="consulta-content">
        <!-- Breadcrumb -->
        <v-breadcrumbs :items="breadcrumbs" class="pa-0 mb-4">
          <template v-slot:prepend>
            <v-icon icon="mdi-arrow-left" @click="volverAConsultas" class="cursor-pointer" />
          </template>
        </v-breadcrumbs>

        <!-- Tabs de navegación -->
        <v-tabs v-model="tabActual" color="primary">
          <v-tab value="informacion">Información</v-tab>
          <v-tab value="motivo">Motivo</v-tab>
          <v-tab value="evolucion">Evolución</v-tab>
          <v-tab value="diagnostico">Diagnóstico</v-tab>
          <v-tab value="tratamiento">Tratamiento</v-tab>
          <v-tab value="receta">Receta</v-tab>
        </v-tabs>

        <v-window v-model="tabActual" class="mt-4">
          <!-- Tab: Información -->
          <v-window-item value="informacion">
            <v-card>
              <v-card-text>
                <v-row>
                  <v-col cols="12" md="6">
                    <div class="text-subtitle-2 mb-2">Información del Paciente</div>
                    <v-list density="compact">
                      <v-list-item>
                        <v-list-item-title>Nombre</v-list-item-title>
                        <v-list-item-subtitle>{{ consulta?.paciente?.nombre || 'N/A' }}</v-list-item-subtitle>
                      </v-list-item>
                      <v-list-item>
                        <v-list-item-title>Cédula / HC</v-list-item-title>
                        <v-list-item-subtitle>{{ consulta?.paciente?.cedula || 'N/A' }}</v-list-item-subtitle>
                      </v-list-item>
                      <v-list-item>
                        <v-list-item-title>Edad</v-list-item-title>
                        <v-list-item-subtitle>{{ calcularEdad(consulta?.paciente?.fechaNacimiento) }} años</v-list-item-subtitle>
                      </v-list-item>
                    </v-list>
                  </v-col>
                  <v-col cols="12" md="6">
                    <div class="text-subtitle-2 mb-2">Información de la Consulta</div>
                    <v-list density="compact">
                      <v-list-item>
                        <v-list-item-title>Estado</v-list-item-title>
                        <v-list-item-subtitle>{{ getEstadoLabel(consulta?.estado) }}</v-list-item-subtitle>
                      </v-list-item>
                      <v-list-item>
                        <v-list-item-title>Fecha</v-list-item-title>
                        <v-list-item-subtitle>{{ formatDateTime(consulta?.createdAt) }}</v-list-item-subtitle>
                      </v-list-item>
                      <v-list-item>
                        <v-list-item-title>Doctor</v-list-item-title>
                        <v-list-item-subtitle>{{ consulta?.doctor?.nombre || 'N/A' }}</v-list-item-subtitle>
                      </v-list-item>
                    </v-list>
                  </v-col>
                </v-row>
              </v-card-text>
            </v-card>
          </v-window-item>

          <!-- Tab: Motivo -->
          <v-window-item value="motivo">
            <v-card>
              <v-card-text>
                <v-textarea
                  v-model="consultaForm.motivoConsulta"
                  label="Motivo de Consulta"
                  variant="outlined"
                  rows="6"
                  placeholder="Describe el motivo por el cual el paciente acude a consulta..."
                />
              </v-card-text>
            </v-card>
          </v-window-item>

          <!-- Tab: Evolución -->
          <v-window-item value="evolucion">
            <v-card>
              <v-card-text>
                <v-textarea
                  v-model="consultaForm.evolucion"
                  label="Evolución"
                  variant="outlined"
                  rows="8"
                  placeholder="Describe la evolución del paciente durante la consulta..."
                />
              </v-card-text>
            </v-card>
          </v-window-item>

          <!-- Tab: Diagnóstico -->
          <v-window-item value="diagnostico">
            <v-card>
              <v-card-text>
                <v-textarea
                  v-model="consultaForm.diagnostico"
                  label="Diagnóstico"
                  variant="outlined"
                  rows="6"
                  placeholder="Describe el diagnóstico del paciente..."
                />
                <div class="mt-4">
                  <!-- IA Suggestions Display -->
                  <div v-if="iaLoading" class="d-flex align-center pa-2">
                    <v-progress-circular indeterminate size="20" class="mr-2" />
                    <span class="text-caption">Analizando con IA...</span>
                  </div>
                  
                  <div v-else-if="iaSuggestions && iaSuggestions.length > 0" class="pa-2">
                    <div class="text-caption font-weight-medium mb-2">Sugerencias de IA:</div>
                    <div class="d-flex flex-wrap gap-2">
                      <v-chip
                        v-for="suggestion in iaSuggestions"
                        :key="suggestion.codigo"
                        color="#1976D2"
                        variant="elevated"
                        size="small"
                        closable
                        @click:close="removeSuggestion(suggestion.codigo)"
                      >
                        <v-icon icon="mdi-robot" start size="x-small" />
                        {{ suggestion.codigo }}: {{ suggestion.descripcion }}
                        <span class="ml-1 text-caption">({{ Math.round(suggestion.confianza * 100) }}%)</span>
                      </v-chip>
                    </div>
                  </div>
                  
                  <v-select
                    v-model="consultaForm.diagnosticoCie10"
                    :items="cie10Options"
                    label="Código CIE-10"
                    variant="outlined"
                    chips
                    multiple
                    placeholder="Buscar código CIE-10..."
                    hint="Sugerencias de IA disponibles"
                    persistent-hint
                  />
                </div>
              </v-card-text>
            </v-card>
          </v-window-item>

          <!-- Tab: Tratamiento -->
          <v-window-item value="tratamiento">
            <v-card>
              <v-card-text>
                <v-textarea
                  v-model="consultaForm.tratamiento"
                  label="Tratamiento"
                  variant="outlined"
                  rows="6"
                  placeholder="Describe el tratamiento indicado..."
                />
                
                <!-- IA Treatment Suggestions Panel -->
                <div class="mt-6">
                  <IaChipsPanel
                    :diagnostico="consultaForm.diagnostico"
                    :evolucion="consultaForm.evolucion"
                    @tratamiento-sugerido="handleTreatmentSuggested"
                    @sugerencia-eliminada="handleSuggestionRemoved"
                  />
                </div>
              </v-card-text>
            </v-card>
          </v-window-item>

          <!-- Tab: Receta -->
          <!-- Módulo de Especialidad Dinámico -->
          <v-window-item value="especialidad">
            <component :is="SpecialtyModuleComponent" v-if="SpecialtyModuleComponent" :consulta="consulta" />
            <v-alert v-else type="info">Configurando especialidad...</v-alert>
          </v-window-item>

          <v-window-item value="receta">
            <v-card>
              <v-card-text>
                <div class="text-subtitle-2 mb-4">Receta Médica</div>
                <v-alert type="info" variant="tonal" density="compact" class="mb-4">
                  <v-icon icon="mdi-information" start />
                  Próximamente: Editor de recetas con medicamentos del MSP
                </v-alert>
                <v-textarea
                  v-model="consultaForm.receta"
                  label="Receta (Texto Libre)"
                  variant="outlined"
                  rows="8"
                  placeholder="Rp: ..."
                />
              </v-card-text>
            </v-card>
          </v-window-item>
        </v-window>
      </div>
    </template>

    <!-- Panel de Herramientas -->
    <template #tools-content>
      <ToolsPanel
        :estado="consulta?.estado"
        :firmado="consulta?.firmado"
        :fecha-firma="consulta?.fechaFirma"
        @ia-assistant="abrirIAAssistant"
        @receta="irATab('receta')"
        @documentos="verDocumentos"
        @historial="verHistorial"
        @interconsulta="abrirInterconsulta"
        @cambiar-estado="cambiarEstado"
        @firma="abrirFirma"
      />
    </template>
  </WorkspaceLayout>

  <!-- Loading State -->
  <v-container v-else-if="loading" class="fill-height">
    <v-row align="center" justify="center">
      <v-col cols="auto" class="text-center">
        <v-progress-circular indeterminate color="primary" size="64" />
        <p class="text-h6 mt-4">Cargando consulta...</p>
      </v-col>
    </v-row>
  </v-container>

  <!-- Error State -->
  <v-container v-else class="fill-height">
    <v-row align="center" justify="center">
      <v-col cols="auto" class="text-center">
        <v-icon icon="mdi-alert-circle" color="error" size="64" />
        <p class="text-h6 mt-4">{{ error || 'Consulta no encontrada' }}</p>
        <v-btn color="primary" variant="elevated" @click="volverAConsultas" class="mt-4">
          Volver a Consultas
        </v-btn>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">

import { ref, computed, onMounted, watch, defineAsyncComponent } from 'vue';
import type { Ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { AuthStateManager } from '@/state/managers/AuthStateManager';
import { apiClient } from '@/services/api';
import { useIADebounce, type CodigoCIE10 } from '@/composables/useIADebounce';
import WorkspaceLayout from '@/components/consultation/WorkspaceLayout.vue';
import ContextSidebar from '@/components/consultation/ContextSidebar.vue';
import ToolsPanel from '@/components/consultation/ToolsPanel.vue';
import IaChipsPanel from '@/components/consultation/IaChipsPanel.vue';

// Specialty Module Lazy Loading
const SpecialtyModuleComponent = computed(() => {
  const specialtyId = AuthStateManager.user?.specialty_id;
  if (!specialtyId) return null;
  // Dynamic import based on specialty_id
  return defineAsyncComponent(() => import(`@/components/specialties/${specialtyId}Module.vue`).catch(() => import('@/components/specialties/DefaultModule.vue')));
});


// Router
const route = useRoute();
const router = useRouter();

// Estado
const loading = ref(true);
const error = ref<string | null>(null);
const tabActual = ref('informacion');
const guardando = ref(false);

const consulta = ref<any>(null);
const ultimaConsulta = ref<any>(null);
const alertas = ref([
  {
    id: '1',
    tipo: 'warning' as const,
    mensaje: 'DM controlada - Revisar en próximos días',
    tiempo: 'Hace 2 días'
  }
]);

const consultaForm = ref({
  motivoConsulta: '',
  evolucion: '',
  diagnostico: '',
  diagnosticoCie10: [] as (string | CodigoCIE10)[],
  tratamiento: '',
  receta: ''
} as {
  motivoConsulta?: string;
  evolucion?: string;
  diagnostico?: string;
  diagnosticoCie10?: (string | CodigoCIE10)[];
  tratamiento?: string;
  receta?: string;
});

// Reactive reference for evolucion to use with IA debounce
const evolucionRef = computed({
  get: () => consultaForm.value.evolucion || '',
  set: (value) => {
    consultaForm.value.evolucion = value;
  }
}) as Ref<string>;

// IA Suggestions
const { loading: iaLoading, sugerencias: iaSuggestions } = useIADebounce(evolucionRef);

// Computed
const titulo = computed(() => {
  if (!consulta.value) return 'Consulta';
  return `Consulta - ${consulta.value.paciente?.nombre || ''}`;
});

const breadcrumbs = computed(() => [
  { title: 'Consultas', to: '/consultas' },
  { title: consulta.value?.paciente?.nombre || 'Consulta' }
]);

// Métodos
const cargarConsulta = async () => {
  loading.value = true;
  error.value = null;

  try {
    const consultaId = route.params.id as string;
    const response = await apiClient.get(`/api/v1/consultas/${consultaId}`);

    if (response.success && response.data) {
      consulta.value = response.data;

      // Cargar datos en el formulario
      const data = response.data as any;
      consultaForm.value = {
        motivoConsulta: data.motivoConsulta || '',
        evolucion: data.evolucion || '',
        diagnostico: data.diagnostico || '',
        diagnosticoCie10: data.diagnosticoCie10 || [],
        tratamiento: data.tratamiento || '',
        receta: data.receta || ''
      };

      // Cargar última consulta (simulado por ahora)
      // TODO: Implementar llamada real a la API
    } else {
      error.value = 'No se pudo cargar la consulta';
    }
  } catch (err: any) {
    error.value = err.message || 'Error al cargar la consulta';
    console.error('Error cargando consulta:', err);
  } finally {
    loading.value = false;
  }
};

const guardarConsulta = async () => {
  guardando.value = true;

  try {
    const consultaId = route.params.id as string;
    // Usar fetch directamente hasta que apiClient tenga método put
    const response = await fetch(`/api/v1/consultas/${consultaId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(consultaForm.value)
    });

    if (response.ok) {
      // Actualizar datos locales
      consulta.value = { ...consulta.value, ...consultaForm.value };
      // Mostrar notificación
      // TODO: Implementar sistema de notificaciones
    }
  } catch (err: any) {
    console.error('Error guardando consulta:', err);
    // Mostrar error
    // TODO: Implementar sistema de notificaciones
  } finally {
    guardando.value = false;
  }
};

const imprimirConsulta = () => {
  window.print();
};

const mostrarMasOpciones = () => {
  // Abrir menú de más opciones
};

const onSidebarToggle = (collapsed: boolean) => {
  // Manejar cambio de estado del sidebar
};

// Navegación
const volverAConsultas = () => {
  router.push('/consultas');
};

const irATab = (tab: string) => {
  tabActual.value = tab;
};

// Acciones del ContextSidebar
const verMasAlertas = () => {
  // Mostrar modal con todas las alertas
};

const verHistorial = () => {
  router.push(`/pacientes/${consulta.value?.paciente?.id}/historial`);
};

const verDocumentos = () => {
  router.push(`/pacientes/${consulta.value?.paciente?.id}/documentos`);
};

const verRecetas = () => {
  router.push(`/pacientes/${consulta.value?.paciente?.id}/recetas`);
};

const verAntecedentes = () => {
  router.push(`/pacientes/${consulta.value?.paciente?.id}/antecedentes`);
};

// Acciones del ToolsPanel
const abrirIAAssistant = () => {
  // Abrir asistente de IA
  irATab('diagnostico');
};

const abrirInterconsulta = () => {
  // Abrir diálogo de interconsulta
};

const cambiarEstado = (estado: string) => {
  if (consulta.value) {
    consulta.value.estado = estado;
  }
};

const abrirFirma = () => {
  // Abrir diálogo de firma
};

// Helpers
const formatDate = (date?: Date | string): string => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('es-EC', {
    day: 'numeric',
    month: 'short'
  });
};

const formatDateTime = (date?: Date | string): string => {
  if (!date) return '';
  return new Date(date).toLocaleString('es-EC', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getEstadoColor = (estado?: string): string => {
  if (!estado) return 'grey';
  const colores: Record<string, string> = {
    borrador: 'grey',
    triaje: 'info',
    pendiente: 'warning',
    en_atencion: 'primary',
    finalizada: 'success',
    interconsulta: 'purple'
  };
  return colores[estado] || 'grey';
};

const getEstadoLabel = (estado?: string): string => {
  if (!estado) return 'N/A';
  const labels: Record<string, string> = {
    borrador: 'Borrador',
    triaje: 'Triaje',
    pendiente: 'Pendiente',
    en_atencion: 'En Atención',
    finalizada: 'Finalizada',
    interconsulta: 'Interconsulta'
  };
  return labels[estado] || estado;
};

const calcularEdad = (fechaNacimiento?: Date | string): number => {
  if (!fechaNacimiento) return 0;
  const fecha = new Date(fechaNacimiento);
  const hoy = new Date();
  let edad = hoy.getFullYear() - fecha.getFullYear();
  const mes = hoy.getMonth() - fecha.getMonth();
  if (mes < 0 || (mes === 0 && hoy.getDate() < fecha.getDate())) {
    edad--;
  }
  return edad;
};

// IA Helper Methods
const removeSuggestion = (codigo: string) => {
  // Remove suggestion from list
  // In a real implementation, you might want to update the form data
};

const handleTreatmentSuggested = (tratamiento: any) => {
  // Handle treatment suggestions from IA
  // In a real implementation, you might want to update the form data
  console.log('Tratamiento sugerido:', tratamiento);
};

const handleSuggestionRemoved = (tipo: string, contenido: string) => {
  // Handle removal of a suggestion
  console.log('Sugerencia eliminada:', tipo, contenido);
};

// Computed properties for IA integration
const cie10Options = computed(() => {
  // Combine manual options with IA suggestions
  const manualOptions = []; // Could load from a CIE-10 database
  
  // Add IA suggestions as options
  const iaOptions = iaSuggestions.value?.map(suggestion => ({
    title: `${suggestion.codigo}: ${suggestion.descripcion}`,
    value: suggestion.codigo
  })) || [];
  
  return [...manualOptions, ...iaOptions];
});

// Lifecycle
onMounted(() => {
  cargarConsulta();
  window.addEventListener('payment-required', (e: any) => {
    if (e.detail?.consultaId === route.params.id) {
      router.push('/payment/checkout?consulta=' + route.params.id);
    }
  });
});
</script>

<style scoped>
.consulta-content {
  max-width: 1000px;
  margin: 0 auto;
}

.cursor-pointer {
  cursor: pointer;
}

/* Estilos para impresión */
@media print {
  .workspace-toolbar,
  .workspace-sidebar,
  .workspace-tools {
    display: none !important;
  }

  .main-content {
    padding: 0 !important;
  }
}
</style>
