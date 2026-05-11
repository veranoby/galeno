// apps/web/src/modules/odontograma/types.ts

/**
 * Tipos de dientes según la notación FDI (Federación Dental Internacional)
 * Primer dígito: cuadrante (1-4 superior, 5-8 inferior)
 * Segundo dígito: posición en el cuadrante (1-8 de centro a atrás)
 */
export type DienteId = string;

/**
 * Cuadrantes dentales
 */
export type Cuadrante = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/**
 * Tipos de dientes
 */
export type TipoDiente = 'incisivo' | 'canino' | 'premolar' | 'molar';

/**
 * Caras de un diente para marcar tratamientos
 */
export type CaraDiente =
  | 'oclusal'      // Cara de masticación
  | 'vestibular'   // Cara externa/frontal
  | 'palatino'     // Cara interna superior (lingual inferior)
  | 'mesial'       // Cara hacia el centro
  | 'distal'       // Cara hacia atrás
  | 'raiz';        // Raíz del diente

/**
 * Estados/tratamientos de un diente
 */
export type EstadoDiente =
  | 'sano'              // Sano, sin tratamiento
  | 'caries'            // Caries presente
  | 'obturado'          // Obturación/empaste
  | 'extraccion'        // Extraído
  | 'corona'            // Corona colocada
  | 'puente'            // Parte de un puente
  | 'implante'          // Implante colocado
  | 'endodoncia'        // Tratamiento de conducto
  | 'fracturado'        // Fracturado
  | 'supernumerario'    // Diente extra
  | 'ausente'           // Ausente congénitamente
  | 'erupcion';         // En erupción

/**
 * Tipos de caries según su ubicación
 */
export type TipoCaries = 'superficial' | 'profunda' | 'radicular';

/**
 * Tratamiento realizado en una cara específica del diente
 */
export interface TratamientoCara {
  cara: CaraDiente;
  estado: EstadoDiente;
  fecha?: Date;
  notas?: string;
}

/**
 * Información completa de un diente
 */
export interface DienteInfo {
  id: DienteId;
  cuadrante: Cuadrante;
  posicion: number;      // 1-8 posición en el cuadrante
  tipo: TipoDiente;
  extra: boolean;        // Verdadero si es diente temporal (de leche)
  seleccionado: boolean;
  caras: Partial<Record<CaraDiente, TratamientoCara>>;
  estado: EstadoDiente;
  observaciones?: string;
}

/**
 * Configuración del odontograma
 */
export interface OdontogramaConfig {
  mostrarTemporales: boolean;
  permitirSeleccion: boolean;
  soloLectura: boolean;
}

/**
 * Datos del odontograma
 */
export interface OdontogramaData {
  dientes: Record<DienteId, DienteInfo>;
  fechaActualizacion: Date;
  notas?: string;
}

/**
 * Coordenadas de una cara en el SVG del diente
 */
export interface CaraCoordenadas {
  cara: CaraDiente;
  path: string;
  cx: number;
  cy: number;
}

/**
 * Información de posición para un diente en el odontograma
 */
export interface DientePosicion {
  id: DienteId;
  x: number;
  y: number;
  cuadrante: Cuadrante;
}

/**
 * Constantes para el odontograma
 */
export const ODONTOGRAMA_CONSTANTS = {
  CUADRANTES: {
    SUPERIOR_DERECHO: 1,
    SUPERIOR_IZQUIERDO: 2,
    INFERIOR_IZQUIERDO: 3,
    INFERIOR_DERECHO: 4,
  },
  DIENTES_POR_CUADRANTE: 8,
  DIENTES_TEMPORALES_POR_CUADRANTE: 5,
} as const;

/**
 * Mapa de colores para estados de dientes
 */
export const ESTADO_COLORS: Record<EstadoDiente, string> = {
  sano: '#4CAF50',
  caries: '#FF9800',
  obturado: '#2196F3',
  extraccion: '#9E9E9E',
  corona: '#9C27B0',
  puente: '#673AB7',
  implante: '#00BCD4',
  endodoncia: '#F44336',
  fracturado: '#E91E63',
  supernumerario: '#FFEB3B',
  ausente: '#BDBDBD',
  erupcion: '#CDDC39',
} as const;

/**
 * Mapa de tipos de dientes por posición
 */
export const TIPO_DIENTE_POR_POSICION: Record<number, TipoDiente> = {
  1: 'incisivo',
  2: 'incisivo',
  3: 'canino',
  4: 'premolar',
  5: 'premolar',
  6: 'molar',
  7: 'molar',
  8: 'molar',
} as const;
