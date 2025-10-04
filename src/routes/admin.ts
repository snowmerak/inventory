import { Elysia, t } from 'elysia'
import type { PrismaClient } from '@prisma/client'
import { AdminService } from '../services/admin'
import { ApiError } from '../types/errors'
import { metrics } from '../monitoring/metrics'

/**
 * Create admin routes for API key management
 * Note: These endpoints should be protected in production
 */
export function createAdminRoutes(prisma: PrismaClient) {
  const adminService = new AdminService(prisma)

  return new Elysia({ prefix: '/admin' })
    // List API keys by item (query parameter to avoid route conflict)
    .get('/keys/by-item', async ({ query, set }) => {
      try {
        const itemKey = query.itemKey
        return await adminService.listKeysByItem(itemKey)
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
        
        console.error('Unexpected error in list keys:', error)
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
      query: t.Object({
        itemKey: t.String({
          description: 'Item key to filter by',
          minLength: 1
        })
      }),
      response: {
        200: t.Object({
          success: t.Literal(true),
          data: t.Object({
            itemKey: t.String(),
            count: t.Integer(),
            keys: t.Array(t.Object({
              id: t.String(),
              itemKey: t.String(),
              permission: t.Array(t.String()),
              publishedAt: t.String({ format: 'date-time' }),
              expiresAt: t.String({ format: 'date-time' }),
              usedCount: t.Integer(),
              maxUses: t.Integer(),
              isExpired: t.Boolean(),
              isExhausted: t.Boolean()
            }))
          })
        }),
        400: t.Object({
          success: t.Literal(false),
          error: t.Object({
            code: t.String(),
            message: t.String()
          })
        })
      }
    })

    // Get API key statistics by hashed key
    .get('/keys/stats/:hashedApiKey', async ({ params, set }) => {
      try {
        return await adminService.getKeyStats(params.hashedApiKey)
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
        
        console.error('Unexpected error in get stats:', error)
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
      params: t.Object({
        hashedApiKey: t.String({
          description: 'Hashed API key (Argon2id hash)',
          minLength: 1
        })
      }),
      response: {
        200: t.Object({
          success: t.Literal(true),
          data: t.Object({
            usedCount: t.Integer(),
            maxUses: t.Integer(),
            remainingUses: t.Integer(),
            expiresAt: t.String({ format: 'date-time' }),
            isExpired: t.Boolean(),
            isExhausted: t.Boolean(),
            utilizationRate: t.Number()
          })
        }),
        404: t.Object({
          success: t.Literal(false),
          error: t.Object({
            code: t.String(),
            message: t.String()
          })
        }),
        500: t.Object({
          success: t.Literal(false),
          error: t.Object({
            code: t.String(),
            message: t.String()
          })
        })
      }
    })

    // Revoke an API key
    .delete('/keys/revoke/:hashedApiKey', async ({ params, set }) => {
      try {
        return await adminService.revokeKey(params.hashedApiKey, prisma)
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
        
        console.error('Unexpected error in revoke key:', error)
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
      params: t.Object({
        hashedApiKey: t.String({
          description: 'Hashed API key to revoke',
          minLength: 1
        })
      }),
      response: {
        200: t.Object({
          success: t.Literal(true),
          data: t.Object({
            message: t.String(),
            id: t.String(),
            revokedAt: t.String({ format: 'date-time' })
          })
        }),
        404: t.Object({
          success: t.Literal(false),
          error: t.Object({
            code: t.String(),
            message: t.String()
          })
        }),
        500: t.Object({
          success: t.Literal(false),
          error: t.Object({
            code: t.String(),
            message: t.String()
          })
        })
      }
    })

    // Cleanup expired keys
    .post('/keys/cleanup', async ({ set }) => {
      try {
        return await adminService.cleanupExpired()
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
        
        console.error('Unexpected error in cleanup:', error)
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
      response: {
        200: t.Object({
          success: t.Literal(true),
          data: t.Object({
            deletedCount: t.Integer(),
            message: t.String()
          })
        }),
        500: t.Object({
          success: t.Literal(false),
          error: t.Object({
            code: t.String(),
            message: t.String()
          })
        })
      }
    })

    // Get overall statistics
    .get('/stats', async ({ set }) => {
      try {
        return await adminService.getOverallStats(prisma)
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
        
        console.error('Unexpected error in get overall stats:', error)
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
      response: {
        200: t.Object({
          success: t.Literal(true),
          data: t.Object({
            totalKeys: t.Integer(),
            activeKeys: t.Integer(),
            expiredKeys: t.Integer(),
            exhaustedKeys: t.Integer(),
            topItems: t.Array(t.Object({
              itemKey: t.String(),
              keyCount: t.Integer()
            }))
          })
        }),
        500: t.Object({
          success: t.Literal(false),
          error: t.Object({
            code: t.String(),
            message: t.String()
          })
        })
      }
    })

    // Get metrics
    .get('/metrics', async ({ set }) => {
      try {
        const metricsData = metrics.getMetrics()
        return {
          success: true,
          data: metricsData
        }
      } catch (error) {
        console.error('Unexpected error in get metrics:', error)
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
      response: {
        200: t.Object({
          success: t.Literal(true),
          data: t.Object({
            keysPublished: t.Integer(),
            keysValidated: t.Integer(),
            cacheHits: t.Integer(),
            cacheMisses: t.Integer(),
            cacheHitRate: t.Number(),
            avgPublishTime: t.Number(),
            avgValidationTime: t.Number(),
            rateLimitErrors: t.Integer(),
            lockAcquisitionErrors: t.Integer()
          })
        }),
        500: t.Object({
          success: t.Literal(false),
          error: t.Object({
            code: t.String(),
            message: t.String()
          })
        })
      }
    })
}
