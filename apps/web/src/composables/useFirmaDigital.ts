import { ref, computed } from 'vue';

/**
 * Composable de Firma Digital - Integracion con Backend
 *
 * Este composable implementa la funcionalidad de firma digital XAdES-BES
 * usando endpoints del servidor para:
 * - Parsear certificados PKCS#12 (.p12)
 * - Firmar documentos XML
 * - Validar firmas
 *
 * SEGURIDAD:
 * - La clave privada nunca se almacena en el cliente
 * - El parsing PKCS#12 se hace en el servidor
 * - La firma se realiza en el servidor
 */

// ============= TYPES =============

/**
 * Informacion del certificado extraida del backend
 */
export interface CertificadoInfo {
  subject: string;
  issuer: string;
  serialNumber: string;
  validFrom: Date;
  validTo: Date;
  cn: string; // Common Name - nombre del firmante
  email?: string;
  cedula?: string; // Cedula ecuatoriana
  organization?: string;
  organizationalUnit?: string;
  country?: string;
}

/**
 * Resultado de la operacion de firma
 */
export interface ResultadoFirma {
  xmlFirmado: string;
  firmaBase64: string;
  certificadoBase64: string;
  timestamp: Date;
}

/**
 * Resultado de validacion de firma
 */
export interface ResultadoValidacion {
  valido: boolean;
  mensaje: string;
  firmante?: string;
  fechaFirma?: Date;
  certificadoVigente?: boolean;
  detalles?: {
    algoritmoFirma: string;
    digestAlgoritmo: string;
    certificadoEmisor?: string;
    certificadoSerie?: string;
  };
}

// ============= COMPOSABLE =============

export function useFirmaDigital() {
  // Estado reactivo
  const certificadoCargado = ref(false);
  const certificadoInfo = ref<CertificadoInfo | null>(null);
  const certificadoPem = ref<string | null>(null);
  const cargando = ref(false);
  const error = ref<string | null>(null);

  // Propiedades computadas
  const listoParaFirmar = computed(() => certificadoCargado.value && certificadoPem.value !== null);

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

  // ============= METODOS PUBLICOS =============

  /**
   * Cargar certificado digital PKCS#12 (.p12/.pfx)
   *
   * Envia el archivo al servidor para procesamiento seguro.
   * El servidor extrae la informacion del certificado usando pkijs.
   *
   * @param archivo - Archivo .p12 o .pfx
   * @param password - Contrasena del certificado
   * @returns Informacion del certificado extraida
   */
  const cargarCertificado = async (
    archivo: File,
    password: string
  ): Promise<CertificadoInfo> => {
    cargando.value = true;
    error.value = null;

    try {
      // Validar extension del archivo
      const extension = archivo.name.toLowerCase().split('.').pop();
      if (extension !== 'p12' && extension !== 'pfx') {
        throw new Error('Formato de archivo invalido. Se espera un archivo .p12 o .pfx');
      }

      // Leer archivo y convertir a base64
      const buffer = await archivo.arrayBuffer();
      const base64 = arrayBufferToBase64(buffer);

      // Enviar al backend para procesamiento
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/api/firma/parsear-pkcs12`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
        },
        body: JSON.stringify({
          pkcs12Base64: base64,
          password
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al procesar el certificado');
      }

      const data = await response.json();

      // Almacenar informacion del certificado
      certificadoInfo.value = data.info;
      certificadoPem.value = data.certificadoPem;
      certificadoCargado.value = true;

      // Validar que el certificado este vigente
      if (!data.vigente) {
        error.value = 'El certificado no esta vigente. Verifique las fechas de validez.';
        throw new Error('Certificado no vigente');
      }

      return data.info;
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : 'Error al cargar certificado';
      error.value = mensaje;
      throw new Error(mensaje);
    } finally {
      cargando.value = false;
    }
  };

  /**
   * Firmar XML Document con XAdES-BES
   *
   * Envia el XML al servidor para ser firmado con el certificado cargado.
   *
   * @param xmlContent - XML document to sign (string)
   * @returns Signed XML with XAdES-BES signature
   */
  const firmarXML = async (xmlContent: string): Promise<ResultadoFirma> => {
    if (!certificadoPem.value || !certificadoInfo.value) {
      throw new Error('Certificado no cargado. Use cargarCertificado primero.');
    }

    if (!certificadoVigente.value) {
      throw new Error('El certificado no esta vigente. No se puede firmar.');
    }

    cargando.value = true;
    error.value = null;

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

      // Por ahora, el endpoint SRI requiere certificado y llave privada
      // La implementacion actual requiere ambos (certPem y keyPem)
      throw new Error(
        'La firma requiere que la llave privada este disponible en el servidor. ' +
        'Use el componente FirmaDigital que implementa el flujo completo.'
      );
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error al firmar documento';
      throw e;
    } finally {
      cargando.value = false;
    }
  };

  /**
   * Validar firma en servidor
   *
   * Envia el XML firmado al servidor para validacion
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
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
        },
        body: JSON.stringify({ xml: xmlFirmado })
      });

      if (!response.ok) {
        throw new Error(`Error de validacion: ${response.statusText}`);
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

  /**
   * Limpiar datos del certificado de memoria
   *
   * NOTA: La llave privada nunca se almacena en el cliente,
   * solo mantenemos el certificado PEM para referencia.
   */
  const limpiarMemoria = (): void => {
    certificadoInfo.value = null;
    certificadoPem.value = null;
    certificadoCargado.value = false;
    error.value = null;
  };

  return {
    // Estado
    certificadoCargado,
    certificadoInfo,
    cargando,
    error,
    listoParaFirmar,
    nombreFirmante,
    certificadoVigente,

    // Metodos
    cargarCertificado,
    firmarXML,
    validarFirmaServidor,
    limpiarMemoria
  };
}

// ============= HELPER FUNCTIONS =============

/**
 * Convertir ArrayBuffer a Base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export default useFirmaDigital;
