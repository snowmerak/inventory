# Elysia 타입 스키마 가이드

이 프로젝트의 모든 API 엔드포인트는 Elysia의 TypeBox 기반 스키마 시스템을 사용하여 런타임 타입 검증을 수행합니다.

## 적용된 변경 사항

### 1. API Routes (`src/routes/api.ts`)

#### POST `/api/keys/publish`
**Request Body Schema:**
```typescript
{
  itemKey: string,        // 최소 1자, scheme://service/key?query 형식
  permission: string[],   // 최소 1개 이상의 권한
  expiresAt: string,      // ISO 8601 datetime 형식
  maxUses: number         // 최소 1 이상
}
```

**Response Schema:**
- `200`: 성공 시 API 키 정보 반환
- `400`: 검증 실패 시 에러
- `500`: 서버 내부 오류

#### POST `/api/keys/validate`
**Request Body Schema:**
```typescript
{
  apiKey: string  // 최소 1자
}
```

**Response Schema:**
- `200`: 유효한 키 정보 반환
- `400`: 검증 실패
- `401`: 인증 실패
- `429`: 레이트 리밋 초과
- `500`: 서버 내부 오류

### 2. Admin Routes (`src/routes/admin.ts`)

#### GET `/admin/keys/by-item?itemKey=...`
**Query Parameter Schema:**
```typescript
{
  itemKey: string  // 필수, 최소 1자
}
```

#### GET `/admin/keys/stats/:hashedApiKey`
**URL Parameter Schema:**
```typescript
{
  hashedApiKey: string  // 필수, Argon2id 해시값
}
```

#### DELETE `/admin/keys/revoke/:hashedApiKey`
**URL Parameter Schema:**
```typescript
{
  hashedApiKey: string  // 필수
}
```

#### POST `/admin/keys/cleanup`
만료된 API 키를 삭제합니다. 파라미터 없음.

#### GET `/admin/stats`
전체 통계를 조회합니다. 파라미터 없음.

#### GET `/admin/metrics`
시스템 메트릭을 조회합니다. 파라미터 없음.

## 스키마 검증의 장점

### 1. **런타임 타입 안정성**
```typescript
// ❌ 이전: 타입 캐스팅만 사용 (런타임 검증 없음)
const request = body as PublishApiKeyRequest

// ✅ 현재: 스키마로 자동 검증
body: t.Object({
  itemKey: t.String({ minLength: 1 }),
  // ...
})
```

### 2. **자동 문서화**
Elysia는 스키마를 기반으로 자동으로 OpenAPI 문서를 생성할 수 있습니다.

### 3. **명확한 에러 메시지**
잘못된 요청이 들어오면 어떤 필드가 문제인지 명확하게 알 수 있습니다.

### 4. **타입 추론**
TypeScript가 스키마에서 타입을 자동으로 추론하므로 `as` 캐스팅이 불필요합니다.

## TypeBox 스키마 타입

### 기본 타입
- `t.String()` - 문자열
- `t.Number()` - 숫자
- `t.Integer()` - 정수
- `t.Boolean()` - 불리언
- `t.Array(type)` - 배열
- `t.Object({ ... })` - 객체

### 제약 조건
```typescript
t.String({
  minLength: 1,           // 최소 길이
  maxLength: 100,         // 최대 길이
  format: 'date-time',    // 형식 (email, uri, date-time 등)
  pattern: '^[a-z]+$',    // 정규식 패턴
  description: '...',     // 문서화용 설명
  examples: ['...']       // 예제 값
})

t.Integer({
  minimum: 1,             // 최솟값
  maximum: 1000,          // 최댓값
  exclusiveMinimum: 0,    // 0 초과
  exclusiveMaximum: 100   // 100 미만
})
```

### 특수 타입
- `t.Literal(value)` - 정확한 값 매칭 (예: `t.Literal(true)`)
- `t.Union([type1, type2])` - 여러 타입 중 하나
- `t.Optional(type)` - 선택적 필드
- `t.Nullable(type)` - null 허용

## 사용 예제

### Request Body 검증
```typescript
.post('/endpoint', async ({ body }) => {
  // body는 이미 검증됨, 타입 안전
  const { itemKey, permission } = body
  // ...
}, {
  body: t.Object({
    itemKey: t.String({ minLength: 1 }),
    permission: t.Array(t.String(), { minItems: 1 })
  })
})
```

### Query Parameters 검증
```typescript
.get('/endpoint', async ({ query }) => {
  const { page, limit } = query
  // ...
}, {
  query: t.Object({
    page: t.Optional(t.Integer({ minimum: 1 })),
    limit: t.Optional(t.Integer({ minimum: 1, maximum: 100 }))
  })
})
```

### URL Parameters 검증
```typescript
.get('/users/:id', async ({ params }) => {
  const { id } = params
  // ...
}, {
  params: t.Object({
    id: t.String({ pattern: '^[0-9a-f]{24}$' }) // MongoDB ObjectId 형식
  })
})
```

### Response Schema 정의
```typescript
.get('/endpoint', handler, {
  response: {
    200: t.Object({
      success: t.Literal(true),
      data: t.Any()
    }),
    400: t.Object({
      success: t.Literal(false),
      error: t.Object({
        code: t.String(),
        message: t.String()
      })
    })
  }
})
```

## 추가 개선 사항

### 1. OpenAPI 문서 생성
```typescript
import { swagger } from '@elysiajs/swagger'

const app = new Elysia()
  .use(swagger({
    documentation: {
      info: {
        title: 'Inventory API',
        version: '1.0.0'
      }
    }
  }))
  // ... routes
```

### 2. 스키마 재사용
공통 스키마를 별도 파일로 분리:
```typescript
// src/schemas/api-key.schema.ts
export const ApiKeySchema = t.Object({
  itemKey: t.String({ minLength: 1 }),
  permission: t.Array(t.String(), { minItems: 1 }),
  // ...
})
```

### 3. 커스텀 검증
```typescript
import { t } from 'elysia'

const ItemKeySchema = t.String({
  pattern: '^[a-z]+://[^/]+/.*$',
  description: 'Must be in format: scheme://service/path'
})
```

## 참고 자료

- [Elysia Type System](https://elysiajs.com/validation/overview.html)
- [TypeBox Documentation](https://github.com/sinclairzx81/typebox)
- [JSON Schema](https://json-schema.org/)
