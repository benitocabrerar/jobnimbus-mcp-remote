# Archived: Territory & Job Analytics Tools

**Date Archived:** 2025-01-14
**Reason:** Consolidation for token efficiency - 8 overlapping tools consolidated into 4 parameterized tools

## What Was Archived

7 analytics tools consolidated into 3 new parameterized tools (+ 1 kept tool):

### Territory Analytics (3 tools → 1 consolidated tool)

1. **get_optimal_door_routes**
   - **Functionality:** AI-powered door-to-door sales route optimization with geographic clustering
   - **Replacement:** `get_territory_analytics(analysis_type="routes", territory, params)`
   - **Why Consolidated:** Route optimization is one aspect of territory analysis

2. **get_territory_heat_maps**
   - **Functionality:** Generate territory heat maps with performance analysis and opportunity scoring
   - **Replacement:** `get_territory_analytics(analysis_type="heatmaps", params)`
   - **Why Consolidated:** Heat maps are visual representation of territory performance

3. **get_jobs_distribution**
   - **Functionality:** Geographic distribution analysis with density mapping and revenue concentration
   - **Replacement:** `get_territory_analytics(analysis_type="distribution", params)`
   - **Why Consolidated:** Distribution is core territory analysis metric

### Door Sales Analytics (2 tools → 1 consolidated tool)

4. **get_door_knocking_scripts_by_area**
   - **Functionality:** AI-generated door-to-door sales scripts customized by area demographics
   - **Replacement:** `get_door_sales_analytics(analysis_type="scripts", area, params)`
   - **Why Consolidated:** Scripts and timing are both door-to-door sales optimization tools

5. **get_seasonal_door_timing**
   - **Functionality:** Optimal timing for door-to-door sales by season with weather analysis
   - **Replacement:** `get_door_sales_analytics(analysis_type="timing", params)`
   - **Why Consolidated:** Timing optimization pairs naturally with script generation

### Job Analytics (2 tools → 1 enhanced tool)

6. **get_job_summary**
   - **Functionality:** Comprehensive job analytics dashboard with KPIs and performance metrics
   - **Replacement:** Enhanced into `get_job_analytics(analysis_type="summary", params)`
   - **Why Consolidated:** Base tool enhanced with additional analysis types

7. **get_estimates_with_addresses**
   - **Functionality:** Comprehensive estimate analysis with geographic mapping and follow-up prioritization
   - **Replacement:** `get_job_analytics(analysis_type="estimates_geo", params)`
   - **Why Consolidated:** Geographic estimate mapping is a specialized job analysis view

### KEPT (1 tool - already comprehensive)

8. **get_activities_analytics**
   - **Status:** KEPT as standalone tool
   - **Reason:** Already comprehensive with productivity metrics, user performance, and follow-up optimization
   - **Note:** This tool is sufficiently specialized and feature-rich to remain standalone

## Why These Were Consolidated

All 8 tools share similar characteristics that make consolidation beneficial:

| Issue | Description |
|-------|-------------|
| **Overlapping Functionality** | Multiple tools analyzing jobs/territory from slightly different angles |
| **Parameter Proliferation** | Each tool has 5-10 parameters, creating decision overhead |
| **Token Waste** | 8 separate tool descriptions consuming significant token budget |
| **User Confusion** | Unclear which tool to use for territory or job analysis |
| **Maintenance Overhead** | 8 tools to maintain vs 4 consolidated tools |

## Consolidated Tools (NEW)

### 1. get_territory_analytics

**Description:** Comprehensive territory and geographic analysis with multiple analysis types.

**Parameters:**
```typescript
{
  analysis_type: "routes" | "heatmaps" | "distribution",
  territory?: string,           // Filter by specific territory/city
  grouping_level?: "city" | "zip" | "state",
  time_period_days?: number,
  include_optimization?: boolean,
  // ... type-specific parameters
}
```

**Analysis Types:**
- **routes:** Door-to-door route optimization with clustering and efficiency scoring
  - Returns: Optimized routes, stop sequences, estimated times, territory coverage
  - Use case: Planning efficient door-to-door sales routes

- **heatmaps:** Territory performance heat maps with opportunity scoring
  - Returns: Geographic zones, performance scores, revenue concentration, expansion opportunities
  - Use case: Identifying high-value territories and coverage gaps

- **distribution:** Geographic job distribution with density analysis
  - Returns: Job counts by location, revenue distribution, density metrics, coverage analysis
  - Use case: Understanding geographic market penetration

**Migration Examples:**
```typescript
// OLD: get_optimal_door_routes(territory="Portland", max_routes=5)
// NEW:
get_territory_analytics(
  analysis_type="routes",
  territory="Portland",
  max_routes=5
)

// OLD: get_territory_heat_maps(grouping_level="city")
// NEW:
get_territory_analytics(
  analysis_type="heatmaps",
  grouping_level="city"
)

// OLD: get_jobs_distribution(grouping_level="zip", min_jobs=3)
// NEW:
get_territory_analytics(
  analysis_type="distribution",
  grouping_level="zip",
  min_jobs=3
)
```

### 2. get_door_sales_analytics

**Description:** Door-to-door sales optimization with scripts and timing recommendations.

**Parameters:**
```typescript
{
  analysis_type: "scripts" | "timing",
  area?: string,                // Specific area/city for analysis
  service_type?: string,        // Service type (roofing, solar, hvac)
  script_style?: string,        // For scripts: conversational, professional, etc.
  current_month_only?: boolean, // For timing: focus on current month
  // ... type-specific parameters
}
```

**Analysis Types:**
- **scripts:** AI-generated sales scripts customized by area demographics
  - Returns: Customized scripts, objection handlers, local market insights
  - Use case: Preparing door-to-door sales teams with area-specific messaging

- **timing:** Optimal timing for door-to-door sales by season
  - Returns: Best months, weather analysis, historical performance, strategic recommendations
  - Use case: Planning door-to-door campaigns for maximum effectiveness

**Migration Examples:**
```typescript
// OLD: get_door_knocking_scripts_by_area(area="Seattle", service_type="roofing")
// NEW:
get_door_sales_analytics(
  analysis_type="scripts",
  area="Seattle",
  service_type="roofing"
)

// OLD: get_seasonal_door_timing(service_type="solar", current_month_only=true)
// NEW:
get_door_sales_analytics(
  analysis_type="timing",
  service_type="solar",
  current_month_only=true
)
```

### 3. get_job_analytics (ENHANCED)

**Description:** Comprehensive job analytics with summary dashboards and geographic estimate analysis.

**Parameters:**
```typescript
{
  analysis_type: "summary" | "estimates_geo",
  time_period_days?: number,
  grouping_level?: "city" | "zip" | "state",  // For estimates_geo
  min_value?: number,                          // For estimates_geo
  status_filter?: string,                      // For estimates_geo
  // ... type-specific parameters
}
```

**Analysis Types:**
- **summary:** Comprehensive job analytics dashboard (formerly get_job_summary)
  - Returns: KPIs, performance metrics, status breakdowns, trend analysis
  - Use case: Executive dashboard of job pipeline health

- **estimates_geo:** Geographic estimate analysis with address validation (formerly get_estimates_with_addresses)
  - Returns: Estimate distribution by location, follow-up prioritization, proximity analysis
  - Use case: Route planning for estimate follow-ups and conversions

**Migration Examples:**
```typescript
// OLD: get_job_summary(time_period_days=90, include_trends=true)
// NEW:
get_job_analytics(
  analysis_type="summary",
  time_period_days=90,
  include_trends=true
)

// OLD: get_estimates_with_addresses(grouping_level="city", min_value=5000)
// NEW:
get_job_analytics(
  analysis_type="estimates_geo",
  grouping_level="city",
  min_value=5000
)
```

### 4. get_activities_analytics (KEPT)

**Description:** Comprehensive activity tracking with productivity metrics and follow-up optimization.

**Status:** Kept as standalone tool - already comprehensive and feature-rich.

**No changes needed.**

## Impact of Consolidation

**Token Efficiency:**
- 8 tool descriptions → 4 tool descriptions
- ~40-50% reduction in territory/job analytics tool listing size
- Simpler tool selection for AI (4 options vs 8)

**User Experience:**
- Clearer categorization: Territory, Door Sales, Job, Activities
- Unified parameter structure per category
- Easier to discover and use correct tool

**Maintenance:**
- 4 tools to maintain instead of 8
- Shared logic for common functionality
- Single codebase per analysis domain

**Functionality:**
- 100% feature parity - no functionality lost
- All parameters supported in consolidated tools
- Same or better performance with optimized queries

## Migration Guide

Update any automation or documentation that references the old tool names:

| Old Tool | New Tool | Migration Example |
|----------|----------|-------------------|
| `get_optimal_door_routes` | `get_territory_analytics(analysis_type="routes")` | Add `analysis_type` parameter |
| `get_territory_heat_maps` | `get_territory_analytics(analysis_type="heatmaps")` | Add `analysis_type` parameter |
| `get_jobs_distribution` | `get_territory_analytics(analysis_type="distribution")` | Add `analysis_type` parameter |
| `get_door_knocking_scripts_by_area` | `get_door_sales_analytics(analysis_type="scripts")` | Add `analysis_type` parameter |
| `get_seasonal_door_timing` | `get_door_sales_analytics(analysis_type="timing")` | Add `analysis_type` parameter |
| `get_job_summary` | `get_job_analytics(analysis_type="summary")` | Add `analysis_type` parameter |
| `get_estimates_with_addresses` | `get_job_analytics(analysis_type="estimates_geo")` | Add `analysis_type` parameter |
| `get_activities_analytics` | `get_activities_analytics` | No change - kept as is |

## Restoration

If these tools need to be restored, the files are preserved in this directory:
- `getOptimalDoorRoutes.ts`
- `getTerritoryHeatMaps.ts`
- `getJobsDistribution.ts`
- `getDoorKnockingScriptsByArea.ts`
- `getSeasonalDoorTiming.ts`
- `getJobSummary.ts` (replaced by enhanced get_job_analytics)
- `getEstimatesWithAddresses.ts`

To restore:
1. Move files back to `src/tools/analytics/`
2. Add imports back to `src/tools/index.ts`
3. Register tools in the ToolRegistry constructor
4. Rebuild and deploy

**Note:** Consider whether the consolidated tools already meet your needs before restoring. The consolidated tools provide all functionality with better organization.

## Related Changes

- **Phase 2 Part 2 of MCP Tools Optimization Plan**
- **Previous:** Phase 2 Part 1 archived 10 low-value analytics (89 → 79 tools)
- **This change:** Consolidate 8 territory/job analytics → 4 tools (79 → 73 tools)
- **Total impact:** 103 → 73 tools (29.1% reduction so far)
- **See:** `MCP_Tools_Optimization_Plan.html` for full context

## Philosophy

**Consolidation Principles:**
- Group by analysis domain (territory, door sales, job, activities)
- Use `analysis_type` parameter for variants within domain
- Maintain 100% feature parity
- Improve discoverability and reduce decision overhead
- Optimize for token efficiency without sacrificing functionality

**Result:**
Clearer tool organization with territory/job analytics consolidated into logical domains while maintaining all analytical capabilities.
