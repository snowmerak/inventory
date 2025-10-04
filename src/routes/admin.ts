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
      })
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
      })
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
      })
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
    })
}
