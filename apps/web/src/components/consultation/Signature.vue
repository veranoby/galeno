<template>
  <div class="consulta-signature">
    <!-- Badge de estado de firma -->
    <v-chip
      v-if="consulta.firmado"
      color="success"
      variant="elevated"
      size="small"
      class="mb-2"
    >
      <v-icon start>mdi-check-circle</v-icon>
      Firmada electrónicamente
    </v-chip>

    <v-chip
      v-else-if="puedeFirmar"
      color="info"
      variant="outlined"
      size="small"
      class="mb-2"
    >
      <v-icon start>mdi-draw-pen</v-icon>
      Lista para firmar
    </v-chip>

    <v-chip
      v-else
      color="grey"
      variant="outlined"
      size="small"
      class="mb-2"
    >
      <v-icon start>mdi-pencil-off</v-icon>
      No disponible para firma
    </v-chip>

    <!-- Detalles de firma si esta firmada -->
    <v-card
      v-if="consulta.firmado && firmaHistorial"
      variant="outlined"
      class="mt-2"
    >
      <v-card-title class="text-subtitle-2 py-2 bg-grey-lighten-5">
        <v-icon icon="mdi-certificate" size="small" start />
        Detalles de Firma
      </v-card-title>
      <v-card-text class="pt-2">
        <v-list density="compact">
          <v-list-item>
            <v-list-item-title>Firmante</v-list-item-title>
            <v-list-item-subtitle>{{ firmaHistorial.certificado?.cn }}</v-list-item-subtitle>
          </v-list-item>
          <v-list-item>
            <v-list-item-title>Cédula</v-list-item-title>
            <v-list-item-subtitle>{{ formatCedula(firmaHistorial.certificado?.cedula) }}</v-list-item-subtitle>
          </v-list-item>
          <v-list-item>
            <v-list-item-title>Fecha de firma</v-list-item-title>
            <v-list-item-subtitle>{{ formatDateTime(firmaHistorial.fechaFirma) }}</v-list-item-subtitle>
          </v-list-item>
          <v-list-item v-if="firmaHistorial.certificado?.issuer">
            <v-list-item-title>Emisor del certificado</v-list-item-title>
            <v-list-item-subtitle class="text-caption">{{ firmaHistorial.certificado.issuer }}</v-list-item-subtitle>
          </v-list-item>
        </v-list>
      </v-card-text>
      <v-card-actions>
        <v-btn
          variant="tonal"
          size="small"
          :loading="descargandoXml"
          @click="descargarXml"
        >
          <v-icon start>mdi-download</v-icon>
          Descargar XML
        </v-btn>
      </v-card-actions>
    </v-card>

    <!-- Boton de firmar si esta disponible -->
    <v-btn
      v-if="!consulta.firmado && puedeFirmar"
      color="success"
      variant="elevated"
      block
      :loading="firmado"
      @click="iniciarFirma"
    >
      <v-icon start>mdi-draw-pen</v-icon>
      Firmar Consulta
    </v-btn>

    <!-- Aviso de bloqueo si esta firmada -->
    <v-alert
      v-if="consulta.firmado"
      type="warning"
      variant="tonal"
      density="compact"
      class="mt-2"
      border="start"
    >
      <template v-slot:prepend>
        <v-icon>mdi-lock</v-icon>
      </template>
      <div class="text-caption">
        Esta consulta está <strong>firmada electrónicamente</strong> y no puede modificarse.
        La firma tiene validez legal conforme a la Ley de Comercio Electrónico del Ecuador.
      </div>
    </v-alert>

    <!-- Aviso de no disponible -->
    <v-alert
      v-if="!consulta.firmado && !puedeFirmar && !revisandoPermiso"
      type="info"
      variant="tonal"
      density="compact"
      class="mt-2"
    >
      <template v-slot:prepend>
        <v-icon>mdi-information</v-icon>
      </template>
      <div class="text-caption">
        Solo se pueden firmar consultas en estado <strong>Finalizada</strong> o <strong>Interconsulta</strong>.
        Complete la atención al paciente antes de firmar.
      </div>
    </v-alert>

    <!-- Dialogo de firma -->
    <FirmaDialog
      v-model="dialogoFirmaAbierto"
      :datos-consulta="datosConsultaParaFirmar"
      @firma-completada="onFirmaCompletada"
      @cancelada="onFirmaCancelada"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { DatosConsulta } from '@/composables/useFirmaElectronica';
import FirmaDialog from '@/views/consultas/components/FirmaDialog.vue';
import { apiClient } from '@/services/api';

// Props
interface Props {
  consulta: {
    id: string;
    firmado: boolean;
    estado: string;
    pacienteId?: string;
    paciente?: {
      id: string;
      nombre: string;
      cedula: string;
    };
    doctor?: {
      id: string;
      nombre: string;
    };
    fecha?: Date | string;
    motivoConsulta?: string;
    diagnostico?: string;
  };
}

const props = defineProps<Props>();

// Emits
const emit = defineEmits<{
  'firma-completada': [consulta: any];
  'firma-error': [error: string];
}>();

// State
const puedeFirmar = ref(false);
const revisandoPermiso = ref(false);
const dialogoFirmaAbierto = ref(false);
const firmado = ref(false);
const descargandoXml = ref(false);
const firmaHistorial = ref<{
  firmada: boolean;
  fechaFirma?: Date;
  certificado?: {
    cn: string;
    cedula: string;
    issuer: string;
    validFrom: Date;
    validTo: Date;
    serialNumber: string;
    email?: string;
  };
} | null>(null);

// Computed
const datosConsultaParaFirmar = computed<DatosConsulta | undefined>(() => {
  if (!puedeFirmar.value || !props.consulta) return undefined;

  return {
    id: props.consulta.id,
    pacienteId: props.consulta.pacienteId || '',
    pacienteNombre: props.consulta.paciente?.nombre || '',
    pacienteCedula: props.consulta.paciente?.cedula || '',
    doctorNombre: props.consulta.doctor?.nombre || '',
    motivoConsulta: props.consulta.motivoConsulta,
    diagnostico: props.consulta.diagnostico,
    fecha: props.consulta.fecha ? new Date(props.consulta.fecha) : new Date()
  };
});

// Methods
const revisarPuedeFirmar = async () => {
  if (!props.consulta?.id) return;

  revisandoPermiso.value = true;
  try {
    const response = await apiClient.get<{ puedeFirmar: boolean }>(`/api/consultas/${props.consulta.id}/puede-firmar`);
    puedeFirmar.value = response.data?.puedeFirmar ?? false;
  } catch (e) {
    console.error('Error al verificar si puede firmar:', e);
    puedeFirmar.value = false;
  } finally {
    revisandoPermiso.value = false;
  }
};

const cargarHistorialFirma = async () => {
  if (!props.consulta?.id) return;

  try {
    const response = await apiClient.get<any>(`/api/consultas/${props.consulta.id}/firma/historial`);
    firmaHistorial.value = response.data ?? [];
  } catch (e) {
    console.error('Error al cargar historial de firma:', e);
  }
};

const iniciarFirma = () => {
  dialogoFirmaAbierto.value = true;
};

const onFirmaCompletada = (resultado: any, consultaId: string) => {
  firmado.value = false;
  dialogoFirmaAbierto.value = false;

  // Recargar datos
  emit('firma-completada', { consultaId, resultado });

  // Actualizar estado local
  setTimeout(() => {
    revisarPuedeFirmar();
    cargarHistorialFirma();
  }, 500);
};

const onFirmaCancelada = () => {
  dialogoFirmaAbierto.value = false;
};

const descargarXml = async () => {
  if (!props.consulta?.id) return;

  descargandoXml.value = true;
  try {
    const apiURL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    const response = await fetch(`${apiURL}/api/consultas/${props.consulta.id}/firma/xml`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
      }
    });

    if (!response.ok) throw new Error('Error al descargar XML');

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `consulta-${props.consulta.id}-firma.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error('Error al descargar XML:', e);
    emit('firma-error', 'Error al descargar el XML de firma');
  } finally {
    descargandoXml.value = false;
  }
};

// Helpers
const formatCedula = (cedula?: string): string => {
  if (!cedula) return '-';
  if (cedula.length !== 10) return cedula;
  return `${cedula.slice(0, 9)}-${cedula.slice(9)}`;
};

const formatDateTime = (date?: Date | string | null): string => {
  if (!date) return '-';
  return new Date(date).toLocaleString('es-EC', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Lifecycle
onMounted(() => {
  revisarPuedeFirmar();
  cargarHistorialFirma();
});
</script>

<style scoped>
.consulta-signature {
  width: 100%;
}
</style>
