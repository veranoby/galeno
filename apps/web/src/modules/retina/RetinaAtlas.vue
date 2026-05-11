<!-- apps/web/src/modules/retina/RetinaAtlas.vue -->
<template>
  <div class="retina-atlas-container">
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon icon="mdi-eye" class="mr-2" />
        <span>Retina Atlas</span>
        <v-spacer />

        <v-btn-group class="mr-2">
          <v-btn
            :variant="modoComparacion ? 'tonal' : 'outlined'"
            size="small"
            @click="toggleModoComparacion"
            :disabled="!puedeComparar || context.readonly"
          >
            <v-icon icon="mdi-compare" />
            Comparar
          </v-btn>
        </v-btn-group>

        <v-btn
          v-if="!context.readonly"
          color="primary"
          variant="text"
          @click="guardar"
          :loading="guardando"
        >
          <v-icon icon="mdi-content-save" class="mr-2" />
          Guardar
        </v-btn>
      </v-card-title>

      <v-card-subtitle>
        Visor de imágenes retina con herramientas de anotación
      </v-card-subtitle>

      <v-card-text>
        <!-- Barra de herramientas -->
        <div class="retina-toolbar mb-4">
          <v-chip-group v-model="herramientaActiva" mandatory>
            <v-chip
              v-for="herramienta in herramientas"
              :key="herramienta.value"
              :value="herramienta.value"
              filter
              :disabled="context.readonly"
            >
              <v-icon :icon="herramienta.icon" class="mr-1" />
              {{ herramienta.label }}
            </v-chip>
          </v-chip-group>

          <v-divider vertical class="mx-2" />

          <v-btn-toggle v-model="filtroActual" mandatory>
            <v-btn
              v-for="filtro in filtros"
              :key="filtro.value"
              :value="filtro.value"
              size="small"
            >
              {{ filtro.label }}
            </v-btn>
          </v-btn-toggle>

          <v-spacer />

          <!-- Controles de zoom -->
          <div class="zoom-controls d-flex align-center">
            <v-btn
              icon="mdi-magnify-minus"
              size="small"
              variant="text"
              @click="zoomOut"
              :disabled="zoom <= config.minZoom"
            />
            <span class="mx-2">{{ Math.round(zoom * 100) }}%</span>
            <v-btn
              icon="mdi-magnify-plus"
              size="small"
              variant="text"
              @click="zoomIn"
              :disabled="zoom >= config.maxZoom"
            />
            <v-btn
              icon="mdi-magnify"
              size="small"
              variant="text"
              @click="resetZoom"
              class="ml-1"
            />
          </div>
        </div>

        <!-- Galería de imágenes -->
        <div v-if="!modoComparacion" class="imagenes-gallery mb-4">
          <v-row>
            <v-col
              v-for="imagen in imagenes"
              :key="imagen.id"
              cols="12"
              sm="6"
              md="4"
            >
              <v-card
                :variant="imagenActiva?.id === imagen.id ? 'tonal' : 'outlined'"
                class="imagen-card"
                @click="seleccionarImagen(imagen)"
                hover
              >
                <v-img
                  :src="imagen.thumbnailUrl || imagen.url"
                  :alt="imagen.tipo"
                  aspect-ratio="1"
                  cover
                  class="imagen-thumb"
                >
                  <template #placeholder>
                    <div class="d-flex align-center justify-center fill-height">
                      <v-progress-circular indeterminate />
                    </div>
                  </template>
                </v-img>

                <v-card-title class="text-subtitle-2">
                  {{ ojoLabel(imagen.ojo) }} - {{ tipoImagenLabel(imagen.tipo) }}
                </v-card-title>

                <v-card-subtitle class="text-caption">
                  {{ formatDate(imagen.fechaCaptura) }}
                </v-card-subtitle>

                <v-card-actions>
                  <v-chip size="x-small" :color="estadoColor(imagen.estado)">
                    {{ imagen.estado }}
                  </v-chip>
                  <v-spacer />
                  <v-chip
                    v-if="imagen.anotaciones.length > 0"
                    size="x-small"
                    color="primary"
                  >
                    {{ imagen.anotaciones.length }} anotaciones
                  </v-chip>
                </v-card-actions>
              </v-card>
            </v-col>
          </v-row>
        </div>

        <!-- Visor de imagen -->
        <div class="retina-viewer-wrapper">
          <div
            v-if="imagenActiva"
            ref="viewerContainer"
            class="retina-viewer"
            :style="{ cursor: cursorActivo }"
            @mousedown="onMouseDown"
            @mousemove="onMouseMove"
            @mouseup="onMouseUp"
            @mouseleave="onMouseUp"
            @wheel.prevent="onWheel"
          >
            <!-- Modo comparación -->
            <template v-if="modoComparacion && imagenComparacion">
              <div class="comparacion-container">
                <div class="comparacion-side">
                  <v-img
                    :src="imagenActiva.url"
                    :alt="imagenActiva.tipo"
                    class="retina-image"
                    :style="imagenStyle"
                  />
                  <div class="comparacion-label">
                    {{ ojoLabel(imagenActiva.ojo) }} - {{ tipoImagenLabel(imagenActiva.tipo) }}
                  </div>
                </div>
                <v-divider vertical />
                <div class="comparacion-side">
                  <v-img
                    :src="imagenComparacion.url"
                    :alt="imagenComparacion.tipo"
                    class="retina-image"
                    :style="imagenStyle"
                  />
                  <div class="comparacion-label">
                    {{ ojoLabel(imagenComparacion.ojo) }} - {{ tipoImagenLabel(imagenComparacion.tipo) }}
                  </div>
                </div>
              </div>
            </template>

            <!-- Modo normal -->
            <template v-else>
              <v-img
                :src="imagenActiva.url"
                :alt="imagenActiva.tipo"
                class="retina-image"
                :style="imagenStyle"
              />

              <!-- Overlay de anotaciones -->
              <svg
                v-if="imagenActiva.anotaciones.length > 0"
                class="anotaciones-overlay"
                :style="overlayStyle"
              >
                <g
                  v-for="anotacion in imagenActiva.anotaciones"
                  :key="anotacion.id"
                  :transform="`translate(${anotacion.coordenadas[0]}, ${anotacion.coordenadas[1]})`"
                >
                  <!-- Punto -->
                  <circle
                    v-if="anotacion.tipo === 'punto'"
                    r="6"
                    :fill="COLOR_ANNOTATION_MAP[anotacion.color]"
                    opacity="0.8"
                  />

                  <!-- Línea -->
                  <line
                    v-else-if="anotacion.tipo === 'linea'"
                    :x1="0"
                    :y1="0"
                    :x2="anotacion.coordenadas[2] - anotacion.coordenadas[0]"
                    :y2="anotacion.coordenadas[3] - anotacion.coordenadas[1]"
                    :stroke="COLOR_ANNOTATION_MAP[anotacion.color]"
                    stroke-width="3"
                  />

                  <!-- Flecha -->
                  <g v-else-if="anotacion.tipo === 'flecha'">
                    <line
                      :x1="0"
                      :y1="0"
                      :x2="anotacion.coordenadas[2] - anotacion.coordenadas[0]"
                      :y2="anotacion.coordenadas[3] - anotacion.coordenadas[1]"
                      :stroke="COLOR_ANNOTATION_MAP[anotacion.color]"
                      stroke-width="3"
                      marker-end="url(#arrowhead)"
                    />
                  </g>

                  <!-- Área (rectángulo) -->
                  <rect
                    v-else-if="anotacion.tipo === 'area'"
                    :width="anotacion.coordenadas[2] - anotacion.coordenadas[0]"
                    :height="anotacion.coordenadas[3] - anotacion.coordenadas[1]"
                    :fill="COLOR_ANNOTATION_MAP[anotacion.color]"
                    fill-opacity="0.3"
                    :stroke="COLOR_ANNOTATION_MAP[anotacion.color]"
                    stroke-width="2"
                  />

                  <!-- Texto -->
                  <text
                    v-else-if="anotacion.tipo === 'texto'"
                    x="10"
                    y="-10"
                    :fill="COLOR_ANNOTATION_MAP[anotacion.color]"
                    font-size="14"
                    font-weight="600"
                  >
                    {{ anotacion.texto }}
                  </text>
                </g>

                <!-- Definición de marcador de flecha -->
                <defs>
                  <marker
                    id="arrowhead"
                    markerWidth="10"
                    markerHeight="7"
                    refX="9"
                    refY="3.5"
                    orient="auto"
                  >
                    <polygon
                      points="0 0, 10 3.5, 0 7"
                      :fill="COLOR_ANNOTATION_MAP.rojo"
                    />
                  </marker>
                </defs>
              </svg>
            </template>
          </div>

          <!-- Panel de comparación -->
          <div v-if="modoComparacion" class="comparacion-panel">
            <v-select
              v-model="imagenComparacionId"
              :items="imagenesComparables"
              item-title="label"
              item-value="id"
              label="Seleccionar imagen para comparar"
              hide-details
              density="compact"
            />
          </div>
        </div>

        <!-- Detalles de imagen activa -->
        <v-expand-transition>
          <div v-if="imagenActiva" class="imagen-details mt-4">
            <v-divider class="mb-4" />
            <v-card variant="outlined">
              <v-card-title>
                Detalles de imagen
              </v-card-title>
              <v-card-text>
                <v-row>
                  <v-col cols="12" sm="6" md="3">
                    <div class="detail-item">
                      <span class="detail-label">Ojo:</span>
                      <span class="detail-value">{{ ojoLabel(imagenActiva.ojo) }}</span>
                    </div>
                  </v-col>
                  <v-col cols="12" sm="6" md="3">
                    <div class="detail-item">
                      <span class="detail-label">Tipo:</span>
                      <span class="detail-value">{{ tipoImagenLabel(imagenActiva.tipo) }}</span>
                    </div>
                  </v-col>
                  <v-col cols="12" sm="6" md="3">
                    <div class="detail-item">
                      <span class="detail-label">Fecha:</span>
                      <span class="detail-value">{{ formatDate(imagenActiva.fechaCaptura) }}</span>
                    </div>
                  </v-col>
                  <v-col cols="12" sm="6" md="3">
                    <div class="detail-item">
                      <span class="detail-label">Estado:</span>
                      <v-chip size="x-small" :color="estadoColor(imagenActiva.estado)">
                        {{ imagenActiva.estado }}
                      </v-chip>
                    </div>
                  </v-col>
                </v-row>

                <v-textarea
                  v-model="imagenActiva.notas"
                  label="Notas"
                  rows="2"
                  :disabled="context.readonly"
                  class="mt-4"
                />

                <!-- Lista de anotaciones -->
                <div v-if="imagenActiva.anotaciones.length > 0" class="anotaciones-list mt-4">
                  <h4 class="text-subtitle-2 mb-2">Anotaciones ({{ imagenActiva.anotaciones.length }}):</h4>
                  <v-chip-group>
                    <v-chip
                      v-for="anotacion in imagenActiva.anotaciones"
                      :key="anotacion.id"
                      :color="COLOR_ANNOTATION_MAP[anotacion.color]"
                      size="small"
                      closable
                      @click:close="eliminarAnotacion(anotacion.id)"
                      :disabled="context.readonly"
                    >
                      <v-icon :icon="getAnotacionIcon(anotacion.tipo)" class="mr-1" size="x-small" />
                      {{ anotacion.tipo }}
                      <span v-if="anotacion.texto" class="ml-1">: {{ anotacion.texto }}</span>
                    </v-chip>
                  </v-chip-group>
                </div>
              </v-card-text>
            </v-card>
          </div>
        </v-expand-transition>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import type { ModuleContext, ModuleEvent } from '@/types/module';
import type {
  ImagenRetina,
  Ojo,
  TipoImagenRetina,
  EstadoImagen,
  HerramientaVisor,
  FiltroImagen,
  Anotacion,
  TipoAnotacion,
  ColorAnotacion,
  RetinaVisorConfig,
} from './types';
import {
  COLOR_ANNOTATION_MAP,
  RETINA_CONSTANTS,
  IMAGENES_COMPARABLES,
} from './types';

interface Props {
  context: ModuleContext;
  emitEvent: (event: ModuleEvent) => void;
}

const props = defineProps<Props>();

// Configuración del visor
const config: RetinaVisorConfig = {
  mostrarGrid: false,
  permitirAnotaciones: true,
  permitirComparacion: true,
  zoomInicial: 1,
  minZoom: 0.1,
  maxZoom: 5,
};

// Estado
const imagenes = ref<ImagenRetina[]>([]);
const imagenActiva = ref<ImagenRetina | null>(null);
const imagenComparacionId = ref<string | null>(null);
const modoComparacion = ref(false);
const herramientaActiva = ref<HerramientaVisor>('zoom');
const filtroActual = ref<FiltroImagen>('normal');
const zoom = ref(config.zoomInicial);
const guardando = ref(false);

// Estado para interacciones del mouse
const isDragging = ref(false);
const lastMousePos = ref({ x: 0, y: 0 });
const panOffset = ref({ x: 0, y: 0 });

// Herramientas disponibles
const herramientas = [
  { value: 'pan' as const, label: 'Mover', icon: 'mdi-pan' },
  { value: 'zoom' as const, label: 'Zoom', icon: 'mdi-magnify' },
  { value: 'anotar' as const, label: 'Anotar', icon: 'mdi-pencil' },
  { value: 'medir' as const, label: 'Medir', icon: 'mdi-ruler' },
];

// Filtros disponibles
const filtros = [
  { value: 'normal' as const, label: 'Normal' },
  { value: 'contraste_alto' as const, label: 'Alto C.' },
  { value: 'contraste_bajo' as const, label: 'Bajo C.' },
  { value: 'escala_grises' as const, label: 'Gris' },
];

// Imagen para comparación
const imagenComparacion = computed(() => {
  if (!imagenComparacionId.value) return null;
  return imagenes.value.find(img => img.id === imagenComparacionId.value) || null;
});

// Imágenes comparables (mismo ojo o tipo similar)
const imagenesComparables = computed(() => {
  if (!imagenActiva.value) return [];
  return imagenes.value
    .filter(img => img.id !== imagenActiva.value!.id)
    .filter(img => IMAGENES_COMPARABLES.includes(img.tipo))
    .map(img => ({
      id: img.id,
      label: `${ojoLabel(img.ojo)} - ${tipoImagenLabel(img.tipo)} - ${formatDate(img.fechaCaptura)}`,
    }));
});

// Verificar si se puede comparar
const puedeComparar = computed(() => {
  return imagenActiva.value && imagenesComparables.value.length > 0;
});

// Estilo de la imagen
const imagenStyle = computed(() => {
  return {
    transform: `scale(${zoom.value}) translate(${panOffset.value.x}px, ${panOffset.value.y}px)`,
    transformOrigin: 'center center',
    transition: isDragging.value ? 'none' : 'transform 0.1s ease-out',
    filter: getFilterCSS(filtroActual.value),
  };
});

// Estilo del overlay de anotaciones
const overlayStyle = computed(() => {
  return {
    transform: `scale(${zoom.value}) translate(${panOffset.value.x}px, ${panOffset.value.y}px)`,
    transformOrigin: 'center center',
    pointerEvents: 'none',
  };
});

// Cursor activo según herramienta
const cursorActivo = computed(() => {
  switch (herramientaActiva.value) {
    case 'pan': return 'grab';
    case 'zoom': return 'zoom-in';
    case 'anotar': return 'crosshair';
    case 'medir': return 'crosshair';
    default: return 'default';
  }
});

// Obtener CSS del filtro
function getFilterCSS(filtro: FiltroImagen): string {
  switch (filtro) {
    case 'normal': return 'none';
    case 'contraste_alto': return 'contrast(1.5)';
    case 'contraste_bajo': return 'contrast(0.7)';
    case 'brillo_alto': return 'brightness(1.3)';
    case 'brillo_bajo': return 'brightness(0.7)';
    case 'escala_grises': return 'grayscale(100%)';
    case 'sepia': return 'sepia(100%)';
    default: return 'none';
  }
}

// Labels
function ojoLabel(ojo: Ojo): string {
  return ojo === 'derecho' ? 'OD' : ojo === 'izquierdo' ? 'OI' : 'Ambos';
}

function tipoImagenLabel(tipo: TipoImagenRetina): string {
  const labels: Record<TipoImagenRetina, string> = {
    color_fondo: 'Fondo de ojo',
    angiofluoresceina: 'Angiofluoresceina',
    oct: 'OCT',
    campo_visual: 'Campo visual',
    topografo: 'Topógrafo',
  };
  return labels[tipo] || tipo;
}

function estadoColor(estado: EstadoImagen): string {
  switch (estado) {
    case 'completa': return 'success';
    case 'procesando': return 'info';
    case 'pendiente': return 'warning';
    case 'error': return 'error';
    default: return 'default';
  }
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getAnotacionIcon(tipo: TipoAnotacion): string {
  switch (tipo) {
    case 'punto': return 'mdi-circle-small';
    case 'linea': return 'mdi-minus';
    case 'area': return 'mdi-square-outline';
    case 'texto': return 'mdi-text';
    case 'flecha': return 'mdi-arrow-top-right';
  }
}

// Seleccionar imagen
function seleccionarImagen(imagen: ImagenRetina): void {
  imagenActiva.value = imagen;
  resetZoom();
}

// Toggle modo comparación
function toggleModoComparacion(): void {
  modoComparacion.value = !modoComparacion.value;
  if (modoComparacion.value && imagenesComparables.value.length > 0) {
    imagenComparacionId.value = imagenesComparables.value[0].id;
  }
}

// Zoom controls
function zoomIn(): void {
  zoom.value = Math.min(zoom.value * 1.2, config.maxZoom);
}

function zoomOut(): void {
  zoom.value = Math.max(zoom.value / 1.2, config.minZoom);
}

function resetZoom(): void {
  zoom.value = config.zoomInicial;
  panOffset.value = { x: 0, y: 0 };
}

// Mouse events para pan
function onMouseDown(event: MouseEvent): void {
  if (herramientaActiva.value === 'pan') {
    isDragging.value = true;
    lastMousePos.value = { x: event.clientX, y: event.clientY };
  } else if (herramientaActiva.value === 'anotar' && !props.context.readonly) {
    agregarAnotacion(event);
  }
}

function onMouseMove(event: MouseEvent): void {
  if (isDragging.value) {
    const dx = event.clientX - lastMousePos.value.x;
    const dy = event.clientY - lastMousePos.value.y;
    panOffset.value = {
      x: panOffset.value.x + dx / zoom.value,
      y: panOffset.value.y + dy / zoom.value,
    };
    lastMousePos.value = { x: event.clientX, y: event.clientY };
  }
}

function onMouseUp(): void {
  isDragging.value = false;
}

function onWheel(event: WheelEvent): void {
  if (herramientaActiva.value === 'zoom') {
    const delta = event.deltaY > 0 ? 0.9 : 1.1;
    zoom.value = Math.max(
      config.minZoom,
      Math.min(config.maxZoom, zoom.value * delta)
    );
  }
}

// Agregar anotación
function agregarAnotacion(event: MouseEvent): void {
  if (!imagenActiva.value) return;

  const rect = (event.target as HTMLElement).getBoundingClientRect();
  const x = (event.clientX - rect.left) / zoom.value - panOffset.value.x;
  const y = (event.clientY - rect.top) / zoom.value - panOffset.value.y;

  const nuevaAnotacion: Anotacion = {
    id: `ant-${Date.now()}`,
    tipo: 'punto',
    color: 'rojo',
    coordenadas: [x, y],
    fecha: new Date(),
  };

  imagenActiva.value.anotaciones.push(nuevaAnotacion);
  emitirCambioDatos();
}

// Eliminar anotación
function eliminarAnotacion(id: string): void {
  if (!imagenActiva.value || props.context.readonly) return;
  imagenActiva.value.anotaciones = imagenActiva.value.anotaciones.filter(
    a => a.id !== id
  );
  emitirCambioDatos();
}

// Emitir evento de cambio
function emitirCambioDatos(): void {
  props.emitEvent({
    type: 'data-changed',
    payload: {
      retina: {
        imagenes: imagenes.value,
        imagenActiva: imagenActiva.value?.id,
      },
    },
  });
}

// Guardar
async function guardar(): Promise<void> {
  guardando.value = true;
  try {
    props.emitEvent({
      type: 'save',
      payload: {
        retina: {
          imagenes: imagenes.value,
          imagenActiva: imagenActiva.value?.id,
        },
      },
    });
  } finally {
    setTimeout(() => {
      guardando.value = false;
    }, 500);
  }
}

// Inicialización
onMounted(() => {
  // Datos de ejemplo si no hay datos en el contexto
  if (props.context.data?.retina) {
    const datosGuardados = props.context.data.retina as any;
    imagenes.value = datosGuardados.imagenenes || [];
    if (datosGuardados.imagenActiva) {
      imagenActiva.value = imagenes.value.find(img => img.id === datosGuardados.imagenActiva) || null;
    }
  } else {
    // Datos de ejemplo
    imagenes.value = [
      {
        id: 'img-1',
        tipo: 'color_fondo',
        ojo: 'derecho',
        url: 'https://via.placeholder.com/400x400/1a1a2e/16213e?text=OD+Fondo',
        thumbnailUrl: 'https://via.placeholder.com/150x150/1a1a2e/16213e?text=OD',
        fechaCaptura: new Date('2024-01-15'),
        fechaSubida: new Date('2024-01-15'),
        estado: 'completa',
        anotaciones: [],
      },
      {
        id: 'img-2',
        tipo: 'color_fondo',
        ojo: 'izquierdo',
        url: 'https://via.placeholder.com/400x400/1a1a2e/0f3460?text=OI+Fondo',
        thumbnailUrl: 'https://via.placeholder.com/150x150/1a1a2e/0f3460?text=OI',
        fechaCaptura: new Date('2024-01-15'),
        fechaSubida: new Date('2024-01-15'),
        estado: 'completa',
        anotaciones: [],
      },
    ];
    if (imagenes.value.length > 0) {
      imagenActiva.value = imagenes.value[0];
    }
  }
});
</script>

<style scoped>
.retina-atlas-container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
}

.retina-toolbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.zoom-controls {
  gap: 0.5rem;
}

.imagenes-gallery {
  max-height: 300px;
  overflow-y: auto;
}

.imagen-card {
  cursor: pointer;
  transition: transform 0.2s;
}

.imagen-card:hover {
  transform: translateY(-2px);
}

.imagen-thumb {
  cursor: pointer;
}

.retina-viewer-wrapper {
  position: relative;
  display: flex;
  gap: 1rem;
}

.retina-viewer {
  position: relative;
  width: 100%;
  height: 500px;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
}

.retina-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.comparacion-container {
  display: flex;
  width: 100%;
  height: 100%;
  gap: 1px;
}

.comparacion-side {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.comparacion-label {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
}

.comparacion-panel {
  width: 300px;
}

.anotaciones-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.imagen-details {
  animation: slideIn 0.3s ease-in-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.detail-label {
  font-size: 0.75rem;
  color: #666;
}

.detail-value {
  font-size: 0.875rem;
  font-weight: 500;
}
</style>
