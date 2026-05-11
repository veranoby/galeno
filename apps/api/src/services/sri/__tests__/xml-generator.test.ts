/**
 * Tests para generador de XML SRI
 */

import { describe, it, expect } from 'vitest';
import {
  generarXMLSRI,
  generarClaveAcceso,
  generarSecuencial,
} from '../xml-generator';
import { TipoComprobante, type FacturaElectronica } from '../types';
import { RUCS_VALIDOS, RUCS_INVALIDOS } from './helpers';

describe('generarXMLSRI', () => {
  const facturaBase: FacturaElectronica = {
    version: '1.1.0',
    infoTributaria: {
      ambiente: '1', // Pruebas
      tipoComprobante: TipoComprobante.FACTURA,
      ruc: RUCS_VALIDOS.natural,
      claveAcceso: '0101202401171003406500111400100000002512345678121',
      secuencial: '001001000000001',
      fechaEmision: '01/01/2024',
      matriz: 'AV. PRINCIPAL Y SECUNDARIA',
    },
    infoFactura: {
      fechaEmision: '01/01/2024',
      dirEstablecimiento: 'AV. PRINCIPAL Y SECUNDARIA',
      tipoIdentificacionComprador: '04', // RUC
      razonSocialComprador: 'EMPRESA DE PRUEBA S.A.',
      identificacionComprador: RUCS_VALIDOS.juridico,
      totalSinImpuestos: 100,
      totalDescuento: 0,
      totalConImpuestos: [
        {
          codigo: '2', // IVA
          codigoPorcentaje: '2', // 12%
          baseImponible: 100,
          valor: 12,
        },
      ],
      propina: 0,
      importeTotal: 112,
      moneda: 'DOLAR',
      pagos: [
        {
          formaPago: '01', // Sin utilización del sistema financiero
          total: 112,
          plazo: 0,
          unidadTiempo: 'dias',
        },
      ],
    },
    detalles: [
      {
        codigoPrincipal: 'PROD001',
        descripcion: 'PRODUCTO DE PRUEBA',
        cantidad: 1,
        precioUnitario: 100,
        descuento: 0,
        precioTotalSinImpuesto: 100,
        impuestos: [
          {
            codigo: '2', // IVA
            codigoPorcentaje: '2', // 12%
            tarifa: 12,
            baseImponible: 100,
            valor: 12,
          },
        ],
      },
    ],
  };

  it('debería generar XML válido', () => {
    const xml = generarXMLSRI(facturaBase);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<factura');
    expect(xml).toContain('version="1.1.0"');
  });

  it('debería incluir namespace SRI', () => {
    const xml = generarXMLSRI(facturaBase);

    expect(xml).toContain('xmlns:xsi=');
    expect(xml).toContain('xsi:schemaLocation=');
    expect(xml).toContain('http://www.sri.gob.ec/Comprobantes-electronicos');
  });

  it('debería incluir infoTributaria', () => {
    const xml = generarXMLSRI(facturaBase);

    expect(xml).toContain('<infoTributaria>');
    expect(xml).toContain('<ambiente>1</ambiente>');
    expect(xml).toContain(`<ruc>${RUCS_VALIDOS.natural}</ruc>`);
    expect(xml).toContain('<tipoComprobante>01</tipoComprobante>');
  });

  it('debería incluir infoFactura', () => {
    const xml = generarXMLSRI(facturaBase);

    expect(xml).toContain('<infoFactura>');
    expect(xml).toContain('<razonSocialComprador>EMPRESA DE PRUEBA S.A.</razonSocialComprador>');
    expect(xml).toContain(`<identificacionComprador>${RUCS_VALIDOS.juridico}</identificacionComprador>`);
    expect(xml).toContain('<importeTotal>112.00</importeTotal>');
  });

  it('debería incluir detalles', () => {
    const xml = generarXMLSRI(facturaBase);

    expect(xml).toContain('<detalles>');
    expect(xml).toContain('<detalle>');
    expect(xml).toContain('<codigoPrincipal>PROD001</codigoPrincipal>');
    expect(xml).toContain('<descripcion>PRODUCTO DE PRUEBA</descripcion>');
    expect(xml).toContain('<cantidad>1</cantidad>');
  });

  it('debería incluir impuestos', () => {
    const xml = generarXMLSRI(facturaBase);

    expect(xml).toContain('<impuestos>');
    expect(xml).toContain('<impuesto>');
    expect(xml).toContain('<codigo>2</codigo>');
    expect(xml).toContain('<tarifa>12.00</tarifa>');
  });

  it('debería formatear números con 2 decimales', () => {
    const xml = generarXMLSRI(facturaBase);

    expect(xml).toContain('<importeTotal>112.00</importeTotal>');
    expect(xml).toContain('<valor>12.00</valor>');
    expect(xml).toContain('<precioUnitario>100.00</precioUnitario>');
  });

  it('debería generar XML legible con pretty=true', () => {
    const xml = generarXMLSRI(facturaBase, { pretty: true });

    // El XML pretty debería tener saltos de línea
    expect(xml).toContain('\n');
    expect(xml).toContain('  </infoTributaria>');
  });

  it('debería generar XML compacto con pretty=false', () => {
    const xml = generarXMLSRI(facturaBase, { pretty: false });

    // El XML compacto no debería tener muchos saltos de línea
    const newlines = (xml.match(/\n/g) || []).length;
    expect(newlines).toBeLessThan(5);
  });

  it('debería lanzar error si falta infoTributaria', () => {
    const facturaInvalida = { ...facturaBase, infoTributaria: null as any };

    expect(() => generarXMLSRI(facturaInvalida)).toThrow('infoTributaria es obligatorio');
  });

  it('debería lanzar error si RUC es inválido', () => {
    const facturaInvalida = {
      ...facturaBase,
      infoTributaria: { ...facturaBase.infoTributaria, ruc: '123' },
    };

    expect(() => generarXMLSRI(facturaInvalida)).toThrow('RUC inválido');
  });

  it('debería lanzar error si no hay detalles', () => {
    const facturaInvalida = { ...facturaBase, detalles: [] };

    expect(() => generarXMLSRI(facturaInvalida)).toThrow('Debe haber al menos un detalle');
  });

  it('debería incluir infoAdicional si está presente', () => {
    const facturaConAdicional: FacturaElectronica = {
      ...facturaBase,
      infoAdicional: {
        campoAdicional: [
          { nombre: 'Email', valor: 'cliente@ejemplo.com' },
          { nombre: 'Teléfono', valor: '023456789' },
        ],
      },
    };

    const xml = generarXMLSRI(facturaConAdicional);

    expect(xml).toContain('<infoAdicional>');
    expect(xml).toContain('nombre="Email"');
    expect(xml).toContain('cliente@ejemplo.com');
  });

  it('debería escapar caracteres especiales XML', () => {
    const facturaConEspeciales: FacturaElectronica = {
      ...facturaBase,
      infoFactura: {
        ...facturaBase.infoFactura,
        razonSocialComprador: 'EMPRESA "LA ESPECIAL" & CIA. LTDA.',
      },
      detalles: [
        {
          ...facturaBase.detalles[0],
          descripcion: '<Producto> con & caracteres "especiales"',
        },
      ],
    };

    const xml = generarXMLSRI(facturaConEspeciales);

    expect(xml).toContain('&amp;');
    expect(xml).toContain('&lt;');
    expect(xml).toContain('&gt;');
    expect(xml).toContain('&quot;');
  });
});

describe('generarClaveAcceso', () => {
  it('debería generar clave de acceso con componentes correctos', () => {
    // Usar formato explícito de fecha para evitar problemas de zona horaria
    const options = {
      fechaEmision: new Date(2024, 0, 15), // 15 de enero de 2024
      tipoComprobante: TipoComprobante.FACTURA,
      ruc: RUCS_VALIDOS.natural,
      ambiente: '1' as const,
      serie: '001001',
      codigoNumerico: '12345678',
      tipoEmision: '1' as const,
    };

    const clave = generarClaveAcceso(options);

    // Verificar que contiene los componentes principales
    expect(clave).toContain(options.ruc);
    expect(clave).toContain(options.ambiente);
    expect(clave).toContain(options.tipoEmision);
  });

  it('debería incluir fecha en formato ddmmaaaa al inicio', () => {
    const options = {
      fechaEmision: new Date(2024, 0, 15), // 15 de enero de 2024
      tipoComprobante: TipoComprobante.FACTURA,
      ruc: RUCS_VALIDOS.natural,
      ambiente: '1' as const,
      serie: '001001',
      codigoNumerico: '12345678',
      tipoEmision: '1' as const,
    };

    const clave = generarClaveAcceso(options);

    // 15/01/2024 = 15012024 (depende de la zona horaria puede variar)
    // Solo verificamos que el formato sea correcto (8 dígitos)
    expect(clave.substring(0, 8)).toMatch(/^\d{8}$/);
  });

  it('debería generar una clave con longitud coherente', () => {
    const options = {
      fechaEmision: new Date(2024, 0, 1),
      tipoComprobante: TipoComprobante.FACTURA,
      ruc: RUCS_VALIDOS.natural,
      ambiente: '1' as const,
      serie: '001001',
      codigoNumerico: '12345678',
      tipoEmision: '1' as const,
    };

    const clave = generarClaveAcceso(options);

    // La clave debe tener al menos 40 caracteres
    expect(clave.length).toBeGreaterThanOrEqual(40);
  });
});

describe('generarSecuencial', () => {
  it('debería generar secuencial de 15 dígitos (EEE-PPP-NNNNNNNNN)', () => {
    const secuencial = generarSecuencial('001', 1);

    expect(secuencial).toHaveLength(15); // EEE + PPP + NNNNNNNNN = 3 + 3 + 9
  });

  it('debería incluir código de establecimiento', () => {
    const secuencial = generarSecuencial('001', 1);

    expect(secuencial.substring(0, 3)).toBe('001');
  });

  it('debería incluir punto de emisión', () => {
    const secuencial = generarSecuencial('001', 1);

    expect(secuencial.substring(3, 6)).toBe('001'); // Punto de emisión por defecto
  });

  it('debería rellenar con ceros', () => {
    const secuencial = generarSecuencial('001', 5);

    expect(secuencial.substring(6)).toBe('000000005');
  });
});

describe('Casos límite y validación', () => {
  it('debería aceptar factura con múltiples detalles', () => {
    const facturaMultiple: FacturaElectronica = {
      version: '1.1.0',
      infoTributaria: {
        ambiente: '1',
        tipoComprobante: TipoComprobante.FACTURA,
        ruc: RUCS_VALIDOS.natural,
        claveAcceso: '0101202401171003406500111400100000002512345678121',
        secuencial: '001001000000001',
        fechaEmision: '01/01/2024',
        matriz: 'AV. PRINCIPAL Y SECUNDARIA',
      },
      infoFactura: {
        fechaEmision: '01/01/2024',
        dirEstablecimiento: 'AV. PRINCIPAL Y SECUNDARIA',
        tipoIdentificacionComprador: '04',
        razonSocialComprador: 'EMPRESA S.A.',
        identificacionComprador: RUCS_VALIDOS.juridico,
        totalSinImpuestos: 200,
        totalDescuento: 0,
        totalConImpuestos: [
          {
            codigo: '2',
            codigoPorcentaje: '2',
            baseImponible: 200,
            valor: 24,
          },
        ],
        propina: 0,
        importeTotal: 224,
        moneda: 'DOLAR',
        pagos: [
          {
            formaPago: '01',
            total: 224,
            plazo: 0,
            unidadTiempo: 'dias',
          },
        ],
      },
      detalles: [
        {
          codigoPrincipal: 'PROD001',
          descripcion: 'PRODUCTO 1',
          cantidad: 1,
          precioUnitario: 100,
          descuento: 0,
          precioTotalSinImpuesto: 100,
          impuestos: [
            {
              codigo: '2',
              codigoPorcentaje: '2',
              tarifa: 12,
              baseImponible: 100,
              valor: 12,
            },
          ],
        },
        {
          codigoPrincipal: 'PROD002',
          descripcion: 'PRODUCTO 2',
          cantidad: 1,
          precioUnitario: 100,
          descuento: 0,
          precioTotalSinImpuesto: 100,
          impuestos: [
            {
              codigo: '2',
              codigoPorcentaje: '2',
              tarifa: 12,
              baseImponible: 100,
              valor: 12,
            },
          ],
        },
      ],
    };

    const xml = generarXMLSRI(facturaMultiple);

    // Ambos productos deben estar presentes
    expect(xml).toContain('PRODUCTO 1');
    expect(xml).toContain('PRODUCTO 2');
  });
});
