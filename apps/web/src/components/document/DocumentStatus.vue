<template>
  <div class="document-status" :class="{ 'document-status--compact': compact }">
    <!-- Header del documento -->
    <div class="document-status__header">
      <v-icon
        :icon="documentIcon"
        :color="statusColor"
        :size="compact ? 'small' : 'medium'"
        class="document-status__icon"
      />
      
      <div class="document-status__info">
        <div class="document-status__title">
          <slot name="title">
            {{ titulo || tipoDocumentoLabel }}
          </slot>
        </div>
        
        <div
          v-if="!compact"
          class="document-status__subtitle"
        >
          <slot name="subtitle">
            {{ subtitulo }}
          </slot>
        </div>
      </div>

      <!-- Badge de caducidad -->
      <ExpiredBadge
        :tipo="tipo"
        :fecha-emision="fechaEmision"
        :fecha-referencia="fechaReferencia"
        :size="compact ? 'x-small' : 'small'"
        :variant="variant"
        :custom-text="compact ? undefined : customBadgeText"
      />
    </div>

    <!-- Detalles adicionales -->
    <div
      v-if="!compact && showDetails"
      class="document-status__details"
    >
      <v-divider class="mb-2" />
      
      <div class="document-status__detail-row">
        <span class="document-status__detail-label">Fecha de emisión:</span>
        <span class="document-status__detail-value">
          {{ formatDate(fechaEmision) }}
        </span>
      </div>

      <div
        v-if="expirationDate"
        class="document-status__detail-row"
      >
        <span class="document-status__detail-label">Fecha de caducidad:</span>
        <span
          class="document-status__detail-value"
          :class="{ 'text-error': isExpired }"
        >
          {{ formatDate(expirationDate) }}
        </span>
      </div>

      <div class="document-status__detail-row">
        <span class="document-status__detail-label">Estado:</span>
        <span
          class="document-status__detail-value"
          :style="{ color: statusColor }"
        >
          {{ statusText }}
        </span>
      </div>

      <!-- Slot para contenido adicional -->
      <slot name="details" />
    </div>

    <!-- Acciones -->
    <div
      v-if="$slots.actions"
      class="document-status__actions"
    >
      <v-divider class="mb-2" />
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { TipoDocumento } from '@galeno/shared-types';
import {
  calculateExpirationStatus,
  calculateExpirationDate,
  getExpirationColor,
  type ExpirationStatus,
} from '@/utils/documentExpiration';
import ExpiredBadge from './ExpiredBadge.vue';

/**
 * DocumentStatus - Componente compuesto para mostrar información completa del documento
 *
 * Combina:
 * - Icono del documento
 * - Título y subtítulo
 * - ExpiredBadge para estado de caducidad
 * - Detalles adicionales (fechas, estado)
 * - Slots para acciones personalizadas
 */

interface Props {
  /** Tipo de documento */
  tipo: TipoDocumento;
  /** Fecha de emisión del documento */
  fechaEmision: Date | string;
  /** Fecha de referencia para cálculo (default: hoy) */
  fechaReferencia?: Date | string;
  /** Título personalizado del documento */
  titulo?: string;
  /** Subtítulo o descripción adicional */
  subtitulo?: string;
  /** Variante del badge: 'flat', 'elevated', 'tonal', 'outlined', 'text', 'plain' */
  variant?: 'flat' | 'elevated' | 'tonal' | 'outlined' | 'text' | 'plain';
  /** Modo compacto: muestra menos información */
  compact?: boolean;
  /** Mostrar detalles adicionales */
  showDetails?: boolean;
  /** Texto personalizado para el badge */
  customBadgeText?: string;
}

const props = withDefaults(defineProps<Props>(), {
  fechaReferencia: () => new Date(),
  titulo: undefined,
  subtitulo: undefined,
  variant: 'tonal',
  compact: false,
  showDetails: true,
  customBadgeText: undefined,
});

// Calcular estado de caducidad
const expirationStatus = computed<ExpirationStatus>(() =>
  calculateExpirationStatus(
    props.tipo,
    props.fechaEmision,
    props.fechaReferencia
  )
);

// Calcular fecha de expiración
const expirationDate = computed(() =>
  expirationStatus.value.expirationDate
);

// Determinar si está caducado
const isExpired = computed(() => expirationStatus.value.isExpired);

// Obtener color del estado
const statusColor = computed(() =>
  getExpirationColor(expirationStatus.value)
);

// Obtener texto del estado
const statusText = computed(() => expirationStatus.value.statusText);

// Icono según tipo de documento
const documentIcon = computed(() => {
  const iconMap: Record<TipoDocumento, string> = {
    [TipoDocumento.RECETA]: 'mdi-prescription',
    [TipoDocumento.EXAMEN]: 'mdi-test-tube',
    [TipoDocumento.CERTIFICADO]: 'mdi-certificate',
  };
  return iconMap[props.tipo];
});

// Label del tipo de documento
const tipoDocumentoLabel = computed(() => {
  const labelMap: Record<TipoDocumento, string> = {
    [TipoDocumento.RECETA]: 'Receta',
    [TipoDocumento.EXAMEN]: 'Examen',
    [TipoDocumento.CERTIFICADO]: 'Certificado',
  };
  return labelMap[props.tipo];
});

/**
 * Formatea una fecha a formato legible
 */
function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(d.getTime())) {
    return 'Fecha inválida';
  }

  return d.toLocaleDateString('es-EC', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
</script>

<style scoped>
.document-status {
  padding: 16px;
  border-radius: 8px;
  background-color: surface;
  transition: all 0.3s ease;
}

.document-status--compact {
  padding: 8px 12px;
}

.document-status__header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.document-status__icon {
  flex-shrink: 0;
}

.document-status__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.document-status__title {
  font-size: 14px;
  font-weight: 500;
  color: rgba(var(--v-theme-on-surface), 0.87);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.document-status__subtitle {
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.document-status__details {
  margin-top: 12px;
  font-size: 13px;
}

.document-status__detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
}

.document-status__detail-label {
  color: rgba(var(--v-theme-on-surface), 0.6);
  font-weight: 400;
}

.document-status__detail-value {
  color: rgba(var(--v-theme-on-surface), 0.87);
  font-weight: 500;
  text-align: right;
}

.document-status__actions {
  margin-top: 12px;
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
</style>
