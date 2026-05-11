// apps/api/src/services/auth/UserContextService.ts
/**
 * UserContextService - Manejo del contexto de usuario y RLS
 *
 * Responsabilidades:
 * - Cargar usuario desde base de datos (cuenta o usuarioVinculado)
 * - Configurar Row-Level Security (RLS) de PostgreSQL
 * - Cachear contexto de usuario para performance
 * - Proporcionar datos de usuario al middleware
 *
 * Patrones aplicados:
 * - Service Layer: Lógica de negocio separada del middleware
 * - Caching: Reduce llamadas a BD en requests subsequentes
 * - Single Responsibility: Solo maneja contexto de usuario
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger.js';

// ============= TYPES =============

export interface UserContext {
  id: string;
  email: string;
  rol: 'DOCTOR' | 'ADMIN' | 'ASISTENTE' | 'ENFERMERA' | 'PACIENTE' | 'FARMACIA';
  cuentaId?: string;
  isActive: boolean;
}

export interface LoadUserContextResult {
  success: boolean;
  user?: UserContext;
  error?: string;
}

// Cache simple en memoria con TTL
interface CacheEntry {
  user: UserContext;
  expiresAt: number;
}

// ============= CONFIGURATION =============

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos de caché

// ============= SERVICE =============

export class UserContextService {
  private cache: Map<string, CacheEntry> = new Map();

  constructor(private prisma: PrismaClient) {}

  /**
   * Carga el contexto de usuario desde la base de datos
   *
   * @param userId - ID del usuario (del JWT payload.sub)
   * @param cuentaId - ID de la cuenta (opcional, para usuarios vinculados)
   * @returns UserContext con los datos del usuario
   */
  async loadUserContext(userId: string, cuentaId?: string): Promise<LoadUserContextResult> {
    try {
      // Verificar caché primero
      const cached = this.getFromCache(userId);
      if (cached) {
        logger.debug({ userId }, 'User context retrieved from cache');
        // Establecer RLS aunque sea desde caché
        await this.setRLSContext(userId);
        return { success: true, user: cached };
      }

      // Intentar cargar como Cuenta primero
      let user = await this.loadCuentaUser(userId);

      // Si no es cuenta, intentar como usuario vinculado
      if (!user) {
        user = await this.loadUsuarioVinculado(userId);
      }

      if (!user) {
        return {
          success: false,
          error: 'User not found or inactive'
        };
      }

      // Guardar en caché
      this.setToCache(userId, user);

      // Establecer RLS context en PostgreSQL
      await this.setRLSContext(userId);

      logger.debug({
        userId,
        rol: user.rol,
        cuentaId: user.cuentaId
      }, 'User context loaded successfully');

      return { success: true, user };
    } catch (error) {
      logger.error({ error, userId }, 'Error loading user context');
      return {
        success: false,
        error: 'Failed to load user context'
      };
    }
  }

  /**
   * Carga un usuario de tipo Cuenta
   */
  private async loadCuentaUser(userId: string): Promise<UserContext | null> {
    const cuenta = await this.prisma.cuenta.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        rol: true
      }
    });

    if (!cuenta) {
      return null;
    }

    return {
      id: cuenta.id,
      email: cuenta.email,
      rol: cuenta.rol as any,
      isActive: true
    };
  }

  /**
   * Carga un usuario vinculado (asistente, enfermera)
   */
  private async loadUsuarioVinculado(userId: string): Promise<UserContext | null> {
    const usuario = await this.prisma.usuarioVinculado.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        rol: true,
        cuentaId: true,
        doctorAsignadoId: true,
        activo: true
      }
    });

    if (!usuario || !usuario.activo) {
      return null;
    }

    return {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol as any,
      cuentaId: usuario.doctorAsignadoId,
      isActive: true
    };
  }

  /**
   * Establece el contexto de Row-Level Security en PostgreSQL
   *
   * Esto permite que las políticas RLS en la BD funcionen correctamente
   * filtrando datos según el usuario autenticado.
   */
  private async setRLSContext(userId: string): Promise<void> {
    try {
      // Establecer variables de sesión para RLS
      await this.prisma.$executeRaw`
        SET LOCAL request.jwt.claim.user_id = ${userId}
      `;
      await this.prisma.$executeRaw`
        SET LOCAL request.user.id = ${userId}
      `;
    } catch (error) {
      logger.error({ error, userId }, 'Error setting RLS context');
      // No fallamos el request si RLS falla, solo logueamos
    }
  }

  /**
   * Obtiene usuario desde caché si es válido
   */
  private getFromCache(userId: string): UserContext | null {
    const entry = this.cache.get(userId);
    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now > entry.expiresAt) {
      this.cache.delete(userId);
      return null;
    }

    return entry.user;
  }

  /**
   * Guarda usuario en caché con TTL
   */
  private setToCache(userId: string, user: UserContext): void {
    this.cache.set(userId, {
      user,
      expiresAt: Date.now() + CACHE_TTL_MS
    });
  }

  /**
   * Invalida la caché para un usuario específico
   * Útil cuando los datos del usuario cambian
   */
  invalidateCache(userId: string): void {
    this.cache.delete(userId);
    logger.debug({ userId }, 'User context cache invalidated');
  }

  /**
   * Limpia toda la caché
   * Útil para tests o cuando se requiera fresh data
   */
  clearCache(): void {
    const size = this.cache.size;
    this.cache.clear();
    logger.debug({ entries: size }, 'User context cache cleared');
  }

  /**
   * Verifica si un usuario tiene un rol específico
   * Método helper para uso en validaciones
   */
  async hasRole(userId: string, role: string): Promise<boolean> {
    const result = await this.loadUserContext(userId);
    if (!result.success || !result.user) {
      return false;
    }
    return result.user.rol === role;
  }

  /**
   * Verifica si un usuario está activo
   */
  async isActiveUser(userId: string): Promise<boolean> {
    const result = await this.loadUserContext(userId);
    if (!result.success || !result.user) {
      return false;
    }
    return result.user.isActive;
  }

  /**
   * Obtiene el cuentaId de un usuario
   * Útil para usuarios vinculados que necesitan saber su doctor asignado
   */
  async getCuentaId(userId: string): Promise<string | null> {
    const result = await this.loadUserContext(userId);
    if (!result.success || !result.user) {
      return null;
    }
    return result.user.cuentaId || result.user.id;
  }
}

// ============= SINGLETON para backward compatibility =============

let userContextServiceInstance: UserContextService | null = null;

/**
 * Obtiene la instancia singleton de UserContextService
 */
export function getUserContextService(prisma?: PrismaClient): UserContextService {
  if (!userContextServiceInstance) {
    if (!prisma) {
      throw new Error('UserContextService requires PrismaClient on first call');
    }
    userContextServiceInstance = new UserContextService(prisma);
  }
  return userContextServiceInstance;
}

/**
 * Reset del singleton (útil para tests)
 */
export function resetUserContextService(): void {
  userContextServiceInstance = null;
}

export default UserContextService;
