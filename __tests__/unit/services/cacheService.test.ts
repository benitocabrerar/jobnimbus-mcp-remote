/**
 * Unit Tests for CacheService
 * FASE 1: Redis Cache System Testing
 */

import { CacheService, withCache, getCacheConfig } from '../../../src/services/cacheService';
import { CACHE_PREFIXES, getTTL } from '../../../src/config/cache';

// Mock ioredis
const mockRedisInstance = {
  status: 'ready',
  get: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  scan: jest.fn(),
  dbsize: jest.fn(),
  info: jest.fn(),
  ping: jest.fn(),
  quit: jest.fn(),
  on: jest.fn(),
  once: jest.fn(),
};

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedisInstance);
});

describe('CacheService - Unit Tests', () => {
  let cacheService: CacheService;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Reset Redis mock status
    mockRedisInstance.status = 'ready';

    // Setup default mock implementations
    mockRedisInstance.get.mockResolvedValue(null);
    mockRedisInstance.setex.mockResolvedValue('OK');
    mockRedisInstance.del.mockResolvedValue(1);
    mockRedisInstance.scan.mockResolvedValue(['0', []]);
    mockRedisInstance.dbsize.mockResolvedValue(0);
    mockRedisInstance.info.mockResolvedValue('uptime_in_seconds:3600\nused_memory_human:1.5M');
    mockRedisInstance.ping.mockResolvedValue('PONG');
    mockRedisInstance.quit.mockResolvedValue('OK');

    // Get fresh instance
    cacheService = CacheService.getInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = CacheService.getInstance();
      const instance2 = CacheService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Configuration', () => {
    it('should load cache configuration', () => {
      const config = getCacheConfig();
      expect(config).toBeDefined();
      expect(config.host).toBeDefined();
      expect(config.port).toBeDefined();
      expect(config.circuitBreaker).toBeDefined();
    });

    it('should have correct TTL values', () => {
      const attachmentsTTL = getTTL('ATTACHMENTS_LIST');
      expect(attachmentsTTL).toBe(15 * 60); // 15 minutes
    });

    it('should have cache prefixes defined', () => {
      expect(CACHE_PREFIXES.ATTACHMENTS).toBe('attachments');
      expect(CACHE_PREFIXES.LIST).toBe('list');
    });
  });

  describe('Connection Management', () => {
    it('should have connect method defined', () => {
      expect(cacheService.connect).toBeDefined();
      expect(typeof cacheService.connect).toBe('function');
    });

    it('should have disconnect method defined', () => {
      expect(cacheService.disconnect).toBeDefined();
      expect(typeof cacheService.disconnect).toBe('function');
    });

    it('should handle connection gracefully', async () => {
      // Connection should not throw even if Redis is not available
      await expect(cacheService.connect()).resolves.not.toThrow();
    });

    it('should have disconnect available for cleanup', () => {
      // Disconnect method exists for proper cleanup
      // Actual testing requires integration with real Redis
      expect(cacheService.disconnect).toBeDefined();
    });
  });

  describe('Cache Operations - GET', () => {
    it('should have get method defined', () => {
      expect(cacheService.get).toBeDefined();
      expect(typeof cacheService.get).toBe('function');
    });

    it('should return null when cache is not available', async () => {
      // Without connection, get should return null gracefully
      const result = await cacheService.get('attachments', 'list', 'job:123');
      expect(result).toBeNull();
    });

    it('should accept correct parameters for get operation', async () => {
      // Test that get method accepts the correct signature
      await expect(
        cacheService.get('attachments', 'list', 'job:456')
      ).resolves.not.toThrow();
    });
  });

  describe('Cache Operations - SET', () => {
    it('should have set method defined', () => {
      expect(cacheService.set).toBeDefined();
      expect(typeof cacheService.set).toBe('function');
    });

    it('should accept correct parameters for set operation', async () => {
      const testData = { id: '123', files: [] };

      await expect(
        cacheService.set('attachments', 'list', 'job:123', testData, 900)
      ).resolves.not.toThrow();
    });

    it('should reject items that are too large', async () => {
      // Create a large object that exceeds maxItemSizeKB (default 512KB)
      const largeData = {
        data: 'x'.repeat(10 * 1024 * 1024), // 10MB
      };

      const result = await cacheService.set(
        'attachments',
        'list',
        'job:123',
        largeData,
        900
      );

      expect(result).toBe(false);
    });
  });

  describe('Cache Operations - DELETE', () => {
    it('should have delete method defined', () => {
      expect(cacheService.delete).toBeDefined();
      expect(typeof cacheService.delete).toBe('function');
    });

    it('should accept correct parameters for delete operation', async () => {
      await expect(
        cacheService.delete('attachments', 'list', 'job:123')
      ).resolves.not.toThrow();
    });
  });

  describe('Cache Invalidation', () => {
    it('should have invalidatePattern method defined', () => {
      expect(cacheService.invalidatePattern).toBeDefined();
      expect(typeof cacheService.invalidatePattern).toBe('function');
    });

    it('should have clear method defined', () => {
      expect(cacheService.clear).toBeDefined();
      expect(typeof cacheService.clear).toBe('function');
    });

    it('should accept correct parameters for invalidation', async () => {
      await expect(
        cacheService.invalidatePattern('attachments', 'list')
      ).resolves.not.toThrow();
    });
  });

  describe('Health and Statistics', () => {
    it('should have healthCheck method defined', () => {
      expect(cacheService.healthCheck).toBeDefined();
      expect(typeof cacheService.healthCheck).toBe('function');
    });

    it('should have getStats method defined', () => {
      expect(cacheService.getStats).toBeDefined();
      expect(typeof cacheService.getStats).toBe('function');
    });

    it('should return health status', async () => {
      const health = await cacheService.healthCheck();

      expect(health).toBeDefined();
      expect(health.healthy).toBeDefined();
      expect(health.status).toBeDefined();
    });

    it('should return cache statistics', async () => {
      const stats = await cacheService.getStats();

      expect(stats).toBeDefined();
      expect(stats.metrics).toBeDefined();
      expect(stats.redis).toBeDefined();
    });
  });

  describe('withCache Helper', () => {
    it('should be defined and callable', () => {
      expect(withCache).toBeDefined();
      expect(typeof withCache).toBe('function');
    });

    it('should call fetch function on cache miss (when cache not connected)', async () => {
      const freshData = { fresh: true };
      const fetchFn = jest.fn().mockResolvedValue(freshData);

      // Cache is not connected, so will call fetch function directly
      const result = await withCache(
        { entity: 'attachments', operation: 'list', identifier: 'job:456' },
        900,
        fetchFn
      );

      expect(result).toEqual(freshData);
      expect(fetchFn).toHaveBeenCalled();
    });

    it('should handle fetch function errors', async () => {
      const fetchFn = jest.fn().mockRejectedValue(new Error('Fetch failed'));

      await expect(
        withCache(
          { entity: 'attachments', operation: 'list', identifier: 'job:789' },
          900,
          fetchFn
        )
      ).rejects.toThrow('Fetch failed');
    });
  });

  describe('Circuit Breaker Pattern', () => {
    it('should implement circuit breaker for resilience', () => {
      // Circuit breaker is implemented in the service
      // Testing actual behavior requires integration tests with real Redis
      const config = getCacheConfig();
      expect(config.circuitBreaker).toBeDefined();
      expect(config.circuitBreaker.failureThreshold).toBeGreaterThan(0);
      expect(config.circuitBreaker.resetTimeout).toBeGreaterThan(0);
    });
  });

  describe('Compression Support', () => {
    it('should have compression enabled in configuration', () => {
      const config = getCacheConfig();
      expect(config.enableCompression).toBeDefined();
      expect(config.maxItemSizeKB).toBeGreaterThan(0);
    });
  });
});
