# 테스트 가이드

## 테스트 실행

### 사전 준비

```bash
# Docker Compose로 전체 스택 시작
docker-compose up -d

# 서비스가 준비될 때까지 대기 (약 10-15초)
docker-compose logs -f setup

# 준비 완료 확인
curl http://localhost:3030/health
```

### 테스트 실행

```bash
# 모든 테스트 실행
bun test

# Watch 모드
bun test --watch

# 특정 테스트 파일만 실행
bun test tests/api.test.ts
```

## 테스트 구조

### `tests/api.test.ts`

통합 테스트 - 실제 API 엔드포인트를 호출하여 전체 플로우 검증:

1. **Health Check**
   - 서비스 상태 확인
   - MongoDB/Redis 연결 확인

2. **API Key Publishing**
   - 새 API 키 생성
   - 검증 규칙 테스트 (itemKey 형식, permission, expiresAt 등)
   - 에러 처리 검증

3. **API Key Validation**
   - 유효한 키 검증
   - 무효한 키 거부
   - 사용 횟수 증가 확인

4. **Admin API**
   - 아이템별 키 조회
   - 전체 통계 조회
   - 메트릭 조회

5. **Rate Limiting**
   - 레이트 리밋 동작 확인

## 테스트 환경 변수

```bash
# 테스트할 서버 URL (기본값: http://localhost:3030)
export TEST_BASE_URL=http://localhost:3030

# 테스트 실행
bun test
```

## CI/CD에서 테스트

GitHub Actions 예시:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      mongodb:
        image: mongo:7
        ports:
          - 27017:27017
        env:
          MONGO_INITDB_ROOT_USERNAME: admin
          MONGO_INITDB_ROOT_PASSWORD: admin123
        options: >-
          --health-cmd "echo 'db.runCommand(\"ping\").ok' | mongosh localhost:27017/test --quiet"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      
      - uses: oven-sh/setup-bun@v1
      
      - name: Install dependencies
        run: bun install
      
      - name: Generate Prisma Client
        run: bun db:generate
      
      - name: Start server in background
        run: bun start &
        env:
          MONGODB_URI: mongodb://admin:admin123@localhost:27017/inventory?authSource=admin&replicaSet=rs0
          REDIS_HOST: localhost
          REDIS_PORT: 6379
          REDIS_PASSWORD: ""
          PORT: 3030
      
      - name: Wait for server
        run: sleep 10
      
      - name: Run tests
        run: bun test
```

## 수동 테스트

### cURL로 API 테스트

```bash
# Health check
curl http://localhost:3030/health | jq

# API 키 발행
curl -X POST http://localhost:3030/api/keys/publish \
  -H "Content-Type: application/json" \
  -d '{
    "itemKey": "https://example.com/item/123?variant=blue",
    "permission": ["read", "write"],
    "expiresAt": "2025-12-31T23:59:59Z",
    "maxUses": 1000
  }' | jq

# API 키 검증 (발행된 키로 교체)
curl -X POST http://localhost:3030/api/keys/validate \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "YOUR_API_KEY_HERE"
  }' | jq

# Admin - 아이템별 키 조회
curl "http://localhost:3030/admin/keys/by-item?itemKey=https://example.com/item/123?variant=blue" | jq

# Admin - 전체 통계
curl http://localhost:3030/admin/stats | jq

# Admin - 메트릭
curl http://localhost:3030/admin/metrics | jq
```

### HTTPie로 API 테스트

```bash
# 설치
brew install httpie  # macOS
# or
apt install httpie   # Ubuntu

# API 키 발행
http POST http://localhost:3030/api/keys/publish \
  itemKey="https://example.com/item/123" \
  permission:='["read", "write"]' \
  expiresAt="2025-12-31T23:59:59Z" \
  maxUses:=1000

# API 키 검증
http POST http://localhost:3030/api/keys/validate \
  apiKey="YOUR_API_KEY_HERE"
```

## 부하 테스트

### k6로 부하 테스트

```javascript
// load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },  // Ramp up
    { duration: '1m', target: 50 },   // Stay at 50 users
    { duration: '30s', target: 0 },   // Ramp down
  ],
};

const API_KEY = __ENV.API_KEY || 'your-test-api-key';

export default function () {
  const res = http.post('http://localhost:3030/api/keys/validate', 
    JSON.stringify({
      apiKey: API_KEY
    }), 
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });

  sleep(1);
}
```

실행:

```bash
# k6 설치
brew install k6  # macOS

# 부하 테스트 실행
k6 run load-test.js
```

## 테스트 데이터 정리

```bash
# MongoDB 데이터 정리
docker exec -it inventory-mongodb mongosh -u admin -p admin123 --authenticationDatabase admin
> use inventory
> db.ApiKey.deleteMany({})

# Redis 데이터 정리
docker exec -it inventory-redis redis-cli -a redis123
> FLUSHALL

# 또는 전체 리셋
docker-compose down -v
docker-compose up -d
```

## 문제 해결

### 테스트가 실패하는 경우

1. **서비스 상태 확인**
   ```bash
   curl http://localhost:3030/health
   ```

2. **로그 확인**
   ```bash
   docker-compose logs -f app
   ```

3. **MongoDB Replica Set 확인**
   ```bash
   docker exec -it inventory-mongodb mongosh -u admin -p admin123 --authenticationDatabase admin --eval "rs.status()"
   ```

4. **포트 충돌 확인**
   ```bash
   lsof -i :3030
   lsof -i :27017
   lsof -i :6379
   ```

## 테스트 작성 팁

1. **테스트 격리**: 각 테스트는 독립적으로 실행 가능해야 함
2. **리소스 정리**: 테스트 후 생성한 데이터 정리
3. **비동기 처리**: `await`를 잊지 말 것
4. **타임아웃**: 긴 작업에는 적절한 타임아웃 설정
5. **에러 메시지**: 실패 시 유용한 에러 메시지 제공
