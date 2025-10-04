/**
 * Metrics collector for monitoring
 * Tracks API usage, performance, and errors
 */

interface Metrics {
  // API Key operations
  keysPublished: number
  keysValidated: number
  keysValidationFailed: number
  
  // Performance
  avgValidationTime: number
  avgPublishTime: number
  
  // Cache performance
  cacheHits: number
  cacheMisses: number
  
  // Errors
  rateLimitErrors: number
  lockAcquisitionErrors: number
  validationErrors: number
  
  // System
  uptime: number
  startTime: number
}

class MetricsCollector {
  private metrics: Metrics
  private validationTimes: number[] = []
  private publishTimes: number[] = []

  constructor() {
    this.metrics = {
      keysPublished: 0,
      keysValidated: 0,
      keysValidationFailed: 0,
      avgValidationTime: 0,
      avgPublishTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      rateLimitErrors: 0,
      lockAcquisitionErrors: 0,
      validationErrors: 0,
      uptime: 0,
      startTime: Date.now()
    }
  }

  // Key operations
  incrementKeysPublished(): void {
    this.metrics.keysPublished++
  }

  incrementKeysValidated(): void {
    this.metrics.keysValidated++
  }

  incrementKeysValidationFailed(): void {
    this.metrics.keysValidationFailed++
  }

  // Performance tracking
  recordValidationTime(ms: number): void {
    this.validationTimes.push(ms)
    if (this.validationTimes.length > 100) {
      this.validationTimes.shift()
    }
    this.metrics.avgValidationTime = this.calculateAverage(this.validationTimes)
  }

  recordPublishTime(ms: number): void {
    this.publishTimes.push(ms)
    if (this.publishTimes.length > 100) {
      this.publishTimes.shift()
    }
    this.metrics.avgPublishTime = this.calculateAverage(this.publishTimes)
  }

  // Cache metrics
  incrementCacheHit(): void {
    this.metrics.cacheHits++
  }

  incrementCacheMiss(): void {
    this.metrics.cacheMisses++
  }

  getCacheHitRate(): number {
    const total = this.metrics.cacheHits + this.metrics.cacheMisses
    return total === 0 ? 0 : (this.metrics.cacheHits / total) * 100
  }

  // Error tracking
  incrementRateLimitErrors(): void {
    this.metrics.rateLimitErrors++
  }

  incrementLockAcquisitionErrors(): void {
    this.metrics.lockAcquisitionErrors++
  }

  incrementValidationErrors(): void {
    this.metrics.validationErrors++
  }

  // Get metrics
  getMetrics(): Metrics & { cacheHitRate: number } {
    return {
      ...this.metrics,
      uptime: Date.now() - this.metrics.startTime,
      cacheHitRate: this.getCacheHitRate()
    }
  }

  // Reset metrics (for testing or periodic reset)
  reset(): void {
    const startTime = this.metrics.startTime
    this.metrics = {
      keysPublished: 0,
      keysValidated: 0,
      keysValidationFailed: 0,
      avgValidationTime: 0,
      avgPublishTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      rateLimitErrors: 0,
      lockAcquisitionErrors: 0,
      validationErrors: 0,
      uptime: 0,
      startTime
    }
    this.validationTimes = []
    this.publishTimes = []
  }

  private calculateAverage(arr: number[]): number {
    if (arr.length === 0) return 0
    return arr.reduce((a, b) => a + b, 0) / arr.length
  }
}

// Singleton instance
export const metrics = new MetricsCollector()
