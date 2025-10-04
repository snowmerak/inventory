import { Elysia, t } from 'elysia'
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
        // Body is already validated by schema, no need for 'as' casting
        const request = body
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
    }, {
      body: t.Object({
        itemKey: t.String({
          description: 'Item key in format: <scheme>://<service>/<key>?<query>',
          minLength: 1,
          examples: ['https://example.com/item/123?variant=blue']
        }),
        permission: t.Array(t.String(), {
          description: 'Array of permission strings',
          minItems: 1,
          examples: [['read', 'write']]
        }),
        expiresAt: t.String({
          description: 'Expiration date in ISO 8601 format',
          format: 'date-time',
          examples: ['2025-12-31T23:59:59Z']
        }),
        maxUses: t.Integer({
          description: 'Maximum number of uses allowed',
          minimum: 1,
          examples: [1000]
        })
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          data: t.Object({
            apiKey: t.String({ description: 'Generated API key (shown only once!)' }),
            itemKey: t.String(),
            permission: t.Array(t.String()),
            publishedAt: t.String({ format: 'date-time' }),
            expiresAt: t.String({ format: 'date-time' }),
            maxUses: t.Integer()
          })
        }),
        400: t.Object({
          success: t.Boolean(),
          error: t.Object({
            code: t.String(),
            message: t.String()
          })
        }),
        500: t.Object({
          success: t.Boolean(),
          error: t.Object({
            code: t.String(),
            message: t.String()
          })
        })
      }
    })

    // Validator endpoint (Public Ingress with Rate Limiting)
    .post('/keys/validate', async ({ body, set, request }) => {
      try {
        // Apply rate limiting
        const clientIp = getClientIp(request)
        await rateLimiter.checkLimit(clientIp, env.rateLimitMax, env.rateLimitWindow)

        // Body is already validated by schema
        const validateRequest = body
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
    }, {
      body: t.Object({
        apiKey: t.String({
          description: 'API key to validate',
          minLength: 1,
          examples: ['abc123def456...']
        })
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          data: t.Object({
            valid: t.Literal(true),
            itemKey: t.String(),
            permission: t.Array(t.String()),
            expiresAt: t.String({ format: 'date-time' }),
            usedCount: t.Integer(),
            maxUses: t.Integer()
          })
        }),
        400: t.Object({
          success: t.Boolean(),
          error: t.Object({
            code: t.String(),
            message: t.String()
          })
        }),
        401: t.Object({
          success: t.Boolean(),
          error: t.Object({
            code: t.String(),
            message: t.String()
          })
        }),
        429: t.Object({
          success: t.Boolean(),
          error: t.Object({
            code: t.String(),
            message: t.String()
          })
        }),
        500: t.Object({
          success: t.Boolean(),
          error: t.Object({
            code: t.String(),
            message: t.String()
          })
        })
      }
    })
}
