# Redis Cache Implementation Guide

## Arquitectura de Caché para JobNimbus MCP

Sistema de caché enterprise-grade diseñado para:
- **Performance**: < 50ms para respuestas cacheadas
- **Reducción de API calls**: 80%+ menos llamadas a JobNimbus API
- **Resiliencia**: Circuit breaker con fallback automático
- **Constraint**: Optimizado para Render.com free tier (25MB Redis)

---

## 📋 Tabla de Contenidos

1. [Arquitectura](#arquitectura)
2. [Instalación](#instalación)
3. [Configuración](#configuración)
4. [Integración](#integración)
5. [Uso](#uso)
6. [Estrategias de Caché](#estrategias-de-caché)
7. [Monitoreo](#monitoreo)
8. [Troubleshooting](#troubleshooting)
9. [Best Practices](#best-practices)

---

## 🏗 Arquitectura

### Componentes Principales

```
src/
├── config/
│   └── cache.ts              # Configuración centralizada, TTLs, key builders
├── services/
│   ├── cacheService.ts       # Servicio principal con circuit breaker
│   └── cacheIntegration.ts   # Helpers de integración con Express
└── tools/
    └── attachments/
        └── getAttachmentsCached.ts  # Ejemplo de tool con cache
```

### Flujo de Datos

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ Request
       ▼
┌─────────────┐
│  Express    │
└──────┬──────┘
       │
       ▼
┌─────────────────────────┐
│  CacheService.get()     │
│  Circuit Breaker Check  │
└──────┬─────────┬────────┘
       │         │
   Cache HIT  Cache MISS
       │         │
       ▼         ▼
   ┌─────┐   ┌──────────┐
   │Redis│   │JobNimbus │
   │     │   │   API    │
   └─────┘   └────┬─────┘
       │          │
       │          ▼
       │     ┌─────────────┐
       │     │Cache.set()  │
       │     │(background) │
       │     └─────────────┘
       │          │
       └──────────┴─────────┐
                            ▼
                      ┌──────────┐
                      │ Response │
                      └──────────┘
```

### Circuit Breaker Pattern

```typescript
CLOSED (Normal)
   ↓ (failures >= threshold)
OPEN (Rejecting requests)
   ↓ (after reset timeout)
HALF_OPEN (Testing recovery)
   ↓ (3 consecutive successes)
CLOSED (Recovered)
```

---

## 📦 Instalación

### 1. Dependencias

Las dependencias ya están instaladas en `package.json`:

```json
{
  "dependencies": {
    "ioredis": "^5.8.1"
  },
  "devDependencies": {
    "@types/ioredis": "^4.28.10"
  }
}
```

Si necesitas reinstalar:

```bash
npm install
```

### 2. Redis Server

#### Opción A: Local Development (Docker)

```bash
docker run -d \
  --name redis-cache \
  -p 6379:6379 \
  redis:7-alpine
```

#### Opción B: Render.com (Production)

1. Ir a [render.com](https://render.com)
2. Crear nuevo Redis instance (free tier: 25MB)
3. Copiar credenciales (host, port, password)

---

## ⚙️ Configuración

### 1. Variables de Entorno

Copiar `.env.example` a `.env`:

```bash
cp .env.example .env
```

### 2. Configuración Local (Development)

```env
# .env
CACHE_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_TLS_REJECT_UNAUTHORIZED=false
CACHE_COMPRESSION=false
CACHE_LOG_LEVEL=debug
```

### 3. Configuración Producción (Render.com)

```env
# .env (production)
NODE_ENV=production
CACHE_ENABLED=true
REDIS_HOST=red-xxxxx.oregon-postgres.render.com
REDIS_PORT=6379
REDIS_PASSWORD=your_secure_password_here
REDIS_DB=0
REDIS_TLS_REJECT_UNAUTHORIZED=true
CACHE_COMPRESSION=true
CACHE_MAX_ITEM_SIZE_KB=256
CACHE_LOG_LEVEL=info
```

### 4. Configuración Avanzada

```env
# Circuit Breaker
CACHE_FAILURE_THRESHOLD=5          # Abrir circuito después de 5 fallos
CACHE_RESET_TIMEOUT=60000          # Intentar reconectar después de 60s
CACHE_MONITORING_WINDOW=120000     # Ventana de monitoreo: 2 minutos

# Performance
CACHE_MAX_ITEM_SIZE_KB=512         # Tamaño máximo por item: 512KB
CACHE_COMPRESSION=true             # GZIP para items grandes
REDIS_MAX_MEMORY_POLICY=allkeys-lru # Política de eviction

# Monitoring
CACHE_ENABLE_METRICS=true
CACHE_LOG_LEVEL=info
```

---

## 🔧 Integración

### 1. Inicializar en Server Startup

Editar `src/index.ts` o tu archivo principal:

```typescript
import express from 'express';
import { initializeCache, registerCacheRoutes } from './services/cacheIntegration.js';

const app = express();

async function startServer() {
  try {
    // Inicializar cache
    await initializeCache(app);

    // Registrar rutas de monitoreo
    registerCacheRoutes(app);

    // ... resto de la configuración

    app.listen(3000, () => {
      console.log('Server running on port 3000');
    });
  } catch (error) {
    console.error('Server startup failed:', error);
    process.exit(1);
  }
}

startServer();
```

### 2. Usar en Tools Existentes

#### Ejemplo: Cachear `getAttachments`

```typescript
import { withCache } from '../../services/cacheService.js';
import { getTTL, CACHE_PREFIXES } from '../../config/cache.js';

async execute(input: GetAttachmentsInput, context: ToolContext) {
  // Generar identificador único para cache
  const cacheIdentifier = input.job_id
    ? `job:${input.job_id}`
    : 'all';

  // Usar cache con fallback automático
  const result = await withCache(
    {
      entity: CACHE_PREFIXES.ATTACHMENTS,
      operation: CACHE_PREFIXES.LIST,
      identifier: cacheIdentifier,
    },
    getTTL('ATTACHMENTS_BY_JOB'), // 20 minutos
    () => this.fetchFromAPI(input, context) // Fallback
  );

  return result;
}
```

### 3. Cache Manual (Control Granular)

```typescript
import { cacheService } from './services/cacheService.js';

// GET
const cached = await cacheService.get('attachments', 'list', 'job:123');
if (cached) {
  return cached;
}

// Fetch from API
const data = await fetchFromAPI();

// SET con TTL
await cacheService.set('attachments', 'list', 'job:123', data, 900);

// DELETE
await cacheService.delete('attachments', 'list', 'job:123');

// INVALIDATE PATTERN
await cacheService.invalidatePattern('attachments', '*');
```

---

## 🎯 Uso

### Endpoints de Monitoreo

#### Health Check

```bash
curl http://localhost:3000/cache/health
```

**Response:**
```json
{
  "status": "healthy",
  "cache": {
    "healthy": true,
    "status": "ok",
    "latencyMs": 2
  },
  "timestamp": "2025-10-13T10:30:00.000Z"
}
```

#### Statistics

```bash
curl http://localhost:3000/cache/stats
```

**Response:**
```json
{
  "status": "ok",
  "stats": {
    "metrics": {
      "hits": 8234,
      "misses": 1876,
      "errors": 12,
      "sets": 1888,
      "deletes": 45,
      "totalRequests": 10110,
      "avgLatencyMs": 3.4,
      "hitRate": 81.44,
      "circuitState": "CLOSED"
    },
    "redis": {
      "connected": true,
      "status": "ready",
      "uptime": 3600,
      "memoryUsed": "12.5M",
      "totalKeys": 1245
    }
  },
  "timestamp": "2025-10-13T10:30:00.000Z"
}
```

#### Clear Cache (Admin)

```bash
curl -X POST http://localhost:3000/cache/clear
```

#### Invalidate Pattern (Admin)

```bash
curl -X DELETE http://localhost:3000/cache/invalidate \
  -H "Content-Type: application/json" \
  -d '{"entity": "attachments", "operation": "list"}'
```

---

## 📊 Estrategias de Caché

### TTL Recomendados

| Tipo de Datos | TTL | Razón |
|--------------|-----|-------|
| Attachments List | 15 min | Actualización frecuente |
| Attachments by Job | 20 min | Contexto de job estable |
| Attachments by Contact | 30 min | Cambios menos frecuentes |
| Job Detail | 10 min | Jobs se actualizan frecuentemente |
| Contact Detail | 30 min | Contacts más estables |
| Analytics | 60 min | Cálculos costosos, menos críticos |
| Search Results | 5 min | Parámetros de búsqueda varían |

### Cache Keys Hierarchy

```
jobnimbus:{entity}:{operation}:{identifier}

Ejemplos:
- jobnimbus:attachments:list:job:123
- jobnimbus:attachments:detail:file:abc-def
- jobnimbus:jobs:detail:456
- jobnimbus:contacts:search:hash:a1b2c3
```

### Invalidation Strategies

#### 1. Time-based (Automático)
```typescript
// TTL se encarga automáticamente
await cacheService.set('attachments', 'list', 'job:123', data, 900);
```

#### 2. Event-based (Manual)
```typescript
// Después de upload de archivo
async function uploadAttachment(jobId: string, file: File) {
  await uploadToJobNimbus(jobId, file);

  // Invalidar cache relacionado
  await cacheService.invalidatePattern('attachments', `*job:${jobId}*`);
}
```

#### 3. Pattern-based (Bulk)
```typescript
// Invalidar todos los attachments
await cacheService.invalidatePattern('attachments', '*');

// Invalidar solo listas
await cacheService.invalidatePattern('attachments', 'list');

// Invalidar job específico
await cacheService.invalidatePattern('*', `*job:${jobId}*`);
```

### Compression Strategy

```typescript
// Automático según tamaño
if (CACHE_COMPRESSION=true && data > 1KB) {
  // GZIP compression aplicado automáticamente
  // Prefix: "gzip:{base64_data}"
}
```

---

## 📈 Monitoreo

### Métricas Clave

1. **Hit Rate**: Meta > 75%
   ```typescript
   hitRate = (hits / totalRequests) * 100
   ```

2. **Average Latency**: Meta < 50ms
   ```typescript
   avgLatencyMs = sum(latencies) / count
   ```

3. **Circuit State**: Debe ser `CLOSED` en operación normal

4. **Memory Usage**: Render.com free tier = 25MB max

### Alertas Recomendadas

```typescript
// Hit rate bajo
if (hitRate < 50%) {
  console.warn('Cache hit rate below threshold: ' + hitRate);
}

// Latencia alta
if (avgLatencyMs > 100) {
  console.warn('Cache latency high: ' + avgLatencyMs + 'ms');
}

// Circuit abierto
if (circuitState === 'OPEN') {
  console.error('Cache circuit breaker OPEN - Redis unavailable');
}

// Memoria cerca del límite (Render.com)
if (memoryUsedMB > 20) {
  console.warn('Redis memory usage high: ' + memoryUsedMB + 'MB / 25MB');
}
```

### Logging

```typescript
// Debug level - Development
CACHE_LOG_LEVEL=debug
// Logs: GET, SET, DELETE, latencies, compressions

// Info level - Production
CACHE_LOG_LEVEL=info
// Logs: Connections, circuit state changes, major events

// Warn level - Minimal
CACHE_LOG_LEVEL=warn
// Logs: Only warnings and errors
```

---

## 🔍 Troubleshooting

### Problema: Redis Connection Failed

**Síntomas:**
```
[Cache] Failed to connect to Redis: ECONNREFUSED
```

**Soluciones:**

1. Verificar Redis está corriendo:
   ```bash
   docker ps | grep redis
   # o
   redis-cli ping
   ```

2. Verificar credenciales en `.env`:
   ```env
   REDIS_HOST=localhost  # ¿Correcto?
   REDIS_PORT=6379       # ¿Correcto?
   REDIS_PASSWORD=       # Si local, vacío
   ```

3. En Render.com, verificar TLS:
   ```env
   REDIS_TLS_REJECT_UNAUTHORIZED=true
   ```

### Problema: Circuit Breaker Abierto

**Síntomas:**
```
[Cache] Circuit breaker OPENING after 5 failures
```

**Soluciones:**

1. Verificar conectividad:
   ```bash
   curl http://localhost:3000/cache/health
   ```

2. Aumentar threshold:
   ```env
   CACHE_FAILURE_THRESHOLD=10
   ```

3. Aumentar reset timeout:
   ```env
   CACHE_RESET_TIMEOUT=120000  # 2 minutos
   ```

### Problema: Cache Hit Rate Bajo (< 50%)

**Causas:**

1. **TTL muy corto**: Aumentar TTLs en `cache.ts`
2. **Keys no consistentes**: Verificar `buildCacheIdentifier()`
3. **Datos muy dinámicos**: Considerar no cachear
4. **Cache muy pequeño**: Render.com 25MB se llena rápido

**Soluciones:**

```typescript
// 1. Aumentar TTL
CACHE_TTL.ATTACHMENTS_LIST = 30 * 60; // 30 min en vez de 15

// 2. Reducir tamaño de items
CACHE_MAX_ITEM_SIZE_KB=256  // 256KB en vez de 512KB

// 3. Comprimir más agresivamente
CACHE_COMPRESSION=true

// 4. Política de eviction más agresiva
REDIS_MAX_MEMORY_POLICY=allkeys-lfu  # Least Frequently Used
```

### Problema: Redis Memory Full (Render.com)

**Síntomas:**
```
OOM command not allowed when used memory > 'maxmemory'
```

**Soluciones:**

1. Habilitar eviction policy:
   ```env
   REDIS_MAX_MEMORY_POLICY=allkeys-lru
   ```

2. Reducir TTLs:
   ```typescript
   CACHE_TTL.ATTACHMENTS_LIST = 5 * 60; // 5 min
   ```

3. Reducir tamaño máximo:
   ```env
   CACHE_MAX_ITEM_SIZE_KB=128  # 128KB
   ```

4. Comprimir todo:
   ```env
   CACHE_COMPRESSION=true
   ```

5. Limpiar cache manualmente:
   ```bash
   curl -X POST http://localhost:3000/cache/clear
   ```

### Problema: Latencia Alta (> 100ms)

**Causas:**

1. **Descompresión lenta**: Items muy grandes
2. **Red lenta**: Render.com latencia
3. **Redis sobrecargado**: Demasiadas operaciones

**Soluciones:**

```typescript
// 1. Reducir compresión threshold
if (json.length > 5120) {  // Comprimir solo > 5KB
  compress();
}

// 2. Usar SCAN en vez de KEYS
// Ya implementado en invalidatePattern()

// 3. Batch operations
const pipeline = redis.pipeline();
pipeline.get('key1');
pipeline.get('key2');
await pipeline.exec();
```

---

## ✅ Best Practices

### 1. Cache Strategy Selection

```typescript
// ✅ GOOD: Cachear datos estables
await withCache({ entity: 'contacts', operation: 'detail', ... }, 1800, fetchContact);

// ❌ BAD: Cachear datos real-time
await withCache({ entity: 'live-notifications', ... }, 60, fetchNotifications);
```

### 2. Cache Key Design

```typescript
// ✅ GOOD: Jerárquico, predecible
buildCacheKey('attachments', 'list', 'job:123');
// Result: "jobnimbus:attachments:list:job:123"

// ❌ BAD: Plano, difícil de invalidar
`attachments_${jobId}_${userId}_${timestamp}`;
```

### 3. Error Handling

```typescript
// ✅ GOOD: Fallback gracefully
const cached = await cacheService.get(...);
if (cached) return cached;
return await fetchFromAPI(); // Fallback

// ❌ BAD: Throw on cache miss
const cached = await cacheService.get(...);
if (!cached) throw new Error('Cache miss');
```

### 4. TTL Selection

```typescript
// ✅ GOOD: Basado en volatilidad de datos
if (isHighlyDynamic) ttl = 5 * 60;      // 5 min
else if (isModerate) ttl = 30 * 60;     // 30 min
else ttl = 2 * 60 * 60;                 // 2 hours

// ❌ BAD: TTL arbitrario
const ttl = 60; // ¿Por qué 60?
```

### 5. Invalidation

```typescript
// ✅ GOOD: Invalidar después de writes
async function updateJob(jobId, data) {
  await updateInJobNimbus(jobId, data);
  await cacheService.invalidatePattern('*', `*job:${jobId}*`);
}

// ❌ BAD: Nunca invalidar
async function updateJob(jobId, data) {
  await updateInJobNimbus(jobId, data);
  // Cache desactualizado hasta TTL expira
}
```

### 6. Memory Management

```typescript
// ✅ GOOD: Limitar tamaño
if (sizeKB > MAX_ITEM_SIZE_KB) {
  console.warn('Item too large, skipping cache');
  return false;
}

// ❌ BAD: Cachear items enormes
await cacheService.set('huge-report', data); // 10MB
```

### 7. Testing

```typescript
// ✅ GOOD: Disable cache en tests
process.env.CACHE_ENABLED = 'false';

// ❌ BAD: Tests dependientes de Redis
// Tests fallan si Redis no está disponible
```

---

## 📚 Referencias

- [ioredis Documentation](https://github.com/redis/ioredis)
- [Redis Best Practices](https://redis.io/docs/management/optimization/)
- [Circuit Breaker Pattern](https://martinfowler.com/bliki/CircuitBreaker.html)
- [Render.com Redis](https://render.com/docs/redis)

---

## 🎓 Resumen de Comandos

```bash
# Desarrollo local
docker run -d --name redis-cache -p 6379:6379 redis:7-alpine
npm run dev

# Health check
curl http://localhost:3000/cache/health

# Ver estadísticas
curl http://localhost:3000/cache/stats

# Limpiar cache
curl -X POST http://localhost:3000/cache/clear

# Invalidar pattern
curl -X DELETE http://localhost:3000/cache/invalidate \
  -H "Content-Type: application/json" \
  -d '{"entity": "attachments", "operation": "list"}'

# Ver logs en tiempo real
tail -f logs/cache.log

# Monitorear Redis
redis-cli --stat
redis-cli info memory
redis-cli dbsize
```

---

**Implementado por:** Backend Architecture Team
**Versión:** 1.0.0
**Última actualización:** 2025-10-13
