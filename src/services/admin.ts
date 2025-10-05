import type { PrismaClient } from '@prisma/client'
import { ApiKeyRepository } from '../db/api-key-repository'
import { NotFoundError } from '../types/errors'
import { logger } from '../utils/logger'

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
    logger.admin.info('Listing keys by item', {
      itemKey,
      caller: 'AdminService.listKeysByItem'
    })
    
    const keys = await this.repository.findByItemKey(itemKey)
    
    logger.admin.info('Keys listed', {
      itemKey,
      count: keys.length,
      caller: 'AdminService.listKeysByItem'
    })
    
    logger.admin.info('Overall stats retrieved', {
      totalKeys,
      expiredKeys,
      exhaustedKeys,
      activeKeys: totalKeys - expiredKeys - exhaustedKeys,
      caller: 'AdminService.getOverallStats'
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
    logger.admin.info('Revoking API key', {
      hashedApiKey,
      caller: 'AdminService.revokeKey'
    })
    
    const key = await this.repository.findByHashedKey(hashedApiKey)
    
    if (!key) {
      logger.admin.warn('API key not found for revocation', {
        hashedApiKey,
        caller: 'AdminService.revokeKey'
      })
      throw new NotFoundError('API key not found')
    }

    const updated = await prisma.apiKey.update({
      where: { hashedApiKey },
      data: {
        expiresAt: new Date() // Set to now, will be cleaned up by TTL
      }
    })
    
    logger.admin.info('API key revoked', {
      id: updated.id,
      itemKey: key.itemKey,
      revokedAt: updated.expiresAt.toISOString(),
      caller: 'AdminService.revokeKey'
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
