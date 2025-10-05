import { PrismaClient } from '@prisma/client'
import { logger } from '../utils/logger'

/**
 * Prisma Client singleton instance
 * Handles MongoDB connection and queries
 */
let prisma: PrismaClient | null = null

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    logger.db.info('Initializing Prisma Client', {
      logLevel: process.env.NODE_ENV === 'development' ? 'verbose' : 'error',
      caller: 'getPrismaClient'
    })
    
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' 
        ? ['query', 'info', 'warn', 'error']
        : ['error']
    })
    
    logger.db.info('Prisma Client initialized', { caller: 'getPrismaClient' })
  }
  return prisma
}

/**
 * Disconnect Prisma Client
 * Should be called on application shutdown
 */
export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    logger.db.info('Disconnecting Prisma Client', { caller: 'disconnectPrisma' })
    await prisma.$disconnect()
    prisma = null
    logger.db.info('Prisma Client disconnected', { caller: 'disconnectPrisma' })
  }
}

/**
 * Health check for MongoDB connection
 */
export async function checkMongoHealth(): Promise<boolean> {
  try {
    logger.db.debug('Checking MongoDB health', { caller: 'checkMongoHealth' })
    
    const client = getPrismaClient()
    // MongoDB does not support $queryRaw, use $connect or simple query instead
    await client.$connect()
    // Verify connection with a simple count operation
    await client.apiKey.count({ take: 1 })
    
    logger.db.debug('MongoDB health check passed', { caller: 'checkMongoHealth' })
    return true
  } catch (error) {
    logger.db.error('MongoDB health check failed', {
      error: (error as Error).message,
      caller: 'checkMongoHealth'
    })
    return false
  }
}
