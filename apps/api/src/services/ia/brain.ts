/**
 * IA Brain Service - TASK-009E
 * Core service for managing AI preference learning system
 */

import { IABrainData, AcceptanceRecord, PreferenceUpdate, BrainPreferences, PatternAnalysisResult } from './brain.types.js';
import { IABrainRepository } from './brain.repository.js';
import { logger } from '../../utils/logger.js';

export class IABrainService {
  /**
   * Get brain preferences for a doctor
   */
  static async getPreferences(doctorId: string): Promise<BrainPreferences | null> {
    return await IABrainRepository.getPreferences(doctorId);
  }

  /**
   * Record an acceptance of an AI suggestion
   */
  static async recordAcceptance(doctorId: string,  record: AcceptanceRecord): Promise<boolean> {
    try {
      const success = await IABrainRepository.addAcceptanceRecord(doctorId,  record);
      
      if (success) {
        logger.info({
          doctorId, 
          category: record.category, 
          itemId: record.itemId, 
          accepted: record.accepted
        },  'AI suggestion acceptance recorded');
      }
      
      return success;
    } catch (error) {
      logger.error({ doctorId,  record,  error },  'Error recording acceptance');
      return false;
    }
  }

  /**
   * Update a preference directly
   */
  static async updatePreference(doctorId: string,  update: PreferenceUpdate): Promise<boolean> {
    try {
      const success = await IABrainRepository.updatePreference(doctorId,  update);
      
      if (success) {
        logger.info({
          doctorId, 
          category: update.category, 
          itemId: update.itemId, 
          action: update.action
        },  'Preference updated');
      }
      
      return success;
    } catch (error) {
      logger.error({ doctorId,  update,  error },  'Error updating preference');
      return false;
    }
  }

  /**
   * Get recent acceptances for a doctor
   */
  static async getRecentAcceptances(doctorId: string,  limit: number = 50): Promise<AcceptanceRecord[]> {
    try {
      const brainData = await IABrainRepository.getBrainData(doctorId);
      
      if (!brainData) {
        return [];
      }

      // Return the most recent acceptances, limited by the specified amount
      return brainData.recentAcceptances
        .sort((a,  b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0,  limit);
    } catch (error) {
      logger.error({ doctorId,  error },  'Error getting recent acceptances');
      return [];
    }
  }

  /**
   * Get top items by category
   */
  static async getTopItems(
    doctorId: string, 
    category: 'diagnostics' | 'medications' | 'exams', 
    limit: number = 10
  ): Promise<Array<{ code?: string; name?: string; count: number; lastUsed: Date }>> {
    try {
      const preferences = await IABrainRepository.getPreferences(doctorId);
      
      if (!preferences) {
        return [];
      }

      switch (category) {
        case 'diagnostics':
          return preferences.diagnostics.topCodes
            .sort((a,  b) => b.count - a.count)
            .slice(0,  limit);
        case 'medications':
          return preferences.medications.topMeds
            .sort((a,  b) => b.count - a.count)
            .slice(0,  limit);
        case 'exams':
          return preferences.exams.topExams
            .sort((a,  b) => b.count - a.count)
            .slice(0,  limit);
        default:
          return [];
      }
    } catch (error) {
      logger.error({ doctorId,  category,  error },  'Error getting top items');
      return [];
    }
  }

  /**
   * Get brain data summary for a doctor
   */
  static async getBrainSummary(doctorId: string): Promise<Omit<IABrainData, 'recentAcceptances'> | null> {
    try {
      const brainData = await IABrainRepository.getBrainData(doctorId);
      
      if (!brainData) {
        return null;
      }

      // Return brain data without the full acceptance history to reduce payload
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { recentAcceptances, ...summary } = brainData;
      return summary;
    } catch (error) {
      logger.error({ doctorId,  error },  'Error getting brain summary');
      return null;
    }
  }

  /**
   * Perform pattern analysis on the collected data
   */
  static async analyzePatterns(doctorId: string): Promise<PatternAnalysisResult | null> {
    try {
      const brainData = await IABrainRepository.getBrainData(doctorId);
      
      if (!brainData) {
        return null;
      }

      // Analyze most used items
      const mostUsed = {
        diagnostics: brainData.preferences.diagnostics.topCodes
          .sort((a,  b) => b.count - a.count)
          .slice(0,  5)
          .map(item => item.code),
        medications: brainData.preferences.medications.topMeds
          .sort((a,  b) => b.count - a.count)
          .slice(0,  5)
          .map(item => item.name),
        exams: brainData.preferences.exams.topExams
          .sort((a,  b) => b.count - a.count)
          .slice(0,  5)
          .map(item => item.name)
      };

      // Analyze trends (simplified - in a real implementation,  you'd look at temporal patterns)
      const recentAcceptances = brainData.recentAcceptances
        .sort((a,  b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0,  30); // Last 30 acceptances

      // Find items that appear frequently in recent acceptances
      const recentCounts: Record<string, number> = {};
      recentAcceptances.forEach(acc => {
        if (acc.accepted) {
          recentCounts[acc.itemId] = (recentCounts[acc.itemId] || 0) + 1;
        }
      });

      // Compare recent usage vs overall usage to identify trends
      const increasing: string[] = [];
      const decreasing: string[] = [];

      // For simplicity, we'll just identify items that appear more in recent data
      // compared to their overall frequency
      Object.entries(recentCounts).forEach(([itemId,  recentCount]) => {
        // Calculate overall count
        const overallCount = brainData.recentAcceptances.filter(acc => 
          acc.itemId === itemId && acc.accepted
        ).length;

        // If recent count represents a higher proportion of recent activity than overall
        const recentRatio = recentCount / recentAcceptances.length;
        const overallRatio = overallCount / brainData.recentAcceptances.length;

        if (recentRatio > overallRatio * 1.5) { // 50% higher than average
          increasing.push(itemId);
        } else if (recentRatio < overallRatio * 0.5) { // 50% lower than average
          decreasing.push(itemId);
        }
      });

      // Generate recommendations based on patterns
      const recommendations = this.generateRecommendations(brainData,  increasing,  decreasing);

      return {
        doctorId,
        patterns: {
          mostUsed,
          trends: {
            increasing: increasing.slice(0,  5),
            decreasing: decreasing.slice(0,  5)
          },
          recommendations
        },
        analyzedAt: new Date()
      };
    } catch (error) {
      logger.error({ doctorId,  error },  'Error analyzing patterns');
      return null;
    }
  }

  /**
   * Generate recommendations based on patterns
   */
  private static generateRecommendations(
    brainData: IABrainData, 
    increasing: string[], 
    decreasing: string[]
  ): Array<{
    category: 'diagnostic' | 'medication' | 'exam';
    item: string;
    confidence: number;
    reason: string;
  }> {
    const recommendations: Array<{
      category: 'diagnostic' | 'medication' | 'exam';
      item: string;
      confidence: number;
      reason: string;
    }> = [];

    // Recommend items that are trending up
    increasing.slice(0,  3).forEach(itemId => {
      // Determine category based on which preference list contains this item
      let category: 'diagnostic' | 'medication' | 'exam' | null = null;
      
      if (brainData.preferences.diagnostics.topCodes.some(d => d.code === itemId)) {
        category = 'diagnostic';
      } else if (brainData.preferences.medications.topMeds.some(m => m.name === itemId)) {
        category = 'medication';
      } else if (brainData.preferences.exams.topExams.some(e => e.name === itemId)) {
        category = 'exam';
      }

      if (category) {
        recommendations.push({
          category, 
          item: itemId, 
          confidence: 0.8,  // High confidence for trending items
          reason: 'Item showing increasing usage trend'
        });
      }
    });

    // Recommend items from top lists that aren't in decreasing trend
    const topDiagnostics = brainData.preferences.diagnostics.topCodes
      .filter(d => !decreasing.includes(d.code))
      .slice(0,  2);
    
    topDiagnostics.forEach(diag => {
      recommendations.push({
        category: 'diagnostic', 
        item: diag.code, 
        confidence: 0.7, 
        reason: 'Based on historical usage patterns'
      });
    });

    const topMedications = brainData.preferences.medications.topMeds
      .filter(m => !decreasing.includes(m.name))
      .slice(0,  2);
    
    topMedications.forEach(med => {
      recommendations.push({
        category: 'medication', 
        item: med.name, 
        confidence: 0.7, 
        reason: 'Based on historical usage patterns'
      });
    });

    const topExams = brainData.preferences.exams.topExams
      .filter(e => !decreasing.includes(e.name))
      .slice(0,  2);
    
    topExams.forEach(exam => {
      recommendations.push({
        category: 'exam', 
        item: exam.name, 
        confidence: 0.7, 
        reason: 'Based on historical usage patterns'
      });
    });

    return recommendations;
  }

  /**
   * Clear brain data for a doctor (for privacy compliance)
   */
  static async clearBrainData(doctorId: string): Promise<boolean> {
    try {
      const success = await IABrainRepository.clearBrainData(doctorId);
      
      if (success) {
        logger.info({ doctorId },  'Brain data cleared');
      }
      
      return success;
    } catch (error) {
      logger.error({ doctorId,  error },  'Error clearing brain data');
      return false;
    }
  }
}