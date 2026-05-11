<!-- apps/web/src/components/document/Share.vue -->
<template>
  <v-dialog v-model="dialog" max-width="600px" persistent>
    <v-card>
      <v-card-title class="d-flex justify-space-between align-center">
        <span class="text-h5 font-weight-bold">
          <v-icon start color="primary">mdi-share-variant</v-icon>
          Compartir {{ tipoRecurso }}
        </span>
        <v-btn icon variant="text" @click="closeDialog">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-card-text class="pt-4">
        <!-- Información del recurso -->
        <v-alert
          v-if="recursoInfo"
          variant="tonal"
          color="info"
          class="mb-4"
        >
          <div class="text-subtitle-2 font-weight-bold">{{ recursoInfo.titulo }}</div>
          <div class="text-caption">{{ recursoInfo.subtitulo }}</div>
        </v-alert>

        <!-- Selector de doctor destinatario -->
        <v-autocomplete
          v-model="destinatarioId"
          :items="doctoresDisponibles"
          item-title="nombre"
          item-value="id"
          label="Doctor destinatario *"
          placeholder="Buscar doctor..."
          prepend-inner-icon="mdi-account-search"
          variant="outlined"
          density="comfortable"
          hide-details="auto"
          class="mb-4"
          :rules="[v => !!v || 'Debe seleccionar un doctor']"
          @search="buscarDoctores"
        >
          <template v-slot:item="{ props, item }">
            <v-list-item v-bind="props">
              <template v-slot:subtitle>
                {{ item.raw.especialidad || 'Especialidad no especificada' }}
              </template>
            </v-list-item>
          </template>
        </v-autocomplete>

        <!-- Motivo de compartición -->
        <v-textarea
          v-model="motivoComparticion"
          label="Motivo de compartición *"
          placeholder="Ej: Segunda opinión, referencia, continuidad de tratamiento..."
          prepend-inner-icon="mdi-text-box-edit"
          variant="outlined"
          density="comfortable"
          rows="3"
          counter="500"
          hide-details="auto"
          class="mb-4"
          :rules="[v => !!v || 'Debe especificar un motivo']"
        />

        <!-- Opciones avanzadas -->
        <v-expansion-panels variant="accordion" class="mb-4">
          <v-expansion-panel>
            <v-expansion-panel-title class="font-weight-medium">
              <v-icon start size="small">mdi-cog-outline</v-icon>
              Opciones avanzadas
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <!-- Incluir documentos (solo para consultas) -->
              <v-checkbox
                v-if="tipoRecurso === 'consulta'"
                v-model="incluirDocumentos"
                label="Incluir documentos adjuntos"
                hide-details
                class="mb-3"
              />

              <!-- Acceso temporal -->
              <v-checkbox
                v-model="temporal"
                label="Acceso temporal con fecha de expiración"
                hide-details
              />

              <!-- Fecha de expiración -->
              <v-menu
                v-if="temporal"
                v-model="menuFecha"
                :close-on-content-click="false"
                transition="scale-transition"
                offset-y
                min-width="290px"
              >
                <template v-slot:activator="{ props }">
                  <v-text-field
                    v-model="fechaExpiracionDisplay"
                    label="Fecha de expiración *"
                    prepend-inner-icon="mdi-calendar"
                    variant="outlined"
                    density="comfortable"
                    readonly
                    hide-details
                    class="mt-3"
                    v-bind="props"
                    :rules="temporal ? [v => !!v || 'Debe seleccionar una fecha'] : []"
                  />
                </template>
                <v-date-picker
                  v-model="fechaExpiracion"
                  locale="es"
                  :min="new Date().toISOString().substr(0, 10)"
                  @update:model-value="menuFecha = false"
                />
              </v-menu>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>

        <!-- Advertencia LOPDP -->
        <v-alert
          variant="outlined"
          border="start"
          type="warning"
          density="compact"
          class="mb-2"
        >
          <div class="text-caption">
            <strong>Requisito LOPDP:</strong> Solo puede compartir este recurso si el doctor
            destinatario tiene autorización explícita del paciente (conexión activa).
          </div>
        </v-alert>
      </v-card-text>

      <v-card-actions class="pt-0">
        <v-spacer />
        <v-btn
          variant="text"
          @click="closeDialog"
          :disabled="loading"
        >
          Cancelar
        </v-btn>
        <v-btn
          color="primary"
          variant="elevated"
          @click="handleCompartir"
          :loading="loading"
        >
          <v-icon start>mdi-share-variant</v-icon>
          Compartir
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { apiClient } from '@/services/api';
import { useToast } from 'vue-toastification';

interface Props {
  modelValue: boolean;
  tipo: 'documento' | 'consulta';
  recursoId: string;
  recursoInfo?: {
    titulo: string;
    subtitulo: string;
  };
}

interface Doctor {
  id: string;
  nombre: string;
  especialidad?: string;
  email?: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'compartido', data: any): void;
}>();

const toast = useToast();

// Estado local
const dialog = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

const destinatarioId = ref<string | null>(null);
const motivoComparticion = ref('');
const incluirDocumentos = ref(true);
const temporal = ref(false);
const fechaExpiracion = ref<string | null>(null);
const menuFecha = ref(false);
const doctoresDisponibles = ref<Doctor[]>([]);
const loading = ref(false);

const tipoRecurso = computed(() => props.tipo);

const fechaExpiracionDisplay = computed({
  get: () => {
    if (!fechaExpiracion.value) return '';
    const date = new Date(fechaExpiracion.value);
    return date.toLocaleDateString('es-EC', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  },
  set: (value) => {
    fechaExpiracion.value = value;
  }
});

// Buscar doctores
const buscarDoctores = async (search: string) => {
  if (!search || search.length < 2) {
    doctoresDisponibles.value = [];
    return;
  }

  try {
    const response = await apiClient.get<Doctor[]>(
      `/api/v1/specialties?search=${encodeURIComponent(search)}`
    );

    if (response.success && response.data) {
      doctoresDisponibles.value = response.data;
    }
  } catch (error) {
    console.error('Error buscando doctores:', error);
  }
};

// Manejar compartición
const handleCompartir = async () => {
  // Validaciones
  if (!destinatarioId.value) {
    toast.error('Debe seleccionar un doctor destinatario');
    return;
  }

  if (!motivoComparticion.value.trim()) {
    toast.error('Debe especificar un motivo de compartición');
    return;
  }

  if (temporal.value && !fechaExpiracion.value) {
    toast.error('Debe seleccionar una fecha de expiración');
    return;
  }

  loading.value = true;

  try {
    const endpoint = props.tipo === 'documento'
      ? '/api/v1/share/documento'
      : '/api/v1/share/consulta';

    const payload: any = {
      [props.tipo === 'documento' ? 'documentoId' : 'consultaId']: props.recursoId,
      destinatarioId: destinatarioId.value,
      motivoComparticion: motivoComparticion.value.trim(),
      temporal: temporal.value,
      fechaExpiracion: temporal.value ? fechaExpiracion.value : undefined
    };

    if (props.tipo === 'consulta') {
      payload.incluirDocumentos = incluirDocumentos.value;
    }

    const response = await apiClient.post(endpoint, payload);

    if (response.success) {
      toast.success(`${tipoRecurso.value} compartido exitosamente`);
      emit('compartido', response.data);
      closeDialog();
    } else {
      throw new Error(response.error || 'Error al compartir');
    }
  } catch (error: any) {
    console.error('Error al compartir:', error);

    if (error.response?.status === 403) {
      toast.warning(
        'El doctor destinatario no tiene autorización del paciente. ' +
        'Primero debe establecer una conexión.'
      );
    } else {
      toast.error(error.message || 'Error al compartir recurso');
    }
  } finally {
    loading.value = false;
  }
};

// Cerrar dialog
const closeDialog = () => {
  dialog.value = false;
  resetForm();
};

// Resetear formulario
const resetForm = () => {
  destinatarioId.value = null;
  motivoComparticion.value = '';
  incluirDocumentos.value = true;
  temporal.value = false;
  fechaExpiracion.value = null;
  doctoresDisponibles.value = [];
};

// Watch para resetear cuando se abre/cierra
watch(dialog, (newVal) => {
  if (!newVal) {
    resetForm();
  }
});
</script>
