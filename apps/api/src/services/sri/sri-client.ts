/**
 * Cliente SRI para Firma y Envío de Comprobantes Electrónicos
 *
 * Implementa:
 * - Firma XAdES-BES de XMLs
 * - Envío a Web Services del SRI
 * - Consulta de autorizaciones
 * - Manejo robusto de errores con reintentos
 *
 * @see https://www.sri.gob.ec/web/guest/comprobantes-electronicos
 */

import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import * as crypto from 'node:crypto';
import { createRequire } from 'node:module';
// @ts-ignore - xml-c14n doesn't have TypeScript definitions
const require = createRequire(import.meta.url);
const CanonicalisationFactory = require('xml-c14n');

// ============ TYPES ============

/**
 * Ambiente SRI
 */
export type AmbienteSRI = '1' | '2'; // 1=Pruebas, 2=Producción

/**
 * Estado de autorización SRI
 */
export enum EstadoAutorizacion {
  AUTORIZADO = 'AUTORIZADO',
  NO_AUTORIZADO = 'NO AUTORIZADO',
  EN_PROCESO = 'EN PROCESO',
  ERROR_TECNICO = 'ERROR TÉCNICO',
  ERROR_VALIDACION = 'ERROR DE VALIDACIÓN',
}

/**
 * Resultado de firma XML
 */
export interface ResultadoFirma {
  xmlFirmado: string;
  firmaBase64: string;
  certificadoBase64: string;
  digest: string;
  timestamp: Date;
}

/**
 * Respuesta de autorización SRI
 */
export interface RespuestaAutorizacion {
  estado: EstadoAutorizacion;
  numeroAutorizacion?: string;
  fechaAutorizacion?: string;
  ambiente?: string;
  comprobante?: string;
  mensajes?: MensajeSRI[];
}

/**
 * Mensaje de respuesta SRI
 */
export interface MensajeSRI {
  identificador?: string;
  mensaje?: string;
  tipo?: string;
  informacionAdicional?: string;
}

/**
 * Configuración del cliente SRI
 */
export interface SriClientConfig {
  ambiente: AmbienteSRI;
  timeout?: number; // ms
  maxRetries?: number;
  retryDelay?: number; // ms
}

/**
 * Certificado digital para firma
 */
export interface CertificadoDigital {
  certPem: string; // Certificado en formato PEM
  keyPem: string; // Llave privada en formato PEM
  password?: string; // Contraseña si está encriptada
}

/**
 * Opciones de firma
 */
export interface FirmaOptions {
  ubicacionFirma?: 'inicio' | 'fin';
  agregarTimestamp?: boolean;
}

// ============ URLS SERVICIOS SRI ============

const SRI_URLS: Record<AmbienteSRI, { recepcion: string; autorizacion: string }> = {
  '1': {
    // Pruebas
    recepcion: 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantes',
    autorizacion: 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantes',
  },
  '2': {
    // Producción
    recepcion: 'https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantes',
    autorizacion: 'https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantes',
  },
};

// ============ ERRORES SRI ============

export class SRIError extends Error {
  constructor(
    message: string, 
    public codigo?: string, 
    public estado?: EstadoAutorizacion, 
    public detalles?: MensajeSRI[]
  ) {
    super(message);
    this.name = 'SRIError';
  }
}

export class SRIFirmaError extends SRIError {
  constructor(message: string,  public originalError?: unknown) {
    super(message,  'FIRMA_ERROR');
    this.name = 'SRIFirmaError';
  }
}

export class SRIEnvioError extends SRIError {
  constructor(message: string,  public statusCode?: number,  public responseBody?: string) {
    super(message,  'ENVIO_ERROR');
    this.name = 'SRIEnvioError';
  }
}

// ============ CLIENTE SRI ============

export class SriClient {
  private config: Required<SriClientConfig>;

  constructor(config: SriClientConfig) {
    this.config = {
      ambiente: config.ambiente,
      timeout: config.timeout || 30000,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
    };
  }

  /**
   * Firma un XML con XAdES-BES
   *
   * @param xmlContent - XML a firmar
   * @param certificado - Certificado digital
   * @param options - Opciones de firma
   * @returns XML firmado
   */
  async firmarXML(
    xmlContent: string, 
    certificado: CertificadoDigital, 
    options: FirmaOptions = {}
  ): Promise<ResultadoFirma> {
    try {
      // Parsear XML
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlContent,  'application/xml');

      // Obtener elemento raíz
      const rootElement = xmlDoc.documentElement;

      // Canonicalizar XML para firma
      const canonicalXml = await this.canonicalizarXML(rootElement);

      // Crear digest del XML canonicalizado
      const digest = this.crearDigest(canonicalXml);

      // Crear elemento SignedInfo
      const signedInfo = this.crearSignedInfo(digest);

      // Canonicalizar SignedInfo
      const canonicalSignedInfo = await this.canonicalizarXML(signedInfo);

      // Firmar SignedInfo con llave privada
      const signature = this.firmarConLlavePrivada(canonicalSignedInfo,  certificado.keyPem,  certificado.password);

      // Convertir certificado a base64
      const certBase64 = this.pemToBase64(certificado.certPem);

      // Crear elemento Signature completo
      const signatureElement = this.crearElementoSignature(signature,  certBase64,  digest);

      // Insertar firma en XML
      const xmlFirmado = this.insertarFirmaEnXML(xmlContent,  signatureElement,  options.ubicacionFirma || 'fin');

      return {
        xmlFirmado,
        firmaBase64: signature,
        certificadoBase64: certBase64,
        digest,
        timestamp: new Date(),
      };
    } catch (error) {
      throw new SRIFirmaError('Error al firmar XML', error);
    }
  }

  /**
   * Envía un comprobante XML al SRI
   *
   * @param xmlFirmado - XML firmado
   * @returns Respuesta del SRI
   */
  async enviarComprobante(xmlFirmado: string): Promise<RespuestaAutorizacion> {
    const urls = SRI_URLS[this.config.ambiente];

    return this.retryOperation(
      async () => {
        const response = await fetch(urls.recepcion,  {
          method: 'POST', 
          headers: {
            'Content-Type': 'application/xml', 
            'SOAPAction': '""', 
            'User-Agent': 'Galeno-SRI-Client/1.0', 
          }, 
          body: this.crearEnvelopeSOAP(xmlFirmado,  'validarComprobante'),
          signal: AbortSignal.timeout(this.config.timeout),
        });

        if (!response.ok) {
          const body = await response.text();
          throw new SRIEnvioError(
            `Error HTTP ${response.status} enviando comprobante al SRI`, 
            response.status, 
            body
          );
        }

        const responseText = await response.text();
        return this.parsearRespuestaSRI(responseText);
      },
      'envío de comprobante'
    );
  }

  /**
   * Consulta el estado de autorización de un comprobante
   *
   * @param claveAcceso - Clave de acceso del comprobante (49 dígitos)
   * @returns Estado de autorización
   */
  async consultarAutorizacion(claveAcceso: string): Promise<RespuestaAutorizacion> {
    if (claveAcceso.length !== 49) {
      throw new SRIError('Clave de acceso debe tener 49 caracteres');
    }

    const urls = SRI_URLS[this.config.ambiente];

    return this.retryOperation(
      async () => {
        const requestBody = this.crearBodyConsultaAutorizacion(claveAcceso);

        const response = await fetch(urls.autorizacion,  {
          method: 'POST', 
          headers: {
            'Content-Type': 'application/xml', 
            'SOAPAction': '""', 
            'User-Agent': 'Galeno-SRI-Client/1.0', 
          }, 
          body: requestBody, 
          signal: AbortSignal.timeout(this.config.timeout),
        });

        if (!response.ok) {
          const body = await response.text();
          throw new SRIEnvioError(
            `Error HTTP ${response.status} consultando autorización`, 
            response.status, 
            body
          );
        }

        const responseText = await response.text();
        return this.parsearRespuestaAutorizacion(responseText);
      },
      'consulta de autorización'
    );
  }

  /**
   * Valida un XML según esquema SRI
   *
   * @param xmlContent - XML a validar
   * @returns true si válido
   */
  validarEsquema(xmlContent: string): boolean {
    // Validación básica - en producción usar un validador XSD completo
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlContent,  'application/xml');

      const errors = doc.getElementsByTagName('parsererror');
      return errors.length === 0;
    } catch {
      return false;
    }
  }

  // ============ MÉTODOS PRIVADOS ============

  /**
   * Implementa reintentos con backoff exponencial
   */
  private async retryOperation<T>(
    operation: () => Promise<T>,
    descripcion: string,
    attempt: number = 1
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= this.config.maxRetries) {
        throw new SRIError(
          `Error en ${descripcion} después de ${attempt} intentos`, 
          'MAX_RETRIES_EXCEEDED'
        );
      }

      // Calcular delay con backoff exponencial
      const delay = this.config.retryDelay * Math.pow(2,  attempt - 1);

      // Esperar antes de reintentar
      await new Promise(resolve => setTimeout(resolve,  delay));

      return this.retryOperation(operation,  descripcion,  attempt + 1);
    }
  }

  /**
   * Canonicaliza un elemento XML (exc-c14n)
   * Usa xml-c14n para canonicalización conforme a estándares
   */
  private async canonicalizarXML(element: Element | Document): Promise<string> {
    try {
      const factory = CanonicalisationFactory();
      const canonicaliser = factory.createCanonicaliser('http://www.w3.org/2001/10/xml-exc-c14n#');

      return new Promise((resolve, reject) => {
        canonicaliser.canonicalise(element, (err, res) => {
          if (err) {
            reject(err);
          } else {
            resolve(res);
          }
        });
      });
    } catch (error) {
      // Fallback a implementación básica si xml-c14n falla
      console.warn('xml-c14n falló, usando canonicalización básica:', error);
      const serializer = new XMLSerializer();
      let xml = serializer.serializeToString(element);
      xml = xml.replace(/<\?[^>]*\?>/g, '');
      xml = xml.replace(/\s+/g, ' ').trim();
      return xml;
    }
  }

  /**
   * Crea digest SHA-256 de datos
   */
  private crearDigest(data: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(data,  'utf8');
    return hash.digest('base64');
  }

  /**
   * Crea elemento SignedInfo para XAdES-BES
   */
  private crearSignedInfo(digest: string): Element {
    const parser = new DOMParser();
    const signedInfoXml = `
      <ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
        <ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
        <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
        <ds:Reference URI="">
          <ds:Transforms>
            <ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
            <ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
          </ds:Transforms>
          <ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha256"/>
          <ds:DigestValue>${digest}</ds:DigestValue>
        </ds:Reference>
      </ds:SignedInfo>
    `;

    const doc = parser.parseFromString(signedInfoXml,  'application/xml');
    return doc.documentElement;
  }

  /**
   * Firma datos usando llave privada RSA
   */
  private firmarConLlavePrivada(data: string,  keyPem: string,  password?: string): string {
    try {
      // Crear signer
      const sign = crypto.createSign('SHA256');

      // Agregar datos a firmar
      sign.update(data,  'utf8');

      // Si hay contraseña, desencriptar llave (simplificado - requiere openssl o similar)
      const key = keyPem;
      if (password && keyPem.includes('ENCRYPTED')) {
        // En producción usar openssl para desencriptar
        throw new SRIFirmaError('Llaves encriptadas requieren procesamiento adicional');
      }

      // Firmar
      const signature = sign.sign(key,  'base64');
      return signature;
    } catch (error) {
      throw new SRIFirmaError('Error al firmar con llave privada', error);
    }
  }

  /**
   * Crea elemento Signature completo de XAdES-BES
   */
  private crearElementoSignature(
    signatureValue: string, 
    certificate: string, 
    digest: string
  ): string {
    const now = new Date();
    const timestamp = now.toISOString();

    return `
      <ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Id="Signature-${timestamp}">
        <ds:SignedInfo>
          <ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
          <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
          <ds:Reference URI="">
            <ds:Transforms>
              <ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
              <ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
            </ds:Transforms>
            <ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha256"/>
            <ds:DigestValue>${digest}</ds:DigestValue>
          </ds:Reference>
        </ds:SignedInfo>
        <ds:SignatureValue>${signatureValue}</ds:SignatureValue>
        <ds:KeyInfo>
          <ds:X509Data>
            <ds:X509Certificate>${certificate}</ds:X509Certificate>
          </ds:X509Data>
        </ds:KeyInfo>
        <ds:Object>
          <xades:QualifyingProperties Target="#Signature-${timestamp}">
            <xades:SignedProperties>
              <xades:SignedSignatureProperties>
                <xades:SigningTime>${timestamp}</xades:SigningTime>
                <xades:SigningCertificate>
                  <xades:Cert>
                    <xades:CertDigest>
                      <ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha256"/>
                      <ds:DigestValue>${digest}</ds:DigestValue>
                    </xades:CertDigest>
                  </xades:Cert>
                </xades:SigningCertificate>
              </xades:SignedSignatureProperties>
            </xades:SignedProperties>
          </xades:QualifyingProperties>
        </ds:Object>
      </ds:Signature>
    `;
  }

  /**
   * Inserta elemento de firma en XML
   */
  private insertarFirmaEnXML(
    xmlContent: string, 
    signature: string, 
    ubicacion: 'inicio' | 'fin'
  ): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlContent,  'application/xml');
    const root = doc.documentElement;

    // Parsear firma
    const signatureDoc = parser.parseFromString(signature,  'application/xml');
    const signatureElement = signatureDoc.documentElement.cloneNode(true);

    // Insertar en ubicación deseada
    if (ubicacion === 'inicio') {
      root.insertBefore(signatureElement,  root.firstChild);
    } else {
      root.appendChild(signatureElement);
    }

    // Serializar
    const serializer = new XMLSerializer();
    return serializer.serializeToString(doc);
  }

  /**
   * Convierte certificado PEM a base64 (sin headers)
   */
  private pemToBase64(pem: string): string {
    return pem
      .replace(/-----BEGIN CERTIFICATE-----/g,  '')
      .replace(/-----END CERTIFICATE-----/g,  '')
      .replace(/-----BEGIN PRIVATE KEY-----/g,  '')
      .replace(/-----END PRIVATE KEY-----/g,  '')
      .replace(/-----BEGIN RSA PRIVATE KEY-----/g,  '')
      .replace(/-----END RSA PRIVATE KEY-----/g,  '')
      .replace(/\s/g,  '');
  }

  /**
   * Crea envelope SOAP para enviar comprobante
   */
  private crearEnvelopeSOAP(xmlContent: string,  operacion: string): string {
    return `
      <?xml version="1.0" encoding="UTF-8"?>
      <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
        <soap:Header/>
        <soap:Body>
          <${operacion} xmlns="http://www.sri.gob.ec/Comprobantes-electronicos">
            <xml>${Buffer.from(xmlContent).toString('base64')}</xml>
          </${operacion}>
        </soap:Body>
      </soap:Envelope>
    `;
  }

  /**
   * Crea body SOAP para consulta de autorización
   */
  private crearBodyConsultaAutorizacion(claveAcceso: string): string {
    return `
      <?xml version="1.0" encoding="UTF-8"?>
      <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
        <soap:Header/>
        <soap:Body>
          <consultaAutorizacion xmlns="http://www.sri.gob.ec/Comprobantes-electronicos">
            <claveAccesoComprobante>${claveAcceso}</claveAccesoComprobante>
          </consultaAutorizacion>
        </soap:Body>
      </soap:Envelope>
    `;
  }

  /**
   * Parsea respuesta SOAP del SRI
   */
  private parsearRespuestaSRI(soapResponse: string): RespuestaAutorizacion {
    const parser = new DOMParser();
    const doc = parser.parseFromString(soapResponse,  'application/xml');

    // Buscar estado en respuesta
    const estadoNodes = doc.getElementsByTagName('estado');
    if (estadoNodes.length === 0) {
      throw new SRIError('No se encontró estado en respuesta SRI');
    }

    const estado = estadoNodes[0].textContent?.trim() || EstadoAutorizacion.EN_PROCESO;

    return {
      estado: estado as EstadoAutorizacion,
    };
  }

  /**
   * Parsea respuesta de autorización del SRI
   */
  private parsearRespuestaAutorizacion(soapResponse: string): RespuestaAutorizacion {
    const parser = new DOMParser();
    const doc = parser.parseFromString(soapResponse,  'application/xml');

    // Extraer datos de autorización
    const estadoNode = doc.getElementsByTagName('estado')[0];
    const numeroAutorizacionNode = doc.getElementsByTagName('numeroAutorizacion')[0];
    const fechaAutorizacionNode = doc.getElementsByTagName('fechaAutorizacion')[0];
    const ambienteNode = doc.getElementsByTagName('ambiente')[0];

    // Extraer mensajes si existen
    const mensajes: MensajeSRI[] = [];
    const mensajeNodes = doc.getElementsByTagName('mensaje');
    for (let i = 0; i < mensajeNodes.length; i++) {
      const node = mensajeNodes[i];
      mensajes.push({
        identificador: node.getElementsByTagName('identificador')[0]?.textContent || undefined,
        mensaje: node.getElementsByTagName('mensaje')[0]?.textContent || undefined,
        tipo: node.getElementsByTagName('tipo')[0]?.textContent || undefined,
        informacionAdicional: node.getElementsByTagName('informacionAdicional')[0]?.textContent || undefined,
      });
    }

    return {
      estado: (estadoNode?.textContent?.trim() || EstadoAutorizacion.EN_PROCESO) as EstadoAutorizacion,
      numeroAutorizacion: numeroAutorizacionNode?.textContent || undefined,
      fechaAutorizacion: fechaAutorizacionNode?.textContent || undefined,
      ambiente: ambienteNode?.textContent || undefined,
      mensajes: mensajes.length > 0 ? mensajes : undefined,
    };
  }
}

// ============ UTILIDADES ============

/**
 * Crea una instancia del cliente SRI para pruebas
 */
export function createSriClientTest(): SriClient {
  return new SriClient({
    ambiente: '1',  // Pruebas
    timeout: 30000, 
    maxRetries: 3, 
  });
}

/**
 * Crea una instancia del cliente SRI para producción
 */
export function createSriClientProd(): SriClient {
  return new SriClient({
    ambiente: '2',  // Producción
    timeout: 30000, 
    maxRetries: 3, 
  });
}

/**
 * Helper para crear cliente según ambiente
 */
export function createSriClient(ambiente: AmbienteSRI): SriClient {
  return new SriClient({ ambiente });
}
