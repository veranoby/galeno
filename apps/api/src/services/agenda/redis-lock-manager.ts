// apps/api/src/services/agenda/redis-lock-manager.ts
import redis from '../../config/redis.js';
import { logger } from '../../utils/logger.js';

export interface LockOptions {
  timeout?: number; // Lock expiration in seconds (default: 30)
  retryDelay?: number; // Delay between retries in ms (default: 100)
  maxRetries?: number; // Maximum retry attempts (default: 5)
  autoRenew?: boolean; // Whether to auto-renew the lock (default: false)
}

export interface ExtendedLockOptions extends LockOptions {
  resourceKey: string;
  requestId: string;
}

export class RedisLockManager {
  private static readonly DEFAULT_OPTIONS: Required<LockOptions> = {
    timeout: 30,
    retryDelay: 100,
    maxRetries: 5,
    autoRenew: false
  };

  /**
   * Acquires a distributed lock using Redis
   * @param resourceKey Unique identifier for the resource to lock
   * @param options Lock configuration options
   * @returns Promise<boolean> indicating if lock was acquired
   */
  static async acquireLock(resourceKey: string,  options: LockOptions = {}): Promise<boolean> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const requestId = `${Date.now()}-${Math.random()}`; // Unique request ID
    
    const lockKey = `lock:${resourceKey}`;
    const lockValue = JSON.stringify({
      requestId, 
      timestamp: new Date().toISOString(),
      resourceKey,
      ttl: opts.timeout
    });

    // Attempt to acquire the lock
    const lockAcquired = await redis.set(
      lockKey, 
      lockValue, 
      'PX',  // Set expiry in milliseconds
      opts.timeout * 1000,  // Convert seconds to milliseconds
      'NX' // Only set if key doesn't exist (atomic operation)
    );

    if (lockAcquired === 'OK') {
      logger.info({ requestId }, `Lock acquired for resource: ${resourceKey}`);
      
      // Start auto-renewal if enabled
      if (opts.autoRenew) {
        this.startAutoRenewal(lockKey,  lockValue,  opts);
      }
      
      return true;
    }

    logger.warn(`Failed to acquire lock for resource: ${resourceKey}`);
    return false;
  }

  /**
   * Releases a previously acquired lock
   * @param resourceKey The resource key that was locked
   * @param requestId The request ID that acquired the lock
   * @returns Promise<boolean> indicating if lock was released
   */
  static async releaseLock(resourceKey: string,  requestId: string): Promise<boolean> {
    const lockKey = `lock:${resourceKey}`;
    
    // Use Lua script to ensure atomicity: only delete if value matches
    const luaScript = `
      if redis.call("GET",  KEYS[1]) == ARGV[1] then
        return redis.call("DEL",  KEYS[1])
      else
        return 0
      end
    `;
    
    try {
      const result = await redis.eval(luaScript,  1,  lockKey,  
        JSON.stringify({
          requestId, 
          resourceKey, 
          timestamp: null,  // We don't validate timestamp in release
          ttl: null
        })
      );
      
      const deleted = result === 1;
      if (deleted) {
        logger.info({ requestId }, `Lock released for resource: ${resourceKey}`);
      } else {
        logger.warn({ requestId }, `Failed to release lock for resource: ${resourceKey} - lock not owned by requester`);
      }
      
      return deleted;
    } catch (error) {
      logger.error('Error releasing lock:', error);
      return false;
    }
  }

  /**
   * Attempts to acquire a lock with retry logic
   * @param resourceKey Unique identifier for the resource to lock
   * @param options Lock configuration options
   * @returns Promise with lock acquisition status and request ID
   */
  static async acquireLockWithRetry(resourceKey: string,  options: LockOptions = {}): Promise<{ acquired: boolean; requestId?: string }> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    let retries = 0;
    
    while (retries <= opts.maxRetries) {
      const acquired = await this.acquireLock(resourceKey, opts);
      const requestId = `${Date.now()}-${Math.random()}`;

      if (acquired) {
        return { acquired: true, requestId };
      }
      
      if (retries < opts.maxRetries) {
        logger.debug({ resourceKey, attempt: retries + 1, maxRetries: opts.maxRetries }, `Retrying lock acquisition`);
        await this.delay(opts.retryDelay);
      }
      
      retries++;
    }
    
    logger.warn(`Failed to acquire lock for ${resourceKey} after ${opts.maxRetries} retries`);
    return { acquired: false };
  }

  /**
   * Executes a function with automatic lock acquisition and release
   * @param resourceKey Resource to lock
   * @param fn Function to execute while holding the lock
   * @param options Lock options
   * @returns Promise<T> Result of the function execution
   */
  static async executeWithLock<T>(
    resourceKey: string,  
    fn: () => Promise<T>, 
    options: LockOptions = {}
  ): Promise<T> {
    const result = await this.acquireLockWithRetry(resourceKey,  options);
    
    if (!result.acquired || !result.requestId) {
      throw new Error(`Could not acquire lock for resource: ${resourceKey}`);
    }
    
    const requestId = result.requestId;
    
    try {
      const fnResult = await fn();
      return fnResult;
    } finally {
      // Release the lock in the background
      setImmediate(async () => {
        try {
          await this.releaseLock(resourceKey,  requestId);
        } catch (error) {
          logger.error('Error releasing lock in finally block:', error);
        }
      });
    }
  }

  /**
   * Extends an existing lock by updating its TTL
   * @param resourceKey Resource key of the existing lock
   * @param requestId Request ID that owns the lock
   * @param additionalSeconds Additional seconds to extend the lock
   * @returns Promise<boolean> indicating if extension was successful
   */
  static async extendLock(resourceKey: string,  requestId: string,  additionalSeconds: number): Promise<boolean> {
    const lockKey = `lock:${resourceKey}`;
    
    // Check if the lock exists and is owned by the requester
    const currentValue = await redis.get(lockKey);
    if (!currentValue) {
      logger.warn(`Cannot extend lock: lock does not exist for resource: ${resourceKey}`);
      return false;
    }
    
    try {
      const parsedValue = JSON.parse(currentValue);
      if (parsedValue.requestId !== requestId) {
        logger.warn(`Cannot extend lock: lock owned by different requester for resource: ${resourceKey}`);
        return false;
      }
      
      // Extend the TTL
      await redis.expire(lockKey, parsedValue.ttl + additionalSeconds);

      // Update the stored value with new TTL
      parsedValue.ttl += additionalSeconds;
      await redis.set(lockKey, JSON.stringify(parsedValue), 'EX', parsedValue.ttl);

      logger.info({ requestId, newTtl: parsedValue.ttl }, `Lock extended for resource: ${resourceKey}`);
      
      return true;
    } catch (error) {
      logger.error('Error extending lock:', error);
      return false;
    }
  }

  private static startAutoRenewal(lockKey: string,  lockValue: string,  options: Required<LockOptions>): void {
    const parsedValue = JSON.parse(lockValue);
    const requestId = parsedValue.requestId;
    
    // Renew the lock halfway through its TTL
    const renewalInterval = Math.floor(options.timeout * 1000 / 2);
    
    const intervalId = setInterval(async () => {
      try {
        // Verify the lock still belongs to us before renewing
        const currentValue = await redis.get(lockKey);
        if (currentValue === lockValue) {
          // Extend the lock
          await redis.expire(lockKey, options.timeout);
          logger.debug({ requestId }, `Lock renewed for key: ${lockKey}`);
        } else {
          // Lock is no longer ours, stop renewal
          clearInterval(intervalId);
          logger.info({ requestId }, `Lock renewal stopped - lock no longer owned by requester`);
        }
      } catch (error) {
        logger.error('Error during lock renewal:', error);
        clearInterval(intervalId);
      }
    }, renewalInterval);
    
    // Stop renewal after the expected operation time (with buffer)
    setTimeout(() => {
      clearInterval(intervalId);
      logger.debug({ requestId }, `Lock renewal stopped after timeout for key: ${lockKey}`);
    }, options.timeout * 1000 * 3); // 3x timeout as safety buffer
  }

  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve,  ms));
  }
}