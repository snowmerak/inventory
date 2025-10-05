import type { Context } from 'elysia'
import type Redis from 'ioredis'
import { RateLimitError } from '../types/errors'
import { logger } from '../utils/logger'

/**
 * Rate limiter implementation using Redis
 * Implements sliding window rate limiting
 */
export class RateLimiter {
  private redis: Redis
  private keyPrefix = 'inventory:ratelimit:'

  constructor(redis: Redis) {
    this.redis = redis
  }

  /**
   * Check if request is allowed under rate limit
   * @param identifier - Usually IP address
   * @param maxRequests - Maximum requests allowed in window
   * @param windowMs - Time window in milliseconds
   * @returns true if allowed, throws RateLimitError if exceeded
   */
  async checkLimit(
    identifier: string,
    maxRequests: number,
    windowMs: number
  ): Promise<void> {
    const key = this.getRateLimitKey(identifier)
    const now = Date.now()
    const windowStart = now - windowMs
    
    logger.cache.debug('Checking rate limit', {
      identifier,
      maxRequests,
      windowMs,
      caller: 'RateLimiter.checkLimit'
    })

    // Use Redis sorted set for sliding window
    const multi = this.redis.multi()

    // Remove old entries outside the window
    multi.zremrangebyscore(key, 0, windowStart)

    // Count requests in current window
    multi.zcard(key)

    // Add current request
    multi.zadd(key, now, `${now}-${Math.random()}`)

    // Set expiry on the key
    multi.expire(key, Math.ceil(windowMs / 1000))

    const results = await multi.exec()

    if (!results) {
      throw new Error('Rate limit check failed')
    }

    // Get count from zcard command (index 1)
    const count = results[1][1] as number

    if (count >= maxRequests) {
      logger.cache.warn('Rate limit exceeded', {
        identifier,
        count,
        maxRequests,
        windowMs,
        caller: 'RateLimiter.checkLimit'
      })
      
      throw new RateLimitError(
        `Rate limit exceeded. Maximum ${maxRequests} requests per ${windowMs}ms`
      )
    }
    
    logger.cache.debug('Rate limit check passed', {
      identifier,
      count,
      maxRequests,
      caller: 'RateLimiter.checkLimit'
    })
  }

  /**
   * Get current usage stats
   */
  async getUsage(identifier: string, windowMs: number): Promise<{
    count: number
    resetAt: number
  }> {
    const key = this.getRateLimitKey(identifier)
    const now = Date.now()
    const windowStart = now - windowMs

    logger.cache.debug('Getting rate limit usage', {
      identifier,
      windowMs,
      caller: 'RateLimiter.getUsage'
    })

    // Clean old entries and count
    await this.redis.zremrangebyscore(key, 0, windowStart)
    const count = await this.redis.zcard(key)

    logger.cache.debug('Rate limit usage retrieved', {
      identifier,
      count,
      resetAt: now + windowMs,
      caller: 'RateLimiter.getUsage'
    })

    return {
      count,
      resetAt: now + windowMs
    }
  }

  private getRateLimitKey(identifier: string): string {
    return `${this.keyPrefix}${identifier}`
  }
}

/**
 * Extract client IP from request
 */
export function getClientIp(request: Request): string {
  // Check X-Forwarded-For header (for proxies/load balancers)
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  // Check X-Real-IP header
  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  // Fallback to direct connection
  return 'unknown'
}
