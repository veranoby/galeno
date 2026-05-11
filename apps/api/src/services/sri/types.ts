/**
 * Tipos para Facturación Electrónica SRI Ecuador
 * Basado en especificaciones técnicas SRI
 */

// Código de tipo de comprobante
export enum TipoComprobante {
  FACTURA = '01',
  LIQUIDACION_COMPRA = '03',
  NOTA_CREDITO = '04',
  NOTA_DEBITO = '05',
  GUIA_REMISION = '06',
  COMPROBANTE_RETENCION = '07',
}

// Código de impuesto
export enum CodigoImpuesto {
  IVA = '2',
  ICE = '3',
  IRBPNR = '5',
}

// Porcentaje de IVA
export enum PorcentajeIVA {
  CERO = '0',
  DOCE = '2',
  CATORCE = '3',
  NO_OBJETO_IVA = '6',
  EXENTO_IVA = '7',
}

// Tipo de identificación
export enum TipoIdentificacion {
  RUC = '04',
  CEDULA = '05',
  PASAPORTE = '06',
  CONSUMIDOR_FINAL = '07',
  EXTERIOR = '08',
}

// Información tributaria
export interface InfoTributaria {
  ambiente: '1' | '2'; // 1=Pruebas, 2=Producción
  tipoComprobante: TipoComprobante;
  ruc: string; // 13 dígitos
  claveAcceso: string; // 49 dígitos
  secuencial: string; // 9 dígitos
  fechaEmision: string; // Formato: dd/mm/aaaa
  matriz: string; // Dirección matriz
}

// Total con impuesto
export interface TotalImpuesto {
  codigo: CodigoImpuesto | string;
  codigoPorcentaje: PorcentajeIVA | string;
  baseImponible: number;
  valor: number;
}

// Información de la factura
export interface InfoFactura {
  fechaEmision: string; // dd/mm/aaaa
  dirEstablecimiento: string;
  tipoIdentificacionComprador: TipoIdentificacion | string;
  razonSocialComprador: string;
  identificacionComprador: string;
  totalSinImpuestos: number;
  totalDescuento: number;
  totalConImpuestos: TotalImpuesto[];
  propina: number;
  importeTotal: number;
  moneda: string; // Código ISO 4217
  pagos: Pago[];
}

// Forma de pago
export interface Pago {
  formaPago: string; // Código según SRI
  total: number;
  plazo: number;
  unidadTiempo: string; // días, meses
}

// Detalle de factura
export interface Detalle {
  codigoPrincipal: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  precioTotalSinImpuesto: number;
  detallesAdicionales?: DetalleAdicional[];
  impuestos: ImpuestoItem[];
}

// Detalle adicional (campo opcional)
export interface DetalleAdicional {
  nombre: string;
  valor: string;
}

// Impuesto de un item
export interface ImpuestoItem {
  codigo: CodigoImpuesto | string;
  codigoPorcentaje: PorcentajeIVA | string;
  tarifa: number;
  baseImponible: number;
  valor: number;
}

// Campo adicional (info adicional)
export interface CampoAdicional {
  nombre: string;
  valor: string;
}

// Estructura completa de factura
export interface FacturaElectronica {
  version: string; // "1.1.0"
  infoTributaria: InfoTributaria;
  infoFactura: InfoFactura;
  detalles: Detalle[];
  infoAdicional?: {
    campoAdicional?: CampoAdicional[];
  };
}

// Opciones de generación
export interface GeneracionXMLOptions {
  pretty?: boolean; // Formatear XML para legibilidad
}
