# Docker Deployment Guide

## 🐳 Docker Compose Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Docker Compose Services                                │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  1. MongoDB (mongodb)                                    │
│     - Port: 27017                                        │
│     - Credentials: admin/admin123                        │
│     - Volume: mongodb_data                               │
│     - Healthcheck: Every 10s                             │
│                                                           │
│  2. Redis (redis)                                        │
│     - Port: 6379                                         │
│     - Password: redis123                                 │
│     - Volume: redis_data                                 │
│     - Healthcheck: Every 10s                             │
│                                                           │
│  3. Setup (setup) - One-time initialization              │
│     - Waits for MongoDB to be healthy                    │
│     - Runs: scripts/setup-ttl-index.js                   │
│     - Creates TTL index on expires_at field              │
│     - Exits after completion                             │
│                                                           │
│  4. Inventory API (app)                                  │
│     - Port: 3030                                         │
│     - Built from Dockerfile                              │
│     - Waits for: MongoDB + Redis + Setup                 │
│     - Auto-restart: unless-stopped                       │
│     - Healthcheck: /health endpoint                      │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

## 🚀 Usage

### Start Everything
```powershell
# First time (build images)
docker-compose up -d --build

# Subsequent runs (use cached images)
docker-compose up -d
```

### Check Status
```powershell
# List running containers
docker ps

# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f app
docker-compose logs -f mongodb
docker-compose logs -f setup
```

### Stop Services
```powershell
# Stop but keep data
docker-compose down

# Stop and remove all data (fresh start)
docker-compose down -v
```

### Restart App Only
```powershell
docker-compose restart app
```

### Rebuild App After Code Changes
```powershell
docker-compose up -d --build app
```

## 📦 Dockerfile Explanation

### Multi-stage Build

1. **Base Stage**
   - Uses `oven/bun:1` official image
   - Sets working directory

2. **Install Stage**
   - Installs dependencies
   - Generates Prisma client
   - Frozen lockfile for reproducibility

3. **Build Stage**
   - Copies dependencies and source code

4. **Release Stage**
   - Minimal production image
   - Only includes necessary files
   - Runs the application

### Why Multi-stage?
- Smaller final image size
- Faster builds (cached layers)
- Better security (no build tools in production)

## 🔧 Configuration

### Environment Variables

All configured in `docker-compose.yml`:
```yaml
environment:
  PORT: 3030
  MONGODB_URI: mongodb://admin:admin123@mongodb:27017/inventory?authSource=admin
  REDIS_HOST: redis
  REDIS_PORT: 6379
  REDIS_PASSWORD: redis123
  NODE_ENV: development
  RATE_LIMIT_MAX: 100
  RATE_LIMIT_WINDOW: 60000
  CACHE_TTL: 900
```

### Volumes

- `mongodb_data`: Persists MongoDB data
- `redis_data`: Persists Redis data
- `./scripts:/scripts`: Mounts setup scripts

### Network

All services communicate via `inventory-network` bridge network.

Services use service names as hostnames:
- App connects to: `mongodb:27017`
- App connects to: `redis:6379`

## 🔍 Troubleshooting

### App won't start
```powershell
# Check app logs
docker-compose logs app

# Common issues:
# 1. MongoDB not ready -> Check: docker-compose logs mongodb
# 2. Redis not ready -> Check: docker-compose logs redis
# 3. Setup failed -> Check: docker-compose logs setup
```

### Setup service failed
```powershell
# View setup logs
docker logs inventory-setup

# Manually run setup
docker exec -it inventory-mongodb mongosh \
  mongodb://admin:admin123@localhost:27017/inventory?authSource=admin \
  --file /scripts/setup-ttl-index.js
```

### Port conflicts
If ports 27017, 6379, or 3030 are already in use:

Edit `docker-compose.yml`:
```yaml
ports:
  - "27018:27017"  # MongoDB on different port
  - "6380:6379"    # Redis on different port
  - "3031:3030"    # App on different port
```

### Clean slate restart
```powershell
# Stop everything and remove all data
docker-compose down -v

# Remove all images (force rebuild)
docker-compose down --rmi all -v

# Start fresh
docker-compose up -d --build
```

## 📊 Monitoring in Docker

### Health Checks

All services have health checks:

**MongoDB**: Runs `db.runCommand("ping")`
**Redis**: Runs `redis-cli ping`
**App**: Calls `GET /health`

View health status:
```powershell
docker ps
# Look at STATUS column
```

### Resource Usage
```powershell
# View resource usage
docker stats

# View specific container
docker stats inventory-app
```

## 🚢 Production Deployment

For production, consider:

1. **Use `.env` file or secrets management**
   ```yaml
   env_file:
     - .env.production
   ```

2. **Enable TLS for Redis**
   ```yaml
   environment:
     REDIS_TLS: "true"
   ```

3. **Use managed services**
   - MongoDB Atlas
   - AWS ElastiCache (Redis)
   - Deploy app to Kubernetes/ECS

4. **Add monitoring**
   - Prometheus for metrics
   - Grafana for visualization
   - ELK stack for logs

5. **Use secrets**
   ```yaml
   secrets:
     mongodb_password:
       external: true
   ```

## 🔐 Security Notes

Current setup is for **development only**:
- ❌ Weak passwords
- ❌ Exposed ports
- ❌ No TLS
- ❌ No authentication on admin endpoints

For production:
- ✅ Use strong passwords
- ✅ Use secrets management
- ✅ Enable TLS
- ✅ Add authentication
- ✅ Limit network exposure
- ✅ Use read-only filesystem where possible
