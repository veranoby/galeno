/**
 * Servicio de facturación electrónica
 * Maneja la lógica de negocio para facturación
 */
import { facturaRepository } from './factura.repository';
import type { Factura, FacturaInput } from './billing.types';
import { generarXMLSRI } from '../sri/xml-generator';
import type { FacturaElectronica } from '../sri/types';
import { createSriClient, EstadoAutorizacion, type RespuestaAutorizacion } from '../sri/sri-client';

export class BillingService {
  /**
   * Obtiene todas las facturas de una cuenta
   */
  async getFacturas(cuentaId: string): Promise<Factura[]> {
    return facturaRepository.findByCuentaId(cuentaId);
  }

  /**
   * Obtiene una factura por ID
   */
  async getFacturaById(id: string): Promise<Factura | null> {
    return facturaRepository.findById(id);
  }

  /**
   * Crea una nueva factura con XML generado
   */
  async createFactura(
    facturaData: FacturaElectronica,
    cuentaId: string
  ): Promise<Factura> {
    // Validar datos mínimos
    if (!facturaData.infoTributaria?.ruc) {
      throw new Error('RUC es obligatorio');
    }

    if (!facturaData.infoFactura?.razonSocialComprador) {
      throw new Error('Razón social es obligatoria');
    }

    if (!facturaData.infoFactura?.fechaEmision) {
      throw new Error('Fecha de emisión es obligatoria');
    }

    // Generar XML
    const xml = generarXMLSRI(facturaData, { pretty: true });

    // Preparar datos para guardar
    const input: FacturaInput = {
      cuentaId,
      ruc: facturaData.infoTributaria.ruc,
      razonSocial: facturaData.infoFactura.razonSocialComprador,
      secuencial: facturaData.infoTributaria.secuencial || '001',
      fechaEmision: new Date(facturaData.infoFactura.fechaEmision),
      estado: 'recibida',
      montoTotal: Number(facturaData.infoFactura.totalSinImpuestos || 0),
      xmlGenerado: xml,
      claveAcceso: facturaData.infoTributaria.claveAcceso,
      ambiente: facturaData.infoTributaria.ambiente === '2' ? 'produccion' : 'pruebas',
    };

    return facturaRepository.create(input);
  }

  /**
   * Actualiza una factura existente
   */
  async updateFactura(id: string, data: Partial<FacturaInput>): Promise<Factura> {
    const existingFactura = await facturaRepository.findById(id);

    if (!existingFactura) {
      throw new Error('Factura no encontrada');
    }

    return facturaRepository.update(id, data);
  }

  /**
   * Elimina una factura
   */
  async deleteFactura(id: string): Promise<void> {
    const existingFactura = await facturaRepository.findById(id);

    if (!existingFactura) {
      throw new Error('Factura no encontrada');
    }

    return facturaRepository.delete(id);
  }

  /**
   * Envía una factura al SRI para autorización
   */
  async enviarSRI(id: string, ambiente: '1' | '2' = '1'): Promise<RespuestaAutorizacion> {
    const factura = await facturaRepository.findById(id);

    if (!factura) {
      throw new Error('Factura no encontrada');
    }

    if (!factura.xmlGenerado) {
      throw new Error('La factura no tiene XML generado');
    }

    // Enviar al SRI
    const sriClient = createSriClient(ambiente);
    const respuesta = await sriClient.enviarComprobante(factura.xmlGenerado);

    // Actualizar factura con respuesta
    if (respuesta.estado === EstadoAutorizacion.AUTORIZADO || 
        respuesta.estado === EstadoAutorizacion.EN_PROCESO) {
      await facturaRepository.updateAutorizacionSRI(
        id,
        'autorizada',
        respuesta.comprobante || factura.xmlGenerado,
        respuesta.numeroAutorizacion || factura.claveAcceso || ''
      );
    } else {
      await facturaRepository.update(id, {
        estado: 'rechazada',
      });
    }

    return respuesta;
  }

  /**
   * Consulta el estado de autorización de una factura
   */
  async consultarAutorizacion(
    id: string,
    claveAcceso: string,
    ambiente: '1' | '2' = '1'
  ): Promise<RespuestaAutorizacion> {
    // Validar clave de acceso
    if (!claveAcceso || claveAcceso.length !== 49) {
      throw new Error('Clave de acceso debe tener 49 caracteres');
    }

    // Consultar al SRI
    const sriClient = createSriClient(ambiente);
    const respuesta = await sriClient.consultarAutorizacion(claveAcceso);

    return respuesta;
  }

  /**
   * Obtiene el XML autorizado de una factura
   */
  async getXmlAutorizado(id: string): Promise<{
    xml: string;
    razonSocial: string;
    secuencial: string;
  } | null> {
    const factura = await facturaRepository.findById(id);

    if (!factura) {
      return null;
    }

    if (!factura.xmlAutorizado) {
      throw new Error('La factura no tiene XML autorizado');
    }

    return {
      xml: factura.xmlAutorizado,
      razonSocial: factura.razonSocial,
      secuencial: factura.secuencial,
    };
  }
}

export const billingService = new BillingService();
