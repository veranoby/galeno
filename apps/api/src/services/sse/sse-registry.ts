import { Response } from 'express';
import { SSEClient, SSEMessage } from './types.js';

/**
 * Registry for managing SSE connections
 */
class SSERegistry {
  private clients: Map<string, SSEClient> = new Map();

  /**
   * Subscribe a user to SSE events
   */
  subscribe(userId: string,  response: Response) {
    // Configure SSE headers
    response.setHeader('Content-Type',  'text/event-stream');
    response.setHeader('Cache-Control',  'no-cache');
    response.setHeader('Connection',  'keep-alive');
    // Important: Disable compression for SSE
    response.setHeader('Content-Encoding',  'identity');

    // Close any existing connection for this user
    if (this.clients.has(userId)) {
      this.unsubscribe(userId);
    }

    this.clients.set(userId,  { 
      userId,  
      response,  
      lastHeartbeat: Date.now() 
    });

    // Send connection confirmation event
    this.sendToUser(userId,  { 
      type: 'connected',  
      timestamp: Date.now(),
      message: 'Successfully connected to SSE stream'
    });
    
    // Handle client disconnection
    response.on('close',  () => {
      this.unsubscribe(userId);
    });

    response.on('error',  () => {
      this.unsubscribe(userId);
    });
  }

  /**
   * Send a message to a specific user
   */
  sendToUser(userId: string,  data: any) {
    const client = this.clients.get(userId);
    if (client && !client.response.destroyed) {
      try {
        client.response.write(`data: ${JSON.stringify(data)}\n\n`);
        client.lastHeartbeat = Date.now();
      } catch (error) {
        console.error(`Error sending SSE to user ${userId}:`, error);
        this.unsubscribe(userId);
      }
    }
  }

  /**
   * Broadcast a message to all connected clients
   */
  broadcast(data: any) {
    for (const [userId,  client] of this.clients) {
      if (!client.response.destroyed) {
        try {
          client.response.write(`data: ${JSON.stringify(data)}\n\n`);
          client.lastHeartbeat = Date.now();
        } catch (error) {
          console.error(`Error broadcasting SSE to user ${userId}:`, error);
          this.unsubscribe(userId);
        }
      }
    }
  }

  /**
   * Send a message to multiple users
   */
  sendToMany(userIds: string[],  data: any) {
    for (const userId of userIds) {
      this.sendToUser(userId,  data);
    }
  }

  /**
   * Unsubscribe a user from SSE events
   */
  unsubscribe(userId: string) {
    const client = this.clients.get(userId);
    if (client) {
      try {
        client.response.end();
      } catch (error) {
        console.error(`Error ending SSE connection for user ${userId}:`, error);
      }
      this.clients.delete(userId);
    }
  }

  /**
   * Get the number of active connections
   */
  getActiveConnections(): number {
    return this.clients.size;
  }

  /**
   * Get all connected user IDs
   */
  getConnectedUsers(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Start the heartbeat mechanism to keep connections alive
   */
  startHeartbeat() {
    setInterval(() => {
      const now = Date.now();
      for (const [userId,  client] of this.clients) {
        if (!client.response.destroyed) {
          try {
            // Send keep-alive comment
            client.response.write(':keep-alive\n\n');
            
            // Also send a named heartbeat event for explicit client-side detection
            client.response.write(`event: heartbeat\ndata: {"timestamp":${now}}\n\n`);
            
            // Detect dead clients (no activity for 90 seconds)
            // We update lastHeartbeat when we send data or heartbeat
            if (now - client.lastHeartbeat > 90000) {
              this.unsubscribe(userId);
            }
            
            client.lastHeartbeat = now;
          } catch (error) {
            console.error(`Error during heartbeat for user ${userId}:`, error);
            this.unsubscribe(userId);
          }
        } else {
          // Client already destroyed, remove from registry
          this.clients.delete(userId);
        }
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Send a structured SSE message
   */
  sendStructuredMessage(userId: string,  message: SSEMessage) {
    this.sendToUser(userId,  message);
  }

  /**
   * Broadcast a structured SSE message
   */
  broadcastStructuredMessage(message: SSEMessage) {
    this.broadcast(message);
  }
}

export const sseRegistry = new SSERegistry();