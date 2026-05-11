import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { sseManager } from '../src/services/sse/sse-manager';
import { sseRegistry } from '../src/services/sse/sse-registry';
import { triajeService } from '../src/services/enfermeria/triaje-service';

// Mock Redis for testing
vi.mock('ioredis', () => {
  const mockRedis = vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    subscribe: vi.fn(),
    publish: vi.fn().mockResolvedValue(1),
    quit: vi.fn().mockResolvedValue('OK'),
    status: 'ready',
  }));

  return {
    default: mockRedis,
  };
});

describe('SSE Infrastructure', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    // Clear all SSE connections to avoid residual state
    const connectedUsers = (sseRegistry as any).getConnectedUsers();
    connectedUsers.forEach((userId: string) => {
      (sseRegistry as any).unsubscribe(userId);
    });
  });

  describe('SSE Manager', () => {
    it('should initialize successfully', async () => {
      const initializeSpy = vi.spyOn(sseManager as any, 'waitForReady').mockResolvedValue(undefined);
      const subscribeSpy = vi.spyOn((sseManager as any).redisSubscriber, 'subscribe').mockResolvedValue(undefined);
      const onSpy = vi.spyOn((sseManager as any).redisSubscriber, 'on').mockImplementation(() => {});

      await sseManager.initialize();

      expect(initializeSpy).toHaveBeenCalled();
      expect(subscribeSpy).toHaveBeenCalledWith('notifications');
      expect(subscribeSpy).toHaveBeenCalledWith('triage_updates');
      expect(onSpy).toHaveBeenCalled();
    });

    it('should publish messages to Redis channel', async () => {
      const publishSpy = vi.spyOn((sseManager as any).redisPublisher, 'publish').mockResolvedValue(1);

      const message = {
        type: 'TEST',
        data: { test: 'data' },
        timestamp: Date.now()
      };

      await sseManager.publishToChannel('notifications', message);

      expect(publishSpy).toHaveBeenCalledWith('notifications', JSON.stringify(message));
    });

    it('should send message to specific user', async () => {
      const publishSpy = vi.spyOn(sseManager, 'publishToChannel').mockResolvedValue(undefined);

      const message = { type: 'TEST', data: { test: 'data' }, timestamp: Date.now() };
      await sseManager.sendToUser('user123', message);

      expect(publishSpy).toHaveBeenCalledWith('notifications', expect.objectContaining({
        userId: 'user123',
        ...message
      }));
    });

    it('should broadcast message to all users', async () => {
      const publishSpy = vi.spyOn(sseManager, 'publishToChannel').mockResolvedValue(undefined);

      const message = { type: 'BROADCAST', data: { test: 'data' }, timestamp: Date.now() };
      await sseManager.broadcast(message);

      expect(publishSpy).toHaveBeenCalledWith('notifications', message);
    });
  });

  describe('SSE Registry', () => {
    it('should subscribe a user to SSE', () => {
      const mockResponse = {
        setHeader: vi.fn(),
        write: vi.fn(),
        end: vi.fn(),
        writeHead: vi.fn(),
        on: vi.fn(),
        removeListener: vi.fn(),
        destroyed: false,
      };

      sseRegistry.subscribe('user123', mockResponse as any);

      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Encoding', 'identity');
    });

    it('should send message to a specific user', () => {
      const mockResponse = {
        setHeader: vi.fn(),
        write: vi.fn(),
        end: vi.fn(),
        writeHead: vi.fn(),
        on: vi.fn(),
        removeListener: vi.fn(),
        destroyed: false,
      };

      sseRegistry.subscribe('user123', mockResponse as any);
      sseRegistry.sendToUser('user123', { test: 'data' });

      expect(mockResponse.write).toHaveBeenCalledWith(`data: ${JSON.stringify({ test: 'data' })}\n\n`);
    });

    it('should broadcast message to all users', () => {
      const mockResponse1 = {
        setHeader: vi.fn(),
        write: vi.fn(),
        end: vi.fn(),
        writeHead: vi.fn(),
        on: vi.fn(),
        removeListener: vi.fn(),
        destroyed: false,
      };

      const mockResponse2 = {
        setHeader: vi.fn(),
        write: vi.fn(),
        end: vi.fn(),
        writeHead: vi.fn(),
        on: vi.fn(),
        removeListener: vi.fn(),
        destroyed: false,
      };

      sseRegistry.subscribe('user123', mockResponse1 as any);
      sseRegistry.subscribe('user456', mockResponse2 as any);
      sseRegistry.broadcast({ test: 'broadcast' });

      expect(mockResponse1.write).toHaveBeenCalledWith(`data: ${JSON.stringify({ test: 'broadcast' })}\n\n`);
      expect(mockResponse2.write).toHaveBeenCalledWith(`data: ${JSON.stringify({ test: 'broadcast' })}\n\n`);
    });

    it('should return active connection count', () => {
      const mockResponse = {
        setHeader: vi.fn(),
        write: vi.fn(),
        end: vi.fn(),
        writeHead: vi.fn(),
        on: vi.fn(),
        removeListener: vi.fn(),
        destroyed: false,
      };

      sseRegistry.subscribe('user123', mockResponse as any);
      const count = sseRegistry.getActiveConnections();

      expect(count).toBe(1);
    });
  });

  describe('Triage Service', () => {
    it('should be defined', () => {
      expect(triajeService).toBeDefined();
    });

    // Additional tests would require mocking Prisma and other dependencies
    // These are more integration tests that would be covered separately
  });
});