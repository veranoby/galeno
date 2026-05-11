// apps/api/src/services/telemetry/metrics.service.ts
import prisma from '../../config/database.js';
import { logger } from '../../utils/logger.js';

export interface SessionMetrics {
  sessionId: string;
  consultaId?: string;
  userId: string;
  jitter: number;
  latency: number;
  packetLoss: number;
  videoQuality?: string;
  audioQuality?: string;
  duration: number;
  metadata?: any;
}

export class TelemetryService {
  /**
   * Persistir log de métricas en la base de datos
   */
  async persistMetrics(data: SessionMetrics): Promise<boolean> {
    try {
      await prisma.metricLog.create({
        data: {
          sessionId: data.sessionId,
          consultaId: data.consultaId,
          userId: data.userId,
          jitter: data.jitter,
          latency: data.latency,
          packetLoss: data.packetLoss,
          videoQuality: data.videoQuality,
          audioQuality: data.audioQuality,
          duration: data.duration,
          metadata: data.metadata || {}
        }
      });

      logger.debug({
        event: 'telemetry_persisted',
        sessionId: data.sessionId,
        userId: data.userId
      });

      return true;
    } catch (error) {
      logger.error({
        event: 'telemetry_persistence_error',
        sessionId: data.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Obtener resumen de calidad de una consulta
   */
  async getConsultaQuality(consultaId: string) {
    return prisma.metricLog.findMany({
      where: { consultaId },
      orderBy: { createdAt: 'desc' }
    });
  }
}

export const telemetryService = new TelemetryService();
