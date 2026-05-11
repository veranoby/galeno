/**
 * Geo-IP Middleware
 *
 * Detecta el país del usuario basado en su IP y agrega
 * la información al request para selección de pasarela de pago.
 *
 * Usa geoip-lite para detección local (sin dependencias externas)
 */

import { Request, Response, NextFunction } from 'express';
import geoip from 'geoip-lite';
import { logger } from '../utils/logger.js';

/**
 * Extended Request con información de Geo-IP
 */
export interface GeoIPRequest extends Request {
  geo?: {
    /** Código de país (ISO 3166-1 alpha-2) */
    country: string;
    /** Código de región */
    region?: string;
    /** Ciudad */
    city?: string;
    /** Timezone */
    timezone?: string;
    /** IP del cliente */
    ip: string;
  };
}

/**
 * Middleware de Geo-IP
 *
 * Detecta el país del usuario y lo agrega al request
 */
export function geoIPMiddleware(
  req: GeoIPRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    // Obtener IP del cliente (considerando proxies)
    const ip = getClientIP(req);

    if (!ip) {
      logger.warn({ event: 'geoip_no_ip', message: 'Could not determine client IP' });
      next();
      return;
    }

    // Ignorar localhost en desarrollo
    if (ip === '127.0.0.1' || ip === '::1') {
      req.geo = {
        country: 'EC', // Default para desarrollo local
        ip
      };
      logger.debug({ event: 'geoip_localhost', country: 'EC' });
      next();
      return;
    }

    // Lookup de Geo-IP
    const geo = geoip.lookup(ip);

    if (geo) {
      req.geo = {
        country: geo.country || 'EC',
        region: geo.region,
        city: geo.city,
        timezone: geo.timezone,
        ip
      };

      logger.debug({
        event: 'geoip_detected',
        ip,
        country: geo.country,
        region: geo.region,
        city: geo.city
      });
    } else {
      // Fallback a Ecuador si no se puede determinar
      req.geo = {
        country: 'EC',
        ip
      };
      logger.debug({ event: 'geoip_fallback', country: 'EC', ip });
    }

    next();
  } catch (error) {
    logger.error({
      event: 'geoip_error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    // No fallar el request, continuar sin geo
    next();
  }
}

/**
 * Obtener IP real del cliente considerando proxies
 */
function getClientIP(req: Request): string | null {
  // Checkear headers de proxy
  const forwardedFor = req.headers['x-forwarded-for'];
  const realIP = req.headers['x-real-ip'];
  const cfConnectingIP = req.headers['cf-connecting-ip'];

  if (typeof forwardedFor === 'string') {
    // X-Forwarded-For puede tener múltiples IPs, tomar la primera
    return forwardedFor.split(',')[0].trim();
  }

  if (typeof realIP === 'string') {
    return realIP;
  }

  if (typeof cfConnectingIP === 'string') {
    return cfConnectingIP;
  }

  // Fallback a socket remoteAddr
  return req.socket.remoteAddress || null;
}

/**
 * Helper para obtener país del request
 */
export function getCountryFromRequest(req: GeoIPRequest): string {
  return req.geo?.country || 'EC';
}

/**
 * Helper para verificar si es Ecuador
 */
export function isEcuador(req: GeoIPRequest): boolean {
  return getCountryFromRequest(req) === 'EC';
}
