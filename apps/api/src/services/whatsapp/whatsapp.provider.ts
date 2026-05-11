/**
 * Twilio WhatsApp Provider
 *
 * Implementación del proveedor de WhatsApp usando Twilio WhatsApp API
 *
 * @see https://www.twilio.com/docs/whatsapp
 */

import axios, { AxiosInstance } from 'axios';
import { logger } from '../../utils/logger.js';
import {
  WhatsAppProvider,
  WhatsAppProviderConfig,
  WhatsAppMessageRequest,
  WhatsAppTemplateRequest,
  WhatsAppMessageResponse,
  WhatsAppMessageStatusResponse,
  WhatsAppWebhookPayload,
  WhatsAppWebhookResult,
  WhatsAppMessageStatus,
  WhatsAppError,
  WhatsAppWebhookSignatureError,
  AppointmentReminderTemplate,
} from './whatsapp.base.js';

/**
 * Configuración específica de Twilio
 */
interface TwilioConfig extends WhatsAppProviderConfig {
  accountSid: string;
  authToken: string;
  fromPhoneNumber: string; // WhatsApp number: whatsapp:+14155238886
}

export class TwilioWhatsAppProvider extends WhatsAppProvider {
  private client: AxiosInstance;
  private twilioConfig: TwilioConfig;

  constructor(config?: Partial<TwilioConfig>) {
    super({
      accountSid: config?.accountSid || process.env.TWILIO_ACCOUNT_SID || '',
      authToken: config?.authToken || process.env.TWILIO_AUTH_TOKEN || '',
      fromPhoneNumber: config?.fromPhoneNumber || process.env.TWILIO_WHATSAPP_NUMBER || '',
      baseUrl: config?.baseUrl || 'https://api.twilio.com/2010-04-01',
      timeout: config?.timeout || 30000,
    });

    this.twilioConfig = this.config as TwilioConfig;
    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      auth: {
        username: this.twilioConfig.accountSid,
        password: this.twilioConfig.authToken,
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    // Request interceptor for logging
    this.client.interceptors.request.use((config) => {
      logger.debug({ url: config.url, method: config.method }, 'Twilio API request');
      return config;
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        logger.error(
          {
            url: error.config?.url,
            status: error.response?.status,
            data: error.response?.data,
          },
          'Twilio API error'
        );
        return Promise.reject(error);
      }
    );
  }

  /**
   * Validaciones específicas de Twilio
   */
  protected async onValidateConfig(): Promise<void> {
    const errors: string[] = [];

    if (!this.twilioConfig.accountSid) {
      errors.push('TWILIO_ACCOUNT_SID');
    }

    if (!this.twilioConfig.authToken) {
      errors.push('TWILIO_AUTH_TOKEN');
    }

    if (!this.twilioConfig.fromPhoneNumber) {
      errors.push('TWILIO_WHATSAPP_NUMBER');
    }

    if (errors.length > 0) {
      throw new Error(
        `Twilio WhatsApp provider missing required config: ${errors.join(', ')}`
      );
    }

    // Validate phone number format
    if (!this.twilioConfig.fromPhoneNumber.startsWith('whatsapp:+')) {
      throw new Error(
        'TWILIO_WHATSAPP_NUMBER must be in format: whatsapp:+[country_code][number] (e.g., whatsapp:+14155238886)'
      );
    }
  }

  /**
   * Enviar mensaje de texto simple
   */
  async sendMessage(request: WhatsAppMessageRequest): Promise<WhatsAppMessageResponse> {
    try {
      const messageId = this.generateMessageId();
      const formattedTo = this.formatPhoneNumberForTwilio(request.to);

      const params = new URLSearchParams();
      params.append('From', this.twilioConfig.fromPhoneNumber);
      params.append('To', formattedTo);
      params.append('Body', request.body);

      const response = await this.client.post('/Messages.json', params.toString());

      const twilioMessage = response.data;

      logger.info(
        {
          messageId: twilioMessage.sid,
          to: formattedTo,
          status: twilioMessage.status,
        },
        'WhatsApp message sent via Twilio'
      );

      return {
        messageId: twilioMessage.sid,
        status: this.mapTwilioStatus(twilioMessage.status),
        to: formattedTo,
        timestamp: new Date(twilioMessage.date_created),
      };
    } catch (error: any) {
      logger.error({ error: error.response?.data || error.message }, 'Failed to send WhatsApp message');

      return {
        messageId: this.generateMessageId(),
        status: 'failed',
        to: this.formatPhoneNumberForTwilio(request.to),
        error: error.response?.data?.message || error.message,
        errorCode: String(error.response?.data?.code ?? 'UNKNOWN_ERROR'),
      };
    }
  }

  /**
   * Enviar mensaje con plantilla
   */
  async sendTemplate(request: WhatsAppTemplateRequest): Promise<WhatsAppMessageResponse> {
    try {
      const messageId = this.generateMessageId();
      const formattedTo = this.formatPhoneNumberForTwilio(request.to);

      // Twilio uses contentSid for approved templates
      // For template variables, we use ContentVariables
      const params = new URLSearchParams();
      params.append('From', this.twilioConfig.fromPhoneNumber);
      params.append('To', formattedTo);

      // Use contentSid for approved templates (Twilio approach)
      // Format: contentSid or template name with variables in body
      const contentVariables = request.variables
        ? JSON.stringify(request.variables.reduce((acc, var_, idx) => {
            acc[`{{${idx + 1}}}`] = var_;
            return acc;
          }, {} as Record<string, string>))
        : undefined;

      // For template messages, we use the template name as ContentSid
      // In production, you should use actual ContentSid from Twilio
      params.append('ContentSid', this.mapTemplateNameToContentSid(request.templateName));

      if (contentVariables) {
        params.append('ContentVariables', contentVariables);
      }

      const response = await this.client.post('/Messages.json', params.toString());

      const twilioMessage = response.data;

      logger.info(
        {
          messageId: twilioMessage.sid,
          to: formattedTo,
          template: request.templateName,
          status: twilioMessage.status,
        },
        'WhatsApp template message sent via Twilio'
      );

      return {
        messageId: twilioMessage.sid,
        status: this.mapTwilioStatus(twilioMessage.status),
        to: formattedTo,
        timestamp: new Date(twilioMessage.date_created),
      };
    } catch (error: any) {
      logger.error(
        { error: error.response?.data || error.message, template: request.templateName },
        'Failed to send WhatsApp template message'
      );

      return {
        messageId: this.generateMessageId(),
        status: 'failed',
        to: this.formatPhoneNumberForTwilio(request.to),
        error: error.response?.data?.message || error.message,
        errorCode: String(error.response?.data?.code ?? 'UNKNOWN_ERROR'),
      };
    }
  }

  /**
   * Enviar recordatorio de cita (24 horas antes) - Override con fallback
   */
  async sendAppointmentReminder24h(
    to: string,
    data: AppointmentReminderTemplate
  ): Promise<WhatsAppMessageResponse> {
    // Try template first
    const templateResult = await super.sendAppointmentReminder24h(to, data);

    // If template fails, fall back to simple message
    if (templateResult.status === 'failed') {
      logger.warn({ messageId: templateResult.messageId }, 'Template failed, using fallback message');
      return this.sendFallbackReminder24h(to, data);
    }

    return templateResult;
  }

  /**
   * Fallback message for 24h reminder
   */
  private async sendFallbackReminder24h(
    to: string,
    data: AppointmentReminderTemplate
  ): Promise<WhatsAppMessageResponse> {
    const message = `🏥 *Recordatorio de Cita - Galeno*\n\n` +
      `Hola ${data.pacienteNombre},\n\n` +
      `Tienes una cita médica mañana:\n` +
      `👨‍⚕️ Doctor: ${data.doctorNombre}\n` +
      `📅 Fecha: ${data.fechaHora}\n` +
      `📍 Tipo: ${data.tipo === 'teleconsulta' ? 'Virtual (Videoconferencia)' : 'Presencial'}\n` +
      (data.tipo === 'teleconsulta' && data.linkVideo
        ? `🔗 Link: ${data.linkVideo}\n`
        : data.ubicacion
        ? `📍 Ubicación: ${data.ubicacion}\n`
        : '') +
      `\nSi necesitas cancelar o reprogramar, por favor avisa con anticipación.\n\n` +
      `*Galeno* - Tu salud es primero`;

    return this.sendMessage({
      to,
      body: message,
      templateType: 'appointment_reminder_24h',
      metadata: data,
    });
  }

  /**
   * Enviar recordatorio de cita (1 hora antes) - Override con fallback
   */
  async sendAppointmentReminder1h(
    to: string,
    data: AppointmentReminderTemplate
  ): Promise<WhatsAppMessageResponse> {
    const templateResult = await super.sendAppointmentReminder1h(to, data);

    if (templateResult.status === 'failed') {
      logger.warn({ messageId: templateResult.messageId }, 'Template failed, using fallback message');
      return this.sendFallbackReminder1h(to, data);
    }

    return templateResult;
  }

  /**
   * Fallback message for 1h reminder
   */
  private async sendFallbackReminder1h(
    to: string,
    data: AppointmentReminderTemplate
  ): Promise<WhatsAppMessageResponse> {
    const message = `⏰ *Recordatorio Urgente - Cita en 1 Hora*\n\n` +
      `Hola ${data.pacienteNombre},\n\n` +
      `Tu cita médica es en 1 hora:\n` +
      `👨‍⚕️ Doctor: ${data.doctorNombre}\n` +
      `📅 Hora: ${data.fechaHora}\n` +
      (data.tipo === 'teleconsulta' && data.linkVideo
        ? `🔗 *Link de Videoconferencia:* ${data.linkVideo}\n\n*¡Conéctate 5 minutos antes!*`
        : data.ubicacion
        ? `📍 Ubicación: ${data.ubicacion}\n\n*¡Llega 10 minutos antes!*`
        : '') +
      `\n\n*Galeno*`;

    return this.sendMessage({
      to,
      body: message,
      templateType: 'appointment_reminder_1h',
      metadata: data,
    });
  }

  /**
   * Enviar link de teleconsulta - Override con fallback
   */
  async sendTeleconsultaLink(
    to: string,
    data: { pacienteNombre: string; doctorNombre: string; linkVideo: string; fechaHora: string }
  ): Promise<WhatsAppMessageResponse> {
    const templateResult = await super.sendTeleconsultaLink(to, data);

    if (templateResult.status === 'failed') {
      logger.warn({ messageId: templateResult.messageId }, 'Template failed, using fallback message');
      return this.sendFallbackTeleconsultaLink(to, data);
    }

    return templateResult;
  }

  /**
   * Fallback message for teleconsulta link
   */
  private async sendFallbackTeleconsultaLink(
    to: string,
    data: { pacienteNombre: string; doctorNombre: string; linkVideo: string; fechaHora: string }
  ): Promise<WhatsAppMessageResponse> {
    const message = `📹 *Link de Teleconsulta - Galeno*\n\n` +
      `Hola ${data.pacienteNombre},\n\n` +
      `Tu teleconsulta está programada:\n` +
      `👨‍⚕️ Doctor: ${data.doctorNombre}\n` +
      `📅 Fecha: ${data.fechaHora}\n\n` +
      `🔗 *Link de Videoconferencia:*\n${data.linkVideo}\n\n` +
      `*Recomendaciones:*\n` +
      `✅ Conéctate 5 minutos antes\n` +
      `✅ Busca un lugar tranquilo y bien iluminado\n` +
      `✅ Verifica tu conexión a internet\n` +
      `✅ Usa audífonos para mejor privacidad\n\n` +
      `*Galeno* - Medicina a un clic de distancia`;

    return this.sendMessage({
      to,
      body: message,
      templateType: 'teleconsulta_link',
      metadata: data,
    });
  }

  /**
   * Verificar status de mensaje
   */
  async getMessageStatus(messageId: string): Promise<WhatsAppMessageStatusResponse> {
    try {
      const response = await this.client.get(`/Messages/${messageId}.json`);
      const twilioMessage = response.data;

      return {
        messageId: twilioMessage.sid,
        status: this.mapTwilioStatus(twilioMessage.status),
        deliveredAt: twilioMessage.status === 'delivered' ? new Date(twilioMessage.date_updated) : undefined,
        readAt: twilioMessage.status === 'read' ? new Date(twilioMessage.date_updated) : undefined,
      };
    } catch (error: any) {
      logger.error({ messageId, error: error.message }, 'Failed to get message status');
      throw new WhatsAppError(
        `Failed to get message status: ${error.message}`,
        'STATUS_CHECK_FAILED',
        messageId
      );
    }
  }

  /**
   * Procesar webhook de Twilio
   */
  async handleWebhook(payload: any, signature?: string): Promise<WhatsAppWebhookResult> {
    try {
      // Twilio sends form-urlencoded data
      const twilioSignature = payload?.['X-Twilio-Signature'] || signature;

      if (!twilioSignature) {
        logger.warn('Missing Twilio signature in webhook');
        return {
          success: false,
          error: 'Missing signature',
        };
      }

      // Verify Twilio signature
      const isValid = this.verifyTwilioSignature(payload, twilioSignature);

      if (!isValid) {
        logger.warn({ signature: twilioSignature }, 'Invalid Twilio signature');
        return {
          success: false,
          error: 'Invalid signature',
        };
      }

      // Map Twilio status to our event type
      const event = this.mapTwilioStatusToEvent(payload.MessageStatus);
      const status = this.mapTwilioStatus(payload.MessageStatus);

      logger.info(
        {
          messageId: payload.MessageSid,
          event,
          status,
          to: payload.To,
        },
        'Twilio webhook received'
      );

      // Here you would update the database with the message status
      // For now, we just log and return success

      return {
        success: true,
        messageId: payload.MessageSid,
        event,
      };
    } catch (error: any) {
      logger.error({ error: error.message }, 'Error processing Twilio webhook');
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Verificar firma de Twilio
   * Nota: Implementación simplificada. En producción, usar la librería twilio
   * para verificar la firma correctamente con el webhook URL y body.
   */
  private verifyTwilioSignature(payload: any, signature: string): boolean {
    // En producción, implementar verificación proper con:
    // const twilio = require('twilio');
    // const isValid = twilio.validateRequest(token, signature, url, body);
    return !!signature && signature.length > 0;
  }

  /**
   * Formatear número para Twilio (agregar prefijo whatsapp:)
   */
  private formatPhoneNumberForTwilio(phone: string): string {
    const formatted = this.formatPhoneNumber(phone);
    return `whatsapp:${formatted}`;
  }

  /**
   * Mapear status de Twilio a nuestro formato
   */
  private mapTwilioStatus(twilioStatus: string): WhatsAppMessageStatus {
    const statusMap: Record<string, WhatsAppMessageStatus> = {
      'queued': 'pending',
      'sending': 'pending',
      'sent': 'sent',
      'delivered': 'delivered',
      'read': 'read',
      'undelivered': 'failed',
      'failed': 'failed',
    };

    return statusMap[twilioStatus.toLowerCase()] || 'pending';
  }

  /**
   * Mapear status de Twilio a evento de webhook
   */
  private mapTwilioStatusToEvent(twilioStatus: string): string {
    const eventMap: Record<string, string> = {
      'queued': 'message_sent',
      'sending': 'message_sent',
      'sent': 'message_sent',
      'delivered': 'message_delivered',
      'read': 'message_read',
      'undelivered': 'message_failed',
      'failed': 'message_failed',
    };

    return eventMap[twilioStatus.toLowerCase()] || 'message_sent';
  }

  /**
   * Mapear nombre de plantilla a ContentSid de Twilio
   * En producción, usar los ContentSid reales de Twilio
   */
  private mapTemplateNameToContentSid(templateName: string): string {
    // These should be replaced with actual ContentSids from your Twilio account
    const contentSidMap: Record<string, string> = {
      'appointment_reminder_24h': 'HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      'appointment_reminder_1h': 'HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      'teleconsulta_link': 'HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    };

    return contentSidMap[templateName] || templateName;
  }
}

export default TwilioWhatsAppProvider;
