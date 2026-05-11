<!-- apps/web/src/modules/crecimiento/CurvasCrecimiento.vue -->
<template>
  <div class="curvas-crecimiento-container">
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon icon="mdi-chart-line" class="mr-2" />
        <span>Curvas de Crecimiento</span>
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
        Seguimiento del crecimiento según estándares OMS
      </v-card-subtitle>

      <v-card-text>
        <!-- Configuración del paciente -->
        <v-row class="mb-4">
          <v-col cols="12" sm="6" md="3">
            <v-select
              v-model="sexo"
              :items="sexos"
              label="Sexo"
              :disabled="context.readonly"
              @update:model-value="cambiarSexo"
            />
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <v-text-field
              v-model="fechaNacimiento"
              type="date"
              label="Fecha de nacimiento"
              :disabled="context.readonly"
              @update:model-value="actualizarEdad"
            />
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <v-text-field
              :model-value="edadLabel"
              label="Edad actual"
              readonly
            />
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <v-select
              v-model="curvaActiva"
              :items="tiposCurva"
              label="Tipo de curva"
              @update:model-value="cambiarCurva"
            />
          </v-col>
        </v-row>

        <!-- Tabs de tipos de medición -->
        <v-tabs v-model="curvaActiva" align-tabs="start" class="mb-4">
          <v-tab
            v-for="tipo in tiposCurva"
            :key="tipo.value"
            :value="tipo.value"
          >
            {{ tipo.label }}
          </v-tab>
        </v-tabs>

        <!-- Gráfico de curvas -->
        <div class="curvas-chart-wrapper">
          <svg
            :viewBox="`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`"
            class="curvas-chart"
            xmlns="http://www.w3.org/2000/svg"
          >
            <!-- Grid y ejes -->
            <g class="grid">
              <!-- Líneas horizontales -->
              <line
                v-for="i in 11"
                :key="`h-${i}`"
                :x1="MARGIN_LEFT"
                :y1="MARGIN_TOP + (i - 1) * (CHART_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM) / 10"
                :x2="CHART_WIDTH - MARGIN_RIGHT"
                :y2="MARGIN_TOP + (i - 1) * (CHART_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM) / 10"
                stroke="#e0e0e0"
                stroke-width="1"
              />

              <!-- Líneas verticales -->
              <line
                v-for="i in 7"
                :key="`v-${i}`"
                :x1="MARGIN_LEFT + (i - 1) * (CHART_WIDTH - MARGIN_LEFT - MARGIN_RIGHT) / 6"
                :y1="MARGIN_TOP"
                :x2="MARGIN_LEFT + (i - 1) * (CHART_WIDTH - MARGIN_LEFT - MARGIN_RIGHT) / 6"
                :y2="CHART_HEIGHT - MARGIN_BOTTOM"
                stroke="#e0e0e0"
                stroke-width="1"
              />
            </g>

            <!-- Eje Y - Valores -->
            <g class="y-axis">
              <text
                v-for="(label, i) in yAxisLabels"
                :key="`y-${i}`"
                :x="MARGIN_LEFT - 10"
                :y="MARGIN_TOP + i * (CHART_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM) / 10"
                text-anchor="end"
                dominant-baseline="middle"
                class="axis-label"
              >
                {{ label }}
              </text>
            </g>

            <!-- Eje X - Edad en meses -->
            <g class="x-axis">
              <text
                v-for="(label, i) in xAxisLabels"
                :key="`x-${i}`"
                :x="MARGIN_LEFT + i * (CHART_WIDTH - MARGIN_LEFT - MARGIN_RIGHT) / 6"
                :y="CHART_HEIGHT - MARGIN_BOTTOM + 20"
                text-anchor="middle"
                class="axis-label"
              >
                {{ label }}
              </text>
            </g>

            <!-- Curvas de percentiles -->
            <g class="curvas-percentiles">
              <path
                v-for="percentil in percentilesVisibles"
                :key="percentil"
                :d="generarPathCurva(percentil)"
                :stroke="COLOR_PERCENTIL[percentil]"
                :stroke-width="percentil === 'p50' ? 3 : 2"
                :stroke-dasharray="percentil === 'p50' ? 'none' : '5,5'"
                fill="none"
                class="curva-line"
              />

              <!-- Etiquetas de percentiles -->
              <text
                v-for="percentil in percentilesVisibles"
                :key="`label-${percentil}`"
                :x="CHART_WIDTH - MARGIN_RIGHT + 5"
                :y="getYForValue(curvaReferencia?.[percentil]?.[0] || 0)"
                dominant-baseline="middle"
                :fill="COLOR_PERCENTIL[percentil]"
                class="percentil-label"
              >
                {{ PERCENTIL_LABELS[percentil] }}
              </text>
            </g>

            <!-- Zonas de alerta -->
            <g v-if="mostrarZonasAlerta" class="zonas-alerta">
              <!-- Zona baja (bajo P3) -->
              <path
                :d="generarPathZona('p3', 'bottom')"
                fill="rgba(211, 47, 47, 0.1)"
                stroke="none"
              />

              <!-- Zona alta (sobre P97) -->
              <path
                :d="generarPathZona('p97', 'top')"
                fill="rgba(211, 47, 47, 0.1)"
                stroke="none"
              />
            </g>

            <!-- Puntos de mediciones del paciente -->
            <g class="puntos-paciente">
              <circle
                v-for="(medicion, i) in medicionesFiltradas"
                :key="medicion.id"
                :cx="getXForMes(medicion.edadMeses)"
                :cy="getYForValue(medicion.valor)"
                :r="6"
                :fill="getColorPorClasificacion(medicion.clasificacion)"
                stroke="#fff"
                stroke-width="2"
                class="punto-medicion"
              />

              <!-- Línea conectando mediciones -->
              <path
                v-if="medicionesFiltradas.length > 1"
                :d="generarPathMediciones()"
                :stroke="COLOR_LINEA_MEDICIONES"
                stroke-width="2"
                fill="none"
                stroke-dasharray="4,4"
              />
            </g>
          </svg>
        </div>

        <!-- Leyenda -->
        <div class="leyenda mt-4">
          <v-chip-group>
            <v-chip size="small" :color="COLOR_PERCENTIL.p3" variant="outlined">
              P3 (Muy bajo)
            </v-chip>
            <v-chip size="small" :color="COLOR_PERCENTIL.p15" variant="outlined">
              P15 (Bajo)
            </v-chip>
            <v-chip size="small" :color="COLOR_PERCENTIL.p50" variant="outlined">
              P50 (Normal)
            </v-chip>
            <v-chip size="small" :color="COLOR_PERCENTIL.p85" variant="outlined">
              P85 (Normal)
            </v-chip>
            <v-chip size="small" :color="COLOR_PERCENTIL.p97" variant="outlined">
              P97 (Alto)
            </v-chip>
          </v-chip-group>
        </div>

        <!-- Lista de mediciones -->
        <div class="mediciones-list mt-4">
          <v-divider class="mb-4" />
          <div class="d-flex justify-space-between align-center mb-2">
            <h3 class="text-h6">Mediciones registradas</h3>
            <v-btn
              v-if="!context.readonly"
              size="small"
              color="primary"
              @click="mostrarDialogoNuevaMedicion = true"
            >
              <v-icon icon="mdi-plus" class="mr-1" />
              Agregar medición
            </v-btn>
          </div>

          <v-list>
            <v-list-item
              v-for="medicion in mediciones"
              :key="medicion.id"
              :title="`${medicion.valor} ${UNIDAD_LABELS[medicion.unidad]}`"
              :subtitle="`${formatDate(medicion.fecha)} - ${medicion.edadMeses} meses`"
            >
              <template #prepend>
                <v-icon
                  :color="getColorPorClasificacion(medicion.clasificacion)"
                  icon="mdi-circle"
                  size="x-small"
                />
              </template>

              <template #append>
                <v-chip size="x-small" :color="getColorPorClasificacion(medicion.clasificacion)">
                  {{ PERCENTIL_LABELS[medicion.percentil] }}
                </v-chip>
                <v-btn
                  v-if="!context.readonly"
                  icon="mdi-delete"
                  size="x-small"
                  variant="text"
                  class="ml-2"
                  @click="eliminarMedicion(medicion.id)"
                />
              </template>
            </v-list-item>

            <v-list-item v-if="mediciones.length === 0" subtitle="No hay mediciones registradas" />
          </v-list>
        </div>
      </v-card-text>
    </v-card>

    <!-- Diálogo para nueva medición -->
    <v-dialog v-model="mostrarDialogoNuevaMedicion" max-width="500">
      <v-card title="Nueva medición">
        <v-card-text>
          <v-text-field
            v-model="nuevaMedicion.valor"
            type="number"
            :label="`Valor (${getUnidadLabel(curvaActiva)})`"
            step="0.1"
          />
          <v-text-field
            v-model="nuevaMedicion.fecha"
            type="date"
            label="Fecha de medición"
          />
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="mostrarDialogoNuevaMedicion = false">
            Cancelar
          </v-btn>
          <v-btn color="primary" variant="text" @click="agregarMedicion">
            Agregar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import type { ModuleContext, ModuleEvent } from '@/types/module';
import type {
  Sexo,
  TipoMedicion,
  MedicionCrecimiento,
  Percentil,
  ClasificacionNutricional,
} from './types';
import {
  TIPO_MEDICION_LABELS,
  UNIDAD_LABELS,
  PERCENTIL_LABELS,
  CLASIFICACION_COLORS,
  clasificarPercentil,
  getColorPorClasificacion as _getColorPorClasificacion,
} from './types';
import { getCurvaReferencia, calcularPercentil } from './data/oms-curves';

interface Props {
  context: ModuleContext;
  emitEvent: (event: ModuleEvent) => void;
}

const props = defineProps<Props>();

// Constantes del gráfico
const CHART_WIDTH = 800;
const CHART_HEIGHT = 500;
const MARGIN_LEFT = 60;
const MARGIN_RIGHT = 80;
const MARGIN_TOP = 40;
const MARGIN_BOTTOM = 60;

// Colores de percentiles
const COLOR_PERCENTIL: Record<Percentil, string> = {
  p3: '#D32F2F',
  p15: '#F57C00',
  p50: '#388E3C',
  p85: '#388E3C',
  p97: '#FBC02D',
};

const COLOR_LINEA_MEDICIONES = '#1976D2';

// Estado
const sexo = ref<Sexo>('masculino');
const fechaNacimiento = ref<string>(new Date().toISOString().split('T')[0]);
const curvaActiva = ref<TipoMedicion>('peso_edad');
const mediciones = ref<MedicionCrecimiento[]>([]);
const guardando = ref(false);
const mostrarDialogoNuevaMedicion = ref(false);
const mostrarZonasAlerta = ref(true);

// Nueva medición
const nuevaMedicion = ref({
  valor: '',
  fecha: new Date().toISOString().split('T')[0],
});

// Opciones
const sexos = [
  { value: 'masculino' as const, label: 'Masculino' },
  { value: 'femenino' as const, label: 'Femenino' },
];

const tiposCurva = [
  { value: 'peso_edad' as const, label: 'Peso para la Edad' },
  { value: 'talla_edad' as const, label: 'Talla para la Edad' },
  { value: 'peso_talla' as const, label: 'Peso para la Talla' },
  { value: 'imc_edad' as const, label: 'IMC para la Edad' },
];

const percentilesVisibles: Percentil[] = ['p3', 'p15', 'p50', 'p85', 'p97'];

// Curva de referencia actual
const curvaReferencia = computed(() => {
  return getCurvaReferencia(sexo.value, curvaActiva.value);
});

// Mediciones filtradas por tipo
const medicionesFiltradas = computed(() => {
  return mediciones.value
    .filter(m => m.tipo === curvaActiva.value)
    .sort((a, b) => a.edadMeses - b.edadMeses);
});

// Edad actual del paciente
const edadActual = computed(() => {
  const nacimiento = new Date(fechaNacimiento.value);
  const hoy = new Date();
  const diffTime = Math.abs(hoy.getTime() - nacimiento.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 30.44); // Aproximadamente meses
});

const edadLabel = computed(() => {
  const meses = edadActual.value;
  const anos = Math.floor(meses / 12);
  const mesesRestantes = meses % 12;
  return anos > 0 ? `${anos}a ${mesesRestantes}m` : `${meses}m`;
});

// Labels de ejes
const yAxisLabels = computed(() => {
  if (!curvaReferencia.value) return [];

  const allValues = [
    ...curvaReferencia.value.p3,
    ...curvaReferencia.value.p97,
  ];
  const min = Math.floor(Math.min(...allValues));
  const max = Math.ceil(Math.max(...allValues));

  const labels: string[] = [];
  for (let i = 10; i >= 0; i--) {
    const value = min + (i * (max - min) / 10);
    labels.push(value.toFixed(1));
  }
  return labels;
});

const xAxisLabels = ['0', '6m', '1a', '18m', '2a', '3a', '4a', '5a'];

// Helpers para gráfico
function getXForMes(mes: number): number {
  const maxMeses = 60;
  const availableWidth = CHART_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
  return MARGIN_LEFT + (mes / maxMeses) * availableWidth;
}

function getYForValue(valor: number): number {
  if (!curvaReferencia.value) return MARGIN_TOP;

  const allValues = [
    ...curvaReferencia.value.p3,
    ...curvaReferencia.value.p97,
  ];
  const min = Math.floor(Math.min(...allValues));
  const max = Math.ceil(Math.max(...allValues));

  const availableHeight = CHART_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM;
  const normalized = (valor - min) / (max - min);
  return CHART_HEIGHT - MARGIN_BOTTOM - (normalized * availableHeight);
}

// Generar paths SVG
function generarPathCurva(percentil: Percentil): string {
  if (!curvaReferencia.value) return '';

  const datos = curvaReferencia.value[percentil];
  if (!datos) return '';

  let path = '';
  for (let mes = 0; mes <= 60; mes++) {
    const x = getXForMes(mes);
    const y = getYForValue(datos[mes]);
    path += mes === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  }

  return path;
}

function generarPathZona(percentil: Percentil, lado: 'top' | 'bottom'): string {
  if (!curvaReferencia.value) return '';

  const datos = curvaReferencia.value[percentil];
  if (!datos) return '';

  const minY = MARGIN_TOP;
  const maxY = CHART_HEIGHT - MARGIN_BOTTOM;

  let path = '';

  if (lado === 'bottom') {
    // Zona bajo P3
    for (let mes = 0; mes <= 60; mes++) {
      const x = getXForMes(mes);
      const y = getYForValue(datos[mes]);
      path += mes === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    }
    path += ` L ${getXForMes(60)} ${maxY}`;
    path += ` L ${getXForMes(0)} ${maxY} Z`;
  } else {
    // Zona sobre P97
    for (let mes = 0; mes <= 60; mes++) {
      const x = getXForMes(mes);
      const y = getYForValue(datos[mes]);
      path += mes === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    }
    path += ` L ${getXForMes(60)} ${minY}`;
    path += ` L ${getXForMes(0)} ${minY} Z`;
  }

  return path;
}

function generarPathMediciones(): string {
  if (medicionesFiltradas.value.length === 0) return '';

  let path = '';
  medicionesFiltradas.value.forEach((m, i) => {
    const x = getXForMes(m.edadMeses);
    const y = getYForValue(m.valor);
    path += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  });

  return path;
}

// Funciones de utilidad
function getColorPorClasificacion(clasificacion?: ClasificacionNutricional): string {
  if (!clasificacion) return '#666';
  return _getColorPorClasificacion(clasificacion);
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getUnidadLabel(tipo: TipoMedicion): string {
  switch (tipo) {
    case 'peso_edad':
    case 'peso_talla':
      return 'kg';
    case 'talla_edad':
      return 'cm';
    case 'imc_edad':
      return 'kg/m²';
  }
}

// Event handlers
function cambiarSexo(): void {
  recalcularPercentiles();
}

function cambiarCurva(): void {
  // Nada especial, solo se actualiza computed
}

function actualizarEdad(): void {
  // Actualizar edad calculada
}

function recalcularPercentiles(): void {
  mediciones.value.forEach(medicion => {
    const percentil = calcularPercentil(
      sexo.value,
      medicion.tipo,
      medicion.edadMeses,
      medicion.valor
    ) as Percentil;
    medicion.percentil = percentil;
    medicion.clasificacion = clasificarPercentil(percentil);
  });
}

function agregarMedicion(): void {
  if (!nuevaMedicion.valor || !nuevaMedicion.fecha) return;

  const fecha = new Date(nuevaMedicion.fecha);
  const nacimiento = new Date(fechaNacimiento.value);
  const diffTime = Math.abs(fecha.getTime() - nacimiento.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const edadMeses = Math.floor(diffDays / 30.44);

  const valor = parseFloat(nuevaMedicion.valor);

  const percentil = calcularPercentil(
    sexo.value,
    curvaActiva.value,
    edadMeses,
    valor
  ) as Percentil;

  const nuevaMedicionData: MedicionCrecimiento = {
    id: `med-${Date.now()}`,
    fecha,
    edadMeses,
    tipo: curvaActiva.value,
    valor,
    unidad: getUnidadLabel(curvaActiva.value) as any,
    percentil,
    clasificacion: clasificarPercentil(percentil),
  };

  mediciones.value.push(nuevaMedicionData);

  nuevaMedicion.value = {
    valor: '',
    fecha: new Date().toISOString().split('T')[0],
  };

  mostrarDialogoNuevaMedicion.value = false;
  emitirCambioDatos();
}

function eliminarMedicion(id: string): void {
  mediciones.value = mediciones.value.filter(m => m.id !== id);
  emitirCambioDatos();
}

function emitirCambioDatos(): void {
  props.emitEvent({
    type: 'data-changed',
    payload: {
      crecimiento: {
        sexo: sexo.value,
        fechaNacimiento: fechaNacimiento.value,
        mediciones: mediciones.value,
      },
    },
  });
}

async function guardar(): Promise<void> {
  guardando.value = true;
  try {
    props.emitEvent({
      type: 'save',
      payload: {
        crecimiento: {
          sexo: sexo.value,
          fechaNacimiento: fechaNacimiento.value,
          mediciones: mediciones.value,
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
  if (props.context.data?.crecimiento) {
    const datos = props.context.data.crecimiento as any;
    sexo.value = datos.sexo || 'masculino';
    fechaNacimiento.value = datos.fechaNacimiento || new Date().toISOString().split('T')[0];
    mediciones.value = datos.mediciones || [];
  }

  // Datos de ejemplo
  if (mediciones.value.length === 0) {
    const nacimiento = new Date();
    nacimiento.setMonth(nacimiento.getMonth() - 18); // 18 meses

    mediciones.value = [
      {
        id: 'med-1',
        fecha: new Date(nacimiento.getTime() + 6 * 30 * 24 * 60 * 60 * 1000),
        edadMeses: 6,
        tipo: 'peso_edad',
        valor: 7.8,
        unidad: 'kg',
        percentil: 'p50',
        clasificacion: 'normal',
      },
      {
        id: 'med-2',
        fecha: new Date(nacimiento.getTime() + 12 * 30 * 24 * 60 * 60 * 1000),
        edadMeses: 12,
        tipo: 'peso_edad',
        valor: 9.5,
        unidad: 'kg',
        percentil: 'p50',
        clasificacion: 'normal',
      },
      {
        id: 'med-3',
        fecha: new Date(),
        edadMeses: 18,
        tipo: 'peso_edad',
        valor: 10.8,
        unidad: 'kg',
        percentil: 'p50',
        clasificacion: 'normal',
      },
    ];
  }

  recalcularPercentiles();
});
</script>

<style scoped>
.curvas-crecimiento-container {
  width: 100%;
  max-width: 1000px;
  margin: 0 auto;
}

.curvas-chart-wrapper {
  width: 100%;
  overflow-x: auto;
  background: #fafafa;
  border-radius: 8px;
  padding: 1rem;
}

.curvas-chart {
  width: 100%;
  height: auto;
  min-width: 600px;
}

.axis-label {
  font-size: 12px;
  fill: #666;
}

.percentil-label {
  font-size: 11px;
  font-weight: 600;
}

.curva-line {
  transition: stroke-width 0.2s;
}

.curva-line:hover {
  stroke-width: 4 !important;
}

.punto-medicion {
  cursor: pointer;
  transition: r 0.2s;
}

.punto-medicion:hover {
  r: 8 !important;
}

.leyenda {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.mediciones-list {
  max-height: 400px;
  overflow-y: auto;
}
</style>
