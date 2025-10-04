/**
 * Request and Response types for API endpoints
 */

// Publisher (API Key Publishing)
export interface PublishApiKeyRequest {
  itemKey: string
  permission: string[]
  expiresAt: string // ISO 8601 datetime
  maxUses: number
}

export interface PublishApiKeyResponse {
  success: true
  data: {
    apiKey: string // Original API key (shown only once!)
    itemKey: string
    permission: string[]
    publishedAt: string
    expiresAt: string
    maxUses: number
  }
}

// Validator (API Key Validation)
export interface ValidateApiKeyRequest {
  apiKey: string
}

export interface ValidateApiKeyResponse {
  success: true
  data: {
    valid: true
    itemKey: string
    permission: string[]
    expiresAt: string
    usedCount: number
    maxUses: number
  }
}

// Error Response
export interface ErrorResponse {
  success: false
  error: {
    code: string
    message: string
  }
}

// Health Check Response
export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy'
  services: {
    mongodb: 'connected' | 'disconnected'
    redis: 'connected' | 'disconnected'
  }
  timestamp: string
}
