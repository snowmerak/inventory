/**
 * Custom error types for API responses
 */

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export class ValidationError extends ApiError {
  constructor(message: string) {
    super(400, 'VALIDATION_ERROR', message)
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string) {
    super(404, 'NOT_FOUND', message)
  }
}

export class DuplicateError extends ApiError {
  constructor(message: string) {
    super(409, 'DUPLICATE_ERROR', message)
  }
}

export class RateLimitError extends ApiError {
  constructor(message: string = 'Too many requests') {
    super(429, 'RATE_LIMIT_EXCEEDED', message)
  }
}

export class LockAcquisitionError extends ApiError {
  constructor(message: string = 'Failed to acquire lock') {
    super(503, 'LOCK_ACQUISITION_FAILED', message)
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message: string = 'Unauthorized') {
    super(401, 'UNAUTHORIZED', message)
  }
}

export class ExpiredError extends ApiError {
  constructor(message: string = 'API key expired') {
    super(403, 'EXPIRED', message)
  }
}

export class UsageLimitError extends ApiError {
  constructor(message: string = 'Usage limit exceeded') {
    super(403, 'USAGE_LIMIT_EXCEEDED', message)
  }
}
