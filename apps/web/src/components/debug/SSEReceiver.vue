<template>
  <div class="sse-demo">
    <h2>SSE Demo Component</h2>
    
    <div class="connection-status">
      <p>Status: 
        <span :class="{ 'connected': connected, 'disconnected': !connected }">
          {{ connected ? 'Connected' : 'Disconnected' }}
        </span>
      </p>
      <p v-if="error" class="error">Error: {{ error.message }}</p>
    </div>
    
    <div class="controls">
      <button @click="connect" :disabled="connected || connecting">
        {{ connecting ? 'Connecting...' : 'Connect' }}
      </button>
      <button @click="disconnect" :disabled="!connected">Disconnect</button>
      <button @click="clearEvents">Clear Logs</button>
    </div>
    
    <div class="events">
      <h3>Received Events:</h3>
      <div 
        v-for="(event, index) in events" 
        :key="index" 
        class="event-item"
      >
        <span class="event-time">[{{ formatTime(event.timestamp) }}]</span>
        <strong>{{ event.type }}:</strong> {{ JSON.stringify(event.data) }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSSE } from '@/composables/useSSE';
import { useAuthStore } from '@/stores/auth';
import { computed } from 'vue';

// Define props for the component
interface Props {
  eventTypes?: string[];
}

const props = withDefaults(defineProps<Props>(), {
  eventTypes: () => ['message', 'notification', 'update']
});

const authStore = useAuthStore();
const userId = computed(() => authStore.user?.id || 'anonymous');

// Initialize the SSE client
const {
  connected,
  connecting,
  events,
  error,
  connect,
  disconnect,
  clearEvents
} = useSSE(userId.value, {
  reconnectInterval: 1000,
  maxReconnectInterval: 30000,
  heartbeatTimeout: 30000
});

const formatTime = (ts: number) => {
  return new Date(ts).toLocaleTimeString();
};
</script>

<style scoped>
.sse-demo {
  padding: 20px;
  border: 1px solid #ccc;
  border-radius: 4px;
  margin: 10px 0;
  background: #f9f9f9;
}

.connection-status {
  margin-bottom: 20px;
}

.connected {
  color: green;
  font-weight: bold;
}

.disconnected {
  color: red;
}

.error {
  color: red;
}

.controls {
  margin-bottom: 20px;
  display: flex;
  gap: 10px;
}

.controls button {
  padding: 8px 16px;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
  background: white;
}

.controls button:hover:not(:disabled) {
  background: #eee;
}

.controls button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.events {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #eee;
  padding: 10px;
  background: white;
}

.event-item {
  padding: 4px 8px;
  border-bottom: 1px solid #eee;
  font-family: monospace;
  font-size: 0.9rem;
  word-break: break-all;
}

.event-time {
  color: #888;
  margin-right: 8px;
}
</style>
