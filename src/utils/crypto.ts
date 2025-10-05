import { hash, verify } from 'argon2'
import { createHash, randomBytes } from 'crypto'
import { logger, performance } from './logger'

/**
 * Generate a random API key (64 characters)
 */
export function generateApiKey(): string {
  logger.service.debug('Generating new API key', {
    caller: 'crypto.generateApiKey'
  })
  
  // 48 bytes = 64 characters in base64url
  const apiKey = randomBytes(48).toString('base64url')
  
  logger.service.debug('API key generated', {
    keyLength: apiKey.length,
    caller: 'crypto.generateApiKey'
  })
  
  return apiKey
}

/**
 * Hash an API key using Argon2id
 */
export async function hashApiKey(apiKey: string): Promise<string> {
  const timer = performance.start('crypto.hashApiKey')
  
  logger.service.debug('Hashing API key with Argon2id', {
    apiKey,
    caller: 'crypto.hashApiKey'
  })
  
  const hashedKey = await hash(apiKey, {
    type: 2, // Argon2id
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 4
  })
  
  timer.end({ success: true })
  
  logger.service.debug('API key hashed successfully', {
    apiKey,
    hashedKey,
    caller: 'crypto.hashApiKey'
  })
  
  return hashedKey
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
  const timer = performance.start('crypto.verifyApiKey')
  
  logger.service.debug('Verifying API key', {
    hashedKey,
    apiKey,
    caller: 'crypto.verifyApiKey'
  })
  
  try {
    const isValid = await verify(hashedKey, apiKey)
    
    timer.end({ success: true, isValid })
    
    logger.service.debug('API key verification completed', {
      hashedKey,
      apiKey,
      isValid,
      caller: 'crypto.verifyApiKey'
    })
    
    return isValid
  } catch (error) {
    timer.error(error as Error)
    
    logger.service.error('API key verification error', {
      hashedKey,
      apiKey,
      error: (error as Error).message,
      caller: 'crypto.verifyApiKey'
    })
    
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
