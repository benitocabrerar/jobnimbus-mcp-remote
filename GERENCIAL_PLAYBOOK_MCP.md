# Playbook Gerencial MCP – JobNimbus Stamford

## Objetivo
Guía práctica para que dirección y operaciones usen las 10 herramientas MCP clave para: productividad, control de costos, continuidad operativa, conversión comercial y salud financiera. Incluye KPIs, parámetros recomendados, frecuencia de revisión y acciones correctivas.

## Top 10 Herramientas y KPIs

### 1. Productividad de Usuarios
- Herramienta: `mcp_jobnimbus-sta_get_user_productivity_analytics`
- KPI Principal: Índice de productividad (actividades efectivas / capacidad estimada)
- Métricas Clave: actividades completadas, retrasos promedio, interacción colaborativa, carga (% capacidad)
- Parámetros Recomendados JSON:
```json
{
  "days_back": 30,
  "include_activity_patterns": true,
  "include_collaboration_metrics": true,
  "include_workload_analysis": true
}
```
- Frecuencia: Semanal (resumen) + Mensual (tendencia)
- Umbrales / Alertas:
  - Carga > 110% 2 semanas seguidas → redistribuir tareas
  - Productividad < 70% → coaching / bloqueo operacional
- Acción Correctiva: reasignar tareas, revisar cuellos en procesos, formación.

### 2. Analítica de Actividades
- Herramienta: `mcp_jobnimbus-sta_get_activities_analytics`
- KPI Principal: Tasa de cumplimiento (% actividades cerradas en plazo)
- Métricas: follow-ups oportunos, actividades vencidas, tiempo medio de respuesta
- Parámetros:
```json
{
  "time_period_days": 30,
  "include_user_breakdown": true,
  "include_follow_up_analysis": true
}
```
- Frecuencia: Semanal (backlog), Diario (alertas > 10% vencidas)
- Umbral: >12% actividades vencidas → revisión priorización
- Acción: reforzar uso de recordatorios y automatizar follow-ups.

### 3. Tracking Materiales – Inventario
- Herramienta: `mcp_jobnimbus-sta_get_materials_tracking` (`analysis_type: inventory`)
- KPI Principal: Días de suministro promedio por SKU crítico
- Métricas: rotación, low_stock_count, exceso (>90 días de suministro)
- Parámetros:
```json
{
  "analysis_type": "inventory",
  "low_stock_threshold": 30,
  "include_inactive": false,
  "min_usage_count": 1
}
```
- Frecuencia: Semanal (alertas), Mensual (optimización)
- Umbrales:
  - Días suministro < 20 → pedido urgente
  - Días suministro > 75 → pausar compras
- Acción: ajustar lotes, negociar lead times.

### 4. Tracking Materiales – Costos
- Herramienta: `mcp_jobnimbus-sta_get_materials_tracking` (`analysis_type: costs`)
- KPI Principal: Variación % costo vs trimestre anterior
- Métricas: top 10 SKUs más inflacionados, impacto por job type
- Parámetros:
```json
{
  "analysis_type": "costs",
  "include_trends": true,
  "min_usage_count": 5,
  "job_type": "roofing"
}
```
- Frecuencia: Mensual
- Umbral: Variación > 8% global o >12% SKU crítico → renegociación
- Acción: sustitución material alterno, contrato marco.

### 5. Tracking Materiales – Uso + Forecast
- Herramienta: `mcp_jobnimbus-sta_get_materials_tracking` (`analysis_type: usage`)
- KPI Principal: Precisión forecast consumo (error MAPE)
- Métricas: tendencia mensual, picos, desviaciones vs plan
- Parámetros:
```json
{
  "analysis_type": "usage",
  "aggregate_by": "week",
  "include_forecast": true,
  "material_name": "Shingle A"
}
```
- Frecuencia: Quincenal
- Umbral: Error forecast > 20% → recalibrar modelo cons.
- Acción: revisar estacionalidad y jobs pendientes.

### 6. Revenue Leakage
- Herramienta: `mcp_jobnimbus-sta_analyze_revenue_leakage`
- KPI Principal: Valor de fugas (% sobre pipeline bruto)
- Métricas: oportunidades tardías, demoras aprobación, cancelaciones
- Parámetros:
```json
{
  "lookback_days": 90,
  "include_active": true,
  "min_value_threshold": 500
}
```
- Frecuencia: Mensual + alerta inmediata si fuga semanal >5% pipeline activo
- Umbral: Fuga > 7% trimestre → comité causa raíz
- Acción: acortar ciclo aprobación, SLA internos.

### 7. Pipeline / Forecast (Herramientas de análisis pipeline)
- Herramienta: Activar suite pipeline (`activate_pipeline_analysis_tools`) según disponibilidad
- KPI Principal: Conversión etapa→cierre (%) y confiabilidad forecast
- Métricas: aging por etapa, riesgo (probabilidad ponderada), gap vs objetivo
- Parámetros (ejemplo conceptual):
```json
{
  "time_window_days": 90,
  "include_pricing_analysis": true
}
```
- Frecuencia: Semanal (revisión comercial), Mensual (forecast oficial)
- Umbral: Desviación forecast real >15% dos meses → recalibrar probabilidades
- Acción: reforzar calificación leads, limpieza pipeline.

### 8. Gestión Financiera (Budgets / Invoices)
- Herramientas: `activate_financial_management_tools` (budgets, invoices consolidations)
- KPI Principal: Margen Neto Real vs Presupuestado (%)
- Métricas: aging facturas, créditos aplicados, desviaciones categoría gasto
- Parámetros (conceptual):
```json
{
  "include_consolidated_reports": true
}
```
- Frecuencia: Mensual cierre + Diario aging crítico
- Umbral: Margen neto < presupuesto -3pp → revisión costos / pricing.
- Acción: acelerar cobranzas, renegociar insumos.

### 9. Gestión de Adjuntos / Documentación
- Herramienta: `activate_attachment_management_tools`
- KPI Principal: Cobertura documental (% jobs con adjuntos requeridos completos)
- Métricas: tipos faltantes (contrato, fotos final), distribución por etapa
- Parámetros (conceptual):
```json
{
  "include_distribution_analysis": true
}
```
- Frecuencia: Semanal
- Umbral: Cobertura < 92% → campaña regularización
- Acción: checklist obligatorio antes de cerrar job.

### 10. Follow-up Automatizado / Competitivo
- Herramientas: `mcp_jobnimbus-gui_get_automated_followup` y `mcp_jobnimbus-gui_get_competitive_analysis`
- KPI Principal: Tasa de respuesta follow-ups y win-rate competitivo
- Métricas: tiempo primer contacto, pricing delta, amenazas recurrentes
- Parámetros:
```json
{
  "priority_level": "high",
  "communication_preference": "auto",
  "max_followups": 5
}
```
```json
{
  "time_window_days": 180,
  "include_battle_cards": true,
  "include_pricing_analysis": true
}
```
- Frecuencia: Follow-ups diario; competitivo trimestral
- Umbral: Win-rate competitivo < 45% → análisis propuesta valor.
- Acción: actualizar battle cards / ajustar pricing.

## Dashboard Gerencial Sugerido
- Sección Productividad: índice global + heatmap cargas >110%.
- Sección Pipeline: embudo con aging y forecast vs objetivo.
- Sección Materiales: tarjetas Low Stock, Inflación SKU, Rotación.
- Sección Finanzas: Margen Neto, Aging Facturas (semáforo), Fugas Ingreso.
- Sección Documentación: cobertura vs checklist por job type.
- Sección Competitivo: win-rate, top 5 razones pérdida.

## Rutina Operativa
- Diario: Low stock críticos, follow-ups altos, aging facturas > 45 días.
- Semanal: Productividad usuarios, actividades vencidas, pipeline etapa.
- Quincenal: Forecast materiales consumo vs plan.
- Mensual: Costos materiales, margen neto, revenue leakage, forecast comercial.
- Trimestral: Competitivo (pricing, battle cards), recalibración probabilidades pipeline.

## Roles y Responsables
- Operaciones: Materiales inventario/uso, documentación.
- Comercial: Pipeline, follow-ups, competitivo.
- Finanzas: Margen, aging facturas, costos inflacionados.
- Dirección: Consolidado KPIs, revenue leakage, decisiones estratégicas.

## Acciones Correctivas Típicas
- Saturación recursos: redistribuir, contratar temporal, automatizar tareas.
- Fuga ingreso alta: mapear etapa con mayor caída, rediseñar handoff.
- Inflación costo: negociar volumen, buscar alternativos, ajustar pricing.
- Margen erosionado: análisis mezcla jobs, reducir tiempos improductivos.
- Baja cobertura documental: checklist obligatorio y bloqueo cierre.

## Checklist Implementación Inicial (Semana 1-2)
1. Validar acceso a todas las herramientas (tokens / permisos).
2. Definir umbrales personalizados por categoría (inventario, margen, carga trabajo).
3. Construir dashboard mínimo (5 widgets clave).
4. Programar extracción semanal automática (scripts / scheduler externo si aplica).
5. Comunicar rituales y roles (reunión kick-off).
6. Iterar umbrales tras primer mes de datos.

## Ejemplo Flujo Semanal Automatizado (Conceptual)
1. Lunes AM: Ejecutar productividad + actividades → generar resumen PDF.
2. Martes: Materiales inventario/uso; accionar pedidos urgentes.
3. Miércoles: Pipeline aging y ajustes forecast.
4. Jueves: Revenue leakage + acciones de remediación.
5. Viernes: Consolidado financiero preliminar + alertas.

## Buenas Prácticas
- Mantener parámetros consistentes (ej: `days_back` = 30) para comparables.
- Registrar cambios de umbrales con fecha y motivo.
- Priorizar alertas accionables (<7 KPIs críticos diarios).
- Revisar estacionalidad cada trimestre antes de modificar forecasts.

## Próximos Pasos Opcionales
- Integrar salida JSON a data warehouse.
- Añadir modelo predictivo churn en pipeline.
- Construir score de riesgo proyecto combinando documentación + retrasos.

---
Si necesitas versión abreviada ejecutiva o scripts de llamada, solicitarlo y se agrega como anexo.
