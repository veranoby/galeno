# Client-Side SSE Handling (TASK-032)

This implementation provides a robust Server-Sent Events (SSE) client solution for Vue 3 applications with automatic reconnection, event handling, and proper cleanup.

## Features

- **Vue 3 Composition API**: Built with Vue 3 composables for optimal integration
- **Automatic Reconnection**: Implements exponential backoff for reconnection attempts
- **Heartbeat Mechanism**: Detects broken connections and triggers reconnection
- **Event Handling**: Support for multiple event types with dedicated handlers
- **Memory Leak Prevention**: Proper cleanup on component unmount
- **Error Handling**: Comprehensive error reporting and recovery
- **Type Safety**: Full TypeScript support with detailed interfaces

## Components

### 1. `useSSE` Composable (`src/composables/useSSE.ts`)

The core composable that handles SSE connections with the following features:

- Automatic reconnection with exponential backoff
- Heartbeat mechanism to detect broken connections
- Support for multiple event types
- Proper cleanup on component unmount
- Custom headers support via query parameters
- Credential handling

#### Usage Example:

```typescript
import { useSSE } from '@/composables/useSSE';

const sseClient = useSSE({
  url: 'https://api.example.com/events',
  eventTypes: ['notification', 'update'],
  reconnectInterval: 1000, // Initial reconnect interval in ms
  maxReconnectInterval: 30000, // Max reconnect interval in ms
  heartbeatTimeout: 30000, // Timeout in ms to detect broken connections
  headers: { 'Authorization': 'Bearer token' }, // Will be added as query params
  withCredentials: true // Enable sending cookies
});

// Connect to the SSE endpoint
sseClient.connect();

// Add event listeners
sseClient.addEventListener('notification', (data) => {
  console.log('Received notification:', data);
});

// Disconnect when needed
// Note: Automatic cleanup happens on component unmount
```

### 2. `SSEService` (`src/services/SSEService.ts`)

A service layer that provides centralized management of multiple SSE connections:

- Create and manage multiple SSE connections
- Global connection registry
- Helper methods for common operations
- Automatic cleanup on page unload

#### Usage Example:

```typescript
import { SSEService } from '@/services/SSEService';

// Create a new connection
const sseClient = SSEService.createConnection('notifications', {
  url: 'https://api.example.com/notifications',
  eventTypes: ['message', 'notification']
});

// Add event listener
SSEService.addEventListener('notifications', 'notification', (data) => {
  console.log('Notification:', data);
});

// Check connection status
const isConnected = SSEService.isConnected('notifications');

// Remove connection when no longer needed
SSEService.removeConnection('notifications');
```

### 3. `SSEReceiver` Component (`src/components/SSEReceiver.vue`)

A demo component showing how to use the SSE composable in a Vue component:

- Visual connection status
- Event display
- Connection controls
- Proper event handling

### 4. `sseUtils` (`src/utils/sseUtils.ts`)

Utility functions for working with SSE messages:

- Message parsing and validation
- Standard message format
- Type definitions for common event types

## Configuration Options

The `useSSE` composable accepts the following options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `url` | `string` | - | Required: The SSE endpoint URL |
| `eventTypes` | `string[]` | `[]` | Additional event types to listen for |
| `reconnectInterval` | `number` | `1000` | Initial reconnection interval in ms |
| `maxReconnectInterval` | `number` | `30000` | Maximum reconnection interval in ms |
| `heartbeatTimeout` | `number` | `30000` | Time in ms to wait for heartbeat before reconnecting |
| `headers` | `Record<string, string>` | `undefined` | Headers to send (appended as query params) |
| `withCredentials` | `boolean` | `false` | Whether to send credentials with requests |

## Best Practices

1. **Always use the composable in a Vue component** - The cleanup logic relies on Vue's lifecycle hooks
2. **Handle errors appropriately** - Check the `error` property of the returned client
3. **Use the service layer for multiple connections** - The `SSEService` helps manage multiple connections globally
4. **Validate incoming data** - The utility functions help ensure data integrity
5. **Consider memory usage** - For long-lived connections, periodically clean up old event data

## Error Handling

The implementation includes comprehensive error handling:

- Network errors trigger automatic reconnection
- Heartbeat timeouts detect broken connections
- Invalid message formats are handled gracefully
- Errors are exposed through the `error` property

## Testing

To test the implementation, you can use the included test files:

- `test-sse-infrastructure.js` - Infrastructure tests
- Mock SSE server for development

## Security Considerations

- Credentials are sent only if explicitly enabled with `withCredentials`
- Headers are appended as query parameters (for compatibility)
- Messages are validated before processing
- Origin verification should be implemented on the server side

## Performance Notes

- Event listeners are properly cleaned up to prevent memory leaks
- Heartbeat mechanism uses efficient timeouts
- Multiple event handlers per event type are supported efficiently
- Connection state is reactive and optimized for Vue's reactivity system