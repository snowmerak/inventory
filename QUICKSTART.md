# Quick Start Guide

## 🚀 Option 1: Full Docker Compose (Recommended)

Everything is set up automatically!

### 1. Build and Start All Services
```powershell
bun run docker:up:build
```

This single command:
- ✅ Starts MongoDB
- ✅ Starts Redis
- ✅ Automatically creates TTL index
- ✅ Generates Prisma client
- ✅ Starts Inventory API server

### 2. Check Status
```powershell
# View all logs
bun run docker:logs

# View app logs only
bun run docker:logs:app

# Health check
curl http://localhost:3030/health
```

### 3. Stop Services
```powershell
# Stop services only (keep data)
bun run docker:down

# Remove data as well
bun run docker:down:volumes
```

---

## 🛠️ Option 2: Local Development (Without Docker for App)

Run infrastructure in Docker, app locally

### 1. Start Infrastructure Only
First, comment out the `app` service in docker-compose.yml:
```yaml
# app:
#   build:
#   ...
```

Or start individual services only:
```powershell
docker-compose up -d mongodb redis setup
```

### 2. Install Dependencies
```powershell
bun install
```

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

### 4. Generate Prisma Client
```powershell
bun run db:generate
```

### 5. Start Development Server
```powershell
bun run dev
```

---

## 📋 Useful Commands

### Docker Commands
```powershell
# Build images
bun run docker:build

# Start all services
bun run docker:up

# Start with rebuild
bun run docker:up:build

# Stop services
bun run docker:down

# Stop and remove volumes (clean slate)
bun run docker:down:volumes

# View all logs
bun run docker:logs

# View app logs only
bun run docker:logs:app

# Restart app only
bun run docker:restart
```

### Development Commands
```powershell
# Start with hot reload
bun run dev

# Start production mode
bun run start

# Generate Prisma client
bun run db:generate

# Open Prisma Studio
bun run db:studio
```

---

## 🧪 Test the API

### Health Check
```powershell
curl http://localhost:3030/health
```

Expected:
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

### Publish API Key
```powershell
$body = @{
  itemKey = "myapp://users/user123"
  permission = @("read", "write")
  expiresAt = "2025-12-31T23:59:59.000Z"
  maxUses = 100
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3030/api/keys/publish" `
  -Method Post `
  -ContentType "application/json" `
  -Body $body
```

### Validate API Key
```powershell
$body = @{
  apiKey = "your-api-key-from-publish-response"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3030/api/keys/validate" `
  -Method Post `
  -ContentType "application/json" `
  -Body $body
```

### View Metrics
```powershell
curl http://localhost:3030/admin/metrics
```

---

## 🔍 Troubleshooting

### App won't start
```powershell
# Check logs
bun run docker:logs:app

# Common issues:
# 1. MongoDB not ready - wait a bit longer
# 2. Port 3030 in use - change PORT env var
# 3. Dependencies not installed - rebuild image
```

### MongoDB connection issues
```powershell
# Check MongoDB is running
docker ps | Select-String mongodb

# Check MongoDB logs
docker logs inventory-mongodb

# Test connection
docker exec -it inventory-mongodb mongosh -u admin -p admin123
```

### Redis connection issues
```powershell
# Check Redis is running
docker ps | Select-String redis

# Test connection
docker exec -it inventory-redis redis-cli -a redis123 ping
```

### TTL Index not created
```powershell
# Check setup container logs
docker logs inventory-setup

# Manually create index
docker exec -it inventory-mongodb mongosh -u admin -p admin123 --authenticationDatabase admin
use inventory
db.api_keys.createIndex({ "expires_at": 1 }, { expireAfterSeconds: 0 })
```

---

## 📚 Next Steps

- Read full API documentation: See README.md
- Learn about architecture: `docs/blueprint.d2`
- Set up production: See README.md

## 🎉 You're Ready!

Server is running at: **http://localhost:3030**

- API endpoints: `/api/keys/*`
- Admin endpoints: `/admin/*`
- Metrics: `/admin/metrics`
