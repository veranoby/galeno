# SSE Manager Implementation Documentation

## Overview
This document describes the implementation of the Server-Sent Events (SSE) manager with automatic reconnection, heartbeat mechanism, and proper disconnection handling for both backend and frontend components.

## Features

### 1. Automatic Reconnection with Exponential Backoff
- Implements exponential backoff algorithm to prevent server overload during reconnection attempts
- Configurable base and maximum reconnection intervals
- Optional retry attempt limits
- Jitter added to prevent thundering herd problem

### 2. Heartbeat Mechanism
- Periodic heartbeat messages sent from server to client
- Client-side detection of missed heartbeats
- Automatic connection recovery when heartbeat timeouts occur
- Configurable heartbeat intervals and timeouts

### 3. Disconnection Handling
- Proper cleanup of resources on disconnection
- Detection of client disconnections on the server side
- Graceful handling of network interruptions
- Event emission for connection state changes

### 4. Connection State Visibility
- Real-time connection state tracking
- Methods to query current connection status
- Event emission for state changes

### 5. Event Management and Routing
- Support for multiple event types
- Subscription/unsubscription mechanisms
- Filtering capabilities for targeted message delivery
- Efficient broadcasting to multiple connections

## Backend Implementation (`apps/api/src/services/sse/manager.ts`)

### Core Components

#### SSEManager Class
- Singleton pattern implementation
- Manages multiple concurrent SSE connections
- Handles connection lifecycle
- Provides methods for sending events to specific connections or broadcasting

#### Connection Management
- Tracks active connections with metadata (ID, user ID, connection time)
- Maintains connection-specific heartbeat timers
- Handles client disconnect detection

#### Event Broadcasting
- `sendEventToConnection()` - Send event to specific connection
- `broadcastEvent()` - Send event to all connections (with optional filtering)
- `sendEventToUser()` - Send event to all connections of a specific user

#### Heartbeat System
- Server sends periodic heartbeat messages
- Client response timeout detection
- Automatic disconnection of unresponsive clients

## Frontend Implementation (`apps/web/src/services/sse/manager.ts`)

### Core Components

#### SSEManager Class
- Handles EventSource creation and management
- Implements reconnection logic
- Manages event subscriptions
- Tracks connection state

#### Connection Lifecycle
- `connect()` - Establish SSE connection
- `disconnect()` - Close connection and cleanup
- `reconnect()` - Handle automatic reconnection

#### Event Handling
- `subscribe()` - Subscribe to specific event types
- `unsubscribe()` - Remove event subscription
- Global event emission via EventEmitter

#### State Management
- `getState()` - Retrieve current connection state
- Connection state properties: connected, connecting, disconnected, error

## Usage Examples

### Backend Usage
```typescript
import { sseManager } from './services/sse/manager';

// In your route handler
app.get('/api/sse', (req, res) => {
  const userId = req.query.userId as string;
  sseManager.connect(req, res, userId);
});

// Send event to specific user
sseManager.sendEventToUser(userId, 'notification', { message: 'Hello!' });

// Broadcast to all connections
sseManager.broadcastEvent('announcement', { text: 'System update' });
```

### Frontend Usage
```typescript
import { SSEManager } from './services/sse/manager';

const sseManager = new SSEManager({
  url: 'http://localhost:3001/api/sse',
  reconnectInterval: 1000,
  maxReconnectInterval: 30000,
  heartbeatTimeout: 45000,
  headers: {
    'Authorization': 'Bearer token'
  }
});

// Subscribe to events
sseManager.subscribe('notification', (data) => {
  console.log('Received notification:', data);
});

// Connect to server
sseManager.connect();

// Check connection state
const state = sseManager.getState();
```

## Configuration Options

### Backend
- None required - uses standard Express request/response objects

### Frontend
- `url`: SSE endpoint URL
- `reconnectInterval`: Base interval for reconnection (default: 1000ms)
- `maxReconnectInterval`: Max interval for reconnection (default: 30000ms)
- `heartbeatTimeout`: Timeout for heartbeat detection (default: 45000ms)
- `retryAttempts`: Max reconnection attempts (-1 for infinite, default: -1)
- `headers`: Additional headers to send (as query params)

## Error Handling

### Backend
- Proper cleanup of resources on client disconnect
- Error logging for debugging
- Prevention of memory leaks

### Frontend
- Connection error detection and reporting
- Automatic reconnection attempts
- Heartbeat timeout detection

## Security Considerations

- Origin header checking (implemented in backend)
- User authentication through headers/query parameters
- Connection ID randomization to prevent guessing
- Rate limiting considerations (to be implemented at application level)

## Performance Considerations

- Efficient connection storage using Maps
- Minimal memory footprint per connection
- Proper cleanup of timers and resources
- Scalable architecture supporting multiple concurrent connections

## Testing

Test files are provided:
- `test-sse-backend.ts` - Backend testing
- `test-sse-frontend.ts` - Frontend testing
- `test-sse-frontend.html` - Browser-based testing