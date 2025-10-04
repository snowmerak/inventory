/**
 * Environment variable configuration
 * Values are loaded from environment variables (docker-compose, k8s secrets, etc.)
 */

export interface EnvConfig {
  // Server
  port: number

  // MongoDB
  mongodbUri: string

  // Redis
  redisHost: string
  redisPort: number
  redisPassword: string
  redisTls?: boolean

  // Application
  nodeEnv: string

  // Rate Limiting
  rateLimitMax: number
  rateLimitWindow: number

  // Cache
  cacheTtl: number
}

/**
 * Load and validate environment variables
 * Throws an error if required variables are missing
 */
export function loadEnv(): EnvConfig {
  const requiredVars = [
    'PORT',
    'MONGODB_URI',
    'REDIS_HOST',
    'REDIS_PORT',
    'REDIS_PASSWORD'
  ]

  const missing = requiredVars.filter(varName => !process.env[varName])
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }

  return {
    port: parseInt(process.env.PORT || '3030', 10),
    mongodbUri: process.env.MONGODB_URI!,
    redisHost: process.env.REDIS_HOST!,
    redisPort: parseInt(process.env.REDIS_PORT || '6379', 10),
    redisPassword: process.env.REDIS_PASSWORD!,
    redisTls: process.env.REDIS_TLS === 'true',
    nodeEnv: process.env.NODE_ENV || 'development',
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '60000', 10),
    cacheTtl: parseInt(process.env.CACHE_TTL || '900', 10)
  }
}
