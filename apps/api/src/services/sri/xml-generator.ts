/**
 * Generador de XML para Facturación Electrónica SRI Ecuador
 * Genera XML válido según especificaciones técnicas del SRI
 */

import type { FacturaElectronica, GeneracionXMLOptions } from './types';
import { TipoComprobante } from './types';

// Namespace SRI
const SRI_NAMESPACE = 'http://www.sri.gob.ec/Comprobantes-electronicos';
const SRI_SCHEMA_LOCATION =
  'http://www.sri.gob.ec/Comprobantes-electronicos comprobante.xsd';

/**
 * Genera XML válido para facturación electrónica SRI
 * @param factura - Datos de la factura
 * @param options - Opciones de generación
 * @returns XML string
 */
export function generarXMLSRI(
  factura: FacturaElectronica, 
  options: GeneracionXMLOptions = {}
): string {
  const { pretty = false } = options;

  // Validar datos mínimos
  validarFactura(factura);

  // Construir XML
  const xml = buildXML(factura,  pretty);

  return xml;
}

/**
 * Valida que la factura tenga los datos mínimos requeridos
 */
function validarFactura(factura: FacturaElectronica): void {
  if (!factura.infoTributaria) {
    throw new Error('infoTributaria es obligatorio');
  }

  const { infoTributaria, infoFactura, detalles } = factura;

  // Validar infoTributaria
  if (!infoTributaria.ambiente || !['1',  '2'].includes(infoTributaria.ambiente)) {
    throw new Error('Ambiente debe ser 1 (pruebas) o 2 (producción)');
  }

  if (!infoTributaria.ruc || infoTributaria.ruc.length !== 13) {
    throw new Error('RUC inválido: debe tener 13 dígitos');
  }

  if (!infoTributaria.claveAcceso || infoTributaria.claveAcceso.length !== 49) {
    throw new Error('Clave de acceso inválida: debe tener 49 dígitos');
  }

  // Validar infoFactura
  if (!infoFactura || !infoFactura.identificacionComprador) {
    throw new Error('Identificación del comprador es obligatoria');
  }

  if (!detalles || detalles.length === 0) {
    throw new Error('Debe haber al menos un detalle');
  }
}

/**
 * Construye el XML de la factura
 */
function buildXML(factura: FacturaElectronica,  pretty: boolean): string {
  const indent = pretty ? '\n  ' : '';
  const indent2 = pretty ? '\n    ' : '';
  const indent3 = pretty ? '\n      ' : '';

  let xml = '<?xml version="1.0" encoding="UTF-8"?>';
  xml += indent + `<factura id="comprobante" version="${factura.version}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="${SRI_SCHEMA_LOCATION}">`;

  // Info tributaria
  xml += buildInfoTributaria(factura.infoTributaria,  pretty);

  // Info factura
  xml += buildInfoFactura(factura.infoFactura,  pretty);

  // Detalles
  xml += indent2 + '<detalles>';
  factura.detalles.forEach((detalle) => {
    xml += buildDetalle(detalle,  pretty);
  });
  xml += indent2 + '</detalles>';

  // Info adicional (opcional)
  if (factura.infoAdicional?.campoAdicional?.length) {
    xml += buildInfoAdicional(factura.infoAdicional.campoAdicional,  pretty);
  }

  xml += indent + '</factura>';

  return xml;
}

/**
 * Construye el bloque de infoTributaria
 */
function buildInfoTributaria(infoTributaria: any,  pretty: boolean): string {
  const indent = pretty ? '\n    ' : '';
  const indent2 = pretty ? '\n      ' : '';

  let xml = indent + '<infoTributaria>';
  xml += indent2 + `<ambiente>${infoTributaria.ambiente}</ambiente>`;
  xml += indent2 + `<tipoEmision>1</tipoEmision>`;
  xml += indent2 + `<numeroAutorizacion>${infoTributaria.claveAcceso}</numeroAutorizacion>`;
  xml += indent2 + `<fechaEmision>${formatDateSRI(infoTributaria.fechaEmision)}</fechaEmision>`;
  xml += indent2 + `<dirMatriz>${escapeXML(infoTributaria.matriz)}</dirMatriz>`;
  xml += indent2 + `<tipoComprobante>${infoTributaria.tipoComprobante}</tipoComprobante>`;
  xml += indent2 + `<ruc>${infoTributaria.ruc}</ruc>`;
  xml += indent2 + `<claveAcceso>${infoTributaria.claveAcceso}</claveAcceso>`;
  xml += indent2 + `<codDoc>${infoTributaria.tipoComprobante}</codDoc>`;
  xml += indent2 + `<estab>${infoTributaria.secuencial.substring(0,  3)}</estab>`;
  xml += indent2 + `<ptoEmi>${infoTributaria.secuencial.substring(3,  6)}</ptoEmi>`;
  xml += indent2 + `<secuencial>${infoTributaria.secuencial.substring(6)}</secuencial>`;
  xml += indent2 + `<dirEstablecimiento>${escapeXML(infoTributaria.dirEstablecimiento || infoTributaria.matriz)}</dirEstablecimiento>`;
  xml += indent2 + `<contribuyenteRimpe>${infoTributaria.contribuyenteRimpe || 'CONTRIBUYENTE RIMPE'}</contribuyenteRimpe>`;
  xml += indent + '</infoTributaria>';

  return xml;
}

/**
 * Construye el bloque de infoFactura
 */
function buildInfoFactura(infoFactura: any,  pretty: boolean): string {
  const indent = pretty ? '\n    ' : '';
  const indent2 = pretty ? '\n      ' : '';
  const indent3 = pretty ? '\n        ' : '';

  let xml = indent + '<infoFactura>';
  xml += indent2 + `<fechaEmision>${formatDateSRI(infoFactura.fechaEmision)}</fechaEmision>`;
  xml += indent2 + `<dirEstablecimiento>${escapeXML(infoFactura.dirEstablecimiento)}</dirEstablecimiento>`;
  xml += indent2 + `<obligadoContabilidad>${infoFactura.obligadoContabilidad || 'NO'}</obligadoContabilidad>`;
  xml += indent2 + `<tipoIdentificacionComprador>${infoFactura.tipoIdentificacionComprador}</tipoIdentificacionComprador>`;
  xml += indent2 + `<razonSocialComprador>${escapeXML(infoFactura.razonSocialComprador)}</razonSocialComprador>`;
  xml += indent2 + `<identificacionComprador>${infoFactura.identificacionComprador}</identificacionComprador>`;

  // Totales con impuestos
  xml += indent2 + '<totalConImpuestos>';
  if (infoFactura.totalConImpuestos) {
    infoFactura.totalConImpuestos.forEach((imp: any) => {
      xml += indent3 + '<totalImpuesto>';
      xml += (pretty ? '\n          ' : '') + `<codigo>${imp.codigo}</codigo>`;
      xml += (pretty ? '\n          ' : '') + `<codigoPorcentaje>${imp.codigoPorcentaje}</codigoPorcentaje>`;
      xml += (pretty ? '\n          ' : '') + `<baseImponible>${formatNumber(imp.baseImponible)}</baseImponible>`;
      xml += (pretty ? '\n          ' : '') + `<valor>${formatNumber(imp.valor)}</valor>`;
      xml += indent3 + '</totalImpuesto>';
    });
  }
  xml += indent2 + '</totalConImpuestos>';

  xml += indent2 + `<propina>${formatNumber(infoFactura.propina || 0)}</propina>`;
  xml += indent2 + `<importeTotal>${formatNumber(infoFactura.importeTotal)}</importeTotal>`;
  xml += indent2 + `<moneda>${infoFactura.moneda || 'DOLAR'}</moneda>`;

  // Pagos
  xml += indent2 + '<pagos>';
  if (infoFactura.pagos) {
    infoFactura.pagos.forEach((pago: any) => {
      xml += indent3 + '<pago>';
      xml += (pretty ? '\n            ' : '') + `<formaPago>${pago.formaPago}</formaPago>`;
      xml += (pretty ? '\n            ' : '') + `<total>${formatNumber(pago.total)}</total>`;
      xml += (pretty ? '\n            ' : '') + `<plazo>${pago.plazo || 0}</plazo>`;
      xml += (pretty ? '\n            ' : '') + `<unidadTiempo>${pago.unidadTiempo || 'dias'}</unidadTiempo>`;
      xml += indent3 + '</pago>';
    });
  }
  xml += indent2 + '</pagos>';

  xml += indent + '</infoFactura>';

  return xml;
}

/**
 * Construye un detalle
 */
function buildDetalle(detalle: any,  pretty: boolean): string {
  const indent = pretty ? '\n      ' : '';
  const indent2 = pretty ? '\n        ' : '';
  const indent3 = pretty ? '\n          ' : '';

  let xml = indent + '<detalle>';
  xml += indent2 + `<codigoPrincipal>${detalle.codigoPrincipal}</codigoPrincipal>`;
  xml += indent2 + `<descripcion>${escapeXML(detalle.descripcion)}</descripcion>`;
  xml += indent2 + `<cantidad>${detalle.cantidad}</cantidad>`;
  xml += indent2 + `<precioUnitario>${formatNumber(detalle.precioUnitario)}</precioUnitario>`;
  xml += indent2 + `<descuento>${formatNumber(detalle.descuento || 0)}</descuento>`;
  xml += indent2 + `<precioTotalSinImpuesto>${formatNumber(detalle.precioTotalSinImpuesto)}</precioTotalSinImpuesto>`;

  // Detalles adicionales
  if (detalle.detallesAdicionales && detalle.detallesAdicionales.length > 0) {
    xml += indent2 + '<detallesAdicionales>';
    detalle.detallesAdicionales.forEach((da: any) => {
      xml += indent3 + '<detAdicional>';
      xml += (pretty ? '\n            ' : '') + `<nombre>${escapeXML(da.nombre)}</nombre>`;
      xml += (pretty ? '\n            ' : '') + `<valor>${escapeXML(da.valor)}</valor>`;
      xml += indent3 + '</detAdicional>';
    });
    xml += indent2 + '</detallesAdicionales>';
  }

  // Impuestos del detalle
  xml += indent2 + '<impuestos>';
  detalle.impuestos.forEach((imp: any) => {
    xml += indent3 + '<impuesto>';
    xml += (pretty ? '\n            ' : '') + `<codigo>${imp.codigo}</codigo>`;
    xml += (pretty ? '\n            ' : '') + `<codigoPorcentaje>${imp.codigoPorcentaje}</codigoPorcentaje>`;
    xml += (pretty ? '\n            ' : '') + `<tarifa>${formatNumber(imp.tarifa)}</tarifa>`;
    xml += (pretty ? '\n            ' : '') + `<baseImponible>${formatNumber(imp.baseImponible)}</baseImponible>`;
    xml += (pretty ? '\n            ' : '') + `<valor>${formatNumber(imp.valor)}</valor>`;
    xml += indent3 + '</impuesto>';
  });
  xml += indent2 + '</impuestos>';

  xml += indent + '</detalle>';

  return xml;
}

/**
 * Construye infoAdicional
 */
function buildInfoAdicional(campos: any[],  pretty: boolean): string {
  const indent = pretty ? '\n    ' : '';
  const indent2 = pretty ? '\n      ' : '';

  let xml = indent + '<infoAdicional>';
  campos.forEach((campo) => {
    xml += indent2 + `<campoAdicional nombre="${escapeXML(campo.nombre)}">${escapeXML(campo.valor)}</campoAdicional>`;
  });
  xml += indent + '</infoAdicional>';

  return xml;
}

/**
 * Formatea fecha al formato SRI (dd/mm/aaaa)
 */
function formatDateSRI(fecha: string | Date): string {
  if (typeof fecha === 'string') {
    // Asumir formato yyyy-mm-dd o similar
    const parts = fecha.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return fecha;
  }

  const d = fecha instanceof Date ? fecha : new Date(fecha);
  const day = String(d.getDate()).padStart(2,  '0');
  const month = String(d.getMonth() + 1).padStart(2,  '0');
  const year = d.getFullYear();

  return `${day}/${month}/${year}`;
}

/**
 * Formatea número con 2 decimales
 */
function formatNumber(num: number): string {
  return num.toFixed(2);
}

/**
 * Escapa caracteres especiales para XML
 */
function escapeXML(str: string): string {
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&apos;');
}

/**
 * Genera clave de acceso según especificaciones SRI (49 dígitos)
 */
export interface ClaveAccesoOptions {
  fechaEmision: Date;
  tipoComprobante: TipoComprobante;
  ruc: string;
  ambiente: '1' | '2';
  serie: string; // Estructura: AAA-AAA-NNNNNNNN
  codigoNumerico: string; // 8 dígitos
  tipoEmision: '1' | '2'; // 1=Normal, 2=Indispuestos
}

export function generarClaveAcceso(options: ClaveAccesoOptions): string {
  // Formato: ddmmaaaattt + ruc + ambiente + serie + codigoNumerico + tipoEmision + dígitoVerificador
  // Total: 8 + 13 + 1 + 9 + 8 + 1 + 1 = 41 + 1 (dígito verificador) = 49

  const fecha = options.fechaEmision;
  const dd = String(fecha.getDate()).padStart(2,  '0');
  const mm = String(fecha.getMonth() + 1).padStart(2,  '0');
  const aaaa = String(fecha.getFullYear());
  const ttt = options.tipoComprobante.padStart(3,  '0');

  // Limpiar serie (quitar guiones)
  const serieLimpia = options.serie.replace(/-/g,  '');

  const clave =
    dd + mm + aaaa + ttt + options.ruc + options.ambiente + serieLimpia + options.codigoNumerico + options.tipoEmision;

  // Calcular dígito verificador (módulo 11)
  const digitoVerificador = calcularDigitoVerificador(clave);

  return clave + digitoVerificador;
}

/**
 * Calcula dígito verificador para clave de acceso SRI (módulo 11)
 */
function calcularDigitoVerificador(clave: string): string {
  const coeficientes = [2, 3, 4, 5, 6, 7, 2, 3, 4, 5, 6, 7, 2, 3, 4, 5, 6, 7, 2, 3, 4, 5, 6, 7, 2, 3, 4, 5, 6, 7, 2, 3, 4, 5, 6, 7, 2, 3, 4, 5, 6, 7];

  let suma = 0;
  for (let i = 0; i < clave.length; i++) {
    const digito = parseInt(clave[i],  10);
    suma += digito * coeficientes[i];
  }

  const resto = suma % 11;
  const digitoVerificador = resto === 0 ? 0 : 11 - resto;

  return String(digitoVerificador);
}

/**
 * Genera número de secuencia para factura (9 dígitos)
 * Formato: EEE-PPPPPPPP
 * EEE = Establecimiento (3 dígitos)
 * PPPPPPPP = Secuencial (8 dígitos - aunque SRI usa 9 en total para secuencia)
 */
export function generarSecuencial(establecimiento: string,  numero: number): string {
  const estab = String(establecimiento).padStart(3,  '0');
  const ptoEmi = '001'; // Punto de emisión por defecto
  const secuencial = String(numero).padStart(9,  '0');

  return estab + ptoEmi + secuencial;
}
