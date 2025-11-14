# Technical Recommendations - Optimization Architecture

**Version:** 2.0.0
**Date:** 2025-01-13

This document provides specific technical recommendations, best practices, and gotchas to avoid when implementing the optimization architecture.

---

## 1. Query Language Design Decisions

### 1.1 Field Selection Syntax

**Recommendation: Use comma-separated dot notation**

```typescript
// RECOMMENDED
?fields=jnid,number,status,contact.name,contact.email

// NOT RECOMMENDED (too complex)
?fields[0]=jnid&fields[1]=number&fields[2]=status

// NOT RECOMMENDED (GraphQL-like, adds complexity)
?fields={jnid,number,status,contact{name,email}}
```

**Why:**
- Simple to parse
- Easy to understand
- URL-friendly
- Compatible with CSV export

---

### 1.2 Filter Expression Format

**Recommendation: Use JSON for complex filters, query params for simple**

```typescript
// Simple filter (query param)
?status=Jobs In Progress

// Complex filter (JSON body)
POST /jobs/search
{
  "filter": {
    "and": [
      {"eq": {"status": "Jobs In Progress"}},
      {"gte": {"total": 5000}}
    ]
  }
}
```

**Why:**
- Simple filters are common, should be easy
- Complex filters need structure, JSON is clear
- Avoids URL encoding issues with complex expressions

---

### 1.3 Pagination Strategy

**Recommendation: Cursor-based pagination for production, offset for backward compatibility**

```typescript
// NEW (cursor-based)
?pageSize=20&cursor=eyJpZCI6IjEyMyIsInRpbWVzdGFtcCI6MTY...

// LEGACY (offset-based, deprecated)
?from=40&size=20

// Implementation
interface PaginationCursor {
  lastId: string;
  lastTimestamp: number;
  direction: 'forward' | 'backward';
}

function encodeCursor(cursor: PaginationCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64');
}

function decodeCursor(encoded: string): PaginationCursor {
  return JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
}
```

**Why:**
- Cursor-based is more efficient for large datasets
- Avoids "page drift" when data changes
- Better performance with indexes

---

## 2. Caching Strategy Best Practices

### 2.1 Cache Key Design

**Recommendation: Hierarchical keys with instance isolation**

```typescript
// GOOD
jobnimbus:stamford:jobs:list:status=active:fields=jnid,number

// BAD (no instance isolation)
jobnimbus:jobs:list:status=active

// BAD (too granular, cache fragmentation)
jobnimbus:stamford:jobs:list:status=active:fields=jnid:fields=number
```

**Key Structure:**
```
{app}:{instance}:{entity}:{operation}:{params_hash}
```

**Implementation:**
```typescript
function buildCacheKey(
  entity: string,
  operation: string,
  params: any,
  instance: string
): string {
  // Normalize params for consistent hashing
  const normalized = normalizeParams(params);

  // Hash params to avoid long keys
  const hash = hashParams(normalized);

  return `jobnimbus:${instance}:${entity}:${operation}:${hash}`;
}

function normalizeParams(params: any): any {
  // Sort keys for consistent hashing
  const sorted: any = {};
  Object.keys(params)
    .sort()
    .forEach(key => {
      sorted[key] = params[key];
    });
  return sorted;
}

function hashParams(params: any): string {
  const crypto = require('crypto');
  const str = JSON.stringify(params);
  return crypto.createHash('md5').update(str).digest('hex').substring(0, 8);
}
```

---

### 2.2 TTL Strategy

**Recommendation: Dynamic TTL based on data volatility and access patterns**

```typescript
class SmartTTLManager {
  calculateTTL(
    resource: string,
    metadata: {
      updateFrequency: number;  // updates per hour
      accessFrequency: number;  // accesses per hour
      size: number;             // bytes
    }
  ): number {
    // Base TTL from config
    const baseTTL = this.getBaseTTL(resource);

    // Adjust for volatility
    let ttl = baseTTL;

    if (metadata.updateFrequency > 10) {
      ttl *= 0.5;  // High volatility: reduce TTL
    } else if (metadata.updateFrequency < 1) {
      ttl *= 1.5;  // Low volatility: increase TTL
    }

    // Adjust for access frequency
    if (metadata.accessFrequency > 20) {
      ttl *= 1.2;  // Hot data: longer TTL
    } else if (metadata.accessFrequency < 2) {
      ttl *= 0.8;  // Cold data: shorter TTL
    }

    // Adjust for size (smaller = longer TTL)
    if (metadata.size < 5 * 1024) {
      ttl *= 1.1;  // Small data: slightly longer
    }

    // Time of day adjustment
    const hour = new Date().getHours();
    if (hour >= 9 && hour <= 17) {
      ttl *= 1.2;  // Business hours: longer TTL
    }

    // Clamp to reasonable bounds
    return Math.max(60, Math.min(3600, ttl));
  }
}
```

---

### 2.3 Cache Invalidation Strategy

**Recommendation: Targeted invalidation with patterns, avoid blanket clears**

```typescript
class CacheInvalidator {
  /**
   * Invalidate specific resource
   */
  async invalidateResource(
    resource: string,
    id: string,
    instance: string
  ): Promise<void> {
    const patterns = [
      `jobnimbus:${instance}:${resource}:detail:${id}`,
      `jobnimbus:${instance}:${resource}:list:*`,
    ];

    for (const pattern of patterns) {
      await this.invalidatePattern(pattern);
    }
  }

  /**
   * Invalidate related resources
   * Example: Updating job should invalidate contact cache
   */
  async invalidateRelated(
    resource: string,
    id: string,
    instance: string
  ): Promise<void> {
    const relations = this.getRelations(resource);

    for (const related of relations) {
      await this.invalidatePattern(
        `jobnimbus:${instance}:${related}:*:*${id}*`
      );
    }
  }

  /**
   * Smart invalidation based on mutation type
   */
  async invalidateOnMutation(
    mutation: Mutation
  ): Promise<void> {
    switch (mutation.type) {
      case 'create':
        // Only invalidate list caches
        await this.invalidatePattern(
          `jobnimbus:${mutation.instance}:${mutation.resource}:list:*`
        );
        break;

      case 'update':
        // Invalidate detail and related caches
        await this.invalidateResource(
          mutation.resource,
          mutation.id,
          mutation.instance
        );
        await this.invalidateRelated(
          mutation.resource,
          mutation.id,
          mutation.instance
        );
        break;

      case 'delete':
        // Clear everything for this resource
        await this.invalidatePattern(
          `jobnimbus:${mutation.instance}:${mutation.resource}:*`
        );
        break;
    }
  }
}
```

---

## 3. Field Selection Performance

### 3.1 Optimize for Common Cases

**Recommendation: Pre-define verbosity levels for 80% use cases**

```typescript
const VERBOSITY_PRESETS = {
  summary: [
    'jnid',
    'number',
    'status',
    'total',
    'date_created',
  ],

  compact: [
    'jnid',
    'number',
    'status',
    'status_name',
    'total',
    'date_created',
    'date_updated',
    'sales_rep_name',
    'contact.name',
    'city',
    'state',
  ],

  detailed: [
    'jnid',
    'number',
    'status',
    'status_name',
    'total',
    'date_created',
    'date_updated',
    'date_start',
    'date_end',
    'sales_rep',
    'sales_rep_name',
    'contact',
    'related',
    'tags',
    'address_line1',
    'city',
    'state',
    'zip',
    'custom',
  ],

  raw: ['*'],  // Everything
};

// Fast path for presets
function selectFields(data: any, verbosity: string): any {
  if (verbosity in VERBOSITY_PRESETS) {
    return selectFieldsFast(data, VERBOSITY_PRESETS[verbosity]);
  }

  // Custom field selection (slower)
  return selectFieldsCustom(data, verbosity);
}
```

---

### 3.2 Avoid Deep Cloning

**Recommendation: Use object spreading for shallow copies**

```typescript
// GOOD (shallow copy)
function selectFields(obj: any, fields: string[]): any {
  const result: any = {};

  for (const field of fields) {
    if (obj[field] !== undefined) {
      result[field] = obj[field];  // Reference copy (fast)
    }
  }

  return result;
}

// BAD (deep clone, unnecessary)
function selectFields(obj: any, fields: string[]): any {
  const result: any = {};

  for (const field of fields) {
    if (obj[field] !== undefined) {
      result[field] = JSON.parse(JSON.stringify(obj[field]));  // Deep clone (slow)
    }
  }

  return result;
}
```

**Why:**
- Shallow copies are 100x faster
- Deep cloning unnecessary for read-only operations
- Reference sharing is safe for immutable data

---

## 4. Compression Best Practices

### 4.1 Compression Threshold

**Recommendation: Only compress responses > 1 KB**

```typescript
const COMPRESSION_THRESHOLD = 1024;  // 1 KB

function shouldCompress(size: number): boolean {
  // Don't compress if too small (overhead > savings)
  if (size < COMPRESSION_THRESHOLD) {
    return false;
  }

  // Don't compress if already compressed
  // (check Content-Encoding header)

  return true;
}
```

**Why:**
- Compression overhead for small payloads > savings
- GZIP header is ~18 bytes + dictionary
- Break-even point is ~1 KB

---

### 4.2 Algorithm Selection

**Recommendation: GZIP for speed, Brotli for maximum compression**

```typescript
function selectCompressionAlgorithm(
  size: number,
  acceptEncoding: string
): 'gzip' | 'brotli' | 'none' {
  // No compression if client doesn't support it
  if (!acceptEncoding) {
    return 'none';
  }

  // Brotli for large payloads (better compression)
  if (size > 50 * 1024 && acceptEncoding.includes('br')) {
    return 'brotli';
  }

  // GZIP for medium payloads (faster)
  if (acceptEncoding.includes('gzip')) {
    return 'gzip';
  }

  return 'none';
}
```

**Benchmarks:**
- GZIP: 60% compression, 3ms for 20KB
- Brotli: 70% compression, 12ms for 20KB
- Break-even: 50KB (Brotli worth the extra time)

---

## 5. Handle Storage for Large Responses

### 5.1 When to Use Handles

**Recommendation: Use handles for responses > 25 KB**

```typescript
const HANDLE_THRESHOLD = 25 * 1024;  // 25 KB

async function sendResponse(data: any, res: Response): Promise<void> {
  const size = Buffer.byteLength(JSON.stringify(data), 'utf8');

  if (size > HANDLE_THRESHOLD) {
    // Store in handle storage
    const handle = await handleStore.store(data, 900);  // 15 min TTL

    res.json({
      _type: 'handle',
      handle,
      size,
      ttl: 900,
      message: 'Response too large, use fetch_by_handle to retrieve',
    });
  } else {
    // Send directly
    res.json(data);
  }
}
```

---

### 5.2 Handle Format

**Recommendation: Use self-describing, versioned handles**

```typescript
interface Handle {
  version: 1;
  type: string;        // 'jobs', 'attachments', etc.
  id: string;          // Storage ID
  timestamp: number;   // Creation time
  ttl: number;         // TTL in seconds
  size: number;        // Original size
  compressed: boolean; // Is compressed?
  checksum: string;    // SHA256 checksum
}

function createHandle(
  type: string,
  storageId: string,
  data: any,
  ttl: number
): string {
  const handle: Handle = {
    version: 1,
    type,
    id: storageId,
    timestamp: Date.now(),
    ttl,
    size: Buffer.byteLength(JSON.stringify(data)),
    compressed: true,
    checksum: calculateChecksum(data),
  };

  // Encode as URL-safe base64
  return Buffer.from(JSON.stringify(handle))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}
```

**Why:**
- Self-describing: can validate before fetching
- Versioned: can evolve format
- Includes metadata: size, TTL, checksum
- URL-safe: can pass in query params

---

## 6. Metrics Collection

### 6.1 What to Track

**Recommendation: Track size, latency, cache status, and errors**

```typescript
interface RequestMetrics {
  // Request metadata
  endpoint: string;
  method: string;
  timestamp: number;
  requestId: string;

  // Query metadata
  verbosity: string;
  fields?: string;
  filter?: boolean;

  // Performance metrics
  latencyMs: number;
  apiLatencyMs?: number;     // Time spent in API call
  cacheLatencyMs?: number;   // Time spent in cache
  transformMs?: number;      // Time spent in transformation

  // Size metrics
  requestSize: number;
  responseSize: number;
  originalSize?: number;     // Before optimization
  compressionRatio?: number;

  // Cache metrics
  cached: boolean;
  cacheKey?: string;
  cacheTier?: 1 | 2 | 3;
  cacheAge?: number;

  // Error tracking
  error?: string;
  errorCode?: string;
}

class MetricsCollector {
  track(metrics: RequestMetrics): void {
    // Store in time-series DB (or memory)
    this.store(metrics);

    // Update aggregates
    this.updateAggregates(metrics);

    // Check for anomalies
    this.checkAnomalies(metrics);
  }

  private checkAnomalies(metrics: RequestMetrics): void {
    // Alert on large responses
    if (metrics.responseSize > 100 * 1024) {
      this.alert({
        type: 'large_response',
        endpoint: metrics.endpoint,
        size: metrics.responseSize,
      });
    }

    // Alert on slow requests
    if (metrics.latencyMs > 1000) {
      this.alert({
        type: 'slow_request',
        endpoint: metrics.endpoint,
        latency: metrics.latencyMs,
      });
    }

    // Alert on low cache hit rate
    const hitRate = this.getRecentHitRate(metrics.endpoint);
    if (hitRate < 0.5) {
      this.alert({
        type: 'low_cache_hit_rate',
        endpoint: metrics.endpoint,
        hitRate,
      });
    }
  }
}
```

---

### 6.2 Sampling Strategy

**Recommendation: Sample at 100% initially, then reduce based on volume**

```typescript
class SamplingStrategy {
  shouldSample(endpoint: string): boolean {
    const rate = this.getSampleRate(endpoint);
    return Math.random() < rate;
  }

  private getSampleRate(endpoint: string): number {
    const volume = this.getEndpointVolume(endpoint);

    // High-traffic endpoints: 10% sample
    if (volume > 1000) {
      return 0.1;
    }

    // Medium-traffic: 50% sample
    if (volume > 100) {
      return 0.5;
    }

    // Low-traffic: 100% sample
    return 1.0;
  }
}
```

---

## 7. Error Handling

### 7.1 Graceful Degradation

**Recommendation: Always fall back to working state**

```typescript
async function getJobs(params: any) {
  try {
    // Try optimized path
    return await getJobsOptimized(params);
  } catch (error) {
    // Log error
    logger.error('Optimization failed, falling back to legacy', error);

    // Fall back to legacy path
    return await getJobsLegacy(params);
  }
}

async function getJobsOptimized(params: any) {
  // Parse query
  const query = QueryParser.parse(params);

  // Check cache
  const cached = await cache.get(key);
  if (cached) return cached;

  // Fetch and optimize
  const data = await api.getJobs();
  const optimized = await transformer.transform(data, query);

  // Cache result
  await cache.set(key, optimized);

  return optimized;
}

async function getJobsLegacy(params: any) {
  // Simple, reliable path
  return await api.getJobs({
    from: params.from || 0,
    size: params.size || 20,
  });
}
```

---

### 7.2 Cache Failure Handling

**Recommendation: Implement circuit breaker pattern**

```typescript
class CacheCircuitBreaker {
  private state: 'closed' | 'open' | 'half_open' = 'closed';
  private failures = 0;
  private lastFailureTime = 0;

  private readonly FAILURE_THRESHOLD = 5;
  private readonly RESET_TIMEOUT = 60000;  // 1 minute

  async execute<T>(fn: () => Promise<T>): Promise<T | null> {
    // Circuit open: skip cache
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.RESET_TIMEOUT) {
        this.state = 'half_open';
      } else {
        return null;
      }
    }

    try {
      const result = await fn();

      // Success: reset
      if (this.state === 'half_open') {
        this.state = 'closed';
        this.failures = 0;
      }

      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();

      // Open circuit if threshold exceeded
      if (this.failures >= this.FAILURE_THRESHOLD) {
        this.state = 'open';
      }

      return null;
    }
  }
}
```

---

## 8. Testing Strategy

### 8.1 Unit Tests

**Recommendation: Test each component in isolation**

```typescript
describe('FieldSelector', () => {
  const selector = new FieldSelector();

  describe('select()', () => {
    it('should select specified fields', () => {
      const data = {
        jnid: '123',
        number: '1820',
        status: 'Active',
        description: 'Long text...',
      };

      const result = selector.select(data, 'jnid,number,status');

      expect(result).toEqual({
        jnid: '123',
        number: '1820',
        status: 'Active',
      });
      expect(result.description).toBeUndefined();
    });

    it('should handle nested fields', () => {
      const data = {
        jnid: '123',
        contact: {
          name: 'John',
          email: 'john@example.com',
          phone: '555-1234',
        },
      };

      const result = selector.select(data, 'jnid,contact.name,contact.email');

      expect(result).toEqual({
        jnid: '123',
        contact: {
          name: 'John',
          email: 'john@example.com',
        },
      });
    });

    it('should handle wildcards', () => {
      const data = {
        jnid: '123',
        contact: {
          name: 'John',
          email: 'john@example.com',
        },
      };

      const result = selector.select(data, 'jnid,contact.*');

      expect(result.contact).toEqual({
        name: 'John',
        email: 'john@example.com',
      });
    });
  });
});
```

---

### 8.2 Integration Tests

**Recommendation: Test end-to-end flows**

```typescript
describe('GET /jobs (optimized)', () => {
  it('should return optimized response with field selection', async () => {
    const response = await request(app)
      .get('/jobs')
      .query({ fields: 'jnid,number,status' })
      .expect(200);

    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toBeInstanceOf(Array);

    // Check field selection
    const firstJob = response.body.data[0];
    expect(firstJob).toHaveProperty('jnid');
    expect(firstJob).toHaveProperty('number');
    expect(firstJob).toHaveProperty('status');
    expect(firstJob).not.toHaveProperty('description');
  });

  it('should cache response', async () => {
    // First request (cache miss)
    const start1 = Date.now();
    await request(app).get('/jobs').expect(200);
    const latency1 = Date.now() - start1;

    // Second request (cache hit)
    const start2 = Date.now();
    const response = await request(app).get('/jobs').expect(200);
    const latency2 = Date.now() - start2;

    // Cache hit should be much faster
    expect(latency2).toBeLessThan(latency1 * 0.2);

    // Check cache headers
    expect(response.headers).toHaveProperty('x-cache-hit', 'true');
  });
});
```

---

### 8.3 Performance Tests

**Recommendation: Benchmark critical paths**

```typescript
describe('Performance benchmarks', () => {
  it('field selection should be fast', () => {
    const selector = new FieldSelector();
    const data = generateLargeDataset(1000);  // 1000 items

    const start = Date.now();
    selector.select(data, 'jnid,number,status');
    const elapsed = Date.now() - start;

    // Should complete in < 50ms
    expect(elapsed).toBeLessThan(50);
  });

  it('filter evaluation should be fast', () => {
    const evaluator = new FilterEvaluator();
    const data = generateLargeDataset(1000);

    const filter = {
      and: [
        { eq: { status: 'Active' } },
        { gte: { total: 5000 } },
      ],
    };

    const start = Date.now();
    evaluator.filter(data, filter);
    const elapsed = Date.now() - start;

    // Should complete in < 100ms
    expect(elapsed).toBeLessThan(100);
  });
});
```

---

## 9. Deployment Recommendations

### 9.1 Canary Deployment

**Recommendation: Roll out to 5% of traffic first**

```typescript
// Load balancer config (nginx example)
upstream backend {
  server backend-v1:3000 weight=95;
  server backend-v2:3000 weight=5;
}

// Or application-level canary
function routeRequest(req: Request): 'v1' | 'v2' {
  const canaryPercent = 5;
  const random = Math.random() * 100;

  // Route 5% to new version
  if (random < canaryPercent) {
    return 'v2';
  }

  return 'v1';
}
```

---

### 9.2 Feature Flags

**Recommendation: Use feature flags for gradual rollout**

```typescript
class FeatureFlags {
  isEnabled(feature: string, context?: any): boolean {
    switch (feature) {
      case 'optimization_v2':
        // Enable for internal testing
        if (context?.isInternal) {
          return true;
        }

        // Enable for 10% of users
        const userId = context?.userId || '';
        const hash = this.hashUserId(userId);
        return hash % 100 < 10;

      default:
        return false;
    }
  }
}

// Usage
async function getJobs(req: Request, params: any) {
  const featureFlags = new FeatureFlags();

  if (featureFlags.isEnabled('optimization_v2', { userId: req.userId })) {
    return await getJobsOptimized(params);
  }

  return await getJobsLegacy(params);
}
```

---

## 10. Monitoring & Alerting

### 10.1 Key Metrics to Monitor

**Recommendation: Set up alerts for critical metrics**

```typescript
const ALERT_THRESHOLDS = {
  // Response size
  avgResponseSize: {
    warning: 30 * 1024,   // 30 KB
    critical: 50 * 1024,  // 50 KB
  },

  // Cache performance
  cacheHitRate: {
    warning: 0.7,   // 70%
    critical: 0.5,  // 50%
  },

  // Latency
  p95Latency: {
    warning: 500,   // 500ms
    critical: 1000, // 1s
  },

  // Error rate
  errorRate: {
    warning: 0.01,  // 1%
    critical: 0.05, // 5%
  },
};

class AlertManager {
  checkThresholds(metrics: Metrics): void {
    for (const [metric, thresholds] of Object.entries(ALERT_THRESHOLDS)) {
      const value = metrics[metric];

      if (value > thresholds.critical) {
        this.sendAlert('critical', metric, value);
      } else if (value > thresholds.warning) {
        this.sendAlert('warning', metric, value);
      }
    }
  }
}
```

---

## Conclusion

These technical recommendations provide specific, actionable guidance for implementing the optimization architecture:

1. **Query Language:** Simple, URL-friendly syntax
2. **Caching:** Hierarchical keys, dynamic TTL, smart invalidation
3. **Field Selection:** Pre-defined presets, shallow copies
4. **Compression:** Threshold-based, algorithm selection
5. **Handle Storage:** For large responses, self-describing format
6. **Metrics:** Comprehensive tracking with sampling
7. **Error Handling:** Graceful degradation, circuit breaker
8. **Testing:** Unit, integration, performance tests
9. **Deployment:** Canary releases, feature flags
10. **Monitoring:** Key metrics, alert thresholds

Follow these recommendations to build a robust, performant, and maintainable optimization architecture.
