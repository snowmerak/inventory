// MongoDB TTL Index Setup Script
// Run this in MongoDB shell or via mongosh

// Connect to your database
use inventory

// Create TTL index on expiresAt field
// Documents will be automatically deleted when expiresAt is reached
db.api_keys.createIndex(
  { "expires_at": 1 },
  { expireAfterSeconds: 0 }
)

// Verify the index
db.api_keys.getIndexes()

// Expected output should include:
// {
//   "key": { "expires_at": 1 },
//   "expireAfterSeconds": 0,
//   ...
// }
