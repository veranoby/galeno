import Redis from 'ioredis';
import { sseRegistry } from './sse-registry.js';
import { SSEMessage } from './types.js';
import { logger } from '../../utils/logger.js'; // Assuming there's a logger utility

/**
 * SSE Manager with Redis Pub/Sub integration for multi-instance support
 */
class SSEManager {
  private redisPublisher: Redis;
  private redisSubscriber: Redis;
  private initialized = false;

  constructor() {
    // Initialize Redis clients
    this.redisPublisher = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.redisSubscriber = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }

  /**
   * Initialize the SSE Manager with Redis connections
   */
  async initialize() {
    try {
      // ioredis connects automatically, but we'll wait for ready state
      await Promise.all([
        this.waitForReady(this.redisPublisher),
        this.waitForReady(this.redisSubscriber)
      ]);

      // Subscribe to the notifications channel
      await this.redisSubscriber.subscribe('notifications');
      this.redisSubscriber.on('message',  (channel: string,  message: string) => {
        if (channel === 'notifications') {
          try {
            const parsedMessage: SSEMessage = JSON.parse(message);
            this.handleRedisMessage(parsedMessage);
          } catch (error) {
            logger.error('Error parsing Redis message from notifications channel:', error);
          }
        }
      });

      // Subscribe to other relevant channels
      await this.redisSubscriber.subscribe('triage_updates');
      this.redisSubscriber.on('message',  (channel: string,  message: string) => {
        if (channel === 'triage_updates') {
          try {
            const parsedMessage: SSEMessage = JSON.parse(message);
            this.handleRedisMessage(parsedMessage);
          } catch (error) {
            logger.error('Error parsing triage update from Redis:', error);
          }
        }
      });

      this.initialized = true;
      logger.info('SSE Manager initialized successfully with Redis Pub/Sub');
      
      // Start heartbeat in the registry
      sseRegistry.startHeartbeat();
    } catch (error) {
      logger.error('Failed to initialize SSE Manager:', error);
      throw error;
    }
  }

  /**
   * Wait for Redis client to be ready
   */
  private waitForReady(client: Redis): Promise<void> {
    if (client.status === 'ready') {
      return Promise.resolve();
    }
    
    return new Promise((resolve,  reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Redis client connection timeout'));
      }, 10000); // 10 second timeout
      
      client.once('ready',  () => {
        clearTimeout(timeout);
        resolve();
      });
      
      client.once('error',  (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  /**
   * Handle incoming messages from Redis
   */
  private handleRedisMessage(message: SSEMessage) {
    if (message.userId) {
      // Send to specific user
      sseRegistry.sendToUser(message.userId,  message);
    } else if (message.topic) {
      // Topic-based routing could be implemented here
      // For now, broadcast to all if no specific user
      sseRegistry.broadcast(message);
    } else {
      // Broadcast to all connected clients
      sseRegistry.broadcast(message);
    }
  }

  /**
   * Publish a message to Redis for distribution to all server instances
   */
  async publishToChannel(channel: string,  message: SSEMessage) {
    if (!this.initialized) {
      throw new Error('SSE Manager not initialized');
    }

    try {
      await this.redisPublisher.publish(channel,  JSON.stringify(message));
    } catch (error) {
      logger.error(`Error publishing to Redis channel ${channel}:`, error);
      throw error;
    }
  }

  /**
   * Send a message to a specific user via Redis
   */
  async sendToUser(userId: string,  message: SSEMessage) {
    message.userId = userId;
    await this.publishToChannel('notifications',  message);
  }

  /**
   * Broadcast a message to all users via Redis
   */
  async broadcast(message: SSEMessage) {
    await this.publishToChannel('notifications',  message);
  }

  /**
   * Send triage update notification
   */
  async sendTriageUpdate(doctorId: string,  triageData: any) {
    const message: SSEMessage = {
      type: 'TRIAGE_UPDATE',
      data: triageData,
      timestamp: Date.now(),
      userId: doctorId
    };
    
    await this.publishToChannel('triage_updates',  message);
  }

  /**
   * Send appointment reminder
   */
  async sendAppointmentReminder(userId: string,  appointmentData: any) {
    const message: SSEMessage = {
      type: 'APPOINTMENT_REMINDER',
      data: appointmentData,
      timestamp: Date.now(),
      userId
    };
    
    await this.publishToChannel('notifications',  message);
  }

  /**
   * Send consultation status update
   */
  async sendConsultationStatusUpdate(userId: string,  statusData: any) {
    const message: SSEMessage = {
      type: 'CONSULTATION_STATUS_UPDATE',
      data: statusData,
      timestamp: Date.now(),
      userId
    };
    
    await this.publishToChannel('notifications',  message);
  }

  /**
   * Get active connection count
   */
  getActiveConnections(): number {
    return sseRegistry.getActiveConnections();
  }

  /**
   * Get connected users
   */
  getConnectedUsers(): string[] {
    return sseRegistry.getConnectedUsers();
  }

  /**
   * Check if user has active connection
   */
  hasUserConnection(userId: string): boolean {
    const connectedUsers = sseRegistry.getConnectedUsers();
    return connectedUsers.includes(userId);
  }

  /**
   * Gracefully shutdown the SSE Manager
   */
  async shutdown() {
    try {
      await this.redisPublisher.quit();
      await this.redisSubscriber.quit();
      this.initialized = false;
      logger.info('SSE Manager shut down successfully');
    } catch (error) {
      logger.error('Error shutting down SSE Manager:', error);
    }
  }
}

export const sseManager = new SSEManager();