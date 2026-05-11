/**
 * Tipos para el servicio de Email
 */

export interface EmailConfig {
  apiKey: string;
  from: string;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

export interface EmailRecipient {
  to: string;
  name?: string;
}

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  tags?: {
    name: string;
    value: string;
  }[];
}

export interface SendEmailResult {
  id: string;
  from: string;
  to: string[];
  createdAt: Date;
  subject: string;
}

export interface ConsentData {
  pacienteNombre: string;
  doctorNombre: string;
  tipoAcceso: string;
  fechaAutorizacion: string;
}

export interface CitaRecordatorioData {
  pacienteNombre: string;
  doctorNombre: string;
  fechaHora: string;
  tipo: string;
  linkVideo?: string;
  ubicacion?: string;
}

export interface PasswordResetData {
  nombre: string;
  resetLink: string;
  expiresHours: number;
}

export interface WelcomeData {
  nombre: string;
  email: string;
}
