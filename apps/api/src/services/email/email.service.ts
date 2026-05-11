/**
 * Servicio de Email con Resend
 * 
 * Características:
 * - Envío de emails transaccionales
 * - Plantillas HTML reutilizables
 * - Manejo asíncrono no bloqueante
 * - Logging estructurado de errores
 */
import { Resend } from 'resend';
import { logger } from '../../utils/logger';
import { getEmailConfig, isEmailConfigured } from '../../config/email.config';
import { renderTemplate } from './utils/template-renderer';
import type {
  EmailOptions,
  SendEmailResult,
  ConsentData,
  CitaRecordatorioData,
  PasswordResetData,
  WelcomeData,
} from './email.types';

export class EmailService {
  private resend: Resend | null = null;
  private config: { apiKey: string; from: string } | null = null;
  private initialized = false;

  /**
   * Inicializa el servicio de email
   */
  initialize(): void {
    if (this.initialized) {
      return;
    }

    if (!isEmailConfigured()) {
      logger.warn(
        'Servicio de email no configurado. RESEND_API_KEY no está definida.'
      );
      return;
    }

    try {
      this.config = getEmailConfig();
      this.resend = new Resend(this.config.apiKey);
      this.initialized = true;
      logger.info('Servicio de email inicializado correctamente');
    } catch (error) {
      logger.error('Error al inicializar servicio de email:', error);
    }
  }

  /**
   * Envía un email genérico
   */
  async sendEmail(options: EmailOptions): Promise<SendEmailResult | null> {
    if (!this.initialized || !this.resend) {
      logger.warn('Servicio de email no inicializado. Skiping email send.');
      return null;
    }

    try {
      const { data, error } = await this.resend.emails.send({
        from: options.from || this.config!.from,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo,
        tags: options.tags,
      });

      if (error) {
        logger.error({
          error: error.message || 'Unknown error',
          statusCode: error.statusCode,
          name: error.name
        }, 'Error al enviar email');
        throw error;
      }

      logger.info({
        id: data?.id,
        to: options.to,
        subject: options.subject,
      }, 'Email enviado exitosamente');

      return {
        id: data!.id,
        from: options.from || this.config!.from,
        to: Array.isArray(options.to) ? options.to : [options.to],
        createdAt: new Date(),
        subject: options.subject,
      };
    } catch (error) {
      logger.error('Error al enviar email:', error);
      throw error;
    }
  }

  /**
   * Envía email de recuperación de contraseña
   */
  async sendPasswordReset(email: string, token: string): Promise<SendEmailResult | null> {
    const resetLink = `${process.env.FRONTEND_URL || 'https://galeno.ec'}/auth/reset-password?token=${token}`;
    
    const html = renderTemplate('reset-password', {
      nombre: email.split('@')[0],
      resetLink,
      expiresHours: '24',
    });

    return this.sendEmail({
      to: email,
      subject: 'Recuperación de Contraseña - Galeno',
      html,
      tags: [{ name: 'type', value: 'password-reset' }],
    });
  }

  /**
   * Envía recordatorio de cita médica
   */
  async sendCitaRecordatorio(citaData: CitaRecordatorioData): Promise<SendEmailResult | null> {
    const html = renderTemplate('cita-recordatorio', {
      pacienteNombre: citaData.pacienteNombre,
      doctorNombre: citaData.doctorNombre,
      fechaHora: citaData.fechaHora,
      tipo: citaData.tipo,
      linkVideo: citaData.linkVideo || '',
      ubicacion: citaData.ubicacion || '',
    });

    return this.sendEmail({
      to: citaData.pacienteNombre, // TODO: Reemplazar con email real del paciente
      subject: 'Recordatorio de Cita Médica - Galeno',
      html,
      tags: [{ name: 'type', value: 'appointment-reminder' }],
    });
  }

  /**
   * Envía notificación de consentimiento LOPDP
   */
  async sendConsentNotification(
    email: string,
    data: ConsentData
  ): Promise<SendEmailResult | null> {
    const html = renderTemplate('consentimiento-notificacion', {
      pacienteNombre: data.pacienteNombre,
      doctorNombre: data.doctorNombre,
      tipoAcceso: data.tipoAcceso,
      fechaAutorizacion: data.fechaAutorizacion,
    });

    return this.sendEmail({
      to: email,
      subject: 'Confirmación de Autorización de Acceso - Galeno',
      html,
      tags: [{ name: 'type', value: 'consent-notification' }],
    });
  }

  /**
   * Envía email de bienvenida
   */
  async sendBienvenida(email: string, nombre: string): Promise<SendEmailResult | null> {
    const html = renderTemplate('bienvenida', {
      nombre,
      email,
    });

    return this.sendEmail({
      to: email,
      subject: '¡Bienvenido a Galeno! 🎉',
      html,
      tags: [{ name: 'type', value: 'welcome' }],
    });
  }

  /**
   * Verifica si el servicio está configurado
   */
  isConfigured(): boolean {
    return this.initialized && this.resend !== null;
  }
}

// Singleton instance
export const emailService = new EmailService();

// Auto-initialize on import
emailService.initialize();
