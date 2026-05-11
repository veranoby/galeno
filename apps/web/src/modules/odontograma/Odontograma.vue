<!-- apps/web/src/modules/odontograma/Odontograma.vue -->
<template>
  <div class="odontograma-container">
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon icon="mdi-tooth" class="mr-2" />
        <span>Odontograma</span>
        <v-spacer />
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
        Selecciona un diente para agregar tratamientos
      </v-card-subtitle>

      <v-card-text>
        <!-- Controles del odontograma -->
        <div class="odontograma-controls mb-4">
          <v-chip-group v-model="estadoSeleccionado" mandatory>
            <v-chip
              v-for="(color, estado) in ESTADO_COLORS"
              :key="estado"
              :color="color"
              :value="estado"
              filter
              :disabled="context.readonly"
            >
              {{ capitalize(estado) }}
            </v-chip>
          </v-chip-group>
        </div>

        <!-- Visualización del odontograma -->
        <div class="odontograma-wrapper">
          <svg
            :viewBox="`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`"
            class="odontograma-svg"
            xmlns="http://www.w3.org/2000/svg"
          >
            <!-- Cuadrante superior derecho (1) -->
            <g :transform="`translate(${MARGIN}, ${MARGIN})`">
              <text x="70" y="-10" text-anchor="middle" class="cuadrante-label">1</text>
              <text x="70" y="210" text-anchor="middle" class="cuadrante-label">2</text>
              <DienteGroup
                v-for="diente in dientesCuadrante1"
                :key="diente.id"
                :diente="diente"
                :seleccionado="dienteSeleccionado?.id === diente.id"
                :solo-lectura="context.readonly"
                @click="seleccionarDiente(diente)"
              />
            </g>

            <!-- Cuadrante superior izquierdo (2) -->
            <g :transform="`translate(${VIEWBOX_WIDTH / 2 + MARGIN / 2}, ${MARGIN})`">
              <DienteGroup
                v-for="diente in dientesCuadrante2"
                :key="diente.id"
                :diente="diente"
                :seleccionado="dienteSeleccionado?.id === diente.id"
                :solo-lectura="context.readonly"
                @click="seleccionarDiente(diente)"
              />
            </g>

            <!-- Cuadrante inferior izquierdo (3) -->
            <g :transform="`translate(${VIEWBOX_WIDTH / 2 + MARGIN / 2}, ${VIEWBOX_HEIGHT / 2 + MARGIN / 2})`">
              <DienteGroup
                v-for="diente in dientesCuadrante3"
                :key="diente.id"
                :diente="diente"
                :seleccionado="dienteSeleccionado?.id === diente.id"
                :solo-lectura="context.readonly"
                @click="seleccionarDiente(diente)"
              />
            </g>

            <!-- Cuadrante inferior derecho (4) -->
            <g :transform="`translate(${MARGIN}, ${VIEWBOX_HEIGHT / 2 + MARGIN / 2})`">
              <DienteGroup
                v-for="diente in dientesCuadrante4"
                :key="diente.id"
                :diente="diente"
                :seleccionado="dienteSeleccionado?.id === diente.id"
                :solo-lectura="context.readonly"
                @click="seleccionarDiente(diente)"
              />
            </g>
          </svg>
        </div>

        <!-- Panel de detalles del diente seleccionado -->
        <v-expand-transition>
          <div v-if="dienteSeleccionado" class="diente-details mt-4">
            <v-divider class="mb-4" />
            <v-card variant="outlined">
              <v-card-title>
                Diente {{ dienteSeleccionado.id }} - {{ tipoDienteLabel(dienteSeleccionado.tipo) }}
              </v-card-title>
              <v-card-text>
                <v-row>
                  <v-col cols="12" md="6">
                    <v-select
                      v-model="dienteSeleccionado.estado"
                      :items="estadosOptions"
                      label="Estado del diente"
                      :disabled="context.readonly"
                      @update:model-value="actualizarEstadoDiente"
                    />
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-textarea
                      v-model="dienteSeleccionado.observaciones"
                      label="Observaciones"
                      rows="2"
                      :disabled="context.readonly"
                    />
                  </v-col>
                </v-row>

                <!-- Selección de caras -->
                <div v-if="!context.readonly" class="caras-selector mt-4">
                  <h4 class="text-subtitle-2 mb-2">Caras del diente:</h4>
                  <v-chip-group v-model="carasSeleccionadas" multiple>
                    <v-chip
                      v-for="cara in carasDisponibles"
                      :key="cara"
                      :value="cara"
                      filter
                      :disabled="context.readonly"
                    >
                      {{ capitalize(cara) }}
                    </v-chip>
                  </v-chip-group>
                </div>

                <!-- Resumen de tratamientos por cara -->
                <div v-if="tieneTratamientosPorCara" class="tratamientos-resumen mt-4">
                  <h4 class="text-subtitle-2 mb-2">Tratamientos por cara:</h4>
                  <v-chip-group>
                    <v-chip
                      v-for="(tratamiento, cara) in dienteSeleccionado.caras"
                      :key="cara"
                      :color="ESTADO_COLORS[(tratamiento?.estado || 'pendiente') as EstadoDiente]"
                      size="small"
                    >
                      {{ capitalize(cara) }}: {{ capitalize(tratamiento?.estado || '') }}
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
  DienteInfo,
  EstadoDiente,
  CaraDiente,
  DienteId,
  TipoDiente,
  Cuadrante,
} from './types';
import {
  ESTADO_COLORS,
  TIPO_DIENTE_POR_POSICION,
  ODONTOGRAMA_CONSTANTS,
} from './types';

interface Props {
  context: ModuleContext;
  emitEvent: (event: ModuleEvent) => void;
}

const props = defineProps<Props>();

// Constantes de diseño
const VIEWBOX_WIDTH = 400;
const VIEWBOX_HEIGHT = 500;
const MARGIN = 20;
const DIENTE_WIDTH = 30;
const DIENTE_HEIGHT = 40;
const DIENTE_GAP = 10;

// Estado
const dientes = ref<Record<DienteId, DienteInfo>>({});
const dienteSeleccionado = ref<DienteInfo | null>(null);
const estadoSeleccionado = ref<EstadoDiente>('sano');
const carasSeleccionadas = ref<CaraDiente[]>([]);
const guardando = ref(false);

// Opciones para el select de estado
const estadosOptions: { title: string; value: EstadoDiente }[] = Object.keys(ESTADO_COLORS).map(
  (estado) => ({
    title: capitalize(estado),
    value: estado as EstadoDiente,
  })
);

// Caras disponibles
const carasDisponibles: CaraDiente[] = [
  'oclusal',
  'vestibular',
  'palatino',
  'mesial',
  'distal',
  'raiz',
];

// Generar dientes por defecto
function generarDientesPorDefecto(): Record<DienteId, DienteInfo> {
  const dientes: Record<DienteId, DienteInfo> = {};

  // Cuadrantes permanentes (1-4)
  for (let cuadrante of [1, 2, 3, 4]) {
    for (let posicion = 1; posicion <= 8; posicion++) {
      const id: DienteId = `${cuadrante}${posicion}`;
      dientes[id] = crearDiente(id, cuadrante as Cuadrante, posicion, false);
    }
  }

  return dientes;
}

// Crear un diente
function crearDiente(
  id: DienteId,
  cuadrante: Cuadrante,
  posicion: number,
  extra: boolean
): DienteInfo {
  return {
    id,
    cuadrante,
    posicion,
    tipo: TIPO_DIENTE_POR_POSICION[posicion] || 'molar',
    extra,
    seleccionado: false,
    caras: {},
    estado: 'sano',
    observaciones: undefined,
  };
}

// Dientes por cuadrante
const dientesCuadrante1 = computed(() =>
  Object.values(dientes.value).filter((d) => d.cuadrante === 1)
);
const dientesCuadrante2 = computed(() =>
  Object.values(dientes.value).filter((d) => d.cuadrante === 2)
);
const dientesCuadrante3 = computed(() =>
  Object.values(dientes.value).filter((d) => d.cuadrante === 3)
);
const dientesCuadrante4 = computed(() =>
  Object.values(dientes.value).filter((d) => d.cuadrante === 4)
);

// Verificar si tiene tratamientos por cara
const tieneTratamientosPorCara = computed(() => {
  return (
    dienteSeleccionado.value &&
    Object.keys(dienteSeleccionado.value.caras).length > 0
  );
});

// Seleccionar un diente
function seleccionarDiente(diente: DienteInfo): void {
  if (props.context.readonly) return;

  // Deseleccionar el anterior
  if (dienteSeleccionado.value) {
    dienteSeleccionado.value.seleccionado = false;
  }

  // Seleccionar el nuevo
  diente.seleccionado = true;
  dienteSeleccionado.value = diente;

  // Actualizar caras seleccionadas
  carasSeleccionadas.value = Object.keys(diente.caras) as CaraDiente[];
}

// Actualizar estado del diente
function actualizarEstadoDiente(estado: EstadoDiente): void {
  if (!dienteSeleccionado.value) return;

  dienteSeleccionado.value.estado = estado;

  // Si hay caras seleccionadas, actualizarlas también
  carasSeleccionadas.value.forEach((cara) => {
    dienteSeleccionado.value!.caras[cara] = {
      cara,
      estado,
      fecha: new Date(),
    };
  });

  emitirCambioDatos();
}

// Capitalizar primera letra
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Etiqueta del tipo de diente
function tipoDienteLabel(tipo: TipoDiente): string {
  return capitalize(tipo);
}

// Emitir evento de cambio de datos
function emitirCambioDatos(): void {
  props.emitEvent({
    type: 'data-changed',
    payload: {
      odontograma: {
        dientes: dientes.value,
        fechaActualizacion: new Date(),
      },
    },
  });
}

// Guardar datos
async function guardar(): Promise<void> {
  guardando.value = true;
  try {
    props.emitEvent({
      type: 'save',
      payload: {
        odontograma: {
          dientes: dientes.value,
          fechaActualizacion: new Date(),
        },
      },
    });
  } finally {
    setTimeout(() => {
      guardando.value = false;
    }, 500);
  }
}

// Watch para cambios en caras seleccionadas
watch(carasSeleccionadas, (nuevasCaras) => {
  if (!dienteSeleccionado.value) return;

  // Actualizar caras del diente con el estado seleccionado
  const estado = estadoSeleccionado.value;

  // Remover caras que ya no están seleccionadas
  Object.keys(dienteSeleccionado.value.caras).forEach((cara) => {
    if (!nuevasCaras.includes(cara as CaraDiente)) {
      delete dienteSeleccionado.value!.caras[cara as CaraDiente];
    }
  });

  // Agregar nuevas caras
  nuevasCaras.forEach((cara) => {
    if (!dienteSeleccionado.value!.caras[cara]) {
      dienteSeleccionado.value!.caras[cara] = {
        cara,
        estado,
        fecha: new Date(),
      };
    }
  });

  emitirCambioDatos();
});

// Inicialización
onMounted(() => {
  // Cargar datos del contexto si existen
  if (props.context.data?.odontograma) {
    const datosGuardados = props.context.data.odontograma as any;
    dientes.value = datosGuardados.dientes || generarDientesPorDefecto();
  } else {
    dientes.value = generarDientesPorDefecto();
  }
});
</script>

<style scoped>
.odontograma-container {
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
}

.odontograma-controls {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.odontograma-wrapper {
  display: flex;
  justify-content: center;
  padding: 1rem;
  background: #f5f5f5;
  border-radius: 8px;
}

.odontograma-svg {
  width: 100%;
  max-width: 500px;
  height: auto;
}

.cuadrante-label {
  font-size: 14px;
  font-weight: 600;
  fill: #666;
}

.diente-details {
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

.caras-selector,
.tratamientos-resumen {
  padding: 1rem;
  background: #f9f9f9;
  border-radius: 4px;
}
</style>
