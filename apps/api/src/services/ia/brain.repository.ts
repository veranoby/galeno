/**
 * IA Brain Repository - TASK-009E
 * Redis-based repository for managing AI preferences
 */

import { IAPreferencesCache } from '../cache/redis.js';
import { IABrainData, AcceptanceRecord, PreferenceUpdate, BrainPreferences } from './brain.types.js';
import { logger } from '../../utils/logger.js';

export class IABrainRepository {
  /**
   * Get brain preferences for a doctor
   */
  static async getBrainData(doctorId: string): Promise<IABrainData | null> {
    try {
      const cached = await IAPreferencesCache.getPreferences(doctorId);
      
      if (!cached) {
        return null;
      }

      // Convertir las fechas de string a Date si es necesario
      const brainData = cached as unknown as IABrainData;
      
      // Parse dates
      if (brainData.lastUpdated && typeof brainData.lastUpdated === 'string') {
        brainData.lastUpdated = new Date(brainData.lastUpdated);
      }

      // Parse dates in preferences
      if (brainData.preferences) {
        if (brainData.preferences.diagnostics.topCodes) {
          brainData.preferences.diagnostics.topCodes = brainData.preferences.diagnostics.topCodes.map(item => ({
            ...item, 
            lastUsed: typeof item.lastUsed === 'string' ? new Date(item.lastUsed) : item.lastUsed
          }));
        }

        if (brainData.preferences.medications.topMeds) {
          brainData.preferences.medications.topMeds = brainData.preferences.medications.topMeds.map(item => ({
            ...item, 
            lastUsed: typeof item.lastUsed === 'string' ? new Date(item.lastUsed) : item.lastUsed
          }));
        }

        if (brainData.preferences.exams.topExams) {
          brainData.preferences.exams.topExams = brainData.preferences.exams.topExams.map(item => ({
            ...item, 
            lastUsed: typeof item.lastUsed === 'string' ? new Date(item.lastUsed) : item.lastUsed
          }));
        }
      }

      // Parse dates in recent acceptances
      if (brainData.recentAcceptances) {
        brainData.recentAcceptances = brainData.recentAcceptances.map(acc => ({
          ...acc, 
          timestamp: typeof acc.timestamp === 'string' ? new Date(acc.timestamp) : acc.timestamp
        }));
      }

      return brainData;
    } catch (error) {
      logger.error({ doctorId,  error },  'Error getting brain data from cache');
      return null;
    }
  }

  /**
   * Save brain preferences for a doctor
   */
  static async saveBrainData(doctorId: string,  brainData: IABrainData): Promise<boolean> {
    try {
      // Ensure dates are properly serialized
      const serializedData = {
        ...brainData,
        lastUpdated: brainData.lastUpdated.toISOString(),
        preferences: {
          diagnostics: {
            ...brainData.preferences.diagnostics,
            topCodes: brainData.preferences.diagnostics.topCodes.map(item => ({
              ...item, 
              lastUsed: item.lastUsed.toISOString()
            }))
          },
          medications: {
            ...brainData.preferences.medications,
            topMeds: brainData.preferences.medications.topMeds.map(item => ({
              ...item, 
              lastUsed: item.lastUsed.toISOString()
            })),
            preferredDoses: brainData.preferences.medications.preferredDoses
          },
          exams: {
            ...brainData.preferences.exams,
            topExams: brainData.preferences.exams.topExams.map(item => ({
              ...item, 
              lastUsed: item.lastUsed.toISOString()
            }))
          }
        },
        recentAcceptances: brainData.recentAcceptances.map(acc => ({
          ...acc, 
          timestamp: acc.timestamp.toISOString()
        }))
      };

      return await IAPreferencesCache.setPreferences(doctorId,  serializedData);
    } catch (error) {
      logger.error({ doctorId,  error },  'Error saving brain data to cache');
      return false;
    }
  }

  /**
   * Initialize brain data for a doctor
   */
  static async initializeBrainData(doctorId: string): Promise<IABrainData> {
    const initialData: IABrainData = {
      doctorId,
      lastUpdated: new Date(),
      preferences: {
        diagnostics: {
          topCodes: [],
          specialties: []
        },
        medications: {
          topMeds: [],
          preferredDoses: {}
        },
        exams: {
          topExams: []
        }
      },
      recentAcceptances: []
    };

    await this.saveBrainData(doctorId,  initialData);
    return initialData;
  }

  /**
   * Add an acceptance record
   */
  static async addAcceptanceRecord(doctorId: string,  record: AcceptanceRecord): Promise<boolean> {
    try {
      let brainData = await this.getBrainData(doctorId);
      
      if (!brainData) {
        brainData = await this.initializeBrainData(doctorId);
      }

      // Add the new acceptance record
      brainData.recentAcceptances.push(record);

      // Keep only the last 100 records
      if (brainData.recentAcceptances.length > 100) {
        brainData.recentAcceptances = brainData.recentAcceptances.slice(-100);
      }

      // Update preferences based on the acceptance
      await this.updatePreferencesFromAcceptance(brainData,  record);

      brainData.lastUpdated = new Date();
      
      return await this.saveBrainData(doctorId,  brainData);
    } catch (error) {
      logger.error({ doctorId,  error },  'Error adding acceptance record');
      return false;
    }
  }

  /**
   * Update preferences based on an acceptance record
   */
  private static async updatePreferencesFromAcceptance(
    brainData: IABrainData, 
    record: AcceptanceRecord
  ): Promise<void> {
    const { category, itemId, accepted } = record;
    
    if (!accepted) return; // Only update for accepted suggestions

    const action: 'increment' | 'decrement' = accepted ? 'increment' : 'decrement';
    
    switch (category) {
      case 'diagnostic':
        await this.updateDiagnosticPreference(brainData,  itemId,  action);
        break;
      case 'medication':
        await this.updateMedicationPreference(brainData,  itemId,  action);
        break;
      case 'exam':
        await this.updateExamPreference(brainData,  itemId,  action);
        break;
    }
  }

  /**
   * Update diagnostic preference
   */
  private static async updateDiagnosticPreference(
    brainData: IABrainData, 
    code: string, 
    action: 'increment' | 'decrement'
  ): Promise<void> {
    const index = brainData.preferences.diagnostics.topCodes.findIndex(item => item.code === code);
    
    if (index !== -1) {
      // Update existing
      const item = brainData.preferences.diagnostics.topCodes[index];
      item.count = action === 'increment' ? item.count + 1 : Math.max(0,  item.count - 1);
      item.lastUsed = new Date();
    } else if (action === 'increment') {
      // Add new
      brainData.preferences.diagnostics.topCodes.push({
        code, 
        count: 1, 
        lastUsed: new Date()
      });
    }

    // Sort by count descending and keep top 20
    brainData.preferences.diagnostics.topCodes.sort((a,  b) => b.count - a.count);
    brainData.preferences.diagnostics.topCodes = brainData.preferences.diagnostics.topCodes.slice(0,  20);
  }

  /**
   * Update medication preference
   */
  private static async updateMedicationPreference(
    brainData: IABrainData, 
    medicationName: string, 
    action: 'increment' | 'decrement'
  ): Promise<void> {
    const index = brainData.preferences.medications.topMeds.findIndex(item => item.name === medicationName);
    
    if (index !== -1) {
      // Update existing
      const item = brainData.preferences.medications.topMeds[index];
      item.count = action === 'increment' ? item.count + 1 : Math.max(0,  item.count - 1);
      item.lastUsed = new Date();
    } else if (action === 'increment') {
      // Add new
      brainData.preferences.medications.topMeds.push({
        name: medicationName, 
        count: 1, 
        lastUsed: new Date()
      });
    }

    // Sort by count descending and keep top 20
    brainData.preferences.medications.topMeds.sort((a,  b) => b.count - a.count);
    brainData.preferences.medications.topMeds = brainData.preferences.medications.topMeds.slice(0,  20);
  }

  /**
   * Update exam preference
   */
  private static async updateExamPreference(
    brainData: IABrainData, 
    examName: string, 
    action: 'increment' | 'decrement'
  ): Promise<void> {
    const index = brainData.preferences.exams.topExams.findIndex(item => item.name === examName);
    
    if (index !== -1) {
      // Update existing
      const item = brainData.preferences.exams.topExams[index];
      item.count = action === 'increment' ? item.count + 1 : Math.max(0,  item.count - 1);
      item.lastUsed = new Date();
    } else if (action === 'increment') {
      // Add new
      brainData.preferences.exams.topExams.push({
        name: examName, 
        count: 1, 
        lastUsed: new Date()
      });
    }

    // Sort by count descending and keep top 20
    brainData.preferences.exams.topExams.sort((a,  b) => b.count - a.count);
    brainData.preferences.exams.topExams = brainData.preferences.exams.topExams.slice(0,  20);
  }

  /**
   * Update preference directly
   */
  static async updatePreference(doctorId: string,  update: PreferenceUpdate): Promise<boolean> {
    try {
      let brainData = await this.getBrainData(doctorId);
      
      if (!brainData) {
        brainData = await this.initializeBrainData(doctorId);
      }

      switch (update.category) {
        case 'diagnostics':
          await this.updateDiagnosticPreference(brainData,  update.itemId,  update.action);
          break;
        case 'medications':
          await this.updateMedicationPreference(brainData,  update.itemId,  update.action);
          break;
        case 'exams':
          await this.updateExamPreference(brainData,  update.itemId,  update.action);
          break;
      }

      brainData.lastUpdated = new Date();
      
      return await this.saveBrainData(doctorId,  brainData);
    } catch (error) {
      logger.error({ doctorId,  error },  'Error updating preference');
      return false;
    }
  }

  /**
   * Get preferences for a doctor
   */
  static async getPreferences(doctorId: string): Promise<BrainPreferences | null> {
    const brainData = await this.getBrainData(doctorId);
    return brainData ? brainData.preferences : null;
  }

  /**
   * Clear brain data for a doctor
   */
  static async clearBrainData(doctorId: string): Promise<boolean> {
    try {
      return await IAPreferencesCache.setPreferences(doctorId,  {});
    } catch (error) {
      logger.error({ doctorId,  error },  'Error clearing brain data');
      return false;
    }
  }
}