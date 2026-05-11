/**
 * Configuración del servicio de Email
 */

export interface EmailConfig {
  apiKey: string;
  from: string;
}

/**
 * Obtiene la configuración de email desde variables de entorno
 */
export function getEmailConfig(): EmailConfig {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || 'noreply@galeno.ec';

  if (!apiKey) {
    throw new Error(
      'RESEND_API_KEY no está configurada. ' +
      'Agrega RESEND_API_KEY=re_xxxxxxxxxxxxx a tu archivo .env'
    );
  }

  // Validar formato de API key de Resend
  if (!apiKey.startsWith('re_')) {
    throw new Error(
      'RESEND_API_KEY inválida. Las API keys de Resend comienzan con "re_"'
    );
  }

  return {
    apiKey,
    from,
  };
}

/**
 * Verifica si el servicio de email está configurado
 */
export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}
