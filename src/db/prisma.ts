import { PrismaClient } from '@prisma/client'

/**
 * Prisma Client singleton instance
 * Handles MongoDB connection and queries
 */
let prisma: PrismaClient | null = null

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' 
        ? ['query', 'info', 'warn', 'error']
        : ['error']
    })
  }
  return prisma
}

/**
 * Disconnect Prisma Client
 * Should be called on application shutdown
 */
export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect()
    prisma = null
  }
}

/**
 * Health check for MongoDB connection
 */
export async function checkMongoHealth(): Promise<boolean> {
  try {
    const client = getPrismaClient()
    await client.$queryRaw`SELECT 1`
    return true
  } catch (error) {
    console.error('MongoDB health check failed:', error)
    return false
  }
}
