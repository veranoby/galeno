# Server-Sent Events (SSE) Infrastructure

This document describes the Server-Sent Events (SSE) infrastructure implemented for the Galeno platform as part of the v1.1 implementation plan.

## Overview

The SSE infrastructure enables real-time notifications between the server and connected clients. It's designed to support:
- Real-time triage notifications to doctors
- Multi-instance server support via Redis Pub/Sub
- Automatic reconnection with exponential backoff
- Scalable connection management

## Architecture

### Backend Components

#### 1. SSE Registry (`apps/api/src/services/sse/sse-registry.ts`)
- Manages active SSE connections
- Handles client subscriptions/unsubscriptions
- Sends messages to individual users or broadcasts to all
- Implements heartbeat mechanism to keep connections alive

#### 2. SSE Manager (`apps/api/src/services/sse/sse-manager.ts`)
- Integrates with Redis for multi-instance support
- Handles cross-server event distribution
- Manages Redis Pub/Sub channels
- Provides high-level methods for sending notifications

#### 3. SSE Routes (`apps/api/src/routes/v1/sse.routes.ts`)
- `/sse/subscribe` - Establish SSE connection
- `/sse/broadcast` - Send message to all connected clients
- `/sse/send-to-user` - Send message to specific user
- `/sse/status` - Get connection status

#### 4. Triage Service (`apps/api/src/services/enfermeria/triaje-service.ts`)
- Updates triage data and notifies doctors
- Emits `TRIAGE_COMPLETED` events via SSE
- Integrates with consultation workflow

### Frontend Components

#### 1. useSSE Composable (`apps/web/src/composables/useSSE.ts`)
- Vue composable for managing SSE connections
- Handles automatic reconnection with exponential backoff
- Emits events globally for application-wide listening

#### 2. SSE Plugin (`apps/web/src/plugins/sse.ts`)
- Vue plugin for global SSE access
- Handles authentication events
- Manages connection lifecycle

#### 3. Doctor Dashboard Integration
- Listens for `TRIAGE_COMPLETED` events
- Automatically refreshes pending consultations
- Provides real-time updates to doctors

## Redis Pub/Sub Channels

- `notifications` - General notifications channel
- `triage_updates` - Triage completion notifications

## Usage Examples

### Backend: Sending a Notification
```typescript
import { sseManager } from '../services/sse/sse-manager';

// Send to specific user
await sseManager.sendToUser(userId, {
  type: 'NEW_MESSAGE',
  data: { message: 'Hello!' },
  timestamp: Date.now()
});

// Broadcast to all users
await sseManager.broadcast({
  type: 'ANNOUNCEMENT',
  data: { text: 'System maintenance scheduled' },
  timestamp: Date.now()
});
```

### Frontend: Using the Composable
```typescript
import { useSSE } from '@/composables/useSSE';

const sse = useSSE(currentUser.id);
sse.connect();

// Listen for events
window.addEventListener('sse-message', (event) => {
  console.log('Received SSE message:', event.detail);
});

// Listen for specific event types
window.addEventListener('sse-NEW_MESSAGE', (event) => {
  console.log('New message:', event.detail.data);
});
```

## Error Handling & Reliability

- Automatic reconnection with exponential backoff
- Heartbeat mechanism to detect broken connections
- Proper cleanup of disconnected clients
- Error logging and monitoring
- Graceful degradation when Redis is unavailable

## Security Considerations

- Authentication required for all SSE endpoints
- Users can only subscribe to their own events
- Proper authorization checks in place
- Secure connection handling

## Scaling Considerations

- Redis Pub/Sub enables multi-instance support
- Connection registry allows horizontal scaling
- Efficient memory management for active connections
- Channel-based messaging for targeted delivery

## Monitoring

- Active connection count available via `/sse/status`
- Logging for connection events and errors
- Integration with existing monitoring infrastructure

## Future Enhancements

- Topic-based subscriptions for more granular control
- Message persistence for missed events
- Enhanced security with signed tokens
- Performance optimizations for high-volume scenarios