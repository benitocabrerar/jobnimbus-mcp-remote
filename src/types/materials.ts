/**
 * Type definitions for Material Tracking System
 * Comprehensive interfaces for material analysis and tracking
 */

/**
 * Base interfaces for estimate and material data structures
 */
export interface EstimateItem {
  jnid: string;
  name: string;
  description: string;
  sku?: string;
  category?: string;
  item_type: 'material' | 'labor';
  quantity: number;
  uom: string;
  price: number;
  cost: number;
  amount: number;
  color?: string;
  tax_rate: number;
  labor?: {
    price: number;
    cost: number;
    amount: number;
  };
  photos?: string[];
  quickbooksId?: string;
}

export interface Estimate {
  jnid: string;
  number: string;
  status: number;
  status_name: string;
  total: number;
  subtotal: number;
  cost: number;
  margin: number;
  items: EstimateItem[];
  related: Array<{id: string; type: string; name: string; number?: string}>;
  date_created?: number;
  date_updated?: number;
  date_sent?: number;
  date_approved?: number;
  sales_rep?: string;
  sales_rep_name?: string;
}

/**
 * Enhanced material structure with computed fields
 */
export interface MaterialRecord extends EstimateItem {
  estimate_id: string;
  estimate_number: string;
  estimate_status: string;
  job_id?: string;
  job_name?: string;
  job_type?: string;
  supplier?: string;
  margin_percent: number;
  margin_amount: number;
  total_cost: number;
  total_price: number;
  date_created: number;
  date_approved?: number;
  sales_rep?: string;
}

/**
 * Aggregated material data for analysis
 */
export interface MaterialAggregate {
  material_name: string;
  sku?: string;
  category?: string;
  total_quantity: number;
  total_cost: number;
  total_revenue: number;
  total_margin: number;
  avg_unit_cost: number;
  avg_unit_price: number;
  avg_margin_percent: number;
  usage_count: number;
  estimates: string[];
  jobs: string[];
  uom: string;
  first_used: number;
  last_used: number;
}

/**
 * Date range filter
 */
export interface DateRange {
  date_from?: string; // YYYY-MM-DD
  date_to?: string;   // YYYY-MM-DD
}

/**
 * Statistical analysis result
 */
export interface StatisticalAnalysis {
  mean: number;
  median: number;
  std_deviation: number;
  min: number;
  max: number;
  percentile_25: number;
  percentile_75: number;
  percentile_90: number;
  count: number;
}

/**
 * Trend data point
 */
export interface TrendDataPoint {
  period: string; // Date or period label
  value: number;
  count: number;
  average: number;
}

/**
 * Supplier pricing information
 */
export interface SupplierPricing {
  supplier_name: string;
  material_name: string;
  sku?: string;
  avg_cost: number;
  min_cost: number;
  max_cost: number;
  usage_count: number;
  total_quantity: number;
  last_purchase_date: number;
  price_trend: 'increasing' | 'decreasing' | 'stable';
}

/**
 * Inventory insight
 */
export interface InventoryInsight {
  material_name: string;
  sku?: string;
  category?: string;
  avg_monthly_usage: number;
  usage_trend: 'increasing' | 'decreasing' | 'stable';
  reorder_recommendation: {
    should_reorder: boolean;
    suggested_quantity: number;
    reason: string;
  };
  cost_analysis: {
    avg_cost: number;
    cost_volatility: number; // Coefficient of variation
    last_cost: number;
  };
  last_used: number;
  days_since_last_use: number;
}

// ============================================================================
// Tool Input/Output Types
// ============================================================================

/**
 * Tool 1: get_estimate_materials
 */
export interface GetEstimateMaterialsInput {
  estimate_id: string;
  include_labor?: boolean;
  filter_by_type?: 'material' | 'labor' | 'all';
  include_cost_analysis?: boolean;
}

export interface GetEstimateMaterialsOutput {
  estimate_id: string;
  estimate_number: string;
  estimate_status: string;
  materials: MaterialRecord[];
  summary: {
    total_materials: number;
    total_quantity: number;
    total_cost: number;
    total_revenue: number;
    total_margin: number;
    avg_margin_percent: number;
    material_breakdown: {
      category: string;
      count: number;
      cost: number;
      revenue: number;
      margin: number;
    }[];
  };
  cost_analysis?: {
    high_margin_items: MaterialRecord[];
    low_margin_items: MaterialRecord[];
    high_cost_items: MaterialRecord[];
  };
}

/**
 * Tool 2: analyze_material_costs
 */
export interface AnalyzeMaterialCostsInput extends DateRange {
  job_type?: string;
  material_categories?: string[];
  min_usage_count?: number;
  include_trends?: boolean;
}

export interface AnalyzeMaterialCostsOutput {
  period: DateRange;
  summary: {
    total_estimates: number;
    total_materials: number;
    total_cost: number;
    total_revenue: number;
    total_margin: number;
    avg_margin_percent: number;
  };
  material_analysis: {
    material_name: string;
    aggregate: MaterialAggregate;
    statistics: {
      cost: StatisticalAnalysis;
      price: StatisticalAnalysis;
      margin: StatisticalAnalysis;
    };
    trend?: TrendDataPoint[];
  }[];
  high_performers: MaterialAggregate[];
  low_performers: MaterialAggregate[];
  recommendations: {
    type: 'cost_reduction' | 'pricing_increase' | 'supplier_change' | 'discontinue';
    material_name: string;
    current_metric: number;
    suggested_metric: number;
    potential_impact: number;
    reason: string;
  }[];
}

/**
 * Tool 3: get_material_usage_report
 */
export interface GetMaterialUsageReportInput extends DateRange {
  material_name?: string;
  sku?: string;
  category?: string;
  aggregate_by?: 'day' | 'week' | 'month';
  include_forecast?: boolean;
}

export interface GetMaterialUsageReportOutput {
  filters: {
    material_name?: string;
    sku?: string;
    category?: string;
    date_range: DateRange;
  };
  materials: {
    material_name: string;
    sku?: string;
    category?: string;
    usage_statistics: {
      total_quantity: number;
      usage_count: number;
      avg_quantity_per_use: number;
      total_cost: number;
      avg_cost_per_unit: number;
    };
    trend_data: TrendDataPoint[];
    seasonal_patterns?: {
      month: number;
      avg_usage: number;
      peak_usage: number;
    }[];
    forecast?: {
      next_period: string;
      predicted_usage: number;
      confidence_interval: {
        lower: number;
        upper: number;
      };
    }[];
  }[];
}

/**
 * Tool 4: get_supplier_comparison
 */
export interface GetSupplierComparisonInput extends DateRange {
  material_name?: string;
  sku?: string;
  category?: string;
  group_by_supplier?: boolean;
  min_purchases?: number;
}

export interface GetSupplierComparisonOutput {
  material: string;
  period: DateRange;
  suppliers: SupplierPricing[];
  comparison: {
    best_price_supplier: string;
    worst_price_supplier: string;
    price_difference_percent: number;
    potential_savings: number;
  };
  recommendations: {
    supplier_name: string;
    reason: string;
    estimated_savings: number;
    reliability_score: number;
  }[];
  price_trends: {
    supplier_name: string;
    trend_data: TrendDataPoint[];
  }[];
}

/**
 * Tool 5: get_material_inventory_insights
 */
export interface GetMaterialInventoryInsightsInput extends DateRange {
  category?: string;
  low_stock_threshold?: number; // Days of supply
  include_inactive?: boolean;
  min_usage_count?: number;
}

export interface GetMaterialInventoryInsightsOutput {
  period: DateRange;
  insights: InventoryInsight[];
  summary: {
    total_materials: number;
    materials_needing_reorder: number;
    high_velocity_materials: number;
    slow_moving_materials: number;
    inactive_materials: number;
  };
  alerts: {
    type: 'low_stock' | 'high_cost_volatility' | 'unused' | 'overused';
    material_name: string;
    severity: 'high' | 'medium' | 'low';
    message: string;
    action_required: string;
  }[];
  reorder_schedule: {
    material_name: string;
    suggested_reorder_date: string;
    suggested_quantity: number;
    estimated_cost: number;
  }[];
}

/**
 * Error types
 */
export class MaterialAnalysisError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'MaterialAnalysisError';
  }
}

export enum ErrorCode {
  INVALID_INPUT = 'INVALID_INPUT',
  ESTIMATE_NOT_FOUND = 'ESTIMATE_NOT_FOUND',
  NO_DATA_AVAILABLE = 'NO_DATA_AVAILABLE',
  INSUFFICIENT_DATA = 'INSUFFICIENT_DATA',
  CALCULATION_ERROR = 'CALCULATION_ERROR',
  API_ERROR = 'API_ERROR'
}
