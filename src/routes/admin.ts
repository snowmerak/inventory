import { Elysia } from 'elysia'
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
    // List API keys by item
    .get('/keys/:itemKey', async ({ params, set }) => {
      try {
        return await adminService.listKeysByItem(params.itemKey)
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
    })

    // Get API key statistics
    .get('/keys/:hashedApiKey/stats', async ({ params, set }) => {
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
    })

    // Cleanup expired keys
    .delete('/keys/expired', async ({ set }) => {
      try {
        return await adminService.cleanupExpired()
      } catch (error) {
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
        console.error('Unexpected error in overall stats:', error)
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

    // Revoke an API key
    .delete('/keys/:hashedApiKey', async ({ params, set }) => {
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
    })

    // Get metrics
    .get('/metrics', () => {
      return {
        success: true,
        data: metrics.getMetrics()
      }
    })

    // Reset metrics
    .post('/metrics/reset', () => {
      metrics.reset()
      return {
        success: true,
        data: {
          message: 'Metrics reset successfully'
        }
      }
    })
}
