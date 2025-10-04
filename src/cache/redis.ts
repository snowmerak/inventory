import Redis from 'ioredis'
import type { EnvConfig } from '../config/env'

/**
 * Redis Client singleton instance
 */
let redisClient: Redis | null = null

/**
 * Initialize and get Redis client
 */
export function getRedisClient(config: EnvConfig): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      host: config.redisHost,
      port: config.redisPort,
      password: config.redisPassword,
      tls: config.redisTls ? {} : undefined,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000)
        return delay
      },
      maxRetriesPerRequest: 3
    })

    redisClient.on('connect', () => {
      console.log('✅ Redis connected')
    })

    redisClient.on('error', (err) => {
      console.error('❌ Redis connection error:', err)
    })
  }

  return redisClient
}

/**
 * Disconnect Redis client
 */
export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit()
    redisClient = null
  }
}

/**
 * Health check for Redis connection
 */
export async function checkRedisHealth(): Promise<boolean> {
  try {
    if (!redisClient) return false
    const result = await redisClient.ping()
    return result === 'PONG'
  } catch (error) {
    console.error('Redis health check failed:', error)
    return false
  }
}
