import { computed, ComputedRef } from 'vue';

/**
 * Tipos de documento según el modelo
 */
export type TipoDocumento = 'receta' | 'examen' | 'certificado';

/**
 * Configuración de días de caducidad por tipo de documento
 */
const CADUCIDAD_DIAS: Record<TipoDocumento, number> = {
  receta: 30,      // 30 días para recetas médicas
  examen: 90,      // 90 días para resultados de exámenes
  certificado: 365  // 365 días (1 año) para certificados médicos por defecto
};

/**
 * Calcular fecha de expiración de un documento
 *
 * @param tipo - Tipo de documento
 * @param diasPersonalizados - Días personalizados (opcional, para certificados)
 * @returns Fecha de expiración calculada
 */
export function calcularFechaExpiracion(
  tipo: TipoDocumento,
  diasPersonalizados?: number
): Date {
  const dias = diasPersonalizados ?? CADUCIDAD_DIAS[tipo];

  // Calcular fecha: ahora + días en milisegundos
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
 * @returns String formateado (ej: "5 días", "Vencido ayer", "Vencido hace 2 días")
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
 * Composable de caducidad de documentos
 *
 * Proporciona funciones reactivas para gestionar la caducidad
 * de documentos médicos
 */
export function useDocumentoCaducidad(fechaExpiracion: ComputedRef<Date | null | undefined>) {
  // Computed properties
  const diasRestantesValue = computed(() =>
    diasRestantes(fechaExpiracion.value)
  );

  const estaVencidoValue = computed(() =>
    estaVencido(fechaExpiracion.value)
  );

  const proximoAVencerValue = computed(() =>
    proximoAVencer(fechaExpiracion.value)
  );

  const estadoCaducidadValue = computed(() =>
    obtenerEstadoCaducidad(fechaExpiracion.value)
  );

  const textoDiasRestantes = computed(() =>
    formatearDiasRestantes(fechaExpiracion.value)
  );

  const colorEstado = computed(() => {
    const estado = estadoCaducidadValue.value;
    switch (estado) {
      case 'vencido': return 'error';
      case 'proximo_vencer': return 'warning';
      default: return 'success';
    }
  });

  const iconoEstado = computed(() => {
    const estado = estadoCaducidadValue.value;
    switch (estado) {
      case 'vencido': return 'mdi-alert-circle';
      case 'proximo_vencer': return 'mdi-alert';
      default: return 'mdi-check-circle';
    }
  });

  return {
    diasRestantes: diasRestantesValue,
    estaVencido: estaVencidoValue,
    proximoAVencer: proximoAVencerValue,
    estadoCaducidad: estadoCaducidadValue,
    textoDiasRestantes,
    colorEstado,
    iconoEstado,

    // Methods
    calcularFechaExpiracion,
    formatearDiasRestantes
  };
}

// Exportar constantes
export const CADUCIDAD_CONFIG = CADUCIDAD_DIAS;

export default useDocumentoCaducidad;
