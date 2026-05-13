<!-- apps/web/src/modules/odontograma/DienteGroup.vue -->
<template>
  <g
    class="diente-group"
    :class="{ 'diente-seleccionado': seleccionado, 'diente-extra': diente.extra }"
    :transform="`translate(${x}, ${y})`"
    @click="handleClick"
  >
    <!-- Número del diente -->
    <text
      :x="DIENTE_WIDTH / 2"
      y="-5"
      text-anchor="middle"
      class="diente-label"
      :class="{ 'diente-extra': diente.extra }"
    >
      {{ diente.id }}
    </text>

    <!-- Círculo de fondo indicando estado -->
    <circle
      :cx="DIENTE_WIDTH / 2"
      :cy="DIENTE_HEIGHT / 2"
      :r="DIENTE_WIDTH / 2 - 2"
      :fill="estadoColor"
      :stroke="seleccionado ? '#1976D2' : '#666'"
      :stroke-width="seleccionado ? 3 : 1"
      class="diente-bg"
    />

    <!-- Símbolo del diente (simplificado) -->
    <g class="diente-symbol" fill="#ffffff">
      <!-- Corona -->
      <path
        :d="coronaPath"
        :opacity="diente.estado === 'extraccion' || diente.estado === 'ausente' ? 0.3 : 1"
      />

      <!-- Raíz -->
      <path
        v-if="mostrarRaiz"
        :d="raizPath"
        :opacity="diente.estado === 'extraccion' || diente.estado === 'ausente' ? 0.3 : 1"
      />
    </g>

    <!-- Indicadores de caras afectadas -->
    <g v-if="hasCarasAfectadas" class="caras-indicadores">
      <circle
        v-for="(tratamiento, cara) in diente.caras"
        :key="cara"
        :cx="caraPosicion[cara]?.x || DIENTE_WIDTH / 2"
        :cy="caraPosicion[cara]?.y || DIENTE_HEIGHT / 2"
        r="3"
        :fill="ESTADO_COLORS[tratamiento.estado]"
        class="cara-indicador"
      />
    </g>

    <!-- Indicador de diente extra (leche) -->
    <text
      v-if="diente.extra"
      :x="DIENTE_WIDTH - 2"
      :y="DIENTE_HEIGHT - 2"
      text-anchor="end"
      class="diente-extra-mark"
      fill="#666"
      font-size="8"
    >
      e
    </text>
  </g>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { DienteInfo, CaraDiente } from './types';
import { ESTADO_COLORS } from './types';

interface Props {
  diente: DienteInfo;
  seleccionado: boolean;
  soloLectura: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'click', diente: DienteInfo): void;
}>();

// Constantes
const DIENTE_WIDTH = 30;
const DIENTE_HEIGHT = 40;

// Calcular posición X basada en la posición del diente en el cuadrante
const x = computed(() => {
  const offset = (props.diente.posicion - 1) * (DIENTE_WIDTH + 10);
  return offset;
});

// Calcular posición Y (por ahora es fija, pero podría variar por arcada)
const y = computed(() => {
  return 20;
});

// Color del estado del diente
const estadoColor = computed(() => {
  return ESTADO_COLORS[props.diente.estado] || ESTADO_COLORS.sano;
});

// Si mostrar raíz (no para dientes extraídos o ausentes)
const mostrarRaiz = computed(() => {
  return props.diente.estado !== 'extraccion' && props.diente.estado !== 'ausente';
});

// Path de la corona del diente
const coronaPath = computed(() => {
  const w = DIENTE_WIDTH;
  const h = DIENTE_HEIGHT;
  const coronaHeight = h * 0.6;

  // Path simplificado de la corona
  return `
    M ${w * 0.2} ${coronaHeight * 0.3}
    Q ${w * 0.5} 0 ${w * 0.8} ${coronaHeight * 0.3}
    L ${w * 0.85} ${coronaHeight * 0.8}
    Q ${w * 0.5} ${coronaHeight * 0.9} ${w * 0.15} ${coronaHeight * 0.8}
    Z
  `;
});

// Path de la raíz del diente
const raizPath = computed(() => {
  const w = DIENTE_WIDTH;
  const h = DIENTE_HEIGHT;
  const coronaHeight = h * 0.6;
  const raizHeight = h - coronaHeight;

  // Path simplificado de la raíz
  return `
    M ${w * 0.35} ${coronaHeight * 0.8}
    Q ${w * 0.4} ${h - 2} ${w * 0.45} ${h - 2}
    Q ${w * 0.5} ${h - 2} ${w * 0.55} ${h - 2}
    Q ${w * 0.6} ${h - 2} ${w * 0.65} ${coronaHeight * 0.8}
  `;
});

// Posición de indicadores de caras
const caraPosicion: Record<CaraDiente, { x: number; y: number }> = {
  oclusal: { x: DIENTE_WIDTH / 2, y: DIENTE_HEIGHT * 0.2 },
  vestibular: { x: DIENTE_WIDTH / 2, y: DIENTE_HEIGHT * 0.4 },
  palatino: { x: DIENTE_WIDTH / 2, y: DIENTE_HEIGHT * 0.6 },
  mesial: { x: DIENTE_WIDTH * 0.2, y: DIENTE_HEIGHT * 0.5 },
  distal: { x: DIENTE_WIDTH * 0.8, y: DIENTE_HEIGHT * 0.5 },
  raiz: { x: DIENTE_WIDTH / 2, y: DIENTE_HEIGHT * 0.8 },
};

// Verificar si tiene caras afectadas
const hasCarasAfectadas = computed(() => {
  return Object.keys(props.diente.caras).length > 0;
});

// Manejar click
function handleClick(): void {
  if (!props.soloLectura) {
    emit('click', props.diente);
  }
}
</script>

<style scoped>
.diente-group {
  cursor: pointer;
  transition: all 0.2s ease;
}

.diente-group:hover {
  opacity: 0.8;
}

.diente-seleccionado .diente-bg {
  filter: brightness(1.1);
}

.diente-label {
  font-size: 12px;
  font-weight: 600;
  fill: #333;
}

.diente-extra .diente-label {
  fill: #999;
}

.diente-extra-mark {
  opacity: 0.7;
}

.cara-indicador {
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}
</style>
