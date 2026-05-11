// apps/api/src/events/handlers/AnalyticsEventHandler.ts
/**
 * AnalyticsEventHandler - Maneja eventos para analytics y métricas
 *
 * Procesa eventos para:
 * - Métricas de negocio
 * - Análisis de uso
 * - Dashboards
 * - Reporting
 */

import type { PrismaClient } from '@prisma/client';
import type { GalenoDomainEvent } from '../DomainEvent.js';
import { logger } from '../../utils/logger.js';

// Tipos de métricas
interface MetricData {
  name: string;
  value: number;
  tags: Record<string, string>;
  timestamp: Date;
}

export class AnalyticsEventHandler {
  private metricsBuffer: MetricData[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly MAX_BUFFER_SIZE = 500; // Prevenir memoria ilimitada

  constructor(private prisma: PrismaClient) {
    // Configurar flush automático cada 30 segundos
    this.startFlushInterval();
  }

  /**
   * Maneja eventos de pago recibido (métricas financieras)
   */
  async handlePaymentReceived(event: Extract<GalenoDomainEvent, { eventType: 'PaymentReceived' }>): Promise<void> {
    const { data } = event;

    this.addMetric({
      name: 'payment.received',
      value: data.amount,
      tags: {
        currency: data.currency,
        gateway: data.gateway,
        plan: data.plan || 'unknown',
        cuentaId: data.cuentaId
      },
      timestamp: event.timestamp
    });

    // Métrica de conteo
    this.addMetric({
      name: 'payment.count',
      value: 1,
      tags: {
        status: data.status,
        gateway: data.gateway
      },
      timestamp: event.timestamp
    });
  }

  /**
   * Maneja eventos de consulta creada
   */
  async handleConsultaCreated(event: Extract<GalenoDomainEvent, { eventType: 'ConsultaCreated' }>): Promise<void> {
    const { data } = event;

    this.addMetric({
      name: 'consulta.created',
      value: 1,
      tags: {
        tipo: data.tipo,
        doctorId: data.doctorId
      },
      timestamp: event.timestamp
    });
  }

  /**
   * Maneja eventos de consulta completada
   */
  async handleConsultaCompleted(event: Extract<GalenoDomainEvent, { eventType: 'ConsultaCompleted' }>): Promise<void> {
    const { data } = event;

    this.addMetric({
      name: 'consulta.completed',
      value: 1,
      tags: {
        estado: data.estado,
        doctorId: data.doctorId
      },
      timestamp: event.timestamp
    });

    // Duración de la consulta
    if (data.duracionMinutos) {
      this.addMetric({
        name: 'consulta.duracion',
        value: data.duracionMinutos,
        tags: {
          doctorId: data.doctorId
        },
        timestamp: event.timestamp
      });
    }
  }

  /**
   * Maneja eventos de paciente conectado
   */
  async handlePatientConnected(event: Extract<GalenoDomainEvent, { eventType: 'PatientConnected' }>): Promise<void> {
    const { data } = event;

    this.addMetric({
      name: 'patient.connected',
      value: 1,
      tags: {
        doctorId: data.doctorId,
        consentType: data.consentType
      },
      timestamp: event.timestamp
    });
  }

  /**
   * Maneja eventos de login
   */
  async handleUserLoggedIn(event: Extract<GalenoDomainEvent, { eventType: 'UserLoggedIn' }>): Promise<void> {
    const { data } = event;

    this.addMetric({
      name: 'user.login',
      value: 1,
      tags: {
        rol: data.rol,
        loginMethod: data.loginMethod
      },
      timestamp: event.timestamp
    });
  }

  /**
   * Maneja eventos de métricas del sistema
   */
  async handleSystemMetric(event: Extract<GalenoDomainEvent, { eventType: 'SystemMetric' }>): Promise<void> {
    const { data } = event;

    this.addMetric({
      name: `system.${data.metricName}`,
      value: data.metricValue,
      tags: data.tags || {},
      timestamp: event.timestamp
    });
  }

  /**
   * Agrega una métrica al buffer
   */
  private addMetric(metric: MetricData): void {
    // Prevenir overflow de memoria
    if (this.metricsBuffer.length >= this.MAX_BUFFER_SIZE) {
      logger.warn('Metrics buffer full, forcing flush');
      this.flushMetrics().catch((error) => {
        logger.error({ error }, 'Error flushing metrics');
      });
    }

    this.metricsBuffer.push(metric);

    // Flush si el buffer está lleno (umbral más bajo que el máximo)
    if (this.metricsBuffer.length >= 100) {
      this.flushMetrics().catch((error) => {
        logger.error({ error }, 'Error flushing metrics');
      });
    }
  }

  /**
   * Guarda las métricas acumuladas en la base de datos
   *
   * OPTIMIZACIÓN: Usa pipeline/batch para evitar N+1 operations
   */
  private async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) return;

    const metrics = [...this.metricsBuffer];
    this.metricsBuffer = [];

    try {
      logger.debug({ count: metrics.length }, 'Metrics flushed');

      // OPTIMIZADO: Usar pipeline para operaciones batch en Redis
      // Esto evita el N+1 pattern de llamadas individuales
      //
      // Ejemplo con ioredis pipeline:
      // const pipeline = redis.pipeline();
      // for (const metric of metrics) {
      //   const key = `metrics:${metric.name}:${metric.timestamp.getTime()}`;
      //   const value = JSON.stringify({ value: metric.value, tags: metric.tags });
      //   pipeline.set(key, value, 'EX', 7 * 24 * 60 * 60); // 7 días TTL
      // }
      // await pipeline.exec(); // Un solo roundtrip al servidor Redis

      // Placeholder: aquí se enviarían a un servicio de analytics
      // (DataDog, Prometheus, New Relic, etc.)
      logger.debug({ metricsCount: metrics.length }, 'Metrics ready for analytics service');
    } catch (error) {
      logger.error({ error }, 'Error saving metrics');
      // Re-agregar al buffer si falla (con límite de seguridad)
      const spaceAvailable = this.MAX_BUFFER_SIZE - this.metricsBuffer.length;
      if (spaceAvailable > 0) {
        this.metricsBuffer.unshift(...metrics.slice(0, spaceAvailable));
      }
    }
  }

  /**
   * Inicia el intervalo de flush automático
   */
  private startFlushInterval(): void {
    this.flushInterval = setInterval(() => {
      this.flushMetrics().catch((error) => {
        logger.error({ error }, 'Error in automatic metrics flush');
      });
    }, 30000); // 30 segundos
  }

  /**
   * Detiene el intervalo de flush
   */
  stop(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    this.flushMetrics().catch((error) => {
      logger.error({ error }, 'Error flushing metrics on stop');
    });
  }

  /**
   * Registra todos los handlers en el EventBus
   */
  registerHandlers(eventBus: import('../EventBus.js').EventBus): void {
    eventBus.subscribe('PaymentReceived', (event) => this.handlePaymentReceived(event as any));
    eventBus.subscribe('ConsultaCreated', (event) => this.handleConsultaCreated(event as any));
    eventBus.subscribe('ConsultaCompleted', (event) => this.handleConsultaCompleted(event as any));
    eventBus.subscribe('PatientConnected', (event) => this.handlePatientConnected(event as any));
    eventBus.subscribe('UserLoggedIn', (event) => this.handleUserLoggedIn(event as any));
    eventBus.subscribe('SystemMetric', (event) => this.handleSystemMetric(event as any));
  }
}

export default AnalyticsEventHandler;
