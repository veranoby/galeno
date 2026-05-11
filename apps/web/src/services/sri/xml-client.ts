/**
 * Cliente para servicio de generación XML SRI
 * Conecta el frontend con el backend
 */

import { ref, type Ref } from 'vue';

// Tipos
export interface FacturaRequest {
  infoTributaria: {
    ambiente: '1' | '2';
    tipoComprobante: string;
    ruc: string;
    secuencial: string;
    fechaEmision: string;
    matriz: string;
  };
  infoFactura: {
    fechaEmision: string;
    dirEstablecimiento: string;
    tipoIdentificacionComprador: string;
    razonSocialComprador: string;
    identificacionComprador: string;
    totalSinImpuestos: number;
    totalDescuento: number;
    totalConImpuestos: Array<{
      codigo: string;
      codigoPorcentaje: string;
      baseImponible: number;
      valor: number;
    }>;
    propina: number;
    importeTotal: number;
    moneda: string;
    pagos: Array<{
      formaPago: string;
      total: number;
      plazo: number;
      unidadTiempo: string;
    }>;
  };
  detalles: Array<{
    codigoPrincipal: string;
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
    descuento: number;
    precioTotalSinImpuesto: number;
    detallesAdicionales?: Array<{
      nombre: string;
      valor: string;
    }>;
    impuestos: Array<{
      codigo: string;
      codigoPorcentaje: string;
      tarifa: number;
      baseImponible: number;
      valor: number;
    }>;
  }>;
  infoAdicional?: {
    campoAdicional?: Array<{
      nombre: string;
      valor: string;
    }>;
  };
}

export interface ValidacionRUCResponse {
  valid: boolean;
  error?: string;
  info?: {
    tipo: 'natural' | 'publico' | 'juridico';
    provincia: number;
    establecimiento: string;
  };
}

export interface GeneracionXMLResponse {
  xml: string;
  claveAcceso: string;
  secuencial: string;
}

export interface UseSriClientReturn {
  generarXML: (
    factura: FacturaRequest
  ) => Promise<GeneracionXMLResponse>;
  validarRUC: (ruc: string) => Promise<ValidacionRUCResponse>;
  generarClaveAcceso: (options: any) => Promise<{ claveAcceso: string }>;
  isLoading: Ref<boolean>;
  error: Ref<string | null>;
}

// Configuración del API
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Hook para consumir servicios SRI
 */
export function useSriClient(): UseSriClientReturn {
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  /**
   * Genera XML para factura electrónica
   */
  async function generarXML(
    factura: FacturaRequest
  ): Promise<GeneracionXMLResponse> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await fetch(`${API_BASE_URL}/api/sri/xml/generar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(factura),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({
          error: 'Error al generar XML',
        }));
        throw new Error(err.error || err.message || 'Error desconocido');
      }

      const data = await response.json();
      return data;
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Error desconocido';
      error.value = errorMessage;
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Valida un RUC ecuatoriano
   */
  async function validarRUC(ruc: string): Promise<ValidacionRUCResponse> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await fetch(`${API_BASE_URL}/api/sri/validar/ruc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ ruc }),
      });

      if (!response.ok) {
        throw new Error('Error al validar RUC');
      }

      const data = await response.json();
      return data;
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Error desconocido';
      error.value = errorMessage;
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Genera clave de acceso para factura
   */
  async function generarClaveAcceso(options: any): Promise<{ claveAcceso: string }> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await fetch(`${API_BASE_URL}/api/sri/clave-acceso/generar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(options),
      });

      if (!response.ok) {
        throw new Error('Error al generar clave de acceso');
      }

      const data = await response.json();
      return data;
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Error desconocido';
      error.value = errorMessage;
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  return {
    generarXML,
    validarRUC,
    generarClaveAcceso,
    isLoading,
    error,
  };
}

/**
 * Descarga el XML como archivo
 */
export function descargarXML(xml: string, filename: string = 'factura.xml'): void {
  const blob = new Blob([xml], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Valida RUC en el cliente (versión simplificada)
 * Para validación completa, usar useSriClient().validarRUC()
 */
export function validarRUCCliente(ruc: string): boolean {
  const rucLimpio = ruc.replace(/[\s-]/g, '');
  if (rucLimpio.length !== 13 || !/^\d+$/.test(rucLimpio)) {
    return false;
  }
  // Validación básica - para validación completa usar el servicio
  const provincia = parseInt(rucLimpio.substring(0, 2), 10);
  return provincia >= 1 && provincia <= 24 && provincia !== 13;
}

/**
 * Formatea RUC para visualización
 */
export function formatearRUC(ruc: string): string {
  const rucLimpio = ruc.replace(/\D/g, '');
  if (rucLimpio.length !== 13) return ruc;

  return `${rucLimpio.substring(0, 2)}-${rucLimpio.substring(2, 3)}-${rucLimpio.substring(3, 9)}-${rucLimpio.substring(9)}`;
}
