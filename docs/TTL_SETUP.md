# MongoDB TTL Index Setup

After running `bun run db:push`, you need to manually create the TTL index in MongoDB.

## Using Docker Compose (Local Development)

```powershell
# Connect to MongoDB container
docker exec -it inventory-mongodb mongosh -u admin -p admin123 --authenticationDatabase admin

# Switch to inventory database
use inventory

# Create TTL index
db.api_keys.createIndex(
  { "expires_at": 1 },
  { expireAfterSeconds: 0 }
)

# Verify the index was created
db.api_keys.getIndexes()

# Exit mongosh
exit
```

## Using MongoDB Atlas or Remote MongoDB

```powershell
# Connect via mongosh
mongosh "your-mongodb-uri"

# Switch to your database
use inventory

# Create TTL index
db.api_keys.createIndex(
  { "expires_at": 1 },
  { expireAfterSeconds: 0 }
)

# Verify
db.api_keys.getIndexes()
```

## Using the Script

Alternatively, run the provided script:

```powershell
docker exec -it inventory-mongodb mongosh -u admin -p admin123 --authenticationDatabase admin < scripts/setup-ttl-index.js
```

## What This Does

The TTL (Time To Live) index automatically deletes documents when the `expires_at` field is reached:

- **Field**: `expires_at`
- **Delay**: `0` seconds (delete immediately when expired)
- **Background**: MongoDB checks every 60 seconds

This means expired API keys will be automatically removed from the database within ~60 seconds of expiration.

## Verification

To verify the TTL index is working:

```javascript
// Create a test key that expires in 2 minutes
db.api_keys.insertOne({
  searchable_hash: "test123456789abc",
  hashed_api_key: "$argon2id$...",
  item_key: "test://service/key",
  permission: ["read"],
  published_at: new Date(),
  expires_at: new Date(Date.now() + 120000), // 2 minutes from now
  used_count: 0,
  max_uses: 100
})

// Wait 3-4 minutes, then check if it's gone
db.api_keys.find({ searchable_hash: "test123456789abc" })
```
