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
import { logger, performance } from '../utils/logger'

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
      const timer = performance.start('POST /api/keys/publish', {
        caller: 'apiRoute.publish'
      })
      
      try {
        logger.api.info('Received publish request', {
          itemKey: body.itemKey,
          permissions: body.permission,
          caller: 'apiRoute.publish'
        })
        
        // Body is already validated by schema
        const validateRequest = body
        const response = await validatorService.validateApiKey(validateRequest)
        
        timer.end({
          success: true,
          status: 200,
          clientIp
        })
        
        logger.api.info('Validate request completed', {
          clientIp,
          valid: response.data.valid,
          status: 200,
          caller: 'apiRoute.validate'
        })
        
        return response
      } catch (error) {
        const clientIp = getClientIp(request)
        
        // Track specific error types in metrics
        if (error instanceof RateLimitError) {
          metrics.incrementRateLimitErrors()
          logger.api.warn('Rate limit exceeded', {
            clientIp,
            caller: 'apiRoute.validate'
          })
        } else if (error instanceof LockAcquisitionError) {
          metrics.incrementLockAcquisitionErrors()
          logger.api.error('Lock acquisition failed', {
            clientIp,
            caller: 'apiRoute.validate'
          })
        }

        if (error instanceof ApiError) {
          timer.error(error as Error, {
            errorCode: error.code,
            status: error.statusCode,
            clientIp
          })
          
          logger.api.warn('Validate request failed', {
            clientIp,
            errorCode: error.code,
            errorMessage: error.message,
            status: error.statusCode,
            caller: 'apiRoute.validate'
          })
          
          set.status = error.statusCode
          return {
            success: false,
            error: {
              code: error.code,
              message: error.message
            }
          }
        }
        
        timer.error(error as Error, { status: 500, clientIp })
        
        logger.api.error('Unexpected error in validate', {
          clientIp,
          error: (error as Error).message,
          errorStack: (error as Error).stack,
          caller: 'apiRoute.validate'
        })
        
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
