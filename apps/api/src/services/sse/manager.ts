import { EventEmitter } from 'events';
import { Request, Response } from 'express';

interface SSEConnection {
  id: string;
  res: Response;
  userId?: string;
  lastEventId?: string;
  connectedAt: number;
  heartbeatInterval?: NodeJS.Timeout;
  heartbeatTimeout?: NodeJS.Timeout;
}

export class SSEManager extends EventEmitter {
  private connections: Map<string, SSEConnection> = new Map();
  private static instance: SSEManager;

  constructor() {
    super();
    this.setMaxListeners(0); // Remove listener limits
  }

  public static getInstance(): SSEManager {
    if (!SSEManager.instance) {
      SSEManager.instance = new SSEManager();
    }
    return SSEManager.instance;
  }

  /**
   * Establish a new SSE connection
   */
  public connect(req: Request, res: Response, userId?: string): void {
    const connectionId = this.generateConnectionId();
    
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
    });

    const connection: SSEConnection = {
      id: connectionId,
      res,
      userId,
      connectedAt: Date.now(),
    };

    this.connections.set(connectionId, connection);
    this.setupHeartbeat(connection);
    
    // Handle client disconnect
    req.on('close', () => {
      this.disconnect(connectionId);
    });

    req.on('disconnect', () => {
      this.disconnect(connectionId);
    });

    // Send initial connection event
    this.sendEventToConnection(connectionId, 'connected', { 
      connectionId, 
      timestamp: Date.now() 
    });

    console.log(`SSE connection established: ${connectionId} for user: ${userId || 'anonymous'}`);
  }

  /**
   * Disconnect a specific connection
   */
  public disconnect(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Clear heartbeat intervals
    if (connection.heartbeatInterval) {
      clearInterval(connection.heartbeatInterval);
    }
    if (connection.heartbeatTimeout) {
      clearTimeout(connection.heartbeatTimeout);
    }

    try {
      connection.res.end();
    } catch (error) {
      console.error(`Error ending SSE connection ${connectionId}:`, error);
    }

    this.connections.delete(connectionId);
    this.emit('disconnected', { connectionId, userId: connection.userId });
    
    console.log(`SSE connection disconnected: ${connectionId}`);
  }

  /**
   * Send an event to a specific connection
   */
  public sendEventToConnection(connectionId: string, event: string, data: any): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false;
    }

    try {
      const message = this.formatSSEMessage(event, data, undefined, connection.lastEventId);
      connection.res.write(message);
      connection.lastEventId = `${Date.now()}`;
      return true;
    } catch (error) {
      console.error(`Error sending event to connection ${connectionId}:`, error);
      this.disconnect(connectionId);
      return false;
    }
  }

  /**
   * Broadcast an event to all connections or filtered connections
   */
  public broadcastEvent(
    event: string, 
    data: any, 
    filterFn?: (connection: SSEConnection) => boolean
  ): number {
    let sentCount = 0;
    
    for (const [connectionId, connection] of Array.from(this.connections.entries())) {
      // Apply filter if provided
      if (filterFn && !filterFn(connection)) {
        continue;
      }

      if (this.sendEventToConnection(connectionId, event, data)) {
        sentCount++;
      }
    }

    return sentCount;
  }

  /**
   * Send an event to all connections of a specific user
   */
  public sendEventToUser(userId: string, event: string, data: any): number {
    let sentCount = 0;
    
    for (const [connectionId, connection] of Array.from(this.connections.entries())) {
      if (connection.userId === userId) {
        if (this.sendEventToConnection(connectionId, event, data)) {
          sentCount++;
        }
      }
    }

    return sentCount;
  }

  /**
   * Get connection count
   */
  public getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Get all active connections
   */
  public getConnections(): SSEConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get connections by user ID
   */
  public getConnectionsByUser(userId: string): SSEConnection[] {
    return Array.from(this.connections.values()).filter(conn => conn.userId === userId);
  }

  /**
   * Setup heartbeat mechanism for a connection
   */
  private setupHeartbeat(connection: SSEConnection): void {
    // Send periodic heartbeat to detect broken connections
    connection.heartbeatInterval = setInterval(() => {
      // Set a timeout to detect if the client stops responding
      connection.heartbeatTimeout = setTimeout(() => {
        console.log(`Heartbeat timeout for connection: ${connection.id}`);
        this.disconnect(connection.id);
      }, 10000); // 10 seconds timeout after sending heartbeat

      this.sendEventToConnection(connection.id, 'heartbeat', { timestamp: Date.now() });
    }, 30000); // Send heartbeat every 30 seconds
  }

  /**
   * Generate a unique connection ID
   */
  private generateConnectionId(): string {
    return `sse-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Format data as SSE message
   */
  private formatSSEMessage(event: string, data: any, id?: string, lastEventId?: string): string {
    let message = '';
    
    if (event) {
      message += `event: ${event}\n`;
    }
    
    if (id) {
      message += `id: ${id}\n`;
    } else if (lastEventId) {
      message += `id: ${lastEventId}\n`;
    }
    
    // Format data - if it's an object, stringify it
    const formattedData = typeof data === 'object' ? JSON.stringify(data) : String(data);
    message += `data: ${formattedData}\n\n`;
    
    return message;
  }

  /**
   * Close all connections and cleanup
   */
  public closeAll(): void {
    for (const [connectionId] of Array.from(this.connections.entries())) {
      this.disconnect(connectionId);
    }
  }
}

// Export singleton instance
export const sseManager = SSEManager.getInstance();