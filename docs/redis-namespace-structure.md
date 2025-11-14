# Redis Namespace Structure - JobNimbus MCP

## Visión General

La base de datos Redis está organizada con namespaces jerárquicos para evitar colisiones entre diferentes procesos y servicios.

## Formato de Keys

```
jobnimbus:instance:entity:operation:identifier
```

Donde:
- **jobnimbus**: Prefijo de aplicación
- **instance**: `stamford` o `guilford` (separación multi-tenant)
- **entity**: Tipo de entidad o servicio
- **operation**: Operación (get, set, list, search, delete, etc.)
- **identifier**: Identificador único (ID, hash, etc.)

## Namespaces por Servicio

### 1. CacheService (Procesos Principales)

**Entidades regulares:**
```
jobnimbus:stamford:attachments:list:page_1
jobnimbus:guilford:jobs:detail:job123
jobnimbus:stamford:contacts:search:abc123
jobnimbus:guilford:estimates:get:est456
jobnimbus:stamford:invoices:list:page_2
jobnimbus:guilford:tasks:detail:task789
jobnimbus:stamford:products:get:prod123
jobnimbus:guilford:materialorders:list:page_1
jobnimbus:stamford:workorders:detail:wo456
jobnimbus:guilford:payments:list:page_3
```

**TTLs:**
- Attachments: 15-30 min
- Jobs: 10 min
- Contacts: 20-30 min
- Estimates: 15-20 min
- Invoices: 15 min
- Tasks: 10-15 min
- Products: 20-30 min
- Material Orders: 20-30 min
- Work Orders: 20-30 min
- Payments: 15 min

### 2. SmartCache Multi-Tier (Nuevo Sistema)

**Namespace dedicado para evitar colisiones:**

```
jobnimbus:stamford:smart_tier_warm:get:user_preferences
jobnimbus:guilford:smart_tier_warm:set:api_response_123
jobnimbus:stamford:smart_tier_cold:get:heavy_computation
jobnimbus:guilford:smart_tier_cold:set:large_dataset_456
```

**Tiers:**
- `smart_tier_warm`: Cache WARM (5 min TTL) - Datos accedidos frecuentemente
- `smart_tier_cold`: Cache COLD/HANDLE (60 min TTL) - Datos persistentes

**Operaciones:**
- `get`: Recuperar datos del cache
- `set`: Almacenar datos en cache
- `delete`: Eliminar datos del cache

**Características:**
- HOT tier: Solo en memoria (no usa Redis)
- WARM tier: Redis, 5 min TTL, promoción automática desde COLD
- COLD tier: Redis, 60 min TTL, almacenamiento persistente

### 3. HandleStorage (Respuestas Temporales)

**Formato especial para handles:**
```
jobnimbus:stamford:handles:store:jn:jobs:1704567890123:a1b2c3d4
jobnimbus:guilford:handles:retrieve:jn:estimates:1704567890456:e5f6g7h8
```

**TTL:** 15 minutos (limpieza automática)

## Separación de Namespaces

### ¿Por qué usar namespaces separados?

1. **Aislamiento de procesos:** SmartCache no interfiere con CacheService
2. **TTLs independientes:** Cada sistema maneja su propia expiración
3. **Debugging fácil:** Keys claramente identificables por servicio
4. **Escalabilidad:** Agregar nuevos servicios sin conflictos

### Prevención de Colisiones

**Antes (problemático):**
```
jobnimbus:stamford:smartcache:warm:user_data
jobnimbus:stamford:attachments:warm:file_123
```
Riesgo: Si otro proceso usa operation "warm", podría haber colisión

**Después (seguro):**
```
jobnimbus:stamford:smart_tier_warm:get:user_data
jobnimbus:stamford:attachments:list:file_123
```
Garantía: Namespace `smart_tier_warm` es exclusivo de SmartCache

## Monitoreo de Redis

### Comandos útiles para debugging:

```bash
# Ver todas las keys de SmartCache WARM
KEYS jobnimbus:*:smart_tier_warm:*

# Ver todas las keys de SmartCache COLD
KEYS jobnimbus:*:smart_tier_cold:*

# Ver keys de attachments
KEYS jobnimbus:*:attachments:*

# Ver keys de una instancia específica
KEYS jobnimbus:stamford:*

# Contar keys por tipo
INFO keyspace
```

### Estadísticas de uso:

```bash
# Ver memoria usada
INFO memory

# Ver hits/misses ratio
INFO stats
```

## Mejores Prácticas

1. **Siempre especificar instance:** Stamford y Guilford deben estar separados
2. **Usar prefijos descriptivos:** `smart_tier_*` identifica claramente SmartCache
3. **Documentar TTLs:** Cada namespace debe tener TTL documentado
4. **Evitar wildcards en producción:** No usar `*` en keys, solo para debugging
5. **Limpiar datos expirados:** Confiar en auto-expiration de Redis

## Migración y Compatibilidad

- CacheService existente: **Sin cambios** - Sigue usando sus namespaces
- SmartCache nuevo: **Namespaces dedicados** - No afecta procesos existentes
- HandleStorage: **Sin cambios** - Usa su propio namespace `handles`

## Próximos Pasos

- [ ] Implementar monitoreo de métricas por namespace
- [ ] Dashboard de Redis para visualizar distribución de keys
- [ ] Alertas de memoria cuando se acerca al límite (25MB en free tier)
- [ ] Análisis de hit ratio por tier (HOT/WARM/COLD)
