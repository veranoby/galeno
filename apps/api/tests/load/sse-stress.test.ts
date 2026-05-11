/**
 * SSE Stress Test Suite - OPT-003
 * 
 * Tests SSE Manager under extreme load with 500+ concurrent connections
 * Validates system behavior at capacity limits and beyond
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { sseManager } from '../../src/services/sse/sse-manager';
import { sseRegistry } from '../../src/services/sse/sse-registry';
import type { SSEMessage } from '../../src/services/sse/types';

// Mock Redis for testing
vi.mock('ioredis', () => {
  const mockRedis = vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    subscribe: vi.fn().mockResolvedValue(undefined),
    publish: vi.fn().mockResolvedValue(1),
    quit: vi.fn().mockResolvedValue('OK'),
    status: 'ready',
    once: vi.fn((event, cb) => {
      if (event === 'ready') cb();
    }),
  }));

  return {
    default: mockRedis,
  };
});

/**
 * Stress Test Metrics
 */
interface StressTestMetrics {
  peakConnections: number;
  connectionSuccessRate: number;
  avgConnectionTime: number;
  p99ConnectionTime: number;
  notificationDeliveryRate: number;
  avgNotificationLatency: number;
  p99NotificationLatency: number;
  peakMemoryMB: number;
  memoryGrowthMB: number;
  errorCount: number;
  timeoutCount: number;
}

class StressTestMonitor {
  private metrics: Partial<StressTestMetrics> = {};
  private connectionTimes: number[] = [];
  private notificationLatencies: number[] = [];
  private memorySamples: number[] = [];
  private errors: Error[] = [];
  private timeouts: number = 0;

  recordConnection(time: number, success: boolean) {
    this.connectionTimes.push(time);
    if (!success) {
      this.errors.push(new Error('Connection failed'));
    }
  }

  recordNotification(latency: number, delivered: boolean) {
    this.notificationLatencies.push(latency);
    if (!delivered) {
      this.errors.push(new Error('Notification delivery failed'));
    }
  }

  recordMemory() {
    this.memorySamples.push(process.memoryUsage().heapUsed);
  }

  recordTimeout() {
    this.timeouts++;
  }

  getMetrics(): StressTestMetrics {
    const sorted = (arr: number[]) => [...arr].sort((a, b) => a - b);
    const percentile = (arr: number[], p: number) => {
      if (arr.length === 0) return 0;
      const index = Math.ceil((p / 100) * arr.length) - 1;
      return arr[Math.max(0, index)];
    };
    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    const sortedConnections = sorted(this.connectionTimes);
    const sortedLatencies = sorted(this.notificationLatencies);

    return {
      peakConnections: this.metrics.peakConnections || 0,
      connectionSuccessRate: this.metrics.connectionSuccessRate || 0,
      avgConnectionTime: avg(this.connectionTimes),
      p99ConnectionTime: percentile(sortedConnections, 99),
      notificationDeliveryRate: this.metrics.notificationDeliveryRate || 0,
      avgNotificationLatency: avg(this.notificationLatencies),
      p99NotificationLatency: percentile(sortedLatencies, 99),
      peakMemoryMB: this.metrics.peakMemoryMB || 0,
      memoryGrowthMB: this.metrics.memoryGrowthMB || 0,
      errorCount: this.errors.length,
      timeoutCount: this.timeouts,
    };
  }

  setMetrics(metrics: Partial<StressTestMetrics>) {
    this.metrics = { ...this.metrics, ...metrics };
  }

  reset() {
    this.metrics = {};
    this.connectionTimes = [];
    this.notificationLatencies = [];
    this.memorySamples = [];
    this.errors = [];
    this.timeouts = 0;
  }
}

const stressMonitor = new StressTestMonitor();

/**
 * Mock SSE Client for stress testing
 */
class StressTestClient {
  userId: string;
  response: any;
  messages: SSEMessage[] = [];
  connected: boolean = false;
  connectionTime: number = 0;

  constructor(userId: string) {
    this.userId = userId;
    this.response = {
      setHeader: vi.fn(),
      write: vi.fn((data: string) => {
        if (data.startsWith('data: ')) {
          try {
            const json = data.substring(6);
            const message = JSON.parse(json);
            this.messages.push(message);
            if (message.timestamp) {
              const latency = Date.now() - message.timestamp;
              stressMonitor.recordNotification(latency, true);
            }
          } catch (e) {
            // Ignore keep-alive messages
          }
        }
      }),
      end: vi.fn(() => {
        this.connected = false;
      }),
      on: vi.fn(),
      removeListener: vi.fn(),
      destroyed: false,
    };
  }

  async connect(): Promise<boolean> {
    const startTime = Date.now();
    try {
      sseRegistry.subscribe(this.userId, this.response);
      this.connected = true;
      this.connectionTime = Date.now() - startTime;
      stressMonitor.recordConnection(this.connectionTime, true);
      return true;
    } catch (error) {
      this.connected = false;
      this.connectionTime = Date.now() - startTime;
      stressMonitor.recordConnection(this.connectionTime, false);
      return false;
    }
  }

  disconnect() {
    sseRegistry.unsubscribe(this.userId);
    this.connected = false;
  }
}

describe('SSE Stress Testing - OPT-003', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stressMonitor.reset();
    
    // Clear all existing connections
    const connectedUsers = sseRegistry.getConnectedUsers();
    connectedUsers.forEach(userId => sseRegistry.unsubscribe(userId));
  });

  afterEach(async () => {
    // Cleanup all connections
    const connectedUsers = sseRegistry.getConnectedUsers();
    connectedUsers.forEach(userId => sseRegistry.unsubscribe(userId));
    
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('500+ Concurrent Connections', () => {
    it('should handle 500 concurrent connections', async () => {
      const connectionCount = 500;
      const clients: StressTestClient[] = [];

      console.log(`[STRESS TEST] Initiating ${connectionCount} concurrent connections...`);

      // Create clients
      for (let i = 0; i < connectionCount; i++) {
        clients.push(new StressTestClient(`doctor_stress_${i}`));
      }

      stressMonitor.recordMemory();

      // Connect all concurrently in batches to avoid overwhelming
      const batchSize = 100;
      const batches = Math.ceil(connectionCount / batchSize);
      const connectionResults: boolean[] = [];

      for (let batch = 0; batch < batches; batch++) {
        const start = batch * batchSize;
        const end = Math.min(start + batchSize, connectionCount);
        const batchClients = clients.slice(start, end);

        const batchResults = await Promise.all(
          batchClients.map(client => client.connect())
        );

        connectionResults.push(...batchResults);
        
        // Small delay between batches
        if (batch < batches - 1) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      stressMonitor.recordMemory();

      const successfulConnections = connectionResults.filter(r => r).length;
      const failedConnections = connectionResults.filter(r => !r).length;
      const successRate = (successfulConnections / connectionCount) * 100;

      stressMonitor.setMetrics({
        peakConnections: successfulConnections,
        connectionSuccessRate: successRate,
      });

      // Verify connections
      expect(successfulConnections).toBeGreaterThanOrEqual(connectionCount * 0.95); // 95% success rate
      expect(sseRegistry.getActiveConnections()).toBeGreaterThanOrEqual(connectionCount * 0.95);

      const metrics = stressMonitor.getMetrics();

      console.log(`[STRESS TEST] 500 concurrent connections results:`, {
        total: connectionCount,
        successful: successfulConnections,
        failed: failedConnections,
        successRate: successRate.toFixed(2) + '%',
        avgConnectionTime: metrics.avgConnectionTime.toFixed(2) + 'ms',
        p99ConnectionTime: metrics.p99ConnectionTime.toFixed(2) + 'ms',
        activeConnections: sseRegistry.getActiveConnections(),
      });
    }, 60000);

    it('should handle 1000 concurrent connections (extreme stress)', async () => {
      const connectionCount = 1000;
      const clients: StressTestClient[] = [];

      console.log(`[STRESS TEST] Extreme stress: ${connectionCount} concurrent connections...`);

      // Create clients
      for (let i = 0; i < connectionCount; i++) {
        clients.push(new StressTestClient(`doctor_extreme_${i}`));
      }

      stressMonitor.recordMemory();
      const initialMemory = process.memoryUsage().heapUsed;

      // Connect in larger batches
      const batchSize = 200;
      const batches = Math.ceil(connectionCount / batchSize);
      const connectionResults: boolean[] = [];

      for (let batch = 0; batch < batches; batch++) {
        const start = batch * batchSize;
        const end = Math.min(start + batchSize, connectionCount);
        const batchClients = clients.slice(start, end);

        const batchResults = await Promise.all(
          batchClients.map(client => client.connect())
        );

        connectionResults.push(...batchResults);
        
        if (batch < batches - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      stressMonitor.recordMemory();
      const finalMemory = process.memoryUsage().heapUsed;

      const successfulConnections = connectionResults.filter(r => r).length;
      const successRate = (successfulConnections / connectionCount) * 100;
      const memoryGrowthMB = (finalMemory - initialMemory) / 1024 / 1024;

      stressMonitor.setMetrics({
        peakConnections: successfulConnections,
        connectionSuccessRate: successRate,
        peakMemoryMB: finalMemory / 1024 / 1024,
        memoryGrowthMB,
      });

      // At extreme load, accept 90% success rate
      expect(successfulConnections).toBeGreaterThanOrEqual(connectionCount * 0.90);

      const metrics = stressMonitor.getMetrics();

      console.log(`[STRESS TEST] Extreme stress results:`, {
        total: connectionCount,
        successful: successfulConnections,
        successRate: successRate.toFixed(2) + '%',
        peakMemory: (finalMemory / 1024 / 1024).toFixed(2) + ' MB',
        memoryGrowth: memoryGrowthMB.toFixed(2) + ' MB',
        avgConnectionTime: metrics.avgConnectionTime.toFixed(2) + 'ms',
        p99ConnectionTime: metrics.p99ConnectionTime.toFixed(2) + 'ms',
      });
    }, 120000);
  });

  describe('High-Volume Notification Traffic', () => {
    it('should handle 1000 notifications across 500 connections', async () => {
      const connectionCount = 500;
      const notificationCount = 1000;
      const clients: StressTestClient[] = [];

      console.log(`[STRESS TEST] Setting up ${connectionCount} connections...`);

      // Setup connections in batches
      const batchSize = 100;
      for (let i = 0; i < connectionCount; i += batchSize) {
        const batch = clients.slice(i, i + batchSize);
        const connectPromises = batch.map(c => c.connect());
        await Promise.all(connectPromises);
      }

      // Fill clients array properly
      for (let i = 0; i < connectionCount; i++) {
        clients[i] = clients[i] || new StressTestClient(`doctor_traffic_${i}`);
        if (!clients[i].connected) {
          await clients[i].connect();
        }
      }

      // Clear initial messages
      clients.forEach(c => c.messages = []);

      stressMonitor.recordMemory();
      const startTime = Date.now();

      console.log(`[STRESS TEST] Sending ${notificationCount} notifications...`);

      // Send high-volume notifications
      const notificationPromises: Promise<void>[] = [];
      
      for (let i = 0; i < notificationCount; i++) {
        const targetIndex = i % connectionCount;
        notificationPromises.push(
          sseManager.sendTriageUpdate(`doctor_traffic_${targetIndex}`, {
            type: 'TRIAGE_UPDATE',
            patientId: `patient_${i}`,
            priority: i % 5 === 0 ? 'CRITICAL' : 'NORMAL',
            timestamp: Date.now(),
          })
        );

        // Batch notifications to avoid overwhelming
        if (i % 100 === 0 && i > 0) {
          await Promise.all(notificationPromises);
          notificationPromises.length = 0;
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      // Wait for remaining notifications
      await Promise.all(notificationPromises);
      await new Promise(resolve => setTimeout(resolve, 500));

      stressMonitor.recordMemory();
      const totalTime = Date.now() - startTime;

      // Count delivered notifications
      let totalMessagesReceived = 0;
      clients.forEach(c => {
        totalMessagesReceived += c.messages.filter(m => m.type === 'TRIAGE_UPDATE').length;
      });

      const deliveryRate = (totalMessagesReceived / notificationCount) * 100;

      stressMonitor.setMetrics({
        notificationDeliveryRate: deliveryRate,
      });

      const metrics = stressMonitor.getMetrics();

      // Verify performance
      expect(deliveryRate).toBeGreaterThanOrEqual(95); // 95% delivery rate
      expect(metrics.avgNotificationLatency).toBeLessThan(1000);

      console.log(`[STRESS TEST] High-volume traffic results:`, {
        connections: connectionCount,
        notificationsSent: notificationCount,
        notificationsReceived: totalMessagesReceived,
        deliveryRate: deliveryRate.toFixed(2) + '%',
        totalTime: totalTime + 'ms',
        throughput: (notificationCount / (totalTime / 1000)).toFixed(2) + ' msg/s',
        avgLatency: metrics.avgNotificationLatency.toFixed(2) + 'ms',
        p99Latency: metrics.p99NotificationLatency.toFixed(2) + 'ms',
      });
    }, 120000);

    it('should handle broadcast storm (100 broadcasts to 500 clients)', async () => {
      const connectionCount = 500;
      const broadcastCount = 100;
      const clients: StressTestClient[] = [];

      console.log(`[STRESS TEST] Broadcast storm: ${broadcastCount} broadcasts to ${connectionCount} clients...`);

      // Setup connections
      for (let i = 0; i < connectionCount; i++) {
        const client = new StressTestClient(`doctor_broadcast_storm_${i}`);
        await client.connect();
        clients.push(client);
      }

      // Clear initial messages
      clients.forEach(c => c.messages = []);

      stressMonitor.recordMemory();
      const startTime = Date.now();

      // Send broadcast storm
      for (let i = 0; i < broadcastCount; i++) {
        await sseManager.broadcast({
          type: 'BROADCAST_STORM',
          data: { sequence: i, timestamp: Date.now() },
          timestamp: Date.now(),
        });

        // Small delay between broadcasts
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      await new Promise(resolve => setTimeout(resolve, 500));
      stressMonitor.recordMemory();

      const totalTime = Date.now() - startTime;

      // Count received broadcasts per client
      const broadcastCounts = clients.map(c => 
        c.messages.filter(m => m.type === 'BROADCAST_STORM').length
      );

      const avgBroadcastsReceived = broadcastCounts.reduce((a, b) => a + b, 0) / broadcastCounts.length;
      const minBroadcastsReceived = Math.min(...broadcastCounts);
      const maxBroadcastsReceived = Math.max(...broadcastCounts);

      const metrics = stressMonitor.getMetrics();

      console.log(`[STRESS TEST] Broadcast storm results:`, {
        clients: connectionCount,
        broadcastsSent: broadcastCount,
        avgBroadcastsPerClient: avgBroadcastsReceived.toFixed(2),
        minBroadcastsReceived,
        maxBroadcastsReceived,
        totalTime: totalTime + 'ms',
        throughput: (broadcastCount / (totalTime / 1000)).toFixed(2) + ' broadcast/s',
        avgLatency: metrics.avgNotificationLatency.toFixed(2) + 'ms',
      });

      // Most clients should receive most broadcasts
      expect(avgBroadcastsReceived).toBeGreaterThanOrEqual(broadcastCount * 0.95);
    }, 120000);
  });

  describe('System Stability Under Load', () => {
    it('should maintain stability during mixed workload', async () => {
      const connectionCount = 500;
      const clients: StressTestClient[] = [];
      const duration = 30000; // 30 seconds
      const startTime = Date.now();

      console.log(`[STRESS TEST] Mixed workload: ${connectionCount} connections for ${duration}ms...`);

      // Setup connections
      for (let i = 0; i < connectionCount; i++) {
        const client = new StressTestClient(`doctor_mixed_${i}`);
        await client.connect();
        clients.push(client);
      }

      stressMonitor.recordMemory();
      const initialMemory = process.memoryUsage().heapUsed;

      // Simulate mixed workload
      let notificationCount = 0;
      let disconnectionCount = 0;
      let reconnectionCount = 0;

      const workloadInterval = setInterval(async () => {
        const elapsed = Date.now() - startTime;
        if (elapsed >= duration) {
          clearInterval(workloadInterval);
          return;
        }

        // Random operations
        const operation = Math.random();

        if (operation < 0.6) {
          // 60% - Send notification
          const targetIndex = Math.floor(Math.random() * connectionCount);
          await sseManager.sendToUser(`doctor_mixed_${targetIndex}`, {
            type: 'MIXED_WORKLOAD',
            data: { timestamp: Date.now() },
            timestamp: Date.now(),
          });
          notificationCount++;
        } else if (operation < 0.8) {
          // 20% - Disconnect random client
          const targetIndex = Math.floor(Math.random() * connectionCount);
          clients[targetIndex]?.disconnect();
          disconnectionCount++;
        } else {
          // 20% - Reconnect client
          const targetIndex = Math.floor(Math.random() * connectionCount);
          if (clients[targetIndex]) {
            clients[targetIndex].disconnect();
            await clients[targetIndex].connect();
            reconnectionCount++;
          }
        }
      }, 50); // Every 50ms

      // Wait for workload to complete
      await new Promise(resolve => setTimeout(resolve, duration + 1000));

      stressMonitor.recordMemory();
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowthMB = (finalMemory - initialMemory) / 1024 / 1024;

      const activeConnections = sseRegistry.getActiveConnections();
      const connectionStability = (activeConnections / connectionCount) * 100;

      stressMonitor.setMetrics({
        peakConnections: connectionCount,
        connectionSuccessRate: connectionStability,
        peakMemoryMB: finalMemory / 1024 / 1024,
        memoryGrowthMB,
      });

      const metrics = stressMonitor.getMetrics();

      console.log(`[STRESS TEST] Mixed workload results:`, {
        duration: duration + 'ms',
        notificationsSent: notificationCount,
        disconnections: disconnectionCount,
        reconnections: reconnectionCount,
        initialConnections: connectionCount,
        finalConnections: activeConnections,
        connectionStability: connectionStability.toFixed(2) + '%',
        memoryGrowth: memoryGrowthMB.toFixed(2) + ' MB',
        avgLatency: metrics.avgNotificationLatency.toFixed(2) + 'ms',
      });

      // System should maintain > 90% connection stability
      expect(connectionStability).toBeGreaterThanOrEqual(90);
      // Memory growth should be reasonable (< 50MB)
      expect(memoryGrowthMB).toBeLessThan(50);
    }, 60000);
  });

  describe('Connection Churn', () => {
    it('should handle rapid connection/disconnection cycles', async () => {
      const clientCount = 100;
      const cycles = 20;
      const clients: StressTestClient[] = [];

      console.log(`[STRESS TEST] Connection churn: ${clientCount} clients x ${cycles} cycles...`);

      stressMonitor.recordMemory();
      const initialMemory = process.memoryUsage().heapUsed;

      for (let cycle = 0; cycle < cycles; cycle++) {
        // Connect all
        for (let i = 0; i < clientCount; i++) {
          if (!clients[i]) {
            clients[i] = new StressTestClient(`doctor_churn_${i}`);
          }
          await clients[i].connect();
        }

        expect(sseRegistry.getActiveConnections()).toBe(clientCount);

        // Send notification
        await sseManager.broadcast({
          type: 'CHURN_CYCLE',
          data: { cycle },
          timestamp: Date.now(),
        });

        await new Promise(resolve => setTimeout(resolve, 50));

        // Disconnect all
        clients.forEach(c => c.disconnect());

        expect(sseRegistry.getActiveConnections()).toBe(0);

        await new Promise(resolve => setTimeout(resolve, 50));
      }

      stressMonitor.recordMemory();
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowthMB = (finalMemory - initialMemory) / 1024 / 1024;

      console.log(`[STRESS TEST] Connection churn results:`, {
        clients: clientCount,
        cycles,
        totalConnections: clientCount * cycles,
        memoryGrowth: memoryGrowthMB.toFixed(2) + ' MB',
        memoryPerCycle: (memoryGrowthMB / cycles).toFixed(3) + ' MB',
      });

      // Memory growth should be minimal per cycle
      expect(memoryGrowthMB / cycles).toBeLessThan(1); // < 1MB per cycle
    }, 60000);
  });

  describe('Edge Cases', () => {
    it('should handle connection flood attack simulation', async () => {
      const floodCount = 1000;
      const clients: StressTestClient[] = [];

      console.log(`[STRESS TEST] Flood simulation: ${floodCount} rapid connections...`);

      stressMonitor.recordMemory();
      const startTime = Date.now();

      // Flood with connections
      const connectPromises: Promise<boolean>[] = [];
      for (let i = 0; i < floodCount; i++) {
        const client = new StressTestClient(`doctor_flood_${i}`);
        clients.push(client);
        connectPromises.push(client.connect());
      }

      const results = await Promise.all(connectPromises);
      const successfulConnections = results.filter(r => r).length;

      stressMonitor.recordMemory();
      const totalTime = Date.now() - startTime;

      const metrics = stressMonitor.getMetrics();

      console.log(`[STRESS TEST] Flood simulation results:`, {
        floodCount,
        successfulConnections,
        successRate: ((successfulConnections / floodCount) * 100).toFixed(2) + '%',
        totalTime: totalTime + 'ms',
        connectionsPerSecond: (floodCount / (totalTime / 1000)).toFixed(2),
        avgConnectionTime: metrics.avgConnectionTime.toFixed(2) + 'ms',
      });

      // System should handle flood gracefully (at least 80% success)
      expect(successfulConnections).toBeGreaterThanOrEqual(floodCount * 0.80);
    }, 60000);

    it('should recover after memory pressure', async () => {
      const connectionCount = 300;
      const clients: StressTestClient[] = [];

      console.log(`[STRESS TEST] Memory pressure recovery test...`);

      // Create memory pressure
      for (let i = 0; i < connectionCount; i++) {
        const client = new StressTestClient(`doctor_pressure_${i}`);
        await client.connect();
        clients.push(client);
      }

      // Send many messages
      for (let i = 0; i < 500; i++) {
        await sseManager.broadcast({
          type: 'PRESSURE_TEST',
          data: { sequence: i },
          timestamp: Date.now(),
        });
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      const memoryBeforeCleanup = process.memoryUsage().heapUsed;

      // Cleanup
      clients.forEach(c => c.disconnect());

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 500));

      // Hint GC if available
      if (global.gc) {
        global.gc();
      }

      await new Promise(resolve => setTimeout(resolve, 500));

      const memoryAfterCleanup = process.memoryUsage().heapUsed;
      const memoryRecovered = memoryBeforeCleanup - memoryAfterCleanup;

      console.log(`[STRESS TEST] Memory pressure recovery:`, {
        memoryBeforeCleanup: (memoryBeforeCleanup / 1024 / 1024).toFixed(2) + ' MB',
        memoryAfterCleanup: (memoryAfterCleanup / 1024 / 1024).toFixed(2) + ' MB',
        memoryRecovered: (memoryRecovered / 1024 / 1024).toFixed(2) + ' MB',
        activeConnections: sseRegistry.getActiveConnections(),
      });

      // All connections should be cleaned up
      expect(sseRegistry.getActiveConnections()).toBe(0);
    }, 30000);
  });
});
