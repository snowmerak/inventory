# Quick Start Guide

## 🚀 Getting Started

### 1. Install Dependencies
```powershell
bun install
```

### 2. Start Local Infrastructure
```powershell
bun run docker:up
```

This will start:
- MongoDB on `localhost:27017` (user: `admin`, password: `admin123`)
- Redis on `localhost:6379` (password: `redis123`)

### 3. Set Environment Variables (PowerShell)
```powershell
$env:PORT="3030"
$env:MONGODB_URI="mongodb://admin:admin123@localhost:27017/inventory?authSource=admin"
$env:REDIS_HOST="localhost"
$env:REDIS_PORT="6379"
$env:REDIS_PASSWORD="redis123"
$env:NODE_ENV="development"
$env:RATE_LIMIT_MAX="100"
$env:RATE_LIMIT_WINDOW="60000"
$env:CACHE_TTL="900"
```

### 4. Setup Database
```powershell
# Generate Prisma client
bun run db:generate

# Push schema to MongoDB
bun run db:push
```

### 5. Start Development Server
```powershell
bun run dev
```

Server will start at: http://localhost:3030

### 6. Test Health Endpoint
```powershell
curl http://localhost:3030/health
```

Expected response:
```json
{
  "status": "healthy",
  "services": {
    "mongodb": "connected",
    "redis": "connected"
  },
  "timestamp": "2025-10-04T..."
}
```

## 🔧 Useful Commands

```powershell
# View Docker logs
bun run docker:logs

# Stop Docker containers
bun run docker:down

# Open Prisma Studio (Database GUI)
bun run db:studio

# Production mode
bun run start
```

## 📦 What Was Implemented

✅ Environment configuration loading
✅ MongoDB connection via Prisma
✅ Redis connection
✅ Distributed lock implementation
✅ API key caching layer
✅ Database repository for API keys
✅ Crypto utilities (API key generation, Argon2id hashing)
✅ Health check endpoint
✅ Graceful shutdown handling
✅ Docker Compose for local development

## 📝 Next Steps

The infrastructure is ready! Next you can implement:

1. **API Key Publishing Endpoint** (`POST /api/keys/publish`)
   - Generate random 64-char API key
   - Hash with Argon2id
   - Store in MongoDB
   - Return original key (once)

2. **API Key Validation Endpoint** (`POST /api/keys/validate`)
   - Rate limiting middleware
   - Distributed lock
   - Cache-first lookup
   - Verify with Argon2id
   - Check expiration & usage limits
   - Increment usage count

3. **Rate Limiting**
   - Add rate limiting middleware to public ingress

4. **Error Handling**
   - Standardized error responses
   - Logging

Would you like me to implement these endpoints next?
