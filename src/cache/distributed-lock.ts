import type Redis from 'ioredis'

/**
 * Distributed lock implementation using Redis
 * Prevents race conditions in API key validation
 */
export class DistributedLock {
  private redis: Redis
  private lockKeyPrefix = 'inventory:lock:'
  private defaultTtl = 10000 // 10 seconds

  constructor(redis: Redis) {
    this.redis = redis
  }

  /**
   * Acquire a distributed lock
   * @param resource - Resource identifier (e.g., API key)
   * @param ttl - Lock TTL in milliseconds
   * @returns Lock token if acquired, null otherwise
   */
  async acquire(resource: string, ttl: number = this.defaultTtl): Promise<string | null> {
    const lockKey = this.getLockKey(resource)
    const lockValue = this.generateLockValue()
    
    // SET NX (set if not exists) with expiry
    const result = await this.redis.set(
      lockKey,
      lockValue,
      'PX', // milliseconds
      ttl,
      'NX'  // only set if not exists
    )

    return result === 'OK' ? lockValue : null
  }

  /**
   * Release a distributed lock
   * @param resource - Resource identifier
   * @param lockValue - Lock token returned from acquire
   * @returns true if released, false if lock doesn't exist or token mismatch
   */
  async release(resource: string, lockValue: string): Promise<boolean> {
    const lockKey = this.getLockKey(resource)
    
    // Lua script to ensure atomic check-and-delete
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `
    
    const result = await this.redis.eval(script, 1, lockKey, lockValue)
    return result === 1
  }

  /**
   * Execute a function with a distributed lock
   * @param resource - Resource identifier
   * @param fn - Function to execute while holding the lock
   * @param ttl - Lock TTL in milliseconds
   */
  async withLock<T>(
    resource: string,
    fn: () => Promise<T>,
    ttl: number = this.defaultTtl
  ): Promise<T> {
    const lockValue = await this.acquire(resource, ttl)
    
    if (!lockValue) {
      throw new Error(`Failed to acquire lock for resource: ${resource}`)
    }

    try {
      return await fn()
    } finally {
      await this.release(resource, lockValue)
    }
  }

  private getLockKey(resource: string): string {
    return `${this.lockKeyPrefix}${resource}`
  }

  private generateLockValue(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
}
