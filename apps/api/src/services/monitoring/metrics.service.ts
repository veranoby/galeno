/**
 * Telemetry Metrics Service
 *
 * Persiste métricas de calidad de teleconsultas WebRTC
 * para análisis histórico de calidad de servicio.
 */

import prisma from '../../config/database.js';
import { logger } from '../../utils/logger.js';

/**
 * Enums para métricas de negocio
 */
export enum BusinessMetric {
  USER_REGISTRATION = 'user_registration',
  USER_LOGIN = 'user_login',
  CONSULTA_CREATED = 'consulta_created',
  DOCUMENT_GENERATED = 'document_generated',
  PLAN_UPGRADE = 'plan_upgrade',
  PLAN_DOWNGRADE = 'plan_downgrade',
  STORAGE_USAGE = 'storage_usage',
  API_REQUEST = 'api_request',
  ERROR_OCCURRED = 'error_occurred'
}

/**
 * Métricas de teleconsulta
 */
export interface TeleconsultMetrics {
  /** ID de sesión WebRTC */
  sessionId: string;
  /** ID de consulta (opcional) */
  consultaId?: string;
  /** ID de usuario */
  userId: string;
  /** Jitter en ms */
  jitter: number;
  /** Latencia en ms */
  latency: number;
  /** Pérdida de paquetes (0-1) */
  packetLoss: number;
  /** Calidad de video */
  videoQuality?: 'high' | 'medium' | 'low';
  /** Calidad de audio */
  audioQuality?: 'high' | 'medium' | 'low';
  /** Duración en segundos */
  duration: number;
  /** Metadata adicional */
  metadata?: Record<string, any>;
}

export class MetricsService {
  /**
   * Métodos estáticos para compatibilidad con rutas de monitoreo existentes
   */
  static getAllMetrics() {
    return []; // Placeholder para evitar error de build
  }

  static getMetrics(metric: BusinessMetric) {
    return 0; // Placeholder para evitar error de build
  }

  static incrementCounter(name: string, labels?: Record<string, string>) {
    // Placeholder
  }

  static trackError(error: Error, labels?: Record<string, string>) {
    // Placeholder
  }

  /**
   * Guardar métricas de teleconsulta
   */
  async saveMetrics(metrics: TeleconsultMetrics): Promise<void> {
    try {
      await prisma.metricLog.create({
        data: {
          sessionId: metrics.sessionId,
          consultaId: metrics.consultaId,
          userId: metrics.userId,
          jitter: metrics.jitter as any,
          latency: metrics.latency as any,
          packetLoss: metrics.packetLoss as any,
          videoQuality: metrics.videoQuality,
          audioQuality: metrics.audioQuality,
          duration: metrics.duration,
          metadata: metrics.metadata as any
        }
      });

      logger.info({
        event: 'telemetry_saved',
        sessionId: metrics.sessionId,
        latency: metrics.latency,
        jitter: metrics.jitter,
        packetLoss: metrics.packetLoss
      });
    } catch (error) {
      logger.error({
        event: 'telemetry_save_error',
        sessionId: metrics.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Obtener métricas por sesión
   */
  async getMetricsBySession(sessionId: string): Promise<TeleconsultMetrics | null> {
    try {
      const metric = await prisma.metricLog.findUnique({
        where: { sessionId }
      });

      if (!metric) return null;

      return {
        sessionId: metric.sessionId,
        consultaId: metric.consultaId || undefined,
        userId: metric.userId,
        jitter: Number(metric.jitter),
        latency: Number(metric.latency),
        packetLoss: Number(metric.packetLoss),
        videoQuality: metric.videoQuality as 'high' | 'medium' | 'low' | undefined,
        audioQuality: metric.audioQuality as 'high' | 'medium' | 'low' | undefined,
        duration: metric.duration,
        metadata: metric.metadata as Record<string, any> | undefined
      };
    } catch (error) {
      logger.error({
        event: 'telemetry_get_error',
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Obtener métricas por usuario en período
   */
  async getMetricsByUser(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<TeleconsultMetrics[]> {
    try {
      const metrics = await prisma.metricLog.findMany({
        where: {
          userId,
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return metrics.map(m => ({
        sessionId: m.sessionId,
        consultaId: m.consultaId || undefined,
        userId: m.userId,
        jitter: Number(m.jitter),
        latency: Number(m.latency),
        packetLoss: Number(m.packetLoss),
        videoQuality: m.videoQuality as 'high' | 'medium' | 'low' | undefined,
        audioQuality: m.audioQuality as 'high' | 'medium' | 'low' | undefined,
        duration: m.duration,
        metadata: m.metadata as Record<string, any> | undefined
      }));
    } catch (error) {
      logger.error({
        event: 'telemetry_get_user_error',
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  /**
   * Obtener estadísticas agregadas
   */
  async getAggregateStats(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalCalls: number;
    avgLatency: number;
    avgJitter: number;
    avgPacketLoss: number;
    avgDuration: number;
    qualityDistribution: { high: number; medium: number; low: number };
  }> {
    try {
      const metrics = await prisma.metricLog.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      });

      if (metrics.length === 0) {
        return {
          totalCalls: 0,
          avgLatency: 0,
          avgJitter: 0,
          avgPacketLoss: 0,
          avgDuration: 0,
          qualityDistribution: { high: 0, medium: 0, low: 0 }
        };
      }

      const totalCalls = metrics.length;
      const avgLatency = metrics.reduce((sum, m) => sum + Number(m.latency), 0) / totalCalls;
      const avgJitter = metrics.reduce((sum, m) => sum + Number(m.jitter), 0) / totalCalls;
      const avgPacketLoss = metrics.reduce((sum, m) => sum + Number(m.packetLoss), 0) / totalCalls;
      const avgDuration = metrics.reduce((sum, m) => sum + m.duration, 0) / totalCalls;

      const qualityDistribution = {
        high: metrics.filter(m => m.videoQuality === 'high').length,
        medium: metrics.filter(m => m.videoQuality === 'medium').length,
        low: metrics.filter(m => m.videoQuality === 'low').length
      };

      return {
        totalCalls,
        avgLatency: Math.round(avgLatency * 100) / 100,
        avgJitter: Math.round(avgJitter * 100) / 100,
        avgPacketLoss: Math.round(avgPacketLoss * 1000) / 1000,
        avgDuration: Math.round(avgDuration),
        qualityDistribution
      };
    } catch (error) {
      logger.error({
        event: 'telemetry_aggregate_error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        totalCalls: 0,
        avgLatency: 0,
        avgJitter: 0,
        avgPacketLoss: 0,
        avgDuration: 0,
        qualityDistribution: { high: 0, medium: 0, low: 0 }
      };
    }
  }

  /**
   * Limpiar métricas antiguas (más de 90 días)
   */
  async cleanupOldMetrics(daysToKeep = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await prisma.metricLog.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate
          }
        }
      });

      logger.info({
        event: 'telemetry_cleanup',
        deletedCount: result.count,
        daysToKeep
      });

      return result.count;
    } catch (error) {
      logger.error({
        event: 'telemetry_cleanup_error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return 0;
    }
  }
}

// Singleton
export const metricsService = new MetricsService();
