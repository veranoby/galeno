<template>
  <v-card class="firma-electronica-card" elevation="2">
    <v-card-title class="d-flex align-center py-4 bg-primary text-white">
      <v-icon icon="mdi-certificate-outline" size="large" class="mr-3" />
      <span class="text-h6">Firma Electrónica XAdES-BES</span>
    </v-card-title>

    <v-card-subtitle class="pt-4">
      Firma electrónica avanzada compatible con SRI Ecuador
    </v-card-subtitle>

    <v-card-text class="pt-4">
      <!-- Security Notice -->
      <v-alert
        type="info"
        variant="tonal"
        class="mb-4"
        density="compact"
        border="start"
      >
        <template v-slot:prepend>
          <v-icon>mdi-shield-lock-outline</v-icon>
        </template>
        <div class="text-caption">
          <strong>SEGURIDAD:</strong> Su clave privada NUNCA sale de este dispositivo.
          Toda la operación criptográfica se realiza localmente en su navegador
          utilizando WebCrypto API.
        </div>
      </v-alert>

      <!-- Certificate Loading Section -->
      <div v-if="!certificadoCargado" class="certificado-section">
        <div class="text-subtitle-2 mb-3 font-weight-medium">
          Paso 1: Cargar Certificado Digital (.p12)
        </div>

        <v-file-input
          v-model="archivoCertificado"
          label="Seleccione su archivo .p12 o .pfx"
          accept=".p12,.pfx"
          prepend-icon="mdi-file-key-outline"
          variant="outlined"
          density="compact"
          :disabled="certificadoCargado"
          :hint="certificadoCargado ? 'Certificado cargado exitosamente' : ''"
          persistent-hint
          @update:model-value="onArchivoSeleccionado"
        >
          <template v-slot:append-inner>
            <v-tooltip location="top">
              <template v-slot:activator="{ props }">
                <v-icon v-bind="props">mdi-help-circle-outline</v-icon>
              </template>
              <div>
                <div>Certificado digital emitido por:</div>
                <div>• Security Data Ecuador</div>
                <div>• BCEE (Banco Central)</div>
                <div>• Anf AC</div>
              </div>
            </v-tooltip>
          </template>
        </v-file-input>

        <v-text-field
          v-model="passwordCertificado"
          :type="mostrarPassword ? 'text' : 'password'"
          label="Contraseña del certificado"
          prepend-icon="mdi-lock-outline"
          :append-inner-icon="mostrarPassword ? 'mdi-eye-off' : 'mdi-eye'"
          variant="outlined"
          density="compact"
          class="mt-2"
          :disabled="!archivoCertificado || certificadoCargado"
          @click:append-inner="mostrarPassword = !mostrarPassword"
          @keyup.enter="cargarCertificadoHandler"
        />

        <v-btn
          color="primary"
          variant="elevated"
          block
          :loading="cargando"
          :disabled="!archivoCertificado || !passwordCertificado || certificadoCargado"
          class="mt-2"
          @click="cargarCertificadoHandler"
        >
          <v-icon start>mdi-lock-open-outline</v-icon>
          Cargar Certificado
        </v-btn>

        <v-alert
          v-if="error"
          type="error"
          variant="tonal"
          class="mt-4"
          density="compact"
          closable
          @click:close="limpiarError"
        >
          <v-icon start>mdi-alert-circle</v-icon>
          {{ error }}
        </v-alert>
      </div>

      <!-- Certificate Loaded Section -->
      <div v-else class="certificado-cargado-section">
        <v-alert
          type="success"
          variant="tonal"
          class="mb-4"
          density="compact"
          border="start"
        >
          <template v-slot:prepend>
            <v-icon>mdi-check-circle</v-icon>
          </template>
          <div>
            <strong>Certificado cargado correctamente</strong>
          </div>
          <div class="text-caption mt-1">
            Firmante: <strong>{{ nombreFirmante }}</strong>
          </div>
          <div v-if="certificadoInfo" class="text-caption">
            Válido hasta: {{ formatDate(certificadoInfo.validTo) }}
          </div>
        </v-alert>

        <v-alert
          v-if="!certificadoVigente"
          type="warning"
          variant="tonal"
          class="mb-4"
          density="compact"
        >
          <v-icon start>mdi-alert</v-icon>
          Su certificado está vencido o próximo a vencer. Considere renovarlo.
        </v-alert>

        <!-- Certificate Details -->
        <v-expansion-panels variant="accordion" class="mb-4">
          <v-expansion-panel>
            <v-expansion-panel-title>
              <v-icon start>mdi-certificate</v-icon>
              Detalles del Certificado
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <v-list density="compact" variant="outlined">
                <v-list-item v-if="certificadoInfo">
                  <v-list-item-title>Titular (CN)</v-list-item-title>
                  <v-list-item-subtitle>{{ certificadoInfo.cn }}</v-list-item-subtitle>
                </v-list-item>
                <v-list-item v-if="certificadoInfo?.email">
                  <v-list-item-title>Email</v-list-item-title>
                  <v-list-item-subtitle>{{ certificadoInfo.email }}</v-list-item-subtitle>
                </v-list-item>
                <v-list-item v-if="certificadoInfo?.cedula">
                  <v-list-item-title>Cédula</v-list-item-title>
                  <v-list-item-subtitle>{{ formatCedula(certificadoInfo.cedula) }}</v-list-item-subtitle>
                </v-list-item>
                <v-list-item v-if="certificadoInfo">
                  <v-list-item-title>Emisor</v-list-item-title>
                  <v-list-item-subtitle class="text-caption">{{ certificadoInfo.issuer }}</v-list-item-subtitle>
                </v-list-item>
                <v-list-item v-if="certificadoInfo">
                  <v-list-item-title>Válido desde</v-list-item-title>
                  <v-list-item-subtitle>{{ formatDate(certificadoInfo.validFrom) }}</v-list-item-subtitle>
                </v-list-item>
                <v-list-item v-if="certificadoInfo">
                  <v-list-item-title>Válido hasta</v-list-item-title>
                  <v-list-item-subtitle>{{ formatDate(certificadoInfo.validTo) }}</v-list-item-subtitle>
                </v-list-item>
                <v-list-item v-if="certificadoInfo">
                  <v-list-item-title>Número de Serie</v-list-item-title>
                  <v-list-item-subtitle class="font-mono">{{ certificadoInfo.serialNumber }}</v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>

        <v-divider class="my-4" />

        <!-- Actions -->
        <v-btn
          color="error"
          variant="tonal"
          block
          @click="limpiarCertificado"
        >
          <v-icon start>mdi-delete-outline</v-icon>
          Cargar otro certificado
        </v-btn>
      </div>
    </v-card-text>

    <!-- Card Actions -->
    <v-card-actions v-if="showActions" class="pa-4 pt-0">
      <v-spacer />
      <slot name="actions" :certificado-cargado="certificadoCargado" />
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import useFirmaElectronica, {
  type CertificadoInfo
} from '@/composables/useFirmaElectronica';

// Props
interface Props {
  showActions?: boolean;
}

withDefaults(defineProps<Props>(), {
  showActions: false
});

// Emits
const emit = defineEmits<{
  certificadoCargado: [info: CertificadoInfo];
  certificadoEliminado: [];
  error: [mensaje: string];
}>();

// Composable
const {
  certificadoCargado,
  certificadoInfo,
  cargando,
  error,
  nombreFirmante,
  certificadoVigente,
  cargarCertificado,
  limpiarMemoria
} = useFirmaElectronica();

// State
const archivoCertificado = ref<File | null>(null);
const passwordCertificado = ref('');
const mostrarPassword = ref(false);

// Methods
const onArchivoSeleccionado = (files: File | File[] | null) => {
  const archivo = Array.isArray(files) ? files[0] : files;
  if (archivo) {
    // Limpiar password anterior
    passwordCertificado.value = '';
  }
};

const cargarCertificadoHandler = async () => {
  if (!archivoCertificado.value || !passwordCertificado.value) {
    return;
  }

  try {
    const info = await cargarCertificado(
      archivoCertificado.value,
      passwordCertificado.value
    );

    // Limpiar password de memoria
    passwordCertificado.value = '';
    mostrarPassword.value = false;

    emit('certificadoCargado', info);
  } catch (e) {
    console.error('Error al cargar certificado:', e);
    const mensaje = e instanceof Error ? e.message : 'Error al cargar certificado';
    emit('error', mensaje);
  }
};

const limpiarCertificado = () => {
  archivoCertificado.value = null;
  passwordCertificado.value = '';
  mostrarPassword.value = false;
  limpiarMemoria();
  emit('certificadoEliminado');
};

const limpiarError = () => {
  // El error se maneja en el composable
};

// Formatting helpers
const formatDate = (date: Date): string => {
  return new Date(date).toLocaleDateString('es-EC', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const formatCedula = (cedula: string): string => {
  // Formatear cédula ecuatoriana: 1712345678 -> 171234567-8
  if (cedula.length !== 10) return cedula;
  return `${cedula.slice(0, 9)}-${cedula.slice(9)}`;
};

// Expose methods for parent component access
defineExpose({
  limpiarCertificado
});
</script>

<style scoped>
.firma-electronica-card {
  max-width: 700px;
  margin: 0 auto;
}

.certificado-section,
.certificado-cargado-section {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.font-mono {
  font-family: 'Courier New', Courier, monospace;
}
</style>
