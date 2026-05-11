/**
 * Types for Server-Sent Events (SSE) infrastructure
 */
import type { Response } from 'express';

export interface SSEClient {
  userId: string;
  response: Response;
  lastHeartbeat: number;
}

export interface SSEMessage {
  type: string;
  data: any;
  timestamp: number;
  userId?: string; // Optional - if targeting specific user
  topic?: string; // Optional - for topic-based routing
}

export interface SSESubscriptionRequest {
  userId: string;
  topics?: string[]; // Optional - specific topics to subscribe to
}