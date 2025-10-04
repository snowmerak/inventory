import type { PrismaClient } from '@prisma/client'
import { generateApiKey, hashApiKey, generateSearchableHash, validateItemKey } from '../utils/crypto'
import { ApiKeyRepository } from '../db/api-key-repository'
import { ValidationError, DuplicateError } from '../types/errors'
import type { PublishApiKeyRequest, PublishApiKeyResponse } from '../types/api'
import { metrics } from '../monitoring/metrics'

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
    const startTime = Date.now()
    // Validate item key format
    if (!validateItemKey(request.itemKey)) {
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
    console.log(`🔑 Generated API key for item: ${request.itemKey}`)

    // Step 2: Generate searchable hash (SHA-1 first 8 bytes)
    const searchableHash = generateSearchableHash(originalApiKey)
    console.log(`🔍 Generated searchable hash: ${searchableHash}`)

    // Step 3: Hash API key using Argon2id
    let hashedApiKey: string
    try {
      hashedApiKey = await hashApiKey(originalApiKey)
      console.log(`🔒 API key hashed successfully`)
    } catch (error) {
      console.error('Hashing failed:', error)
      throw new Error('Failed to hash API key')
    }

    // Step 4 & 5: Store in database with duplicate check
    try {
      // Check for duplicate (by hashed API key)
      const exists = await this.repository.exists(hashedApiKey)
      if (exists) {
        console.error('Duplicate API key detected')
        throw new DuplicateError('API key already exists (collision detected)')
      }

      // Store in database
      const apiKey = await this.repository.create({
        searchableHash,
        hashedApiKey,
        itemKey: request.itemKey,
        permission: request.permission,
        expiresAt,
        maxUses: request.maxUses
      })

      console.log(`✅ API key published: ${apiKey.id}`)

      // Record metrics
      metrics.incrementKeysPublished()
      metrics.recordPublishTime(Date.now() - startTime)

      // Step 6: Return original API key (only once!)
      return {
        success: true,
        data: {
          apiKey: originalApiKey, // Original key - shown only once!
          itemKey: apiKey.itemKey,
          permission: apiKey.permission,
          publishedAt: apiKey.publishedAt.toISOString(),
          expiresAt: apiKey.expiresAt.toISOString(),
          maxUses: apiKey.maxUses
        }
      }
    } catch (error) {
      if (error instanceof DuplicateError) {
        throw error
      }
      console.error('Storage failed:', error)
      throw new Error('Failed to store API key')
    }
  }
}
