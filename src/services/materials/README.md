# Material Tracking System

A comprehensive material tracking and analysis system for JobNimbus MCP, providing advanced analytics, cost optimization, supplier comparison, and inventory management capabilities.

## Architecture

The system is built with a modular architecture consisting of:

### Core Services

1. **MaterialDataRepository** - Data fetching and caching layer
   - Fetches estimates from JobNimbus API
   - Transforms estimates into material records
   - 5-minute caching for performance
   - Filtering and date range support

2. **MaterialStatistics** - Statistical analysis engine
   - Comprehensive statistics (mean, median, std dev, percentiles)
   - Material aggregation and grouping
   - Trend detection (linear regression)
   - Coefficient of variation for volatility
   - Outlier detection

3. **MaterialForecasting** - Predictive analytics
   - Linear regression forecasting
   - Moving average forecasting
   - Confidence intervals
   - Trend strength calculation (R-squared)
   - Seasonality detection

4. **SupplierAnalyzer** - Supplier comparison and optimization
   - Multi-supplier pricing comparison
   - Best/worst supplier identification
   - Potential savings calculation
   - Reliability scoring
   - Supplier recommendations

5. **MaterialAnalyzer** - Main orchestrator
   - Coordinates all services
   - Implements business logic
   - Generates insights and recommendations
   - Handles all tool operations

### Tools (MCP Interface)

1. **get_estimate_materials** - Analyze materials from a specific estimate
2. **analyze_material_costs** - Comprehensive cost analysis over time
3. **get_material_usage_report** - Usage tracking with trends and forecasting
4. **get_supplier_comparison** - Compare supplier pricing and performance
5. **get_material_inventory_insights** - AI-powered inventory optimization

## Data Flow

```
JobNimbus API
    ↓
MaterialDataRepository (Caching)
    ↓
MaterialRecord[] (Normalized data)
    ↓
MaterialAnalyzer (Orchestration)
    ↓
├─ MaterialStatistics (Aggregation & Stats)
├─ MaterialForecasting (Predictions)
└─ SupplierAnalyzer (Supplier Analysis)
    ↓
Tool Output (JSON Response)
```

## Key Features

### 1. Material Analysis
- Cost breakdown by category
- Margin analysis (high/low performers)
- Statistical analysis (mean, median, std dev)
- Trend detection over time

### 2. Cost Optimization
- Identify overpriced materials
- Price increase recommendations
- Cost reduction opportunities
- Discontinuation suggestions

### 3. Supplier Management
- Multi-supplier pricing comparison
- Best/worst supplier identification
- Potential savings calculation
- Reliability scoring
- Price trend analysis per supplier

### 4. Inventory Intelligence
- Usage trend detection (increasing/decreasing/stable)
- Reorder recommendations
- Cost volatility alerts
- High velocity material identification
- Slow-moving/inactive material detection

### 5. Forecasting
- Linear regression forecasting
- Moving average forecasting
- Confidence intervals
- Seasonal pattern detection

## Usage Examples

### Example 1: Analyze Estimate Materials
```typescript
{
  "estimate_id": "EST-12345",
  "include_labor": false,
  "include_cost_analysis": true
}
```

**Returns:**
- Material list with costs and margins
- Summary totals
- Category breakdown
- High/low margin items

### Example 2: Material Cost Analysis
```typescript
{
  "date_from": "2024-01-01",
  "date_to": "2024-12-31",
  "include_trends": true,
  "min_usage_count": 3
}
```

**Returns:**
- Overall cost summary
- Per-material statistics
- Trend data over time
- High/low performers
- Optimization recommendations

### Example 3: Usage Report with Forecasting
```typescript
{
  "date_from": "2024-01-01",
  "date_to": "2024-12-31",
  "aggregate_by": "month",
  "include_forecast": true
}
```

**Returns:**
- Usage statistics per material
- Monthly trend data
- 3-period forecast with confidence intervals

### Example 4: Supplier Comparison
```typescript
{
  "date_from": "2024-01-01",
  "date_to": "2024-12-31",
  "material_name": "Shingles",
  "min_purchases": 2
}
```

**Returns:**
- Supplier pricing comparison
- Best/worst suppliers
- Potential savings
- Reliability scores
- Price trends per supplier

### Example 5: Inventory Insights
```typescript
{
  "date_from": "2024-01-01",
  "date_to": "2024-12-31",
  "low_stock_threshold": 30,
  "min_usage_count": 2
}
```

**Returns:**
- Material insights with trends
- Reorder recommendations
- Cost volatility analysis
- Alerts (low stock, high volatility, unused)
- Reorder schedule

## Technical Details

### Caching Strategy
- 5-minute TTL cache for estimate data
- Cache key based on date range
- Automatic cache cleanup

### Statistical Methods
- **Mean**: Simple average
- **Median**: Middle value (sorted)
- **Standard Deviation**: Sqrt of variance
- **Percentiles**: Linear interpolation
- **Trend Detection**: Linear regression with 5% threshold
- **Coefficient of Variation**: Std dev / mean

### Forecasting Algorithm
1. Calculate linear regression (slope & intercept)
2. Extrapolate for future periods
3. Calculate standard error
4. Generate confidence intervals (±2 std errors)

### Supplier Scoring
- **Recency Score** (0-100): Based on last purchase date
  - ≤30 days: 100
  - ≤90 days: 75
  - ≤180 days: 50
  - ≤365 days: 25
  - >365 days: 0
- **Volume Score**: (usage_count / 10) × 100 (capped at 100)
- **Price Stability**: 100 - (price range / max price) × 100
- **Reliability**: Average of all three scores

### Reorder Logic
1. Calculate daily usage (monthly avg / 30)
2. Adjust for trend (×1.5 increasing, ×0.7 decreasing)
3. Calculate days of supply
4. Recommend reorder if below threshold
5. Suggest quantity = daily usage × threshold × trend multiplier

## Error Handling

All tools use `MaterialAnalysisError` with specific error codes:
- `INVALID_INPUT` - Input validation failed
- `ESTIMATE_NOT_FOUND` - Estimate doesn't exist
- `NO_DATA_AVAILABLE` - No data for analysis
- `INSUFFICIENT_DATA` - Not enough data for statistics
- `CALCULATION_ERROR` - Calculation/analysis failed
- `API_ERROR` - JobNimbus API error

## Performance Considerations

1. **Caching**: 5-minute cache reduces API calls
2. **Pagination**: Fetches estimates in batches of 100
3. **Safety Limits**: Max 50 iterations (5000 estimates)
4. **Filtering**: Client-side filtering after fetch
5. **Aggregation**: Efficient Map-based aggregation

## Future Enhancements

- [ ] ML-based forecasting (ARIMA, Prophet)
- [ ] Advanced seasonality detection
- [ ] Automated purchase orders
- [ ] Supplier API integration
- [ ] Real-time inventory tracking
- [ ] Cost trend alerts
- [ ] Bulk import/export
- [ ] Custom reporting templates

## Dependencies

- `jobNimbusClient` - API client
- `dateHelpers` - Date utilities
- `validation` - Input validation
- Material type definitions from `types/materials.ts`

## Testing

To test the system:

1. Ensure JobNimbus API is accessible
2. Have estimates with material items
3. Use valid date ranges
4. Test with various filters

## Support

For issues or questions, refer to the main JobNimbus MCP documentation.
