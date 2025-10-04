import { Elysia } from "elysia";
import { openapi } from "@elysiajs/openapi";

import { loadEnv } from "./config/env"
import { getPrismaClient, checkMongoHealth, disconnectPrisma } from "./db/prisma"
import { getRedisClient, checkRedisHealth, disconnectRedis } from "./cache/redis"
import { createApiRoutes } from "./routes/api"
import { createAdminRoutes } from "./routes/admin"

// Load environment configuration
const env = loadEnv()

// Initialize connections
const prisma = getPrismaClient()
const redis = getRedisClient(env)

console.log(`🚀 Initializing Inventory API Service...`)
console.log(`📍 Environment: ${env.nodeEnv}`)
console.log(`🔌 MongoDB: ${env.mongodbUri.split('@')[1] || 'connecting...'}`)
console.log(`🔌 Redis: ${env.redisHost}:${env.redisPort}`)

const app = new Elysia()
  .get("/", () => "Inventory API Service")
  .get("/health", async () => {
    const mongoHealth = await checkMongoHealth()
    const redisHealth = await checkRedisHealth()
    
    return {
      status: mongoHealth && redisHealth ? "healthy" : "unhealthy",
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

console.log(
  `🦊 Inventory API is running at ${app.server?.hostname}:${app.server?.port}`
)

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...')
  await disconnectPrisma()
  await disconnectRedis()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...')
  await disconnectPrisma()
  await disconnectRedis()
  process.exit(0)
})
