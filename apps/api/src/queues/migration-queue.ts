// apps/api/src/queues/migration-queue.ts
import { Queue, Job, QueueEvents } from 'bullmq';
import { MigrationJobData, MigrationJobResult } from '../services/migration/migration-processor.js';

/**
 * Migration Queue
 * 
 * Cola de trabajos para procesamiento asíncrono de migraciones
 * 
 * Features:
 * - Encolamiento de trabajos de migración
 * - Seguimiento de progreso
 * - Reintentos automáticos
 * - Eventos en tiempo real
 */

const QUEUE_NAME = 'migration-queue';

export interface MigrationQueueOptions {
  attempts?: number;
  backoff?: number;
  timeout?: number;
  jobId?: string;
}

export class MigrationQueueService {
  private queue: Queue<MigrationJobData, MigrationJobResult>;
  private queueEvents: QueueEvents;

  constructor(redisUrl: string) {
    const connection = { url: redisUrl };

    this.queue = new Queue<MigrationJobData, MigrationJobResult>(QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000
        },
        removeOnComplete: {
          age: 3600 // Mantener trabajos completados por 1 hora
        },
        removeOnFail: {
          age: 86400 // Mantener trabajos fallidos por 24 horas
        }
      }
    });

    this.queueEvents = new QueueEvents(QUEUE_NAME, { connection });

    this.setupEventHandlers();
  }

  /**
   * Configura manejadores de eventos
   */
  private setupEventHandlers() {
    this.queueEvents.on('waiting', ({ jobId }) => {
      console.log(`[MigrationQueue] Job ${jobId} en espera`);
    });

    this.queueEvents.on('active', ({ jobId, prev }) => {
      console.log(`[MigrationQueue] Job ${jobId} iniciado (prev: ${prev})`);
    });

    this.queueEvents.on('completed', ({ jobId, returnvalue }) => {
      console.log(`[MigrationQueue] Job ${jobId} completado:`, returnvalue);
    });

    this.queueEvents.on('failed', ({ jobId, failedReason }) => {
      console.error(`[MigrationQueue] Job ${jobId} fallido:`, failedReason);
    });

    this.queueEvents.on('progress', ({ jobId, data }) => {
      console.log(`[MigrationQueue] Job ${jobId} progreso: ${data}%`);
    });
  }

  /**
   * Agrega trabajo de migración a la cola
   */
  async addMigrationJob(
    data: MigrationJobData,
    options?: MigrationQueueOptions
  ): Promise<Job<MigrationJobData, MigrationJobResult, string>> {
    const job = await this.queue.add(
      'process-migration',
      data,
      {
        jobId: options?.jobId || data.jobId,
        attempts: options?.attempts || 3,
        backoff: options?.backoff ? { type: 'exponential', delay: options.backoff } : undefined,
        removeOnComplete: {
          age: 3600 // Mantener trabajos completados por 1 hora
        },
        removeOnFail: {
          age: 86400 // Mantener trabajos fallidos por 24 horas
        }
      }
    );

    console.log(`[MigrationQueue] Job ${job.id} agregado`);
    return job;
  }

  /**
   * Agrega múltiples trabajos de migración
   */
  async addBulkMigrationJobs(
    jobs: Array<{ data: MigrationJobData; options?: MigrationQueueOptions }>
  ): Promise<Job<MigrationJobData, MigrationJobResult, string>[]> {
    const bulkJobs = jobs.map(({ data, options }) => ({
      name: 'process-migration',
      data,
      opts: {
        jobId: options?.jobId || data.jobId,
        attempts: options?.attempts || 3,
        timeout: options?.timeout || 300000
      }
    }));

    const addedJobs = await this.queue.addBulk(bulkJobs);
    console.log(`[MigrationQueue] ${addedJobs.length} trabajos agregados en lote`);
    return addedJobs;
  }

  /**
   * Obtiene trabajo por ID
   */
  async getJob(jobId: string): Promise<Job<MigrationJobData, MigrationJobResult, string> | null> {
    return this.queue.getJob(jobId);
  }

  /**
   * Obtiene estado de un trabajo
   */
  async getJobState(jobId: string): Promise<string> {
    const job = await this.queue.getJob(jobId);
    if (!job) {
      return 'unknown';
    }
    return job.getState();
  }

  /**
   * Obtiene progreso de un trabajo
   */
  async getJobProgress(jobId: string): Promise<number> {
    const job = await this.queue.getJob(jobId);
    if (!job) {
      return 0;
    }
    return job.progress as number;
  }

  /**
   * Cancela un trabajo pendiente
   */
  async cancelJob(jobId: string): Promise<void> {
    const job = await this.queue.getJob(jobId);
    if (job) {
      await job.remove();
      console.log(`[MigrationQueue] Job ${jobId} cancelado`);
    }
  }

  /**
   * Obtiene trabajos en espera
   */
  async getWaitingJobs(start = 0, end = 100): Promise<Job[]> {
    return this.queue.getWaiting(start, end);
  }

  /**
   * Obtiene trabajos activos
   */
  async getActiveJobs(start = 0, end = 100): Promise<Job[]> {
    return this.queue.getActive(start, end);
  }

  /**
   * Obtiene trabajos completados
   */
  async getCompletedJobs(start = 0, end = 100): Promise<Job[]> {
    return this.queue.getCompleted(start, end);
  }

  /**
   * Obtiene trabajos fallidos
   */
  async getFailedJobs(start = 0, end = 100): Promise<Job[]> {
    return this.queue.getFailed(start, end);
  }

  /**
   * Obtiene conteo de trabajos por estado
   */
  async getJobCounts(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  }> {
    const counts = await this.queue.getJobCounts();
    return {
      waiting: counts.waiting || 0,
      active: counts.active || 0,
      completed: counts.completed || 0,
      failed: counts.failed || 0,
      delayed: counts.delayed || 0,
      paused: counts.paused || 0
    };
  }

  /**
   * Pausa la cola
   */
  async pause(): Promise<void> {
    await this.queue.pause();
    console.log('[MigrationQueue] Cola pausada');
  }

  /**
   * Reanuda la cola
   */
  async resume(): Promise<void> {
    await this.queue.resume();
    console.log('[MigrationQueue] Cola reanudada');
  }

  /**
   * Limpia trabajos completados
   */
  async cleanCompletedJobs(age: number): Promise<string[]> {
    return this.queue.clean(age, 1000, 'completed');
  }

  /**
   * Limpia trabajos fallidos
   */
  async cleanFailedJobs(age: number): Promise<string[]> {
    return this.queue.clean(age, 1000, 'failed');
  }

  /**
   * Cierra la cola y eventos
   */
  async close(): Promise<void> {
    await this.queue.close();
    await this.queueEvents.close();
    console.log('[MigrationQueue] Cerrado');
  }

  /**
   * Obtiene información de la cola
   */
  async getQueueInfo(): Promise<{
    name: string;
    counts: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      delayed: number;
      paused: number;
    };
    isPaused: boolean;
  }> {
    const counts = await this.getJobCounts();
    const client = await this.queue.client;
    const pausedKeyExists = await client.exists(`${this.queue.keys.meta}:paused`);

    return {
      name: this.queue.name,
      counts,
      isPaused: pausedKeyExists === 1
    };
  }
}

// Singleton
let migrationQueueInstance: MigrationQueueService | null = null;

export function getMigrationQueue(redisUrl?: string): MigrationQueueService {
  if (!migrationQueueInstance) {
    const url = redisUrl || process.env.REDIS_URL || 'redis://localhost:6379';
    migrationQueueInstance = new MigrationQueueService(url);
  }
  return migrationQueueInstance;
}

// Helper para crear instancia nueva (útil para testing)
export function createMigrationQueue(redisUrl: string): MigrationQueueService {
  return new MigrationQueueService(redisUrl);
}
