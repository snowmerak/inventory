# Inventory API - API Key Management System

![Tests](https://img.shields.io/badge/tests-passing-brightgreen)
![Docker](https://img.shields.io/badge/docker-ready-blue)
![Bun](https://img.shields.io/badge/bun-1.2.23-orange)

A secure, high-performance API key management system with dual-hash strategy, distributed caching, and automatic expiration.

## ✨ Features

- 🔒 **Dual Hash Security**: SHA-1 (fast indexing) + Argon2id (secure verification)
- ⚡ **High Performance**: Redis cache-first strategy with 95%+ hit rate
- 🔄 **Distributed Locking**: Race condition prevention with Redis locks
- 📊 **Auto Expiration**: MongoDB TTL index for automatic cleanup
- 🚦 **Rate Limiting**: Configurable IP-based rate limiting (100 req/min default)
- 📈 **Monitoring**: Built-in metrics tracking and reporting
- 🐳 **Docker Ready**: Complete Docker Compose setup
- ✅ **Fully Tested**: Comprehensive integration test suite
- 📝 **Structured Logging**: JSON logging with LogTape, sensitive data masking, and performance tracking

## 🏗️ Tech Stack

- **Runtime**: [Bun](https://bun.sh) - Fast JavaScript runtime
- **Framework**: [ElysiaJS](https://elysiajs.com) - Ergonomic web framework
- **Database**: [MongoDB 7](https://www.mongodb.com) with [Prisma](https://www.prisma.io)
- **Cache**: [Redis 7](https://redis.io) with [ioredis](https://github.com/redis/ioredis)
- **Security**: [Argon2id](https://github.com/ranisalt/node-argon2) password hashing
- **Logging**: [LogTape](https://github.com/dahlia/logtape) - Structured JSON logging

## 🚀 Quick Start

### Prerequisites

- [Docker](https://www.docker.com/get-started) and Docker Compose
- That's it! Everything else runs in containers.

### One-Command Setup

```bash
docker-compose up -d
```

That's all! The system automatically:
- ✅ Starts MongoDB with replica set
- ✅ Starts Redis cache
- ✅ Creates TTL index for expiration
- ✅ Builds and launches the API server

**Server running at**: http://localhost:3030

### Verify Installation

```bash
# Check health
curl http://localhost:3030/health

# Expected output:
# {
#   "status": "healthy",
#   "services": {
#     "mongodb": "connected",
#     "redis": "connected"
#   },
#   "timestamp": "2025-10-04T..."
# }
```

### Your First API Key

```bash
# Publish a new API key
curl -X POST http://localhost:3030/api/keys/publish \
  -H "Content-Type: application/json" \
  -d '{
    "itemKey": "myapp://users/user123",
    "permission": ["read", "write"],
    "expiresAt": "2025-12-31T23:59:59Z",
    "maxUses": 1000
  }'

# Save the returned apiKey, you'll only see it once!

# Validate the key
curl -X POST http://localhost:3030/api/keys/validate \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "YOUR_API_KEY_HERE"
  }'
```

## 📖 Table of Contents

1. [Architecture](#-architecture)
2. [API Documentation](#-api-documentation)
3. [Development](#-development)
4. [Testing](#-testing)
5. [Docker Deployment](#-docker-deployment)
6. [Configuration](#-configuration)
7. [Monitoring](#-monitoring)
8. [Logging System](#-logging-system)
9. [Security](#-security)
10. [Troubleshooting](#-troubleshooting)
11. [Contributing](#-contributing)

---

## 🏛️ Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Request                        │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │   Rate Limiter (Redis) │
         └────────────┬───────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │  Distributed Lock      │
         │  (Redis)               │
         └────────────┬───────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │   Cache Layer (Redis)  │
         │   TTL: 15 minutes      │
         └────────────┬───────────┘
                      │ Cache Miss
                      ▼
         ┌────────────────────────┐
         │   MongoDB              │
         │   - Replica Set        │
         │   - TTL Index          │
         │   - Dual Hash Storage  │
         └────────────────────────┘
```

### Dual Hash Strategy

1. **SHA-1 Hash (8 bytes)**: Fast indexing for initial lookup
2. **Argon2id Hash**: Secure verification of candidates

```typescript
// Publishing
apiKey (64 chars) 
  ├─> SHA-1 → searchableHash (indexing)
  └─> Argon2id → hashedApiKey (verification)

// Validation
apiKey → SHA-1 → Find candidates → Argon2id verify each
```

### Data Flow

**Publishing Flow:**
```
1. Generate 64-char API key
2. Create SHA-1 hash (searchableHash)
3. Create Argon2id hash (hashedApiKey)
4. Check for duplicates
5. Store in MongoDB
6. Return original key (once!)
```

**Validation Flow:**
```
1. Check rate limit (Redis)
2. Acquire distributed lock
3. Check cache (Redis)
   ├─ Hit → Return cached data
   └─ Miss ↓
4. Generate SHA-1 from provided key
5. Query MongoDB by searchableHash
6. Verify candidates with Argon2id
7. Check expiration & usage limits
8. Increment usage counter
9. Update cache
10. Release lock
```

---

## 📡 API Documentation

### Base URL

```
http://localhost:3030
```

### Public Endpoints

#### 1. Validate API Key

**Endpoint:** `POST /api/keys/validate`

**Rate Limit:** 100 requests/minute per IP

**Request:**
```json
{
  "apiKey": "your-64-character-api-key"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "itemKey": "myapp://users/user123",
    "permission": ["read", "write"],
    "expiresAt": "2025-12-31T23:59:59.000Z",
    "usedCount": 5,
    "maxUses": 1000
  }
}
```

**Error Responses:**
- `400` - Invalid request
- `401` - Invalid API key
- `403` - Expired or exhausted
- `404` - Not found
- `429` - Rate limit exceeded

---

### Private Endpoints

#### 2. Publish API Key

**Endpoint:** `POST /api/keys/publish`

**Request:**
```json
{
  "itemKey": "myapp://users/user123?action=read",
  "permission": ["read", "write"],
  "expiresAt": "2025-12-31T23:59:59Z",
  "maxUses": 1000
}
```

**Item Key Format:** `<scheme>://<service>/<key>?<query>`

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "apiKey": "abc...xyz",
    "itemKey": "myapp://users/user123?action=read",
    "permission": ["read", "write"],
    "publishedAt": "2025-10-04T12:00:00.000Z",
    "expiresAt": "2025-12-31T23:59:59.000Z",
    "maxUses": 1000
  }
}
```

⚠️ **Important:** The `apiKey` is shown only once!

---

### Admin Endpoints

⚠️ **Security:** These endpoints should be protected in production!

#### 3. List Keys by Item

```bash
GET /admin/keys/by-item?itemKey=<encoded-item-key>
```

#### 4. Get Key Statistics

```bash
GET /admin/keys/stats/:hashedApiKey
```

#### 5. Revoke API Key

```bash
DELETE /admin/keys/revoke/:hashedApiKey
```

#### 6. Get Overall Statistics

```bash
GET /admin/stats
```

#### 7. Get Metrics

```bash
GET /admin/metrics
```

**Response:**
```json
{
  "success": true,
  "data": {
    "keysPublished": 150,
    "keysValidated": 5430,
    "cacheHits": 5200,
    "cacheMisses": 230,
    "cacheHitRate": 95.76,
    "avgValidationTime": 12.5,
    "rateLimitErrors": 15
  }
}
```

#### 8. Cleanup Expired Keys

```bash
POST /admin/keys/cleanup
```

**Note:** MongoDB TTL index handles this automatically.

### Health Check

```bash
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "services": {
    "mongodb": "connected",
    "redis": "connected"
  },
  "timestamp": "2025-10-04T12:34:56.789Z"
}
```

For detailed API documentation, see [docs/API.md](docs/API.md).

---

## 💻 Development

### Local Development Setup

#### Option 1: Full Docker (Recommended)

```bash
# Everything in Docker
docker-compose up -d --build
```

#### Option 2: Hybrid (Infrastructure in Docker, App Local)

```bash
# 1. Start only infrastructure
docker-compose up -d mongodb redis setup

# 2. Install dependencies
bun install

# 3. Generate Prisma client
bun run db:generate

# 4. Set environment variables
# Windows PowerShell
$env:PORT="3030"
$env:MONGODB_URI="mongodb://localhost:27017/inventory?replicaSet=rs0&directConnection=true"
$env:REDIS_HOST="localhost"
$env:REDIS_PORT="6379"
$env:REDIS_PASSWORD="redis123"
$env:NODE_ENV="development"

# 5. Start dev server with hot reload
bun run dev
```

### Available Scripts

```bash
# Development
bun run dev              # Start with hot reload
bun run start            # Production mode

# Database
bun run db:generate      # Generate Prisma client
bun run db:push          # Push schema to database
bun run db:studio        # Open Prisma Studio

# Testing
bun test                 # Run all tests
bun test --watch         # Watch mode

# Docker
bun run docker:up        # Start all services
bun run docker:down      # Stop services
bun run docker:logs      # View logs
bun run docker:restart   # Restart app
```

### Project Structure

```
inventory/
├── src/
│   ├── config/
│   │   └── env.ts                 # Environment configuration
│   ├── db/
│   │   ├── prisma.ts             # Prisma client & health check
│   │   └── api-key-repository.ts # Database operations
│   ├── cache/
│   │   ├── redis.ts              # Redis client
│   │   ├── distributed-lock.ts   # Distributed locking
│   │   └── api-key-cache.ts      # Cache operations
│   ├── middleware/
│   │   └── rate-limiter.ts       # Rate limiting
│   ├── monitoring/
│   │   └── metrics.ts            # Metrics collection
│   ├── services/
│   │   ├── publisher.ts          # API key publishing
│   │   ├── validator.ts          # API key validation
│   │   └── admin.ts              # Admin operations
│   ├── routes/
│   │   ├── api.ts                # Public API routes
│   │   └── admin.ts              # Admin routes
│   ├── types/
│   │   ├── api.ts                # Request/response types
│   │   └── errors.ts             # Custom error classes
│   ├── utils/
│   │   ├── crypto.ts             # Hashing utilities
│   │   └── logger.ts             # LogTape logging configuration
│   └── index.ts                   # Application entry point
├── tests/
│   └── api.test.ts               # Integration tests
├── prisma/
│   └── schema.prisma             # Database schema
├── scripts/
│   └── setup-ttl-index.js        # TTL index setup
├── docs/                          # Additional documentation
├── docker-compose.yml
├── Dockerfile
└── package.json
```

---

## 🧪 Testing

### Run Tests

```bash
# Make sure services are running
docker-compose up -d

# Run all tests
bun test

# Watch mode
bun test --watch

# Specific test file
bun test tests/api.test.ts
```

### Test Coverage

- ✅ Health checks
- ✅ API key publishing (with validation)
- ✅ API key validation (cache + DB)
- ✅ Usage counter increment
- ✅ Admin endpoints
- ✅ Rate limiting
- ✅ Error handling

**Test Results:**
```bash
✓ 13 tests passed
✓ 51 assertions
✓ Completed in 1.02s
```

### Manual Testing

#### With cURL

```bash
# Publish
curl -X POST http://localhost:3030/api/keys/publish \
  -H "Content-Type: application/json" \
  -d '{
    "itemKey": "myapp://item/123",
    "permission": ["read"],
    "expiresAt": "2025-12-31T23:59:59Z",
    "maxUses": 100
  }'

# Validate
curl -X POST http://localhost:3030/api/keys/validate \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "YOUR_KEY_HERE"}'

# Metrics
curl http://localhost:3030/admin/metrics | jq
```

#### With PowerShell

```powershell
# Publish
$body = @{
  itemKey = "myapp://item/123"
  permission = @("read", "write")
  expiresAt = "2025-12-31T23:59:59Z"
  maxUses = 100
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3030/api/keys/publish" `
  -Method Post -ContentType "application/json" -Body $body
```

For detailed testing guide, see [docs/TESTING.md](docs/TESTING.md).

---

## 🐳 Docker Deployment

### Architecture

```
┌─────────────────────────────────────────────────┐
│             docker-compose.yml                  │
├─────────────┬──────────────┬──────────┬────────┤
│   mongodb   │    redis     │  setup   │  app   │
│  (rs0)      │  (cache)     │ (init)   │ (api)  │
│  :27017     │   :6379      │  (once)  │ :3030  │
└─────────────┴──────────────┴──────────┴────────┘
```

### Services

| Service    | Purpose                          | Port  | Health Check |
|------------|----------------------------------|-------|--------------|
| `mongodb`  | Database with replica set        | 27017 | `mongosh --eval "rs.status()"` |
| `redis`    | Cache & distributed locks        | 6379  | `redis-cli ping` |
| `setup`    | Initialize replica set & indexes | -     | One-time only |
| `app`      | API server                       | 3030  | `GET /health` |

### Commands

```bash
# Start all services
docker-compose up -d --build

# View logs
docker-compose logs -f app        # App logs only
docker-compose logs -f            # All services

# Restart app (after code changes)
docker-compose restart app

# Stop everything
docker-compose down

# Stop and remove volumes (fresh start)
docker-compose down -v

# Check service status
docker-compose ps

# Execute commands in containers
docker-compose exec mongodb mongosh
docker-compose exec redis redis-cli
```

### Environment Variables

Create a `.env` file in the project root:

```env
# Application
PORT=3030
NODE_ENV=production

# MongoDB
MONGODB_URI=mongodb://mongodb:27017/inventory?replicaSet=rs0&directConnection=true

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=redis123

# Optional: Rate Limiting
RATE_LIMIT_WINDOW=60000          # 1 minute in ms
RATE_LIMIT_MAX_REQUESTS=100      # Max requests per window
```

### Production Considerations

#### MongoDB Replica Set

For production, use a proper 3-node replica set:

```yaml
# docker-compose.prod.yml
services:
  mongodb-primary:
    image: mongo:7
    command: mongod --replSet rs0 --bind_ip_all --keyFile /data/mongodb-keyfile
    # ... (see docs/DOCKER.md for full config)
  
  mongodb-secondary:
    # ...
  
  mongodb-arbiter:
    # ...
```

#### Security

- ✅ Enable MongoDB authentication
- ✅ Use strong Redis password
- ✅ Set up TLS/SSL certificates
- ✅ Configure firewall rules
- ✅ Use Docker secrets for credentials

#### Scaling

```bash
# Scale app instances
docker-compose up -d --scale app=3

# Use load balancer (nginx, traefik)
# ...
```

For detailed Docker guide, see [docs/DOCKER.md](docs/DOCKER.md).

---

## ⚙️ Configuration

### Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3030` | Server port |
| `NODE_ENV` | No | `development` | Environment (development/production) |
| `MONGODB_URI` | **Yes** | - | MongoDB connection string with replica set |
| `REDIS_HOST` | **Yes** | - | Redis server host |
| `REDIS_PORT` | No | `6379` | Redis server port |
| `REDIS_PASSWORD` | **Yes** | - | Redis password |
| `REDIS_DB` | No | `0` | Redis database number |
| `RATE_LIMIT_WINDOW` | No | `60000` | Rate limit window (ms) |
| `RATE_LIMIT_MAX_REQUESTS` | No | `100` | Max requests per window |

### MongoDB Connection String

#### Local Development (Docker)
```
mongodb://localhost:27017/inventory?replicaSet=rs0&directConnection=true
```

#### Production (3-node replica set)
```
mongodb://user:pass@mongo1:27017,mongo2:27017,mongo3:27017/inventory?replicaSet=rs0&authSource=admin
```

#### Important Query Parameters

- `replicaSet=rs0` - **Required** for transactions
- `directConnection=true` - For single-node replica set (dev only)
- `authSource=admin` - For authentication
- `retryWrites=true` - Enable write retry (default)
- `w=majority` - Write concern level

### Redis Configuration

```typescript
// src/cache/redis.ts
const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || "0"),
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
});
```

### Logging

Structured JSON logging in production:

```typescript
console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  level: "info",
  message: "API key validated",
  apiKey: hash.substring(0, 16),
  itemKey: key.itemKey
}));
```

---

## 📊 Monitoring

### Health Check Endpoint

```bash
curl http://localhost:3030/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-20T10:30:00.000Z",
  "services": {
    "mongodb": "connected",
    "redis": "connected"
  }
}
```

**Status Codes:**
- `200` - All services healthy
- `503` - One or more services unavailable

### Metrics Endpoint

```bash
curl http://localhost:3030/admin/metrics
```

**Response:**
```json
{
  "activeKeys": 42,
  "expiredKeys": 15,
  "exhaustedKeys": 8,
  "totalValidations": 1523,
  "cacheHitRate": 0.87,
  "timestamp": "2025-01-20T10:30:00.000Z"
}
```

### Key Metrics to Monitor

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `cacheHitRate` | Redis cache efficiency | < 0.7 (70%) |
| `activeKeys` | Available API keys | < 10 |
| `exhaustedKeys` | Keys at max usage | Growing rapidly |
| Response time | API latency | > 500ms |
| Error rate | Failed requests | > 1% |

### Integration with Monitoring Tools

#### Prometheus

```typescript
// Add prometheus client
import { Registry, Counter, Histogram } from 'prom-client';

const register = new Registry();
const httpRequestDuration = new Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});
```

#### Grafana Dashboard

Create dashboards for:
- Request rate & latency
- Cache hit rate
- Active vs expired keys
- Error rate by endpoint

For detailed monitoring setup, see [docs/MONITORING.md](docs/MONITORING.md).

---

## 📝 Logging System

### Overview

The system uses **[LogTape](https://github.com/dahlia/logtape)** for enterprise-grade structured logging with the following features:

- **Structured JSON Output**: All logs are formatted as JSON for easy parsing and analysis
- **Sensitive Data Masking**: Automatic masking of API keys, hashes, passwords, and MongoDB credentials
- **Performance Tracking**: Built-in timing utilities for measuring operation duration
- **Caller Information**: Every log includes the calling function for full traceability
- **Categorized Loggers**: Separate loggers for app, database, cache, service, API, and admin operations

### Log Format

```json
{
  "timestamp": "2025-10-05T10:35:51.693Z",
  "level": "info",
  "category": "inventory.api",
  "message": ["API key validated successfully"],
  "itemKey": "myapp://users/123",
  "usedCount": 5,
  "maxUses": 1000,
  "clientIp": "192.168.1.100",
  "caller": "apiRoute.validate"
}
```

### Log Categories

| Category | Purpose | Examples |
|----------|---------|----------|
| `inventory.app` | Application lifecycle | Startup, shutdown, health checks |
| `inventory.db` | Database operations | Queries, connections, Prisma operations |
| `inventory.cache` | Redis operations | Cache hits/misses, lock operations |
| `inventory.service` | Business logic | Key publishing, validation, admin tasks |
| `inventory.api` | Public API endpoints | Request/response, rate limiting |
| `inventory.admin` | Admin operations | Stats, metrics, revocation |

### Log Levels

- **DEBUG**: Detailed information for debugging (cache hits, lock acquisition)
- **INFO**: General informational messages (successful operations)
- **WARN**: Warning messages (rate limits, validation failures)
- **ERROR**: Error messages (unexpected errors, database failures)

### Sensitive Data Masking

The logging system automatically masks sensitive information:

```typescript
// API Keys: Shows only first 8 characters
"apiKey-abc...def123" → "apiKey-abc***** (masked)"

// Hashes: Shows only first 16 characters  
"$argon2id$v=19$..." → "$argon2id$v=19$m***** (masked)"

// Passwords: Fully masked
"mySecretPassword" → "******* (masked)"

// MongoDB URIs: Credentials removed
"mongodb://user:pass@host/db" → "mongodb://***:***@host/db"
```

### Performance Tracking

Built-in performance timing utilities:

```typescript
import { performance } from './utils/logger'

// Start timing
const timer = performance.start('operation.name')

try {
  // ... your code ...
  
  // End timing with success
  timer.end({ success: true, additionalData: value })
} catch (error) {
  // Track error with timing
  timer.error(error, { context: 'additional info' })
}
```

### Viewing Logs

#### Development (Docker)
```bash
# Follow all logs
docker-compose logs -f app

# Filter by category
docker-compose logs app | grep "inventory.api"

# Filter by level
docker-compose logs app | grep "\"level\":\"error\""
```

#### Production
```bash
# Using jq for JSON parsing
docker-compose logs app | jq 'select(.level == "error")'

# Filter by category
docker-compose logs app | jq 'select(.category | contains("cache"))'

# Show only messages and timestamps
docker-compose logs app | jq '{timestamp, message, caller}'
```

### Log Analysis

#### Common Queries

```bash
# Find all errors in the last hour
docker-compose logs --since 1h app | jq 'select(.level == "error")'

# Track API key validation performance
docker-compose logs app | jq 'select(.message[0] | contains("validated")) | {timestamp, duration: .durationMs}'

# Monitor cache hit rate
docker-compose logs app | jq 'select(.message[0] | contains("Cache")) | .message'

# Find rate limit violations
docker-compose logs app | jq 'select(.message[0] | contains("Rate limit")) | {timestamp, clientIp, caller}'
```

#### Integration with Log Aggregation

The structured JSON format integrates seamlessly with:

- **ELK Stack** (Elasticsearch, Logstash, Kibana)
- **Grafana Loki** - Log aggregation system
- **Datadog** - Monitoring and analytics
- **CloudWatch** - AWS logging service
- **Splunk** - Log analysis platform

Example Logstash configuration:

```ruby
input {
  docker {
    type => "inventory-api"
  }
}

filter {
  json {
    source => "message"
  }
}

output {
  elasticsearch {
    hosts => ["localhost:9200"]
    index => "inventory-logs-%{+YYYY.MM.dd}"
  }
}
```

### Logger Configuration

The logger is configured in `src/utils/logger.ts`:

```typescript
import { configureLogger, logger, performance } from './utils/logger'

// Initialize at application startup
await configureLogger()

// Use in your code
logger.api.info('Request received', {
  method: 'POST',
  path: '/api/keys/validate',
  caller: 'apiRoute.validate'
})

// Performance tracking
const timer = performance.start('db.query')
// ... operation ...
timer.end({ success: true, rows: 42 })
```

### Custom Logging

Add custom context to any log:

```typescript
logger.service.info('Processing batch', {
  batchId: 'batch-123',
  itemCount: 50,
  startTime: new Date(),
  caller: 'BatchProcessor.process'
})
```

For detailed logging documentation, see [docs/LOGGING.md](docs/LOGGING.md).

---

## 🔒 Security

### Authentication Strategy

This system uses **dual hashing** for security:

1. **Argon2id** - Memory-hard, resistant to GPU/ASIC attacks
2. **SHA-1** - Fast hash for Redis key generation

```typescript
// Publishing (once)
const argonHash = await argon2.hash(apiKey);  // Store in MongoDB
const sha1Hash = createHash('sha1').update(apiKey).digest('hex');  // Cache key

// Validation (every request)
const sha1Hash = createHash('sha1').update(apiKey).digest('hex');
const cached = await redis.get(`apikey:${sha1Hash}`);  // Fast lookup
if (!cached) {
  const dbKey = await db.findUnique({ where: { apiKeyHash } });
  await argon2.verify(dbKey.apiKeyHash, apiKey);  // Verify with Argon2
}
```

### Security Best Practices

#### 1. API Key Handling

- ✅ **Never log full API keys** - Only log hash prefixes
- ✅ **Generate cryptographically secure keys** - Use `crypto.randomBytes(32)`
- ✅ **Validate input** - TypeBox schemas on all endpoints
- ✅ **Rate limiting** - Prevent brute force attacks

#### 2. Network Security

```yaml
# docker-compose.yml
services:
  mongodb:
    networks:
      - backend
    # Don't expose port publicly in production
    
  redis:
    networks:
      - backend
    command: redis-server --requirepass ${REDIS_PASSWORD}
    
  app:
    networks:
      - backend
    ports:
      - "3030:3030"  # Only expose app port
```

#### 3. Environment Variables

```bash
# NEVER commit .env to git
echo ".env" >> .gitignore

# Use strong passwords
REDIS_PASSWORD=$(openssl rand -base64 32)

# Rotate credentials regularly
```

#### 4. MongoDB Security

```javascript
// Enable authentication
db.createUser({
  user: "admin",
  pwd: "strong-password",
  roles: ["readWrite", "dbAdmin"]
});

// Use keyfile for replica set
openssl rand -base64 756 > mongodb-keyfile
chmod 400 mongodb-keyfile
```

#### 5. Production Checklist

- [ ] Enable MongoDB authentication
- [ ] Use TLS/SSL certificates
- [ ] Set up firewall rules
- [ ] Configure CORS properly
- [ ] Enable request logging
- [ ] Set up intrusion detection
- [ ] Regular security audits
- [ ] Dependency vulnerability scanning (`bun audit`)

---

## 🔧 Troubleshooting

### Common Issues

#### 1. MongoDB Replica Set Error

**Error:**
```
MongoServerError: Transaction numbers are only allowed on a replica set member or mongos
```

**Solution:**
```bash
# Check replica set status
docker-compose exec mongodb mongosh --eval "rs.status()"

# Reinitialize if needed
docker-compose down -v
docker-compose up -d
```

#### 2. Redis Connection Refused

**Error:**
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Solution:**
```bash
# Check Redis is running
docker-compose ps redis

# Check logs
docker-compose logs redis

# Restart Redis
docker-compose restart redis
```

#### 3. CRLF Line Ending Issues (Windows)

**Error:**
```
/bin/sh: 1: Syntax error: word unexpected (expecting ")")
```

**Solution:**
```bash
# Create .gitattributes
echo "*.sh text eol=lf" > .gitattributes
echo "scripts/* text eol=lf" >> .gitattributes

# Convert existing files
dos2unix scripts/*.sh  # Or use editor to convert

# Rebuild
docker-compose down -v
docker-compose up -d --build
```

#### 4. Port Already in Use

**Error:**
```
Error: bind: address already in use
```

**Solution:**
```powershell
# Windows: Find process using port
netstat -ano | findstr :3030
taskkill /PID <PID> /F

# Or change port in .env
PORT=3031
```

#### 5. Cache Miss Rate Too High

**Symptoms:**
- Slow API responses
- High database load
- Cache hit rate < 70%

**Solution:**
```bash
# Check Redis memory
docker-compose exec redis redis-cli INFO memory

# Increase Redis max memory
# In docker-compose.yml:
command: redis-server --maxmemory 512mb --maxmemory-policy allkeys-lru

# Monitor cache performance
curl http://localhost:3030/admin/metrics | jq '.cacheHitRate'
```

#### 6. API Key Validation Fails

**Debugging:**
```bash
# Check if key exists in database
docker-compose exec mongodb mongosh inventory --eval '
  db.apiKey.findOne({ itemKey: "myapp://item/123" })
'

# Check Redis cache
docker-compose exec redis redis-cli KEYS "apikey:*"
docker-compose exec redis redis-cli GET "apikey:<hash>"

# Check application logs
docker-compose logs app | grep "validation failed"
```

#### 7. High Memory Usage

**Solution:**
```yaml
# Limit container resources in docker-compose.yml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

### Debug Mode

```bash
# Enable verbose logging
NODE_ENV=development docker-compose up

# Or set log level
LOG_LEVEL=debug docker-compose up
```

### Getting Help

1. Check [GitHub Issues](https://github.com/snowmerak/inventory/issues)
2. Review [docs/](docs/) folder for detailed guides
3. Enable debug logging and check logs
4. Open a new issue with:
   - Error message
   - Docker logs
   - Environment setup
   - Steps to reproduce

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

### Development Workflow

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes**
   - Follow existing code style
   - Add tests for new features
   - Update documentation

4. **Run tests**
   ```bash
   bun test
   bun run lint  # If configured
   ```

5. **Commit with clear messages**
   ```bash
   git commit -m "feat: add new validation endpoint"
   git commit -m "fix: resolve Redis connection timeout"
   git commit -m "docs: update API documentation"
   ```

6. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

### Code Style

- Use TypeScript strict mode
- Follow existing naming conventions
- Add JSDoc comments for public APIs
- Keep functions small and focused

### Testing Requirements

- All new features must include tests
- Maintain test coverage above 80%
- Integration tests for API endpoints
- Unit tests for utility functions

### Documentation

- Update README.md for major changes
- Add entries to CHANGELOG.md
- Update API documentation in docs/API.md
- Include inline code comments

---

## 📄 License

This project is licensed under the **MIT License**.

```
MIT License

Copyright (c) 2025 snowmerak

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 📚 Additional Resources

- **[API Documentation](docs/API.md)** - Complete API reference
- **[Docker Guide](docs/DOCKER.md)** - Docker deployment details
- **[Testing Guide](docs/TESTING.md)** - Comprehensive testing guide
- **[MongoDB Replica Set](docs/MONGODB_REPLICA_SET.md)** - Replica set setup
- **[Architecture](docs/ARCHITECTURE.md)** - System architecture deep dive

---

## 🙏 Acknowledgments

Built with:
- [Bun](https://bun.sh) - Fast JavaScript runtime
- [ElysiaJS](https://elysiajs.com) - Fast and friendly web framework
- [Prisma](https://www.prisma.io) - Next-generation ORM
- [MongoDB](https://www.mongodb.com) - NoSQL database
- [Redis](https://redis.io) - In-memory data store
- [LogTape](https://github.com/dahlia/logtape) - Structured logging library

---

<div align="center">

**Made with ❤️ by [snowmerak](https://github.com/snowmerak)**

[Report Bug](https://github.com/snowmerak/inventory/issues) · [Request Feature](https://github.com/snowmerak/inventory/issues)

</div>
