# Inventory API - API Key Management System

A secure API key management system built with Elysia, Bun, MongoDB, and Redis.

## 🏗️ Architecture

- **API Framework**: ElysiaJS
- **Runtime**: Bun
- **Database**: MongoDB (with Prisma ORM)
- **Cache**: Redis
- **Security**: Argon2id hashing, distributed locking

## 🚀 Quick Start

### Prerequisites
- Bun installed
- Docker and Docker Compose (for local development)

### Local Development Setup

1. **Install dependencies**
```bash
bun install
```

2. **Start infrastructure (MongoDB + Redis)**
```bash
bun run docker:up
```

3. **Set environment variables**

For local development with docker-compose:
```bash
# Windows PowerShell
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

4. **Generate Prisma client**
```bash
bun run db:generate
```

5. **Push database schema**
```bash
bun run db:push
```

6. **Setup MongoDB TTL Index** (for automatic expiration)
```bash
# See docs/TTL_SETUP.md for detailed instructions
docker exec -it inventory-mongodb mongosh -u admin -p admin123 --authenticationDatabase admin

# In mongosh:
use inventory
db.api_keys.createIndex({ "expires_at": 1 }, { expireAfterSeconds: 0 })
exit
```

7. **Start development server**
```bash
bun run dev
```

Open http://localhost:3030/ with your browser.

## 📋 Available Scripts

```bash
bun run dev          # Start development server with watch mode
bun run start        # Start production server
bun run db:generate  # Generate Prisma client
bun run db:push      # Push schema to database
bun run db:studio    # Open Prisma Studio
bun run docker:up    # Start Docker containers
bun run docker:down  # Stop Docker containers
bun run docker:logs  # View Docker logs
```

## 🐳 Docker Compose (Local Development)

The `docker-compose.yml` provides:
- MongoDB 7 (port 27017)
  - Username: `admin`
  - Password: `admin123`
- Redis 7 (port 6379)
  - Password: `redis123`

## 🔧 Production Deployment

For production (Kubernetes, cloud services):

1. Set environment variables via K8s secrets or cloud provider:
```yaml
PORT: "3030"
MONGODB_URI: "mongodb+srv://user:pass@cluster.mongodb.net/inventory"
REDIS_HOST: "your-redis-cluster.cache.amazonaws.com"
REDIS_PORT: "6379"
REDIS_PASSWORD: "your-secure-password"
REDIS_TLS: "true"
NODE_ENV: "production"
```

2. Run the application:
```bash
bun run start
```

## 📊 Health Check

```bash
GET /health
```

Returns the status of MongoDB and Redis connections.

## 🏗️ Project Structure

```
src/
├── config/
│   └── env.ts                 # Environment configuration
├── db/
│   ├── prisma.ts             # Prisma client
│   └── api-key-repository.ts # Database operations
├── cache/
│   ├── redis.ts              # Redis client
│   ├── distributed-lock.ts   # Distributed locking
│   └── api-key-cache.ts      # Cache operations
├── utils/
│   └── crypto.ts             # API key generation & hashing
└── index.ts                   # Application entry point
```

## 📝 Item Key Format

Item keys follow URI format:
```
<scheme>://<service>/<key>?<query>
```

Example:
```
myapp://users/user123?action=read
```

## 🔒 Security Features

- ✅ **Dual Hash Strategy**: SHA-1 (fast lookup) + Argon2id (secure verification)
- ✅ **Distributed Locking**: Prevents race conditions in validation
- ✅ **Rate Limiting**: 100 requests/minute per IP (configurable)
- ✅ **Automatic Expiration**: MongoDB TTL index for expired keys
- ✅ **Usage Limits**: Max uses per API key
- ✅ **Cache Layer**: Redis with 15-minute TTL

## 📊 Monitoring

- **Metrics Endpoint**: `GET /admin/metrics`
- **Track**: Publish/validate operations, cache hit rate, errors
- **Performance**: Average response times

## 🛠️ Admin Features

- List API keys by item
- Get key statistics (usage, expiration)
- Revoke keys
- Cleanup expired keys
- View overall statistics
- Monitor metrics

See [API Documentation](docs/API.md) for details.

## 📄 License

MIT License - Copyright (c) 2023 snowmerak
