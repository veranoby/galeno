/**
 * Tipos para el sistema de facturación electrónica
 */

export interface Factura {
  id: string;
  cuentaId: string; // Relación con la cuenta del médico/clínica
  ruc: string;
  razonSocial: string;
  secuencial: string;
  fechaEmision: Date;
  estado: 'recibida' | 'autorizada' | 'rechazada' | 'anulada';
  montoTotal: number;
  xmlGenerado?: string;
  xmlAutorizado?: string;
  claveAcceso?: string;
  ambiente: 'pruebas' | 'produccion'; // 1 para pruebas, 2 para producción
  createdAt: Date;
  updatedAt: Date;
}

export interface FacturaInput {
  cuentaId: string;
  ruc: string;
  razonSocial: string;
  secuencial: string;
  fechaEmision: Date;
  estado?: 'recibida' | 'autorizada' | 'rechazada' | 'anulada';
  montoTotal: number;
  xmlGenerado?: string;
  xmlAutorizado?: string;
  claveAcceso?: string;
  ambiente?: 'pruebas' | 'produccion';
}

export interface FacturaDetalle {
  id: string;
  facturaId: string;
  codigoPrincipal: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  precioTotalSinImpuestos: number;
  impuestos: Impuesto[];
}

export interface Impuesto {
  codigo: string; // '2' para IVA, '3' para ICE, etc.
  codigoPorcentaje: string;
  tarifa: number;
  baseImponible: number;
  valor: number;
}

export interface InfoAdicional {
  nombre: string;
  valor: string;
}

export interface AutorizacionSRIResponse {
  estado: string;
  numeroAutorizacion: string;
  fechaAutorizacion: string;
  mensajes: MensajeSRI[];
  xmlAutorizado?: string;
  claveAcceso: string;
}

export interface MensajeSRI {
  identificador: string;
  mensaje: string;
  tipo: string;
}