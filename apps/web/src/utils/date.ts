// apps/web/src/utils/date.ts
/**
 * Utilidades compartidas para formateo de fechas
 * Centraliza la lógica de formateo para evitar duplicación
 */

import { format } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Formatea una fecha al formato local español (Ecuador)
 * @param dateString - La fecha en formato ISO string
 * @param options - Opciones adicionales de formateo
 * @returns La fecha formateada
 */
export function formatDate(
  dateString: string,
  options: Partial<{ includeTime: boolean; format: 'short' | 'long' | 'full' }> = {}
): string {
  if (!dateString) return '-';

  const { includeTime = false, format: formatType = 'long' } = options;

  const date = new Date(dateString);

  // Verificar si la fecha es válida
  if (isNaN(date.getTime())) return '-';

  const dateFormatOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: formatType === 'short' ? 'numeric' : 'long',
    day: 'numeric',
  };

  if (includeTime) {
    dateFormatOptions.hour = '2-digit';
    dateFormatOptions.minute = '2-digit';
  }

  return date.toLocaleDateString('es-EC', dateFormatOptions);
}

/**
 * Formatea una fecha usando date-fns con locale español
 * @param date - La fecha a formatear
 * @param formatStr - El formato de salida (por defecto 'dd/MM/yyyy')
 * @returns La fecha formateada
 */
export function formatDateFns(
  date: Date | string,
  formatStr: string = 'dd/MM/yyyy'
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, formatStr, { locale: es });
}

/**
 * Verifica si una fecha ha expirado
 * @param dateString - La fecha a verificar
 * @returns true si la fecha ha expirado
 */
export function isExpired(dateString: string): boolean {
  if (!dateString) return false;
  return new Date(dateString) < new Date();
}

/**
 * Calcula el estado de expiración de un documento
 * @param dateString - La fecha de expiración
 * @param warningDays - Días antes de la expiración para mostrar advertencia (default: 30)
 * @returns El estado de expiración
 */
export function getExpirationStatus(
  dateString: string,
  warningDays: number = 30
): 'valid' | 'warning' | 'expired' {
  if (!dateString) return 'valid';

  const expiryDate = new Date(dateString);
  const today = new Date();
  const warningDate = new Date();
  warningDate.setDate(today.getDate() + warningDays);

  if (expiryDate < today) return 'expired';
  if (expiryDate < warningDate) return 'warning';
  return 'valid';
}

/**
 * Formatea una fecha relativa (hace X tiempo)
 * @param dateString - La fecha a formatear
 * @returns La fecha relativa formateada
 */
export function formatRelativeTime(dateString: string): string {
  if (!dateString) return '-';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'ahora mismo';
  if (diffMins < 60) return `hace ${diffMins} minuto${diffMins > 1 ? 's' : ''}`;
  if (diffHours < 24) return `hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
  if (diffDays < 7) return `hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;

  return formatDate(dateString, { format: 'short' });
}
