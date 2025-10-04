import type Redis from 'ioredis'

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
      return null
    }

    try {
      const parsed = JSON.parse(data)
      return {
        ...parsed,
        expiresAt: new Date(parsed.expiresAt)
      }
    } catch (error) {
      console.error('Failed to parse cached API key data:', error)
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
    
    await this.redis.setex(cacheKey, ttl || this.defaultTtl, serialized)
  }

  /**
   * Update usage count in cache
   */
  async incrementUsage(apiKey: string): Promise<number | null> {
    const data = await this.get(apiKey)
    
    if (!data) {
      return null
    }

    data.usedCount += 1
    await this.set(apiKey, data)
    
    return data.usedCount
  }

  /**
   * Delete API key from cache
   */
  async delete(apiKey: string): Promise<void> {
    const cacheKey = this.getCacheKey(apiKey)
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
