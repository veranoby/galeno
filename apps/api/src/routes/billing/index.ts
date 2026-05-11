/**
 * Rutas API para Facturación Electrónica
 *
 * Implementa endpoints para:
 * - CRUD de facturas
 * - Generación de XML SRI
 * - Firma digital XAdES-BES
 * - Envío y recepción SRI
 * - Historial de autorizaciones
 * - Descarga de XML autorizado
 */
import { Router, Request, Response } from 'express';
import { billingService } from '../../services/billing/billing.service';
import { generarXMLSRI } from '../../services/sri/xml-generator';
import type { FacturaElectronica } from '../../services/sri/types';
import type { FacturaInput } from '../../services/billing/billing.types';

const router: Router = Router();

// ============= MIDDLEWARES =============

/**
 * Middleware de manejo de errores
 */
function handleBillingError(error: unknown, req: Request, res: Response): void {
  console.error('Error Facturación:', error);

  if (error instanceof Error) {
    res.status(500).json({
      error: error.message,
    });
    return;
  }

  res.status(500).json({
    error: 'Error interno del servidor',
  });
}

// ============= ENDPOINTS FACTURAS =============

/**
 * GET /api/v1/billing/facturas
 * Lista todas las facturas del usuario
 */
router.get('/facturas', async (req: Request, res: Response) => {
  try {
    // TODO: Obtener cuentaId del usuario autenticado
    // Por ahora usamos un ID hardcoded para testing
    const cuentaId = req.query.cuentaId as string || 'demo-account-id';

    const facturas = await billingService.getFacturas(cuentaId);

    res.json({
      facturas,
      total: facturas.length,
    });
  } catch (error) {
    handleBillingError(error, req, res);
  }
});

/**
 * GET /api/v1/billing/facturas/:id
 * Obtiene una factura por ID
 */
router.get('/facturas/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };

    const factura = await billingService.getFacturaById(id);

    if (!factura) {
      return res.status(404).json({
        error: 'Factura no encontrada',
      });
    }

    res.json(factura);
  } catch (error) {
    handleBillingError(error, req, res);
  }
});

/**
 * POST /api/v1/billing/facturas
 * Crea una nueva factura
 */
router.post('/facturas', async (req: Request, res: Response) => {
  try {
    const factura = req.body as FacturaElectronica;

    // TODO: Obtener cuentaId del usuario autenticado
    const cuentaId = req.body.cuentaId || 'demo-account-id';

    if (!cuentaId) {
      return res.status(400).json({
        error: 'cuentaId es obligatorio',
      });
    }

    const facturaGuardada = await billingService.createFactura(factura, cuentaId);

    res.status(201).json(facturaGuardada);
  } catch (error) {
    handleBillingError(error, req, res);
  }
});

/**
 * PUT /api/v1/billing/facturas/:id
 * Actualiza una factura existente
 */
router.put('/facturas/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const facturaData = req.body as Partial<FacturaElectronica>;

    // Map SRI format to our DB input format
    const updateData: Partial<FacturaInput> = {};
    if (facturaData.infoTributaria?.ruc) updateData.ruc = facturaData.infoTributaria.ruc;
    if (facturaData.infoFactura?.razonSocialComprador) updateData.razonSocial = facturaData.infoFactura.razonSocialComprador;
    if (facturaData.infoTributaria?.secuencial) updateData.secuencial = facturaData.infoTributaria.secuencial;
    if (facturaData.infoFactura?.fechaEmision) updateData.fechaEmision = new Date(facturaData.infoFactura.fechaEmision);
    if (facturaData.infoFactura?.totalSinImpuestos) updateData.montoTotal = Number(facturaData.infoFactura.totalSinImpuestos);

    const facturaActualizada = await billingService.updateFactura(id, updateData);

    res.json(facturaActualizada);
  } catch (error) {
    handleBillingError(error, req, res);
  }
});

/**
 * DELETE /api/v1/billing/facturas/:id
 * Elimina una factura
 */
router.delete('/facturas/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };

    await billingService.deleteFactura(id);

    res.status(204).send();
  } catch (error) {
    handleBillingError(error, req, res);
  }
});

// ============= ENDPOINTS AUTORIZACIÓN SRI =============

/**
 * POST /api/v1/billing/facturas/:id/enviar-sri
 * Envía una factura al SRI para autorización
 */
router.post('/facturas/:id/enviar-sri', async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const { ambiente } = req.body; // '1' = pruebas, '2' = producción

    const respuesta = await billingService.enviarSRI(id, ambiente || '1');

    res.json(respuesta);
  } catch (error) {
    handleBillingError(error, req, res);
  }
});

/**
 * GET /api/v1/billing/facturas/:id/autorizacion
 * Consulta el estado de autorización de una factura
 */
router.get('/facturas/:id/autorizacion', async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const { claveAcceso, ambiente } = req.query as any;

    const respuesta = await billingService.consultarAutorizacion(
      id,
      claveAcceso,
      ambiente || '1'
    );

    res.json(respuesta);
  } catch (error) {
    handleBillingError(error, req, res);
  }
});

/**
 * GET /api/v1/billing/facturas/:id/descargar-xml
 * Descarga el XML autorizado de una factura
 */
router.get('/facturas/:id/descargar-xml', async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };

    const resultado = await billingService.getXmlAutorizado(id);

    if (!resultado) {
      return res.status(404).json({
        error: 'Factura no encontrada',
      });
    }

    // Establecer headers para descarga
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="factura_${resultado.secuencial}.xml"`
    );

    res.send(resultado.xml);
  } catch (error) {
    handleBillingError(error, req, res);
  }
});

export default router;
