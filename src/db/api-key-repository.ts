import { PrismaClient } from '@prisma/client'
import type { ApiKey } from '@prisma/client'

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
    return this.prisma.apiKey.create({
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
  }

  /**
   * Find API key by hashed value
   */
  async findByHashedKey(hashedApiKey: string): Promise<ApiKey | null> {
    return this.prisma.apiKey.findUnique({
      where: { hashedApiKey }
    })
  }

  /**
   * Find API keys by searchable hash (first 8 bytes of SHA-1)
   * Returns multiple results as hash collisions are possible
   */
  async findBySearchableHash(searchableHash: string): Promise<ApiKey[]> {
    return this.prisma.apiKey.findMany({
      where: { searchableHash }
    })
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
    return this.prisma.apiKey.update({
      where: { hashedApiKey },
      data: {
        usedCount: { increment: 1 }
      }
    })
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
    const result = await this.prisma.apiKey.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
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
