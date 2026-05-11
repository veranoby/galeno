import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SSEService } from '@/services/SSEService';
import { useSSE } from '@/composables/useSSE';

// Mock the useSSE composable
vi.mock('@/composables/useSSE', () => ({
  useSSE: vi.fn()
}));

describe('SSEService', () => {
  const mockSSEClient = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: true,
    lastEventId: '123',
    error: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  };

  beforeEach(() => {
    // Clear all connections before each test
    SSEService.disconnectAll();
    (useSSE as any).mockReturnValue(mockSSEClient);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('creates a new connection', () => {
    const options = {
      url: 'https://test.example.com/events'
    };

    const client = SSEService.createConnection('test-conn', options);

    expect(client).toBeDefined();
    expect(SSEService.hasConnection('test-conn')).toBe(true);
    expect(mockSSEClient.connect).toHaveBeenCalled();
  });

  it('gets an existing connection', () => {
    const options = {
      url: 'https://test.example.com/events'
    };

    SSEService.createConnection('test-conn', options);
    const client = SSEService.getConnection('test-conn');

    expect(client).toBeDefined();
    expect(client).toBe(mockSSEClient);
  });

  it('returns undefined for non-existent connection', () => {
    const client = SSEService.getConnection('non-existent');

    expect(client).toBeUndefined();
  });

  it('removes a connection', () => {
    const options = {
      url: 'https://test.example.com/events'
    };

    SSEService.createConnection('test-conn', options);
    expect(SSEService.hasConnection('test-conn')).toBe(true);

    SSEService.removeConnection('test-conn');
    expect(SSEService.hasConnection('test-conn')).toBe(false);
    expect(mockSSEClient.disconnect).toHaveBeenCalled();
  });

  it('adds an event listener to a connection', () => {
    const options = {
      url: 'https://test.example.com/events'
    };

    SSEService.createConnection('test-conn', options);
    const handler = vi.fn();
    
    SSEService.addEventListener('test-conn', 'message', handler);

    expect(mockSSEClient.addEventListener).toHaveBeenCalledWith('message', handler);
  });

  it('returns connection status', () => {
    const options = {
      url: 'https://test.example.com/events'
    };

    SSEService.createConnection('test-conn', options);
    const isConnected = SSEService.isConnected('test-conn');

    expect(isConnected.value).toBe(true);
  });

  it('returns last event ID', () => {
    const options = {
      url: 'https://test.example.com/events'
    };

    SSEService.createConnection('test-conn', options);
    const lastEventId = SSEService.getLastEventId('test-conn');

    expect(lastEventId).toBe('123');
  });

  it('returns error status', () => {
    const options = {
      url: 'https://test.example.com/events'
    };

    // Update mock to simulate an error
    const errorMock = {
      ...mockSSEClient,
      error: new Error('Test error')
    };
    (useSSE as any).mockReturnValue(errorMock);

    SSEService.createConnection('test-conn', options);
    const error = SSEService.getError('test-conn');

    expect(error).toEqual(new Error('Test error'));
  });

  it('disconnects all connections', () => {
    const options = {
      url: 'https://test.example.com/events'
    };

    SSEService.createConnection('conn1', options);
    SSEService.createConnection('conn2', options);

    expect(SSEService.getAllConnections()).toHaveLength(2);

    SSEService.disconnectAll();

    expect(SSEService.getAllConnections()).toHaveLength(0);
    expect(mockSSEClient.disconnect).toHaveBeenCalledTimes(2); // Called for each connection
  });
});