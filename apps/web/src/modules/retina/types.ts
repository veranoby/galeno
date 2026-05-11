// apps/web/src/modules/retina/types.ts

/**
 * Tipos de imágenes de retina
 */
export type TipoImagenRetina =
  | 'color_fondo'          // Foto de fondo de ojo
  | 'angiofluoresceina'    // Angiofluoresceinografía
  | 'oct'                  // Tomografía de coherencia óptica
  | 'campo_visual'         // Campo visual
  | 'topografo';           // Topografía corneal

/**
 * Ojo al que pertenece la imagen
 */
export type Ojo = 'derecho' | 'izquierdo' | 'ambos';

/**
 * Estados de una imagen
 */
export type EstadoImagen = 'pendiente' | 'procesando' | 'completa' | 'error';

/**
 * Tipos de anotaciones
 */
export type TipoAnotacion =
  | 'punto'        // Marcador puntual
  | 'linea'        // Línea o medición
  | 'area'         // Área delimitada
  | 'texto'        // Nota de texto
  | 'flecha';      // Flecha indicadora

/**
 * Colores para anotaciones
 */
export type ColorAnotacion =
  | 'rojo'
  | 'verde'
  | 'azul'
  | 'amarillo'
  | 'blanco'
  | 'negro';

/**
 * Anotación en una imagen
 */
export interface Anotacion {
  id: string;
  tipo: TipoAnotacion;
  color: ColorAnotacion;
  coordenadas: number[]; // [x1, y1, x2?, y2?, ...]
  texto?: string;
  fecha: Date;
  autor?: string;
}

/**
 * Información de una imagen de retina
 */
export interface ImagenRetina {
  id: string;
  tipo: TipoImagenRetina;
  ojo: Ojo;
  url: string;
  thumbnailUrl?: string;
  fechaCaptura: Date;
  fechaSubida: Date;
  estado: EstadoImagen;
  metadatos?: ImagenMetadatos;
  anotaciones: Anotacion[];
  notas?: string;
}

/**
 * Metadatos de una imagen
 */
export interface ImagenMetadatos {
  resolucion?: string;
  escala?: string;
  campoVisual?: string;
  dispositivo?: string;
  configuracion?: Record<string, unknown>;
}

/**
 * Herramientas disponibles en el visor
 */
export type HerramientaVisor =
  | 'pan'
  | 'zoom'
  | 'anotar'
  | 'medir'
  | 'comparar'
  | 'ajustar'
  | 'filtro';

/**
 * Configuración del visor
 */
export interface RetinaVisorConfig {
  mostrarGrid: boolean;
  permitirAnotaciones: boolean;
  permitirComparacion: boolean;
  zoomInicial: number;
  minZoom: number;
  maxZoom: number;
}

/**
 * Datos del módulo de retina
 */
export interface RetinaData {
  imagenes: ImagenRetina[];
  imagenActiva?: string;
  modoComparacion: boolean;
  imagenComparacion?: string;
}

/**
 * Filtros de imagen disponibles
 */
export type FiltroImagen =
  | 'normal'
  | 'invertido'
  | 'contraste_alto'
  | 'contraste_bajo'
  | 'brillo_alto'
  | 'brillo_bajo'
  | 'escala_grises'
  | 'sepia';

/**
 * Constantes para el módulo de retina
 */
export const RETINA_CONSTANTS = {
  MAX_ANOTACIONES: 100,
  MAX_IMAGENES_COMPARACION: 2,
  DEFAULT_ZOOM: 1,
  MIN_ZOOM: 0.1,
  MAX_ZOOM: 5,
} as const;

/**
 * Mapa de colores para anotaciones
 */
export const COLOR_ANNOTATION_MAP: Record<ColorAnotacion, string> = {
  rojo: '#FF0000',
  verde: '#00FF00',
  azul: '#0000FF',
  amarillo: '#FFFF00',
  blanco: '#FFFFFF',
  negro: '#000000',
} as const;

/**
 * Tipos de imágenes válidos para comparación
 */
export const IMAGENES_COMPARABLES: TipoImagenRetina[] = [
  'color_fondo',
  'angiofluoresceina',
  'oct',
];
