# Elysia Type Schema Guide

All API endpoints in this project use Elysia's TypeBox-based schema system to perform runtime type validation.

## Applied Changes

### 1. API Routes (`src/routes/api.ts`)

#### POST `/api/keys/publish`
**Request Body Schema:**
```typescript
{
  itemKey: string,        // Min 1 char, format: scheme://service/key?query
  permission: string[],   // At least 1 permission required
  expiresAt: string,      // ISO 8601 datetime format
  maxUses: number         // Minimum 1
}
```

**Response Schema:**
- `200`: Returns API key information on success
- `400`: Validation failure error
- `500`: Internal server error

#### POST `/api/keys/validate`
**Request Body Schema:**
```typescript
{
  apiKey: string  // Min 1 char
}
```

**Response Schema:**
- `200`: Returns valid key information
- `400`: Validation failure
- `401`: Authentication failure
- `429`: Rate limit exceeded
- `500`: Internal server error

### 2. Admin Routes (`src/routes/admin.ts`)

#### GET `/admin/keys/by-item?itemKey=...`
**Query Parameter Schema:**
```typescript
{
  itemKey: string  // Required, min 1 char
}
```

#### GET `/admin/keys/stats/:hashedApiKey`
**URL Parameter Schema:**
```typescript
{
  hashedApiKey: string  // Required, Argon2id hash value
}
```

#### DELETE `/admin/keys/revoke/:hashedApiKey`
**URL Parameter Schema:**
```typescript
{
  hashedApiKey: string  // Required
}
```

#### POST `/admin/keys/cleanup`
Deletes expired API keys. No parameters required.

#### GET `/admin/stats`
Retrieves overall statistics. No parameters required.

#### GET `/admin/metrics`
Retrieves system metrics. No parameters required.

## Benefits of Schema Validation

### 1. **Runtime Type Safety**
```typescript
// ❌ Before: Type casting only (no runtime validation)
const request = body as PublishApiKeyRequest

// ✅ Now: Automatic validation with schema
body: t.Object({
  itemKey: t.String({ minLength: 1 }),
  // ...
})
```

### 2. **Automatic Documentation**
Elysia can automatically generate OpenAPI documentation based on schemas.

### 3. **Clear Error Messages**
When invalid requests come in, you can clearly see which field has the problem.

### 4. **Type Inference**
TypeScript automatically infers types from schemas, eliminating the need for `as` casting.

## TypeBox Schema Types

### Basic Types
- `t.String()` - String
- `t.Number()` - Number
- `t.Integer()` - Integer
- `t.Boolean()` - Boolean
- `t.Array(type)` - Array
- `t.Object({ ... })` - Object

### Constraints
```typescript
t.String({
  minLength: 1,           // Minimum length
  maxLength: 100,         // Maximum length
  format: 'date-time',    // Format (email, uri, date-time, etc.)
  pattern: '^[a-z]+$',    // Regex pattern
  description: '...',     // Description for documentation
  examples: ['...']       // Example values
})

t.Integer({
  minimum: 1,             // Minimum value
  maximum: 1000,          // Maximum value
  exclusiveMinimum: 0,    // Greater than 0
  exclusiveMaximum: 100   // Less than 100
})
```

### Special Types
- `t.Literal(value)` - Exact value matching (e.g., `t.Literal(true)`)
- `t.Union([type1, type2])` - One of multiple types
- `t.Optional(type)` - Optional field
- `t.Nullable(type)` - Allows null

## Usage Examples

### Request Body Validation
```typescript
.post('/endpoint', async ({ body }) => {
  // body is already validated, type-safe
  const { itemKey, permission } = body
  // ...
}, {
  body: t.Object({
    itemKey: t.String({ minLength: 1 }),
    permission: t.Array(t.String(), { minItems: 1 })
  })
})
```

### Query Parameters Validation
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

### URL Parameters Validation
```typescript
.get('/users/:id', async ({ params }) => {
  const { id } = params
  // ...
}, {
  params: t.Object({
    id: t.String({ pattern: '^[0-9a-f]{24}$' }) // MongoDB ObjectId format
  })
})
```

### Response Schema Definition
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

## Additional Improvements

### 1. OpenAPI Documentation Generation
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

### 2. Schema Reusability
Extract common schemas to separate files:
```typescript
// src/schemas/api-key.schema.ts
export const ApiKeySchema = t.Object({
  itemKey: t.String({ minLength: 1 }),
  permission: t.Array(t.String(), { minItems: 1 }),
  // ...
})
```

### 3. Custom Validation
```typescript
import { t } from 'elysia'

const ItemKeySchema = t.String({
  pattern: '^[a-z]+://[^/]+/.*$',
  description: 'Must be in format: scheme://service/path'
})
```

## References

- [Elysia Type System](https://elysiajs.com/validation/overview.html)
- [TypeBox Documentation](https://github.com/sinclairzx81/typebox)
- [JSON Schema](https://json-schema.org/)
