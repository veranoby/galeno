// apps/web/src/constants/chip-types.ts
/**
 * Constantes compartidas para tipos de chips (IA suggestions)
 * Centraliza los tipos y colores para evitar duplicación
 */

/**
 * Tipos de chips disponibles en el sistema
 */
export enum ChipTipo {
  AZUL = 'azul',
  VERDE = 'verde',
  AMARILLO = 'amarillo',
  ROJO = 'rojo'
}

/**
 * Colores hexadecimales asociados a cada tipo de chip
 */
export const CHIP_COLORS = {
  [ChipTipo.AZUL]: '#1976D2',
  [ChipTipo.VERDE]: '#43A047',
  [ChipTipo.AMARILLO]: '#F57C00',
  [ChipTipo.ROJO]: '#C62828'
} as const;

/**
 * Nombres descriptivos para cada tipo de chip
 */
export const CHIP_NAMES = {
  [ChipTipo.AZUL]: 'Información',
  [ChipTipo.VERDE]: 'Medicamento',
  [ChipTipo.AMARILLO]: 'Examen',
  [ChipTipo.ROJO]: 'Alerta'
} as const;

/**
 * Iconos de Vuetify asociados a cada tipo de chip
 */
export const CHIP_ICONS = {
  [ChipTipo.AZUL]: 'mdi-information',
  [ChipTipo.VERDE]: 'mdi-pill',
  [ChipTipo.AMARILLO]: 'mdi-test-tube',
  [ChipTipo.ROJO]: 'mdi-alert'
} as const;

/**
 * Tipos de sugerencias de tratamiento
 */
export enum SugerenciaTipo {
  MEDICAMENTO = 'medicamento',
  EXAMEN = 'examen',
  ALERTA = 'alerta'
}

/**
 * Mapeo de tipo de sugerencia a tipo de chip
 */
export const SUGERENCIA_TO_CHIP: Record<SugerenciaTipo, ChipTipo> = {
  [SugerenciaTipo.MEDICAMENTO]: ChipTipo.VERDE,
  [SugerenciaTipo.EXAMEN]: ChipTipo.AMARILLO,
  [SugerenciaTipo.ALERTA]: ChipTipo.ROJO
} as const;

/**
 * Valores de confianza por defecto para cada tipo de sugerencia
 */
export const DEFAULT_CONFIDENCE: Record<SugerenciaTipo, number> = {
  [SugerenciaTipo.MEDICAMENTO]: 0.85,
  [SugerenciaTipo.EXAMEN]: 0.78,
  [SugerenciaTipo.ALERTA]: 0.92
} as const;

/**
 * Genera una clave única para un chip
 * @param tipo - Tipo de sugerencia
 * @param id - Identificador del item
 * @returns Clave única para el chip
 */
export function generateChipKey(tipo: SugerenciaTipo, id: string): string {
  return `${tipo}-${id}`;
}
