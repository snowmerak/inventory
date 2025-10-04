import { hash, verify } from 'argon2'
import { createHash, randomBytes } from 'crypto'

/**
 * Generate a random API key (64 characters)
 */
export function generateApiKey(): string {
  // 48 bytes = 64 characters in base64url
  return randomBytes(48).toString('base64url')
}

/**
 * Hash an API key using Argon2id
 */
export async function hashApiKey(apiKey: string): Promise<string> {
  return hash(apiKey, {
    type: 2, // Argon2id
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 4
  })
}

/**
 * Generate searchable hash from API key
 * Uses SHA-1 and takes first 8 bytes (16 hex characters)
 * This provides fast database lookup while maintaining security
 * 
 * @param apiKey - The original API key
 * @returns First 16 hex characters of SHA-1 hash
 */
export function generateSearchableHash(apiKey: string): string {
  const sha1Hash = createHash('sha1').update(apiKey).digest('hex')
  // Take first 8 bytes (16 hex characters)
  return sha1Hash.substring(0, 16)
}

/**
 * Verify an API key against its hash
 */
export async function verifyApiKey(hashedKey: string, apiKey: string): Promise<boolean> {
  try {
    return await verify(hashedKey, apiKey)
  } catch (error) {
    console.error('API key verification error:', error)
    return false
  }
}

/**
 * Validate item key format (URI-like)
 * Format: <scheme>://<service>/<key>?<query>
 */
export function validateItemKey(itemKey: string): boolean {
  try {
    const url = new URL(itemKey)
    return url.protocol.length > 0 && url.hostname.length > 0
  } catch {
    return false
  }
}
