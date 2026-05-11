import { App } from 'vue';
import { useSSE } from '../composables/useSSE.js';

declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    $sse: {
      connect: (userId: string) => void;
      disconnect: () => void;
      connected: boolean;
    };
  }
}

export interface SSEPluginOptions {
  userId?: string;
}

export const SSEPlugin = {
  install(app: App, options: SSEPluginOptions = {}) {
    // Create a global SSE instance
    let sseInstance: ReturnType<typeof useSSE> | null = null;
    
    // Method to initialize SSE with a specific user
    const initSSE = (userId: string) => {
      if (sseInstance) {
        sseInstance.disconnect();
      }
      
      sseInstance = useSSE(userId);
      
      // Auto-connect if userId is provided
      if (userId) {
        sseInstance.connect();
      }
      
      return sseInstance;
    };

    // Add global properties to Vue app
    app.config.globalProperties.$sse = {
      connect: (userId: string) => {
        const instance = initSSE(userId);
        instance?.connect();
      },
      disconnect: () => {
        sseInstance?.disconnect();
      },
      connected: () => sseInstance?.connected.value || false,
      getInstance: () => sseInstance
    };

    // Initialize with provided userId if available
    if (options.userId) {
      initSSE(options.userId);
    }

    // Listen for authentication events to manage SSE connections
    window.addEventListener('auth:login', (event: any) => {
      const userId = event.detail.userId;
      if (userId) {
        initSSE(userId);
        sseInstance?.connect();
      }
    });

    window.addEventListener('auth:logout', () => {
      sseInstance?.disconnect();
      sseInstance = null;
    });

    // Handle tab visibility changes to reconnect when tab becomes visible again
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && sseInstance && sseInstance.connected.value) {
        // Tab became visible, check if connection is still alive
        // In a real implementation, you might want to verify connection status
      }
    });
  }
};

export default SSEPlugin;