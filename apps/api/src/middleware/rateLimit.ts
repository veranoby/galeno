import { Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { RateLimitCache } from '../services/cache/redis.js';
import { AuthRequest } from './auth.js';

/**
 * SEC-001: Rate Limiting Middleware
 *
 * Implementa límites de tasa por usuario usando Redis como backend.
 * Utiliza RateLimitCache para verificar y aplicar límites de solicitudes.
 *
 * CARACTERÍSTICAS:
 * - Rate limiting por usuario (basado en userId del JWT)
 * - Límites específicos para endpoints de IA (más estrictos)
 * - Headers de respuesta HTTP 429 con información de límites
 * - Diferentes ventanas de tiempo según el tipo de endpoint
 *
 * LÍMITES CONFIGURADOS:
 * - General: 100 requests por minuto por usuario
 * - IA endpoints: 20 requests por minuto por usuario
 * - Auth endpoints: 10 requests por minuto por IP
 * - Upload endpoints: 5 requests por minuto por usuario
 *
 * @see RateLimitCache.checkLimit(identifier, limit, windowSeconds)
 */

/**
 * Configuración de límites de tasa
 *
 * Cada configuración define:
 * - limit: Número máximo de solicitudes permitidas
 * - windowSeconds: Ventana de tiempo en segundos
 * - skipSuccessfulRequests: Si es true, solo cuenta requests fallidos
 * - skipFailedRequests: Si es true, solo cuenta requests exitosos
 */
export interface RateLimitConfig {
  /** Número máximo de solicitudes en la ventana de tiempo */
  limit: number;
  /** Ventana de tiempo en segundos */
  windowSeconds: number;
  /** Si es true, las solicitudes exitosas no cuentan hacia el límite */
  skipSuccessfulRequests?: boolean;
  /** Si es true, las solicitudes fallidas no cuentan hacia el límite */
  skipFailedRequests?: boolean;
}

/**
 * Configuraciones predefinidas de rate limiting
 *
 * Ajustadas según las necesidades de Galeno:
 * - IA endpoints requieren límites más estrictos debido a su costo computacional
 * - Auth endpoints son limitados para prevenir ataques de fuerza bruta
 * - Upload endpoints tienen límites para prevenir abuso
 */
export const RateLimitPresets: Record<string, RateLimitConfig> = {
  /**
   * Límite general para endpoints estándar
   * 100 requests por minuto por usuario
   */
  general: {
    limit: 100,
    windowSeconds: 60
  },

  /**
   * Límite para endpoints de IA
   * 20 requests por minuto por usuario
   * Más estricto debido al costo computacional
   */
  ia: {
    limit: 20,
    windowSeconds: 60
  },

  /**
   * Límite para endpoints de autenticación
   * 10 requests por minuto por IP
   * Previene ataques de fuerza bruta
   */
  auth: {
    limit: 10,
    windowSeconds: 60
  },

  /**
   * Límite para endpoints de upload
   * 5 requests por minuto por usuario
   * Previene abuso y spam
   */
  upload: {
    limit: 5,
    windowSeconds: 60
  },

  /**
   * Límite para endpoints de firma digital
   * 15 requests por minuto por usuario
   */
  firma: {
    limit: 15,
    windowSeconds: 60
  },

  /**
   * Límite para endpoints de consulta
   * 50 requests por minuto por usuario
   */
  consultas: {
    limit: 50,
    windowSeconds: 60
  },

  /**
   * Límite para búsquedas
   * 30 requests por minuto por usuario
   */
  search: {
    limit: 30,
    windowSeconds: 60
  }
};

/**
 * Opciones adicionales para el middleware de rate limiting
 */
export interface RateLimitOptions {
  /** Configuración de límites (puede ser un preset o custom) */
  config?: RateLimitConfig;
  /** Nombre del preset a usar */
  preset?: keyof typeof RateLimitPresets;
  /** Mensaje de error personalizado */
  message?: string;
  /** Si es true, usa IP en lugar de userId para rate limiting */
  useIP?: boolean;
  /** Prefijo para la clave de rate limiting en Redis */
  keyPrefix?: string;
  /** Skip rate limiting si no hay usuario autenticado */
  skipIfNoAuth?: boolean;
}

/**
 * Headers de respuesta HTTP para rate limiting
 *
 * Siguen el estándar de RFC 6585:
 * - X-RateLimit-Limit: Límite total de solicitudes
 * - X-RateLimit-Remaining: Solicitudes restantes en la ventana actual
 * - X-RateLimit-Reset: Timestamp UTC cuando se resetea el límite
 * - Retry-After: Segundos hasta que el usuario pueda reintentar (solo en 429)
 */
interface RateLimitHeaders {
  'X-RateLimit-Limit': string;
  'X-RateLimit-Remaining': string;
  'X-RateLimit-Reset': string;
  'Retry-After'?: string;
}

/**
 * Genera identificador único para rate limiting
 *
 * Prioridad de identificación:
 * 1. Usuario autenticado (userId del JWT)
 * 2. IP del cliente
 * 3. IP + User-Agent (para mayor granularidad)
 *
 * @param req - Request de Express con AuthRequest
 * @param useIP - Si es true, usa IP en lugar de userId
 * @returns Identificador para rate limiting
 */
function getRateLimitIdentifier(req: AuthRequest, useIP = false): string {
  if (!useIP && req.user?.id) {
    // Para usuarios autenticados, usar userId
    return `user:${req.user.id}`;
  }

  // Para no autenticados o si useIP es true, usar IP
  const ip = req.ip ||
    (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
    'unknown';

  // Agregar user-agent para mayor granularidad si está disponible
  const userAgent = req.headers['user-agent'];
  if (userAgent) {
    // Hash simple del user-agent para mantener privacidad pero distinguir clientes
    const userAgentHash = Buffer.from(userAgent).toString('base64').substring(0, 16);
    return `ip:${ip}:${userAgentHash}`;
  }

  return `ip:${ip}`;
}

/**
 * Calcula el timestamp de reset de la ventana de rate limiting
 *
 * @returns Timestamp UTC en segundos
 */
function getResetTime(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Middleware de Rate Limiting
 *
 * Aplica límites de tasa a las solicitudes HTTP basándose en:
 * - Usuario autenticado (userId del JWT)
 * - Configuración predefinida o custom
 * - Ventana de tiempo deslizante
 *
 * RESPUESTA HTTP 429:
 * Cuando se excede el límite, retorna:
 * ```json
 * {
 *   "error": "Too Many Requests",
 *   "message": "Rate limit exceeded. Please try again later.",
 *   "retryAfter": 45
 * }
 * ```
 *
 * Con headers:
 * - X-RateLimit-Limit: 100
 * - X-RateLimit-Remaining: 0
 * - X-RateLimit-Reset: 1708521600
 * - Retry-After: 45
 *
 * @example Uso con preset:
 * ```typescript
 * app.use('/api/ia', rateLimit({ preset: 'ia' }));
 * ```
 *
 * @example Uso con configuración custom:
 * ```typescript
 * app.use('/api/custom', rateLimit({
 *   config: { limit: 50, windowSeconds: 120 }
 * }));
 * ```
 *
 * @example Uso para auth (basado en IP):
 * ```typescript
 * app.use('/api/auth/login', rateLimit({
 *   preset: 'auth',
 *   useIP: true
 * }));
 * ```
 */
export function rateLimit(options: RateLimitOptions = {}) {
  const {
    preset = 'general',
    config: customConfig,
    message = 'Rate limit exceeded. Please try again later.',
    useIP = false,
    keyPrefix = '',
    skipIfNoAuth = false
  } = options;

  // Obtener configuración (preset o custom)
  const config = customConfig || RateLimitPresets[preset] || RateLimitPresets.general;

  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    // Skip rate limiting si está configurado y no hay usuario autenticado
    if (skipIfNoAuth && !req.user?.id) {
      return next();
    }

    try {
      // Generar identificador único
      const identifier = keyPrefix
        ? `${keyPrefix}:${getRateLimitIdentifier(req, useIP)}`
        : getRateLimitIdentifier(req, useIP);

      // Verificar límite con RateLimitCache
      const result = await RateLimitCache.checkLimit(
        identifier,
        config.limit,
        config.windowSeconds
      );

      // Calcular tiempo de reset
      const resetTime = getResetTime() + config.windowSeconds;

      // Configurar headers de rate limiting
      const headers: RateLimitHeaders = {
        'X-RateLimit-Limit': config.limit.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': resetTime.toString()
      };

      // Si no se permite continuar, agregar Retry-After
      if (!result.allowed) {
        headers['Retry-After'] = config.windowSeconds.toString();
      }

      // Agregar headers a la respuesta
      res.set(headers);

      // Verificar si se permite continuar
      if (!result.allowed) {
        logger.warn({
          identifier,
          limit: config.limit,
          window: config.windowSeconds,
          ip: req.ip,
          userId: req.user?.id,
          path: req.path,
          method: req.method
        }, 'Rate limit exceeded');

        return res.status(429).json({
          error: 'Too Many Requests',
          message,
          retryAfter: config.windowSeconds
        });
      }

      // Si se permite, continuar al siguiente middleware
      next();
    } catch (error) {
      // En caso de error con Redis, loggear pero permitir la solicitud (fail-open)
      logger.error({ error, identifier: req.user?.id || req.ip }, 'Rate limiting error');

      // En producción, podrías querer fallar-cerrado (bloquear) en lugar de fallar-abierto
      // Por ahora, fail-open para no interrumpir el servicio
      next();
    }
  };
}

/**
 * Middleware especial para endpoints de IA
 *
 * Configuración predefinida para IA con límites más estrictos
 * y logging detallado para análisis de uso.
 *
 * Uso:
 * ```typescript
 * app.use('/api/ia/*', rateLimitIA());
 * ```
 */
export function rateLimitIA(options?: Partial<RateLimitOptions>) {
  return rateLimit({
    preset: 'ia',
    message: 'IA rate limit exceeded. Please reduce the frequency of your requests.',
    keyPrefix: 'ia',
    ...options
  });
}

/**
 * Middleware para rate limiting basado en IP
 *
 * Útil para endpoints de auth y otros donde no hay usuario autenticado.
 *
 * Uso:
 * ```typescript
 * app.use('/api/auth/login', rateLimitByIP());
 * ```
 */
export function rateLimitByIP(options?: Partial<RateLimitOptions>) {
  return rateLimit({
    preset: 'auth',
    useIP: true,
    keyPrefix: 'auth',
    ...options
  });
}

/**
 * Middleware para rate limiting de uploads
 *
 * Configuración predefinida para endpoints de carga de archivos.
 *
 * Uso:
 * ```typescript
 * app.use('/api/upload', rateLimitUpload());
 * ```
 */
export function rateLimitUpload(options?: Partial<RateLimitOptions>) {
  return rateLimit({
    preset: 'upload',
    message: 'Upload rate limit exceeded. Please wait before uploading more files.',
    keyPrefix: 'upload',
    ...options
  });
}

/**
 * Middleware para rate limiting de firma digital
 *
 * Configuración predefinida para endpoints de firma.
 *
 * Uso:
 * ```typescript
 * app.use('/api/firma', rateLimitFirma());
 * ```
 */
export function rateLimitFirma(options?: Partial<RateLimitOptions>) {
  return rateLimit({
    preset: 'firma',
    message: 'Signature validation rate limit exceeded.',
    keyPrefix: 'firma',
    ...options
  });
}

/**
 * Middleware para rate limiting de consultas
 *
 * Configuración predefinida para endpoints de consultas médicas.
 *
 * Uso:
 * ```typescript
 * app.use('/api/consultas', rateLimitConsultas());
 * ```
 */
export function rateLimitConsultas(options?: Partial<RateLimitOptions>) {
  return rateLimit({
    preset: 'consultas',
    message: 'Consultas rate limit exceeded. Please slow down your requests.',
    keyPrefix: 'consultas',
    ...options
  });
}

/**
 * Middleware para rate limiting de búsquedas
 *
 * Configuración predefinida para endpoints de búsqueda.
 *
 * Uso:
 * ```typescript
 * app.use('/api/search', rateLimitSearch());
 * ```
 */
export function rateLimitSearch(options?: Partial<RateLimitOptions>) {
  return rateLimit({
    preset: 'search',
    message: 'Search rate limit exceeded. Please wait before searching again.',
    keyPrefix: 'search',
    ...options
  });
}

export default {
  rateLimit,
  rateLimitIA,
  rateLimitByIP,
  rateLimitUpload,
  rateLimitFirma,
  rateLimitConsultas,
  rateLimitSearch,
  RateLimitPresets
};
