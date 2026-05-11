/**
 * Utilidad para cálculo de caducidad de documentos médicos
 * 
 * Reglas de negocio:
 * - Recetas: 30 días desde fecha_emision
 * - Exámenes: 90 días desde fecha_emision
 * - Certificados: No expiran (o configurable)
 */

import { TipoDocumento, EstadoDocumento } from '@galeno/shared-types';

/**
 * Configuración de días de validez por tipo de documento
 */
export const DOCUMENT_EXPIRATION_DAYS: Record<TipoDocumento, number | null> = {
  [TipoDocumento.RECETA]: 30,
  [TipoDocumento.EXAMEN]: 90,
  [TipoDocumento.CERTIFICADO]: null, // No expira por defecto
} as const;

/**
 * Resultado del cálculo de caducidad
 */
export interface ExpirationStatus {
  /** Indica si el documento está caducado */
  isExpired: boolean;
  /** Indica si el documento tiene caducidad configurable */
  hasExpiration: boolean;
  /** Número de días restantes (positivo) o días desde caducidad (negativo) */
  daysRemaining: number | null;
  /** Fecha de expiración calculada */
  expirationDate: Date | null;
  /** Estado del documento */
  estado: EstadoDocumento;
  /** Texto descriptivo del estado */
  statusText: string;
}

/**
 * Calcula la fecha de expiración para un tipo de documento
 * 
 * @param tipo - Tipo de documento
 * @param fechaEmision - Fecha de emisión del documento
 * @returns Fecha de expiración o null si no expira
 */
export function calculateExpirationDate(
  tipo: TipoDocumento,
  fechaEmision: Date | string
): Date | null {
  const days = DOCUMENT_EXPIRATION_DAYS[tipo];
  
  // Si no tiene días de expiración (null), no expira
  if (days === null) {
    return null;
  }

  const emissionDate = typeof fechaEmision === 'string' 
    ? new Date(fechaEmision) 
    : fechaEmision;

  if (isNaN(emissionDate.getTime())) {
    throw new Error(`Fecha de emisión inválida: ${fechaEmision}`);
  }

  const expirationDate = new Date(emissionDate);
  expirationDate.setDate(expirationDate.getDate() + days);
  
  return expirationDate;
}

/**
 * Calcula el estado de caducidad de un documento
 * 
 * @param tipo - Tipo de documento
 * @param fechaEmision - Fecha de emisión del documento
 * @param fechaReferencia - Fecha de referencia para el cálculo (default: hoy)
 * @returns Estado de caducidad del documento
 */
export function calculateExpirationStatus(
  tipo: TipoDocumento,
  fechaEmision: Date | string,
  fechaReferencia: Date | string = new Date()
): ExpirationStatus {
  const emissionDate = typeof fechaEmision === 'string' 
    ? new Date(fechaEmision) 
    : fechaEmision;

  const referenceDate = typeof fechaReferencia === 'string' 
    ? new Date(fechaReferencia) 
    : fechaReferencia;

  if (isNaN(emissionDate.getTime())) {
    throw new Error(`Fecha de emisión inválida: ${fechaEmision}`);
  }

  if (isNaN(referenceDate.getTime())) {
    throw new Error(`Fecha de referencia inválida: ${fechaReferencia}`);
  }

  const expirationDate = calculateExpirationDate(tipo, fechaEmision);
  const hasExpiration = expirationDate !== null;

  // Si no tiene expiración, retorna estado vigente
  if (!hasExpiration) {
    return {
      isExpired: false,
      hasExpiration: false,
      daysRemaining: null,
      expirationDate: null,
      estado: EstadoDocumento.ACTIVO,
      statusText: 'No caduca',
    };
  }

  // Calcular diferencia en días
  const msPerDay = 24 * 60 * 60 * 1000;
  const diffMs = expirationDate.getTime() - referenceDate.getTime();
  const daysRemaining = Math.round(diffMs / msPerDay);

  const isExpired = daysRemaining < 0;
  const estado = isExpired ? EstadoDocumento.CADUCADO : EstadoDocumento.ACTIVO;

  // Generar texto descriptivo
  let statusText: string;
  if (isExpired) {
    const daysAgo = Math.abs(daysRemaining);
    statusText = `Caducó hace ${daysAgo} ${daysAgo === 1 ? 'día' : 'días'}`;
  } else if (daysRemaining === 0) {
    statusText = 'Caduca hoy';
  } else {
    statusText = `${daysRemaining} ${daysRemaining === 1 ? 'día' : 'días'} restante${daysRemaining === 1 ? '' : 's'}`;
  }

  return {
    isExpired,
    hasExpiration: true,
    daysRemaining,
    expirationDate,
    estado,
    statusText,
  };
}

/**
 * Verifica si un documento está caducado
 * 
 * @param tipo - Tipo de documento
 * @param fechaEmision - Fecha de emisión del documento
 * @param fechaReferencia - Fecha de referencia (default: hoy)
 * @returns true si está caducado, false si está vigente o no caduca
 */
export function isDocumentExpired(
  tipo: TipoDocumento,
  fechaEmision: Date | string,
  fechaReferencia: Date | string = new Date()
): boolean {
  const status = calculateExpirationStatus(tipo, fechaEmision, fechaReferencia);
  return status.isExpired;
}

/**
 * Obtiene el color del estado del documento
 * 
 * @param status - Estado de caducidad
 * @returns Color en formato hex
 */
export function getExpirationColor(status: ExpirationStatus): string {
  if (!status.hasExpiration) {
    return '#2196F3'; // Azul para documentos que no caducan
  }
  
  if (status.isExpired) {
    return '#F44336'; // Rojo para caducados
  }

  // Verde para vigentes
  return '#4CAF50';
}

/**
 * Obtiene el color del estado del documento basado en tipo y fecha
 * 
 * @param tipo - Tipo de documento
 * @param fechaEmision - Fecha de emisión
 * @param fechaReferencia - Fecha de referencia (default: hoy)
 * @returns Color en formato hex
 */
export function getExpirationColorByDocument(
  tipo: TipoDocumento,
  fechaEmision: Date | string,
  fechaReferencia: Date | string = new Date()
): string {
  const status = calculateExpirationStatus(tipo, fechaEmision, fechaReferencia);
  return getExpirationColor(status);
}

/**
 * Formatea el estado de caducidad para mostrar en UI
 * 
 * @param status - Estado de caducidad
 * @returns Objeto con texto y color para UI
 */
export function formatExpirationStatus(status: ExpirationStatus): {
  text: string;
  color: string;
  icon: string;
} {
  const color = getExpirationColor(status);
  
  let icon: string;
  if (!status.hasExpiration) {
    icon = 'mdi-lock-outline';
  } else if (status.isExpired) {
    icon = 'mdi-alert-circle';
  } else {
    icon = 'mdi-check-circle';
  }

  return {
    text: status.statusText,
    color,
    icon,
  };
}
