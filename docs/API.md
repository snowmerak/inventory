# API Documentation

## Public Endpoints

### Validate API Key

**Endpoint**: `POST /api/keys/validate`

**Rate Limit**: 100 requests per minute per IP

**Request**:
```json
{
  "apiKey": "your-64-char-api-key"
}
```

**Success Response** (200):
```json
{
  "success": true,
  "data": {
    "valid": true,
    "itemKey": "myapp://users/user123",
    "permission": ["read", "write"],
    "expiresAt": "2025-12-31T23:59:59.000Z",
    "usedCount": 5,
    "maxUses": 100
  }
}
```

**Error Responses**:
- `400` - Validation error (missing/invalid API key)
- `401` - Unauthorized (invalid API key)
- `403` - Expired or usage limit exceeded
- `404` - API key not found
- `429` - Rate limit exceeded
- `503` - Lock acquisition failed

## Private Endpoints

### Publish API Key

**Endpoint**: `POST /api/keys/publish`

**Request**:
```json
{
  "itemKey": "myapp://users/user123?action=read",
  "permission": ["read", "write"],
  "expiresAt": "2025-12-31T23:59:59.000Z",
  "maxUses": 100
}
```

**Success Response** (200):
```json
{
  "success": true,
  "data": {
    "apiKey": "abc...xyz",  // Original key - shown only once!
    "itemKey": "myapp://users/user123?action=read",
    "permission": ["read", "write"],
    "publishedAt": "2025-10-04T12:00:00.000Z",
    "expiresAt": "2025-12-31T23:59:59.000Z",
    "maxUses": 100
  }
}
```

**Error Responses**:
- `400` - Validation error
- `409` - Duplicate API key (collision)
- `500` - Internal error

## Admin Endpoints

⚠️ **Note**: These endpoints should be protected in production!

### List Keys by Item

**Endpoint**: `GET /admin/keys/:itemKey`

**Example**: `GET /admin/keys/myapp%3A%2F%2Fusers%2Fuser123`

**Response**:
```json
{
  "success": true,
  "data": {
    "itemKey": "myapp://users/user123",
    "count": 2,
    "keys": [
      {
        "id": "507f1f77bcf86cd799439011",
        "itemKey": "myapp://users/user123",
        "permission": ["read"],
        "publishedAt": "2025-10-04T12:00:00.000Z",
        "expiresAt": "2025-12-31T23:59:59.000Z",
        "usedCount": 10,
        "maxUses": 100,
        "isExpired": false,
        "isExhausted": false
      }
    ]
  }
}
```

### Get Key Statistics

**Endpoint**: `GET /admin/keys/:hashedApiKey/stats`

**Response**:
```json
{
  "success": true,
  "data": {
    "usedCount": 45,
    "maxUses": 100,
    "remainingUses": 55,
    "expiresAt": "2025-12-31T23:59:59.000Z",
    "isExpired": false,
    "isExhausted": false,
    "utilizationRate": 45.0
  }
}
```

### Get Overall Statistics

**Endpoint**: `GET /admin/stats`

**Response**:
```json
{
  "success": true,
  "data": {
    "totalKeys": 150,
    "activeKeys": 120,
    "expiredKeys": 20,
    "exhaustedKeys": 10,
    "topItems": [
      {
        "itemKey": "myapp://users/user123",
        "keyCount": 5
      }
    ]
  }
}
```

### Cleanup Expired Keys

**Endpoint**: `DELETE /admin/keys/expired`

**Response**:
```json
{
  "success": true,
  "data": {
    "deletedCount": 15,
    "message": "Deleted 15 expired API key(s)"
  }
}
```

Note: With MongoDB TTL index, this is done automatically.

### Revoke API Key

**Endpoint**: `DELETE /admin/keys/:hashedApiKey`

**Response**:
```json
{
  "success": true,
  "data": {
    "message": "API key revoked successfully",
    "id": "507f1f77bcf86cd799439011",
    "revokedAt": "2025-10-04T12:34:56.000Z"
  }
}
```

### Get Metrics

**Endpoint**: `GET /admin/metrics`

**Response**:
```json
{
  "success": true,
  "data": {
    "keysPublished": 150,
    "keysValidated": 5430,
    "keysValidationFailed": 23,
    "avgValidationTime": 12.5,
    "avgPublishTime": 145.3,
    "cacheHits": 5200,
    "cacheMisses": 230,
    "cacheHitRate": 95.76,
    "rateLimitErrors": 15,
    "lockAcquisitionErrors": 2,
    "validationErrors": 23,
    "uptime": 3600000,
    "startTime": 1728048000000
  }
}
```

### Reset Metrics

**Endpoint**: `POST /admin/metrics/reset`

**Response**:
```json
{
  "success": true,
  "data": {
    "message": "Metrics reset successfully"
  }
}
```

## Health Check

**Endpoint**: `GET /health`

**Response**:
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

## Error Response Format

All errors follow this format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}
```

### Error Codes

- `VALIDATION_ERROR` - Invalid request data
- `NOT_FOUND` - Resource not found
- `DUPLICATE_ERROR` - Duplicate resource
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `LOCK_ACQUISITION_FAILED` - Could not acquire distributed lock
- `UNAUTHORIZED` - Invalid credentials
- `EXPIRED` - API key expired
- `USAGE_LIMIT_EXCEEDED` - Usage limit reached
- `INTERNAL_ERROR` - Server error

## Examples

### cURL Examples

#### Publish API Key
```bash
curl -X POST http://localhost:3030/api/keys/publish \
  -H "Content-Type: application/json" \
  -d '{
    "itemKey": "myapp://users/user123",
    "permission": ["read", "write"],
    "expiresAt": "2025-12-31T23:59:59.000Z",
    "maxUses": 100
  }'
```

#### Validate API Key
```bash
curl -X POST http://localhost:3030/api/keys/validate \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "your-64-char-api-key-here"
  }'
```

#### Get Metrics
```bash
curl http://localhost:3030/admin/metrics
```

### PowerShell Examples

#### Publish API Key
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

#### Validate API Key
```powershell
$body = @{
  apiKey = "your-64-char-api-key-here"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3030/api/keys/validate" `
  -Method Post `
  -ContentType "application/json" `
  -Body $body
```
