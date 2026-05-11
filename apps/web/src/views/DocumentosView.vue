<template>
  <v-container fluid class="documentos-view">
    <v-row>
      <v-col cols="12">
        <div class="d-flex align-center mb-4">
          <h1 class="text-h4">Documentos</h1>
          <v-spacer />
          <v-btn
            color="primary"
            variant="tonal"
            prepend-icon="mdi-file-document-plus-outline"
            @click="mostrarDialogoNuevo = true"
          >
            Nuevo Documento
          </v-btn>
        </div>
        <p class="text-body-1 text-medium-emphasis mb-6">
          Gestión documental con firmas digitales XAdES-BES
        </p>
      </v-col>
    </v-row>

    <!-- Tabs for different sections -->
    <v-row>
      <v-col cols="12">
        <v-tabs v-model="tabActual" color="primary" class="mb-4">
          <v-tab value="documentos">
            <v-icon start>mdi-file-multiple-outline</v-icon>
            Mis Documentos
          </v-tab>
          <v-tab value="firmar">
            <v-icon start>mdi-draw-pen</v-icon>
            Firmar Documento
          </v-tab>
          <v-tab value="validar">
            <v-icon start>mdi-check-decagram</v-icon>
            Validar Firma
          </v-tab>
        </v-tabs>

        <v-window v-model="tabActual">
          <!-- Tab: Mis Documentos -->
          <v-window-item value="documentos">
            <v-card elevation="1">
              <v-card-text>
                <v-list>
                  <v-list-item v-for="doc in documentos" :key="doc.id">
                    <template v-slot:prepend>
                      <v-icon :color="doc.firmado ? 'success' : 'grey'">
                        {{ doc.firmado ? 'mdi-file-check-outline' : 'mdi-file-outline' }}
                      </v-icon>
                    </template>
                    <v-list-item-title>{{ doc.nombre }}</v-list-item-title>
                    <v-list-item-subtitle>
                      {{ doc.tipo }} - {{ formatDate(doc.fecha) }}
                    </v-list-item-subtitle>
                    <template v-slot:append>
                      <v-chip
                        v-if="doc.firmado"
                        color="success"
                        size="small"
                        variant="flat"
                      >
                        Firmado
                      </v-chip>
                      <v-btn
                        icon="mdi-dots-vertical"
                        variant="text"
                        size="small"
                      />
                    </template>
                  </v-list-item>
                </v-list>

                <v-alert
                  v-if="documentos.length === 0"
                  type="info"
                  variant="tonal"
                  class="mt-4"
                >
                  No hay documentos disponibles. Use el botón "Nuevo Documento" para crear uno.
                </v-alert>
              </v-card-text>
            </v-card>
          </v-window-item>

          <!-- Tab: Firmar Documento -->
          <v-window-item value="firmar">
            <v-card elevation="1">
              <v-card-text>
                <div class="text-subtitle-1 mb-4">
                  Selecciona o carga un documento XML para firmar
                </div>

                <v-file-input
                  v-model="archivoAFirmar"
                  label="Cargar archivo XML"
                  accept=".xml"
                  prepend-icon="mdi-file-code-outline"
                  variant="outlined"
                  density="compact"
                  class="mb-4"
                  @update:model-value="onArchivoCargado"
                />

                <v-divider class="my-4" />

                <FirmaDigital
                  v-if="documentoXml"
                  :documento-xml="documentoXml"
                  :documento-info="documentoInfo"
                  @firma-exitosa="onFirmaExitosa"
                  @cancelar="onCancelarFirma"
                />

                <v-alert
                  v-else
                  type="info"
                  variant="tonal"
                >
                  Carga un archivo XML o selecciona uno de la lista para firmarlo.
                </v-alert>
              </v-card-text>
            </v-card>
          </v-window-item>

          <!-- Tab: Validar Firma -->
          <v-window-item value="validar">
            <v-card elevation="1">
              <v-card-text>
                <div class="text-subtitle-1 mb-4">
                  Valida la firma de un documento XML previamente firmado
                </div>

                <v-file-input
                  v-model="archivoAValidar"
                  label="Cargar archivo XML firmado"
                  accept=".xml"
                  prepend-icon="mdi-file-code-outline"
                  variant="outlined"
                  density="compact"
                  class="mb-4"
                />

                <v-btn
                  color="info"
                  variant="elevated"
                  block
                  :loading="validando"
                  :disabled="!archivoAValidar"
                  @click="validarDocumento"
                >
                  <v-icon start>mdi-check-decagram</v-icon>
                  Validar Firma
                </v-btn>

                <div v-if="resultadoValidacion" class="mt-4">
                  <v-alert
                    :type="resultadoValidacion.valido ? 'success' : 'error'"
                    variant="tonal"
                  >
                    <template v-slot:prepend>
                      <v-icon>
                        {{ resultadoValidacion.valido ? 'mdi-check-circle' : 'mdi-alert-circle' }}
                      </v-icon>
                    </template>
                    <div>
                      <strong>{{ resultadoValidacion.valido ? 'Firma Válida' : 'Firma Inválida' }}</strong>
                    </div>
                    <div class="text-caption mt-1">
                      {{ resultadoValidacion.mensaje }}
                    </div>
                    <div v-if="resultadoValidacion.firmante" class="text-caption mt-2">
                      <strong>Firmante:</strong> {{ resultadoValidacion.firmante }}
                    </div>
                    <div v-if="resultadoValidacion.fechaFirma" class="text-caption">
                      <strong>Fecha de firma:</strong> {{ formatDateTime(resultadoValidacion.fechaFirma) }}
                    </div>
                  </v-alert>
                </div>
              </v-card-text>
            </v-card>
          </v-window-item>
        </v-window>
      </v-col>
    </v-row>

    <!-- Dialog: Nuevo Documento -->
    <v-dialog v-model="mostrarDialogoNuevo" max-width="600px">
      <v-card>
        <v-card-title>
          <span class="text-h5">Nuevo Documento</span>
        </v-card-title>
        <v-card-text>
          <v-select
            v-model="nuevoDocTipo"
            :items="tiposDocumento"
            label="Tipo de documento"
            variant="outlined"
            density="compact"
            class="mb-4"
          />
          <v-text-field
            v-model="nuevoDocNombre"
            label="Nombre del documento"
            variant="outlined"
            density="compact"
            class="mb-4"
          />
          <v-textarea
            v-model="nuevoDocContenido"
            label="Contenido XML"
            variant="outlined"
            density="compact"
            rows="10"
            hint="Pegue el contenido XML del documento"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn color="grey" variant="tonal" @click="mostrarDialogoNuevo = false">
            Cancelar
          </v-btn>
          <v-btn color="primary" variant="elevated" @click="crearDocumento">
            Crear
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import FirmaDigital from '@/components/FirmaDigital.vue';
import type { ResultadoFirma, ResultadoValidacion } from '@/composables/useFirmaDigital';

// Types
interface Documento {
  id: string;
  nombre: string;
  tipo: string;
  fecha: Date;
  firmado: boolean;
  contenido?: string;
}

// State
const tabActual = ref('documentos');
const mostrarDialogoNuevo = ref(false);
const archivoAFirmar = ref<File | null>(null);
const archivoAValidar = ref<File | null>(null);
const documentoXml = ref('');
const documentoInfo = ref<{ tipo?: string; referencia?: string; emisor?: string } | undefined>();
const validando = ref(false);
const resultadoValidacion = ref<ResultadoValidacion | null>(null);
const cargandoDocumentos = ref(false);

// New document form
const nuevoDocTipo = ref('factura');
const nuevoDocNombre = ref('');
const nuevoDocContenido = ref('');

const tiposDocumento = [
  { title: 'Factura Electrónica', value: 'factura' },
  { title: 'Comprobante de Retención', value: 'retencion' },
  { title: 'Nota de Crédito', value: 'nota_credito' },
  { title: 'Nota de Débito', value: 'nota_debito' },
  { title: 'Guía de Remisión', value: 'guia_remision' },
  { title: 'Documento Genérico', value: 'generico' }
];

// Sample documents
const documentos = ref<Documento[]>([
  {
    id: '1',
    nombre: 'Factura 001-001-000000001',
    tipo: 'factura',
    fecha: new Date('2024-01-15'),
    firmado: false
  },
  {
    id: '2',
    nombre: 'Comprobante Retención Enero 2024',
    tipo: 'retencion',
    fecha: new Date('2024-02-01'),
    firmado: true
  }
]);

// Load documents on mount
onMounted(() => {
  cargarDocumentos();
});

// Methods
const cargarDocumentos = async () => {
  cargandoDocumentos.value = true;
  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    const response = await fetch(`${apiUrl}/api/v1/documentos`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
      }
    });

    if (!response.ok) {
      throw new Error(`Error al cargar documentos: ${response.statusText}`);
    }

    const result = await response.json();

    // Mapear datos de la API al formato local
    documentos.value = result.data.map((d: any) => ({
      id: d.id,
      nombre: d.nombre,
      tipo: d.tipo,
      fecha: new Date(d.fecha),
      firmado: d.firmado,
      contenido: d.contenido
    }));
  } catch (error) {
    console.error('Error al cargar documentos:', error);
  } finally {
    cargandoDocumentos.value = false;
  }
};

const onArchivoCargado = async (files: File | File[] | null) => {
  const archivo = Array.isArray(files) ? files[0] : files;
  if (archivo) {
    try {
      const contenido = await archivo.text();
      documentoXml.value = contenido;
      documentoInfo.value = {
        tipo: detectarTipoDocumento(contenido),
        referencia: extraerReferencia(contenido)
      };
    } catch (e) {
      console.error('Error al leer archivo:', e);
    }
  }
};

const detectarTipoDocumento = (xml: string): string => {
  if (xml.includes('factura')) return 'factura';
  if (xml.includes('retencion')) return 'retencion';
  if (xml.includes('notaCredito')) return 'nota_credito';
  if (xml.includes('notaDebito')) return 'nota_debito';
  if (xml.includes('guiaRemision')) return 'guia_remision';
  return 'generico';
};

const extraerReferencia = (xml: string): string => {
  // Try to extract invoice number or other reference
  const match = xml.match(/<estab>([^<]+)<\/estab>.*<ptoEmi>([^<]+)<\/ptoEmi>.*<secuencial>([^<]+)<\/secuencial>/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }
  return 'N/A';
};

const onFirmaExitosa = (resultado: ResultadoFirma) => {
  // Add to documents list as signed
  documentos.value.unshift({
    id: Date.now().toString(),
    nombre: `Documento firmado ${new Date(resultado.timestamp).toLocaleString()}`,
    tipo: documentoInfo.value?.tipo || 'generico',
    fecha: resultado.timestamp,
    firmado: true,
    contenido: resultado.xmlFirmado
  });

  // Clear current document
  documentoXml.value = '';
  documentoInfo.value = undefined;
  archivoAFirmar.value = null;

  // Switch to documents tab
  tabActual.value = 'documentos';
};

const onCancelarFirma = () => {
  documentoXml.value = '';
  documentoInfo.value = undefined;
  archivoAFirmar.value = null;
};

const validarDocumento = async () => {
  if (!archivoAValidar.value) return;

  validando.value = true;
  resultadoValidacion.value = null;

  try {
    const contenido = await archivoAValidar.value.text();
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

    const response = await fetch(`${apiUrl}/api/firma/validar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token') || 'dev-token'}`
      },
      body: JSON.stringify({ xml: contenido })
    });

    if (response.ok) {
      resultadoValidacion.value = await response.json();
    } else {
      resultadoValidacion.value = {
        valido: false,
        mensaje: 'Error al validar la firma en el servidor'
      };
    }
  } catch (e) {
    console.error('Error al validar documento:', e);
    resultadoValidacion.value = {
      valido: false,
      mensaje: 'Error de comunicación con el servidor'
    };
  } finally {
    validando.value = false;
  }
};

const crearDocumento = async () => {
  if (!nuevoDocNombre.value || !nuevoDocContenido.value) {
    return;
  }

  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    const response = await fetch(`${apiUrl}/api/v1/documentos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
      },
      body: JSON.stringify({
        nombre: nuevoDocNombre.value,
        tipo: nuevoDocTipo.value,
        contenido: nuevoDocContenido.value
      })
    });

    if (!response.ok) {
      throw new Error('Error al crear documento');
    }

    const result = await response.json();

    // Agregar a la lista localmente
    documentos.value.unshift({
      id: result.data.id,
      nombre: result.data.nombre,
      tipo: result.data.tipo,
      fecha: new Date(result.data.fecha),
      firmado: result.data.firmado,
      contenido: result.data.contenido
    });

    // Reset form
    nuevoDocNombre.value = '';
    nuevoDocContenido.value = '';
    mostrarDialogoNuevo.value = false;
  } catch (error) {
    console.error('Error al crear documento:', error);
  }
};

// Formatting helpers
const formatDate = (date: Date): string => {
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
    minute: '2-digit'
  });
};
</script>

<style scoped>
.documentos-view {
  max-width: 1200px;
  margin: 0 auto;
}
</style>
