import { EventEmitter } from 'events';

interface SSEManagerOptions {
  url: string;
  reconnectInterval?: number; // Base interval for reconnection attempts
  maxReconnectInterval?: number; // Maximum interval for reconnection (exponential backoff)
  heartbeatTimeout?: number; // Time to wait for heartbeat before considering connection dead
  retryAttempts?: number; // Maximum number of retry attempts (-1 for infinite)
  headers?: Record<string, string>; // Additional headers to send with the connection
}

interface ConnectionState {
  connected: boolean;
  connecting: boolean;
  disconnected: boolean;
  error?: Error;
}

export class SSEManager extends EventEmitter {
  private eventSource: EventSource | null = null;
  private options: SSEManagerOptions;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempt = 0;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private heartbeatReceivedTimer: NodeJS.Timeout | null = null;
  private state: ConnectionState = {
    connected: false,
    connecting: false,
    disconnected: true,
  };
  private eventHandlers: Map<string, ((data: any) => void)[]> = new Map();

  constructor(options: SSEManagerOptions) {
    super();
    this.options = {
      reconnectInterval: 1000, // 1 second base
      maxReconnectInterval: 30000, // 30 seconds max
      heartbeatTimeout: 45000, // 45 seconds
      retryAttempts: -1, // Infinite retries by default
      headers: {},
      ...options,
    };
  }

  /**
   * Connect to the SSE endpoint
   */
  public connect(): void {
    if (this.state.connected || this.state.connecting) {
      console.warn('SSE connection already established or connecting');
      return;
    }

    this.state = {
      connected: false,
      connecting: true,
      disconnected: false,
    };

    try {
      // Create EventSource with additional headers if needed
      // Note: EventSource doesn't support custom headers natively, so we append them as query params
      const urlWithParams = this.buildUrlWithHeaders();
      
      this.eventSource = new EventSource(urlWithParams);
      
      this.eventSource.onopen = () => {
        console.log('SSE connection opened');
        this.handleConnectionOpen();
      };

      this.eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        this.handleConnectionError(error);
      };

      this.eventSource.onmessage = (event) => {
        this.handleMessage(event);
      };

      // Register heartbeat handler
      this.eventSource.addEventListener('heartbeat', (event) => {
        this.handleHeartbeat(event);
      });

      // Register connected handler
      this.eventSource.addEventListener('connected', (event) => {
        this.handleConnected(event);
      });
    } catch (error) {
      console.error('Failed to create SSE connection:', error);
      this.handleConnectionError(error as Error);
    }
  }

  /**
   * Disconnect from the SSE endpoint
   */
  public disconnect(): void {
    this.state = {
      connected: false,
      connecting: false,
      disconnected: true,
    };

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.heartbeatReceivedTimer) {
      clearTimeout(this.heartbeatReceivedTimer);
      this.heartbeatReceivedTimer = null;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    console.log('SSE connection closed');
    this.emit('disconnected');
  }

  /**
   * Subscribe to a specific event type
   */
  public subscribe(eventType: string, handler: (data: any) => void): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    
    const handlers = this.eventHandlers.get(eventType)!;
    handlers.push(handler);
  }

  /**
   * Unsubscribe from a specific event type
   */
  public unsubscribe(eventType: string, handler?: (data: any) => void): void {
    if (!this.eventHandlers.has(eventType)) {
      return;
    }

    if (handler) {
      const handlers = this.eventHandlers.get(eventType)!;
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    } else {
      this.eventHandlers.delete(eventType);
    }
  }

  /**
   * Get current connection state
   */
  public getState(): ConnectionState {
    return { ...this.state };
  }

  /**
   * Reconnect to the SSE endpoint
   */
  private reconnect(): void {
    if (this.options.retryAttempts !== -1 && this.reconnectAttempt >= this.options.retryAttempts) {
      console.error('Maximum retry attempts reached, stopping reconnection');
      this.state.error = new Error('Maximum retry attempts reached');
      this.emit('error', this.state.error);
      return;
    }

    const delay = this.calculateReconnectDelay();
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempt + 1})`);

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempt++;
      this.connect();
    }, delay);
  }

  /**
   * Calculate reconnect delay with exponential backoff
   */
  private calculateReconnectDelay(): number {
    // Exponential backoff: baseInterval * 2^attempt, capped at maxReconnectInterval
    const delay = Math.min(
      this.options.reconnectInterval! * Math.pow(2, this.reconnectAttempt),
      this.options.maxReconnectInterval!
    );
    
    // Add some jitter to prevent thundering herd
    const jitter = Math.random() * 0.3 * delay;
    return delay + jitter;
  }

  /**
   * Handle connection open
   */
  private handleConnectionOpen(): void {
    this.state = {
      connected: true,
      connecting: false,
      disconnected: false,
    };
    
    this.reconnectAttempt = 0; // Reset attempt counter on successful connection
    
    // Start heartbeat timer
    this.startHeartbeatTimer();
    
    console.log('SSE connection established');
    this.emit('connected');
  }

  /**
   * Handle connection error
   */
  private handleConnectionError(error: any): void {
    this.state = {
      connected: false,
      connecting: false,
      disconnected: true,
      error: error instanceof Error ? error : new Error(String(error)),
    };

    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.heartbeatReceivedTimer) {
      clearTimeout(this.heartbeatReceivedTimer);
      this.heartbeatReceivedTimer = null;
    }

    console.error('SSE connection error:', error);
    this.emit('error', error);

    // Attempt to reconnect
    this.reconnect();
  }

  /**
   * Handle incoming message
   */
  private handleMessage(event: MessageEvent): void {
    try {
      // Parse the data - it might be a JSON string or plain text
      let parsedData: any;
      try {
        parsedData = JSON.parse(event.data);
      } catch {
        parsedData = event.data;
      }

      // Emit the event to registered handlers
      const eventType = event.type || 'message';
      this.emit(eventType, parsedData);

      // Also emit to specific event handlers
      if (this.eventHandlers.has(eventType)) {
        const handlers = this.eventHandlers.get(eventType)!;
        for (const handler of handlers) {
          try {
            handler(parsedData);
          } catch (handlerError) {
            console.error(`Error in event handler for ${eventType}:`, handlerError);
          }
        }
      }
    } catch (error) {
      console.error('Error processing SSE message:', error);
      this.emit('error', error);
    }
  }

  /**
   * Handle heartbeat message
   */
  private handleHeartbeat(event: Event): void {
    // Received heartbeat, reset the received timer
    if (this.heartbeatReceivedTimer) {
      clearTimeout(this.heartbeatReceivedTimer);
    }

    // Set a new timer to check if we receive heartbeats
    this.heartbeatReceivedTimer = setTimeout(() => {
      console.warn('Heartbeat timeout - connection appears to be dead');
      if (this.eventSource) {
        this.eventSource.close(); // Force close to trigger reconnect
      }
    }, this.options.heartbeatTimeout);

    // Emit heartbeat event
    this.emit('heartbeat', event);
  }

  /**
   * Handle connected message
   */
  private handleConnected(event: Event): void {
    // Reset heartbeat timers when we get confirmation of connection
    if (this.heartbeatReceivedTimer) {
      clearTimeout(this.heartbeatReceivedTimer);
    }

    this.startHeartbeatTimer();
    
    // Emit connected event
    this.emit('connected');
  }

  /**
   * Start heartbeat timer to detect connection loss
   */
  private startHeartbeatTimer(): void {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
    }

    // Set a timer to check if we receive heartbeats
    this.heartbeatReceivedTimer = setTimeout(() => {
      console.warn('Heartbeat timeout - connection appears to be dead');
      if (this.eventSource) {
        this.eventSource.close(); // Force close to trigger reconnect
      }
    }, this.options.heartbeatTimeout);
  }

  /**
   * Build URL with headers as query parameters (since EventSource doesn't support custom headers)
   */
  private buildUrlWithHeaders(): string {
    const url = new URL(this.options.url, window.location.origin);
    
    // Add headers as query parameters
    Object.entries(this.options.headers || {}).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    return url.toString();
  }
}