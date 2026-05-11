/**
 * Configuración para el servicio de videoconferencia Jitsi Meet
 */

import { JitsiServiceConfig } from '../services/teleconference/jitsi.types.js';

/**
 * Configuración de Jitsi Meet
 *
 * Variables de entorno requeridas:
 * - JITSI_APP_ID: App ID para generar JWT tokens (opcional para meet.jit.si público)
 * - JITSI_APP_SECRET: App Secret para generar JWT tokens (opcional para meet.jit.si público)
 * - JITSI_DOMAIN: Dominio del servidor Jitsi (default: meet.jit.si)
 * - JITSI_SALT: Salt para generar nombres de sala seguros
 */
export const jitsiConfig: JitsiServiceConfig = {
  appId: process.env.JITSI_APP_ID || '',
  appSecret: process.env.JITSI_APP_SECRET || '',
  domain: process.env.JITSI_DOMAIN || 'meet.jit.si',
  salt: process.env.JITSI_SALT || 'galeno-default-salt-change-in-production',
  isProduction: process.env.NODE_ENV === 'production'
};

/**
 * Validar que la configuración de Jitsi sea correcta
 *
 * @throws {Error} Si la configuración es inválida
 */
export function validateJitsiConfig(): void {
  if (!jitsiConfig.salt || jitsiConfig.salt === 'galeno-default-salt-change-in-production') {
    if (jitsiConfig.isProduction) {
      throw new Error('JITSI_SALT debe estar configurado en producción');
    } else {
      console.warn('⚠️  Usando JITSI_SALT por defecto. Configura JITSI_SALT en producción.');
    }
  }

  // Para JWT (requerido en producción con dominio propio)
  if (jitsiConfig.isProduction && jitsiConfig.domain !== 'meet.jit.si') {
    if (!jitsiConfig.appId || !jitsiConfig.appSecret) {
      throw new Error('JITSI_APP_ID y JITSI_APP_SECRET son requeridos para dominio propio en producción');
    }
  }

  // Validar formato de dominio
  if (jitsiConfig.domain && !jitsiConfig.domain.includes('.')) {
    throw new Error(`JITSI_DOMAIN inválido: ${jitsiConfig.domain}`);
  }
}

/**
 * Verificar si JWT está habilitado
 */
export function isJWTEabled(): boolean {
  return !!(jitsiConfig.appId && jitsiConfig.appSecret);
}

/**
 * Obtener URL base de Jitsi (con protocolo)
 */
export function getJitsiBaseUrl(): string {
  const domain = jitsiConfig.domain;
  // Agregar https:// si no tiene protocolo
  return domain.startsWith('http://') || domain.startsWith('https://')
    ? domain
    : `https://${domain}`;
}

/**
 * Obtener URL de external API de Jitsi
 */
export function getJitsiExternalApiUrl(): string {
  return `${getJitsiBaseUrl()}/external_api.js`;
}
