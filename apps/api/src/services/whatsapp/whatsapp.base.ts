/**
 * WhatsApp Provider Base Classes and Interfaces
 *
 * Proporciona una abstracción común para todos los proveedores de WhatsApp
 * soportados (Twilio, Meta WhatsApp Business API).
 *
 * @module services/whatsapp
 */

/**
 * Status de envío de mensaje WhatsApp
 */
export type WhatsAppMessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

/**
 * Tipos de plantilla de mensaje WhatsApp
 */
export type WhatsAppTemplateType = 
  | 'appointment_reminder_24h'
  | 'appointment_reminder_1h'
  | 'teleconsulta_link'
  | 'appointment_confirmation'
  | 'appointment_cancellation';

/**
 * Tipos de gateway soportados
 */
export type WhatsAppGatewayType = 'twilio' | 'meta';

/**
 * Datos para enviar un mensaje de texto simple
 */
export interface WhatsAppMessageRequest {
  /** Número de teléfono del destinatario (formato E.164: +593...) */
  to: string;
  /** Cuerpo del mensaje */
  body: string;
  /** Tipo de plantilla (opcional) */
  templateType?: WhatsAppTemplateType;
  /** Variables para la plantilla */
  templateVariables?: Record<string, string>;
  /** Metadata adicional */
  metadata?: Record<string, any>;
}

/**
 * Datos para enviar un mensaje con plantilla
 */
export interface WhatsAppTemplateRequest {
  /** Número de teléfono del destinatario */
  to: string;
  /** Nombre de la plantilla aprobada por WhatsApp */
  templateName: string;
  /** Idioma de la plantilla */
  language: string;
  /** Variables para la plantilla */
  variables?: string[];
  /** Metadata adicional */
  metadata?: Record<string, any>;
}

/**
 * Response de envío de mensaje WhatsApp
 */
export interface WhatsAppMessageResponse {
  /** ID único del mensaje */
  messageId: string;
  /** Status del mensaje */
  status: WhatsAppMessageStatus;
  /** Número de destino */
  to: string;
  /** Timestamp de envío */
  timestamp?: Date;
  /** Mensaje de error si aplica */
  error?: string;
  /** Error code si aplica */
  errorCode?: string;
}

/**
 * Request para verificar status de mensaje
 */
export interface WhatsAppMessageStatusRequest {
  /** ID del mensaje a verificar */
  messageId: string;
}

/**
 * Response de verificación de status
 */
export interface WhatsAppMessageStatusResponse {
  /** ID del mensaje */
  messageId: string;
  /** Status actual del mensaje */
  status: WhatsAppMessageStatus;
  /** Timestamp de entrega */
  deliveredAt?: Date;
  /** Timestamp de lectura */
  readAt?: Date;
  /** Error details si falla */
  error?: string;
}

/**
 * Payload para webhooks de WhatsApp
 */
export interface WhatsAppWebhookPayload {
  /** Tipo de evento */
  event: 'message_sent' | 'message_delivered' | 'message_read' | 'message_failed';
  /** ID del mensaje */
  messageId: string;
  /** Número de destino */
  to: string;
  /** Número de origen */
  from?: string;
  /** Timestamp del evento */
  timestamp: number;
  /** Status del mensaje */
  status: WhatsAppMessageStatus;
  /** Error details si aplica */
  error?: string;
  /** Datos específicos del proveedor */
  providerData?: any;
}

/**
 * Resultado de procesamiento de webhook
 */
export interface WhatsAppWebhookResult {
  /** Si el webhook fue procesado exitosamente */
  success: boolean;
  /** ID del mensaje procesado */
  messageId?: string;
  /** Evento procesado */
  event?: string;
  /** Mensaje de error si aplica */
  error?: string;
}

/**
 * Configuración de proveedor WhatsApp
 */
export interface WhatsAppProviderConfig {
  /** Account SID (Twilio) o App ID (Meta) */
  accountSid?: string;
  /** Auth Token (Twilio) o App Secret (Meta) */
  authToken?: string;
  /** Número de teléfono de WhatsApp Business */
  phoneNumberId?: string;
  /** ID de teléfono desde donde se envía */
  fromPhoneNumber?: string;
  /** URL base de la API */
  baseUrl?: string;
  /** URL de webhook (callback) */
  webhookUrl?: string;
  /** Timeout en ms */
  timeout?: number;
}

/**
 * Datos para plantilla de recordatorio de cita
 */
export interface AppointmentReminderTemplate {
  pacienteNombre: string;
  doctorNombre: string;
  fechaHora: string;
  tipo: 'presencial' | 'teleconsulta';
  ubicacion?: string;
  linkVideo?: string;
}

/**
 * Clase abstracta para todos los proveedores de WhatsApp
 *
 * Define el contrato que deben implementar todos los proveedores
 */
export abstract class WhatsAppProvider {
  protected config: WhatsAppProviderConfig;
  protected initialized: boolean = false;

  constructor(config: WhatsAppProviderConfig) {
    this.config = config;
  }

  /**
   * Inicializar el proveedor
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.validateConfig();
    this.initialized = true;
  }

  /**
   * Validar configuración del proveedor
   */
  protected async validateConfig(): Promise<void> {
    // Subclasses pueden agregar validaciones específicas
    await this.onValidateConfig();
  }

  /**
   * Hook para validaciones específicas de cada proveedor
   */
  protected abstract onValidateConfig(): Promise<void>;

  /**
   * Enviar mensaje de texto simple
   *
   * @param request - Datos del mensaje
   * @returns Response con messageId y status
   */
  abstract sendMessage(request: WhatsAppMessageRequest): Promise<WhatsAppMessageResponse>;

  /**
   * Enviar mensaje con plantilla
   *
   * @param request - Datos de la plantilla
   * @returns Response con messageId y status
   */
  abstract sendTemplate(request: WhatsAppTemplateRequest): Promise<WhatsAppMessageResponse>;

  /**
   * Enviar recordatorio de cita (24 horas antes)
   *
   * @param to - Número de teléfono del paciente
   * @param data - Datos de la cita
   * @returns Response con messageId y status
   */
  async sendAppointmentReminder24h(
    to: string,
    data: AppointmentReminderTemplate
  ): Promise<WhatsAppMessageResponse> {
    return this.sendTemplate({
      to,
      templateName: 'appointment_reminder_24h',
      language: 'es',
      variables: [
        data.pacienteNombre,
        data.doctorNombre,
        data.fechaHora,
        data.tipo === 'teleconsulta' ? 'Virtual' : 'Presencial',
        data.tipo === 'teleconsulta' && data.linkVideo ? data.linkVideo : data.ubicacion || ''
      ],
      metadata: { templateType: 'appointment_reminder_24h', ...data }
    });
  }

  /**
   * Enviar recordatorio de cita (1 hora antes)
   *
   * @param to - Número de teléfono del paciente
   * @param data - Datos de la cita
   * @returns Response con messageId y status
   */
  async sendAppointmentReminder1h(
    to: string,
    data: AppointmentReminderTemplate
  ): Promise<WhatsAppMessageResponse> {
    return this.sendTemplate({
      to,
      templateName: 'appointment_reminder_1h',
      language: 'es',
      variables: [
        data.pacienteNombre,
        data.doctorNombre,
        data.fechaHora,
        data.tipo === 'teleconsulta' && data.linkVideo ? data.linkVideo : data.ubicacion || ''
      ],
      metadata: { templateType: 'appointment_reminder_1h', ...data }
    });
  }

  /**
   * Enviar link de teleconsulta
   *
   * @param to - Número de teléfono del paciente
   * @param data - Datos de la teleconsulta
   * @returns Response con messageId y status
   */
  async sendTeleconsultaLink(
    to: string,
    data: { pacienteNombre: string; doctorNombre: string; linkVideo: string; fechaHora: string }
  ): Promise<WhatsAppMessageResponse> {
    return this.sendTemplate({
      to,
      templateName: 'teleconsulta_link',
      language: 'es',
      variables: [
        data.pacienteNombre,
        data.doctorNombre,
        data.fechaHora,
        data.linkVideo
      ],
      metadata: { templateType: 'teleconsulta_link', ...data }
    });
  }

  /**
   * Verificar el status de un mensaje
   *
   * @param messageId - ID del mensaje a verificar
   * @returns Status actual del mensaje
   */
  abstract getMessageStatus(messageId: string): Promise<WhatsAppMessageStatusResponse>;

  /**
   * Procesar un webhook del proveedor
   *
   * @param payload - Payload del webhook
   * @param signature - Firma de seguridad
   * @returns Resultado del procesamiento
   */
  abstract handleWebhook(payload: any, signature?: string): Promise<WhatsAppWebhookResult>;

  /**
   * Formatear número de teléfono a formato E.164
   *
   * @param phone - Número de teléfono en formato local
   * @param countryCode - Código de país (default: '593' para Ecuador)
   * @returns Número formateado en E.164
   */
  protected formatPhoneNumber(phone: string, countryCode: string = '593'): string {
    // Remove all non-numeric characters
    const cleaned = phone.replace(/\D/g, '');

    // Check if already has country code
    if (cleaned.startsWith(countryCode)) {
      return `+${cleaned}`;
    }

    // Add country code
    return `+${countryCode}${cleaned}`;
  }

  /**
   * Generar ID único para mensaje
   */
  protected generateMessageId(): string {
    return `wa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Error personalizado para WhatsApp
 */
export class WhatsAppError extends Error {
  constructor(
    message: string,
    public code: string,
    public messageId?: string
  ) {
    super(message);
    this.name = 'WhatsAppError';
  }
}

/**
 * Error de validación de webhook
 */
export class WhatsAppWebhookSignatureError extends Error {
  public code: string;

  constructor(message: string) {
    super(message);
    this.name = 'WhatsAppWebhookSignatureError';
    this.code = 'INVALID_SIGNATURE';
  }
}

/**
 * Error de plantilla no aprobada
 */
export class WhatsAppTemplateNotApprovedError extends WhatsAppError {
  constructor(templateName: string) {
    super(
      `Template '${templateName}' is not approved by WhatsApp`,
      'TEMPLATE_NOT_APPROVED'
    );
    this.name = 'WhatsAppTemplateNotApprovedError';
  }
}
