import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import * as Sentry from '@sentry/vue';
import apiClient from '@/services/api';

/**
 * Teleconsulta session data structure
 */
export interface TeleconsultaSession {
  citaId: string;
  doctorId: string;
  pacienteId: string;
  startTime: number;
  endTime?: number;
  duration: number; // seconds
  latencySamples: number[]; // ms
  jitterSamples: number[]; // ms
  reconnectionCount: number;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'critical';
}

/**
 * SSE Connection metrics
 */
export interface SSEConnectionMetrics {
  userId: string;
  connectedAt: number;
  lastHeartbeat: number;
  latency: number; // ms
  jitter: number; // ms
  reconnectionCount: number;
  reconnectionTimestamps: number[];
  isSilentDisconnection: boolean;
}

/**
 * Aggregated metrics for dashboard
 */
export interface AggregatedMetrics {
  totalActiveConnections: number;
  totalSessions: number;
  avgLatency: number;
  avgJitter: number;
  avgDuration: number;
  totalReconnections: number;
  silentDisconnections: number;
  connectionQualityDistribution: Record<string, number>;
}

/**
 * SSE Status overview
 */
export interface SSEStatus {
  activeConnections: number;
  connectedUsers: string[];
  healthyConnections: number;
  silentDisconnections: number;
  timestamp: string;
}

/**
 * Composable for managing teleconsulta metrics and SSE monitoring
 */
export function useTeleconsultaMetrics() {
  // State
  const aggregatedMetrics = ref<AggregatedMetrics | null>(null);
  const sessions = ref<TeleconsultaSession[]>([]);
  const connections = ref<SSEConnectionMetrics[]>([]);
  const sseStatus = ref<SSEStatus | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const refreshInterval = ref<NodeJS.Timeout | null>(null);

  // Reconnection tracking for Sentry alerts
  const reconnectionCounts = ref<Map<string, { count: number; timestamps: number[] }>>(new Map());
  const RECONNECTION_ALERT_THRESHOLD = 5; // reconnections per minute

  // Computed
  const connectionQualityLabel = computed(() => {
    if (!aggregatedMetrics.value) return 'unknown';
    
    const { connectionQualityDistribution } = aggregatedMetrics.value;
    const total = Object.values(connectionQualityDistribution).reduce((sum, val) => sum + val, 0);
    
    if (total === 0) return 'unknown';
    
    const excellentRatio = (connectionQualityDistribution.excellent || 0) / total;
    
    if (excellentRatio >= 0.8) return 'excellent';
    if (excellentRatio >= 0.6) return 'good';
    if (excellentRatio >= 0.4) return 'fair';
    return 'poor';
  });

  const healthStatus = computed(() => {
    if (!sseStatus.value) return 'unknown';
    
    const { silentDisconnections, healthyConnections } = sseStatus.value;
    const total = silentDisconnections + healthyConnections;
    
    if (total === 0) return 'unknown';
    
    const healthRatio = healthyConnections / total;
    
    if (healthRatio >= 0.95) return 'healthy';
    if (healthRatio >= 0.8) return 'warning';
    return 'critical';
  });

  /**
   * Fetch aggregated metrics from API
   */
  const fetchAggregatedMetrics = async (): Promise<void> => {
    try {
      isLoading.value = true;
      error.value = null;

      const response = await apiClient.get('/api/v1/analytics/teleconsulta');

      if (response.success && response.data) {
        aggregatedMetrics.value = response.data.data;
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Error fetching aggregated metrics';
      error.value = message;
      console.error('[TeleconsultaMetrics] Error fetching aggregated metrics:', e);
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Fetch teleconsulta sessions from API
   */
  const fetchSessions = async (limit: number = 50): Promise<void> => {
    try {
      isLoading.value = true;
      error.value = null;

      const response = await apiClient.get(
        `/api/v1/analytics/teleconsulta/sessions?limit=${limit}`
      );

      if (response.success && response.data) {
        sessions.value = response.data.data;
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Error fetching sessions';
      error.value = message;
      console.error('[TeleconsultaMetrics] Error fetching sessions:', e);
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Fetch specific session metrics
   */
  const fetchSession = async (citaId: string): Promise<TeleconsultaSession | null> => {
    try {
      const response = await apiClient.get(
        `/api/v1/analytics/teleconsulta/session/${citaId}`
      );

      if (response.success && response.data) {
        return response.data.data;
      }
      
      return null;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Error fetching session';
      console.error('[TeleconsultaMetrics] Error fetching session:', e);
      return null;
    }
  };

  /**
   * Fetch SSE connection metrics
   */
  const fetchConnections = async (): Promise<void> => {
    try {
      const response = await apiClient.get('/api/v1/analytics/sse/connections');

      if (response.success && response.data) {
        connections.value = response.data.data;
      }
    } catch (e) {
      console.error('[TeleconsultaMetrics] Error fetching connections:', e);
    }
  };

  /**
   * Fetch SSE status overview
   */
  const fetchSSEStatus = async (): Promise<void> => {
    try {
      const response = await apiClient.get('/api/v1/analytics/sse/status');

      if (response.success && response.data) {
        sseStatus.value = response.data.data;
      }
    } catch (e) {
      console.error('[TeleconsultaMetrics] Error fetching SSE status:', e);
    }
  };

  /**
   * Start teleconsulta session tracking
   */
  const startSessionTracking = async (citaId: string, pacienteId: string): Promise<boolean> => {
    try {
      const response = await apiClient.post('/api/v1/analytics/teleconsulta/start', {
        citaId,
        pacienteId
      });

      return response.success;
    } catch (e) {
      console.error('[TeleconsultaMetrics] Error starting session tracking:', e);
      return false;
    }
  };

  /**
   * End teleconsulta session tracking
   */
  const endSessionTracking = async (citaId: string): Promise<TeleconsultaSession | null> => {
    try {
      const response = await apiClient.post(
        '/api/v1/analytics/teleconsulta/end',
        { citaId }
      );

      if (response.success && response.data) {
        return response.data.data;
      }
      
      return null;
    } catch (e) {
      console.error('[TeleconsultaMetrics] Error ending session tracking:', e);
      return null;
    }
  };

  /**
   * Record session metrics (latency, jitter, reconnection)
   */
  const recordMetrics = async (
    citaId: string,
    metrics: {
      latency?: number;
      jitter?: number;
      reconnection?: boolean;
    }
  ): Promise<void> => {
    try {
      await apiClient.post('/api/v1/analytics/teleconsulta/metrics', {
        citaId,
        ...metrics
      });

      // Track reconnections for Sentry alerts
      if (metrics.reconnection) {
        trackReconnectionForAlerts(citaId);
      }
    } catch (e) {
      console.error('[TeleconsultaMetrics] Error recording metrics:', e);
    }
  };

  /**
   * Track reconnections and trigger Sentry alerts if threshold exceeded
   */
  const trackReconnectionForAlerts = (citaId: string): void => {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    let reconnectionData = reconnectionCounts.value.get(citaId) || { count: 0, timestamps: [] };
    
    // Add new reconnection
    reconnectionData.count++;
    reconnectionData.timestamps.push(now);
    
    // Filter to keep only last minute
    reconnectionData.timestamps = reconnectionData.timestamps.filter(ts => ts > oneMinuteAgo);
    
    // Update map
    reconnectionCounts.value.set(citaId, reconnectionData);
    
    // Check if threshold exceeded
    const reconnectionsInLastMinute = reconnectionData.timestamps.length;
    
    if (reconnectionsInLastMinute >= RECONNECTION_ALERT_THRESHOLD) {
      triggerSentryAlert({
        type: 'sse_instability',
        citaId,
        severity: 'high',
        details: {
          reconnectionsInLastMinute,
          totalReconnections: reconnectionData.count,
          message: `SSE instability detected: ${reconnectionsInLastMinute} reconnections in the last minute for session ${citaId}`
        }
      });
      
      // Reset counter after alert to prevent alert spam
      reconnectionCounts.value.set(citaId, { count: 0, timestamps: [] });
    }
  };

  /**
   * Trigger Sentry alert
   */
  const triggerSentryAlert = (alert: {
    type: string;
    citaId?: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    details: Record<string, any>;
  }): void => {
    // Capture with Sentry
    Sentry.captureMessage(alert.details.message, {
      level: alert.severity === 'critical' ? 'fatal' : 
             alert.severity === 'high' ? 'error' : 
             alert.severity === 'medium' ? 'warning' : 'info',
      tags: {
        alertType: alert.type,
        severity: alert.severity,
        citaId: alert.citaId || 'unknown'
      },
      extra: alert.details
    });

    console.warn(`[Sentry Alert] ${alert.severity.toUpperCase()}: ${alert.details.message}`);
  };

  /**
   * Record heartbeat and calculate latency
   */
  const recordHeartbeat = async (serverTimestamp: number): Promise<void> => {
    const now = Date.now();
    const latency = now - serverTimestamp;
    
    // Record latency metric if in active session
    const activeSession = sessions.value.find(s => !s.endTime);
    if (activeSession) {
      await recordMetrics(activeSession.citaId, { latency });
    }
  };

  /**
   * Start auto-refresh interval
   */
  const startAutoRefresh = (intervalMs: number = 30000): void => {
    stopAutoRefresh();
    
    refreshInterval.value = setInterval(() => {
      refreshAll();
    }, intervalMs);
  };

  /**
   * Stop auto-refresh interval
   */
  const stopAutoRefresh = (): void => {
    if (refreshInterval.value) {
      clearInterval(refreshInterval.value);
      refreshInterval.value = null;
    }
  };

  /**
   * Refresh all metrics
   */
  const refreshAll = async (): Promise<void> => {
    await Promise.all([
      fetchAggregatedMetrics(),
      fetchSessions(),
      fetchConnections(),
      fetchSSEStatus()
    ]);
  };

  /**
   * Format duration for display
   */
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  /**
   * Format latency for display
   */
  const formatLatency = (ms: number): string => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  /**
   * Get connection quality color
   */
  const getQualityColor = (quality: string): string => {
    const colors: Record<string, string> = {
      excellent: '#22c55e', // green-500
      good: '#84cc16', // lime-500
      poor: '#f59e0b', // amber-500
      critical: '#ef4444' // red-500
    };
    return colors[quality] || '#6b7280'; // gray-500
  };

  /**
   * Get health status color
   */
  const getHealthColor = (status: string): string => {
    const colors: Record<string, string> = {
      healthy: '#22c55e', // green-500
      warning: '#f59e0b', // amber-500
      critical: '#ef4444' // red-500
    };
    return colors[status] || '#6b7280'; // gray-500
  };

  // Lifecycle
  onMounted(() => {
    refreshAll();
    startAutoRefresh(30000); // Auto-refresh every 30 seconds
  });

  onUnmounted(() => {
    stopAutoRefresh();
  });

  return {
    // State
    aggregatedMetrics,
    sessions,
    connections,
    sseStatus,
    isLoading,
    error,

    // Computed
    connectionQualityLabel,
    healthStatus,

    // Methods
    fetchAggregatedMetrics,
    fetchSessions,
    fetchSession,
    fetchConnections,
    fetchSSEStatus,
    startSessionTracking,
    endSessionTracking,
    recordMetrics,
    recordHeartbeat,
    refreshAll,
    startAutoRefresh,
    stopAutoRefresh,
    formatDuration,
    formatLatency,
    getQualityColor,
    getHealthColor
  };
}

export default useTeleconsultaMetrics;
