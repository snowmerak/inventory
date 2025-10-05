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
/**
 * Usage with caller information:
 * 
 * @example
 * logger.service.info('API key published', {
 *   itemKey: request.itemKey,
 *   caller: 'PublisherService.publish'
 * })
 * 
 * @example
 * logger.api.error('Request failed', {
 *   error: error.message,
 *   caller: 'validateApiKey',
 *   function: 'POST /api/keys/validate'
 * })
 */

export const logger = {
  app: getLogger(['inventory']),
  db: getLogger(['inventory', 'db']),
  cache: getLogger(['inventory', 'cache']),
  service: getLogger(['inventory', 'service']),
  api: getLogger(['inventory', 'api']),
  admin: getLogger(['inventory', 'admin'])
}


/**
 * Performance logger for measuring execution time
 * 
 * @example
 * const timer = performance.start('API key validation')
 * // ... do some work
 * timer.end({ itemKey: 'myapp://resource/123' })
 * 
 * @example
 * const timer = performance.start('Database query', { query: 'findUnique' })
 * // ... execute query
 * timer.end() // Will include initial properties + duration
 */
export const performance = {
  /**
   * Start a performance timer
   * @param operation Name of the operation being measured
   * @param properties Additional properties to include in the log
   */
  start(operation: string, properties: Record<string, any> = {}) {
    const startTime = Date.now()
    
    return {
      /**
       * End the timer and log the duration
       * @param additionalProperties Additional properties to add when ending
       */
      end(additionalProperties: Record<string, any> = {}) {
        const duration = Date.now() - startTime
        
        logger.app.info(`⏱️ ${operation}`, {
          operation,
          duration,
          durationMs: duration,
          ...properties,
          ...additionalProperties,
          caller: 'performance.timer'
        })
        
        return duration
      },
      
      /**
       * End with error
       * @param error Error that occurred
       * @param additionalProperties Additional properties
       */
      error(error: Error, additionalProperties: Record<string, any> = {}) {
        const duration = Date.now() - startTime
        
        logger.app.error(`⏱️ ${operation} failed`, {
          operation,
          duration,
          durationMs: duration,
          error: error.message,
          errorStack: error.stack,
          ...properties,
          ...additionalProperties,
          caller: 'performance.timer'
        })
        
        return duration
      }
    }
  },
  
  /**
   * Measure an async function execution time
   * @param operation Name of the operation
   * @param fn Async function to measure
   * @param properties Additional properties
   */
  async measure<T>(
    operation: string,
    fn: () => Promise<T>,
    properties: Record<string, any> = {}
  ): Promise<T> {
    const timer = this.start(operation, properties)
    
    try {
      const result = await fn()
      timer.end({ success: true })
      return result
    } catch (error) {
      timer.error(error as Error)
      throw error
    }
  },
  
  /**
   * Measure a sync function execution time
   * @param operation Name of the operation
   * @param fn Function to measure
   * @param properties Additional properties
   */
  measureSync<T>(
    operation: string,
    fn: () => T,
    properties: Record<string, any> = {}
  ): T {
    const timer = this.start(operation, properties)
    
    try {
      const result = fn()
      timer.end({ success: true })
      return result
    } catch (error) {
      timer.error(error as Error)
      throw error
    }
  }
}
