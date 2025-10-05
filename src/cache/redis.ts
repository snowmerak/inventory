import Redis from 'ioredis'
import type { EnvConfig } from '../config/env'
import { logger } from '../utils/logger'

/**
 * Redis Client singleton instance
 */
let redisClient: Redis | null = null

/**
 * Initialize and get Redis client
 */
export function getRedisClient(config: EnvConfig): Redis {
  if (!redisClient) {
    logger.cache.info('Initializing Redis client', {
      host: config.redisHost,
      port: config.redisPort,
      tls: config.redisTls,
      caller: 'getRedisClient'
    })
    
    redisClient = new Redis({
      host: config.redisHost,
      port: config.redisPort,
      password: config.redisPassword,
      tls: config.redisTls ? {} : undefined,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000)
        logger.cache.debug('Redis retry attempt', {
          attempt: times,
          delay,
          caller: 'redisRetryStrategy'
        })
        return delay
      },
      maxRetriesPerRequest: 3
    })

    redisClient.on('connect', () => {
      logger.cache.info('Redis connected', { caller: 'redisClient.onConnect' })
    })

    redisClient.on('error', (err) => {
      logger.cache.error('Redis connection error', {
        error: err.message,
        caller: 'redisClient.onError'
      })
    })
    
    logger.cache.info('Redis client initialized', { caller: 'getRedisClient' })
  }

  return redisClient
}

/**
 * Disconnect Redis client
 */
export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    logger.cache.info('Disconnecting Redis client', { caller: 'disconnectRedis' })
    await redisClient.quit()
    redisClient = null
    logger.cache.info('Redis client disconnected', { caller: 'disconnectRedis' })
  }
}

/**
 * Health check for Redis connection
 */
export async function checkRedisHealth(): Promise<boolean> {
  try {
    if (!redisClient) {
      logger.cache.warn('Redis health check: client not initialized', {
        caller: 'checkRedisHealth'
      })
      return false
    }
    
    logger.cache.debug('Checking Redis health', { caller: 'checkRedisHealth' })
    const result = await redisClient.ping()
    const healthy = result === 'PONG'
    
    logger.cache.debug('Redis health check completed', {
      healthy,
      caller: 'checkRedisHealth'
    })
    
    return healthy
  } catch (error) {
    logger.cache.error('Redis health check failed', {
      error: (error as Error).message,
      caller: 'checkRedisHealth'
    })
    return false
  }
}
