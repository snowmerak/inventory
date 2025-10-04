# MongoDB Replica Set 설정

## 문제

Prisma는 MongoDB에서 트랜잭션을 사용하려면 Replica Set이 필요합니다.

```
PrismaClientKnownRequestError: 
Prisma needs to perform transactions, which requires your MongoDB server to be run as a replica set.
```

## 해결 방법

### Docker Compose에서 자동 설정

`docker-compose.yml`이 이미 Replica Set을 자동으로 설정하도록 구성되어 있습니다:

1. **MongoDB 컨테이너**: `--replSet rs0` 옵션으로 실행
2. **Setup 서비스**: 첫 실행 시 자동으로 replica set 초기화
3. **Connection String**: `replicaSet=rs0` 파라미터 포함

### 사용 방법

```bash
# 전체 스택 시작 (자동으로 replica set 초기화)
docker-compose up -d

# 로그 확인
docker-compose logs -f setup
docker-compose logs -f mongodb
```

### 검증

```bash
# MongoDB에 접속
docker exec -it inventory-mongodb mongosh -u admin -p admin123 --authenticationDatabase admin

# Replica set 상태 확인
rs.status()

# 출력 예시:
# {
#   set: 'rs0',
#   members: [
#     {
#       _id: 0,
#       name: 'mongodb:27017',
#       health: 1,
#       state: 1,
#       stateStr: 'PRIMARY'
#     }
#   ]
# }
```

## 로컬 개발 (Docker 없이)

로컬에서 MongoDB를 직접 실행하는 경우:

```bash
# Replica set으로 MongoDB 시작
mongod --replSet rs0 --port 27017 --dbpath /data/db

# 다른 터미널에서 replica set 초기화
mongosh --eval "rs.initiate({_id: 'rs0', members: [{_id: 0, host: 'localhost:27017'}]})"
```

### Connection String

```bash
# .env 파일
MONGODB_URI=mongodb://localhost:27017/inventory?replicaSet=rs0
```

## 주의사항

1. **단일 노드 Replica Set**: 개발 환경에서는 단일 노드로 충분
2. **Production**: 실제 운영 환경에서는 최소 3개 노드 권장
3. **재시작**: MongoDB 컨테이너 재시작 시 replica set 설정은 유지됨
4. **볼륨 삭제**: `docker-compose down -v`로 볼륨을 삭제하면 setup이 다시 실행됨

## Prisma와 Replica Set

Prisma는 다음 작업에서 트랜잭션을 사용합니다:

- 중복 체크 후 insert (race condition 방지)
- 여러 모델 간의 관계 설정
- `$transaction()` 명시적 사용

우리 코드에서는 `publisher.ts`의 중복 체크 로직에서 필요합니다:

```typescript
// 암묵적 트랜잭션
const exists = await this.repository.exists(hashedApiKey)
if (exists) {
  throw new DuplicateError('API key already exists')
}
const apiKey = await this.repository.create({...})
```

## 문제 해결

### 에러가 계속 발생하는 경우

```bash
# 모든 컨테이너와 볼륨 삭제
docker-compose down -v --rmi all

# 다시 시작
docker-compose up -d --build

# setup 로그 확인
docker-compose logs setup

# MongoDB replica set 상태 확인
docker exec -it inventory-mongodb mongosh -u admin -p admin123 --authenticationDatabase admin --eval "rs.status()"
```

## 참고 자료

- [Prisma MongoDB Replica Set](https://www.prisma.io/docs/concepts/database-connectors/mongodb#replica-set-configuration)
- [MongoDB Replica Set](https://www.mongodb.com/docs/manual/replication/)
