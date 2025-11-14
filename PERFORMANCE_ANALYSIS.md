# JobNimbus MCP Remote - Análisis Crítico de Performance y Consumo de Tokens

**Fecha de Análisis**: 13 Noviembre 2025
**Código Base**: 53,515 líneas TypeScript
**Herramientas Activas**: 73 herramientas MCP (reducidas desde 103 originales)

---

## RESUMEN EJECUTIVO

El servidor JobNimbus MCP sufre de **consumo masivo de tokens** causado por:
1. **Transmisión de datos completos sin filtrado**: 89+ campos por Job, arrays JSONB sin límites
2. **Paginación deficiente**: Operaciones que retornan hasta 2,000 jobs sin control
3. **Falta de field selection en modo legacy**: Solo disponible con parámetros Phase 3
4. **Consolidación multi-fuente ineficiente**: Consultas paralelas que combinan miles de registros

**Impacto Estimado**: 200,000-500,000 tokens consumidos por operación analítica típica en ChatGPT/Claude Desktop.

---

## 1. ANÁLISIS DE DATOS POR ENTIDAD

### 1.1 Jobs (Entidad Más Crítica)

**Campos totales**: 89+ campos base + campos dinámicos (custom fields, JSONB)

**Campos JSONB masivos**:
- `related[]`: Array de relaciones (jobs, contacts, estimates, invoices)
- `owners[]`: Array de propietarios con objetos anidados
- `tags[]`: Array de etiquetas
- `primary{}`: Objeto con información del contacto principal (id, name, number, type, email)
- `location{}`: Objeto con jerarquía de ubicaciones (id, parent_id, name)
- `geo{}`: Coordenadas geográficas (lat, lon)

**Estimación de tamaño por Job**:

```typescript
// MODO RAW (actual sin optimización)
interface Job {
  jnid: string;                           // 24 chars
  recid: number;                          // 8 bytes
  number: string;                         // 4-10 chars
  display_number: string;                 // 4-10 chars
  type: string;                           // 10-20 chars
  customer: string;                       // 24 chars (JNID)

  // Metadata (120+ chars)
  created_by: string;                     // 24 chars (JNID)
  created_by_name: string;                // 20-40 chars
  date_created: number;                   // 10 digits (Unix timestamp)
  date_updated: number;
  date_status_change: number;

  // Ownership & Location (200+ chars)
  owners: Array<{id: string}>;            // 24 chars × N owners
  subcontractors: any[];                  // Variable
  location: {                             // 50-100 chars
    id: number,
    parent_id?: number,
    name?: string
  };

  // Job Information (100+ chars)
  name: string;                           // 30-60 chars
  display_name: string;
  description: string;                    // 0-500 chars (puede ser muy largo)

  // Classification (80+ chars)
  record_type: number;
  record_type_name: string;               // 15-30 chars
  status: number;
  status_name: string;                    // 15-30 chars
  source: number;
  source_name: string;

  // Sales (60+ chars)
  sales_rep: string;                      // 24 chars (JNID)
  sales_rep_name: string;                 // 20-40 chars

  // Address (150+ chars)
  address_line1: string;                  // 30-60 chars
  address_line2: string | null;
  city: string;                           // 15-30 chars
  state_text: string;                     // 2-20 chars
  country_name: string;                   // 10-20 chars
  zip: string;                            // 5-10 chars
  geo: {lat: number, lon: number};        // 20 chars

  // Primary Contact (100+ chars)
  primary: {
    id: string,                           // 24 chars
    name?: string,                        // 20-40 chars
    number?: string,                      // 4-10 chars
    type?: string,                        // 10-20 chars
  };

  // Scheduling (30+ chars)
  date_start: number;
  date_end: number;

  // Financial (50+ chars)
  approved_estimate_total: number;
  approved_invoice_total: number;
  last_estimate: number;
  last_invoice: number;
  work_order_total: number;

  // Attachments (10+ chars)
  attachment_count: number;

  // Status (10+ chars)
  is_active: boolean;
  is_archived: boolean;

  // Additional (100+ chars)
  tags: any[];                            // Variable, puede ser muy grande
  external_id: string | null;

  // Custom fields (campo comodín)
  [key: string]: any;                     // Campos dinámicos del cliente
}

// ESTIMACIÓN DE TAMAÑO:
// - Campos base (sin JSONB): ~1,200 chars = ~1.2 KB
// - Con arrays JSONB (related, owners, tags): ~2,000-3,000 chars = ~2-3 KB
// - JSON completo con todos los campos: ~2.5 KB promedio por job
// - Con descripción larga o custom fields: hasta 5-10 KB por job
```

**Cálculo de tokens para consultas típicas**:

```plaintext
ESCENARIO 1: get_jobs sin filtros (default 15 jobs)
- Jobs: 15 × 2.5 KB = 37.5 KB
- Metadata de respuesta: ~2 KB
- Total: ~40 KB
- Tokens estimados: 40 KB ÷ 4 chars/token = ~10,000 tokens

ESCENARIO 2: get_jobs con filtro de fecha (100 jobs)
- Jobs: 100 × 2.5 KB = 250 KB
- Metadata: ~3 KB
- Total: ~253 KB
- Tokens estimados: 253 KB ÷ 4 = ~63,000 tokens

ESCENARIO 3: Análisis de pipeline (2,000 jobs en maxIterations)
- Jobs: 2,000 × 2.5 KB = 5,000 KB = 5 MB
- Metadata + análisis: ~50 KB
- Total: ~5,050 KB
- Tokens estimados: 5,050 KB ÷ 4 = ~1,262,500 tokens
- PROBLEMA CRÍTICO: Excede límites de contexto de GPT-4/Claude
```

**Optimización actual implementada (Phase 3)**:

```typescript
// compactJob reduce de 2.5 KB a ~200 chars (~0.2 KB)
export interface CompactJob {
  jnid: string;                // 24 chars
  number: string;              // 4-10 chars
  name: string;                // 30-60 chars
  status: string;              // 15-30 chars
  address: string;             // 60-100 chars (concatenado)
  sales_rep?: string;          // 20-40 chars
  date_created: string;        // 10 chars (YYYY-MM-DD)
  last_estimate?: number;      // 10 digits
  last_invoice?: number;       // 10 digits
  customer_name?: string;      // 20-40 chars
}

// REDUCCIÓN: 2.5 KB → 0.2 KB = 92% de reducción
// ESCENARIO 2 optimizado: 100 × 0.2 KB = 20 KB = ~5,000 tokens
// MEJORA: 63,000 → 5,000 tokens = 92% reducción
```

### 1.2 Invoices

**Campos totales**: 40+ campos + JSONB arrays

**Campos JSONB masivos**:
- `items[]`: Array de productos/servicios (cada item ~200-500 chars)
  - name, description, quantity, price, cost, uom, sku, category, color, photos[]
- `sections[]`: Agrupación de items
- `related[]`: Array de relaciones
- `owners[]`: Array de propietarios
- `payments[]`: Array de pagos (si están incluidos)

**Estimación de tamaño**:

```plaintext
INVOICE BASE (sin items): ~800 chars = 0.8 KB
INVOICE CON 10 ITEMS: ~800 + (10 × 300) = 3,800 chars = 3.8 KB
INVOICE CON 50 ITEMS: ~800 + (50 × 300) = 15,800 chars = 15.8 KB

ESCENARIO: get_invoices para 1 job con 3 invoices (10 items cada uno)
- Invoices: 3 × 3.8 KB = 11.4 KB
- Tokens: ~2,850 tokens
```

### 1.3 Estimates

**Campos totales**: 35+ campos + JSONB arrays

**Campos JSONB masivos** (similares a Invoices):
- `items[]`: Array de productos/servicios estimados
- `sections[]`: Agrupación de items
- `related[]`: Array de relaciones
- `owners[]`: Array de propietarios

**Estimación de tamaño**: Similar a Invoices (3-15 KB por estimate según cantidad de items)

### 1.4 Attachments (Files)

**Campos totales**: 25+ campos

**Campos críticos**:
- `filename`: 50-200 chars
- `content_type`: 20-50 chars
- `size`: 10 digits
- `url`: 100-300 chars (puede ser muy larga)
- `related[]`: Array de relaciones
- `primary{}`: Objeto de referencia principal

**Estimación de tamaño**:

```plaintext
FILE RECORD: ~400-600 chars = 0.5 KB promedio

ESCENARIO: get_attachments para job con 100 files
- Files: 100 × 0.5 KB = 50 KB
- Metadata de distribución: ~5 KB
- Total: ~55 KB
- Tokens: ~13,750 tokens
```

### 1.5 Consolidated Financials

**PROBLEMA CRÍTICO**: Multi-source aggregation

```typescript
// Consulta paralela a 4 endpoints:
const [invoicesResponse, creditMemosResponse, paymentsResponse, refundsResponse] =
  await Promise.all([
    this.client.get('invoices', { size: 500 }),      // Hasta 500 registros
    this.client.get('credit_memos', { size: 500 }),  // Hasta 500 registros
    this.client.get('payments', { size: 500 }),      // Hasta 500 registros
    this.client.get('refunds', { size: 500 }),       // Hasta 500 registros
  ]);

// PEOR CASO:
// - 500 invoices × 3.8 KB = 1,900 KB
// - 500 credit_memos × 1.5 KB = 750 KB
// - 500 payments × 0.8 KB = 400 KB
// - 500 refunds × 0.8 KB = 400 KB
// TOTAL: 3,450 KB = 3.45 MB = ~862,500 tokens
```

**Optimización actual (Phase 3)**:
- Verbosity levels para limitar campos
- Handle storage para respuestas > 25 KB
- Pero aún consulta todos los registros en memoria

---

## 2. OPERACIONES DE MAYOR CONSUMO

### TOP 10 HERRAMIENTAS MÁS COSTOSAS

#### 1. `get_revenue_report` (use_invoiced_amounts=true)

**Problema**:
```typescript
// Itera sobre TODOS los jobs sin límite
const jobsResponse = await this.client.get('jobs', { size: 100 });
const jobs = jobsResponse.data?.results || [];

for (const job of jobs) {
  // Para CADA job, consulta consolidatedFinancials
  const financialsResponse = await consolidatedTool.execute({
    job_id: job.jnid,
    verbosity: 'compact',
    page_size: 100,
    include_invoices: true,
    include_credit_memos: true,
    include_refunds: true,
  }, context);

  // Extrae NET invoiced
  const netInvoiced = financialsResponse.summary?.net_invoiced || 0;
  // ... procesa
}
```

**Cálculo de consumo**:
```plaintext
Jobs consultados: 100 (size parameter)
Consolidación por job: ~50 KB promedio (verbosity compact)
Total data fetched: 100 × 50 KB = 5,000 KB = 5 MB
Tokens estimados: ~1,250,000 tokens

PROBLEMA ADICIONAL: Esto es solo para obtener summary.net_invoiced
La respuesta completa incluye todos los financials procesados
```

**Optimización necesaria**:
- Agregar endpoint de JobNimbus que retorne solo NET amounts
- Implementar projections en las consultas (field selection en API)
- Cachear NET amounts calculados

#### 2. `get_consolidated_financials` (sin job_id)

**Problema**:
```typescript
// Consulta 4 endpoints en paralelo, cada uno con size: 500
// Sin job_id filter, retorna TODOS los registros del sistema
```

**Cálculo de consumo**:
```plaintext
Invoices: 500 × 3.8 KB = 1,900 KB
Credit Memos: 500 × 1.5 KB = 750 KB
Payments: 500 × 0.8 KB = 400 KB
Refunds: 500 × 0.8 KB = 400 KB
Total: 3,450 KB = ~862,500 tokens
```

#### 3. `analyze_insurance_pipeline` / `analyze_retail_pipeline`

**Problema**:
```typescript
// Fetches ALL jobs con maxIterations = 20
const maxIterations = 20;
let allJobs: Job[] = [];
let offset = 0;

while (iterations < maxIterations) {
  const response = await this.client.get('jobs', { size: 100, from: offset });
  const batch = response.data?.results || [];
  allJobs = allJobs.concat(batch);
  // ...
}
// Puede fetchear hasta 2,000 jobs (20 × 100)
```

**Cálculo de consumo**:
```plaintext
Jobs: 2,000 × 2.5 KB = 5,000 KB
Análisis agregado: ~100 KB
Total: 5,100 KB = ~1,275,000 tokens
```

#### 4. `get_jobs` (con date filtering)

**Problema**:
```typescript
// needsFullFetch = true cuando hay filtros de fecha
// Fetches ALL jobs en batches de 100, hasta maxIterations = 20
if (needsFullFetch) {
  const maxIterations = 20;
  while (iterations < maxIterations) {
    const response = await this.client.get('jobs', { size: 100, from: offset });
    allJobs = allJobs.concat(batch);
    // ...
  }
  // Filtra en memoria (client-side filtering)
  let filteredJobs = this.filterByDateCreated(allJobs, dateFrom, dateTo);
}
```

**Cálculo de consumo**:
```plaintext
Fetched jobs: 2,000 × 2.5 KB = 5,000 KB
Después de filtrado: puede retornar solo 50 jobs
Pero ya consumió: ~1,250,000 tokens solo para filtrar
```

**Optimización necesaria**: Server-side filtering en JobNimbus API

#### 5. `get_attachments` (multi-source)

**Problema**:
```typescript
// Consulta 3 endpoints en paralelo
const [filesResponse, documentsResponse, ordersResponse] = await Promise.all([
  this.client.get('files', { size: 500 }),
  this.client.get('documents', { size: 500 }),
  this.client.get('orders', { size: 500 }),
]);
```

**Cálculo de consumo**:
```plaintext
Files: 500 × 0.5 KB = 250 KB
Documents: 500 × 0.5 KB = 250 KB
Orders: 500 × 0.5 KB = 250 KB
Total: 750 KB = ~187,500 tokens
```

#### 6. `get_monthly_summary`

**Problema**:
```typescript
// Fetches ALL jobs del mes (puede ser 500+)
// Luego fetches financials consolidados para cada uno
```

**Cálculo estimado**: 500,000-800,000 tokens

#### 7. `search_jobs_enhanced` (business_type filtering)

**Problema**: Client-side categorization sobre todos los jobs

**Cálculo estimado**: 300,000-500,000 tokens

#### 8. `get_territory_analytics` (analysis_type='routes')

**Problema**: Fetches jobs + geocoding + route optimization

**Cálculo estimado**: 400,000-600,000 tokens

#### 9. `get_job_analytics` (analysis_type='estimates_geo')

**Problema**: Fetches estimates + address parsing + geo clustering

**Cálculo estimado**: 300,000-500,000 tokens

#### 10. `get_profitability_dashboard`

**Problema**: Combina múltiples analytics (revenue + margin + leakage)

**Cálculo estimado**: 600,000-1,000,000 tokens

---

## 3. PAGINACIÓN Y LÍMITES

### 3.1 Problemas Actuales

**Sin límites hard-coded en muchas operaciones**:

```typescript
// get_jobs.ts - Permite hasta 2,000 jobs
const maxIterations = 20;  // 20 × 100 = 2,000 jobs

// get_attachments.ts - Permite hasta 1,500 files (3 endpoints × 500)
const fetchSize = Math.min(pageSize, 500);

// get_consolidated_financials.ts - Permite hasta 2,000 records (4 endpoints × 500)
const fetchSize = Math.min(pageSize, 500);
```

**Paginación inconsistente**:
- Algunos usan `from` + `size` (legacy)
- Otros usan `page_size` (Phase 3)
- Algunos no tienen paginación visible (analytics)

### 3.2 Límites Recomendados

```typescript
// ACTUAL
size: 500, maxIterations: 20 → 10,000 registros posibles

// RECOMENDADO
size: 50, maxIterations: 5 → 250 registros máximo
+ Warning cuando se alcanza el límite
+ Sugerencia de filtros más específicos
```

---

## 4. FIELD SELECTION Y PROYECCIONES

### 4.1 Estado Actual

**Phase 3 implementa field selection**:

```typescript
// ResponseBuilder.selectFields()
public static selectFields(data: any, fields: string[]): any {
  if (Array.isArray(data)) {
    return data.map(item => this.selectFieldsFromObject(item, fieldSet));
  }
  // ...
}
```

**PERO**:
1. Solo funciona con parámetros nuevos (`fields`, `verbosity`)
2. Filtrado ocurre DESPUÉS de fetch completo
3. No hay server-side projection

**Ejemplo**:

```typescript
// Usuario solo quiere: jnid, number, status
get_jobs({ fields: 'jnid,number,status' })

// Lo que pasa:
// 1. Fetch 100 jobs × 2.5 KB = 250 KB (TODOS los campos)
// 2. Filter en memoria a 3 campos
// 3. Retorna 100 jobs × 0.1 KB = 10 KB

// PROBLEMA: Ya consumió 250 KB de API bandwidth
// Y JobNimbus ya procesó todos los campos
```

### 4.2 Verbosity Levels

**Configuración actual**:

```typescript
// config/response.ts
VERBOSITY: {
  DEFAULT: 'compact',
  LEVELS: {
    summary: { maxFields: 5, maxRows: 5 },
    compact: { maxFields: 15, maxRows: 20 },
    detailed: { maxFields: 50, maxRows: 50 },
    raw: { maxFields: Infinity, maxRows: Infinity }
  }
}
```

**Reducción de campos**:

```plaintext
Job con 89 campos:

summary (5 campos): jnid, number, name, status, date_created
- Tamaño: ~150 chars = 0.15 KB (94% reducción)

compact (15 campos): Core + address + sales_rep + financials
- Tamaño: ~600 chars = 0.6 KB (76% reducción)

detailed (50 campos): Casi completo sin custom fields
- Tamaño: ~2 KB (20% reducción)

raw (89+ campos): Todo
- Tamaño: ~2.5 KB (0% reducción)
```

**Efectividad en la práctica**:

```plaintext
ESCENARIO: 100 jobs con verbosity=compact
- Sin Phase 3: 100 × 2.5 KB = 250 KB = 62,500 tokens
- Con Phase 3: 100 × 0.6 KB = 60 KB = 15,000 tokens
- REDUCCIÓN: 76%

PERO: Solo si el cliente usa los parámetros nuevos
Legacy calls sin verbosity: NO SE BENEFICIAN
```

---

## 5. HANDLE STORAGE SYSTEM

### 5.1 Implementación

```typescript
// ResponseBuilder.build()
const needsHandle = exceedsThreshold(fullDataSize, 'hard');

if (needsHandle && options.entity) {
  resultHandle = await handleStorage.store(
    options.entity,
    processedData,
    options.toolName,
    verbosity,
    options.context.instance
  );
}

// Retorna solo summary + handle
return {
  status: 'partial',
  summary: summary,      // Primeros 20 registros (compact mode)
  result_handle: 'jn:jobs:1699564800:abc123',
  metadata: { ... }
};
```

**Configuración de thresholds**:

```typescript
// config/response.ts
STORAGE: {
  HANDLE_TTL_SEC: 3600,  // 1 hora
  SIZE_THRESHOLDS: {
    soft: 25 * 1024,     // 25 KB - Warning
    hard: 50 * 1024,     // 50 KB - Usa handle
    max: 1024 * 1024,    // 1 MB - Rechaza request
  }
}
```

### 5.2 Efectividad

**PRO**:
- Respuestas grandes (>50 KB) se almacenan en Redis
- Cliente recibe solo summary (primeros 20 records)
- Puede recuperar datos completos con `fetch_by_handle`

**CONTRA**:
- **Datos ya se fetchearon de JobNimbus API** (consumo de API quota)
- **Procesamiento en memoria ya ocurrió** (CPU/RAM)
- **Solo ahorra tokens en la respuesta MCP**, no en el fetch original
- **Requiere round-trip adicional** para obtener datos completos

**Ejemplo de flujo**:

```plaintext
1. Usuario: get_jobs({ size: 100 })
   → Fetch 100 jobs de JobNimbus (250 KB)
   → Procesa en memoria
   → Detecta size > 50 KB
   → Almacena en Redis: handle "jn:jobs:123:abc"
   → Retorna summary: primeros 20 jobs (12 KB)
   → AHORRO: 250 KB → 12 KB en respuesta MCP

2. Usuario: fetch_by_handle({ handle: "jn:jobs:123:abc" })
   → Recupera de Redis (250 KB)
   → Retorna datos completos
   → COSTO TOTAL: Mismo que sin handles, pero en 2 requests
```

**CONCLUSIÓN**: Handle storage optimiza la transmisión MCP pero NO reduce el consumo de la API de JobNimbus.

---

## 6. CACHE STRATEGY

### 6.1 Redis Cache Implementation

```typescript
// services/cacheService.ts
export async function withCache<T>(
  cacheKey: CacheKey,
  ttl: number,
  fetchFn: () => Promise<T>
): Promise<T> {
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const data = await fetchFn();
  await setCache(cacheKey, data, ttl);
  return data;
}
```

**TTLs configurados**:

```typescript
// config/cache.ts
DEFAULT_TTL: {
  JOBS_LIST: 300,          // 5 minutos
  JOBS_DETAIL: 600,        // 10 minutos
  CONTACTS_LIST: 300,
  ESTIMATES_LIST: 180,     // 3 minutos
  INVOICES_LIST: 120,      // 2 minutos
  ATTACHMENTS_LIST: 600,
  ANALYTICS: 1800,         // 30 minutos
}
```

**Cache identifiers**:

```typescript
// Ejemplo: getJobs
function generateCacheIdentifier(input: GetJobsInput): string {
  const from = input.from || 0;
  const size = input.size || 15;
  const pageSize = input.page_size || 'null';
  const verbosity = input.verbosity || 'null';
  const fields = input.fields || 'null';
  const dateFrom = input.date_from || 'null';
  // ... más parámetros

  return `${from}:${size}:${pageSize}:${verbosity}:${fields}:${dateFrom}:...`;
}

// PROBLEMA: Cache muy granular
// Cada combinación de parámetros = cache key diferente
// Tasa de hit puede ser baja si usuarios usan parámetros variables
```

### 6.2 Cache Effectiveness

**ESTIMACIÓN DE HIT RATE**:

```plaintext
Operaciones comunes (repetidas):
- get_jobs() sin filtros: ~60% hit rate
- get_jobs({ date_from: 'current_month' }): ~40% hit rate
- get_consolidated_financials({ job_id: X }): ~30% hit rate

Operaciones analíticas (variables):
- get_revenue_report({ period: 'current_month' }): ~20% hit rate
- analyze_insurance_pipeline(): ~10% hit rate

CONCLUSIÓN: Cache ayuda en lecturas simples pero poco en analytics complejos
```

---

## 7. MÉTRICAS Y ESTIMACIONES

### 7.1 Tamaño Promedio de Response por Herramienta

| Herramienta | Modo Legacy | Modo Phase 3 (compact) | Reducción |
|-------------|-------------|------------------------|-----------|
| get_jobs (15 jobs) | 40 KB | 10 KB | 75% |
| get_jobs (100 jobs) | 250 KB | 60 KB | 76% |
| get_job (1 job) | 2.5 KB | 2.5 KB | 0% (no usa Phase 3) |
| get_invoices (10 invoices) | 50 KB | 20 KB | 60% |
| get_consolidated_financials (1 job) | 50 KB | 15 KB | 70% |
| get_attachments (100 files) | 55 KB | 20 KB | 64% |
| get_revenue_report | 5,000 KB | 1,000 KB | 80% |
| analyze_insurance_pipeline | 5,100 KB | 1,200 KB | 76% |

### 7.2 Consumo de Tokens por Operación Común

**Conversión**: 1 KB ≈ 250 tokens (promedio 4 chars/token)

| Operación | Legacy Tokens | Phase 3 Tokens | Diferencia |
|-----------|---------------|----------------|------------|
| "Dame los últimos 10 jobs" | 10,000 | 2,500 | -75% |
| "Analiza el pipeline de insurance" | 1,275,000 | 300,000 | -76% |
| "Revenue report del mes" | 1,250,000 | 250,000 | -80% |
| "Archivos del job 1820" | 13,750 | 5,000 | -64% |
| "Estado financiero del job 1820" | 12,500 | 3,750 | -70% |

**NOTA CRÍTICA**: Estas reducciones solo aplican si:
1. Cliente usa parámetros Phase 3 (`verbosity`, `fields`, `page_size`)
2. Response size > 50 KB (usa handle storage)
3. Sin handle storage, la reducción es menor (~30-50%)

### 7.3 Campos Más Pesados

**Por tipo de dato**:

1. **JSONB Arrays** (mayor impacto):
   - `items[]` en Invoices/Estimates: 200-500 chars × cantidad items
   - `related[]` en Jobs: 50-100 chars × cantidad relaciones
   - `tags[]` en Jobs: 20-50 chars × cantidad tags

2. **Text Fields largos**:
   - `description` en Jobs: 0-2,000 chars
   - `note` en Activities: 0-5,000 chars
   - `terms` en Estimates: 0-1,000 chars

3. **Nested Objects**:
   - `primary{}` en Jobs: ~100 chars
   - `location{}` en Jobs: ~80 chars
   - `geo{}` en Jobs: ~30 chars

**Optimización recomendada**:

```typescript
// Truncar text fields largos
description: truncateText(job.description, 200),  // Máx 200 chars

// Limitar arrays JSONB
items: invoice.items.slice(0, 5),  // Solo primeros 5 items

// Omitir nested objects innecesarios
// Omitir geo si no se usa
```

---

## 8. IDENTIFICACIÓN DE PROBLEMAS ESPECÍFICOS

### 8.1 Sin Field Selection en API de JobNimbus

**PROBLEMA RAÍZ**: JobNimbus API no soporta field projection

```typescript
// LO QUE SE NECESITA:
GET /api1/jobs?fields=jnid,number,status,sales_rep_name

// LO QUE EXISTE:
GET /api1/jobs  → Retorna TODOS los campos siempre
```

**IMPACTO**:
- Imposible reducir bandwidth en el origen
- Filtrado client-side desperdicia API quota
- Todas las optimizaciones ocurren DESPUÉS del fetch

### 8.2 Client-Side Filtering

**PROBLEMA**: Filtros de fecha/schedule se aplican en memoria

```typescript
// get_jobs.ts línea 395
let filteredJobs = this.filterByDateCreated(allJobs, dateFrom, dateTo);
```

**IMPACTO**:
```plaintext
Usuario: "Jobs del último mes"
Servidor: Fetch 2,000 jobs (5 MB)
Servidor: Filter en memoria → 30 jobs
Retorna: 30 jobs (75 KB con Phase 3)
DESPERDICIO: 5 MB fetched, 75 KB usados = 98.5% desperdicio
```

**SOLUCIÓN NECESARIA**: Server-side filtering en JobNimbus API

```typescript
// IDEAL:
GET /api1/jobs?date_from=2025-10-01&date_to=2025-10-31
→ JobNimbus filtra en DB
→ Retorna solo 30 jobs (75 KB)
```

### 8.3 Consolidación Multi-Source sin Streaming

**PROBLEMA**: `get_consolidated_financials` carga TODO en memoria

```typescript
// Fetch paralelo de 4 endpoints × 500 registros = 2,000 registros en memoria
const responses = await Promise.all([...]);

// Combina en array único
let allRecords = [
  ...invoicesArray,      // 500 items
  ...creditMemosArray,   // 500 items
  ...paymentsArray,      // 500 items
  ...refundsArray,       // 500 items
];  // 2,000 items totales en memoria (3.5 MB)
```

**IMPACTO**:
- Alto consumo de memoria en servidor
- Latencia por procesamiento de 2,000 registros
- Imposible escalar a datasets grandes

**SOLUCIÓN NECESARIA**: Streaming + lazy loading

```typescript
// IDEAL:
async function* streamConsolidatedFinancials(params) {
  yield* streamInvoices(params);
  yield* streamCreditMemos(params);
  yield* streamPayments(params);
  yield* streamRefunds(params);
}

// Cliente consume en chunks
for await (const chunk of streamConsolidatedFinancials(params)) {
  process(chunk);  // Procesa incremental
}
```

### 8.4 Analytics sin Lazy Loading

**PROBLEMA**: Analytics tools cargan datasets completos para cálculos

```typescript
// get_revenue_report.ts línea 83
const jobsResponse = await this.client.get('jobs', { size: 100 });
const jobs = jobsResponse.data?.results || [];

for (const job of jobs) {
  // Fetch financials para CADA job (N+1 query pattern)
  const financialsResponse = await consolidatedTool.execute({ job_id: job.jnid }, context);
}
```

**IMPACTO**:
- 100 jobs × 50 KB financials = 5 MB cargados en memoria
- Latencia: 100 sequential queries (aunque usa Promise.all internamente)
- Imposible paralelizar eficientemente

**SOLUCIÓN NECESARIA**: Aggregate queries en JobNimbus

```typescript
// IDEAL:
GET /api1/analytics/revenue?period=current_month
→ JobNimbus calcula en DB
→ Retorna solo aggregates (< 10 KB)
```

### 8.5 Falta de Compresión

**PROBLEMA**: Respuestas JSON sin compresión

```typescript
// server/index.ts línea 35
app.use(express.json({ limit: '1mb' }));

// NO HAY:
app.use(compression());
```

**IMPACTO**:
```plaintext
Response de 250 KB sin comprimir
Con gzip: ~50 KB (80% reducción típica para JSON)
AHORRO POTENCIAL: 200 KB por request grande
```

---

## 9. OPORTUNIDADES DE OPTIMIZACIÓN

### 9.1 Corto Plazo (1-2 semanas)

#### A. Agregar compresión HTTP

```typescript
// server/index.ts
import compression from 'compression';

app.use(compression({
  threshold: 1024,  // Comprimir responses > 1 KB
  level: 6,         // Nivel de compresión (balance speed/ratio)
}));
```

**Impacto estimado**: 60-80% reducción en bandwidth, 0 cambios en clientes

#### B. Reducir límites default

```typescript
// ACTUAL
const maxIterations = 20;  // 2,000 jobs
const fetchSize = Math.min(pageSize, 500);

// PROPUESTO
const maxIterations = 5;   // 500 jobs
const fetchSize = Math.min(pageSize, 100);
```

**Impacto estimado**: 75% reducción en worst-case scenarios

#### C. Forzar verbosity=compact por default

```typescript
// baseTool.ts
protected async wrapResponse(data, input, context, options) {
  const builderOptions: ResponseBuilderOptions = {
    verbosity: input.verbosity || 'compact',  // Ya está
    // ...
  };
}

// PERO cambiar en todas las tools legacy:
// ANTES:
const useCompactMode = !input.include_full_details || forceCompact;

// DESPUÉS:
const verbosity = input.verbosity || 'compact';  // Forzar compact
const useCompactMode = true;  // Siempre compact
```

**Impacto estimado**: 60-75% reducción para legacy clients

#### D. Agregar warnings de size

```typescript
// ResponseBuilder.build()
if (fullDataSize > SOFT_THRESHOLD) {
  metadata.warning = `Response size is large (${formatSize(fullDataSize)}). ` +
    `Consider using 'fields' parameter to reduce data transfer.`;
}
```

**Impacto estimado**: Educación de usuarios, incentiva uso de field selection

### 9.2 Mediano Plazo (1-2 meses)

#### A. Implementar server-side filtering en proxy layer

```typescript
// Crear middleware que traduce filtros a queries de JobNimbus
// Aunque JobNimbus no soporte filtering, podemos:
// 1. Fetch en batches más pequeños
// 2. Filtrar incremental (stream processing)
// 3. Abortar fetch early cuando se alcanza page_size

async function* fetchJobsWithFilter(params) {
  let fetched = 0;
  let offset = 0;

  while (fetched < params.page_size) {
    const batch = await jobNimbusAPI.get('jobs', { size: 50, from: offset });

    for (const job of batch) {
      if (matchesFilter(job, params.filter)) {
        yield job;
        fetched++;

        if (fetched >= params.page_size) return;  // Early exit
      }
    }

    offset += 50;
  }
}
```

**Impacto estimado**: 50-70% reducción en data fetched para queries filtrados

#### B. Agregar query optimizer

```typescript
// Analiza queries y sugiere optimizaciones
class QueryOptimizer {
  analyze(tool, params) {
    // Detecta anti-patterns
    if (tool === 'get_jobs' && !params.date_from && params.size > 50) {
      return {
        warning: 'Fetching large dataset without date filter',
        suggestion: 'Add date_from filter to reduce data transfer',
        estimated_savings: '80% reduction in response size'
      };
    }

    if (tool === 'get_revenue_report' && params.use_invoiced_amounts) {
      return {
        warning: 'Revenue report with invoiced amounts is expensive',
        suggestion: 'Use use_invoiced_amounts=false for faster response',
        estimated_savings: '90% reduction in query time'
      };
    }
  }
}
```

**Impacto estimado**: Educación proactiva, reduce queries ineficientes

#### C. Implementar GraphQL layer

```typescript
// Permite queries declarativas con field selection
query GetJobs {
  jobs(limit: 10, dateFrom: "2025-10-01") {
    jnid
    number
    status
    salesRep {
      name
    }
  }
}

// Backend resuelve optimizando fetches
```

**Impacto estimado**: 70-90% reducción en over-fetching

### 9.3 Largo Plazo (3-6 meses)

#### A. Crear índices materializados

```typescript
// Pre-computar aggregates y guardar en Redis
// Ejemplo: Revenue report
{
  "revenue:current_month": {
    total: 150000,
    by_type: { ... },
    by_rep: { ... },
    computed_at: 1699564800,
    ttl: 3600
  }
}

// get_revenue_report retorna directamente sin cálculos
```

**Impacto estimado**: 95% reducción en queries analytics

#### B. Migrar a event-driven architecture

```typescript
// JobNimbus webhook → Update materialized views
app.post('/webhooks/jobnimbus/invoice.created', async (req, res) => {
  const invoice = req.body;

  // Incrementar revenue aggregates
  await updateRevenueAggregates(invoice);

  // Invalidar cache relevante
  await invalidateCache(['revenue:current_month']);
});
```

**Impacto estimado**: Real-time updates, 0 queries on-demand

#### C. Implementar partial responses estándar

```typescript
// RFC 7233 - Range Requests
GET /api1/jobs
Range: items=0-19

HTTP/1.1 206 Partial Content
Content-Range: items 0-19/1500

// Cliente puede paginar eficientemente
```

**Impacto estimado**: Protocolo estándar, mejor interoperabilidad

---

## 10. RECOMENDACIONES PRIORITARIAS

### CRÍTICO (Implementar inmediatamente)

1. **Agregar compresión HTTP**
   - Esfuerzo: 1 línea de código
   - Impacto: 60-80% reducción en bandwidth
   - Riesgo: Ninguno

2. **Reducir límites default**
   - Cambiar `maxIterations` de 20 a 5
   - Cambiar `fetchSize` de 500 a 100
   - Esfuerzo: 10 minutos
   - Impacto: 75% reducción en worst-case
   - Riesgo: Bajo (clientes pueden aumentar si necesitan)

3. **Forzar verbosity=compact globalmente**
   - Cambiar default de 'raw' a 'compact'
   - Aplicar compactJob/compactContact en TODAS las responses
   - Esfuerzo: 2 horas
   - Impacto: 60-75% reducción para legacy clients
   - Riesgo: Medio (puede romper clientes que asumen todos los campos)

### ALTO (Implementar en 2-4 semanas)

4. **Implementar rate limiting por data volume**
   ```typescript
   // Limitar tokens consumidos por cliente por hora
   const MAX_TOKENS_PER_HOUR = 100_000;
   ```

5. **Agregar query cost estimation**
   ```typescript
   // Antes de ejecutar, estimar cost
   const estimatedTokens = estimateQueryCost(tool, params);
   if (estimatedTokens > 50_000) {
     return {
       error: 'Query too expensive',
       estimated_tokens: estimatedTokens,
       suggestion: 'Add more specific filters'
     };
   }
   ```

6. **Crear dashboard de analytics consumo**
   - Tracking de tokens por tool
   - Identificación de queries caras
   - Alertas de uso anormal

### MEDIO (Implementar en 1-3 meses)

7. **GraphQL API layer**
8. **Materialized views para analytics**
9. **Server-side filtering proxy**
10. **Webhook-based cache invalidation**

---

## 11. RESUMEN DE NÚMEROS

### Tamaños de Entidad (Promedio)

| Entidad | Raw Size | Compact Size | Tokens Raw | Tokens Compact |
|---------|----------|--------------|------------|----------------|
| Job | 2.5 KB | 0.2 KB | 625 | 50 |
| Invoice (10 items) | 3.8 KB | 0.8 KB | 950 | 200 |
| Estimate (10 items) | 3.8 KB | 0.8 KB | 950 | 200 |
| Contact | 1.5 KB | 0.12 KB | 375 | 30 |
| Activity | 0.8 KB | 0.15 KB | 200 | 38 |
| File | 0.5 KB | 0.3 KB | 125 | 75 |

### Operaciones Típicas

| Operación | Sin Optimización | Con Phase 3 | Optimización Ideal |
|-----------|------------------|-------------|-------------------|
| "10 últimos jobs" | 25 KB / 6,250 tokens | 2 KB / 500 tokens | 1 KB / 250 tokens |
| "Jobs del mes (100)" | 250 KB / 62,500 tokens | 20 KB / 5,000 tokens | 10 KB / 2,500 tokens |
| "Revenue report" | 5 MB / 1,250,000 tokens | 1 MB / 250,000 tokens | 10 KB / 2,500 tokens |
| "Insurance pipeline" | 5 MB / 1,275,000 tokens | 1.2 MB / 300,000 tokens | 50 KB / 12,500 tokens |

### Reducción Potencial

```plaintext
ACTUAL (con Phase 3 + handles):
Promedio: 60-75% reducción vs legacy

POSIBLE (con todas las optimizaciones):
Promedio: 90-95% reducción vs legacy

EJEMPLO CONCRETO:
Revenue Report
- Actual legacy: 1,250,000 tokens
- Actual Phase 3: 250,000 tokens (80% reducción)
- Con optimizaciones: 2,500 tokens (99.8% reducción)

AHORRO ANUAL (estimado):
Si 1,000 queries/día de revenue report:
- Actual: 250M tokens/día = 7.5B tokens/mes
- Optimizado: 2.5M tokens/día = 75M tokens/mes
- AHORRO: 99% = 7.425B tokens/mes
- A $0.01/1K tokens = $74,250/mes ahorrados
```

---

## CONCLUSIÓN

El servidor JobNimbus MCP Remote tiene **problemas críticos de performance y consumo de tokens** debido a:

1. **Arquitectura pull-based sin lazy loading**: Fetch completo → Filter en memoria
2. **Sin field selection en origen**: JobNimbus API retorna todos los campos siempre
3. **Límites muy altos**: Permite fetchear hasta 2,000 registros sin restricción
4. **Analytics sin aggregation layer**: Cálculos on-demand sobre datasets completos
5. **Falta de compresión**: JSON sin gzip/brotli

**Impacto estimado actual**:
- Consultas simples: 5,000-10,000 tokens
- Consultas analíticas: 200,000-500,000 tokens
- Peor caso (analytics complejos): 1,000,000+ tokens

**Con optimizaciones implementadas**:
- Consultas simples: 500-2,500 tokens (90% reducción)
- Consultas analíticas: 10,000-25,000 tokens (95% reducción)
- Analytics pre-computados: 2,000-5,000 tokens (99% reducción)

**Prioridad de implementación**: CRÍTICA
Las optimizaciones de corto plazo (compresión, límites, verbosity) pueden implementarse en 1 semana y dar 75-80% de reducción inmediata.
