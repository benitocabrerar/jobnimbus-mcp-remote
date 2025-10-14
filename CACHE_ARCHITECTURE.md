# Redis Cache Architecture Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         JobNimbus MCP Server                                │
│                         with Redis Caching                                  │
└─────────────────────────────────────────────────────────────────────────────┘

┌───────────────┐
│    Client     │
│   (Claude)    │
└───────┬───────┘
        │ HTTP Request
        │ (API key in header)
        ▼
┌───────────────────────────────────────────────────────────────────┐
│                         Express Server                             │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  Middleware Stack                                         │    │
│  │  - Helmet (security)                                      │    │
│  │  - CORS                                                   │    │
│  │  - Rate Limiting                                          │    │
│  │  - cacheHeadersMiddleware (X-Response-Time, X-Cache)      │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  Cache Routes (Monitoring)                                │    │
│  │  GET  /cache/health      → healthCheck()                  │    │
│  │  GET  /cache/stats       → getStats()                     │    │
│  │  POST /cache/clear       → clear()                        │    │
│  │  DELETE /cache/invalidate → invalidatePattern()           │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  MCP Tools (Business Logic)                               │    │
│  │  - GetAttachmentsCachedTool                               │    │
│  │  - GetJobsTool                                            │    │
│  │  - GetContactsTool                                        │    │
│  │  - ... other tools                                        │    │
│  └───────────────┬──────────────────────────────────────────┘    │
└──────────────────┼───────────────────────────────────────────────┘
                   │
                   │ Uses
                   ▼
┌───────────────────────────────────────────────────────────────────┐
│                     CacheService (Singleton)                       │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  Circuit Breaker State Machine                            │    │
│  │  ┌────────┐  5 failures  ┌──────┐  60s timeout ┌────────┐│    │
│  │  │ CLOSED ├─────────────→│ OPEN ├─────────────→│ HALF_  ││    │
│  │  │        │              │      │              │ OPEN   ││    │
│  │  └───┬────┘              └──────┘              └───┬────┘│    │
│  │      │                                             │      │    │
│  │      └──────────────────3 successes───────────────┘      │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  Core Methods                                             │    │
│  │  • get<T>(entity, operation, identifier): Promise<T|null> │    │
│  │  • set<T>(entity, op, id, value, ttl): Promise<boolean>   │    │
│  │  • delete(entity, operation, identifier): Promise<number> │    │
│  │  • invalidatePattern(entity, op): Promise<number>         │    │
│  │  • clear(): Promise<number>                               │    │
│  │  • getStats(): Promise<CacheMetrics>                      │    │
│  │  • healthCheck(): Promise<HealthStatus>                   │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  Compression Engine                                       │    │
│  │  serialize(value) → JSON → GZIP (if >1KB) → base64       │    │
│  │  deserialize(value) → detect prefix → GUNZIP → JSON      │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  Metrics Collector                                        │    │
│  │  • hits, misses, errors                                   │    │
│  │  • avgLatencyMs (rolling window)                          │    │
│  │  • hitRate = hits / totalRequests * 100                   │    │
│  │  • circuitState (CLOSED/OPEN/HALF_OPEN)                   │    │
│  └──────────────────────────────────────────────────────────┘    │
└────────────────────┬──────────────────────────────────────────────┘
                     │
                     │ ioredis client
                     ▼
┌───────────────────────────────────────────────────────────────────┐
│                         Redis Server                               │
│                    (Render.com free tier: 25MB)                    │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  Key Structure (Hierarchical)                             │    │
│  │  jobnimbus:{entity}:{operation}:{identifier}              │    │
│  │                                                            │    │
│  │  Examples:                                                │    │
│  │  • jobnimbus:attachments:list:job:123                     │    │
│  │  • jobnimbus:attachments:detail:file:abc-def              │    │
│  │  • jobnimbus:jobs:detail:456                              │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  Eviction Policy: allkeys-lru                             │    │
│  │  (Least Recently Used when memory full)                   │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  Data Format                                              │    │
│  │  • Uncompressed: {"id":"123","data":"value"}              │    │
│  │  • Compressed:   gzip:H4sIAAAAAAAAA...                    │    │
│  └──────────────────────────────────────────────────────────┘    │
└────────────────────┬──────────────────────────────────────────────┘
                     │
                     │ Fallback on failure
                     ▼
┌───────────────────────────────────────────────────────────────────┐
│                      JobNimbus API                                 │
│                https://app.jobnimbus.com/api1                      │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  Endpoints:                                               │    │
│  │  • GET /files                                             │    │
│  │  • GET /jobs                                              │    │
│  │  • GET /contacts                                          │    │
│  │  • GET /activities                                        │    │
│  │  • ... other endpoints                                    │    │
│  └──────────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────────┘
```

## Request Flow with Caching

### Cache Hit Scenario (< 50ms)

```
Client Request
     │
     ▼
┌────────────────┐
│ Express Server │
└────────┬───────┘
         │
         ▼
┌───────────────────────┐
│ GetAttachmentsCached  │
│ Tool.execute()        │
└───────┬───────────────┘
        │
        ▼
┌───────────────────────┐
│ withCache() helper    │
└───────┬───────────────┘
        │
        ▼
┌───────────────────────────────────┐
│ CacheService.get()                │
│ • Check circuit breaker: CLOSED   │
│ • Build key: jobnimbus:...        │
│ • Query Redis                     │
└───────┬───────────────────────────┘
        │
        ▼ CACHE HIT
┌───────────────────────────────────┐
│ Redis returns value               │
│ • Decompress if gzip:             │
│ • Deserialize JSON                │
│ • Record metrics: hit++           │
│ • Record latency: ~3ms            │
└───────┬───────────────────────────┘
        │
        ▼
┌───────────────────────┐
│ Return to client      │
│ Total latency: ~10ms  │
└───────────────────────┘
```

### Cache Miss Scenario (100-500ms)

```
Client Request
     │
     ▼
┌────────────────┐
│ Express Server │
└────────┬───────┘
         │
         ▼
┌───────────────────────┐
│ GetAttachmentsCached  │
│ Tool.execute()        │
└───────┬───────────────┘
        │
        ▼
┌───────────────────────┐
│ withCache() helper    │
└───────┬───────────────┘
        │
        ▼
┌───────────────────────────────────┐
│ CacheService.get()                │
│ • Check circuit breaker: CLOSED   │
│ • Build key: jobnimbus:...        │
│ • Query Redis                     │
└───────┬───────────────────────────┘
        │
        ▼ CACHE MISS (null)
┌───────────────────────────────────┐
│ Execute fetchFn()                 │
│ • Call JobNimbus API              │
│ • Process response                │
│ • API latency: ~200ms             │
└───────┬───────────────────────────┘
        │
        ▼
┌───────────────────────────────────┐
│ CacheService.set()                │
│ • Serialize to JSON               │
│ • Compress if > 1KB               │
│ • Check size limit (512KB)        │
│ • Store in Redis with TTL         │
│ • Fire-and-forget (async)         │
└───────┬───────────────────────────┘
        │
        ▼
┌───────────────────────┐
│ Return to client      │
│ Total latency: ~250ms │
│ (Next call: ~10ms)    │
└───────────────────────┘
```

### Circuit Breaker Open Scenario

```
Client Request
     │
     ▼
┌────────────────┐
│ Express Server │
└────────┬───────┘
         │
         ▼
┌───────────────────────┐
│ GetAttachmentsCached  │
│ Tool.execute()        │
└───────┬───────────────┘
        │
        ▼
┌───────────────────────┐
│ withCache() helper    │
└───────┬───────────────┘
        │
        ▼
┌───────────────────────────────────┐
│ CacheService.get()                │
│ • Check circuit breaker: OPEN     │
│ • Redis unavailable               │
│ • Return null immediately         │
└───────┬───────────────────────────┘
        │
        ▼ Immediate fallback
┌───────────────────────────────────┐
│ Execute fetchFn()                 │
│ • Call JobNimbus API directly     │
│ • Process response                │
│ • API latency: ~200ms             │
└───────┬───────────────────────────┘
        │
        ▼
┌───────────────────────┐
│ Return to client      │
│ Total latency: ~250ms │
│ (Degraded but working)│
└───────────────────────┘
```

## TTL Strategy

```
┌────────────────────────────────────────────────────────────────┐
│                        TTL Timeline                             │
└────────────────────────────────────────────────────────────────┘

  0min              5min              10min             15min
   │                 │                  │                 │
   │◄────────────────┼──────────────────┼─────────────────┤
   │   Search        │                  │                 │
   │   Results       │                  │                 │
   │                 │                  │                 │
   │◄────────────────┼──────────────────┼─────────────────┼────────┤
   │                 │   Job Details    │                 │        │
   │                 │                  │                 │        │
   │◄────────────────┼──────────────────┼─────────────────┼────────┼────┤
   │                 │                  │ Attachments     │        │    │
   │                 │                  │ List            │        │    │
   │                 │                  │                 │        │    │
   │◄────────────────┼──────────────────┼─────────────────┼────────┼────┼────┤
   │                 │                  │                 │ Attach │    │    │
   │                 │                  │                 │ by Job │    │    │
   │                 │                  │                 │        │    │    │
  ─┴─────────────────┴──────────────────┴─────────────────┴────────┴────┴────┴───→
                                                          30min   60min  4hr

Legend:
  ├───┤  TTL window
  │    Cache active
  ─→   Time axis
```

## Cache Key Hierarchy

```
jobnimbus: (app namespace)
    │
    ├── attachments:
    │   ├── list:
    │   │   ├── all
    │   │   ├── job:123
    │   │   ├── job:456
    │   │   └── contact:789
    │   ├── detail:
    │   │   ├── file:abc-def
    │   │   └── file:xyz-123
    │   └── search:
    │       └── hash:a1b2c3d4
    │
    ├── jobs:
    │   ├── list:
    │   │   ├── all
    │   │   └── status:active
    │   └── detail:
    │       ├── 123
    │       └── 456
    │
    ├── contacts:
    │   ├── list:
    │   │   └── all
    │   └── detail:
    │       ├── 789
    │       └── 101
    │
    └── analytics:
        ├── revenue:
        │   └── current_month
        └── performance:
            └── sales_rep:all

Invalidation Examples:
  • invalidatePattern('attachments', 'list')
    → Deletes: jobnimbus:attachments:list:*

  • invalidatePattern('attachments', '*')
    → Deletes: jobnimbus:attachments:*:*

  • invalidatePattern('*', '*job:123*')
    → Deletes: All keys containing 'job:123'
```

## Memory Management (25MB Render.com)

```
┌────────────────────────────────────────────────────────────────┐
│                   Redis Memory Layout                           │
└────────────────────────────────────────────────────────────────┘

  0MB                        12.5MB                         25MB
   │                           │                              │
   │◄──────────────────────────┼──────────────────────────────┤
   │    Active Cache           │      Buffer Zone             │
   │    (50%)                  │      (50%)                   │
   │                           │                              │
   │    Frequently             │      Less frequently         │
   │    accessed data          │      accessed data           │
   │                           │                              │
  ─┴───────────────────────────┴──────────────────────────────┴───→
                               │
                               │
                          When >20MB:
                          Alert + Eviction
                          (allkeys-lru)

Optimization Strategies:
  1. Compression (60-80% reduction)
  2. Size limits (512KB → 256KB in prod)
  3. LRU eviction policy
  4. Short TTLs for volatile data
  5. Pattern invalidation (not full flush)

Example Memory Usage:
  • 1 attachment list (uncompressed): ~50KB
  • 1 attachment list (compressed):   ~15KB
  • 100 cached lists:                 ~1.5MB
  • 500 cached lists:                 ~7.5MB
  • Buffer for new entries:           ~17.5MB

  Total capacity: ~500-1000 cache entries
```

## Monitoring Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────┐
│                 Cache Monitoring Dashboard                       │
└─────────────────────────────────────────────────────────────────┘

  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
  │   Hit Rate       │  │  Avg Latency     │  │  Circuit State   │
  │   ╔══════════╗   │  │   ╔═══════════╗  │  │   ┌──────────┐   │
  │   ║ 84.3%    ║   │  │   ║  4.2ms    ║  │  │   │  CLOSED  │   │
  │   ╚══════════╝   │  │   ╚═══════════╝  │  │   └──────────┘   │
  │   Target: >75%   │  │   Target: <50ms  │  │   Status: OK     │
  └──────────────────┘  └──────────────────┘  └──────────────────┘

  ┌──────────────────────────────────────────────────────────────┐
  │   Request Distribution                                        │
  │   ┌────────────────────────────────────────────────────┐     │
  │   │ Hits:   8234 ████████████████████████░░░░░ 81.4%  │     │
  │   │ Misses: 1876 ████░░░░░░░░░░░░░░░░░░░░░░░░ 18.6%  │     │
  │   │ Errors:   12 ░░░░░░░░░░░░░░░░░░░░░░░░░░░░  0.1%  │     │
  │   └────────────────────────────────────────────────────┘     │
  └──────────────────────────────────────────────────────────────┘

  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
  │  Redis Memory    │  │  Total Keys      │  │  Uptime          │
  │  ╔══════════╗    │  │  ╔══════════╗    │  │  ╔══════════╗    │
  │  ║ 12.5MB   ║    │  │  ║  1,245   ║    │  │  ║ 3h 24m   ║    │
  │  ╚══════════╝    │  │  ╚══════════╝    │  │  ╚══════════╝    │
  │  Limit: 25MB     │  │  Capacity: OK    │  │  Since: 10:00    │
  └──────────────────┘  └──────────────────┘  └──────────────────┘

  ┌──────────────────────────────────────────────────────────────┐
  │   Recent Events                                               │
  │   10:30:15 [INFO]  Circuit breaker: CLOSED → OPEN            │
  │   10:31:15 [WARN]  Connection retry #3                       │
  │   10:31:45 [INFO]  Circuit breaker: OPEN → HALF_OPEN         │
  │   10:32:00 [INFO]  Circuit breaker: HALF_OPEN → CLOSED       │
  │   10:45:00 [INFO]  Pattern invalidated: attachments:list     │
  └──────────────────────────────────────────────────────────────┘
```

---

**Architecture by:** Backend Engineering Team
**Version:** 1.0.0
**Last Updated:** 2025-10-13
