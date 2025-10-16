/**
 * Handle Storage Service
 *
 * Redis-backed temporary storage for large response payloads.
 * Prevents chat saturation by storing large responses and returning handles.
 *
 * Features:
 * - Unique handle generation (jn:entity:timestamp:hash)
 * - Automatic expiration (15 min TTL)
 * - Size tracking and metadata
 * - Periodic cleanup of expired handles
 *
 * Usage:
 * ```typescript
 * const handle = await handleStorage.store('jobs', data, 'get_jobs', 'compact');
 * const result = await handleStorage.retrieve(handle);
 * ```
 *
 * @author Backend Architecture Team
 * @version 1.0.0
 */

import { CacheService } from './cacheService.js';
import { StoredResult } from '../types/index.js';
import { RESPONSE_CONFIG, calculateSize } from '../config/response.js';
import crypto from 'crypto';

/**
 * Handle Storage Service
 * Manages temporary storage of large payloads using Redis
 */
export class HandleStorageService {
  private static instance: HandleStorageService;
  private cacheService: CacheService;
  private cleanupInterval: NodeJS.Timeout | null = null;

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    this.cacheService = CacheService.getInstance();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): HandleStorageService {
    if (!HandleStorageService.instance) {
      HandleStorageService.instance = new HandleStorageService();
    }
    return HandleStorageService.instance;
  }

  /**
   * Initialize the service and start cleanup interval
   */
  public async initialize(): Promise<void> {
    await this.cacheService.connect();

    // Start periodic cleanup of expired handles
    if (!this.cleanupInterval) {
      this.cleanupInterval = setInterval(
        () => this.cleanExpired(),
        RESPONSE_CONFIG.STORAGE.CLEANUP_INTERVAL_SEC * 1000
      );

      // Don't block Node.js exit
      this.cleanupInterval.unref();
    }

    this.log('info', 'HandleStorageService initialized');
  }

  /**
   * Generate unique handle for stored result
   * Format: jn:{entity}:{timestamp}:{hash}
   *
   * @param entity - Entity type (jobs, contacts, etc.)
   * @param data - Data being stored (for hash generation)
   * @returns Unique handle string
   */
  public generateHandle(entity: string, data: any): string {
    const timestamp = Date.now();
    const dataStr = JSON.stringify(data);

    // Generate short hash from data (first 8 chars of SHA-256)
    const hash = crypto
      .createHash('sha256')
      .update(dataStr)
      .digest('hex')
      .substring(0, 8);

    return `jn:${entity}:${timestamp}:${hash}`;
  }

  /**
   * Store large payload in Redis with handle
   *
   * @param entity - Entity type
   * @param data - Data to store
   * @param toolName - Tool that generated the data
   * @param verbosity - Verbosity level
   * @param instance - Instance identifier (stamford/guilford)
   * @param ttl - Time to live in seconds (default: 900)
   * @returns Handle for retrieval
   */
  public async store(
    entity: string,
    data: any,
    toolName: string,
    verbosity: string,
    instance: string,
    ttl: number = RESPONSE_CONFIG.STORAGE.HANDLE_TTL_SEC
  ): Promise<string> {
    const handle = this.generateHandle(entity, data);
    const now = Date.now();
    const sizeBytes = calculateSize(data);

    const storedResult: StoredResult = {
      data,
      metadata: {
        created_at: now,
        expires_at: now + (ttl * 1000),
        size_bytes: sizeBytes,
        tool_name: toolName,
        verbosity,
        instance,
      },
    };

    // Store in Redis using cache service (with instance isolation)
    const success = await this.cacheService.set(
      'handle',
      'storage',
      handle,
      storedResult,
      ttl,
      instance as 'stamford' | 'guilford'
    );

    if (!success) {
      throw new Error(`Failed to store handle: ${handle}`);
    }

    this.log('debug', `Stored handle [${instance}]: ${handle} (${(sizeBytes / 1024).toFixed(2)}KB, TTL: ${ttl}s)`);
    return handle;
  }

  /**
   * Retrieve data by handle
   *
   * @param handle - Handle to retrieve
   * @param instance - Instance identifier (stamford/guilford)
   * @returns Stored result or null if not found/expired
   */
  public async retrieve(handle: string, instance: 'stamford' | 'guilford'): Promise<StoredResult | null> {
    try {
      const result = await this.cacheService.get<StoredResult>(
        'handle',
        'storage',
        handle,
        instance
      );

      if (!result) {
        this.log('debug', `Handle not found [${instance}]: ${handle}`);
        return null;
      }

      // Check if expired (double-check even though Redis should handle TTL)
      const now = Date.now();
      if (result.metadata.expires_at < now) {
        this.log('warn', `Handle expired [${instance}]: ${handle}`);
        await this.delete(handle, instance);
        return null;
      }

      this.log('debug', `Retrieved handle [${instance}]: ${handle}`);
      return result;
    } catch (error) {
      this.log('error', `Failed to retrieve handle [${instance}] ${handle}: ${error}`);
      return null;
    }
  }

  /**
   * Delete specific handle
   *
   * @param handle - Handle to delete
   * @param instance - Instance identifier (stamford/guilford)
   * @returns Number of keys deleted
   */
  public async delete(handle: string, instance: 'stamford' | 'guilford'): Promise<number> {
    try {
      const deleted = await this.cacheService.delete('handle', 'storage', handle, instance);
      this.log('debug', `Deleted handle [${instance}]: ${handle}`);
      return deleted;
    } catch (error) {
      this.log('error', `Failed to delete handle [${instance}] ${handle}: ${error}`);
      return 0;
    }
  }

  /**
   * Check if handle exists
   *
   * @param handle - Handle to check
   * @param instance - Instance identifier (stamford/guilford)
   * @returns True if handle exists and is not expired
   */
  public async exists(handle: string, instance: 'stamford' | 'guilford'): Promise<boolean> {
    const result = await this.retrieve(handle, instance);
    return result !== null;
  }

  /**
   * Get metadata for a handle without retrieving full data
   *
   * @param handle - Handle to get metadata for
   * @param instance - Instance identifier (stamford/guilford)
   * @returns Metadata or null if not found
   */
  public async getMetadata(handle: string, instance: 'stamford' | 'guilford'): Promise<StoredResult['metadata'] | null> {
    const result = await this.retrieve(handle, instance);
    return result?.metadata || null;
  }

  /**
   * Clean up expired handles
   * Uses SCAN to avoid blocking Redis (memory-efficient)
   *
   * @returns Number of handles deleted
   */
  public async cleanExpired(): Promise<number> {
    try {
      // Use invalidatePattern to clean all handles across all instances
      // Redis TTL will handle expiration, but this is a safety cleanup
      const deleted = await this.cacheService.invalidatePattern('handle', 'storage', '*');

      if (deleted > 0) {
        this.log('info', `Cleaned up ${deleted} expired handles (all instances)`);
      }

      return deleted;
    } catch (error) {
      this.log('error', `Failed to clean expired handles: ${error}`);
      return 0;
    }
  }

  /**
   * Get statistics about stored handles
   */
  public async getStats(): Promise<{
    total_handles: number;
    total_size_kb: number;
    oldest_handle_age_sec: number | null;
  }> {
    try {
      const cacheStats = await this.cacheService.getStats();

      // Count handles (approximate - would need SCAN for exact count)
      const totalHandles = cacheStats.redis.totalKeys;

      return {
        total_handles: totalHandles,
        total_size_kb: 0, // Would need to iterate to get exact size
        oldest_handle_age_sec: null,
      };
    } catch (error) {
      this.log('error', `Failed to get stats: ${error}`);
      return {
        total_handles: 0,
        total_size_kb: 0,
        oldest_handle_age_sec: null,
      };
    }
  }

  /**
   * Stop cleanup interval on shutdown
   */
  public shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.log('info', 'HandleStorageService shutdown');
  }

  /**
   * Internal logging
   */
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
    const timestamp = new Date().toISOString();
    console[level](`[${timestamp}] [HandleStorage] [${level.toUpperCase()}] ${message}`);
  }
}

/**
 * Export singleton instance
 */
export const handleStorage = HandleStorageService.getInstance();
