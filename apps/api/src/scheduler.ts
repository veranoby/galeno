/**
 * Scheduler Module - TASK-009E
 * Centralized scheduler for all cron jobs
 */

import { IABrainAggregationJob } from './jobs/ia-brain-aggregation.js';
import { iniciarCitaReminderJob } from './jobs/cita-reminder.job.js';
import { logger } from './utils/logger.js';

export class Scheduler {
  private static citaReminderJob: any;

  /**
   * Initialize all scheduled jobs
   */
  static async initialize(): Promise<void> {
    logger.info('Initializing scheduler...');

    try {
      // Initialize IA Brain Aggregation Job
      IABrainAggregationJob.start();
      logger.info('✅ IA Brain Aggregation Job initialized');

      // Initialize Cita Reminder Job (daily at 8 AM)
      Scheduler.citaReminderJob = iniciarCitaReminderJob();
      logger.info('✅ Cita Reminder Job initialized');

      // Add other scheduled jobs here as needed

      logger.info('🎉 All scheduled jobs initialized successfully');
    } catch (error) {
      logger.error({ error },  'Failed to initialize scheduler');
      throw error;
    }
  }

  /**
   * Shutdown all scheduled jobs
   */
  static async shutdown(): Promise<void> {
    logger.info('Shutting down scheduled jobs...');

    // Stop IA Brain Aggregation Job
    IABrainAggregationJob.stop();
    logger.info('✅ IA Brain Aggregation Job stopped');

    // Stop Cita Reminder Job
    if (Scheduler.citaReminderJob) {
      Scheduler.citaReminderJob.stop();
      logger.info('✅ Cita Reminder Job stopped');
    }

    // Stop other scheduled jobs here as needed

    logger.info('🎉 All scheduled jobs stopped');
  }
}

// Handle graceful shutdown
process.on('SIGTERM',  async () => {
  logger.info('Received SIGTERM,  shutting down gracefully...');
  await Scheduler.shutdown();
  process.exit(0);
});

process.on('SIGINT',  async () => {
  logger.info('Received SIGINT,  shutting down gracefully...');
  await Scheduler.shutdown();
  process.exit(0);
});