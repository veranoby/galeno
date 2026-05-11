import { ref, onUnmounted, watch } from 'vue';
import { SSEManager } from '@/services/sse/manager';
import type { SSEMessage } from '@/utils/sseUtils';

export interface SSEOptions {
  reconnectInterval?: number;
  maxReconnectInterval?: number;
  heartbeatTimeout?: number;
  retryAttempts?: number;
}

/**
 * Composable for handling Server-Sent Events with automatic reconnection and heartbeat detection.
 * Uses SSEManager for the underlying connection logic.
 */
export function useSSE(userId: string, options: SSEOptions = {}) {
  const connected = ref(false);
  const connecting = ref(false);
  const events = ref<SSEMessage[]>([]);
  const error = ref<Error | null>(null);
  
  // Initialize SSE Manager
  const url = `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'}/sse/subscribe`;
  const token = localStorage.getItem('authToken') || '';
  
  const manager = new SSEManager({
    url,
    headers: {
      userId,
      token
    },
    ...options
  });

  // Handle connection state changes
  manager.on('connected', () => {
    connected.value = true;
    connecting.value = false;
    error.value = null;
    console.log('[SSE] Connected to server-sent events');
  });

  manager.on('disconnected', () => {
    connected.value = false;
    connecting.value = false;
    console.log('[SSE] Disconnected from server-sent events');
  });

  manager.on('error', (err: Error) => {
    connected.value = false;
    connecting.value = false;
    error.value = err;
    console.error('[SSE] Connection error:', err);
  });

  // Handle messages
  const handleMessage = (data: any) => {
    const message: SSEMessage = {
      type: data.type || 'message',
      data: data.data || data,
      timestamp: data.timestamp || Date.now()
    };
    
    events.value.push(message);

    // Emit event globally for other parts of the app to listen to
    window.dispatchEvent(new CustomEvent('sse-message', { detail: message }));

    // Also dispatch specific event types
    window.dispatchEvent(new CustomEvent(`sse-${message.type}`, { detail: message }));
  };

  // Subscribe to all message types
  manager.on('message', handleMessage);
  manager.on('NOTIFICATION', handleMessage);
  manager.on('TRIAGE_UPDATE', handleMessage);
  manager.on('APPOINTMENT_REMINDER', handleMessage);
  manager.on('CONSULTATION_STATUS_UPDATE', handleMessage);

  const connect = () => {
    connecting.value = true;
    manager.connect();
  };

  const disconnect = () => {
    manager.disconnect();
  };

  // Clean up on component unmount
  onUnmounted(() => {
    disconnect();
  });

  // Public API
  return {
    connected,
    connecting,
    events,
    error,
    connect,
    disconnect,
    
    // Helper methods
    clearEvents: () => {
      events.value = [];
    }
  };
}