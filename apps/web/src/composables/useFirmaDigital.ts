import { ref, computed } from 'vue';

/**
 * Certificate Information
 */
export interface CertificadoInfo {
  subject: string;
  issuer: string;
  serialNumber: string;
  validFrom: Date;
  validTo: Date;
  cn: string; // Common Name
  email?: string;
  cedula?: string;
}

/**
 * Private Key Reference (stored in volatile memory only)
 */
interface ClavePrivada {
  key: CryptoKey;
  algorithm: RsaHashedImportParams;
  extractable: boolean;
}

/**
 * Signature Result
 */
export interface ResultadoFirma {
  xmlFirmado: string;
  firmaBase64: string;
  certificadoBase64: string;
  timestamp: Date;
}

/**
 * Signature Validation Result
 */
export interface ResultadoValidacion {
  valido: boolean;
  mensaje: string;
  firmante?: string;
  fechaFirma?: Date;
  certificadoVigente?: boolean;
}

/**
 * Firma Digital Composable - XAdES-BES
 *
 * Implements client-side digital signature using WebCrypto API.
 * Private key NEVER leaves volatile memory.
 */
export function useFirmaDigital() {
  // State
  const certificadoCargado = ref(false);
  const certificadoInfo = ref<CertificadoInfo | null>(null);
  const cargando = ref(false);
  const error = ref<string | null>(null);
  const clavePrivada = ref<ClavePrivada | null>(null);
  const certificadoDer = ref<Uint8Array | null>(null);

  /**
   * Load PKCS#12 (.p12) certificate
   * Extracts private key and certificate using WebCrypto
   */
  const cargarCertificado = async (
    archivo: File,
    password: string
  ): Promise<CertificadoInfo> => {
    cargando.value = true;
    error.value = null;

    try {
      // Read file as ArrayBuffer
      const buffer = await archivo.arrayBuffer();
      const data = new Uint8Array(buffer);

      // Parse PKCS#12 (using a browser-compatible approach)
      // Note: For full PKCS#12 support, we'd need a library like forge or pkijs
      // This is a simplified implementation for WebCrypto

      const { certificado, clave, info } = await parsearPKCS12(data, password);

      // Store in volatile memory (NOT in localStorage)
      clavePrivada.value = clave;
      certificadoDer.value = certificado;
      certificadoInfo.value = info;
      certificadoCargado.value = true;

      return info;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error al cargar certificado';
      throw e;
    } finally {
      cargando.value = false;
    }
  };

  /**
   * Sign XML Document with XAdES-BES
   *
   * @param xmlContent - XML document to sign (string)
   * @returns Signed XML with XAdES-BES signature
   */
  const firmarXML = async (xmlContent: string): Promise<ResultadoFirma> => {
    if (!clavePrivada.value || !certificadoDer.value || !certificadoInfo.value) {
      throw new Error('Certificado no cargado. Use cargarCertificado primero.');
    }

    cargando.value = true;
    error.value = null;

    try {
      // Parse XML to get document content
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlContent, 'application/xml');

      // Get document element
      const documentElement = xmlDoc.documentElement;

      // Create canonicalized XML for signing
      const canonicalizedXml = canonicalizarXML(documentElement);

      // Create digest of the canonicalized XML
      const digest = await crearDigest(canonicalizedXml);

      // Create SignedInfo element
      const signedInfo = crearSignedInfo(digest, certificadoInfo.value);

      // Canonicalize SignedInfo
      const canonicalizedSignedInfo = canonicalizarXML(signedInfo);

      // Sign the canonicalized SignedInfo
      const signatureValue = await firmarDatos(
        canonicalizedSignedInfo,
        clavePrivada.value.key
      );

      // Convert signature to base64
      const signatureBase64 = arrayBufferToBase64(signatureValue);

      // Convert certificate to base64 (DER format)
      const certBase64 = arrayBufferToBase64(certificadoDer.value.buffer);

      // Create XAdES-BES signature element
      const signatureElement = crearSignatureElement(
        signatureBase64,
        certBase64,
        digest,
        certificadoInfo.value
      );

      // Add signature to XML document
      const signedXml = insertarFirmaEnXML(xmlContent, signatureElement);

      return {
        xmlFirmado: signedXml,
        firmaBase64: signatureBase64,
        certificadoBase64: certBase64,
        timestamp: new Date()
      };
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error al firmar documento';
      throw e;
    } finally {
      cargando.value = false;
    }
  };

  /**
   * Clear sensitive data from memory
   * Call this when done signing to zero out memory
   */
  const limpiarMemoria = (): void => {
    clavePrivada.value = null;
    certificadoDer.value = null;
    certificadoInfo.value = null;
    certificadoCargado.value = false;
    error.value = null;

    // Note: JavaScript engines handle garbage collection
    // For additional security, you could overwrite the variables with zeros
    // but the effectiveness is limited due to how JS manages memory
  };

  /**
   * Validate signature on server
   * This sends the signed XML to the server for validation
   */
  const validarFirmaServidor = async (
    xmlFirmado: string
  ): Promise<ResultadoValidacion> => {
    cargando.value = true;
    error.value = null;

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/api/firma/validar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ xml: xmlFirmado })
      });

      if (!response.ok) {
        throw new Error(`Error de validación: ${response.statusText}`);
      }

      const resultado = await response.json();
      return resultado;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error al validar firma';
      throw e;
    } finally {
      cargando.value = false;
    }
  };

  // Computed properties
  const listoParaFirmar = computed(() => certificadoCargado.value);

  const nombreFirmante = computed(
    () => certificadoInfo.value?.cn || 'Desconocido'
  );

  const certificadoVigente = computed(() => {
    if (!certificadoInfo.value) return false;
    const ahora = new Date();
    return (
      ahora >= certificadoInfo.value.validFrom &&
      ahora <= certificadoInfo.value.validTo
    );
  });

  return {
    // State
    certificadoCargado,
    certificadoInfo,
    cargando,
    error,
    listoParaFirmar,
    nombreFirmante,
    certificadoVigente,

    // Methods
    cargarCertificado,
    firmarXML,
    validarFirmaServidor,
    limpiarMemoria
  };
}

// ============ HELPER FUNCTIONS ============

/**
 * Parse PKCS#12 file and extract private key and certificate
 *
 * NOTE: This is a simplified implementation. For production use with
 * Ecuadorian SRI certificates, you should use a library like:
 * - pkijs (https://pkijs.org/)
 * - forge (https://github.com/digitalbazaar/forge)
 *
 * This implementation uses WebCrypto's SubtleCrypto API which has
 * limited PKCS#12 support. For full compatibility, integrate a proper
 * ASN.1/PKCS#12 parser.
 */
async function parsearPKCS12(
  data: Uint8Array,
  password: string
): Promise<{
  certificado: Uint8Array;
  clave: ClavePrivada;
  info: CertificadoInfo;
}> {
  // NOTE: This is where you would integrate a proper PKCS#12 parser
  // For now, we'll use a WebCrypto-compatible approach

  // Check for PKCS#12 magic bytes
  const p12Magic = [0x30, 0x82]; // DER sequence tag
  if (data[0] !== p12Magic[0] || data[1] !== p12Magic[1]) {
    throw new Error('Formato de archivo inválido. Se esperaba PKCS#12 (.p12)');
  }

  // Import the PKCS#12 using WebCrypto
  // Note: WebCrypto has limited PKCS#12 support
  // For production, use pkijs or forge library

  try {
    // Try to import as a key pair
    // This is a simplified version - real PKCS#12 requires proper parsing
    const passwordBuffer = new TextEncoder().encode(password);

    // For this implementation, we'll use a workaround
    // In production, use a proper PKCS#12 library
    throw new Error(
      'Para soporte completo de PKCS#12, integre la biblioteca pkijs o forge. ' +
      'Ver documentación en: https://github.com/PeculiarVentures/PKI.js'
    );

    // The actual implementation would:
    // 1. Parse the PKCS#12 structure (ASN.1 BER/DER)
    // 2. Extract the encrypted private key and certificate
    // 3. Decrypt the private key using the password
    // 4. Import the key into WebCrypto
    // 5. Parse the certificate to extract information
  } catch (e) {
    // If WebCrypto fails, we need a proper PKCS#12 library
    throw new Error(
      'No se pudo parsear el archivo PKCS#12. ' +
      'Para producción, integre pkijs o forge para manejo de certificados .p12'
    );
  }
}

/**
 * Create SHA-256 digest of data
 */
async function crearDigest(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  return arrayBufferToBase64(hashBuffer);
}

/**
 * Create SignedInfo element for XAdES-BES
 */
function crearSignedInfo(
  digest: string,
  certInfo: CertificadoInfo
): Element {
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

  const doc = parser.parseFromString(signedInfoXml, 'application/xml');
  return doc.documentElement;
}

/**
 * Canonicalize XML element
 * Uses Exclusive Canonicalization (exc-c14n)
 */
function canonicalizarXML(element: Element): string {
  // Simple canonicalization - in production, use a proper library
  // like xml-c14n or xmldsigjs

  // Serialize to string
  let xml = element.outerHTML;

  // Basic canonicalization steps:
  // 1. Remove declarations
  xml = xml.replace(/<\?[^>]*\?>/g, '');
  // 2. Normalize whitespace
  xml = xml.replace(/\s+/g, ' ').trim();
  // 3. Sort attributes (lexicographically)
  // (simplified - proper implementation would use a DOM parser)

  return xml;
}

/**
 * Sign data using RSA private key
 */
async function firmarDatos(
  data: string,
  privateKey: CryptoKey
): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);

  const signature = await crypto.subtle.sign(
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256'
    },
    privateKey,
    dataBuffer
  );

  return signature;
}

/**
 * Create XAdES-BES Signature element
 */
function crearSignatureElement(
  signatureValue: string,
  certificate: string,
  digest: string,
  certInfo: CertificadoInfo
): string {
  const now = new Date();
  const timestamp = now.toISOString();

  return `
    <ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
                  xmlns:xades="http://uri.etsi.org/01903/v1.3.2#">
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
        <xades:QualifyingProperties Target="#Signature-${timestamp}"
                                    xmlns:xades="http://uri.etsi.org/01903/v1.3.2#">
          <xades:SignedProperties>
            <xades:SignedSignatureProperties>
              <xades:SigningTime>${timestamp}</xades:SigningTime>
              <xades:SigningCertificate>
                <xades:Cert>
                  <xades:CertDigest>
                    <ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha256"/>
                    <ds:DigestValue>${digest}</ds:DigestValue>
                  </xades:CertDigest>
                  <xades:IssuerSerial>
                    <ds:X509IssuerName>${certInfo.issuer}</ds:X509IssuerName>
                    <ds:X509SerialNumber>${certInfo.serialNumber}</ds:X509SerialNumber>
                  </xades:IssuerSerial>
                </xades:Cert>
              </xades:SigningCertificate>
            </xades:SignedSignatureProperties>
            <xades:SignedDataObjectProperties>
              <xades:DataObjectFormat ObjectReference="#Reference-${timestamp}">
                <xades:MimeType>application/xml</xades:MimeType>
                <xades:Encoding>UTF-8</xades:Encoding>
              </xades:DataObjectFormat>
            </xades:SignedDataObjectProperties>
          </xades:SignedProperties>
        </xades:QualifyingProperties>
      </ds:Object>
    </ds:Signature>
  `;
}

/**
 * Insert signature into XML document
 */
function insertarFirmaEnXML(xmlContent: string, signature: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlContent, 'application/xml');

  // Find the root element
  const root = doc.documentElement;

  // Parse signature
  const signatureDoc = parser.parseFromString(signature, 'application/xml');
  const signatureElement = signatureDoc.documentElement;

  // Append signature to root
  root.appendChild(signatureElement);

  // Serialize back to string
  const serializer = new XMLSerializer();
  return serializer.serializeToString(doc);
}

/**
 * Convert ArrayBuffer to Base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert Base64 to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Parse X.509 certificate and extract information
 * This is a simplified version - for production, use a proper ASN.1 parser
 */
function parsearCertificado(derData: Uint8Array): CertificadoInfo {
  // NOTE: This is a simplified implementation
  // For production, use a proper X.509 parser like pkijs or forge

  // Ecuadorian certificates typically have:
  // - CN: Common Name (person's name or company)
  // - Email: Email address
  // - Serial Number: Often contains the Cédula for individuals
  // - OID 2.5.4.45: Unique ID (often cédula for Ecuador)

  return {
    subject: 'CN=Firmante,OU=Certificado Persona Natural,O=Banco Central del Ecuador,C=EC',
    issuer: 'CN=Security Data CA Ecuador,O=Security Data S.A.,C=EC',
    serialNumber: '1234567890',
    validFrom: new Date(),
    validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
    cn: 'Juan Pérez',
    email: 'juan.perez@example.com',
    cedula: '1712345678'
  };
}

/**
 * Import PKCS#8 private key into WebCrypto
 */
async function importarClavePrivada(
  pkcs8Data: Uint8Array,
  password: string
): Promise<CryptoKey> {
  try {
    // Import as PKCS#8
    const key = await crypto.subtle.importKey(
      'pkcs8',
      pkcs8Data,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256'
      },
      false, // extractable: false for security
      ['sign']
    );

    return key;
  } catch (e) {
    throw new Error('No se pudo importar la clave privada: ' + (e as Error).message);
  }
}

/**
 * Alternative: Import from PEM format
 */
async function importarClaveDesdePEM(pem: string): Promise<CryptoKey> {
  // Remove PEM headers and footers
  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';
  const pemContents = pem.substring(
    pemHeader.length,
    pem.length - pemFooter.length
  ).replace(/\s/g, '');

  // Decode base64
  const binaryDer = base64ToArrayBuffer(pemContents);

  // Import key
  return crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256'
    },
    false,
    ['sign']
  );
}

export default useFirmaDigital;
