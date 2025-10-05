import { PrismaClient } from '@prisma/client'
import type { ApiKey } from '@prisma/client'
import { logger } from '../utils/logger'

/**
 * API Key repository for database operations
 */
export class ApiKeyRepository {
  private prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /**
   * Create a new API key
   */
  /**
   * Create a new API key
   */
  async create(data: {
    searchableHash: string
    hashedApiKey: string
    itemKey: string
    permission: string[]
    expiresAt: Date
    maxUses: number
  }): Promise<ApiKey> {
    logger.db.debug('Creating new API key', {
      itemKey: data.itemKey,
      searchableHash: data.searchableHash,
      hashedApiKey: data.hashedApiKey,
      maxUses: data.maxUses,
      caller: 'ApiKeyRepository.create'
    })
    
    const result = await this.prisma.apiKey.create({
      data: {
        searchableHash: data.searchableHash,
        hashedApiKey: data.hashedApiKey,
        itemKey: data.itemKey,
        permission: data.permission,
        expiresAt: data.expiresAt,
        maxUses: data.maxUses,
        usedCount: 0
      }
    })
    
    logger.db.info('API key created successfully', {
      itemKey: data.itemKey,
      hashedApiKey: data.hashedApiKey,
      caller: 'ApiKeyRepository.create'
    })
    
    return result
  }

  /**
   * Find API key by hashed value
   */
  async findByHashedKey(hashedApiKey: string): Promise<ApiKey | null> {
    logger.db.debug('Finding API key by hashed key', {
      hashedApiKey,
      caller: 'ApiKeyRepository.findByHashedKey'
    })
    
    const result = await this.prisma.apiKey.findUnique({
      where: { hashedApiKey }
    })
    
    if (result) {
      logger.db.debug('API key found', {
        hashedApiKey,
        itemKey: result.itemKey,
        caller: 'ApiKeyRepository.findByHashedKey'
      })
    } else {
      logger.db.debug('API key not found', {
        hashedApiKey,
        caller: 'ApiKeyRepository.findByHashedKey'
      })
    }
    
    return result
  }

  /**
   * Find API keys by searchable hash (first 8 bytes of SHA-1)
   * Returns multiple results as hash collisions are possible
   */
  async findBySearchableHash(searchableHash: string): Promise<ApiKey[]> {
    logger.db.debug('Finding API keys by searchable hash', {
      searchableHash,
      caller: 'ApiKeyRepository.findBySearchableHash'
    })
    
    const results = await this.prisma.apiKey.findMany({
      where: { searchableHash }
    })
    
    logger.db.debug('API keys found by searchable hash', {
      searchableHash,
      count: results.length,
      caller: 'ApiKeyRepository.findBySearchableHash'
    })
    
    return results
  }

  /**
   * Check if API key already exists (for duplicate detection)
   */
  async exists(hashedApiKey: string): Promise<boolean> {
    const count = await this.prisma.apiKey.count({
      where: { hashedApiKey }
    })
    return count > 0
  }

  /**
   * Increment usage count
   */
  async incrementUsage(hashedApiKey: string): Promise<ApiKey> {
    logger.db.debug('Incrementing usage count', {
      hashedApiKey,
      caller: 'ApiKeyRepository.incrementUsage'
    })
    
    const result = await this.prisma.apiKey.update({
      where: { hashedApiKey },
      data: {
        usedCount: { increment: 1 }
      }
    })
    
    logger.db.debug('Usage count incremented', {
      hashedApiKey,
      usedCount: result.usedCount,
      maxUses: result.maxUses,
      caller: 'ApiKeyRepository.incrementUsage'
    })
    
    return result
  }

  /**
   * Find API keys by item key
   */
  async findByItemKey(itemKey: string): Promise<ApiKey[]> {
    return this.prisma.apiKey.findMany({
      where: { itemKey }
    })
  }

  /**
   * Delete expired API keys (cleanup job)
   */
  async deleteExpired(): Promise<number> {
    logger.db.info('Deleting expired API keys', {
      caller: 'ApiKeyRepository.deleteExpired'
    })
    
    const result = await this.prisma.apiKey.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    })
    
    logger.db.info('Expired API keys deleted', {
      deletedCount: result.count,
      caller: 'ApiKeyRepository.deleteExpired'
    })
    
    return result.count
  }

  /**
   * Get API key statistics
   */
  async getStats(hashedApiKey: string): Promise<{
    usedCount: number
    maxUses: number
    expiresAt: Date
  } | null> {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { hashedApiKey },
      select: {
        usedCount: true,
        maxUses: true,
        expiresAt: true
      }
    })
    return apiKey
  }
}
