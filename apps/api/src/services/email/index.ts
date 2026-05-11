/**
 * Módulo de Email
 * Exporta servicios y tipos para envío de emails con Resend
 */

export { emailService, EmailService } from './email.service';
export { renderTemplate, clearTemplateCache, preloadTemplates } from './utils/template-renderer';
export type {
  EmailConfig,
  EmailTemplate,
  EmailRecipient,
  EmailOptions,
  SendEmailResult,
  ConsentData,
  CitaRecordatorioData,
  PasswordResetData,
  WelcomeData,
} from './email.types';
