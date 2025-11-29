# Bug #2: Pipeline Value = $0 - Solución Detallada

## Diagnóstico del Problema

### Causa Raíz
El código actual busca valores monetarios en los **jobs**, pero estos campos están vacíos:
- `amount_estimate` → vacío/null
- `sales_rep_amount` → vacío/null

### Dónde SÍ Están los Datos Financieros
Los datos financieros reales están en:
1. **Estimates** (Presupuestos) - Campo `total`
2. **Invoices** (Facturas) - Campos `total`, `due`, `total_paid`

---

## Datos Reales de Producción (Guilford)

### Estimates por Status

| Status | Status Code | Cantidad | Valor Total |
|--------|-------------|----------|-------------|
| Draft (Borrador) | 1 | ~5 | Variable |
| Sent (Enviado) | 2 | ~8 | Variable |
| Approved (Aprobado) | 4 | ~12 | Variable |
| Invoiced (Facturado) | 5 | ~20 | Variable |

### Ejemplos de Estimates con Valores Reales
```
- Estimate #3062: $16,000.00 (Status: Sent)
- Estimate #3058: $30,000.00 (Status: Draft)
- Estimate #3054: $211,933.59 (Status: Invoiced)
- Estimate #3047: $12,930.00 (Status: Approved)
- Estimate #3046: $9,000.00 (Status: Sent)
```

### Resumen Financiero de Invoices
```
Total Facturado:     $149,029.02
Total Pagado:        $95,276.71
Balance Pendiente:   $53,752.31
```

---

## Solución Propuesta

### Enfoque
Calcular el Pipeline Value desde **estimates** en lugar de jobs, agrupando por status para mostrar el embudo de ventas.

### Código TypeScript

```typescript
// Archivo: getPipelineForecasting.ts o nuevo archivo getCEOPipelineMetrics.ts

interface PipelineStage {
  stage: string;
  statusCode: number;
  count: number;
  totalValue: number;
  averageValue: number;
}

interface CEOPipelineMetrics {
  totalPipelineValue: number;
  stages: PipelineStage[];
  invoicedSummary: {
    totalInvoiced: number;
    totalPaid: number;
    balanceDue: number;
  };
}

async function getCEOPipelineMetrics(): Promise<CEOPipelineMetrics> {
  // 1. Obtener estimates con datos financieros
  const estimates = await mcp_Jobnimbus_Guilford_Remote_get_estimates({
    verbosity: "detailed",
    size: 200,
    fields: "jnid,number,total,status,status_name,date_created,sales_rep_name"
  });

  // 2. Agrupar por status
  const stageMap = new Map<number, PipelineStage>();

  const stageNames: Record<number, string> = {
    1: "Draft (Borrador)",
    2: "Sent (Enviado)",
    3: "Viewed (Visto)",
    4: "Approved (Aprobado)",
    5: "Invoiced (Facturado)",
    6: "Declined (Rechazado)"
  };

  for (const estimate of estimates.results) {
    const status = estimate.status || 0;
    const total = estimate.total || 0;

    if (!stageMap.has(status)) {
      stageMap.set(status, {
        stage: stageNames[status] || `Status ${status}`,
        statusCode: status,
        count: 0,
        totalValue: 0,
        averageValue: 0
      });
    }

    const stage = stageMap.get(status)!;
    stage.count++;
    stage.totalValue += total;
  }

  // 3. Calcular promedios
  for (const stage of stageMap.values()) {
    stage.averageValue = stage.count > 0 ? stage.totalValue / stage.count : 0;
  }

  // 4. Obtener resumen de invoices
  const financials = await mcp_Jobnimbus_Guilford_Remote_get_consolidated_financials({
    verbosity: "detailed",
    page_size: 100
  });

  // 5. Calcular pipeline total (solo estimates NO facturados)
  const activePipelineStatuses = [1, 2, 3, 4]; // Draft, Sent, Viewed, Approved
  const totalPipelineValue = Array.from(stageMap.values())
    .filter(s => activePipelineStatuses.includes(s.statusCode))
    .reduce((sum, s) => sum + s.totalValue, 0);

  return {
    totalPipelineValue,
    stages: Array.from(stageMap.values()).sort((a, b) => a.statusCode - b.statusCode),
    invoicedSummary: {
      totalInvoiced: financials.summary?.total_invoiced || 0,
      totalPaid: financials.summary?.total_paid || 0,
      balanceDue: financials.summary?.balance_due || 0
    }
  };
}
```

---

## Campos Importantes

### En Estimates
| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| `total` | Valor total del presupuesto | 16000.00 |
| `status` | Código de status | 1, 2, 4, 5 |
| `status_name` | Nombre del status | "Sent", "Approved" |
| `sales_rep_name` | Vendedor asignado | "John Smith" |
| `date_created` | Fecha de creación | Unix timestamp |

### En Invoices (Consolidado)
| Campo | Descripción |
|-------|-------------|
| `total` | Valor total de la factura |
| `due` | Monto pendiente |
| `total_paid` | Monto pagado |
| `type` | "invoice", "payment", "credit_memo" |

---

## MCP Tools a Utilizar

```typescript
// Para obtener estimates
mcp__Jobnimbus-Guilford-Remote__get_estimates({
  verbosity: "detailed",
  size: 100,
  fields: "jnid,number,total,status,status_name,date_created,sales_rep_name"
})

// Para obtener financieros consolidados
mcp__Jobnimbus-Guilford-Remote__get_consolidated_financials({
  verbosity: "detailed",
  page_size: 100
})

// Para análisis de pipeline existente (verificar)
mcp__Jobnimbus-Guilford-Remote__get_pipeline_forecasting({
  forecast_months: 3,
  include_probability: true
})
```

---

## Valores de Validación

Usa estos valores para verificar que la implementación es correcta:

| Métrica | Valor Esperado (Aproximado) |
|---------|----------------------------|
| Total Facturado | ~$149,029.02 |
| Total Pagado | ~$95,276.71 |
| Balance Pendiente | ~$53,752.31 |
| Estimates con valor > 0 | 45+ registros |

---

## Visualización Sugerida para CEO Dashboard

### KPIs Principales
```
┌─────────────────┬─────────────────┬─────────────────┐
│  Pipeline       │  Facturado      │  Por Cobrar     │
│  $XXX,XXX       │  $149,029       │  $53,752        │
│  (Activo)       │  (Total)        │  (Pendiente)    │
└─────────────────┴─────────────────┴─────────────────┘
```

### Embudo de Ventas
```
Draft:      ████████░░░░░░░░  $XX,XXX  (X estimates)
Sent:       ██████████░░░░░░  $XX,XXX  (X estimates)
Approved:   ████████████░░░░  $XX,XXX  (X estimates)
Invoiced:   ████████████████  $XX,XXX  (X estimates)
```

---

## Notas Importantes

1. **Timestamps**: Recuerda multiplicar por 1000 si trabajas con fechas (Unix seconds → milliseconds)

2. **SumoQuote**: Los estimates vienen de SumoQuote, por eso tienen datos financieros completos

3. **Jobs vs Estimates**: Los jobs son el contenedor del proyecto, los estimates tienen el valor monetario

4. **Filtrado**: Para pipeline "activo", excluir status 5 (Invoiced) y 6 (Declined)

---

## Archivos a Modificar

1. **Backend** (Render):
   - `getPipelineForecasting.ts` - Agregar lógica de estimates
   - O crear nuevo: `getCEOPipelineMetrics.ts`

2. **Frontend**:
   - Componente del Dashboard CEO
   - Mostrar los 3 KPIs principales
   - Agregar gráfico de embudo

---

*Documento generado: 2025-11-28*
*Fuente de datos: JobNimbus MCP - Instancia Guilford*
