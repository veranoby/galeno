import crypto from 'node:crypto';
import { logger } from './logger.js';

/**
 * Cifrado AES-256-GCM para datos sensibles en reposo
 *
 * Compliance: LOPDP (Ley Orgánica de Protección de Datos Personales - Ecuador)
 *
 * Especificaciones:
 * - Algoritmo: AES-256-GCM (Galois/Counter Mode)
 * - Key size: 256 bits (32 bytes)
 * - IV size: 96 bits (12 bytes) - recomendado para GCM
 * - Auth tag: 128 bits (16 bytes) - incluido en output
 *
 * Formato de salida:
 *   IV (12 bytes) + Auth Tag (16 bytes) + Ciphertext
 *   Codificado en base64 para almacenamiento
 */

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const ALGORITHM = 'aes-256-gcm';
const KEY_SIZE = 32; // 256 bits
const IV_SIZE = 12; // 96 bits - recomendado para GCM
const AUTH_TAG_SIZE = 16; // 128 bits

/**
 * Obtener la clave de encripción desde variables de entorno
 *
 * IMPORTANTE: En producción, usar un servicio de secrets (AWS KMS, Vault, etc.)
 * Nunca harcodear keys en el código.
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }

  // Key debe ser exactamente 32 bytes para AES-256
  // Si es más corto, hacer hash con SHA-256
  if (key.length !== KEY_SIZE) {
    return crypto.createHash('sha256').update(key).digest();
  }

  return Buffer.from(key, 'utf-8');
}

/**
 * Alternativa: Obtener clave desde KMS (para producción futura)
 *
 * Esto permite rotación de keys y auditoría de acceso
 */
async function getEncryptionKeyFromKMS(): Promise<Buffer> {
  // TODO: Implementar con AWS KMS o similar
  // const kms = new AWS.KMS();
  // const result = await kms.decrypt({ CiphertextBlob: encryptedKey }).promise();
  // return result.Plaintext as Buffer;

  throw new Error('KMS encryption not implemented yet');
}

// ============================================================================
// CIFRADO / DESCIFRADO
// ============================================================================

/**
 * Cifra datos usando AES-256-GCM
 *
 * @param data - Datos a cifrar (string | object)
 * @returns Datos cifrados en formato base64
 *
 * @example
 * const encrypted = encrypt('Datos sensibles');
 * const encryptedObj = encrypt({ ssn: '123-45-6789', name: 'Juan' });
 */
export function encrypt(data: string | object): string {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_SIZE);

    // Convertir data a string si es object
    const plaintext = typeof data === 'string' ? data : JSON.stringify(data);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let ciphertext = cipher.update(plaintext, 'utf8');
    ciphertext = Buffer.concat([ciphertext, cipher.final()]);

    // Obtener auth tag (GCM lo genera automáticamente)
    const authTag = cipher.getAuthTag();

    // Formato: IV + AuthTag + Ciphertext
    const result = Buffer.concat([iv, authTag, ciphertext]);

    return result.toString('base64');
  } catch (error) {
    logger.error({ error }, 'Encryption failed');
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Descifra datos cifrados con AES-256-GCM
 *
 * @param encryptedData - Datos cifrados en formato base64
 * @returns Datos originales (string | object)
 *
 * @example
 * const decrypted = decrypt(encrypted);
 * // Si era object: JSON.parse(decrypted)
 */
export function decrypt(encryptedData: string): string {
  try {
    const key = getEncryptionKey();

    // Decodificar desde base64
    const buffer = Buffer.from(encryptedData, 'base64');

    // Extraer componentes
    const iv = buffer.subarray(0, IV_SIZE);
    const authTag = buffer.subarray(IV_SIZE, IV_SIZE + AUTH_TAG_SIZE);
    const ciphertext = buffer.subarray(IV_SIZE + AUTH_TAG_SIZE);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

    // Set auth tag antes de descifrar
    decipher.setAuthTag(authTag);

    let plaintext = decipher.update(ciphertext);
    plaintext = Buffer.concat([plaintext, decipher.final()]);

    return plaintext.toString('utf8');
  } catch (error) {
    logger.error({ error }, 'Decryption failed');
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Descifra y parsea JSON
 *
 * @param encryptedData - Datos cifrados (object JSON)
 * @returns Object parseado
 */
export function decryptObject<T = unknown>(encryptedData: string): T {
  const decrypted = decrypt(encryptedData);
  return JSON.parse(decrypted) as T;
}

// ============================================================================
// UTILIDADES
// ============================================================================

/**
 * Genera una clave aleatoria para AES-256
 *
 * Usar para generar una nueva ENCRYPTION_KEY
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_SIZE).toString('base64');
}

/**
 * Hash de datos para verificación (no reversible)
 *
 * Usar para passwords, tokens de verificación, etc.
 * NOTA: Para passwords de usuarios, usar bcrypt con salt (ver auth service)
 */
export function hash(data: string, algorithm: 'sha256' | 'sha512' = 'sha256'): string {
  return crypto.createHash(algorithm).update(data).digest('hex');
}

/**
 * Verifica si un dato ha sido modificado usando HMAC
 *
 * @param data - Datos originales
 * @param signature - Firma a verificar
 * @param key - Clave para HMAC (opcional, usa ENCRYPTION_KEY por defecto)
 */
export function verifyHMAC(data: string, signature: string, key?: string): boolean {
  const hmacKey = key || getEncryptionKey().toString('base64');
  const hmac = crypto.createHmac('sha256', hmacKey);
  hmac.update(data);
  const computed = hmac.digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computed));
}

/**
 * Genera firma HMAC para datos
 */
export function signHMAC(data: string, key?: string): string {
  const hmacKey = key || getEncryptionKey().toString('base64');
  const hmac = crypto.createHmac('sha256', hmacKey);
  hmac.update(data);
  return hmac.digest('hex');
}

// ============================================================================
// DATOS SENSIBLES - Campos que requieren cifrado
// ============================================================================

/**
 * Campos cifrados según LOPDP
 *
 * Estos datos deben cifrarse en reposo (base de datos)
 * El descifrado ocurre a nivel de aplicación cuando se necesita acceder
 */
export const SENSIBLE_FIELDS = {
  // Datos personales
  telefono: 'phone',
  email: 'email',

  // Datos médicos (muy sensibles)
  motivoConsulta: 'medical_reason',
  evolucion: 'medical_evolution',
  diagnosticoCie10: 'medical_diagnosis',
  recetaJson: 'prescription',
  examenesJson: 'medical_exams',

  // Documentos
  documentoContenido: 'document_content',

  // Antecedentes
  antecedenteDetalle: 'medical_history',

  // Conexiones entre doctores (Health Wallet)
  conexionPermisos: 'connection_permissions'
} as const;

/**
 * Mascara de datos sensibles para logs/UI
 *
 * Muestra solo los primeros/últimos caracteres
 */
export function maskSensitiveData(data: string, visibleChars: number = 4): string {
  if (data.length <= visibleChars * 2) {
    return '*'.repeat(data.length);
  }

  const start = data.substring(0, visibleChars);
  const end = data.substring(data.length - visibleChars);
  const masked = '*'.repeat(Math.min(data.length - visibleChars * 2, 8));

  return `${start}${masked}${end}`;
}

/**
 * Mascara de email
 */
export function maskEmail(email: string): string {
  const [username, domain] = email.split('@');
  if (!domain) return maskSensitiveData(email);

  const visible = Math.min(3, username.length);
  const maskedUsername = username.substring(0, visible) + '*'.repeat(username.length - visible);

  return `${maskedUsername}@${domain}`;
}

/**
 * Mascara de teléfono (formato ecuatoriano)
 */
export function maskPhone(phone: string): string {
  // Remover todo excepto dígitos
  const digits = phone.replace(/\D/g, '');

  if (digits.length < 4) return '***';

  // Mostrar primeros 2 y últimos 2 dígitos
  return `${digits.substring(0, 2)}****${digits.substring(digits.length - 2)}`;
}

// ============================================================================
// FIELD LEVEL ENCRYPTION (para Prisma/Database)
// ============================================================================

/**
 * Decorador para campos cifrados en Prisma
 *
 * @usage
 * ```typescript
 * import { encryptedField } from './crypto';
 *
 * const paciente = await prisma.paciente.create({
 *   data: {
 *     nombre: 'Juan Pérez',
 *     telefono: encryptedField('+593 99 123 4567'),
 *     email: encryptedField('juan@example.com')
 *   }
 * });
 * ```
 */
export function encryptedField(data: string | object): string {
  return encrypt(data);
}

/**
 * Descifra campo de base de datos
 */
export function decryptField(encryptedData: string): string {
  return decrypt(encryptedData);
}

// ============================================================================
// PERFORMANCE BENCHMARK
// ============================================================================

/**
 * Mide el performance de cifrado/descifrado
 */
export async function benchmarkEncryption(iterations: number = 1000): Promise<{
  encryptAvgMs: number;
  decryptAvgMs: number;
  totalMs: number;
}> {
  const testData = 'Datos médicos sensibles del paciente para prueba de performance';

  const encryptStart = Date.now();

  const encryptedResults: string[] = [];
  for (let i = 0; i < iterations; i++) {
    encryptedResults.push(encrypt(testData));
  }

  const encryptEnd = Date.now();

  const decryptStart = Date.now();

  for (const encrypted of encryptedResults) {
    decrypt(encrypted);
  }

  const decryptEnd = Date.now();

  return {
    encryptAvgMs: (encryptEnd - encryptStart) / iterations,
    decryptAvgMs: (decryptEnd - decryptStart) / iterations,
    totalMs: decryptEnd - encryptStart
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  encrypt,
  decrypt,
  decryptObject,
  generateEncryptionKey,
  hash,
  verifyHMAC,
  signHMAC,
  maskSensitiveData,
  maskEmail,
  maskPhone,
  encryptedField,
  decryptField,
  benchmarkEncryption,
  SENSIBLE_FIELDS
};
