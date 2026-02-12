<template>
  <v-dialog
    v-model="dialogAbierto"
    :persistent="!firmaExitosa"
    max-width="900"
    @click:outside="intentarCerrar"
  >
    <v-card class="firma-dialog-card">
      <!-- Header -->
      <v-toolbar color="primary" density="comfortable">
        <v-icon icon="mdi-file-signature" start />
        <v-toolbar-title class="text-white">
          Firma de Consulta Médica
        </v-toolbar-title>
        <v-spacer />
        <v-btn
          icon="mdi-close"
          variant="text"
          @click="intentarCerrar"
        />
      </v-toolbar>

      <v-card-text class="pa-6">
        <!-- Step Indicator -->
        <v-stepper v-model="pasoActual" :items="pasos" class="elevation-0 bg-transparent">
          <!-- Step 1: Load Certificate -->
          <template v-slot:item.1>
            <div class="step-content">
              <div class="text-subtitle-1 mb-4 font-weight-medium">
                Paso 1: Cargue su Certificado Digital
              </div>

              <!-- FirmaElectronica Component -->
              <FirmaElectronica
                @certificado-cargado="onCertificadoCargado"
                @error="onErrorCertificado"
              />
            </div>
          </template>

          <!-- Step 2: Preview Document -->
          <template v-slot:item.2>
            <div class="step-content">
              <div class="text-subtitle-1 mb-4 font-weight-medium">
                Paso 2: Revise el Documento a Firmar
              </div>

              <v-alert
                type="info"
                variant="tonal"
                class="mb-4"
                density="compact"
                border="start"
              >
                <template v-slot:prepend>
                  <v-icon>mdi-information</v-icon>
                </template>
                <div class="text-caption">
                  Revise cuidadosamente el contenido de la consulta antes de firmar.
                  La firma electrónica tiene validez legal.
                </div>
              </v-alert>

              <!-- Consulta Details -->
              <v-card variant="outlined" class="mb-4">
                <v-card-title class="text-subtitle-2 bg-grey-lighten-4">
                  <v-icon icon="mdi-file-document-outline" size="small" start />
                  Datos de la Consulta
                </v-card-title>
                <v-card-text>
                  <v-list density="compact">
                    <v-list-item>
                      <template v-slot:prepend>
                        <v-icon>mdi-pound</v-icon>
                      </template>
                      <v-list-item-title>ID de Consulta</v-list-item-title>
                      <v-list-item-subtitle>{{ datosConsulta?.id }}</v-list-item-subtitle>
                    </v-list-item>
                    <v-list-item>
                      <template v-slot:prepend>
                        <v-icon>mdi-calendar</v-icon>
                      </template>
                      <v-list-item-title>Fecha</v-list-item-title>
                      <v-list-item-subtitle>{{ formatFecha(datosConsulta?.fecha) }}</v-list-item-subtitle>
                    </v-list-item>
                    <v-list-item>
                      <template v-slot:prepend>
                        <v-icon>mdi-account</v-icon>
                      </template>
                      <v-list-item-title>Paciente</v-list-item-title>
                      <v-list-item-subtitle>{{ datosConsulta?.pacienteNombre }}</v-list-item-subtitle>
                    </v-list-item>
                    <v-list-item>
                      <template v-slot:prepend>
                        <v-icon>mdi-identifier</v-icon>
                      </template>
                      <v-list-item-title>Identificación</v-list-item-title>
                      <v-list-item-subtitle>{{ formatCedula(datosConsulta?.pacienteCedula) }}</v-list-item-subtitle>
                    </v-list-item>
                    <v-list-item>
                      <template v-slot:prepend>
                        <v-icon>mdi-stethoscope</v-icon>
                      </template>
                      <v-list-item-title>Motivo</v-list-item-title>
                      <v-list-item-subtitle>{{ datosConsulta?.motivoConsulta || 'No especificado' }}</v-list-item-subtitle>
                    </v-list-item>
                    <v-list-item v-if="datosConsulta?.diagnostico">
                      <template v-slot:prepend>
                        <v-icon>mdi-doctor</v-icon>
                      </template>
                      <v-list-item-title>Diagnóstico</v-list-item-title>
                      <v-list-item-subtitle>{{ datosConsulta.diagnostico }}</v-list-item-subtitle>
                    </v-list-item>
                  </v-list>
                </v-card-text>
              </v-card>

              <!-- Doctor Signature Notice -->
              <v-alert
                type="success"
                variant="tonal"
                class="mb-4"
                density="compact"
              >
                <template v-slot:prepend>
                  <v-icon>mdi-check-circle</v-icon>
                </template>
                <div>
                  <strong>Certificado listo:</strong>
                  {{ nombreFirmante }}
                </div>
              </v-alert>

              <!-- Navigation -->
              <v-row class="mt-4">
                <v-col cols="6">
                  <v-btn
                    variant="tonal"
                    block
                    @click="pasoActual = 1"
                  >
                    <v-icon start>mdi-arrow-left</v-icon>
                    Atrás
                  </v-btn>
                </v-col>
                <v-col cols="6">
                  <v-btn
                    color="primary"
                    variant="elevated"
                    block
                    @click="pasoActual = 3"
                  >
                    Continuar
                    <v-icon end>mdi-arrow-right</v-icon>
                  </v-btn>
                </v-col>
              </v-row>
            </div>
          </template>

          <!-- Step 3: Sign -->
          <template v-slot:item.3>
            <div class="step-content">
              <div class="text-subtitle-1 mb-4 font-weight-medium">
                Paso 3: Firma de Documento
              </div>

              <v-alert
                v-if="!resultadoFirma"
                type="warning"
                variant="tonal"
                class="mb-4"
                density="compact"
                border="start"
              >
                <template v-slot:prepend>
                  <v-icon>mdi-gavel</v-icon>
                </template>
                <div class="text-caption">
                  <strong>ATENCIÓN LEGAL:</strong> Al hacer clic en "Firmar Documento",
                  usted está aplicando su firma digital válida legalmente conforme a la
                  Ley de Comercio Electrónico del Ecuador. Asegúrese de haber revisado
                  el contenido del documento.
                </div>
              </v-alert>

              <!-- Sign Button -->
              <v-btn
                v-if="!resultadoFirma"
                color="success"
                variant="elevated"
                size="large"
                block
                :loading="cargando"
                :disabled="!listoParaFirmar"
                class="mb-4"
                @click="firmarDocumento"
              >
                <v-icon start>mdi-draw-pen</v-icon>
                Firmar Documento
              </v-btn>

              <!-- Result Section -->
              <div v-if="resultadoFirma" class="resultado-section">
                <v-alert
                  type="success"
                  variant="tonal"
                  class="mb-4"
                  density="compact"
                >
                  <template v-slot:prepend>
                    <v-icon>mdi-check-circle-outline</v-icon>
                  </template>
                  <div>
                    <strong>¡Documento firmado exitosamente!</strong>
                  </div>
                  <div class="text-caption mt-1">
                    Fecha: {{ formatDateTime(resultadoFirma.timestamp) }}
                  </div>
                </v-alert>

                <!-- Signature Details -->
                <v-expansion-panels variant="accordion" class="mb-4">
                  <v-expansion-panel>
                    <v-expansion-panel-title>
                      <v-icon start>mdi-code-braces</v-icon>
                      XML Firmado
                    </v-expansion-panel-title>
                    <v-expansion-panel-text>
                      <v-textarea
                        :model-value="formatXmlPreview(resultadoFirma.xmlFirmado)"
                        readonly
                        variant="outlined"
                        density="compact"
                        rows="8"
                        class="font-mono text-caption mb-2"
                      />
                      <v-btn
                        color="primary"
                        variant="tonal"
                        size="small"
                        @click="descargarXmlFirmado"
                      >
                        <v-icon start>mdi-download</v-icon>
                        Descargar XML
                      </v-btn>
                    </v-expansion-panel-text>
                  </v-expansion-panel>

                  <v-expansion-panel>
                    <v-expansion-panel-title>
                      <v-icon start>mdi-fingerprint</v-icon>
                      Detalles de la Firma
                    </v-expansion-panel-title>
                    <v-expansion-panel-text>
                      <v-list density="compact">
                        <v-list-item>
                          <v-list-item-title>Firmante</v-list-item-title>
                          <v-list-item-subtitle>{{ resultadoFirma.firmante }}</v-list-item-subtitle>
                        </v-list-item>
                        <v-list-item>
                          <v-list-item-title>Algoritmo</v-list-item-title>
                          <v-list-item-subtitle>RSA-SHA256 (XAdES-BES)</v-list-item-subtitle>
                        </v-list-item>
                        <v-list-item>
                          <v-list-item-title>Timestamp</v-list-item-title>
                          <v-list-item-subtitle>{{ formatDateTime(resultadoFirma.timestamp) }}</v-list-item-subtitle>
                        </v-list-item>
                        <v-list-item>
                          <v-list-item-title>Tamaño Firma</v-list-item-title>
                          <v-list-item-subtitle>{{ resultadoFirma.firmaBase64.length }} caracteres</v-list-item-subtitle>
                        </v-list-item>
                      </v-list>
                    </v-expansion-panel-text>
                  </v-expansion-panel>

                  <v-expansion-panel>
                    <v-expansion-panel-title>
                      <v-icon start>mdi-certificate</v-icon>
                      Certificado Digital
                    </v-expansion-panel-title>
                    <v-expansion-panel-text>
                      <v-list density="compact">
                        <v-list-item>
                          <v-list-item-title>Emisor</v-list-item-title>
                          <v-list-item-subtitle v-if="certificadoInfo">{{ certificadoInfo.issuer }}</v-list-item-subtitle>
                        </v-list-item>
                        <v-list-item>
                          <v-list-item-title>Número de Serie</v-list-item-title>
                          <v-list-item-subtitle v-if="certificadoInfo" class="font-mono">{{ certificadoInfo.serialNumber }}</v-list-item-subtitle>
                        </v-list-item>
                        <v-list-item>
                          <v-list-item-title>Válido hasta</v-list-item-title>
                          <v-list-item-subtitle v-if="certificadoInfo">{{ formatFecha(certificadoInfo.validTo) }}</v-list-item-subtitle>
                        </v-list-item>
                      </v-list>
                    </v-expansion-panel-text>
                  </v-expansion-panel>
                </v-expansion-panels>

                <!-- Server Validation -->
                <v-divider class="my-4" />
                <div class="d-flex align-center justify-space-between mb-2">
                  <span class="text-subtitle-2">Validar Firma en Servidor</span>
                  <v-chip
                    v-if="validacionRealizada"
                    :color="resultadoValidacion?.valido ? 'success' : 'error'"
                    size="small"
                    variant="tonal"
                  >
                    {{ resultadoValidacion?.valido ? 'Válida' : 'Inválida' }}
                  </v-chip>
                </div>

                <v-btn
                  v-if="!validacionRealizada"
                  color="info"
                  variant="tonal"
                  block
                  :loading="validando"
                  @click="validarFirma"
                >
                  <v-icon start>mdi-check-decagram</v-icon>
                  Validar Firma
                </v-btn>

                <!-- Validation Result -->
                <div v-if="resultadoValidacion" class="mt-3">
                  <v-alert
                    :type="resultadoValidacion.valido ? 'success' : 'error'"
                    variant="tonal"
                    density="compact"
                  >
                    <template v-slot:prepend>
                      <v-icon>{{ resultadoValidacion.valido ? 'mdi-check-circle' : 'mdi-alert-circle' }}</v-icon>
                    </template>
                    <div class="text-caption">
                      <strong>{{ resultadoValidacion.valido ? 'Firma Válida' : 'Firma Inválida' }}</strong>
                    </div>
                    <div class="text-caption">{{ resultadoValidacion.mensaje }}</div>
                    <div v-if="resultadoValidacion.firmante" class="text-caption">
                      Firmante: {{ resultadoValidacion.firmante }}
                    </div>
                  </v-alert>
                </div>
              </div>

              <!-- Navigation -->
              <v-row class="mt-4" v-if="!resultadoFirma">
                <v-col cols="6">
                  <v-btn
                    variant="tonal"
                    block
                    @click="pasoActual = 2"
                  >
                    <v-icon start>mdi-arrow-left</v-icon>
                    Atrás
                  </v-btn>
                </v-col>
                <v-col cols="6">
                  <v-btn
                    color="grey"
                    variant="tonal"
                    block
                    @click="cancelar"
                  >
                    Cancelar
                  </v-btn>
                </v-col>
              </v-row>
            </div>
          </template>
        </v-stepper>
      </v-card-text>

      <!-- Footer Actions -->
      <v-card-actions v-if="firmaExitosa" class="pa-4 pt-0">
        <v-spacer />
        <v-btn
          color="success"
          variant="elevated"
          @click="confirmarFirma"
        >
          <v-icon start>mdi-check</v-icon>
          Confirmar y Guardar
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import FirmaElectronica from '@/components/firma/FirmaElectronica.vue';
import useFirmaElectronica, {
  type DatosConsulta,
  type ResultadoFirma,
  type ResultadoValidacion,
  type CertificadoInfo
} from '@/composables/useFirmaElectronica';

// Props
interface Props {
  modelValue: boolean;
  datosConsulta?: DatosConsulta;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  datosConsulta: undefined
});

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'firma-completada': [resultado: ResultadoFirma, consultaId: string];
  cancelada: [];
}>();

// Composable for signing operations (separate from certificate loading)
const {
  cargando: firmando,
  error: errorFirma,
  listoParaFirmar,
  nombreFirmante,
  certificadoInfo,
  firmarConsulta,
  validarFirmaServidor,
  limpiarMemoria: limpiarMemoriaComposable
} = useFirmaElectronica();

// State
const dialogAbierto = ref(false);
const pasoActual = ref(1);
const pasos = ['Certificado', 'Revisar', 'Firmar'];
const resultadoFirma = ref<ResultadoFirma | null>(null);
const validando = ref(false);
const resultadoValidacion = ref<ResultadoValidacion | null>(null);
const validacionRealizada = ref(false);

// Computed
const firmaExitosa = computed(() => resultadoFirma.value !== null);
const cargando = computed(() => firmando.value || validando.value);

// Watch for model value changes
watch(() => props.modelValue, (nuevoValor) => {
  dialogAbierto.value = nuevoValor;
  if (nuevoValor) {
    resetearDialog();
  }
});

watch(dialogAbierto, (nuevoValor) => {
  emit('update:modelValue', nuevoValor);
});

// Methods
const resetearDialog = () => {
  pasoActual.value = 1;
  resultadoFirma.value = null;
  resultadoValidacion.value = null;
  validacionRealizada.value = false;
};

const onCertificadoCargado = (info: CertificadoInfo) => {
  console.log('Certificado cargado:', info.cn);
  pasoActual.value = 2;
};

const onErrorCertificado = (mensaje: string) => {
  console.error('Error al cargar certificado:', mensaje);
};

const firmarDocumento = async () => {
  if (!props.datosConsulta) {
    console.error('No hay datos de consulta para firmar');
    return;
  }

  try {
    resultadoFirma.value = await firmarConsulta(props.datosConsulta);
    pasoActual.value = 3;
  } catch (e) {
    console.error('Error al firmar documento:', e);
  }
};

const validarFirma = async () => {
  if (!resultadoFirma.value) return;

  validando.value = true;
  try {
    resultadoValidacion.value = await validarFirmaServidor(resultadoFirma.value.xmlFirmado);
    validacionRealizada.value = true;
  } catch (e) {
    console.error('Error al validar firma:', e);
    resultadoValidacion.value = {
      valido: false,
      mensaje: 'Error al validar la firma en el servidor'
    };
    validacionRealizada.value = true;
  } finally {
    validando.value = false;
  }
};

const confirmarFirma = () => {
  if (resultadoFirma.value && props.datosConsulta) {
    emit('firma-completada', resultadoFirma.value, props.datosConsulta.id);
    dialogAbierto.value = false;
    limpiarMemoria();
  }
};

const cancelar = () => {
  emit('cancelada');
  dialogAbierto.value = false;
  limpiarMemoria();
};

const intentarCerrar = () => {
  if (firmaExitosa.value) {
    // Allow closing after successful signature
    dialogAbierto.value = false;
    limpiarMemoria();
  } else {
    // Prevent closing during process
    console.log('Complete el proceso de firma o cancele explícitamente');
  }
};

const limpiarMemoria = () => {
  limpiarMemoriaComposable();
  resetearDialog();
};

const descargarXmlFirmado = () => {
  if (!resultadoFirma.value) return;

  const blob = new Blob([resultadoFirma.value.xmlFirmado], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `consulta_${props.datosConsulta?.id || 'firmada'}_${Date.now()}.xml`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Formatting helpers
const formatFecha = (date?: Date): string => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('es-EC', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const formatDateTime = (date: Date): string => {
  return new Date(date).toLocaleString('es-EC', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

const formatCedula = (cedula?: string): string => {
  if (!cedula) return '-';
  // Formatear cédula ecuatoriana: 1712345678 -> 171234567-8
  if (cedula.length !== 10) return cedula;
  return `${cedula.slice(0, 9)}-${cedula.slice(9)}`;
};

const formatXmlPreview = (xml: string): string => {
  // Simple XML formatting for preview
  let formatted = xml;
  try {
    // Try to parse and format
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'application/xml');
    const serializer = new XMLSerializer();
    formatted = serializer.serializeToString(doc);
  } catch {
    // If parsing fails, return original
  }
  // Truncate if too long
  if (formatted.length > 3000) {
    return formatted.substring(0, 3000) + '\n\n... (contenido truncado) ...';
  }
  return formatted;
};
</script>

<style scoped>
.firma-dialog-card {
  overflow: hidden;
}

.step-content {
  max-width: 700px;
  margin: 0 auto;
  padding: 1rem 0;
}

.resultado-section {
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
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
