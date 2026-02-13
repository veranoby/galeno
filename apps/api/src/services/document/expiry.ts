import { TipoDocumento } from '@prisma/client';

/**
 * Configuración de días de caducidad por tipo de documento
 */
const CADUCIDAD_DIAS: Record<TipoDocumento, number> = {
  receta: 30,      // 30 días para recetas médicas
  examen: 90,      // 90 días para resultados de exámenes
  certificado: 365  // 365 días (1 año) para certificados médicos por defecto
};

/**
 * Parámetros configurables para caducidad de certificados
 */
interface CertificadoCaducidadParams {
  dias?: number;
  tipoCertificado?: string;
}

/**
 * Calcular fecha de expiración de un documento
 *
 * @param tipo - Tipo de documento
 * @param params - Parámetros opcionales para certificados
 * @returns Fecha de expiración calculada
 */
export function calcularFechaExpiracion(
  tipo: TipoDocumento,
  params?: CertificadoCaducidadParams
): Date {
  const dias = CADUCIDAD_DIAS[tipo];

  if (tipo === 'certificado' && params?.dias) {
    // Para certificados, se puede sobrescribir los días por parámetro
    return new Date(Date.now() + params.dias * 24 * 60 * 60 * 1000);
  }

  if (!dias) {
    // Si no hay configuración, usar 30 días por defecto
    return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }

  return new Date(Date.now() + dias * 24 * 60 * 60 * 1000);
}

/**
 * Verificar si un documento está vencido
 *
 * @param fechaExpiracion - Fecha de expiración del documento
 * @returns true si el documento está vencido
 */
export function estaVencido(fechaExpiracion: Date | null | undefined): boolean {
  if (!fechaExpiracion) return false;
  return new Date() > fechaExpiracion;
}

/**
 * Verificar si un documento está próximo a vencer
 *
 * @param fechaExpiracion - Fecha de expiración del documento
 * @param diasAlerta - Días antes de la expiración para alertar (default: 7)
 * @returns true si el documento vence pronto
 */
export function proximoAVencer(
  fechaExpiracion: Date | null | undefined,
  diasAlerta: number = 7
): boolean {
  if (!fechaExpiracion) return false;

  const alertDate = new Date(fechaExpiracion.getTime());
  alertDate.setDate(alertDate.getDate() - diasAlerta);

  return new Date() >= alertDate && new Date() < fechaExpiracion;
}

/**
 * Obtener días restantes hasta la expiración
 *
 * @param fechaExpiracion - Fecha de expiración del documento
 * @returns Número de días restantes (negativo si ya venció)
 */
export function diasRestantes(fechaExpiracion: Date | null | undefined): number {
  if (!fechaExpiracion) return Infinity;

  const ahora = new Date();
  const diff = fechaExpiracion.getTime() - ahora.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * Tipo de estado de caducidad
 */
export type EstadoCaducidad = 'vigente' | 'proximo_vencer' | 'vencido';

/**
 * Obtener estado de caducidad de un documento
 *
 * @param fechaExpiracion - Fecha de expiración del documento
 * @returns Estado del documento
 */
export function obtenerEstadoCaducidad(fechaExpiracion: Date | null | undefined): EstadoCaducidad {
  if (!fechaExpiracion) return 'vigente';

  const dias = diasRestantes(fechaExpiracion);

  if (dias < 0) return 'vencido';
  if (dias <= 7) return 'proximo_vencer';
  return 'vigente';
}

/**
 * Formatear días restantes de forma amigable
 *
 * @param fechaExpiracion - Fecha de expiración
 * @returns String formateado (ej: "5 días", "Vencido hace 2 días")
 */
export function formatearDiasRestantes(fechaExpiracion: Date | null | undefined): string {
  const dias = diasRestantes(fechaExpiracion);

  if (dias === Infinity) return 'Sin expiración';

  if (dias < 0) {
    const diasVencido = Math.abs(dias);
    if (diasVencido === 1) return 'Vencido ayer';
    return `Vencido hace ${diasVencido} días`;
  }

  if (dias === 0) return 'Vence hoy';
  if (dias === 1) return 'Vence mañana';
  return `Vence en ${dias} días`;
}

/**
 * Servicio de caducidad de documentos
 *
 * Proporciona funciones para calcular y gestionar la caducidad
 * de documentos médicos
 */
export const documentoExpiryService = {
  calcularFechaExpiracion,
  estaVencido,
  proximoAVencer,
  diasRestantes,
  obtenerEstadoCaducidad,
  formatearDiasRestantes,
  CADUCIDAD_DIAS
};

export type { CertificadoCaducidadParams };
