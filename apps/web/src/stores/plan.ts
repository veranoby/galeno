import { defineStore } from 'pinia';
import { apiClient } from '@/services/api';

export const usePlanStore = defineStore('plan', {
  state: () => ({
    currentPlan: null as any,
    availablePlans: [] as any[],
    loading: false,
    error: null as string | null,
  }),

  getters: {
    isPremium: (state) => state.currentPlan?.plan === 'PREMIUM',
    isClinicaSME: (state) => state.currentPlan?.plan === 'CLINICA_SME',
    isFree: (state) => state.currentPlan?.plan === 'FREE',
    hasPlan: (state) => !!state.currentPlan,
  },

  actions: {
    async getCurrentPlan() {
      try {
        this.loading = true;
        this.error = null;
        
        const response = await apiClient.get('/plan/current');
        this.currentPlan = response.data;
        
        return response.data;
      } catch (error: any) {
        this.error = error.message || 'Error fetching current plan';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async getAvailablePlans() {
      try {
        this.loading = true;
        this.error = null;
        
        const response = await apiClient.get('/plan/available');
        const data = response.data as any;
        this.availablePlans = data.plans;
        
        return data;
      } catch (error: any) {
        this.error = error.message || 'Error fetching available plans';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async changePlan(planData: { plan: string; customLimits?: any }) {
      try {
        this.loading = true;
        this.error = null;
        
        const response = await apiClient.post('/plan/change', planData);
        
        // Update current plan after successful change
        await this.getCurrentPlan();
        
        return response.data;
      } catch (error: any) {
        this.error = error.message || 'Error changing plan';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    // Check if user can perform an action based on their plan
    canPerformAction(action: string): boolean {
      if (!this.currentPlan) return false;

      const features = this.currentPlan.config.caracteristicas;
      
      // Define feature mappings
      const featureMap: Record<string, keyof typeof features> = {
        'interconsultas': 'tieneInterconsultas',
        'telemedicina': 'tieneTeleconsultas',
        'health_wallet': 'tieneHealthWallet',
        'integracion_sri': 'tieneSRIIntegracion',
        'ia_asistente': 'tieneIAAsistente',
        'soporte_prioridad': 'tieneSoportePrioridad'
      };

      const featureKey = featureMap[action];
      return featureKey ? features[featureKey] : false;
    }
  },
  persist: true
});