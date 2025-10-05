import { configure, getConsoleSink, getLogger, type LogLevel } from "@logtape/logtape"

/**
 * Masks sensitive information in log data
 * - API keys: Shows only first 8 characters
 * - Hashes: Shows only first 16 characters
 * - Passwords: Completely masked
 */
function maskSensitiveData(data: Record<string, any>): Record<string, any> {
  const masked = { ...data }
  
  // Mask API keys (show first 8 chars + ***)
  if (masked.apiKey && typeof masked.apiKey === 'string') {
    masked.apiKey = masked.apiKey.substring(0, 8) + '***'
  }
  
  // Mask hashes (show first 16 chars + ***)
  if (masked.hash && typeof masked.hash === 'string') {
    masked.hash = masked.hash.substring(0, 16) + '***'
  }
  
  if (masked.searchableHash && typeof masked.searchableHash === 'string') {
    masked.searchableHash = masked.searchableHash.substring(0, 16) + '***'
  }
  
  if (masked.hashedApiKey && typeof masked.hashedApiKey === 'string') {
    masked.hashedApiKey = masked.hashedApiKey.substring(0, 16) + '***'
  }
  
  // Completely mask passwords
  if (masked.password) {
    masked.password = '***'
  }
  
  if (masked.redisPassword) {
    masked.redisPassword = '***'
  }
  
  // Mask MongoDB URI (hide credentials)
  if (masked.mongodbUri && typeof masked.mongodbUri === 'string') {
    masked.mongodbUri = masked.mongodbUri.replace(
      /mongodb:\/\/([^:]+):([^@]+)@/,
      'mongodb://<user>:<password>@'
    )
  }
  
  return masked
}

/**
 * Configure LogTape for structured logging
 */
export async function configureLogger(): Promise<void> {
  const isDevelopment = process.env.NODE_ENV !== 'production'
  const logLevel: LogLevel = isDevelopment ? 'debug' : 'info'
  
  await configure({
    sinks: {
      console: getConsoleSink({
        formatter(log) {
          const maskedProperties = maskSensitiveData(log.properties)
          
          // Unified JSON format for both development and production
          const logEntry = {
            timestamp: new Date().toISOString(),
            level: log.level,
            category: log.category.join('.'),
            message: log.message,
            ...maskedProperties
          }
          
          // Development: Pretty-printed JSON
          if (isDevelopment) {
            return JSON.stringify(logEntry, null, 2)
          }
          
          // Production: Compact JSON
          return JSON.stringify(logEntry)
        }
      })
    },
    filters: {},
    loggers: [
      {
        category: ['inventory'],
        lowestLevel: 'debug',
        sinks: ['console']
      }
    ],
    reset: true
  })
}

/**
 * Get logger instances for different parts of the application
 */
export const logger = {
  app: getLogger(['inventory']),
  db: getLogger(['inventory', 'db']),
  cache: getLogger(['inventory', 'cache']),
  service: getLogger(['inventory', 'service']),
  api: getLogger(['inventory', 'api']),
  admin: getLogger(['inventory', 'admin'])
}
