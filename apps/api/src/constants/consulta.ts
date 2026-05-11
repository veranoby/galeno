// apps/api/src/constants/consulta.ts
/**
 * Constantes para el sistema de consultas
 *
 * Centraliza todos los magic strings y números relacionados con consultas
 */

// ============= ESTADOS DE CONSULTA =============
export const CONSULTA_ESTADOS = {
  PENDIENTE: 'pendiente',
  EN_ATENCION: 'en_atencion',
  FINALIZADA: 'finalizada',
  BORRADOR: 'borrador',
  CANCELADA: 'cancelada'
} as const;

// ============= TIPOS DE CONSULTA =============
export const CONSULTA_TIPOS = {
  PRESENCIAL: 'presencial',
  TELECONSULTA: 'teleconsulta',
  INTERCONSULTA: 'interconsulta'
} as const;

// ============= LÍMITES Y CUOTAS =============
export const CONSULTA_LIMITES = {
  MAX_MOTIVO_LENGTH: 500,
  MAX_NOTAS_LENGTH: 2000,
  MAX_ADJUNTOS: 10,
  MAX_DURACION_MINUTOS: 120,
  DEFAULT_DURACION_MINUTOS: 30
} as const;

// ============= PRIORIDADES DE TRIAGE =============
export const TRIAGE_PRIORIDADES = {
  BAJA: 'baja',
  MEDIA: 'media',
  ALTA: 'alta',
  CRITICA: 'critica'
} as const;

// ============= ESTADOS DE FIRMA =============
export const FIRMA_ESTADOS = {
  PENDIENTE: 'pendiente',
  FIRMADA: 'firmada',
  RECHAZADA: 'rechazada'
} as const;
