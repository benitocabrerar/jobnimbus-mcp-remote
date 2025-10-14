/**
 * Redis Cache Service
 *
 * Enterprise-grade caching service with:
 * - Circuit breaker pattern for resilience
 * - Automatic fallback to API on Redis failures
 * - Compression for large values (25MB Render.com constraint)
 * - Intelligent serialization/deserialization
 * - Comprehensive error handling and logging
 * - Metrics collection for monitoring
 *
 * Performance Targets:
 * - Cache hit: < 50ms
 * - Cache miss: fallback to API seamlessly
 * - 80%+ reduction in API calls
 *
 * @author Backend Architecture Team
 * @version 1.0.0
 */

import Redis from 'ioredis';
import { promisify } from 'util';
import { gzip, gunzip } from 'zlib';
import {
  getCacheConfig,
  validateCacheConfig,
  buildCacheKey,
  buildInvalidationPattern,
  isCacheEnabled,
  getTTL,
  CacheConfig,
  CACHE_TTL,
  parseCacheKey,
} from '../config/cache.js';

// Workaround for ioredis ESM type issues in TypeScript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RedisClient = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RedisOptions = any;

// Promisify compression utilities
const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

/**
 * Circuit Breaker States
 */
enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Failing, reject requests
  HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

/**
 * Cache Operation Result
 */
interface CacheResult<T> {
  success: boolean;
  data?: T;
  source: 'cache' | 'api' | 'error';
  latencyMs?: number;
  error?: Error;
  cached?: boolean;
}

/**
 * Cache Metrics for monitoring
 */
interface CacheMetrics {
  hits: number;
  misses: number;
  errors: number;
  sets: number;
  deletes: number;
  totalRequests: number;
  avgLatencyMs: number;
  hitRate: number;
  circuitState: CircuitState;
}

/**
 * Cache Service Options
 */
interface CacheServiceOptions {
  prefix?: string;
  enableCompression?: boolean;
  enableMetrics?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Redis Cache Service with Circuit Breaker
 *
 * Usage Example:
 * ```typescript
 * const cacheService = CacheService.getInstance();
 * await cacheService.connect();
 *
 * // Get with automatic fallback
 * const result = await cacheService.get('attachments', 'list', 'job:123');
 *
 * // Set with TTL
 * await cacheService.set('attachments', 'list', 'job:123', data, 900);
 *
 * // Invalidate pattern
 * await cacheService.invalidatePattern('attachments', 'list');
 * ```
 */
export class CacheService {
  private static instance: CacheService;
  private client: RedisClient | null = null;
  private config: CacheConfig;
  private circuitState: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private successCount: number = 0;
  private options: CacheServiceOptions;

  // Metrics tracking
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    errors: 0,
    sets: 0,
    deletes: 0,
    totalRequests: 0,
    avgLatencyMs: 0,
    hitRate: 0,
    circuitState: CircuitState.CLOSED,
  };

  private latencies: number[] = [];
  private readonly MAX_LATENCY_SAMPLES = 100;

  /**
   * Private constructor for singleton pattern
   */
  private constructor(options: CacheServiceOptions = {}) {
    this.config = getCacheConfig();
    this.options = {
      enableCompression: options.enableCompression ?? this.config.enableCompression,
      enableMetrics: options.enableMetrics ?? this.config.enableMetrics,
      logLevel: options.logLevel ?? this.config.logLevel,
    };

    // Validate configuration on initialization
    validateCacheConfig(this.config);
  }

  /**
   * Get singleton instance
   */
  public static getInstance(options?: CacheServiceOptions): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService(options);
    }
    return CacheService.instance;
  }

  /**
   * Connect to Redis with automatic retry
   * Safe to call multiple times (idempotent)
   */
  public async connect(): Promise<void> {
    if (!isCacheEnabled()) {
      this.log('info', 'Cache is disabled via CACHE_ENABLED=false');
      return;
    }

    if (this.client && this.client.status === 'ready') {
      this.log('debug', 'Redis already connected');
      return;
    }

    try {
      const redisOptions: RedisOptions = {
        host: this.config.host,
        port: this.config.port,
        password: this.config.password,
        db: this.config.db,
        maxRetriesPerRequest: this.config.maxRetriesPerRequest,
        enableReadyCheck: this.config.enableReadyCheck,
        connectTimeout: this.config.connectTimeout,
        retryStrategy: (times: number) => {
          if (times > 10) {
            this.log('error', 'Max Redis connection retries reached');
            return null; // Stop retrying
          }
          const delay = Math.min(times * 1000, 5000);
          this.log('warn', `Redis connection retry ${times} in ${delay}ms`);
          return delay;
        },
        ...(this.config.tls && { tls: this.config.tls }),
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.client = new (Redis as any)(redisOptions);

      // Event handlers
      this.client.on('connect', () => {
        this.log('info', `Redis connected: ${this.config.host}:${this.config.port}`);
        this.resetCircuitBreaker();
      });

      this.client.on('ready', () => {
        this.log('info', 'Redis client ready');
      });

      this.client.on('error', (err: Error) => {
        this.log('error', `Redis error: ${err.message}`);
        this.recordFailure();
      });

      this.client.on('close', () => {
        this.log('warn', 'Redis connection closed');
      });

      this.client.on('reconnecting', () => {
        this.log('info', 'Redis reconnecting...');
      });

      // Wait for connection to be ready
      await this.waitForReady();

      this.log('info', 'Redis cache service initialized successfully');
    } catch (error) {
      this.log('error', `Failed to connect to Redis: ${error}`);
      this.recordFailure();
      // Don't throw - allow application to continue without cache
    }
  }

  /**
   * Wait for Redis client to be ready
   */
  private async waitForReady(timeoutMs: number = 10000): Promise<void> {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Redis connection timeout'));
      }, timeoutMs);

      if (this.client!.status === 'ready') {
        clearTimeout(timeout);
        resolve();
        return;
      }

      this.client!.once('ready', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.client!.once('error', (err: Error) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  /**
   * Disconnect from Redis
   */
  public async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.log('info', 'Redis disconnected');
    }
  }

  /**
   * Get value from cache with circuit breaker protection
   *
   * @param entity - Entity type (attachments, jobs, etc.)
   * @param operation - Operation type (list, detail, etc.)
   * @param identifier - Unique identifier
   * @returns Cached value or null if not found/error
   */
  public async get<T = any>(
    entity: string,
    operation: string,
    identifier: string
  ): Promise<T | null> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    if (!this.isAvailable()) {
      this.log('debug', 'Cache unavailable (circuit open or not connected)');
      this.metrics.misses++;
      return null;
    }

    try {
      const key = buildCacheKey(entity, operation, identifier);
      this.log('debug', `Cache GET: ${key}`);

      const value = await this.client!.get(key);

      if (value === null) {
        this.metrics.misses++;
        this.recordLatency(Date.now() - startTime);
        return null;
      }

      // Deserialize and decompress
      const data = await this.deserialize<T>(value);
      this.metrics.hits++;
      this.recordSuccess();
      this.recordLatency(Date.now() - startTime);

      this.log('debug', `Cache HIT: ${key} (${Date.now() - startTime}ms)`);
      return data;
    } catch (error) {
      this.log('error', `Cache GET error: ${error}`);
      this.metrics.errors++;
      this.recordFailure();
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   *
   * @param entity - Entity type
   * @param operation - Operation type
   * @param identifier - Unique identifier
   * @param value - Value to cache
   * @param ttlSeconds - Time to live in seconds (optional, uses default)
   * @returns Success boolean
   */
  public async set<T = any>(
    entity: string,
    operation: string,
    identifier: string,
    value: T,
    ttlSeconds?: number
  ): Promise<boolean> {
    const startTime = Date.now();

    if (!this.isAvailable()) {
      this.log('debug', 'Cache unavailable, skipping SET');
      return false;
    }

    try {
      const key = buildCacheKey(entity, operation, identifier);
      const ttl = ttlSeconds || getTTL('DEFAULT');

      // Serialize and compress
      const serialized = await this.serialize(value);

      // Check size limit (Render.com 25MB constraint)
      const sizeKB = Buffer.byteLength(serialized, 'utf8') / 1024;
      if (sizeKB > this.config.maxItemSizeKB) {
        this.log('warn', `Cache item too large: ${sizeKB.toFixed(2)}KB > ${this.config.maxItemSizeKB}KB`);
        return false;
      }

      await this.client!.setex(key, ttl, serialized);

      this.metrics.sets++;
      this.recordSuccess();
      this.log('debug', `Cache SET: ${key} (TTL: ${ttl}s, Size: ${sizeKB.toFixed(2)}KB, Latency: ${Date.now() - startTime}ms)`);

      return true;
    } catch (error) {
      this.log('error', `Cache SET error: ${error}`);
      this.metrics.errors++;
      this.recordFailure();
      return false;
    }
  }

  /**
   * Delete specific cache key
   *
   * @param entity - Entity type
   * @param operation - Operation type
   * @param identifier - Unique identifier
   * @returns Number of keys deleted
   */
  public async delete(
    entity: string,
    operation: string,
    identifier: string
  ): Promise<number> {
    if (!this.isAvailable()) {
      return 0;
    }

    try {
      const key = buildCacheKey(entity, operation, identifier);
      const deleted = await this.client!.del(key);

      this.metrics.deletes++;
      this.recordSuccess();
      this.log('debug', `Cache DELETE: ${key} (deleted: ${deleted})`);

      return deleted;
    } catch (error) {
      this.log('error', `Cache DELETE error: ${error}`);
      this.metrics.errors++;
      this.recordFailure();
      return 0;
    }
  }

  /**
   * Invalidate cache by pattern
   * Uses SCAN for memory-efficient iteration (important for 25MB limit)
   *
   * @param entity - Entity type (or '*' for all)
   * @param operation - Operation type (or '*' for all)
   * @returns Number of keys deleted
   */
  public async invalidatePattern(
    entity: string,
    operation: string = '*'
  ): Promise<number> {
    if (!this.isAvailable()) {
      return 0;
    }

    try {
      const pattern = buildInvalidationPattern(entity, operation);
      this.log('info', `Invalidating cache pattern: ${pattern}`);

      let cursor = '0';
      let totalDeleted = 0;
      const batchSize = 100; // Delete in batches to avoid blocking

      do {
        // SCAN is memory-efficient (doesn't load all keys at once)
        const [nextCursor, keys] = await this.client!.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          batchSize
        );

        cursor = nextCursor;

        if (keys.length > 0) {
          const deleted = await this.client!.del(...keys);
          totalDeleted += deleted;
          this.log('debug', `Deleted ${deleted} keys in batch`);
        }
      } while (cursor !== '0');

      this.log('info', `Invalidated ${totalDeleted} keys matching pattern: ${pattern}`);
      return totalDeleted;
    } catch (error) {
      this.log('error', `Cache invalidation error: ${error}`);
      this.recordFailure();
      return 0;
    }
  }

  /**
   * Clear all cache entries for this application
   * WARNING: Use with caution in production
   *
   * @returns Number of keys deleted
   */
  public async clear(): Promise<number> {
    if (!this.isAvailable()) {
      return 0;
    }

    try {
      this.log('warn', 'CLEARING ALL CACHE ENTRIES');
      return await this.invalidatePattern('*', '*');
    } catch (error) {
      this.log('error', `Cache clear error: ${error}`);
      return 0;
    }
  }

  /**
   * Get cache statistics and health
   */
  public async getStats(): Promise<{
    metrics: CacheMetrics;
    redis: {
      connected: boolean;
      status: string;
      uptime: number | null;
      memoryUsed: string | null;
      totalKeys: number;
    };
  }> {
    // Update calculated metrics
    this.metrics.hitRate = this.metrics.totalRequests > 0
      ? (this.metrics.hits / this.metrics.totalRequests) * 100
      : 0;
    this.metrics.circuitState = this.circuitState;

    const redisStats = {
      connected: this.client?.status === 'ready',
      status: this.client?.status || 'disconnected',
      uptime: null as number | null,
      memoryUsed: null as string | null,
      totalKeys: 0,
    };

    if (this.isAvailable()) {
      try {
        // Get Redis INFO
        const info = await this.client!.info('server');
        const uptimeMatch = info.match(/uptime_in_seconds:(\d+)/);
        if (uptimeMatch) {
          redisStats.uptime = parseInt(uptimeMatch[1], 10);
        }

        const memoryInfo = await this.client!.info('memory');
        const memoryMatch = memoryInfo.match(/used_memory_human:([^\r\n]+)/);
        if (memoryMatch) {
          redisStats.memoryUsed = memoryMatch[1];
        }

        // Count total keys (use DBSIZE for efficiency)
        redisStats.totalKeys = await this.client!.dbsize();
      } catch (error) {
        this.log('warn', `Failed to get Redis stats: ${error}`);
      }
    }

    return {
      metrics: { ...this.metrics },
      redis: redisStats,
    };
  }

  /**
   * Health check for monitoring
   */
  public async healthCheck(): Promise<{
    healthy: boolean;
    status: string;
    latencyMs?: number;
  }> {
    if (!this.client) {
      return { healthy: false, status: 'not_connected' };
    }

    if (this.circuitState === CircuitState.OPEN) {
      return { healthy: false, status: 'circuit_open' };
    }

    try {
      const start = Date.now();
      await this.client.ping();
      const latency = Date.now() - start;

      return {
        healthy: true,
        status: 'ok',
        latencyMs: latency,
      };
    } catch (error) {
      return { healthy: false, status: 'ping_failed' };
    }
  }

  /**
   * Serialize value for storage
   * Handles compression for large objects
   */
  private async serialize<T>(value: T): Promise<string> {
    const json = JSON.stringify(value);

    // Compress if enabled and value is large enough (>1KB)
    if (this.options.enableCompression && json.length > 1024) {
      try {
        const compressed = await gzipAsync(Buffer.from(json, 'utf8'));
        const base64 = compressed.toString('base64');
        // Prefix to indicate compression
        return `gzip:${base64}`;
      } catch (error) {
        this.log('warn', `Compression failed, storing uncompressed: ${error}`);
        return json;
      }
    }

    return json;
  }

  /**
   * Deserialize value from storage
   * Handles decompression automatically
   */
  private async deserialize<T>(value: string): Promise<T> {
    // Check if value is compressed
    if (value.startsWith('gzip:')) {
      try {
        const base64 = value.slice(5); // Remove 'gzip:' prefix
        const compressed = Buffer.from(base64, 'base64');
        const decompressed = await gunzipAsync(compressed);
        const json = decompressed.toString('utf8');
        return JSON.parse(json);
      } catch (error) {
        this.log('error', `Decompression failed: ${error}`);
        throw error;
      }
    }

    // Parse uncompressed JSON
    return JSON.parse(value);
  }

  /**
   * Check if cache is available (circuit breaker logic)
   */
  private isAvailable(): boolean {
    if (!this.client || this.client.status !== 'ready') {
      return false;
    }

    const now = Date.now();

    // Circuit breaker state machine
    switch (this.circuitState) {
      case CircuitState.CLOSED:
        return true;

      case CircuitState.OPEN:
        // Check if enough time has passed to try again
        const timeSinceFailure = now - this.lastFailureTime;
        if (timeSinceFailure >= this.config.circuitBreaker.resetTimeout) {
          this.log('info', 'Circuit breaker transitioning to HALF_OPEN');
          this.circuitState = CircuitState.HALF_OPEN;
          this.successCount = 0;
          return true;
        }
        return false;

      case CircuitState.HALF_OPEN:
        return true;

      default:
        return false;
    }
  }

  /**
   * Record successful operation
   */
  private recordSuccess(): void {
    this.successCount++;

    if (this.circuitState === CircuitState.HALF_OPEN) {
      // After 3 consecutive successes, close circuit
      if (this.successCount >= 3) {
        this.log('info', 'Circuit breaker closing after successful recovery');
        this.resetCircuitBreaker();
      }
    }
  }

  /**
   * Record failed operation
   */
  private recordFailure(): void {
    const now = Date.now();

    // Reset failure count if outside monitoring window
    if (now - this.lastFailureTime > this.config.circuitBreaker.monitoringWindow) {
      this.failureCount = 0;
    }

    this.failureCount++;
    this.lastFailureTime = now;

    // Open circuit if threshold exceeded
    if (this.failureCount >= this.config.circuitBreaker.failureThreshold) {
      if (this.circuitState !== CircuitState.OPEN) {
        this.log('error', `Circuit breaker OPENING after ${this.failureCount} failures`);
        this.circuitState = CircuitState.OPEN;
      }
    }

    // If in HALF_OPEN and failure occurs, reopen circuit
    if (this.circuitState === CircuitState.HALF_OPEN) {
      this.log('warn', 'Circuit breaker REOPENING after failure in HALF_OPEN state');
      this.circuitState = CircuitState.OPEN;
    }
  }

  /**
   * Reset circuit breaker to closed state
   */
  private resetCircuitBreaker(): void {
    this.circuitState = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
  }

  /**
   * Record operation latency
   */
  private recordLatency(latencyMs: number): void {
    this.latencies.push(latencyMs);

    // Keep only last N samples
    if (this.latencies.length > this.MAX_LATENCY_SAMPLES) {
      this.latencies.shift();
    }

    // Calculate average
    this.metrics.avgLatencyMs =
      this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length;
  }

  /**
   * Internal logging with level filtering
   */
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    const currentLevel = levels[this.options.logLevel || 'info'];
    const messageLevel = levels[level];

    if (messageLevel >= currentLevel) {
      const timestamp = new Date().toISOString();
      console[level](`[${timestamp}] [CacheService] [${level.toUpperCase()}] ${message}`);
    }
  }
}

/**
 * Export singleton instance
 */
export const cacheService = CacheService.getInstance();

/**
 * Re-export cache configuration helper
 */
export { getCacheConfig } from '../config/cache.js';

/**
 * Helper function to wrap API calls with caching
 *
 * @param cacheKey - Cache key components
 * @param ttl - TTL in seconds
 * @param fetchFn - Function to fetch data from API
 * @returns Cached data or fresh data from API
 *
 * @example
 * const attachments = await withCache(
 *   { entity: 'attachments', operation: 'list', identifier: 'job:123' },
 *   getTTL('ATTACHMENTS_LIST'),
 *   () => fetchAttachmentsFromAPI(jobId)
 * );
 */
export async function withCache<T>(
  cacheKey: { entity: string; operation: string; identifier: string },
  ttl: number,
  fetchFn: () => Promise<T>
): Promise<T> {
  const cache = CacheService.getInstance();

  // Try to get from cache
  const cached = await cache.get<T>(
    cacheKey.entity,
    cacheKey.operation,
    cacheKey.identifier
  );

  if (cached !== null) {
    return cached;
  }

  // Cache miss - fetch from API
  const data = await fetchFn();

  // Store in cache (fire and forget - don't block on cache write)
  cache.set(cacheKey.entity, cacheKey.operation, cacheKey.identifier, data, ttl)
    .catch(err => console.error(`Background cache write failed: ${err}`));

  return data;
}
