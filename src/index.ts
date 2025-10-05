import { Elysia } from "elysia";
import { openapi } from "@elysiajs/openapi";

import { loadEnv } from "./config/env"
import { configureLogger, logger } from "./utils/logger"
import { getPrismaClient, checkMongoHealth, disconnectPrisma } from "./db/prisma"
import { getRedisClient, checkRedisHealth, disconnectRedis } from "./cache/redis"
import { createApiRoutes } from "./routes/api"
import { createAdminRoutes } from "./routes/admin"

// Load environment configuration
const env = loadEnv()

// Configure logger
await configureLogger()

// Initialize connections
const prisma = getPrismaClient()
const redis = getRedisClient(env)

logger.app.info('Initializing Inventory API Service', {
  environment: env.nodeEnv,
  mongodb: env.mongodbUri.split('@')[1] || 'connecting...',
  redis: `${env.redisHost}:${env.redisPort}`,
  caller: 'index.init'
})

const app = new Elysia()
  .get("/", () => "Inventory API Service")
  .get("/health", async () => {
    logger.app.debug('Health check requested', { caller: 'healthCheck' })
    
    const mongoHealth = await checkMongoHealth()
    const redisHealth = await checkRedisHealth()
    
    const status = mongoHealth && redisHealth ? "healthy" : "unhealthy"
    
    logger.app.info('Health check completed', {
      status,
      mongodb: mongoHealth,
      redis: redisHealth,
      caller: 'healthCheck'
    })
    
    return {
      status,
      services: {
        mongodb: mongoHealth ? "connected" : "disconnected",
        redis: redisHealth ? "connected" : "disconnected"
      },
      timestamp: new Date().toISOString()
    }
  })
  .use(createApiRoutes(prisma, redis, env))
  .use(createAdminRoutes(prisma))
  .use(openapi())
  .listen(env.port);

logger.app.info('Inventory API is running', {
  host: app.server?.hostname,
  port: app.server?.port,
  url: `http://${app.server?.hostname}:${app.server?.port}`,
  caller: 'index.start'
})

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.app.info('Received SIGINT signal, shutting down gracefully', {
    caller: 'shutdown'
  })
  await disconnectPrisma()
  await disconnectRedis()
  logger.app.info('Shutdown complete', { caller: 'shutdown' })
  process.exit(0)
})

process.on('SIGTERM', async () => {
  logger.app.info('Received SIGTERM signal, shutting down gracefully', {
    caller: 'shutdown'
  })
  await disconnectPrisma()
  await disconnectRedis()
  logger.app.info('Shutdown complete', { caller: 'shutdown' })
  process.exit(0)
})
