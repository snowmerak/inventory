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
    // List API keys by item (query parameter to avoid route conflict)
    .get('/keys/by-item', async ({ query, set }) => {
      try {
        const itemKey = query.itemKey as string
        if (!itemKey) {
          set.status = 400
          return {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'itemKey query parameter is required'
            }
          }
        }
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
    })
}
