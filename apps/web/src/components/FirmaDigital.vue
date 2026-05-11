<template>
  <v-card class="firma-digital-card" elevation="2">
    <v-card-title class="d-flex align-center py-4">
      <v-icon icon="mdi-certificate-outline" size="large" class="mr-3" />
      <span>Firma Digital XAdES-BES</span>
    </v-card-title>

    <v-card-subtitle>
      Firma electrónica avanzada compatible con SRI Ecuador
    </v-card-subtitle>

    <v-card-text>
      <!-- Step 1: Load Certificate -->
      <v-stepper v-model="pasoActual" :items="pasos" class="elevation-0">
        <!-- Step 1: Certificate -->
        <template v-slot:item.1>
          <v-card flat>
            <v-card-text>
              <div class="text-subtitle-1 mb-4">Cargar Certificado Digital (.p12)</div>

              <v-alert
                v-if="!certificadoCargado"
                type="info"
                variant="tonal"
                class="mb-4"
                density="compact"
              >
                <template v-slotprepend>
                  <v-icon>mdi-information</v-icon>
                </template>
                <div>
                  Su clave privada NUNCA sale de este dispositivo. Toda la
                  operación criptográfica se realiza localmente en su navegador.
                </div>
              </v-alert>

              <v-alert
                v-if="certificadoCargado"
                type="success"
                variant="tonal"
                class="mb-4"
                density="compact"
              >
                <template v-slot:prepend>
                  <v-icon>mdi-check-circle</v-icon>
                </template>
                <div>
                  <strong>Certificado cargado:</strong>
                  {{ nombreFirmante }}
                </div>
                <div v-if="certificadoInfo">
                  <small>Válido hasta: {{ formatDate(certificadoInfo.validTo) }}</small>
                </div>
              </v-alert>

              <v-file-input
                v-model="archivoCertificado"
                label="Seleccionar archivo .p12"
                accept=".p12,.pfx"
                prepend-icon="mdi-file-key-outline"
                variant="outlined"
                density="compact"
                :disabled="certificadoCargado"
                @update:model-value="onArchivoSeleccionado"
              />

              <v-text-field
                v-model="passwordCertificado"
                :type="mostrarPassword ? 'text' : 'password'"
                label="Contraseña del certificado"
                prepend-icon="mdi-lock-outline"
                :append-inner-icon="mostrarPassword ? 'mdi-eye-off' : 'mdi-eye'"
                variant="outlined"
                density="compact"
                :disabled="!archivoCertificado || certificadoCargado"
                @click:append-inner="mostrarPassword = !mostrarPassword"
                @keyup.enter="cargarCertificado"
              />

              <v-btn
                color="primary"
                variant="elevated"
                block
                :loading="cargando"
                :disabled="!archivoCertificado || !passwordCertificado || certificadoCargado"
                @click="cargarCertificado"
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
                @click:close="error = null"
              >
                {{ error }}
              </v-alert>

              <v-alert
                v-if="certificadoCargado && !certificadoVigente"
                type="warning"
                variant="tonal"
                class="mt-4"
                density="compact"
              >
                <v-icon start>mdi-alert</v-icon>
                Su certificado está vencido. Considere renovarlo.
              </v-alert>
            </v-card-text>
          </v-card>
        </template>

        <!-- Step 2: Document Preview -->
        <template v-slot:item.2>
          <v-card flat>
            <v-card-text>
              <div class="text-subtitle-1 mb-4">Documento a Firmar</div>

              <v-alert
                type="info"
                variant="tonal"
                class="mb-4"
                density="compact"
              >
                <template v-slot:prepend>
                  <v-icon>mdi-file-document-outline</v-icon>
                </template>
                Revise el contenido del documento antes de firmarlo.
              </v-alert>

              <div v-if="documentoXml" class="documento-preview">
                <v-textarea
                  :model-value="formatXmlPreview(documentoXml)"
                  label="Contenido del documento XML"
                  readonly
                  variant="outlined"
                  density="compact"
                  rows="15"
                  class="font-monospace"
                />
              </div>

              <v-alert
                v-else
                type="warning"
                variant="tonal"
                density="compact"
              >
                No hay documento cargado para firmar.
              </v-alert>

              <!-- Document info -->
              <div v-if="documentoInfo" class="mt-4">
                <v-list density="compact" variant="outlined">
                  <v-list-item>
                    <template v-slot:prepend>
                      <v-icon>mdi-file-outline</v-icon>
                    </template>
                    <v-list-item-title>Tipo de documento</v-list-item-title>
                    <v-list-item-subtitle>{{ documentoInfo.tipo }}</v-list-item-subtitle>
                  </v-list-item>
                  <v-list-item v-if="documentoInfo.referencia">
                    <template v-slot:prepend>
                      <v-icon>mdi-pound</v-icon>
                    </template>
                    <v-list-item-title>Referencia</v-list-item-title>
                    <v-list-item-subtitle>{{ documentoInfo.referencia }}</v-list-item-subtitle>
                  </v-list-item>
                  <v-list-item v-if="documentoInfo.emisor">
                    <template v-slot:prepend>
                      <v-icon>mdi-account-tie</v-icon>
                    </template>
                    <v-list-item-title>Emisor</v-list-item-title>
                    <v-list-item-subtitle>{{ documentoInfo.emisor }}</v-list-item-subtitle>
                  </v-list-item>
                </v-list>
              </div>
            </v-card-text>
          </v-card>
        </template>

        <!-- Step 3: Sign and Validate -->
        <template v-slot:item.3>
          <v-card flat>
            <v-card-text>
              <div class="text-subtitle-1 mb-4">Firmar Documento</div>

              <v-alert
                v-if="!resultadoFirma && !validando"
                type="warning"
                variant="tonal"
                class="mb-4"
                density="compact"
              >
                <template v-slot:prepend>
                  <v-icon>mdi-gavel</v-icon>
                </template>
                Al hacer clic en "Firmar Documento", usted está aplicando su firma
                digital válida legalmente. Asegúrese de haber revisado el contenido.
              </v-alert>

              <v-btn
                v-if="!resultadoFirma"
                color="success"
                variant="elevated"
                size="large"
                block
                :loading="cargando"
                :disabled="!listoParaFirmar || !documentoXml"
                @click="firmarDocumento"
              >
                <v-icon start>mdi-draw-pen</v-icon>
                Firmar Documento
              </v-btn>

              <!-- Signature Result -->
              <div v-if="resultadoFirma" class="resultado-firma">
                <v-alert
                  type="success"
                  variant="tonal"
                  class="mb-4"
                  density="compact"
                >
                  <template v-slot:prepend>
                    <v-icon>mdi-check-circle-outline</v-icon>
                  </template>
                  <div><strong>¡Documento firmado exitosamente!</strong></div>
                  <div class="text-caption mt-1">
                    Fecha: {{ formatDateTime(resultadoFirma.timestamp) }}
                  </div>
                </v-alert>

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
                        rows="10"
                        class="font-monospace text-caption"
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
                          <v-list-item-subtitle>{{ nombreFirmante }}</v-list-item-subtitle>
                        </v-list-item>
                        <v-list-item>
                          <v-list-item-title>Algoritmo</v-list-item-title>
                          <v-list-item-subtitle>RSA-SHA256 (XAdES-BES)</v-list-item-subtitle>
                        </v-list-item>
                        <v-list-item>
                          <v-list-item-title>Timestamp</v-list-item-title>
                          <v-list-item-subtitle>{{ formatDateTime(resultadoFirma.timestamp) }}</v-list-item-subtitle>
                        </v-list-item>
                      </v-list>
                    </v-expansion-panel-text>
                  </v-expansion-panel>
                </v-expansion-panels>

                <!-- Validate on server -->
                <v-divider class="my-4" />
                <div class="text-subtitle-2 mb-2">Validar Firma en Servidor</div>

                <v-btn
                  color="info"
                  variant="tonal"
                  block
                  :loading="validando"
                  :disabled="validacionRealizada"
                  @click="validarFirma"
                >
                  <v-icon start>mdi-check-decagram</v-icon>
                  Validar Firma
                </v-btn>

                <!-- Validation Result -->
                <div v-if="resultadoValidacion" class="mt-4">
                  <v-alert
                    :type="resultadoValidacion.valido ? 'success' : 'error'"
                    variant="tonal"
                    density="compact"
                  >
                    <template v-slot:prepend>
                      <v-icon>{{ resultadoValidacion.valido ? 'mdi-check-circle' : 'mdi-alert-circle' }}</v-icon>
                    </template>
                    <div><strong>{{ resultadoValidacion.valido ? 'Firma Válida' : 'Firma Inválida' }}</strong></div>
                    <div class="text-caption mt-1">{{ resultadoValidacion.mensaje }}</div>
                    <div v-if="resultadoValidacion.firmante" class="text-caption">
                      Firmante: {{ resultadoValidacion.firmante }}
                    </div>
                    <div v-if="resultadoValidacion.fechaFirma" class="text-caption">
                      Fecha: {{ formatDateTime(resultadoValidacion.fechaFirma) }}
                    </div>
                  </v-alert>
                </div>
              </div>
            </v-card-text>
          </v-card>
        </template>
      </v-stepper>
    </v-card-text>

    <!-- Actions -->
    <v-card-actions class="px-6 pb-4">
      <v-spacer />
      <v-btn
        v-if="certificadoCargado"
        color="error"
        variant="tonal"
        @click="limpiar"
      >
        <v-icon start>mdi-delete-outline</v-icon>
        Limpiar
      </v-btn>
      <v-btn
        v-if="resultadoFirma"
        color="success"
        variant="elevated"
        @click="emitirAceptar"
      >
        <v-icon start>mdi-check</v-icon>
        Aceptar
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import useFirmaDigital, {
  type CertificadoInfo,
  type ResultadoFirma,
  type ResultadoValidacion
} from '@/composables/useFirmaDigital';

// Props
interface Props {
  documentoXml?: string;
  documentoInfo?: {
    tipo?: string;
    referencia?: string;
    emisor?: string;
  };
}

const props = withDefaults(defineProps<Props>(), {
  documentoXml: '',
  documentoInfo: undefined
});

// Emits
const emit = defineEmits<{
  firmaExitosa: [resultado: ResultadoFirma];
  cancelar: [];
}>();

// Composable
const {
  certificadoCargado,
  certificadoInfo,
  cargando,
  error,
  listoParaFirmar,
  nombreFirmante,
  certificadoVigente,
  cargarCertificado: cargarCertificadoComposable,
  firmarXML,
  validarFirmaServidor,
  limpiarMemoria
} = useFirmaDigital();

// State
const pasoActual = ref(1);
const pasos = ['Certificado', 'Documento', 'Firmar'];
const archivoCertificado = ref<File | null>(null);
const passwordCertificado = ref('');
const mostrarPassword = ref(false);
const resultadoFirma = ref<ResultadoFirma | null>(null);
const validando = ref(false);
const resultadoValidacion = ref<ResultadoValidacion | null>(null);
const validacionRealizada = ref(false);

// Methods
const onArchivoSeleccionado = (files: File | File[] | null) => {
  const archivo = Array.isArray(files) ? files[0] : files;
  if (archivo) {
    // File selected
    passwordCertificado.value = '';
  }
};

const cargarCertificado = async () => {
  if (!archivoCertificado.value || !passwordCertificado.value) {
    return;
  }

  try {
    await cargarCertificadoComposable(archivoCertificado.value, passwordCertificado.value);
    pasoActual.value = 2;
  } catch (e) {
    console.error('Error al cargar certificado:', e);
  }
};

const firmarDocumento = async () => {
  if (!props.documentoXml) {
    return;
  }

  try {
    resultadoFirma.value = await firmarXML(props.documentoXml);
    pasoActual.value = 3;
    emit('firmaExitosa', resultadoFirma.value);
  } catch (e) {
    console.error('Error al firmar documento:', e);
  }
};

const validarFirma = async () => {
  if (!resultadoFirma.value) {
    return;
  }

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
  } finally {
    validando.value = false;
  }
};

const limpiar = () => {
  archivoCertificado.value = null;
  passwordCertificado.value = '';
  mostrarPassword.value = false;
  resultadoFirma.value = null;
  resultadoValidacion.value = null;
  validacionRealizada.value = false;
  pasoActual.value = 1;
  limpiarMemoria();
};

const emitirAceptar = () => {
  emit('firmaExitosa', resultadoFirma.value!);
};

const descargarXmlFirmado = () => {
  if (!resultadoFirma.value) return;

  const blob = new Blob([resultadoFirma.value.xmlFirmado], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `documento_firmado_${Date.now()}.xml`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Formatting helpers
const formatDate = (date: Date): string => {
  return new Date(date).toLocaleDateString('es-EC', {
    year: 'numeric',
    month: 'long',
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
  if (formatted.length > 5000) {
    return formatted.substring(0, 5000) + '\n\n... (contenido truncado) ...';
  }
  return formatted;
};
</script>

<style scoped>
.firma-digital-card {
  max-width: 800px;
  margin: 0 auto;
}

.documento-preview {
  background-color: #f5f5f5;
  border-radius: 4px;
  padding: 16px;
}

.resultado-firma {
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

.font-monospace {
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.875rem;
}
</style>
