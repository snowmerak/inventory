import { Elysia, t } from 'elysia'
import type { PrismaClient } from '@prisma/client'
import { AdminService } from '../services/admin'
import { ApiError } from '../types/errors'
import { metrics } from '../monitoring/metrics'
import { logger, performance } from '../utils/logger'

/**
 * Create admin routes for API key management
 * Note: These endpoints should be protected in production
 */
export function createAdminRoutes(prisma: PrismaClient) {
  const adminService = new AdminService(prisma)

  return new Elysia({ prefix: '/admin' })
    // List API keys by item (query parameter to avoid route conflict)
    .get('/keys/by-item', async ({ query, set }) => {
      const timer = performance.start('admin.listByItem')
      
      try {
        const itemKey = query.itemKey
        
        logger.admin.debug('Listing API keys by item', {
          itemKey,
          caller: 'adminRoute.listByItem'
        })
        
        const result = await adminService.listKeysByItem(itemKey)
        
        timer.end({ success: true, itemKey, count: result.data?.keys?.length || 0 })
        
        logger.admin.info('Listed API keys by item', {
          itemKey,
          count: result.data?.keys?.length || 0,
          caller: 'adminRoute.listByItem'
        })
        
        return result
      } catch (error) {
        const itemKey = query.itemKey
        
        if (error instanceof ApiError) {
          timer.error(error as Error, {
            errorCode: error.code,
            status: error.statusCode,
            itemKey
          })
          
          logger.admin.warn('List keys by item failed', {
            itemKey,
            errorCode: error.code,
            errorMessage: error.message,
            status: error.statusCode,
            caller: 'adminRoute.listByItem'
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
        
        timer.error(error as Error, { status: 500, itemKey })
        
        logger.admin.error('Unexpected error in list keys', {
          itemKey,
          error: (error as Error).message,
          errorStack: (error as Error).stack,
          caller: 'adminRoute.listByItem'
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
      query: t.Object({
        itemKey: t.String({
          description: 'Item key to filter by',
          minLength: 1
        })
      })
    })

    // Get API key statistics by hashed key
    .get('/keys/stats/:hashedApiKey', async ({ params, set }) => {
      const timer = performance.start('admin.getKeyStats')
      
      try {
        logger.admin.debug('Getting API key statistics', {
          hashedApiKey: params.hashedApiKey,
          caller: 'adminRoute.getKeyStats'
        })
        
        const result = await adminService.getKeyStats(params.hashedApiKey)
        
        timer.end({ success: true, hashedApiKey: params.hashedApiKey })
        
        logger.admin.info('Retrieved API key statistics', {
          hashedApiKey: params.hashedApiKey,
          caller: 'adminRoute.getKeyStats'
        })
        
        return result
      } catch (error) {
        const hashedApiKey = params.hashedApiKey
        
        if (error instanceof ApiError) {
          timer.error(error as Error, {
            errorCode: error.code,
            status: error.statusCode,
            hashedApiKey
          })
          
          logger.admin.warn('Get key stats failed', {
            hashedApiKey,
            errorCode: error.code,
            errorMessage: error.message,
            status: error.statusCode,
            caller: 'adminRoute.getKeyStats'
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
        
        timer.error(error as Error, { status: 500, hashedApiKey })
        
        logger.admin.error('Unexpected error in get stats', {
          hashedApiKey,
          error: (error as Error).message,
          errorStack: (error as Error).stack,
          caller: 'adminRoute.getKeyStats'
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
      params: t.Object({
        hashedApiKey: t.String({
          description: 'Hashed API key (Argon2id hash)',
          minLength: 1
        })
      })
    })

    // Revoke an API key
    .delete('/keys/revoke/:hashedApiKey', async ({ params, set }) => {
      const timer = performance.start('admin.revokeKey')
      
      try {
        logger.admin.info('Revoking API key', {
          hashedApiKey: params.hashedApiKey,
          caller: 'adminRoute.revokeKey'
        })
        
        const result = await adminService.revokeKey(params.hashedApiKey, prisma)
        
        timer.end({ success: true, hashedApiKey: params.hashedApiKey })
        
        logger.admin.info('Revoked API key successfully', {
          hashedApiKey: params.hashedApiKey,
          caller: 'adminRoute.revokeKey'
        })
        
        return result
      } catch (error) {
        const hashedApiKey = params.hashedApiKey
        
        if (error instanceof ApiError) {
          timer.error(error as Error, {
            errorCode: error.code,
            status: error.statusCode,
            hashedApiKey
          })
          
          logger.admin.warn('Revoke key failed', {
            hashedApiKey,
            errorCode: error.code,
            errorMessage: error.message,
            status: error.statusCode,
            caller: 'adminRoute.revokeKey'
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
        
        timer.error(error as Error, { status: 500, hashedApiKey })
        
        logger.admin.error('Unexpected error in revoke key', {
          hashedApiKey,
          error: (error as Error).message,
          errorStack: (error as Error).stack,
          caller: 'adminRoute.revokeKey'
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
      params: t.Object({
        hashedApiKey: t.String({
          description: 'Hashed API key to revoke',
          minLength: 1
        })
      })
    })

    // Cleanup expired keys
    .post('/keys/cleanup', async ({ set }) => {
      const timer = performance.start('admin.cleanupExpired')
      
      try {
        logger.admin.info('Starting cleanup of expired keys', {
          caller: 'adminRoute.cleanupExpired'
        })
        
        const result = await adminService.cleanupExpired()
        
        timer.end({ success: true, deletedCount: result.data?.deletedCount || 0 })
        
        logger.admin.info('Cleanup completed', {
          deletedCount: result.data?.deletedCount || 0,
          caller: 'adminRoute.cleanupExpired'
        })
        
        return result
      } catch (error) {
        if (error instanceof ApiError) {
          timer.error(error as Error, {
            errorCode: error.code,
            status: error.statusCode
          })
          
          logger.admin.warn('Cleanup failed', {
            errorCode: error.code,
            errorMessage: error.message,
            status: error.statusCode,
            caller: 'adminRoute.cleanupExpired'
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
        
        timer.error(error as Error, { status: 500 })
        
        logger.admin.error('Unexpected error in cleanup', {
          error: (error as Error).message,
          errorStack: (error as Error).stack,
          caller: 'adminRoute.cleanupExpired'
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
    })

    // Get overall statistics
    .get('/stats', async ({ set }) => {
      const timer = performance.start('admin.getOverallStats')
      
      try {
        logger.admin.debug('Getting overall statistics', {
          caller: 'adminRoute.getOverallStats'
        })
        
        const result = await adminService.getOverallStats(prisma)
        
        timer.end({ success: true })
        
        logger.admin.info('Retrieved overall statistics', {
          caller: 'adminRoute.getOverallStats'
        })
        
        return result
      } catch (error) {
        if (error instanceof ApiError) {
          timer.error(error as Error, {
            errorCode: error.code,
            status: error.statusCode
          })
          
          logger.admin.warn('Get overall stats failed', {
            errorCode: error.code,
            errorMessage: error.message,
            status: error.statusCode,
            caller: 'adminRoute.getOverallStats'
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
        
        timer.error(error as Error, { status: 500 })
        
        logger.admin.error('Unexpected error in get overall stats', {
          error: (error as Error).message,
          errorStack: (error as Error).stack,
          caller: 'adminRoute.getOverallStats'
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
    })

    // Get metrics
    .get('/metrics', async ({ set }) => {
      const timer = performance.start('admin.getMetrics')
      
      try {
        logger.admin.debug('Getting metrics', {
          caller: 'adminRoute.getMetrics'
        })
        
        const metricsData = metrics.getMetrics()
        
        timer.end({ success: true })
        
        logger.admin.info('Retrieved metrics', {
          caller: 'adminRoute.getMetrics'
        })
        
        return {
          success: true,
          data: metricsData
        }
      } catch (error) {
        timer.error(error as Error, { status: 500 })
        
        logger.admin.error('Unexpected error in get metrics', {
          error: (error as Error).message,
          errorStack: (error as Error).stack,
          caller: 'adminRoute.getMetrics'
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
    })
}
