import type Redis from 'ioredis'
import { logger } from '../utils/logger'

/**
 * API Key cache data structure
 */
export interface ApiKeyCacheData {
  hashedApiKey: string
  itemKey: string
  permission: string[]
  expiresAt: Date
  usedCount: number
  maxUses: number
}

/**
 * Cache helper for API key operations
 */
export class ApiKeyCache {
  private redis: Redis
  private keyPrefix = 'inventory:api_key:'
  private defaultTtl: number

  constructor(redis: Redis, ttl: number = 900) {
    this.redis = redis
    this.defaultTtl = ttl
  }

  /**
   * Get API key data from cache
   */
  async get(apiKey: string): Promise<ApiKeyCacheData | null> {
    const cacheKey = this.getCacheKey(apiKey)
    const data = await this.redis.get(cacheKey)
    
    if (!data) {
      logger.cache.debug('Cache miss for API key', {
        apiKey,
        caller: 'ApiKeyCache.get'
      })
      return null
    }
    
    logger.cache.debug('Cache hit for API key', {
      apiKey,
      caller: 'ApiKeyCache.get'
    })

    try {
      const parsed = JSON.parse(data)
      return {
        ...parsed,
        expiresAt: new Date(parsed.expiresAt)
      }
    } catch (error) {
      logger.cache.error('Failed to parse cached API key data', {
        apiKey,
        error: (error as Error).message,
        caller: 'ApiKeyCache.get'
      })
      return null
    }
  }

  /**
   * Set API key data in cache
   */
  async set(apiKey: string, data: ApiKeyCacheData, ttl?: number): Promise<void> {
    const cacheKey = this.getCacheKey(apiKey)
    const serialized = JSON.stringify({
      ...data,
      expiresAt: data.expiresAt.toISOString()
    })
    
    logger.cache.debug('Caching API key data', {
      apiKey,
      itemKey: data.itemKey,
      ttl: ttl || this.defaultTtl,
      caller: 'ApiKeyCache.set'
    })
    
    await this.redis.setex(cacheKey, ttl || this.defaultTtl, serialized)
  }

  /**
   * Update usage count in cache
   */
  async incrementUsage(apiKey: string): Promise<number | null> {
    const data = await this.get(apiKey)
    
    if (!data) {
      logger.cache.debug('Cannot increment usage - key not in cache', {
        apiKey,
        caller: 'ApiKeyCache.incrementUsage'
      })
      return null
    }

    data.usedCount += 1
    
    logger.cache.debug('Incremented usage count', {
      apiKey,
      usedCount: data.usedCount,
      maxUses: data.maxUses,
      caller: 'ApiKeyCache.incrementUsage'
    })
    
    await this.set(apiKey, data)
    
    return data.usedCount
  }

  /**
   * Delete API key from cache
   */
  async delete(apiKey: string): Promise<void> {
    const cacheKey = this.getCacheKey(apiKey)
    
    logger.cache.debug('Deleting API key from cache', {
      apiKey,
      caller: 'ApiKeyCache.delete'
    })
    
    await this.redis.del(cacheKey)
  }

  /**
   * Check if API key exists in cache
   */
  async exists(apiKey: string): Promise<boolean> {
    const cacheKey = this.getCacheKey(apiKey)
    const result = await this.redis.exists(cacheKey)
    return result === 1
  }

  private getCacheKey(apiKey: string): string {
    return `${this.keyPrefix}${apiKey}`
  }
}
