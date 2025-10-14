/**
 * Redis Cache Configuration
 *
 * Centralized cache configuration for JobNimbus MCP system.
 * Designed for Render.com free tier (25MB) with intelligent TTL management.
 *
 * Architecture Decisions:
 * - Hierarchical key structure for easy invalidation
 * - Short TTLs for high-frequency data (attachments)
 * - Circuit breaker to prevent Redis failures from cascading
 * - Memory-efficient serialization for 25MB constraint
 *
 * @author Backend Architecture Team
 * @version 1.0.0
 */

import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

/**
 * Cache Key Prefixes
 * Hierarchical structure enables targeted cache invalidation
 * Pattern: {app}:{entity}:{operation}:{identifier}
 */
export const CACHE_PREFIXES = {
  // Application namespace
  APP: 'jobnimbus',

  // Entity-level prefixes
  ATTACHMENTS: 'attachments',
  JOBS: 'jobs',
  CONTACTS: 'contacts',
  ACTIVITIES: 'activities',
  ESTIMATES: 'estimates',
  INVOICES: 'invoices', // NEW - VERIFIED WORKING endpoint
  TASKS: 'tasks', // NEW - 2025-01-14 - Task Management
  PRODUCTS: 'products', // NEW - 2025-01-14 - Products Management
  MATERIAL_ORDERS: 'materialorders', // NEW - 2025-01-14 - Material Orders Management

  // Operation-level prefixes
  LIST: 'list',
  DETAIL: 'detail',
  SEARCH: 'search',
  ANALYTICS: 'analytics',
  GET: 'get', // NEW - 2025-01-14 - Individual entity retrieval
} as const;

/**
 * TTL Configuration (in seconds)
 *
 * Strategy:
 * - Hot data (frequently accessed): 5-15 minutes
 * - Warm data (moderately accessed): 30-60 minutes
 * - Cold data (rarely changes): 2-4 hours
 * - Analytics/aggregations: 1 hour
 */
export const CACHE_TTL = {
  // Attachment-related TTLs
  ATTACHMENTS_LIST: 15 * 60,        // 15 minutes - frequently updated
  ATTACHMENTS_DETAIL: 30 * 60,      // 30 minutes - stable once created
  ATTACHMENTS_BY_JOB: 20 * 60,      // 20 minutes - job files change often
  ATTACHMENTS_BY_CONTACT: 30 * 60,  // 30 minutes - contact files more stable

  // Entity List TTLs (Phase 2)
  JOBS_LIST: 10 * 60,               // 10 minutes - jobs update frequently
  JOBS_SEARCH: 5 * 60,              // 5 minutes - search results vary
  ESTIMATES_LIST: 15 * 60,          // 15 minutes - estimates change moderately
  ESTIMATES_SEARCH: 5 * 60,         // 5 minutes - search results vary
  CONTACTS_LIST: 20 * 60,           // 20 minutes - contacts more stable
  CONTACTS_SEARCH: 5 * 60,          // 5 minutes - search results vary
  ACTIVITIES_LIST: 10 * 60,         // 10 minutes - activities change often
  INVOICES_LIST: 15 * 60,           // 15 minutes - invoices moderately stable (NEW - VERIFIED)
  TASKS_LIST: 10 * 60,              // 10 minutes - tasks update frequently (NEW - 2025-01-14)
  TASKS_DETAIL: 15 * 60,            // 15 minutes - task details moderately stable (NEW - 2025-01-14)
  PRODUCTS_LIST: 20 * 60,           // 20 minutes - product catalog changes moderately (NEW - 2025-01-14)
  MATERIAL_ORDERS_LIST: 20 * 60,    // 20 minutes - material orders moderately stable (NEW - 2025-01-14)

  // Entity Detail TTLs
  JOB_DETAIL: 10 * 60,              // 10 minutes - jobs update frequently
  CONTACT_DETAIL: 30 * 60,          // 30 minutes - contacts more stable
  ESTIMATE_DETAIL: 20 * 60,         // 20 minutes - estimates moderately stable
  ACTIVITY_DETAIL: 15 * 60,         // 15 minutes - activities change
  PRODUCT_DETAIL: 30 * 60,          // 30 minutes - products relatively stable (NEW - 2025-01-14)
  MATERIAL_ORDER_DETAIL: 30 * 60,   // 30 minutes - material orders relatively stable (NEW - 2025-01-14)

  // Aggregation/Analytics TTLs
  ANALYTICS: 60 * 60,               // 1 hour - expensive computations
  SEARCH_RESULTS: 5 * 60,           // 5 minutes - search params vary

  // Default fallback
  DEFAULT: 15 * 60,                 // 15 minutes
} as const;

/**
 * Cache Configuration Interface
 */
export interface CacheConfig {
  // Redis connection
  host: string;
  port: number;
  password?: string;
  db: number;

  // Connection pool settings
  maxRetriesPerRequest: number;
  enableReadyCheck: boolean;
  connectTimeout: number;

  // TLS for production (Render.com requires TLS)
  tls?: {
    rejectUnauthorized: boolean;
  };

  // Circuit breaker settings
  circuitBreaker: {
    failureThreshold: number;      // Number of failures before opening circuit
    resetTimeout: number;          // Time before attempting to close circuit (ms)
    monitoringWindow: number;      // Time window for tracking failures (ms)
  };

  // Performance tuning
  enableCompression: boolean;      // GZIP compression for large values
  maxMemoryPolicy: string;         // Redis eviction policy
  maxItemSizeKB: number;          // Max size per cache item

  // Monitoring
  enableMetrics: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Get cache configuration from environment variables
 *
 * Environment Variables:
 * - REDIS_HOST: Redis server hostname
 * - REDIS_PORT: Redis server port (default: 6379)
 * - REDIS_PASSWORD: Redis authentication password
 * - REDIS_DB: Redis database number (default: 0)
 * - REDIS_TLS: Enable TLS (default: true in production)
 * - CACHE_ENABLED: Master switch for caching (default: true)
 * - CACHE_COMPRESSION: Enable GZIP compression (default: true)
 * - CACHE_MAX_ITEM_SIZE_KB: Max cache item size (default: 512KB)
 */
export const getCacheConfig = (): CacheConfig => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';

  return {
    // Connection settings
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0', 10),

    // Connection pool
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    connectTimeout: 10000, // 10 seconds

    // TLS configuration (only if explicitly enabled via REDIS_TLS_ENABLED)
    ...(process.env.REDIS_TLS_ENABLED === 'true' && {
      tls: {
        rejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== 'false',
      },
    }),

    // Circuit breaker configuration
    circuitBreaker: {
      failureThreshold: parseInt(process.env.CACHE_FAILURE_THRESHOLD || '5', 10),
      resetTimeout: parseInt(process.env.CACHE_RESET_TIMEOUT || '60000', 10), // 1 minute
      monitoringWindow: parseInt(process.env.CACHE_MONITORING_WINDOW || '120000', 10), // 2 minutes
    },

    // Performance settings
    enableCompression: process.env.CACHE_COMPRESSION !== 'false',
    maxMemoryPolicy: process.env.REDIS_MAX_MEMORY_POLICY || 'allkeys-lru', // Least Recently Used eviction
    maxItemSizeKB: parseInt(process.env.CACHE_MAX_ITEM_SIZE_KB || '512', 10),

    // Monitoring
    enableMetrics: process.env.CACHE_ENABLE_METRICS === 'true',
    logLevel: (process.env.CACHE_LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
  };
};

/**
 * Validate cache configuration
 * Throws detailed errors for misconfiguration
 */
export const validateCacheConfig = (config: CacheConfig): void => {
  const errors: string[] = [];

  if (!config.host || config.host.trim() === '') {
    errors.push('REDIS_HOST is required');
  }

  if (config.port < 1 || config.port > 65535) {
    errors.push('REDIS_PORT must be between 1 and 65535');
  }

  if (config.db < 0 || config.db > 15) {
    errors.push('REDIS_DB must be between 0 and 15');
  }

  if (config.circuitBreaker.failureThreshold < 1) {
    errors.push('Circuit breaker failure threshold must be positive');
  }

  if (config.circuitBreaker.resetTimeout < 1000) {
    errors.push('Circuit breaker reset timeout must be at least 1000ms');
  }

  if (config.maxItemSizeKB < 1 || config.maxItemSizeKB > 5120) {
    errors.push('Max item size must be between 1KB and 5MB');
  }

  if (errors.length > 0) {
    throw new Error(`Cache configuration validation failed:\n${errors.join('\n')}`);
  }
};

/**
 * Build cache key with hierarchical structure
 *
 * @param entity - Entity type (attachments, jobs, contacts, etc.)
 * @param operation - Operation type (list, detail, search)
 * @param identifier - Unique identifier (ID, search params hash, etc.)
 * @returns Hierarchical cache key
 *
 * @example
 * buildCacheKey('attachments', 'list', 'job:123')
 * // Returns: "jobnimbus:attachments:list:job:123"
 *
 * buildCacheKey('attachments', 'detail', 'file:abc-def')
 * // Returns: "jobnimbus:attachments:detail:file:abc-def"
 */
export const buildCacheKey = (
  entity: keyof typeof CACHE_PREFIXES | string,
  operation: string,
  identifier: string
): string => {
  const prefix = typeof entity === 'string'
    ? entity
    : CACHE_PREFIXES[entity] || entity;

  return `${CACHE_PREFIXES.APP}:${prefix}:${operation}:${identifier}`;
};

/**
 * Parse cache key into components
 * Useful for debugging and cache invalidation strategies
 *
 * @param key - Full cache key
 * @returns Parsed components or null if invalid format
 */
export const parseCacheKey = (key: string): {
  app: string;
  entity: string;
  operation: string;
  identifier: string;
} | null => {
  const parts = key.split(':');

  if (parts.length < 4) {
    return null;
  }

  return {
    app: parts[0],
    entity: parts[1],
    operation: parts[2],
    identifier: parts.slice(3).join(':'), // Rest of the key
  };
};

/**
 * Build pattern for cache invalidation
 * Uses Redis SCAN patterns for efficient bulk operations
 *
 * @param entity - Entity to invalidate (or '*' for all)
 * @param operation - Operation to invalidate (or '*' for all)
 * @returns Redis pattern string
 *
 * @example
 * buildInvalidationPattern('attachments', 'list')
 * // Returns: "jobnimbus:attachments:list:*"
 *
 * buildInvalidationPattern('attachments', '*')
 * // Returns: "jobnimbus:attachments:*:*"
 */
export const buildInvalidationPattern = (
  entity: string,
  operation: string = '*'
): string => {
  return `${CACHE_PREFIXES.APP}:${entity}:${operation}:*`;
};

/**
 * Check if caching is enabled globally
 * Master switch for disabling cache in development/testing
 */
export const isCacheEnabled = (): boolean => {
  return process.env.CACHE_ENABLED !== 'false';
};

/**
 * Get TTL for specific cache operation
 * Falls back to DEFAULT if specific TTL not found
 *
 * @param operation - Cache operation key
 * @returns TTL in seconds
 */
export const getTTL = (operation: keyof typeof CACHE_TTL): number => {
  return CACHE_TTL[operation] || CACHE_TTL.DEFAULT;
};

/**
 * Export singleton config instance
 */
export const cacheConfig = getCacheConfig();

/**
 * Type exports for external use
 */
export type CachePrefix = typeof CACHE_PREFIXES[keyof typeof CACHE_PREFIXES];
export type CacheTTL = typeof CACHE_TTL[keyof typeof CACHE_TTL];
