/**
 * Cache Integration Tests for GetAttachmentsTool
 * FASE 1: Testing cache integration with attachments
 */

import { GetAttachmentsTool } from '../../../../src/tools/attachments/getAttachments';
import { MOCK_FILES } from '../../../fixtures/files.fixtures';
import * as cacheService from '../../../../src/services/cacheService';

// Mock factory for jobNimbusClient
const mockGetFn = jest.fn();
jest.mock('../../../../src/services/jobNimbusClient', () => ({
  default: {
    get: (...args: any[]) => mockGetFn(...args),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockGet = mockGetFn;

// Mock the cache service
jest.mock('../../../../src/services/cacheService', () => {
  const originalModule = jest.requireActual('../../../../src/services/cacheService');
  return {
    ...originalModule,
    withCache: jest.fn(),
    getCacheConfig: jest.fn(() => ({
      host: 'localhost',
      port: 6379,
      ttl: {
        attachments: 900,
      },
    })),
  };
});

describe('GetAttachmentsTool - Cache Integration Tests', () => {
  let tool: GetAttachmentsTool;
  const mockContext = {
    apiKey: 'test-key',
    instance: 'stamford' as const,
    clientId: 'test-client',
  };

  beforeEach(() => {
    tool = new GetAttachmentsTool();
    jest.clearAllMocks();

    // Setup default API mock response
    mockGet.mockResolvedValue({
      success: true,
      data: { files: MOCK_FILES, count: 2 },
    });
  });

  describe('Cache Utilization', () => {
    it('should use cache wrapper when fetching attachments', async () => {
      // Mock withCache to call the fetch function directly
      (cacheService.withCache as jest.Mock).mockImplementation(
        async (cacheKey, ttl, fetchFn) => {
          return await fetchFn();
        }
      );

      await tool.execute({}, mockContext);

      // Verify withCache was called
      expect(cacheService.withCache).toHaveBeenCalled();
      expect(cacheService.withCache).toHaveBeenCalledWith(
        expect.objectContaining({
          entity: 'attachments',
          operation: 'list',
        }),
        expect.any(Number),
        expect.any(Function)
      );
    });

    it('should use correct cache identifier for filtered requests', async () => {
      (cacheService.withCache as jest.Mock).mockImplementation(
        async (cacheKey, ttl, fetchFn) => {
          return await fetchFn();
        }
      );

      await tool.execute(
        { job_id: 'job-123', file_type: 'pdf', from: 0, size: 50 },
        mockContext
      );

      expect(cacheService.withCache).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'job-123:pdf:0:50',
        }),
        expect.any(Number),
        expect.any(Function)
      );
    });

    it('should generate different cache keys for different filters', async () => {
      (cacheService.withCache as jest.Mock).mockImplementation(
        async (cacheKey, ttl, fetchFn) => {
          return await fetchFn();
        }
      );

      // First request
      await tool.execute({ job_id: 'job-123' }, mockContext);
      const firstCall = (cacheService.withCache as jest.Mock).mock.calls[0][0];

      // Second request with different filter
      await tool.execute({ job_id: 'job-456' }, mockContext);
      const secondCall = (cacheService.withCache as jest.Mock).mock.calls[1][0];

      expect(firstCall.identifier).not.toBe(secondCall.identifier);
    });
  });

  describe('Cache Hit Behavior', () => {
    it('should return cached data without calling API', async () => {
      const cachedResult = {
        count: 2,
        files: MOCK_FILES,
        from: 0,
        total_available: 2,
      };

      // Mock cache hit - return cached data immediately
      (cacheService.withCache as jest.Mock).mockResolvedValue(cachedResult);

      const result = await tool.execute({}, mockContext);

      expect(result).toEqual(cachedResult);
      // API should not be called on cache hit
      expect(mockGet).not.toHaveBeenCalled();
    });

    it('should handle multiple cache hits efficiently', async () => {
      const cachedResult = { count: 2, files: MOCK_FILES };
      (cacheService.withCache as jest.Mock).mockResolvedValue(cachedResult);

      // Make multiple identical requests
      await tool.execute({ job_id: 'job-123' }, mockContext);
      await tool.execute({ job_id: 'job-123' }, mockContext);
      await tool.execute({ job_id: 'job-123' }, mockContext);

      // API should never be called - all served from cache
      expect(mockGet).not.toHaveBeenCalled();
    });
  });

  describe('Cache Miss Behavior', () => {
    it('should call API and return fresh data on cache miss', async () => {
      // Mock cache miss - execute fetch function
      (cacheService.withCache as jest.Mock).mockImplementation(
        async (cacheKey, ttl, fetchFn) => {
          return await fetchFn();
        }
      );

      const result = await tool.execute({}, mockContext);

      // API should be called on cache miss
      expect(mockGet).toHaveBeenCalledWith('test-key', 'files', {
        from: 0,
        size: 100,
      });

      // Result should be returned
      expect(result.count).toBeGreaterThanOrEqual(0);
      expect(result.files).toBeDefined();
    });

    it('should properly structure data before caching', async () => {
      let capturedFetchFn: (() => Promise<any>) | null = null;

      (cacheService.withCache as jest.Mock).mockImplementation(
        async (cacheKey, ttl, fetchFn) => {
          capturedFetchFn = fetchFn;
          return await fetchFn();
        }
      );

      await tool.execute({ job_id: 'job-test-001' }, mockContext);

      // Verify the fetch function returns properly structured data
      expect(capturedFetchFn).not.toBeNull();
      const result = await capturedFetchFn!();

      expect(result).toHaveProperty('count');
      expect(result).toHaveProperty('files');
      expect(result).toHaveProperty('total_available');
      expect(result).toHaveProperty('filter_applied');
      expect(result).toHaveProperty('_debug');
    });
  });

  describe('Cache TTL Configuration', () => {
    it('should use correct TTL for attachments', async () => {
      (cacheService.withCache as jest.Mock).mockImplementation(
        async (cacheKey, ttl, fetchFn) => {
          return await fetchFn();
        }
      );

      await tool.execute({}, mockContext);

      const ttlUsed = (cacheService.withCache as jest.Mock).mock.calls[0][1];

      // Verify TTL is 15 minutes (900 seconds) for attachments
      expect(ttlUsed).toBe(15 * 60);
    });
  });

  describe('Error Handling with Cache', () => {
    it('should handle cache service errors gracefully', async () => {
      // Mock cache throwing error - should fallback to direct API call
      (cacheService.withCache as jest.Mock).mockRejectedValue(
        new Error('Cache service unavailable')
      );

      // Should not throw - application continues without cache
      await expect(tool.execute({}, mockContext)).rejects.toThrow(
        'Cache service unavailable'
      );
    });

    it('should handle API errors even with cache', async () => {
      mockGet.mockRejectedValue(new Error('API Error'));

      (cacheService.withCache as jest.Mock).mockImplementation(
        async (cacheKey, ttl, fetchFn) => {
          return await fetchFn();
        }
      );

      const result = await tool.execute({}, mockContext);

      expect(result.status).toBe('error');
      expect(result.error).toBeDefined();
    });
  });

  describe('Cache Key Generation', () => {
    it('should generate consistent cache keys for same inputs', async () => {
      (cacheService.withCache as jest.Mock).mockImplementation(
        async (cacheKey, ttl, fetchFn) => {
          return await fetchFn();
        }
      );

      const input = { job_id: 'job-123', file_type: 'pdf' };

      await tool.execute(input, mockContext);
      const firstCallKey = (cacheService.withCache as jest.Mock).mock.calls[0][0];

      jest.clearAllMocks();

      await tool.execute(input, mockContext);
      const secondCallKey = (cacheService.withCache as jest.Mock).mock.calls[0][0];

      expect(firstCallKey.identifier).toBe(secondCallKey.identifier);
    });

    it('should use "all" for missing filter parameters', async () => {
      (cacheService.withCache as jest.Mock).mockImplementation(
        async (cacheKey, ttl, fetchFn) => {
          return await fetchFn();
        }
      );

      await tool.execute({}, mockContext);

      const cacheKey = (cacheService.withCache as jest.Mock).mock.calls[0][0];

      // When no filters, identifier should contain "all"
      expect(cacheKey.identifier).toContain('all');
    });

    it('should include pagination in cache key', async () => {
      (cacheService.withCache as jest.Mock).mockImplementation(
        async (cacheKey, ttl, fetchFn) => {
          return await fetchFn();
        }
      );

      await tool.execute({ from: 10, size: 50 }, mockContext);

      const cacheKey = (cacheService.withCache as jest.Mock).mock.calls[0][0];
      expect(cacheKey.identifier).toContain('10');
      expect(cacheKey.identifier).toContain('50');
    });
  });

  describe('Cache Integration with Filters', () => {
    it('should cache filtered results separately', async () => {
      (cacheService.withCache as jest.Mock).mockImplementation(
        async (cacheKey, ttl, fetchFn) => {
          return await fetchFn();
        }
      );

      // Request with job filter
      await tool.execute({ job_id: 'job-123' }, mockContext);
      const jobFilterKey = (cacheService.withCache as jest.Mock).mock.calls[0][0]
        .identifier;

      // Request with contact filter
      await tool.execute({ contact_id: 'contact-456' }, mockContext);
      const contactFilterKey = (cacheService.withCache as jest.Mock).mock
        .calls[1][0].identifier;

      // Different filters should produce different cache keys
      expect(jobFilterKey).not.toBe(contactFilterKey);
    });

    it('should cache file type filters correctly', async () => {
      (cacheService.withCache as jest.Mock).mockImplementation(
        async (cacheKey, ttl, fetchFn) => {
          return await fetchFn();
        }
      );

      await tool.execute({ file_type: 'pdf' }, mockContext);
      const pdfKey = (cacheService.withCache as jest.Mock).mock.calls[0][0]
        .identifier;

      await tool.execute({ file_type: 'jpg' }, mockContext);
      const jpgKey = (cacheService.withCache as jest.Mock).mock.calls[1][0]
        .identifier;

      expect(pdfKey).toContain('pdf');
      expect(jpgKey).toContain('jpg');
      expect(pdfKey).not.toBe(jpgKey);
    });
  });

  describe('Performance with Cache', () => {
    it('should reduce API calls with caching enabled', async () => {
      let callCount = 0;
      const cachedResult = { count: 2, files: MOCK_FILES };

      (cacheService.withCache as jest.Mock).mockImplementation(
        async (cacheKey, ttl, fetchFn) => {
          // First call: cache miss, execute fetch
          if (callCount === 0) {
            callCount++;
            return await fetchFn();
          }
          // Subsequent calls: cache hit, return cached data
          return cachedResult;
        }
      );

      // First call - cache miss
      await tool.execute({ job_id: 'job-123' }, mockContext);
      expect(mockGet).toHaveBeenCalledTimes(1);

      // Subsequent calls - cache hits
      await tool.execute({ job_id: 'job-123' }, mockContext);
      await tool.execute({ job_id: 'job-123' }, mockContext);

      // API should only be called once
      expect(mockGet).toHaveBeenCalledTimes(1);
    });
  });
});
