import { randomBytes, createHash } from 'crypto';
import prisma from '../../config/database.js';
import { hashPassword } from '../auth.service.js';
import { logger } from '../../utils/logger.js';

// ============= CONFIGURATION =============

const RESET_TOKEN_EXPIRY_HOURS = 1; // Token válido por 1 hora
const RESET_TOKEN_BYTES = 32; // 256 bits de entropía

// ============= TYPES =============

export interface PasswordResetRequestResult {
  success: boolean;
  message: string;
  // No devolvemos el token directamente - se enviará por email
}

export interface ValidateResetTokenResult {
  valid: boolean;
  email?: string;
  message: string;
}

export interface ResetPasswordResult {
  success: boolean;
  message: string;
}

// ============= TOKEN GENERATION =============

/**
 * Genera un token seguro de reset de password
 * @returns Token hexadecimal de 64 caracteres
 */
function generateSecureToken(): string {
  const buffer = randomBytes(RESET_TOKEN_BYTES);
  return buffer.toString('hex');
}

/**
 * Calcula la fecha de expiración del token
 * @returns Date con la fecha de expiración
 */
function calculateExpiryDate(): Date {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + RESET_TOKEN_EXPIRY_HOURS);
  return expiry;
}

// ============= PUBLIC FUNCTIONS =============

/**
 * Solicita un reset de password para un email
 * Crea un token nuevo e invalida cualquier token previo para el mismo email
 *
 * @param email - Email del usuario que solicita el reset
 * @returns Resultado de la solicitud
 */
export async function requestPasswordReset(
  email: string
): Promise<PasswordResetRequestResult> {
  try {
    // Normalizar email
    const normalizedEmail = email.toLowerCase().trim();

    // Verificar si existe una cuenta con ese email
    const cuenta = await prisma.cuenta.findUnique({
      where: { email: normalizedEmail }, 
      select: { id: true,  email: true,  nombre: true }
    });

    // Por seguridad, siempre retornamos éxito incluso si el email no existe
    // Esto previene la enumeración de emails
    if (!cuenta) {
      logger.info({ email: normalizedEmail },  'Password reset requested for non-existent email');
      return {
        success: true,
        message: 'Si el email está registrado, recibirás un enlace de recuperación'
      };
    }

    // Invalidar tokens previos para este email
    await prisma.passwordResetToken.updateMany({
      where: { email: normalizedEmail }, 
      data: { usedAt: new Date() }
    });

    // Generar nuevo token
    const token = generateSecureToken();
    const expiresAt = calculateExpiryDate();

    // Guardar token en base de datos
    await prisma.passwordResetToken.create({
      data: {
        email: normalizedEmail, 
        token, 
        expiresAt
      }
    });

    logger.info(
      { email: normalizedEmail,  tokenId: token.substring(0,  16) + '...' },
      'Password reset token created'
    );

    // Aquí se enviaría el email con el link de reset
    // Por ahora, logueamos el token para desarrollo
    logger.debug(
      { email: normalizedEmail,  token }, 
      'Password reset token (dev mode - enviar por email en producción)'
    );

    return {
      success: true,
      message: 'Si el email está registrado, recibirás un enlace de recuperación'
    };
  } catch (error) {
    logger.error({ error,  email },  'Error requesting password reset');
    return {
      success: false,
      message: 'Error al solicitar el reset de password'
    };
  }
}

/**
 * Valida un token de reset de password
 *
 * @param token - Token de reset a validar
 * @returns Resultado de la validación con el email asociado si es válido
 */
export async function validateResetToken(
  token: string
): Promise<ValidateResetTokenResult> {
  try {
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token }
    });

    if (!resetToken) {
      return {
        valid: false,
        message: 'Token inválido'
      };
    }

    // Verificar si ya fue usado
    if (resetToken.usedAt) {
      return {
        valid: false,
        message: 'Este token ya fue utilizado'
      };
    }

    // Verificar expiración
    if (resetToken.expiresAt < new Date()) {
      return {
        valid: false,
        message: 'El token ha expirado'
      };
    }

    return {
      valid: true,
      email: resetToken.email,
      message: 'Token válido'
    };
  } catch (error) {
    logger.error({ error,  token: token.substring(0,  16) + '...' }, 'Error validating reset token');
    return {
      valid: false,
      message: 'Error al validar el token'
    };
  }
}

/**
 * Resetea la password usando un token válido
 *
 * @param token - Token de reset
 * @param newPassword - Nueva password
 * @returns Resultado del reset
 */
export async function resetPassword(
  token: string, 
  newPassword: string
): Promise<ResetPasswordResult> {
  try {
    // Validar token primero
    const validation = await validateResetToken(token);

    if (!validation.valid) {
      return {
        success: false,
        message: validation.message
      };
    }

    const email = validation.email!;

    // Hash nueva password
    const passwordHash = await hashPassword(newPassword);

    // Actualizar password del usuario
    // Nota: Podría ser Cuenta o UsuarioVinculado
    const cuenta = await prisma.cuenta.update({
      where: { email }, 
      data: { passwordHash }, 
      select: { id: true,  email: true,  nombre: true }
    });

    // Marcar token como usado
    await prisma.passwordResetToken.update({
      where: { token }, 
      data: { usedAt: new Date() }
    });

    // Invalidar todos los refresh tokens del usuario
    // Esto fuerza a re-login en todos los dispositivos
    await prisma.refreshToken.updateMany({
      where: {
        userId: cuenta.id, 
        userType: 'CUENTA', 
        revokedAt: null
      }, 
      data: { revokedAt: new Date() }
    });

    logger.info(
      { email,  userId: cuenta.id }, 
      'Password reset successfully'
    );

    return {
      success: true,
      message: 'Password actualizada correctamente'
    };
  } catch (error) {
    logger.error({ error,  token: token.substring(0,  16) + '...' }, 'Error resetting password');

    if (error instanceof Error && error.message.includes('Record to update not found')) {
      return {
        success: false,
        message: 'Usuario no encontrado'
      };
    }

    return {
      success: false,
      message: 'Error al resetear la password'
    };
  }
}

/**
 * Limpia tokens expirados o usados (para ejecutar periódicamente)
 */
export async function cleanupExpiredResetTokens(): Promise<number> {
  try {
    const result = await prisma.passwordResetToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { usedAt: { not: null } }
        ]
      }
    });

    logger.info({ count: result.count },  'Cleaned up expired/used reset tokens');
    return result.count;
  } catch (error) {
    logger.error({ error },  'Error cleaning up reset tokens');
    return 0;
  }
}

export default {
  requestPasswordReset,
  validateResetToken,
  resetPassword,
  cleanupExpiredResetTokens
};
