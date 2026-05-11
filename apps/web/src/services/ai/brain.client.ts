/**
 * IA Brain API Client - TASK-009E
 * Frontend API client for IA Brain service
 */

import type { 
  BrainPreferences, 
  AcceptanceRecord, 
  PatternAnalysisResult 
} from '../../../api/src/services/ia/brain.types.js';

export interface TopItem {
  code?: string;
  name?: string;
  count: number;
  lastUsed: string;
}

export interface RecentAcceptance {
  category: 'diagnostic' | 'medication' | 'exam';
  itemId: string;
  accepted: boolean;
  timestamp: string;
}

class IABrainApiClient {
  private baseUrl: string;
  
  constructor() {
    this.baseUrl = `${import.meta.env.VITE_API_URL || '/api'}`;
  }

  /**
   * Get doctor's AI preferences
   */
  async getPreferences(): Promise<{ success: boolean; data?: BrainPreferences; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/ia/brain/preferences`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error fetching preferences:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get brain data summary
   */
  async getSummary(): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/ia/brain/summary`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error fetching summary:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Record an acceptance of an AI suggestion
   */
  async recordAcceptance(record: Omit<AcceptanceRecord, 'timestamp'>): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/ia/brain/acceptance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          ...record,
          timestamp: new Date().toISOString()
        })
      });

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error recording acceptance:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get top items by category
   */
  async getTopItems(category: 'diagnostics' | 'medications' | 'exams', limit: number = 10): Promise<{ success: boolean; data?: TopItem[]; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/ia/brain/top-items/${category}?limit=${limit}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error fetching top items:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get recent acceptances
   */
  async getRecentAcceptances(limit: number = 50): Promise<{ success: boolean; data?: RecentAcceptance[]; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/ia/brain/recent-acceptances?limit=${limit}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error fetching recent acceptances:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get pattern analysis
   */
  async getPatterns(): Promise<{ success: boolean; data?: PatternAnalysisResult; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/ia/brain/patterns`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error fetching patterns:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update a preference directly
   */
  async updatePreference(params: {
    category: 'diagnostics' | 'medications' | 'exams';
    itemId: string;
    action: 'increment' | 'decrement';
    metadata?: Record<string, unknown>;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/ia/brain/preferences/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(params)
      });

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error updating preference:', error);
      return { success: false, error: error.message };
    }
  }
}

export const iaBrainApi = new IABrainApiClient();