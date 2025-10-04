# Route Conflict Fix

## Problem
Elysia router encountered a conflict with dynamic route parameters:
```
/admin/keys/:itemKey          (list keys by item)
/admin/keys/:hashedApiKey/stats  (get key stats)
```

Both routes start with `/admin/keys/:param` and Elysia cannot distinguish between them.

## Solution
Restructured admin routes to avoid parameter conflicts:

### Old Routes
```
GET    /admin/keys/:itemKey              → List keys by item
GET    /admin/keys/:hashedApiKey/stats   → Get key statistics  
DELETE /admin/keys/:hashedApiKey         → Revoke key
DELETE /admin/keys/expired               → Cleanup expired
GET    /admin/stats                      → Overall stats
GET    /admin/metrics                    → View metrics
POST   /admin/metrics/reset              → Reset metrics
```

### New Routes (Fixed)
```
GET    /admin/keys/by-item?itemKey=<key>  → List keys by item (query param)
GET    /admin/keys/stats/:hashedApiKey    → Get key statistics
DELETE /admin/keys/revoke/:hashedApiKey   → Revoke key
DELETE /admin/keys/expired                → Cleanup expired
GET    /admin/stats                       → Overall stats
GET    /admin/metrics                     → View metrics
POST   /admin/metrics/reset               → Reset metrics
```

## Changes Made

### 1. List Keys by Item
**Before**: Path parameter
```typescript
.get('/keys/:itemKey', async ({ params, set }) => {
  return await adminService.listKeysByItem(params.itemKey)
})
```

**After**: Query parameter
```typescript
.get('/keys/by-item', async ({ query, set }) => {
  const itemKey = query.itemKey as string
  if (!itemKey) {
    return { error: 'itemKey query parameter is required' }
  }
  return await adminService.listKeysByItem(itemKey)
})
```

### 2. Get Key Statistics
**Before**: `/keys/:hashedApiKey/stats`
**After**: `/keys/stats/:hashedApiKey`

### 3. Revoke Key
**Before**: `/keys/:hashedApiKey`
**After**: `/keys/revoke/:hashedApiKey`

## Usage Examples

### List Keys by Item
```powershell
# Before
curl http://localhost:3030/admin/keys/myapp%3A%2F%2Fusers%2Fuser123

# After
curl "http://localhost:3030/admin/keys/by-item?itemKey=myapp%3A%2F%2Fusers%2Fuser123"
```

### Get Key Statistics
```powershell
# Before
curl http://localhost:3030/admin/keys/abc123/stats

# After
curl http://localhost:3030/admin/keys/stats/abc123
```

### Revoke Key
```powershell
# Before
curl -X DELETE http://localhost:3030/admin/keys/abc123

# After
curl -X DELETE http://localhost:3030/admin/keys/revoke/abc123
```

## Why This Fix Works

1. **Specific paths come first**: `/keys/by-item`, `/keys/stats/:id`, `/keys/revoke/:id`, `/keys/expired`
2. **No parameter conflicts**: Each path has a unique static prefix
3. **Query parameters**: More flexible for complex item keys (no URL encoding issues)

## Updated Documentation

- ✅ `docs/API.md` updated with new routes
- ✅ `src/routes/admin.ts` restructured
- ✅ Route order optimized (static before dynamic)
