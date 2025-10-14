# Redis Cache System - Quick Reference

## 🎯 Resumen Ejecutivo

Sistema de caché Redis enterprise-grade implementado para JobNimbus MCP que logra:

- ✅ **< 50ms** de latencia para respuestas cacheadas
- ✅ **80%+** de reducción en llamadas a JobNimbus API
- ✅ **Circuit breaker** automático con fallback a API
- ✅ **Optimizado** para Render.com free tier (25MB Redis)

---

## 📁 Archivos Implementados

```
src/
├── config/
│   └── cache.ts                          # Configuración, TTLs, key builders
├── services/
│   ├── cacheService.ts                   # Servicio principal (440 líneas)
│   └── cacheIntegration.ts               # Helpers de Express
└── tools/attachments/
    └── getAttachmentsCached.ts           # Ejemplo de tool con cache

tests/unit/
└── cacheService.test.ts                  # Test suite completo

docs/
├── CACHE_IMPLEMENTATION_GUIDE.md         # Guía detallada (500+ líneas)
└── CACHE_README.md                       # Este archivo

.env.example                              # Variables de entorno actualizadas
```

---

## 🚀 Quick Start

### 1. Instalar Redis Localmente

```bash
# Docker (recomendado)
docker run -d --name redis-cache -p 6379:6379 redis:7-alpine

# Verificar
redis-cli ping
# PONG
```

### 2. Configurar Variables de Entorno

```bash
# .env
CACHE_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
CACHE_COMPRESSION=true
CACHE_LOG_LEVEL=debug
```

### 3. Integrar en Server

```typescript
// src/index.ts
import { initializeCache, registerCacheRoutes } from './services/cacheIntegration.js';

const app = express();

async function startServer() {
  // Inicializar cache
  await initializeCache(app);

  // Rutas de monitoreo
  registerCacheRoutes(app);

  app.listen(3000);
}

startServer();
```

### 4. Usar en Tools

```typescript
// Opción A: Helper withCache (recomendado)
import { withCache } from '../../services/cacheService.js';
import { getTTL, CACHE_PREFIXES } from '../../config/cache.js';

async execute(input: Input, context: Context) {
  return await withCache(
    {
      entity: CACHE_PREFIXES.ATTACHMENTS,
      operation: CACHE_PREFIXES.LIST,
      identifier: `job:${input.job_id}`,
    },
    getTTL('ATTACHMENTS_BY_JOB'),
    () => this.fetchFromAPI(input, context)
  );
}

// Opción B: Manual (control granular)
import { cacheService } from '../../services/cacheService.js';

async execute(input: Input, context: Context) {
  const cached = await cacheService.get('attachments', 'list', 'job:123');
  if (cached) return cached;

  const data = await this.fetchFromAPI(input, context);
  await cacheService.set('attachments', 'list', 'job:123', data, 900);

  return data;
}
```

### 5. Monitorear

```bash
# Health check
curl http://localhost:3000/cache/health

# Estadísticas
curl http://localhost:3000/cache/stats

# Limpiar cache
curl -X POST http://localhost:3000/cache/clear
```

---

## 🏗 Arquitectura Clave

### Circuit Breaker Pattern

```
CLOSED ──(5 failures)──> OPEN ──(60s timeout)──> HALF_OPEN ──(3 successes)──> CLOSED
   │                        │                         │
   └─ Normal operation      └─ Reject requests        └─ Testing recovery
```

### Cache Key Hierarchy

```
jobnimbus:{entity}:{operation}:{identifier}

Ejemplos:
- jobnimbus:attachments:list:job:123
- jobnimbus:attachments:detail:file:abc-def
- jobnimbus:jobs:detail:456
```

### TTL Strategy

| Datos | TTL | Razón |
|-------|-----|-------|
| Attachments by Job | 20 min | Contexto estable |
| Attachments List | 15 min | Más volátil |
| Job Details | 10 min | Cambios frecuentes |
| Analytics | 60 min | Cálculos costosos |

---

## 📊 Métricas de Éxito

### Targets

- **Hit Rate**: > 75% (meta: 80%+)
- **Cache Latency**: < 50ms (p95)
- **API Reduction**: > 80%
- **Memory Usage**: < 20MB (Render.com: 25MB max)

### Monitoreo en Tiempo Real

```typescript
const stats = await cacheService.getStats();

console.log(`Hit Rate: ${stats.metrics.hitRate.toFixed(2)}%`);
console.log(`Avg Latency: ${stats.metrics.avgLatencyMs.toFixed(2)}ms`);
console.log(`Circuit State: ${stats.metrics.circuitState}`);
console.log(`Redis Memory: ${stats.redis.memoryUsed}`);
```

---

## 🔧 Configuración de Producción (Render.com)

### Variables de Entorno

```env
NODE_ENV=production
CACHE_ENABLED=true

# Redis Connection
REDIS_HOST=red-xxxxx.oregon-postgres.render.com
REDIS_PORT=6379
REDIS_PASSWORD=your_secure_password
REDIS_TLS_REJECT_UNAUTHORIZED=true

# Performance Tuning
CACHE_COMPRESSION=true
CACHE_MAX_ITEM_SIZE_KB=256
REDIS_MAX_MEMORY_POLICY=allkeys-lru

# Circuit Breaker
CACHE_FAILURE_THRESHOLD=5
CACHE_RESET_TIMEOUT=60000

# Monitoring
CACHE_ENABLE_METRICS=true
CACHE_LOG_LEVEL=info
```

### Optimizaciones para 25MB

1. **Compression**: Siempre habilitado en producción
2. **Max Item Size**: 256KB (vs 512KB en dev)
3. **Eviction Policy**: `allkeys-lru` (evict least recently used)
4. **TTLs reducidos**: 15-20 min para datos hot

---

## 🛠 Troubleshooting Rápido

### Redis Connection Failed

```bash
# Verificar Redis
docker ps | grep redis
redis-cli ping

# Verificar .env
REDIS_HOST=localhost  # ¿Correcto?
REDIS_PORT=6379       # ¿Correcto?
```

### Circuit Breaker Abierto

```bash
# Health check
curl http://localhost:3000/cache/health

# Ajustar threshold
CACHE_FAILURE_THRESHOLD=10
CACHE_RESET_TIMEOUT=120000
```

### Hit Rate Bajo

```typescript
// 1. Aumentar TTLs
CACHE_TTL.ATTACHMENTS_LIST = 30 * 60; // 30 min

// 2. Verificar keys consistentes
console.log(buildCacheKey('attachments', 'list', 'job:123'));

// 3. Reducir tamaño items
CACHE_MAX_ITEM_SIZE_KB=256
```

### Redis Memory Full

```bash
# 1. Limpiar cache
curl -X POST http://localhost:3000/cache/clear

# 2. Ajustar configuración
CACHE_MAX_ITEM_SIZE_KB=128
CACHE_COMPRESSION=true
REDIS_MAX_MEMORY_POLICY=allkeys-lru
```

---

## 🎓 Comandos Útiles

```bash
# Desarrollo
docker run -d --name redis-cache -p 6379:6379 redis:7-alpine
npm run dev

# Monitoreo
curl http://localhost:3000/cache/health
curl http://localhost:3000/cache/stats

# Administración
curl -X POST http://localhost:3000/cache/clear
curl -X DELETE http://localhost:3000/cache/invalidate \
  -H "Content-Type: application/json" \
  -d '{"entity": "attachments", "operation": "list"}'

# Redis CLI
redis-cli --stat              # Monitor en tiempo real
redis-cli info memory         # Uso de memoria
redis-cli dbsize              # Cantidad de keys
redis-cli keys "jobnimbus:*"  # Ver todas las keys

# Testing
npm run test:unit tests/unit/cacheService.test.ts
```

---

## 📚 Documentación Completa

- **CACHE_IMPLEMENTATION_GUIDE.md**: Guía detallada de implementación (500+ líneas)
- **src/config/cache.ts**: Configuración y comentarios inline
- **src/services/cacheService.ts**: Servicio principal con JSDoc
- **tests/unit/cacheService.test.ts**: Test suite completo

---

## ✅ Checklist de Implementación

### Local Development

- [ ] Redis instalado (Docker o local)
- [ ] `.env` configurado con `CACHE_ENABLED=true`
- [ ] `initializeCache()` en server startup
- [ ] `registerCacheRoutes()` para monitoreo
- [ ] Health check funcional: `curl http://localhost:3000/cache/health`

### Tool Integration

- [ ] Import `withCache` o `cacheService`
- [ ] Identificador de cache único y consistente
- [ ] TTL apropiado según volatilidad de datos
- [ ] Invalidación en write operations
- [ ] Tests actualizados con `CACHE_ENABLED=false`

### Production Deployment

- [ ] Redis en Render.com configurado
- [ ] Variables de entorno de producción
- [ ] TLS habilitado (`REDIS_TLS_REJECT_UNAUTHORIZED=true`)
- [ ] Compression habilitado
- [ ] Monitoring configurado
- [ ] Alertas para hit rate < 50%
- [ ] Alertas para circuit breaker OPEN

---

## 🚨 Alertas Críticas

### Hit Rate < 50%

```typescript
if (hitRate < 50) {
  alert('Cache effectiveness degraded - investigate TTLs and key consistency');
}
```

### Circuit Breaker OPEN

```typescript
if (circuitState === 'OPEN') {
  alert('Redis unavailable - fallback to API active but performance degraded');
}
```

### Memory > 20MB (Render.com)

```typescript
if (memoryUsedMB > 20) {
  alert('Redis memory near limit - consider clearing cache or reducing item sizes');
}
```

---

## 💡 Tips de Performance

1. **Cache hot data**: Implementar warmup al startup
2. **Batch operations**: Usar pipeline para múltiples keys
3. **Monitor hit rate**: Ajustar TTLs según patterns de acceso
4. **Compress wisely**: Solo items > 1KB
5. **Invalidate smart**: Patterns específicos, no `clear()` global

---

## 📞 Soporte

**Issues comunes**: Ver sección Troubleshooting en CACHE_IMPLEMENTATION_GUIDE.md

**Performance tuning**: Ajustar TTLs en `src/config/cache.ts`

**Circuit breaker**: Configurar thresholds en `.env`

**Logs detallados**: `CACHE_LOG_LEVEL=debug`

---

**Implementado por:** Backend Architecture Team
**Versión:** 1.0.0
**Última actualización:** 2025-10-13
