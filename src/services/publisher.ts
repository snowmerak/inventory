import type { PrismaClient } from '@prisma/client'
import { generateApiKey, hashApiKey, generateSearchableHash, validateItemKey } from '../utils/crypto'
import { ApiKeyRepository } from '../db/api-key-repository'
import { ValidationError, DuplicateError } from '../types/errors'
import type { PublishApiKeyRequest, PublishApiKeyResponse } from '../types/api'
import { metrics } from '../monitoring/metrics'
import { logger, performance } from '../utils/logger'

/**
 * Publisher Service - Handles API key generation and publishing
 * Implements the publishing flow from blueprint.d2
 */
export class PublisherService {
  private repository: ApiKeyRepository

  constructor(prisma: PrismaClient) {
    this.repository = new ApiKeyRepository(prisma)
  }

  /**
   * Publish a new API key
   * 
   * Flow:
   * 1. Validate input
   * 2. Generate random 64-character API key
   * 3. Hash API key using Argon2id
   * 4. Check for duplicates
   * 5. Store in database
   * 6. Return original API key (only once!)
   */
  async publishApiKey(request: PublishApiKeyRequest): Promise<PublishApiKeyResponse> {
    logger.service.info('Publishing API key', {
      itemKey: request.itemKey,
      permissions: request.permission,
      expiresAt: request.expiresAt,
      maxUses: request.maxUses,
      caller: 'PublisherService.publishApiKey'
    })
    
    const timer = performance.start('API key publishing', {
      itemKey: request.itemKey,
      caller: 'PublisherService.publishApiKey'
    })
    // Validate item key format
    if (!validateItemKey(request.itemKey)) {
      logger.service.warn('Invalid item key format', {
        itemKey: request.itemKey,
        caller: 'PublisherService.publishApiKey'
      })
      throw new ValidationError(
        'Invalid item key format. Expected: <scheme>://<service>/<key>?<query>'
      )
    }

    // Validate permissions array
    if (!Array.isArray(request.permission) || request.permission.length === 0) {
      throw new ValidationError('Permission array must not be empty')
    }

    // Validate expiration date
    const expiresAt = new Date(request.expiresAt)
    if (isNaN(expiresAt.getTime())) {
      throw new ValidationError('Invalid expiresAt date format')
    }

    if (expiresAt <= new Date()) {
      throw new ValidationError('expiresAt must be in the future')
    }

    // Validate max uses
    if (request.maxUses <= 0) {
      throw new ValidationError('maxUses must be greater than 0')
    }

    // Step 1: Generate random API key (64 characters)
    const originalApiKey = generateApiKey()
    logger.service.debug('Generated API key', {
      itemKey: request.itemKey,
      caller: 'PublisherService.publishApiKey'
    })

    // Step 2: Generate searchable hash (SHA-1 first 8 bytes)
    const searchableHash = generateSearchableHash(originalApiKey)
    logger.service.debug('Generated searchable hash', {
      searchableHash,
      caller: 'PublisherService.publishApiKey'
    })

    // Step 3: Hash API key using Argon2id
    let hashedApiKey: string
    try {
      hashedApiKey = await hashApiKey(originalApiKey)
      logger.service.debug('API key hashed successfully', {
        caller: 'PublisherService.publishApiKey'
      })
    } catch (error) {
      if (error instanceof DuplicateError) {
        throw error
      }
      logger.service.error('Storage failed', {
        error: (error as Error).message,
        itemKey: request.itemKey,
        caller: 'PublisherService.publishApiKey'
      })
      timer.error(error as Error, { step: 'storage' })
      throw new Error('Failed to store API key')
    }
  }
}
