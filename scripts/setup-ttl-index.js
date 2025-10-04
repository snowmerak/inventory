// MongoDB TTL Index Setup Script
// This script is automatically run by docker-compose setup service

console.log('🚀 Setting up MongoDB TTL index...')

// Switch to inventory database
db = db.getSiblingDB('inventory')

// Create TTL index on expiresAt field
// Documents will be automatically deleted when expiresAt is reached
try {
  const result = db.api_keys.createIndex(
    { "expires_at": 1 },
    { 
      expireAfterSeconds: 0,
      name: "ttl_expires_at"
    }
  )
  
  console.log('✅ TTL index created successfully:', result)
} catch (error) {
  // Index might already exist, check if it's the TTL index
  const indexes = db.api_keys.getIndexes()
  const ttlIndex = indexes.find(idx => idx.name === 'ttl_expires_at')
  
  if (ttlIndex) {
    console.log('✅ TTL index already exists')
  } else {
    console.error('❌ Failed to create TTL index:', error)
    throw error
  }
}

// Verify the index
console.log('\n📋 All indexes on api_keys collection:')
db.api_keys.getIndexes().forEach(idx => {
  console.log(`  - ${idx.name}:`, JSON.stringify(idx.key))
  if (idx.expireAfterSeconds !== undefined) {
    console.log(`    TTL: ${idx.expireAfterSeconds} seconds`)
  }
})

console.log('\n🎉 Setup completed successfully!')
