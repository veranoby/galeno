/**
 * IA Brain Aggregation Job - TASK-009E
 * Batch job for analyzing patterns in AI suggestion acceptances
 * Runs nightly to update preference patterns
 */

import * as cron from 'node-cron';
import { IABrainService } from '../services/ia/brain.js';
import { logger } from '../utils/logger.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Interface for daily acceptance records from database
interface DailyAcceptanceRecord {
  doctorId: string;
  category: 'diagnostic' | 'medication' | 'exam';
  itemId: string;
  accepted: boolean;
  timestamp: Date;
}

export class IABrainAggregationJob {
  private static readonly CRON_SCHEDULE = '0 2 * * *'; // 2 AM daily
  private static task: cron.ScheduledTask | null = null;

  /**
   * Start the aggregation job
   */
  static start(): void {
    logger.info('Starting IA Brain Aggregation Job');
    
    // Schedule the job to run daily at 2 AM
    this.task = cron.schedule(this.CRON_SCHEDULE,  async () => {
      await this.runAggregation();
    }, {
      timezone: 'America/Guayaquil' // Adjust to your timezone
    });

    logger.info(`IA Brain Aggregation Job scheduled: ${this.CRON_SCHEDULE}`);
  }

  /**
   * Stop the aggregation job
   */
  static stop(): void {
    if (this.task) {
      this.task.stop();
      logger.info('IA Brain Aggregation Job stopped');
    }
  }

  /**
   * Run the aggregation process
   */
  static async runAggregation(): Promise<void> {
    const startTime = new Date();
    logger.info('Starting IA Brain aggregation process');

    try {
      // Get yesterday's date for processing
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0,  0,  0,  0);

      const tomorrow = new Date(yesterday);
      tomorrow.setDate(tomorrow.getDate() + 1);

      logger.info({
        date: yesterday.toISOString().split('T')[0],
        startTime: startTime.toISOString()
      }, 'Processing acceptances for date');

      // Get all acceptance records from the previous day
      const dailyRecords = await this.fetchDailyAcceptances(yesterday,  tomorrow);

      if (dailyRecords.length === 0) {
        logger.info('No acceptance records found for aggregation');
        return;
      }

      logger.info({ count: dailyRecords.length },  'Processing acceptance records');

      // Group records by doctor
      const recordsByDoctor = this.groupRecordsByDoctor(dailyRecords);

      // Process each doctor's records
      for (const [doctorId,  records] of recordsByDoctor.entries()) {
        await this.processDoctorRecords(doctorId,  records);
      }

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      
      logger.info({
        durationMs: duration, 
        processedDoctors: recordsByDoctor.size, 
        totalRecords: dailyRecords.length
      },  'IA Brain aggregation completed');
    } catch (error) {
      logger.error({ error: error },  'Error in IA Brain aggregation job');
    }
  }

  /**
   * Fetch daily acceptance records from database
   */
  private static async fetchDailyAcceptances(startDate: Date,  endDate: Date): Promise<DailyAcceptanceRecord[]> {
    try {
      // This assumes there's a table to store acceptance records
      // In a real implementation, you might have a specific table for tracking AI suggestion acceptances
      const records = await prisma.$queryRaw<Array<{
        doctor_id: string;
        category: string;
        item_id: string;
        accepted: boolean;
        created_at: Date;
      }>>`
        SELECT 
          doctor_id,
          category,
          item_id,
          accepted,
          created_at
        FROM ia_acceptance_log 
        WHERE created_at >= ${startDate} AND created_at < ${endDate}
        ORDER BY created_at ASC
      `;

      return records.map(record => ({
        doctorId: record.doctor_id, 
        category: record.category as 'diagnostic' | 'medication' | 'exam', 
        itemId: record.item_id, 
        accepted: record.accepted, 
        timestamp: record.created_at
      }));
    } catch (error) {
      logger.error({ error: error },  'Error fetching daily acceptance records');
      return [];
    }
  }

  /**
   * Group records by doctor
   */
  private static groupRecordsByDoctor(records: DailyAcceptanceRecord[]): Map<string, DailyAcceptanceRecord[]> {
    const grouped = new Map<string, DailyAcceptanceRecord[]>();

    for (const record of records) {
      if (!grouped.has(record.doctorId)) {
        grouped.set(record.doctorId,  []);
      }
      grouped.get(record.doctorId)!.push(record);
    }

    return grouped;
  }

  /**
   * Process records for a specific doctor
   */
  private static async processDoctorRecords(doctorId: string,  records: DailyAcceptanceRecord[]): Promise<void> {
    try {
      logger.info({ doctorId,  recordCount: records.length },  'Processing records for doctor');

      // Update preferences based on daily acceptances
      for (const record of records) {
        await IABrainService.recordAcceptance(doctorId,  {
          category: record.category, 
          itemId: record.itemId, 
          accepted: record.accepted, 
          timestamp: record.timestamp
        });
      }

      // Perform pattern analysis for this doctor
      const analysis = await IABrainService.analyzePatterns(doctorId);
      
      if (analysis) {
        logger.info({
          doctorId, 
          patternCount: analysis.patterns.mostUsed.diagnostics.length +
                       analysis.patterns.mostUsed.medications.length +
                       analysis.patterns.mostUsed.exams.length, 
          recommendationCount: analysis.patterns.recommendations.length
        },  'Pattern analysis completed for doctor');
        
        // Optionally, store the analysis results for reporting purposes
        await this.storeAnalysisResults(analysis);
      }
    } catch (error) {
      logger.error({ doctorId,  error },  'Error processing doctor records');
    }
  }

  /**
   * Store analysis results for reporting
   */
  private static async storeAnalysisResults(analysis: any): Promise<void> {
    try {
      // In a real implementation, you might store analysis results in a database
      // for reporting and monitoring purposes
      await prisma.iaBrainAnalysis.create({
        data: {
          doctorId: analysis.doctorId, 
          analysisDate: analysis.analyzedAt, 
          patterns: analysis.patterns, 
          createdAt: new Date()
        }
      });
    } catch (error) {
      logger.error({ error: error },  'Error storing analysis results');
    }
  }

  /**
   * Run aggregation for a specific date range (for testing or manual runs)
   */
  static async runForDateRange(startDate: Date,  endDate: Date): Promise<void> {
    logger.info({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    }, 'Running aggregation for custom date range');

    // This would be similar to runAggregation but for a custom date range
    // Implementation would be similar to runAggregation but with passed dates
    const dailyRecords = await this.fetchDailyAcceptances(startDate,  endDate);

    if (dailyRecords.length === 0) {
      logger.info('No acceptance records found for custom date range');
      return;
    }

    logger.info({ count: dailyRecords.length },  'Processing acceptance records for custom range');

    const recordsByDoctor = this.groupRecordsByDoctor(dailyRecords);

    for (const [doctorId,  records] of recordsByDoctor.entries()) {
      await this.processDoctorRecords(doctorId,  records);
    }
  }
}

// Export the service for direct usage if needed
export const iaBrainAggregationService = IABrainAggregationJob;