// apps/web/src/modules/crecimiento/types.ts

/**
 * Sexo del paciente
 */
export type Sexo = 'masculino' | 'femenino';

/**
 * Tipos de mediciones de crecimiento
 */
export type TipoMedicion =
  | 'peso_edad'           // Peso para la edad
  | 'talla_edad'          // Talla/longitud para la edad
  | 'peso_talla'          // Peso para la talla
  | 'imc_edad';           // Índice de masa corporal para la edad

/**
 * Unidades de medida
 */
export type UnidadMedida = 'kg' | 'cm' | 'm' | 'unidades';

/**
 * Percentiles estándar OMS
 */
export type Percentil = 'p3' | 'p15' | 'p50' | 'p85' | 'p97';

/**
 * Clasificación del estado nutricional
 */
export type ClasificacionNutricional =
  | 'muy_bajo'            // < Percentil 3
  | 'bajo'                // Percentil 3-15
  | 'normal'              // Percentil 15-85
  | 'alto'                // Percentil 85-97
  | 'muy_alto';           // > Percentil 97

/**
 * Datos de una medición de crecimiento
 */
export interface MedicionCrecimiento {
  id: string;
  fecha: Date;
  edadMeses: number;        // Edad en meses al momento de la medición
  tipo: TipoMedicion;
  valor: number;            // Valor de la medición
  unidad: UnidadMedida;
  percentil?: Percentil;    // Percentil calculado
  clasificacion?: ClasificacionNutricional;
  observaciones?: string;
}

/**
 * Registro completo de crecimiento de un paciente
 */
export interface RegistroCrecimiento {
  pacienteId: string;
  sexo: Sexo;
  fechaNacimiento: Date;
  mediciones: MedicionCrecimiento[];
}

/**
 * Datos de un punto en la curva de crecimiento
 */
export interface PuntoCurva {
  edadMeses: number;
  percentil: Percentil;
  valor: number;
}

/**
 * Curva de crecimiento completa para un tipo de medición
 */
export interface CurvaCrecimiento {
  tipo: TipoMedicion;
  sexo: Sexo;
  datos: PuntoCurva[];
}

/**
 * Configuración del visor de curvas
 */
export interface CurvasVisorConfig {
  mostrarPercentiles: Percentil[];
  colorNormal: string;
  colorAlertaBajo: string;
  colorAlertaAlto: string;
  mostrarGuia: boolean;
}

/**
 * Datos del módulo de crecimiento
 */
export interface CrecimientoData {
  registro: RegistroCrecimiento;
  curvaActiva: TipoMedicion;
}

/**
 * Referencias OMS para curvas de crecimiento
 * Basado en WHO Child Growth Standards
 */
export interface OMSReferencia {
  sexo: Sexo;
  tipo: TipoMedicion;
  p3: number[];    // Valores percentil 3 por edad (meses 0-60)
  p15: number[];
  p50: number[];
  p85: number[];
  p97: number[];
}

/**
 * Constantes para el módulo de crecimiento
 */
export const CRECIMIENTO_CONSTANTS = {
  EDAD_MIN_MESES: 0,
  EDAD_MAX_MESES: 60,        // 5 años
  MESES_PUNTO: 1,            // Un punto por mes
  TOTAL_PUNTOS: 61,          // 0-60 meses inclusive
} as const;

/**
 * Mapa de colores para clasificación nutricional
 */
export const CLASIFICACION_COLORS: Record<ClasificacionNutricional, string> = {
  muy_bajo: '#D32F2F',      // Rojo - riesgo alto
  bajo: '#F57C00',          // Naranja - riesgo moderado
  normal: '#388E3C',        // Verde - normal
  alto: '#FBC02D',          // Amarillo - riesgo moderado
  muy_alto: '#D32F2F',      // Rojo - riesgo alto
} as const;

/**
 * Etiquetas para tipos de medición
 */
export const TIPO_MEDICION_LABELS: Record<TipoMedicion, string> = {
  peso_edad: 'Peso para la Edad',
  talla_edad: 'Talla para la Edad',
  peso_talla: 'Peso para la Talla',
  imc_edad: 'IMC para la Edad',
} as const;

/**
 * Etiquetas para unidades
 */
export const UNIDAD_LABELS: Record<UnidadMedida, string> = {
  kg: 'kg',
  cm: 'cm',
  m: 'm',
  unidades: 'unidades',
} as const;

/**
 * Etiquetas para percentiles
 */
export const PERCENTIL_LABELS: Record<Percentil, string> = {
  p3: 'P3',
  p15: 'P15',
  p50: 'P50',
  p85: 'P85',
  p97: 'P97',
} as const;

/**
 * Clasificación del percentil
 */
export function clasificarPercentil(percentil: Percentil): ClasificacionNutricional {
  switch (percentil) {
    case 'p3': return 'muy_bajo';
    case 'p15': return 'bajo';
    case 'p50': return 'normal';
    case 'p85': return 'normal';
    case 'p97': return 'alto';
    default: return 'normal';
  }
}

/**
 * Obtener color según clasificación
 */
export function getColorPorClasificacion(clasificacion: ClasificacionNutricional): string {
  return CLASIFICACION_COLORS[clasificacion];
}
