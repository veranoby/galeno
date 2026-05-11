/**
 * Common SSE Event Types
 */
export enum SSEEventType {
  MESSAGE = 'message',
  NOTIFICATION = 'notification',
  UPDATE = 'update',
  ERROR = 'error',
  HEARTBEAT = 'heartbeat',
  CONNECT = 'connect',
  DISCONNECT = 'disconnect'
}

/**
 * Standard SSE Message Interface
 */
export interface SSEMessage {
  id?: string;
  type: SSEEventType | string;
  data: any;
  timestamp: number;
}

/**
 * Parses raw SSE data into a structured message
 * @param rawData Raw data from SSE event
 * @returns Parsed SSE message
 */
export function parseSSEMessage(rawData: string): SSEMessage {
  try {
    // Try to parse as JSON first
    const parsed = JSON.parse(rawData);
    
    // If it's already in our standard format
    if (parsed.type && parsed.data) {
      return {
        id: parsed.id,
        type: parsed.type,
        data: parsed.data,
        timestamp: parsed.timestamp || Date.now()
      };
    }
    
    // Otherwise wrap it in our standard format
    return {
      type: SSEEventType.MESSAGE,
      data: parsed,
      timestamp: Date.now()
    };
  } catch (error) {
    // If parsing fails, treat as plain text
    return {
      type: SSEEventType.MESSAGE,
      data: rawData,
      timestamp: Date.now()
    };
  }
}

/**
 * Creates an SSE message in the correct format
 * @param type Event type
 * @param data Message data
 * @param id Optional event ID
 * @returns Formatted message string
 */
export function createSSEMessage(type: string, data: any, id?: string): string {
  const message: SSEMessage = {
    type,
    data,
    timestamp: Date.now()
  };
  
  if (id) {
    message.id = id;
  }
  
  return JSON.stringify(message);
}

/**
 * Validates if the received data is a valid SSE message
 * @param data Message data to validate
 * @returns Boolean indicating validity
 */
export function isValidSSEMessage(data: any): boolean {
  if (!data) return false;
  
  // If it's a string, try to parse it
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      return typeof parsed.type === 'string';
    } catch {
      return false;
    }
  }
  
  // If it's already an object, check for required properties
  return typeof data.type === 'string';
}

/**
 * Extracts the event type from SSE data
 * @param data SSE data
 * @returns Event type string
 */
export function extractEventType(data: any): string {
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      return parsed.type || SSEEventType.MESSAGE;
    } catch {
      return SSEEventType.MESSAGE;
    }
  }
  
  return data?.type || SSEEventType.MESSAGE;
}