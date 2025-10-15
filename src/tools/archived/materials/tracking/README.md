# Archived: Materials Tracking Tools

**Date Archived:** 2025-01-14
**Reason:** Consolidation for token efficiency - 3 time-series tracking tools consolidated into 1 parameterized tool

## What Was Archived

3 materials tracking tools consolidated into 1 parameterized tool (+ 1 kept tool):

### Materials Time-Series Tracking (3 tools → 1 consolidated tool)

1. **analyze_material_costs**
   - **Functionality:** Comprehensive cost analysis for materials over a time period
   - **Replacement:** `get_materials_tracking(analysis_type="costs", ...params)`
   - **Why Consolidated:** Cost analysis is one aspect of materials time-series tracking

2. **get_material_usage_report**
   - **Functionality:** Detailed usage reporting with trends and forecasting
   - **Replacement:** `get_materials_tracking(analysis_type="usage", ...params)`
   - **Why Consolidated:** Usage tracking shares date range and time-series patterns

3. **get_material_inventory_insights**
   - **Functionality:** AI-powered inventory optimization with reorder recommendations
   - **Replacement:** `get_materials_tracking(analysis_type="inventory", ...params)`
   - **Why Consolidated:** Inventory insights use same time-series analysis patterns

### KEPT (1 tool - unique functionality)

4. **get_estimate_materials**
   - **Status:** KEPT as standalone tool
   - **Reason:** Analyzes a SINGLE ESTIMATE, not time-series data
   - **Note:** This tool has unique estimate-specific functionality that cannot be meaningfully consolidated

## Why These Were Consolidated

All 3 time-series tools share similar characteristics that make consolidation beneficial:

| Issue | Description |
|-------|-------------|
| **Overlapping Functionality** | All three analyze materials over time with date ranges |
| **Shared Parameters** | date_from, date_to, category, min_usage_count all common |
| **Same Service Calls** | All use `materialAnalyzer` service with similar patterns |
| **Token Waste** | 3 separate tool descriptions consuming significant token budget |
| **Maintenance Overhead** | 3 tools to maintain vs 1 consolidated tool |

## Consolidated Tool (NEW)

### get_materials_tracking

**Description:** Comprehensive materials tracking with cost analysis, usage reporting, and inventory insights.

**Parameters:**
```typescript
{
  analysis_type: "costs" | "usage" | "inventory",
  // Common parameters (all types)
  date_from?: string,           // YYYY-MM-DD format
  date_to?: string,             // YYYY-MM-DD format
  category?: string,            // Material category filter
  // Costs-specific
  job_type?: string,
  material_categories?: string[],
  min_usage_count?: number,
  include_trends?: boolean,
  // Usage-specific
  material_name?: string,
  sku?: string,
  aggregate_by?: "day" | "week" | "month",
  include_forecast?: boolean,
  // Inventory-specific
  low_stock_threshold?: number,
  include_inactive?: boolean,
}
```

**Analysis Types:**

**1. costs** - Comprehensive cost analysis with optimization recommendations
- Returns: Statistical analysis, high/low cost performers, trend detection, pricing recommendations
- Use case: Cost optimization, pricing strategy, identifying expensive materials

**2. usage** - Usage tracking over time with forecasting
- Returns: Usage patterns, seasonal trends, consumption rates, future usage predictions
- Use case: Demand planning, seasonal analysis, inventory forecasting

**3. inventory** - AI-powered inventory optimization
- Returns: Stock alerts, reorder recommendations, velocity analysis, inactive materials
- Use case: Inventory management, reorder scheduling, stock optimization

**Migration Examples:**

```typescript
// OLD: analyze_material_costs(date_from="2024-01-01", date_to="2024-12-31", include_trends=true)
// NEW:
get_materials_tracking(
  analysis_type="costs",
  date_from="2024-01-01",
  date_to="2024-12-31",
  include_trends=true
)

// OLD: get_material_usage_report(material_name="Shingles", aggregate_by="month", include_forecast=true)
// NEW:
get_materials_tracking(
  analysis_type="usage",
  material_name="Shingles",
  aggregate_by="month",
  include_forecast=true
)

// OLD: get_material_inventory_insights(category="Roofing", low_stock_threshold=30)
// NEW:
get_materials_tracking(
  analysis_type="inventory",
  category="Roofing",
  low_stock_threshold=30
)
```

## Impact of Consolidation

**Token Efficiency:**
- 3 tool descriptions → 1 tool description
- ~35-40% reduction in materials tracking tool listing size
- Simpler tool selection for AI (1 parameterized option vs 3 separate tools)

**User Experience:**
- Single entry point for all time-series materials tracking
- Unified parameter structure with clear analysis type selection
- Easier to discover and use correct tool

**Maintenance:**
- 1 tool to maintain instead of 3
- Shared validation and date handling logic
- Single codebase for time-series analysis

**Functionality:**
- 100% feature parity - no functionality lost
- All parameters supported in consolidated tool
- Same `materialAnalyzer` service calls

## Detailed Tool Comparison

### analyze_material_costs (ARCHIVED)
**Focus:** Cost optimization and pricing strategy
**Key Features:**
- Statistical cost analysis (mean, median, std deviation)
- High/low cost performers identification
- Trend detection over time
- Job type filtering
- Material category filtering
- Cost volatility analysis

**Replaced by:** `get_materials_tracking(analysis_type="costs")`

### get_material_usage_report (ARCHIVED)
**Focus:** Consumption patterns and forecasting
**Key Features:**
- Usage tracking by day/week/month
- Material name and SKU filtering
- Seasonal trend analysis
- Usage forecasting
- Time-series aggregation
- Category filtering

**Replaced by:** `get_materials_tracking(analysis_type="usage")`

### get_material_inventory_insights (ARCHIVED)
**Focus:** Inventory optimization and reorder planning
**Key Features:**
- Low stock alerts
- High velocity material identification
- Slow-moving material detection
- Inactive material identification
- Reorder recommendations
- Days of supply calculations
- Cost volatility warnings

**Replaced by:** `get_materials_tracking(analysis_type="inventory")`

## Migration Guide

Update any automation or documentation that references the old tool names:

| Old Tool | New Tool | Migration Example |
|----------|----------|-------------------|
| `analyze_material_costs` | `get_materials_tracking(analysis_type="costs")` | Add `analysis_type` parameter |
| `get_material_usage_report` | `get_materials_tracking(analysis_type="usage")` | Add `analysis_type` parameter |
| `get_material_inventory_insights` | `get_materials_tracking(analysis_type="inventory")` | Add `analysis_type` parameter |
| `get_estimate_materials` | `get_estimate_materials` | No change - kept as is |

## Code Examples

### Before (Old Tools):
```typescript
// Cost analysis
const costs = await analyze_material_costs({
  date_from: '2024-01-01',
  date_to: '2024-12-31',
  job_type: 'Roofing',
  include_trends: true
});

// Usage tracking
const usage = await get_material_usage_report({
  material_name: 'Architectural Shingles',
  aggregate_by: 'month',
  include_forecast: true
});

// Inventory insights
const inventory = await get_material_inventory_insights({
  category: 'Roofing Materials',
  low_stock_threshold: 30,
  include_inactive: false
});
```

### After (Consolidated Tool):
```typescript
// Cost analysis
const costs = await get_materials_tracking({
  analysis_type: 'costs',
  date_from: '2024-01-01',
  date_to: '2024-12-31',
  job_type: 'Roofing',
  include_trends: true
});

// Usage tracking
const usage = await get_materials_tracking({
  analysis_type: 'usage',
  material_name: 'Architectural Shingles',
  aggregate_by: 'month',
  include_forecast: true
});

// Inventory insights
const inventory = await get_materials_tracking({
  analysis_type: 'inventory',
  category: 'Roofing Materials',
  low_stock_threshold: 30,
  include_inactive: false
});
```

## Restoration

If these tools need to be restored, the files are preserved in this directory:
- `analyzeMaterialCosts.ts`
- `getMaterialUsageReport.ts`
- `getMaterialInventoryInsights.ts`

To restore:
1. Move files back to `src/tools/materials/`
2. Add imports back to `src/tools/index.ts`
3. Register tools in the ToolRegistry constructor
4. Rebuild and deploy

**Note:** Consider whether the consolidated tool already meets your needs before restoring. The consolidated tool provides all functionality with better organization and token efficiency.

## Related Changes

- **Phase 3 Part 1 of MCP Tools Optimization Plan**
- **Previous:** Phase 2 Part 2 consolidated territory/job analytics (79 → 75 tools)
- **This change:** Consolidate materials tracking 3 → 1 tool (75 → 73 tools)
- **Total impact:** 103 → 73 tools (29.1% reduction so far)
- **See:** `MCP_Tools_Optimization_Plan.html` for full context

## Philosophy

**Consolidation Principles:**
- Group time-series analysis tools by domain (materials tracking)
- Use `analysis_type` parameter for analysis variants
- Maintain 100% feature parity
- Keep unique tools separate (get_estimate_materials)
- Optimize for token efficiency without sacrificing functionality

**Kept Separate:**
- `get_estimate_materials` - Unique estimate-specific analysis (not time-series)

**Consolidated:**
- Cost analysis, usage tracking, inventory insights - All share time-series patterns

**Result:**
Clearer materials tool organization with time-series tracking consolidated into single parameterized tool while maintaining estimate-specific analysis as standalone tool.
