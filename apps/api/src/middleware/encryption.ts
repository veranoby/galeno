import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { encrypt, decrypt, SENSIBLE_FIELDS, maskSensitiveData, maskEmail, maskPhone } from '../utils/crypto.js';

/**
 * Middleware para cifrado automático de campos sensibles
 *
 * Este middleware intercepta las respuestas de la API y cifra/descifra
 * campos sensibles automáticamente antes de enviar al cliente.
 *
 * Compliance: LOPDP (Ley Orgánica de Protección de Datos Personales - Ecuador)
 */

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

/**
 * Campos que deben cifrarse al guardar en BD
 */
const ENCRYPT_ON_WRITE = [
  'telefono',
  'email',
  'motivoConsulta',
  'evolucion',
  'diagnosticoCie10',
  'recetaJson',
  'examenesJson',
  'detalle'
] as const;

/**
 * Campos que deben descifrarse al leer de BD
 */
const DECRYPT_ON_READ = [
  'telefono',
  'email',
  'motivoConsulta',
  'evolucion',
  'diagnosticoCie10',
  'recetaJson',
  'examenesJson',
  'detalle',
  'permisos',
  'contenido'
] as const;

/**
 * Campos que deben enmascararse para logs/analytics
 */
const MASK_FOR_LOGS = [
  'password',
  'passwordHash',
  'token',
  'cedula',
  'telefono',
  'email',
  'creditCard'
] as const;

// ============================================================================
// UTILIDADES
// ============================================================================

/**
 * Cifra campos sensibles en un objeto
 *
 * @param data - Objeto con datos potenciales a cifrar
 * @returns Objeto con campos cifrados
 */
export function encryptSensitiveFields<T extends Record<string, unknown>>(data: T): T {
  const result = { ...data };

  for (const field of ENCRYPT_ON_WRITE) {
    if (field in result && result[field] !== null && result[field] !== undefined) {
      const value = result[field];

      // Solo cifrar strings
      if (typeof value === 'string') {
        (result as Record<string, unknown>)[field] = encrypt(value);
      } else if (typeof value === 'object') {
        // Cifrar objetos como JSON
        (result as Record<string, unknown>)[field] = encrypt(value);
      }
    }
  }

  return result;
}

/**
 * Descifra campos sensibles en un objeto
 *
 * @param data - Objeto con campos cifrados
 * @returns Objeto con campos descifrados
 */
export function decryptSensitiveFields<T extends Record<string, unknown>>(data: T): T {
  const result = { ...data };

  for (const field of DECRYPT_ON_READ) {
    if (field in result && result[field] !== null && result[field] !== undefined) {
      const value = result[field];

      // Intentar descifrar si es string
      if (typeof value === 'string') {
        try {
          (result as Record<string, unknown>)[field] = decrypt(value);
        } catch {
          // Si falla, probablemente no estaba cifrado
          // Dejar el valor original
        }
      }
    }
  }

  return result;
}

/**
 * Descifra campos sensibles en un array de objetos
 */
export function decryptSensitiveFieldsArray<T extends Record<string, unknown>>(data: T[]): T[] {
  return data.map(item => decryptSensitiveFields(item));
}

/**
 * Enmascara datos sensibles para logs
 *
 * @param data - Datos a enmascarar
 * @returns Datos con campos sensibles enmascarados
 */
export function maskSensitiveFields<T extends Record<string, unknown>>(data: T): T {
  const result = { ...data };

  for (const field of MASK_FOR_LOGS) {
    if (field in result && result[field] !== null && result[field] !== undefined) {
      const value = result[field];

      if (typeof value === 'string') {
        let masked: string;

        if (field === 'email') {
          masked = maskEmail(value);
        } else if (field === 'telefono' || field === 'phone') {
          masked = maskPhone(value);
        } else {
          masked = maskSensitiveData(value);
        }

        (result as Record<string, unknown>)[field] = masked;
      }
    }
  }

  return result;
}

// ============================================================================
// MIDDLEWARES
// ============================================================================

/**
 * Middleware para enmascarar datos sensibles en logs
 *
 * Intercepta console.log y logger para enmascarar automáticamente
 */
export function loggingMaskMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Enmascarar body en logs
  if (req.body) {
    const maskedBody = maskSensitiveFields(req.body);
    logger.debug('Request body (masked)', { body: maskedBody });
  }

  // Enmascarar query params
  if (req.query && Object.keys(req.query).length > 0) {
    const maskedQuery = maskSensitiveFields(req.query);
    logger.debug('Request query (masked)', { query: maskedQuery });
  }

  next();
}

/**
 * Middleware para descifrar datos sensibles en respuestas
 *
 * Útil cuando los datos vienen cifrados de BD y deben enviarse
 * descifrados al frontend (con autenticación válida)
 */
export function decryptResponseMiddleware(req: Request, res: Response, next: NextFunction): void {
  const originalJson = res.json.bind(res);

  res.json = function(data: unknown) {
    let processedData = data;

    // Si es array, descifrar cada elemento
    if (Array.isArray(data)) {
      processedData = decryptSensitiveFieldsArray(data as Record<string, unknown>[]);
    }
    // Si es objeto, descifrar campos
    else if (data && typeof data === 'object') {
      processedData = decryptSensitiveFields(data as Record<string, unknown>);
    }

    return originalJson(processedData);
  };

  next();
}

/**
 * Middleware para cifrar datos sensibles en requests
 *
 * Cifra campos sensibles antes de llegar a los controladores
 * para que se almacenen cifrados en BD
 */
export function encryptRequestMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (req.body) {
    req.body = encryptSensitiveFields(req.body);
  }

  next();
}

// ============================================================================
// PRISMA MIDDLEWARE (Opcional - para cifrado automático)
// ============================================================================

/**
 * Prisma middleware para cifrado/descifrado automático
 *
 * @usage
 * ```typescript
 * prisma.$use(Encryption.prismaMiddleware());
 * ```
 */
export function prismaMiddleware() {
  return async (params: {
    model: string;
    action: string;
    args: Record<string, unknown>;
    data?: Record<string, unknown>;
  }) => {
    const { model, action, args, data } = params;

    // Cifrar datos antes de crear o actualizar
    if (['create', 'createMany', 'update', 'updateMany'].includes(action)) {
      if (data) {
        params.data = encryptSensitiveFields(data);
      }
      if (args.data) {
        args.data = encryptSensitiveFields(args.data as Record<string, unknown>);
      }
    }

    return params; // Dejar que Prisma continúe
  };
}

/**
 * Hook de Prisma para descifrar resultados
 *
 * Nota: Prisma no tiene hooks después de la query,
 * así que esto debe aplicarse en el servicio
 */
export function afterPrismaQuery<T extends Record<string, unknown> | Record<string, unknown>[]>(
  result: T
): T {
  if (Array.isArray(result)) {
    return decryptSensitiveFieldsArray(result) as T;
  } else if (result && typeof result === 'object') {
    return decryptSensitiveFields(result) as T;
  }

  return result;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  encryptSensitiveFields,
  decryptSensitiveFields,
  decryptSensitiveFieldsArray,
  maskSensitiveFields,
  loggingMaskMiddleware,
  decryptResponseMiddleware,
  encryptRequestMiddleware,
  prismaMiddleware,
  afterPrismaQuery
};
