/**
 * IA Quota Service
 *
 * Sistema de créditos y cuotas para uso de IA (Gemini Flash)
 * con caché Redis para optimizar costos de tokens.
 *
 * Límites por plan:
 * - FREE: 5 consultas/día
 * - PREMIUM: 100 consultas/día
 * - CLINICA_SME: 500 consultas/día
 */

import { Redis } from 'ioredis';
import prisma from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import { Plan } from '@prisma/client';

/**
 * Configuración de cuotas por plan
 */
const QUOTA_CONFIG: Record<Plan, { daily: number; monthly: number }> = {
  FREE: { daily: 5, monthly: 100 },
  PREMIUM: { daily: 100, monthly: 2000 },
  CLINICA_SME: { daily: 500, monthly: 10000 }
};

/**
 * Cache de prompts repetitivos (TTL: 24h)
 */
const PROMPT_CACHE_TTL = 24 * 60 * 60; // 24 horas en segundos

export class IAQuotaService {
  private redis: Redis;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }

  /**
   * Verificar si el usuario tiene cuota disponible
   */
  async checkQuota(userId: string): Promise<{
    available: boolean;
    dailyUsed: number;
    dailyLimit: number;
    monthlyUsed: number;
    monthlyLimit: number;
    resetAt: string;
  }> {
    try {
      // Obtener plan del usuario
      const user = await prisma.cuenta.findUnique({
        where: { id: userId },
        select: { plan: true }
      });

      if (!user) {
        throw new Error('Usuario no encontrado');
      }

      const plan = user.plan as Plan;
      const config = QUOTA_CONFIG[plan];

      // Keys de Redis
      const dailyKey = `galeno:ia:quota:daily:${userId}`;
      const monthlyKey = `galeno:ia:quota:monthly:${userId}`;

      // Obtener contadores
      const [dailyUsed, monthlyUsed] = await Promise.all([
        this.redis.get(dailyKey).then(v => parseInt(v || '0', 10)),
        this.redis.get(monthlyKey).then(v => parseInt(v || '0', 10))
      ]);

      // Calcular reset (medianoche UTC para daily, primer día del mes para monthly)
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      return {
        available: dailyUsed < config.daily && monthlyUsed < config.monthly,
        dailyUsed,
        dailyLimit: config.daily,
        monthlyUsed,
        monthlyLimit: config.monthly,
        resetAt: tomorrow.toISOString()
      };
    } catch (error) {
      logger.error({
        event: 'ia_quota_check_error',
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Fallback: permitir uso ilimitado en caso de error
      return {
        available: true,
        dailyUsed: 0,
        dailyLimit: 999999,
        monthlyUsed: 0,
        monthlyLimit: 999999,
        resetAt: new Date().toISOString()
      };
    }
  }

  /**
   * Consumir una unidad de cuota
   */
  async consumeQuota(userId: string): Promise<{
    success: boolean;
    dailyRemaining: number;
    monthlyRemaining: number;
  }> {
    try {
      const quota = await this.checkQuota(userId);

      if (!quota.available) {
        logger.warn({
          event: 'ia_quota_exceeded',
          userId,
          dailyUsed: quota.dailyUsed,
          dailyLimit: quota.dailyLimit
        });

        return {
          success: false,
          dailyRemaining: 0,
          monthlyRemaining: 0
        };
      }

      // Incrementar contadores con TTL
      const dailyKey = `galeno:ia:quota:daily:${userId}`;
      const monthlyKey = `galeno:ia:quota:monthly:${userId}`;

      const now = new Date();
      
      // TTL hasta medianoche UTC para daily
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const dailyTTL = Math.floor((tomorrow.getTime() - now.getTime()) / 1000);

      // TTL hasta fin de mes para monthly
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      endOfMonth.setHours(23, 59, 59, 999);
      const monthlyTTL = Math.floor((endOfMonth.getTime() - now.getTime()) / 1000);

      // Pipeline para atomicidad
      const pipeline = this.redis.pipeline();
      pipeline.incr(dailyKey);
      pipeline.expire(dailyKey, dailyTTL);
      pipeline.incr(monthlyKey);
      pipeline.expire(monthlyKey, monthlyTTL);

      await pipeline.exec();

      const config = QUOTA_CONFIG[(await prisma.cuenta.findUnique({
        where: { id: userId },
        select: { plan: true }
      }))?.plan as Plan];

      return {
        success: true,
        dailyRemaining: config.daily - (quota.dailyUsed + 1),
        monthlyRemaining: config.monthly - (quota.monthlyUsed + 1)
      };
    } catch (error) {
      logger.error({
        event: 'ia_quota_consume_error',
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        dailyRemaining: 0,
        monthlyRemaining: 0
      };
    }
  }

  /**
   * Cachear resultado de prompt
   */
  async cachePrompt(
    promptHash: string,
    result: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const key = `galeno:ia:cache:${promptHash}`;
      const value = JSON.stringify({ result, metadata, timestamp: Date.now() });

      await this.redis.setex(key, PROMPT_CACHE_TTL, value);

      logger.debug({
        event: 'ia_prompt_cached',
        promptHash,
        ttl: PROMPT_CACHE_TTL
      });
    } catch (error) {
      logger.error({
        event: 'ia_cache_error',
        promptHash,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Obtener resultado de caché
   */
  async getCachedPrompt(
    promptHash: string
  ): Promise<{ result: string; metadata?: Record<string, any> } | null> {
    try {
      const key = `galeno:ia:cache:${promptHash}`;
      const value = await this.redis.get(key);

      if (!value) return null;

      const parsed = JSON.parse(value);
      logger.debug({
        event: 'ia_cache_hit',
        promptHash
      });

      return {
        result: parsed.result,
        metadata: parsed.metadata
      };
    } catch (error) {
      logger.error({
        event: 'ia_cache_get_error',
        promptHash,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return null;
    }
  }

  /**
   * Resetear cuota de usuario (para testing o admin)
   */
  async resetQuota(userId: string): Promise<void> {
    try {
      const dailyKey = `galeno:ia:quota:daily:${userId}`;
      const monthlyKey = `galeno:ia:quota:monthly:${userId}`;

      await Promise.all([
        this.redis.del(dailyKey),
        this.redis.del(monthlyKey)
      ]);

      logger.info({
        event: 'ia_quota_reset',
        userId
      });
    } catch (error) {
      logger.error({
        event: 'ia_quota_reset_error',
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Obtener estadísticas de uso de IA
   */
  async getUsageStats(userId: string): Promise<{
    plan: string;
    dailyUsed: number;
    dailyLimit: number;
    monthlyUsed: number;
    monthlyLimit: number;
    percentageUsed: number;
  }> {
    const quota = await this.checkQuota(userId);
    const user = await prisma.cuenta.findUnique({
      where: { id: userId },
      select: { plan: true }
    });

    return {
      plan: user?.plan || 'FREE',
      dailyUsed: quota.dailyUsed,
      dailyLimit: quota.dailyLimit,
      monthlyUsed: quota.monthlyUsed,
      monthlyLimit: quota.monthlyLimit,
      percentageUsed: Math.round((quota.dailyUsed / quota.dailyLimit) * 100)
    };
  }
}

// Singleton
export const iaQuotaService = new IAQuotaService();
