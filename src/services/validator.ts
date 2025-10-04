import type { PrismaClient } from '@prisma/client'
import type Redis from 'ioredis'
import { verifyApiKey, generateSearchableHash } from '../utils/crypto'
import { ApiKeyRepository } from '../db/api-key-repository'
import { ApiKeyCache } from '../cache/api-key-cache'
import { DistributedLock } from '../cache/distributed-lock'
import {
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ExpiredError,
  UsageLimitError,
  LockAcquisitionError
} from '../types/errors'
import type { ValidateApiKeyRequest, ValidateApiKeyResponse } from '../types/api'
import { metrics } from '../monitoring/metrics'

/**
 * Validator Service - Handles API key validation
 * Implements the validation flow from blueprint.d2
 */
export class ValidatorService {
  private repository: ApiKeyRepository
  private cache: ApiKeyCache
  private lock: DistributedLock

  constructor(prisma: PrismaClient, redis: Redis, cacheTtl: number = 900) {
    this.repository = new ApiKeyRepository(prisma)
    this.cache = new ApiKeyCache(redis, cacheTtl)
    this.lock = new DistributedLock(redis)
  }

  /**
   * Validate an API key
   * 
   * Flow:
   * 1. Acquire distributed lock
   * 2. Check cache first
   * 3. If not in cache, fetch from database
   * 4. Verify API key with Argon2id
   * 5. Check expiration and usage limits
   * 6. Increment usage count
   * 7. Update cache
   * 8. Release lock
   */
  async validateApiKey(request: ValidateApiKeyRequest): Promise<ValidateApiKeyResponse> {
    const startTime = Date.now()
    const { apiKey } = request

    if (!apiKey || apiKey.length === 0) {
      throw new ValidationError('API key is required')
    }

    // Step 1: Acquire distributed lock to prevent race conditions
    const lockKey = `validate:${apiKey}`
    const lockValue = await this.lock.acquire(lockKey, 10000) // 10 second TTL

    if (!lockValue) {
      throw new LockAcquisitionError('Failed to acquire lock for API key validation')
    }

    try {
      // Step 2: Check cache first
      let cachedData = await this.cache.get(apiKey)

      if (cachedData) {
        console.log(`📦 Cache hit for API key`)
        metrics.incrementCacheHit()
        
        // Verify the API key
        const isValid = await verifyApiKey(cachedData.hashedApiKey, apiKey)
        if (!isValid) {
          throw new UnauthorizedError('Invalid API key')
        }

        // Check expiration
        if (cachedData.expiresAt <= new Date()) {
          throw new ExpiredError('API key has expired')
        }

        // Check usage limits
        if (cachedData.usedCount >= cachedData.maxUses) {
          throw new UsageLimitError('API key usage limit exceeded')
        }

        // Increment usage count in cache and DB
        await this.cache.incrementUsage(apiKey)
        await this.repository.incrementUsage(cachedData.hashedApiKey)

        // Record metrics
        metrics.incrementKeysValidated()
        metrics.recordValidationTime(Date.now() - startTime)

        return {
          success: true,
          data: {
            valid: true,
            itemKey: cachedData.itemKey,
            permission: cachedData.permission,
            expiresAt: cachedData.expiresAt.toISOString(),
            usedCount: cachedData.usedCount + 1,
            maxUses: cachedData.maxUses
          }
        }
      }

      // Step 3: Cache miss - searching in database
      console.log(`💾 Cache miss - searching in database`)
      metrics.incrementCacheMiss()

      // Generate searchable hash from provided API key (SHA-1 first 8 bytes)
      const searchableHash = generateSearchableHash(apiKey)
      console.log(`🔍 Searching with hash: ${searchableHash}`)

      // Fetch all API keys with matching searchable hash
      const candidates = await this.repository.findBySearchableHash(searchableHash)
      
      if (candidates.length === 0) {
        throw new NotFoundError('API key not found')
      }

      console.log(`📋 Found ${candidates.length} candidate(s), verifying...`)

      // Step 4: Verify API key with Argon2id by iterating candidates
      let validApiKey = null
      for (const candidate of candidates) {
        const isValid = await verifyApiKey(candidate.hashedApiKey, apiKey)
        if (isValid) {
          validApiKey = candidate
          break
        }
      }

      if (!validApiKey) {
        throw new UnauthorizedError('Invalid API key')
      }

      console.log(`✅ API key verified: ${validApiKey.id}`)

      // Step 5: Check expiration and usage limits
      if (validApiKey.expiresAt <= new Date()) {
        throw new ExpiredError('API key has expired')
      }

      if (validApiKey.usedCount >= validApiKey.maxUses) {
        throw new UsageLimitError('API key usage limit exceeded')
      }

      // Step 6: Increment usage count
      const updatedKey = await this.repository.incrementUsage(validApiKey.hashedApiKey)

      // Step 7: Update cache for future requests
      await this.cache.set(apiKey, {
        hashedApiKey: validApiKey.hashedApiKey,
        itemKey: validApiKey.itemKey,
        permission: validApiKey.permission,
        expiresAt: validApiKey.expiresAt,
        usedCount: updatedKey.usedCount,
        maxUses: validApiKey.maxUses
      })

      console.log(`✅ API key validated and cached`)

      // Record metrics
      metrics.incrementKeysValidated()
      metrics.recordValidationTime(Date.now() - startTime)

      return {
        success: true,
        data: {
          valid: true,
          itemKey: validApiKey.itemKey,
          permission: validApiKey.permission,
          expiresAt: validApiKey.expiresAt.toISOString(),
          usedCount: updatedKey.usedCount,
          maxUses: validApiKey.maxUses
        }
      }

    } finally {
      // Step 8: Always release the lock
      await this.lock.release(lockKey, lockValue)
    }
  }

  /**
   * Prime the cache with an API key by its hashed value
   * This should be called after publishing or during a cache warming process
   */
  async primeCache(hashedApiKey: string, originalApiKey: string): Promise<void> {
    const apiKeyData = await this.repository.findByHashedKey(hashedApiKey)
    
    if (!apiKeyData) {
      throw new NotFoundError('API key not found in database')
    }

    await this.cache.set(originalApiKey, {
      hashedApiKey: apiKeyData.hashedApiKey,
      itemKey: apiKeyData.itemKey,
      permission: apiKeyData.permission,
      expiresAt: apiKeyData.expiresAt,
      usedCount: apiKeyData.usedCount,
      maxUses: apiKeyData.maxUses
    })

    console.log(`✅ Cache primed for API key`)
  }
}
