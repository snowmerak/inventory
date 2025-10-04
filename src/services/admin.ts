import type { PrismaClient } from '@prisma/client'
import { ApiKeyRepository } from '../db/api-key-repository'
import { NotFoundError } from '../types/errors'

/**
 * Admin Service - Handles administrative operations
 */
export class AdminService {
  private repository: ApiKeyRepository

  constructor(prisma: PrismaClient) {
    this.repository = new ApiKeyRepository(prisma)
  }

  /**
   * List all API keys for a specific item
   */
  async listKeysByItem(itemKey: string) {
    const keys = await this.repository.findByItemKey(itemKey)
    
    return {
      success: true,
      data: {
        itemKey,
        count: keys.length,
        keys: keys.map(key => ({
          id: key.id,
          itemKey: key.itemKey,
          permission: key.permission,
          publishedAt: key.publishedAt.toISOString(),
          expiresAt: key.expiresAt.toISOString(),
          usedCount: key.usedCount,
          maxUses: key.maxUses,
          isExpired: key.expiresAt <= new Date(),
          isExhausted: key.usedCount >= key.maxUses
        }))
      }
    }
  }

  /**
   * Get statistics for a specific API key
   */
  async getKeyStats(hashedApiKey: string) {
    const stats = await this.repository.getStats(hashedApiKey)
    
    if (!stats) {
      throw new NotFoundError('API key not found')
    }

    return {
      success: true,
      data: {
        usedCount: stats.usedCount,
        maxUses: stats.maxUses,
        remainingUses: stats.maxUses - stats.usedCount,
        expiresAt: stats.expiresAt.toISOString(),
        isExpired: stats.expiresAt <= new Date(),
        isExhausted: stats.usedCount >= stats.maxUses,
        utilizationRate: (stats.usedCount / stats.maxUses) * 100
      }
    }
  }

  /**
   * Delete expired API keys (manual cleanup)
   */
  async cleanupExpired() {
    const deletedCount = await this.repository.deleteExpired()
    
    return {
      success: true,
      data: {
        deletedCount,
        message: `Deleted ${deletedCount} expired API key(s)`
      }
    }
  }

  /**
   * Get overall statistics
   */
  async getOverallStats(prisma: PrismaClient) {
    const totalKeys = await prisma.apiKey.count()
    const expiredKeys = await prisma.apiKey.count({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    })
    // MongoDB doesn't support field-to-field comparison in where clause
    // Need to fetch all keys and filter in application
    const allKeys = await prisma.apiKey.findMany({
      select: {
        usedCount: true,
        maxUses: true
      }
    })
    const exhaustedKeys = allKeys.filter(k => k.usedCount >= k.maxUses).length

    // Get keys by item (top 10)
    const keysByItem = await prisma.apiKey.groupBy({
      by: ['itemKey'],
      _count: true,
      orderBy: {
        _count: {
          itemKey: 'desc'
        }
      },
      take: 10
    })

    return {
      success: true,
      data: {
        totalKeys,
        activeKeys: totalKeys - expiredKeys - exhaustedKeys,
        expiredKeys,
        exhaustedKeys,
        topItems: keysByItem.map(item => ({
          itemKey: item.itemKey,
          keyCount: item._count
        }))
      }
    }
  }

  /**
   * Revoke an API key (set expiration to now)
   */
  async revokeKey(hashedApiKey: string, prisma: PrismaClient) {
    const key = await this.repository.findByHashedKey(hashedApiKey)
    
    if (!key) {
      throw new NotFoundError('API key not found')
    }

    const updated = await prisma.apiKey.update({
      where: { hashedApiKey },
      data: {
        expiresAt: new Date() // Set to now, will be cleaned up by TTL
      }
    })

    return {
      success: true,
      data: {
        message: 'API key revoked successfully',
        id: updated.id,
        revokedAt: updated.expiresAt.toISOString()
      }
    }
  }
}
