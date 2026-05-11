import { logger } from '../../utils/logger.js';
import { sseRegistry } from '../sse/sse-registry.js';
import type { SSEClient } from '../sse/types.js';
import { captureMessage } from '../../utils/sentry.js';
import * as Sentry from '@sentry/node';

/**
 * Teleconsulta session metrics
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
 * SSE Connection metrics for monitoring
 */
export interface SSEConnectionMetrics {
  userId: string;
  connectedAt: number;
  lastHeartbeat: number;
  latency: number; // ms
  jitter: number; // ms
  reconnectionCount: number;
  reconnectionTimestamps: number[]; // For detecting rapid reconnections
  isSilentDisconnection: boolean;
}

/**
 * Alert configuration for Sentry
 */
export interface SentryAlertConfig {
  type: 'sse_instability' | 'silent_disconnection' | 'high_latency' | 'critical_jitter';
  userId: string;
  citaId?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, any>;
}

/**
 * SSE Monitoring Service for tracking connection health and teleconsulta metrics
 */
class SSEMonitoringService {
  private connectionMetrics: Map<string, SSEConnectionMetrics> = new Map();
  private teleconsultaSessions: Map<string, TeleconsultaSession> = new Map();
  private heartbeatLatencyHistory: Map<string, number[]> = new Map();
  
  // Thresholds for alerts
  private readonly HIGH_LATENCY_THRESHOLD = 500; // ms
  private readonly CRITICAL_LATENCY_THRESHOLD = 1000; // ms
  private readonly HIGH_JITTER_THRESHOLD = 100; // ms
  private readonly CRITICAL_JITTER_THRESHOLD = 300; // ms
  private readonly RECONNECTION_ALERT_THRESHOLD = 5; // reconnections per minute
  private readonly SILENT_DISCONNECTION_TIMEOUT = 90000; // 90 seconds without heartbeat
  
  constructor() {
    // Start monitoring interval
    this.startMonitoringInterval();
  }

  /**
   * Start a new teleconsulta session
   */
  startTeleconsultaSession(citaId: string, doctorId: string, pacienteId: string): void {
    const session: TeleconsultaSession = {
      citaId,
      doctorId,
      pacienteId,
      startTime: Date.now(),
      duration: 0,
      latencySamples: [],
      jitterSamples: [],
      reconnectionCount: 0,
      connectionQuality: 'excellent'
    };

    this.teleconsultaSessions.set(citaId, session);
    
    logger.info({
      event: 'teleconsulta_session_started',
      citaId,
      doctorId,
      pacienteId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * End a teleconsulta session
   */
  endTeleconsultaSession(citaId: string): TeleconsultaSession | undefined {
    const session = this.teleconsultaSessions.get(citaId);
    
    if (!session) {
      logger.warn({ event: 'session_not_found', citaId });
      return undefined;
    }

    session.endTime = Date.now();
    session.duration = Math.floor((session.endTime - session.startTime) / 1000);
    
    // Calculate final metrics
    const avgLatency = this.calculateAverage(session.latencySamples);
    const avgJitter = this.calculateAverage(session.jitterSamples);
    
    logger.info({
      event: 'teleconsulta_session_ended',
      citaId,
      doctorId: session.doctorId,
      duration: session.duration,
      avgLatency: Math.round(avgLatency),
      avgJitter: Math.round(avgJitter),
      reconnectionCount: session.reconnectionCount,
      finalQuality: session.connectionQuality,
      timestamp: new Date().toISOString()
    });

    // Keep session in map for analytics retrieval
    this.teleconsultaSessions.set(citaId, session);
    
    return session;
  }

  /**
   * Record latency sample for a session
   */
  recordLatency(citaId: string, latencyMs: number): void {
    const session = this.teleconsultaSessions.get(citaId);
    if (!session) return;

    session.latencySamples.push(latencyMs);
    
    // Keep only last 100 samples to prevent memory bloat
    if (session.latencySamples.length > 100) {
      session.latencySamples.shift();
    }

    // Update connection quality based on latency
    this.updateConnectionQuality(session);
  }

  /**
   * Record jitter sample for a session
   */
  recordJitter(citaId: string, jitterMs: number): void {
    const session = this.teleconsultaSessions.get(citaId);
    if (!session) return;

    session.jitterSamples.push(jitterMs);
    
    // Keep only last 100 samples
    if (session.jitterSamples.length > 100) {
      session.jitterSamples.shift();
    }

    // Update connection quality based on jitter
    this.updateConnectionQuality(session);
  }

  /**
   * Record reconnection event
   */
  recordReconnection(userId: string, citaId?: string): void {
    const metrics = this.getOrCreateConnectionMetrics(userId);
    
    metrics.reconnectionCount++;
    metrics.reconnectionTimestamps.push(Date.now());
    
    // Keep only last minute of timestamps
    const oneMinuteAgo = Date.now() - 60000;
    metrics.reconnectionTimestamps = metrics.reconnectionTimestamps.filter(
      ts => ts > oneMinuteAgo
    );

    // Update session if citaId provided
    if (citaId) {
      const session = this.teleconsultaSessions.get(citaId);
      if (session) {
        session.reconnectionCount++;
      }
    }

    // Check for instability alert
    const reconnectionsInLastMinute = metrics.reconnectionTimestamps.filter(
      ts => ts > Date.now() - 60000
    ).length;

    if (reconnectionsInLastMinute >= this.RECONNECTION_ALERT_THRESHOLD) {
      this.triggerSentryAlert({
        type: 'sse_instability',
        userId,
        citaId,
        severity: 'high',
        details: {
          reconnectionsInLastMinute,
          totalReconnections: metrics.reconnectionCount,
          message: `User ${userId} has ${reconnectionsInLastMinute} reconnections in the last minute`
        }
      });
    }

    logger.info({
      event: 'sse_reconnection',
      userId,
      citaId,
      reconnectionsInLastMinute,
      totalReconnections: metrics.reconnectionCount
    });
  }

  /**
   * Record heartbeat and calculate latency
   */
  recordHeartbeat(userId: string, serverTimestamp: number): void {
    const metrics = this.getOrCreateConnectionMetrics(userId);
    const now = Date.now();
    
    // Calculate round-trip latency (assuming serverTimestamp is when heartbeat was sent)
    const latency = now - serverTimestamp;
    metrics.latency = latency;
    metrics.lastHeartbeat = now;
    metrics.isSilentDisconnection = false;

    // Store latency history for jitter calculation
    const history = this.heartbeatLatencyHistory.get(userId) || [];
    history.push(latency);
    
    // Keep only last 20 samples for jitter calculation
    if (history.length > 20) {
      history.shift();
    }
    
    this.heartbeatLatencyHistory.set(userId, history);

    // Calculate jitter (variation in latency)
    if (history.length >= 2) {
      const jitter = this.calculateJitter(history);
      metrics.jitter = jitter;

      // Update session metrics if in teleconsulta
      const session = this.getActiveSessionForUser(userId);
      if (session) {
        this.recordLatency(session.citaId, latency);
        this.recordJitter(session.citaId, jitter);
      }

      // Check for high latency/jitter alerts
      this.checkLatencyAlerts(userId, latency, jitter);
    }
  }

  /**
   * Mark connection as started
   */
  markConnectionStarted(userId: string): void {
    const metrics = this.getOrCreateConnectionMetrics(userId);
    metrics.connectedAt = Date.now();
    metrics.isSilentDisconnection = false;
    
    logger.info({
      event: 'sse_connection_started',
      userId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Mark connection as ended
   */
  markConnectionEnded(userId: string): void {
    const metrics = this.connectionMetrics.get(userId);
    
    if (metrics) {
      logger.info({
        event: 'sse_connection_ended',
        userId,
        totalDuration: Date.now() - metrics.connectedAt,
        totalReconnections: metrics.reconnectionCount,
        finalLatency: metrics.latency,
        finalJitter: metrics.jitter
      });
      
      this.connectionMetrics.delete(userId);
      this.heartbeatLatencyHistory.delete(userId);
    }
  }

  /**
   * Detect silent disconnections
   */
  detectSilentDisconnections(): void {
    const now = Date.now();
    
    for (const [userId, metrics] of this.connectionMetrics.entries()) {
      const timeSinceLastHeartbeat = now - metrics.lastHeartbeat;
      
      if (timeSinceLastHeartbeat > this.SILENT_DISCONNECTION_TIMEOUT && !metrics.isSilentDisconnection) {
        metrics.isSilentDisconnection = true;
        
        logger.warn({
          event: 'silent_disconnection_detected',
          userId,
          timeSinceLastHeartbeat,
          lastHeartbeat: new Date(metrics.lastHeartbeat).toISOString(),
          citaId: this.getActiveSessionForUser(userId)?.citaId
        });

        // Trigger Sentry alert for silent disconnection
        this.triggerSentryAlert({
          type: 'silent_disconnection',
          userId,
          citaId: this.getActiveSessionForUser(userId)?.citaId,
          severity: 'medium',
          details: {
            timeSinceLastHeartbeat,
            lastHeartbeat: metrics.lastHeartbeat,
            message: `Silent disconnection detected for user ${userId} - no heartbeat for ${Math.floor(timeSinceLastHeartbeat / 1000)}s`
          }
        });
      }
    }
  }

  /**
   * Get metrics for a specific user
   */
  getConnectionMetrics(userId: string): SSEConnectionMetrics | undefined {
    return this.connectionMetrics.get(userId);
  }

  /**
   * Get all active connection metrics
   */
  getAllConnectionMetrics(): SSEConnectionMetrics[] {
    return Array.from(this.connectionMetrics.values());
  }

  /**
   * Get teleconsulta session metrics
   */
  getTeleconsultaSession(citaId: string): TeleconsultaSession | undefined {
    return this.teleconsultaSessions.get(citaId);
  }

  /**
   * Get all teleconsulta sessions (for dashboard)
   */
  getAllTeleconsultaSessions(limit: number = 50): TeleconsultaSession[] {
    const sessions = Array.from(this.teleconsultaSessions.values())
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, limit);
    
    return sessions;
  }

  /**
   * Get aggregated metrics for analytics
   */
  getAggregatedMetrics(): {
    totalActiveConnections: number;
    totalSessions: number;
    avgLatency: number;
    avgJitter: number;
    avgDuration: number;
    totalReconnections: number;
    silentDisconnections: number;
    connectionQualityDistribution: Record<string, number>;
  } {
    const sessions = this.getAllTeleconsultaSessions();
    const connections = this.getAllConnectionMetrics();
    
    const allLatencies = sessions.flatMap(s => s.latencySamples);
    const allJitters = sessions.flatMap(s => s.jitterSamples);
    
    return {
      totalActiveConnections: connections.filter(c => !c.isSilentDisconnection).length,
      totalSessions: sessions.length,
      avgLatency: Math.round(this.calculateAverage(allLatencies)),
      avgJitter: Math.round(this.calculateAverage(allJitters)),
      avgDuration: Math.round(this.calculateAverage(sessions.map(s => s.duration))),
      totalReconnections: sessions.reduce((sum, s) => sum + s.reconnectionCount, 0),
      silentDisconnections: connections.filter(c => c.isSilentDisconnection).length,
      connectionQualityDistribution: {
        excellent: sessions.filter(s => s.connectionQuality === 'excellent').length,
        good: sessions.filter(s => s.connectionQuality === 'good').length,
        poor: sessions.filter(s => s.connectionQuality === 'poor').length,
        critical: sessions.filter(s => s.connectionQuality === 'critical').length
      }
    };
  }

  /**
   * Start monitoring interval for silent disconnection detection
   */
  private startMonitoringInterval(): void {
    // Check for silent disconnections every 30 seconds
    setInterval(() => {
      this.detectSilentDisconnections();
    }, 30000);
  }

  /**
   * Get or create connection metrics for a user
   */
  private getOrCreateConnectionMetrics(userId: string): SSEConnectionMetrics {
    if (!this.connectionMetrics.has(userId)) {
      this.connectionMetrics.set(userId, {
        userId,
        connectedAt: Date.now(),
        lastHeartbeat: Date.now(),
        latency: 0,
        jitter: 0,
        reconnectionCount: 0,
        reconnectionTimestamps: [],
        isSilentDisconnection: false
      });
    }
    
    return this.connectionMetrics.get(userId)!;
  }

  /**
   * Get active session for a user (doctor or patient)
   */
  private getActiveSessionForUser(userId: string): TeleconsultaSession | undefined {
    for (const session of this.teleconsultaSessions.values()) {
      if ((session.doctorId === userId || session.pacienteId === userId) && !session.endTime) {
        return session;
      }
    }
    return undefined;
  }

  /**
   * Calculate average from array of numbers
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Calculate jitter (standard deviation of latency)
   */
  private calculateJitter(latencies: number[]): number {
    if (latencies.length < 2) return 0;
    
    const avg = this.calculateAverage(latencies);
    const squaredDiffs = latencies.map(lat => Math.pow(lat - avg, 2));
    const variance = this.calculateAverage(squaredDiffs);
    
    return Math.sqrt(variance);
  }

  /**
   * Update connection quality based on current metrics
   */
  private updateConnectionQuality(session: TeleconsultaSession): void {
    const avgLatency = this.calculateAverage(session.latencySamples.slice(-10)); // Last 10 samples
    const avgJitter = this.calculateAverage(session.jitterSamples.slice(-10));
    
    if (avgLatency > this.CRITICAL_LATENCY_THRESHOLD || avgJitter > this.CRITICAL_JITTER_THRESHOLD) {
      session.connectionQuality = 'critical';
    } else if (avgLatency > this.HIGH_LATENCY_THRESHOLD || avgJitter > this.HIGH_JITTER_THRESHOLD) {
      session.connectionQuality = 'poor';
    } else if (avgLatency > 200 || avgJitter > 50) {
      session.connectionQuality = 'good';
    } else {
      session.connectionQuality = 'excellent';
    }
  }

  /**
   * Check and trigger latency/jitter alerts
   */
  private checkLatencyAlerts(userId: string, latency: number, jitter: number): void {
    const session = this.getActiveSessionForUser(userId);
    
    if (latency > this.CRITICAL_LATENCY_THRESHOLD) {
      this.triggerSentryAlert({
        type: 'high_latency',
        userId,
        citaId: session?.citaId,
        severity: 'high',
        details: {
          latency,
          threshold: this.CRITICAL_LATENCY_THRESHOLD,
          message: `Critical latency detected: ${latency}ms`
        }
      });
    } else if (latency > this.HIGH_LATENCY_THRESHOLD) {
      this.triggerSentryAlert({
        type: 'high_latency',
        userId,
        citaId: session?.citaId,
        severity: 'medium',
        details: {
          latency,
          threshold: this.HIGH_LATENCY_THRESHOLD,
          message: `High latency detected: ${latency}ms`
        }
      });
    }

    if (jitter > this.CRITICAL_JITTER_THRESHOLD) {
      this.triggerSentryAlert({
        type: 'critical_jitter',
        userId,
        citaId: session?.citaId,
        severity: 'critical',
        details: {
          jitter,
          threshold: this.CRITICAL_JITTER_THRESHOLD,
          message: `Critical jitter detected: ${Math.round(jitter)}ms`
        }
      });
    }
  }

  /**
   * Trigger Sentry alert
   */
  private triggerSentryAlert(alert: SentryAlertConfig): void {
    // Map severity to Sentry level
    const sentryLevel: Sentry.SeverityLevel = 
      alert.severity === 'critical' ? 'fatal' : 
      alert.severity === 'high' ? 'error' : 
      alert.severity === 'medium' ? 'warning' : 'info';

    // Capture with Sentry
    captureMessage(alert.details.message, {
      level: sentryLevel,
      tags: {
        alertType: alert.type,
        severity: alert.severity,
        citaId: alert.citaId || 'unknown',
        userId: alert.userId
      },
      extra: {
        ...alert.details,
        timestamp: new Date().toISOString()
      }
    });

    // Also log for local debugging
    const logFn = alert.severity === 'critical' ? logger.error : 
                  alert.severity === 'high' ? logger.warn : logger.info;
    
    logFn({
      event: 'sentry_alert',
      alertType: alert.type,
      severity: alert.severity,
      userId: alert.userId,
      citaId: alert.citaId,
      details: alert.details
    });
  }
}

export const sseMonitoringService = new SSEMonitoringService();
export default sseMonitoringService;
