/**
 * Módulo de facturación electrónica
 * Exporta servicios y tipos para facturación SRI
 */

export { billingService, BillingService } from './billing.service';
export { facturaRepository, FacturaRepository } from './factura.repository';
export type {
  Factura,
  FacturaInput,
  FacturaDetalle,
  Impuesto,
  InfoAdicional,
  AutorizacionSRIResponse,
  MensajeSRI,
} from './billing.types';
