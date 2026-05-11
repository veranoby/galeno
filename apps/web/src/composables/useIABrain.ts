/**
 * IA Brain Composable - TASK-009E
 * Vue composable for interacting with IA Brain service
 */

import { ref, reactive } from 'vue';
import { iaBrainApi } from '../../services/ai/brain.client.js';
import type { BrainPreferences, PatternAnalysisResult } from '../../../../api/src/services/ia/brain.types.js';

export interface IABrainState {
  preferences: BrainPreferences | null;
  summary: any | null;
  topDiagnostics: any[];
  topMedications: any[];
  topExams: any[];
  recentAcceptances: any[];
  patterns: PatternAnalysisResult | null;
  isLoading: boolean;
  error: string | null;
}

export function useIABrain() {
  const state = reactive<IABrainState>({
    preferences: null,
    summary: null,
    topDiagnostics: [],
    topMedications: [],
    topExams: [],
    recentAcceptances: [],
    patterns: null,
    isLoading: false,
    error: null
  });

  /**
   * Load all brain data
   */
  const loadBrainData = async (): Promise<void> => {
    state.isLoading = true;
    state.error = null;

    try {
      // Load preferences
      await loadPreferences();
      
      // Load summary
      await loadSummary();
      
      // Load top items
      await loadTopItems();
      
      // Load recent acceptances
      await loadRecentAcceptances();
      
      // Load patterns
      await loadPatterns();
    } catch (error) {
      state.error = error.message || 'Unknown error occurred';
      console.error('Error loading brain data:', error);
    } finally {
      state.isLoading = false;
    }
  };

  /**
   * Load preferences
   */
  const loadPreferences = async (): Promise<void> => {
    try {
      const result = await iaBrainApi.getPreferences();
      
      if (result.success) {
        state.preferences = result.data;
      } else {
        throw new Error(result.error || 'Failed to load preferences');
      }
    } catch (error) {
      state.error = error.message;
      console.error('Error loading preferences:', error);
    }
  };

  /**
   * Load summary
   */
  const loadSummary = async (): Promise<void> => {
    try {
      const result = await iaBrainApi.getSummary();
      
      if (result.success) {
        state.summary = result.data;
      } else {
        throw new Error(result.error || 'Failed to load summary');
      }
    } catch (error) {
      state.error = error.message;
      console.error('Error loading summary:', error);
    }
  };

  /**
   * Load top items for all categories
   */
  const loadTopItems = async (): Promise<void> => {
    try {
      // Load top diagnostics
      const diagnosticsResult = await iaBrainApi.getTopItems('diagnostics');
      if (diagnosticsResult.success) {
        state.topDiagnostics = diagnosticsResult.data || [];
      }

      // Load top medications
      const medicationsResult = await iaBrainApi.getTopItems('medications');
      if (medicationsResult.success) {
        state.topMedications = medicationsResult.data || [];
      }

      // Load top exams
      const examsResult = await iaBrainApi.getTopItems('exams');
      if (examsResult.success) {
        state.topExams = examsResult.data || [];
      }
    } catch (error) {
      state.error = error.message;
      console.error('Error loading top items:', error);
    }
  };

  /**
   * Load recent acceptances
   */
  const loadRecentAcceptances = async (): Promise<void> => {
    try {
      const result = await iaBrainApi.getRecentAcceptances();
      
      if (result.success) {
        state.recentAcceptances = result.data || [];
      } else {
        throw new Error(result.error || 'Failed to load recent acceptances');
      }
    } catch (error) {
      state.error = error.message;
      console.error('Error loading recent acceptances:', error);
    }
  };

  /**
   * Load pattern analysis
   */
  const loadPatterns = async (): Promise<void> => {
    try {
      const result = await iaBrainApi.getPatterns();
      
      if (result.success) {
        state.patterns = result.data;
      } else {
        throw new Error(result.error || 'Failed to load patterns');
      }
    } catch (error) {
      state.error = error.message;
      console.error('Error loading patterns:', error);
    }
  };

  /**
   * Record an acceptance of an AI suggestion
   */
  const recordAcceptance = async (category: 'diagnostic' | 'medication' | 'exam', itemId: string, accepted: boolean): Promise<boolean> => {
    try {
      const result = await iaBrainApi.recordAcceptance({ category, itemId, accepted });
      
      if (result.success) {
        // Reload relevant data after recording acceptance
        await loadPreferences();
        await loadRecentAcceptances();
        return true;
      } else {
        throw new Error(result.error || 'Failed to record acceptance');
      }
    } catch (error) {
      state.error = error.message;
      console.error('Error recording acceptance:', error);
      return false;
    }
  };

  /**
   * Update a preference directly
   */
  const updatePreference = async (
    category: 'diagnostics' | 'medications' | 'exams',
    itemId: string,
    action: 'increment' | 'decrement'
  ): Promise<boolean> => {
    try {
      const result = await iaBrainApi.updatePreference({ category, itemId, action });
      
      if (result.success) {
        // Reload preferences after updating
        await loadPreferences();
        return true;
      } else {
        throw new Error(result.error || 'Failed to update preference');
      }
    } catch (error) {
      state.error = error.message;
      console.error('Error updating preference:', error);
      return false;
    }
  };

  /**
   * Get top items for a specific category
   */
  const getTopItems = async (category: 'diagnostics' | 'medications' | 'exams', limit: number = 10): Promise<any[]> => {
    try {
      const result = await iaBrainApi.getTopItems(category, limit);
      
      if (result.success) {
        return result.data || [];
      } else {
        throw new Error(result.error || `Failed to load top ${category}`);
      }
    } catch (error) {
      state.error = error.message;
      console.error(`Error loading top ${category}:`, error);
      return [];
    }
  };

  /**
   * Get items by category from preferences
   */
  const getItemsByCategory = (category: 'diagnostics' | 'medications' | 'exams'): any[] => {
    if (!state.preferences) return [];
    
    switch (category) {
      case 'diagnostics':
        return state.preferences.diagnostics.topCodes;
      case 'medications':
        return state.preferences.medications.topMeds;
      case 'exams':
        return state.preferences.exams.topExams;
      default:
        return [];
    }
  };

  /**
   * Get recommendations from patterns
   */
  const getRecommendations = (): any[] => {
    if (!state.patterns) return [];
    return state.patterns.patterns.recommendations;
  };

  /**
   * Get trending items
   */
  const getTrendingItems = (): { increasing: string[], decreasing: string[] } => {
    if (!state.patterns) return { increasing: [], decreasing: [] };
    return state.patterns.patterns.trends;
  };

  return {
    // State
    state,
    
    // Methods
    loadBrainData,
    loadPreferences,
    loadSummary,
    loadTopItems,
    loadRecentAcceptances,
    loadPatterns,
    recordAcceptance,
    updatePreference,
    getTopItems,
    getItemsByCategory,
    getRecommendations,
    getTrendingItems
  };
}