/**
 * WhatsApp Service - Index
 *
 * Exporta todos los componentes del servicio de WhatsApp
 */

export {
  WhatsAppProvider,
  WhatsAppProviderConfig,
  WhatsAppMessageRequest,
  WhatsAppTemplateRequest,
  WhatsAppMessageResponse,
  WhatsAppMessageStatusResponse,
  WhatsAppWebhookPayload,
  WhatsAppWebhookResult,
  WhatsAppMessageStatus,
  WhatsAppTemplateType,
  WhatsAppGatewayType,
  WhatsAppError,
  WhatsAppWebhookSignatureError,
  WhatsAppTemplateNotApprovedError,
  AppointmentReminderTemplate,
} from './whatsapp.base.js';

export { TwilioWhatsAppProvider } from './whatsapp.provider.js';

/**
 * Factory para crear proveedor de WhatsApp
 */
import { TwilioWhatsAppProvider } from './whatsapp.provider.js';
import type { WhatsAppProvider, WhatsAppProviderConfig } from './whatsapp.base.js';

export function createWhatsAppProvider(
  type: 'twilio' | 'meta' = 'twilio',
  config?: WhatsAppProviderConfig
): WhatsAppProvider {
  switch (type) {
    case 'twilio':
      return new TwilioWhatsAppProvider(config);
    // case 'meta':
    //   return new MetaWhatsAppProvider(config);
    default:
      throw new Error(`Unknown WhatsApp provider type: ${type}`);
  }
}

/**
 * Singleton instance del proveedor de WhatsApp
 */
let whatsappProviderInstance: WhatsAppProvider | null = null;

export function getWhatsAppProvider(): WhatsAppProvider {
  if (!whatsappProviderInstance) {
    whatsappProviderInstance = createWhatsAppProvider('twilio');
  }
  return whatsappProviderInstance;
}

export function resetWhatsAppProvider(): void {
  whatsappProviderInstance = null;
}
