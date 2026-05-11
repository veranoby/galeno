import { defineStore } from 'pinia';
import { apiClient } from '@/services/api';

export const useAuditStore = defineStore('audit', {
  state: () => ({
    auditLogs: [] as any[],
    loading: false,
    error: null as string | null,
    summary: {
      totalEvents: 0,
      todayEvents: 0,
      activeUsers: 0,
      alerts: 0
    }
  }),

  actions: {
    async getAuditLogs(filters: {
      userId?: string;
      action?: string;
      resourceType?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    }) {
      try {
        this.loading = true;
        this.error = null;
        
        const params = new URLSearchParams();
        if (filters.userId) params.append('userId', filters.userId);
        if (filters.action) params.append('action', filters.action);
        if (filters.resourceType) params.append('resourceType', filters.resourceType);
        if (filters.startDate) params.append('startDate', filters.startDate);
        if (filters.endDate) params.append('endDate', filters.endDate);
        if (filters.limit) params.append('limit', filters.limit.toString());
        if (filters.offset) params.append('offset', filters.offset.toString());
        
        const response = await apiClient.get(`/audit/logs?${params.toString()}`);
        
        const data = response.data as any;
        this.auditLogs = data.logs;
        this.summary.totalEvents = data.totalCount;
        
        return data;
      } catch (error: any) {
        this.error = error.message || 'Error fetching audit logs';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async getUserAuditLogs(userId: string, limit: number = 50, offset: number = 0) {
      try {
        this.loading = true;
        this.error = null;
        
        const response = await apiClient.get(`/audit/user/${userId}?limit=${limit}&offset=${offset}`);
        
        const data = response.data as any;
        this.auditLogs = data.logs;
        
        return data;
      } catch (error: any) {
        this.error = error.message || 'Error fetching user audit logs';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async getResourceAuditLogs(resourceType: string, resourceId: string, limit: number = 50, offset: number = 0) {
      try {
        this.loading = true;
        this.error = null;
        
        const response = await apiClient.get(`/audit/resource/${resourceType}/${resourceId}?limit=${limit}&offset=${offset}`);
        
        const data = response.data as any;
        this.auditLogs = data.logs;
        
        return data;
      } catch (error: any) {
        this.error = error.message || 'Error fetching resource audit logs';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async getActionAuditLogs(action: string, limit: number = 50, offset: number = 0) {
      try {
        this.loading = true;
        this.error = null;
        
        const response = await apiClient.get(`/audit/action/${action}?limit=${limit}&offset=${offset}`);
        
        const data = response.data as any;
        this.auditLogs = data.logs;
        
        return data;
      } catch (error: any) {
        this.error = error.message || 'Error fetching action audit logs';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async getAuditSummary() {
      try {
        this.loading = true;
        this.error = null;
        
        // In a real implementation, we would call an API to get summary data
        // For now, we'll return the local summary data
        return this.summary;
      } catch (error: any) {
        this.error = error.message || 'Error fetching audit summary';
        throw error;
      } finally {
        this.loading = false;
      }
    }
  },
  persist: true
});