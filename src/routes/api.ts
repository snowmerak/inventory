import { Elysia } from 'elysia'
import type { PrismaClient } from '@prisma/client'
import type Redis from 'ioredis'
import { PublisherService } from '../services/publisher'
import { ValidatorService } from '../services/validator'
import type { PublishApiKeyRequest, ValidateApiKeyRequest } from '../types/api'
import { ApiError, RateLimitError, LockAcquisitionError } from '../types/errors'
import { RateLimiter, getClientIp } from '../middleware/rate-limiter'
import { metrics } from '../monitoring/metrics'
import type { EnvConfig } from '../config/env'

/**
 * Create API routes for API key management
 */
export function createApiRoutes(
  prisma: PrismaClient,
  redis: Redis,
  env: EnvConfig
) {
  const publisherService = new PublisherService(prisma)
  const validatorService = new ValidatorService(prisma, redis, env.cacheTtl)
  const rateLimiter = new RateLimiter(redis)

  return new Elysia({ prefix: '/api' })
    // Publisher endpoint (Private Ingress)
    .post('/keys/publish', async ({ body, set }) => {
      try {
        const request = body as PublishApiKeyRequest
        const response = await publisherService.publishApiKey(request)
        return response
      } catch (error) {
        if (error instanceof ApiError) {
          set.status = error.statusCode
          return {
            success: false,
            error: {
              code: error.code,
              message: error.message
            }
          }
        }
        
        console.error('Unexpected error in publish:', error)
        set.status = 500
        return {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred'
          }
        }
      }
    })

    // Validator endpoint (Public Ingress with Rate Limiting)
    .post('/keys/validate', async ({ body, set, request }) => {
      try {
        // Apply rate limiting
        const clientIp = getClientIp(request)
        await rateLimiter.checkLimit(clientIp, env.rateLimitMax, env.rateLimitWindow)

        const validateRequest = body as ValidateApiKeyRequest
        const response = await validatorService.validateApiKey(validateRequest)
        return response
      } catch (error) {
        // Track specific error types in metrics
        if (error instanceof RateLimitError) {
          metrics.incrementRateLimitErrors()
        } else if (error instanceof LockAcquisitionError) {
          metrics.incrementLockAcquisitionErrors()
        }

        if (error instanceof ApiError) {
          set.status = error.statusCode
          return {
            success: false,
            error: {
              code: error.code,
              message: error.message
            }
          }
        }
        
        console.error('Unexpected error in validate:', error)
        set.status = 500
        return {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred'
          }
        }
      }
    })
}
