<template>
  <v-chip
    v-bind="$attrs"
    :color="chipColor"
    :variant="variant"
    :size="size"
    :label="label"
    class="expired-badge"
    :class="{
      'expired-badge--expired': isExpired,
      'expired-badge--valid': !isExpired && hasExpiration,
      'expired-badge--no-expiration': !hasExpiration
    }"
  >
    <v-icon
      v-if="showIcon"
      :icon="icon"
      :start="iconPosition === 'start'"
      :end="iconPosition === 'end'"
      class="mr-1"
      size="small"
    />
    <slot name="default">
      {{ displayText }}
    </slot>
  </v-chip>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { TipoDocumento } from '@galeno/shared-types';
import {
  calculateExpirationStatus,
  formatExpirationStatus,
  type ExpirationStatus,
} from '@/utils/documentExpiration';

/**
 * ExpiredBadge - Componente visual para mostrar el estado de caducidad de documentos
 *
 * Muestra un badge con código de colores:
 * - Verde (#4CAF50): Documento vigente
 * - Rojo (#F44336): Documento caducado
 * - Azul (#2196F3): Documento que no caduca
 */

interface Props {
  /** Tipo de documento para calcular caducidad */
  tipo: TipoDocumento;
  /** Fecha de emisión del documento */
  fechaEmision: Date | string;
  /** Fecha de referencia para cálculo (default: hoy) */
  fechaReferencia?: Date | string;
  /** Tamaño del chip: 'x-small', 'small', 'default', 'large', 'x-large' */
  size?: 'x-small' | 'small' | 'default' | 'large' | 'x-large';
  /** Variante del chip: 'flat', 'elevated', 'tonal', 'outlined', 'text', 'plain' */
  variant?: 'flat' | 'elevated' | 'tonal' | 'outlined' | 'text' | 'plain';
  /** Si es true, muestra solo el icono como label */
  label?: boolean;
  /** Si es true, muestra el icono junto al texto */
  showIcon?: boolean;
  /** Posición del icono: 'start' o 'end' */
  iconPosition?: 'start' | 'end';
  /** Texto personalizado (sobrescribe el texto calculado) */
  customText?: string;
}

const props = withDefaults(defineProps<Props>(), {
  size: 'small',
  variant: 'tonal',
  label: false,
  showIcon: true,
  iconPosition: 'start',
  customText: undefined,
  fechaReferencia: () => new Date(),
});

// Calcular estado de caducidad
const expirationStatus = computed<ExpirationStatus>(() =>
  calculateExpirationStatus(
    props.tipo,
    props.fechaEmision,
    props.fechaReferencia
  )
);

// Determinar si está caducado
const isExpired = computed(() => expirationStatus.value.isExpired);

// Determinar si tiene expiración configurable
const hasExpiration = computed(() => expirationStatus.value.hasExpiration);

// Obtener texto formateado
const displayText = computed(() =>
  props.customText || expirationStatus.value.statusText
);

// Obtener color del chip
const chipColor = computed(() => {
  const { color } = formatExpirationStatus(expirationStatus.value);
  return color;
});

// Obtener icono
const icon = computed(() => {
  const { icon } = formatExpirationStatus(expirationStatus.value);
  return icon;
});
</script>

<style scoped>
.expired-badge {
  font-weight: 500;
  transition: all 0.3s ease;
}

.expired-badge--expired {
  border-width: 1px;
}

.expired-badge--valid {
  border-width: 1px;
}

.expired-badge--no-expiration {
  border-width: 1px;
}
</style>
