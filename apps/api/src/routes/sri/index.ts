/**
 * Rutas API para servicios SRI
 *
 * Implementa endpoints para:
 * - Generación de XML SRI
 * - Firma digital XAdES-BES
 * - Envío de comprobantes al SRI
 * - Consulta de autorizaciones
 * - Validación de RUC
 */

import { Router, Request, Response } from 'express';
import {
  generarXMLSRI,
  generarClaveAcceso,
  generarSecuencial,
} from '../../services/sri/xml-generator';
import type { FacturaElectronica } from '../../services/sri/types';
import type { ClaveAccesoOptions } from '../../services/sri/xml-generator';
import {
  validarRUC,
  extraerRUCInfo,
} from '../../services/sri/ruc-validator';
import {
  SriClient,
  SRIError,
  SRIEnvioError,
  SRIFirmaError,
  type CertificadoDigital,
  type AmbienteSRI,
  type FirmaOptions,
  createSriClient,
  EstadoAutorizacion,
  type RespuestaAutorizacion,
} from '../../services/sri/sri-client';

const router: Router = Router();

// ============ MIDDLEWARES ============

/**
 * Middleware de manejo de errores SRI
 */
function handleSRIError(error: unknown,  req: Request,  res: Response): void {
  console.error('Error SRI:', error);

  if (error instanceof SRIError) {
    res.status(400).json({
      error: error.message, 
      codigo: error.codigo, 
      detalles: (error as any).detalles,
    });
    return;
  }

  if (error instanceof SRIEnvioError) {
    res.status(502).json({
      error: 'Error comunicándose con el SRI', 
      mensaje: error.message, 
      statusCode: (error as any).statusCode,
    });
    return;
  }

  res.status(500).json({
    error: 'Error interno del servidor', 
  });
}

// ============ ENDPOINTS EXISTENTES ============

/**
 * POST /api/sri/xml/generar
 * Genera XML para facturación electrónica
 */
router.post('/xml/generar',  async (req,  res) => {
  try {
    const factura = req.body as FacturaElectronica;

    // Validar datos mínimos
    if (!factura.infoTributaria?.ruc) {
      return res.status(400).json({
        error: 'RUC es obligatorio', 
      });
    }

    // Generar XML
    const xml = generarXMLSRI(factura,  { pretty: true });

    res.json({
      xml, 
      claveAcceso: factura.infoTributaria.claveAcceso, 
      secuencial: factura.infoTributaria.secuencial, 
    });
  } catch (error) {
    console.error('Error generando XML:', error);
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Error generando XML', 
    });
  }
});

/**
 * POST /api/sri/validar/ruc
 * Valida un RUC ecuatoriano
 */
router.post('/validar/ruc',  (req,  res) => {
  try {
    const { ruc } = req.body;

    if (!ruc) {
      return res.status(400).json({
        error: 'RUC es obligatorio', 
      });
    }

    const validacion = validarRUC(ruc);

    if (!validacion.valid) {
      return res.json({
        valid: false, 
        error: validacion.error, 
      });
    }

    const info = extraerRUCInfo(ruc);

    res.json({
      valid: true, 
      info, 
    });
  } catch (error) {
    console.error('Error validando RUC:', error);
    res.status(500).json({
      error: 'Error validando RUC', 
    });
  }
});

/**
 * POST /api/sri/clave-acceso/generar
 * Genera clave de acceso según especificaciones SRI
 */
router.post('/clave-acceso/generar',  (req,  res) => {
  try {
    const options = req.body as ClaveAccesoOptions;

    // Validar campos requeridos
    if (!options.fechaEmision || !options.tipoComprobante || !options.ruc) {
      return res.status(400).json({
        error: 'fechaEmision,  tipoComprobante y ruc son obligatorios', 
      });
    }

    const claveAcceso = generarClaveAcceso(options);

    res.json({ claveAcceso });
  } catch (error) {
    console.error('Error generando clave de acceso:', error);
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Error generando clave de acceso', 
    });
  }
});

/**
 * POST /api/sri/secuencial/generar
 * Genera número de secuencia para factura
 */
router.post('/secuencial/generar',  (req,  res) => {
  try {
    const { establecimiento, numero } = req.body;

    if (!establecimiento || numero === undefined) {
      return res.status(400).json({
        error: 'establecimiento y numero son obligatorios', 
      });
    }

    const secuencial = generarSecuencial(establecimiento,  numero);

    res.json({ secuencial });
  } catch (error) {
    console.error('Error generando secuencial:', error);
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Error generando secuencial', 
    });
  }
});

// ============ NUEVOS ENDPOINTS - FIRMA Y ENVÍO SRI ============

/**
 * POST /api/sri/firmar
 * Firma un XML con certificado digital (XAdES-BES)
 *
 * @body { xml: string, certificado: CertificadoDigital, options?: FirmaOptions }
 * @returns { xmlFirmado: string, firmaBase64: string, certificadoBase64: string, digest: string }
 */
router.post('/firmar',  async (req,  res) => {
  try {
    const { xml, certificado, options } = req.body;

    // Validar campos requeridos
    if (!xml) {
      return res.status(400).json({
        error: 'XML es obligatorio', 
      });
    }

    if (!certificado || !certificado.certPem || !certificado.keyPem) {
      return res.status(400).json({
        error: 'Certificado con certPem y keyPem es obligatorio', 
      });
    }

    // Obtener ambiente del certificado o usar pruebas por defecto
    const ambiente = (req.headers['x-sri-ambiente'] as AmbienteSRI) || '1';
    const client = createSriClient(ambiente);

    // Firmar XML
    const resultado = await client.firmarXML(xml,  certificado as CertificadoDigital,  options as FirmaOptions);

    res.json({
      xmlFirmado: resultado.xmlFirmado, 
      firmaBase64: resultado.firmaBase64, 
      certificadoBase64: resultado.certificadoBase64, 
      digest: resultado.digest, 
      timestamp: resultado.timestamp, 
    });
  } catch (error) {
    console.error('Error firmando XML:', error);
    if (error instanceof SRIError || error instanceof SRIFirmaError) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : 'Error firmando XML', 
        codigo: (error as any).codigo,
      });
    }
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Error firmando XML', 
    });
  }
});

/**
 * POST /api/sri/enviar
 * Envía un comprobante XML firmado al SRI
 *
 * @body { xmlFirmado: string, ambiente?: '1' | '2' }
 * @returns { estado: string, numeroAutorizacion?: string, fechaAutorizacion?: string }
 */
router.post('/enviar',  async (req,  res) => {
  try {
    const { xmlFirmado, ambiente } = req.body;

    // Validar campos requeridos
    if (!xmlFirmado) {
      return res.status(400).json({
        error: 'xmlFirmado es obligatorio', 
      });
    }

    // Crear cliente con ambiente especificado
    const client = createSriClient((ambiente as AmbienteSRI) || '1');

    // Enviar comprobante al SRI
    const respuesta = await client.enviarComprobante(xmlFirmado);

    res.json(respuesta);
  } catch (error) {
    console.error('Error enviando comprobante:', error);
    if (error instanceof SRIError || error instanceof SRIEnvioError) {
      return res.status(502).json({
        error: error instanceof Error ? error.message : 'Error enviando comprobante al SRI', 
        codigo: (error as any).codigo,
      });
    }
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Error enviando comprobante', 
    });
  }
});

/**
 * POST /api/sri/firmar-y-enviar
 * Firma y envía un comprobante en una sola operación
 *
 * @body { xml: string, certificado: CertificadoDigital, ambiente?: '1' | '2' }
 * @returns { firma: ResultadoFirma, autorizacion: RespuestaAutorizacion }
 */
router.post('/firmar-y-enviar',  async (req,  res) => {
  try {
    const { xml, certificado, ambiente } = req.body;

    // Validar campos requeridos
    if (!xml) {
      return res.status(400).json({ error: 'XML es obligatorio' });
    }

    if (!certificado || !certificado.certPem || !certificado.keyPem) {
      return res.status(400).json({
        error: 'Certificado con certPem y keyPem es obligatorio', 
      });
    }

    // Crear cliente con ambiente especificado
    const client = createSriClient((ambiente as AmbienteSRI) || '1');

    // Firmar XML
    const resultadoFirma = await client.firmarXML(xml,  certificado as CertificadoDigital);

    // Enviar al SRI
    const respuestaAutorizacion = await client.enviarComprobante(resultadoFirma.xmlFirmado);

    res.json({
      firma: {
        xmlFirmado: resultadoFirma.xmlFirmado, 
        firmaBase64: resultadoFirma.firmaBase64, 
        certificadoBase64: resultadoFirma.certificadoBase64, 
        digest: resultadoFirma.digest, 
        timestamp: resultadoFirma.timestamp, 
      }, 
      autorizacion: respuestaAutorizacion, 
    });
  } catch (error) {
    console.error('Error en operación firmar-y-enviar:', error);
    if (error instanceof SRIError || error instanceof SRIFirmaError || error instanceof SRIEnvioError) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : 'Error en operación firmar-y-enviar', 
        codigo: (error as any).codigo,
      });
    }
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Error en operación', 
    });
  }
});

/**
 * GET /api/sri/autorizacion/:claveAcceso
 * Consulta el estado de autorización de un comprobante
 *
 * @param claveAcceso - Clave de acceso de 49 dígitos
 * @query ambiente - Ambiente SRI (1=pruebas,  2=producción)
 * @returns { estado, numeroAutorizacion, fechaAutorizacion, mensajes }
 */
router.get('/autorizacion/:claveAcceso',  async (req,  res) => {
  try {
    const { claveAcceso } = req.params;
    const { ambiente } = req.query;

    // Validar clave de acceso
    if (!claveAcceso || claveAcceso.length !== 49) {
      return res.status(400).json({
        error: 'Clave de acceso debe tener 49 caracteres', 
      });
    }

    // Crear cliente
    const client = createSriClient((ambiente as AmbienteSRI) || '1');

    // Consultar autorización
    const respuesta = await client.consultarAutorizacion(claveAcceso);

    res.json(respuesta);
  } catch (error) {
    console.error('Error consultando autorización:', error);
    if (error instanceof SRIError || error instanceof SRIEnvioError) {
      return res.status(502).json({
        error: error instanceof Error ? error.message : 'Error consultando autorización', 
        codigo: (error as any).codigo,
      });
    }
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Error consultando autorización', 
    });
  }
});

/**
 * POST /api/sri/autorizacion/consulta
 * Consulta el estado de autorización por POST
 *
 * @body { claveAcceso: string, ambiente?: '1' | '2' }
 * @returns { estado, numeroAutorizacion, fechaAutorizacion, mensajes }
 */
router.post('/autorizacion/consulta',  async (req,  res) => {
  try {
    const { claveAcceso, ambiente } = req.body;

    // Validar clave de acceso
    if (!claveAcceso || claveAcceso.length !== 49) {
      return res.status(400).json({
        error: 'Clave de acceso debe tener 49 caracteres', 
      });
    }

    // Crear cliente
    const client = createSriClient((ambiente as AmbienteSRI) || '1');

    // Consultar autorización
    const respuesta = await client.consultarAutorizacion(claveAcceso);

    res.json(respuesta);
  } catch (error) {
    console.error('Error consultando autorización:', error);
    if (error instanceof SRIError || error instanceof SRIEnvioError) {
      return res.status(502).json({
        error: error instanceof Error ? error.message : 'Error consultando autorización', 
        codigo: (error as any).codigo,
      });
    }
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Error consultando autorización', 
    });
  }
});

/**
 * POST /api/sri/validar/esquema
 * Valida un XML contra el esquema SRI
 *
 * @body { xml: string }
 * @returns { valido: boolean, errores?: string[] }
 */
router.post('/validar/esquema',  async (req,  res) => {
  try {
    const { xml } = req.body;

    if (!xml) {
      return res.status(400).json({
        error: 'XML es obligatorio', 
      });
    }

    const ambiente = (req.headers['x-sri-ambiente'] as AmbienteSRI) || '1';
    const client = createSriClient(ambiente);

    const valido = client.validarEsquema(xml);

    res.json({ valido });
  } catch (error) {
    console.error('Error validando esquema:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Error validando esquema', 
    });
  }
});

export default router;
