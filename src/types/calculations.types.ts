/**
 * Type definitions for Material Calculation System
 * Comprehensive interfaces for roofing, siding, and material calculations
 */

// ============================================================================
// Base Types
// ============================================================================

export type RoofMaterialType =
  | 'architectural_shingles'
  | '3tab_shingles'
  | 'metal_standing_seam'
  | 'metal_corrugated'
  | 'tile_concrete'
  | 'tile_clay'
  | 'slate'
  | 'flat_membrane_tpo'
  | 'flat_membrane_epdm';

export type SidingMaterialType =
  | 'vinyl_horizontal'
  | 'vinyl_vertical'
  | 'fiber_cement'
  | 'wood_lap'
  | 'metal_panels'
  | 'brick_veneer'
  | 'stucco';

export type RoofComplexity = 'simple' | 'moderate' | 'complex';

export type UnitOfMeasure =
  | 'bundle'
  | 'roll'
  | 'box'
  | 'piece'
  | 'lf' // linear feet
  | 'sf' // square feet
  | 'square' // roofing square (100 sq ft)
  | 'sheet'
  | 'gallon'
  | 'pound';

// ============================================================================
// Material Specification Types
// ============================================================================

export interface MaterialSpecification {
  sku: string;
  name: string;
  material_type: string;
  coverage_per_unit: number; // sq ft per unit
  uom: UnitOfMeasure;
  weight_per_unit?: number; // lbs
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
    unit: 'inches' | 'feet';
  };
  typical_unit_cost?: number;
  typical_unit_price?: number;
  supplier?: string;
  manufacturer?: string;
  color_options?: string[];
  warranty_years?: number;
}

export interface MaterialLineItem {
  sku: string;
  name: string;
  description: string;
  material_type: string;
  quantity: number;
  uom: UnitOfMeasure;
  unit_cost: number;
  unit_price: number;
  total_cost: number;
  total_price: number;
  coverage_sqft?: number;
  waste_factor?: number;
  dimensions_spec?: string;
  notes?: string[];
}

// ============================================================================
// Roofing Calculation Types
// ============================================================================

export interface RoofingCalculationInput {
  roof_area_sqft: number;
  pitch: string; // Format: "4/12", "6/12", etc.
  roof_type: RoofMaterialType;
  roof_complexity?: RoofComplexity;
  include_waste?: boolean;
  ridge_length_lf?: number;
  valley_length_lf?: number;
  eave_length_lf?: number;
  rake_length_lf?: number;
  penetrations?: number; // Number of vents, chimneys, etc.
  layers_to_remove?: number; // Number of old layers to tear off
}

export interface RoofingCalculationResult {
  calculation_summary: {
    input_area_sqft: number;
    pitch_multiplier: number;
    adjusted_area_sqft: number;
    base_squares: number;
    total_squares: number; // Including waste
    waste_factor: number;
    complexity: RoofComplexity;
  };
  materials: MaterialLineItem[];
  totals: {
    total_materials_count: number;
    total_cost: number;
    total_price: number;
    cost_per_square: number;
    price_per_square: number;
    margin_percent: number;
  };
  recommendations: string[];
  warnings: string[];
}

// ============================================================================
// Siding Calculation Types
// ============================================================================

export interface SidingCalculationInput {
  wall_area_sqft: number;
  siding_type: SidingMaterialType;
  complexity?: 'simple' | 'moderate' | 'complex';
  include_waste?: boolean;
  window_area_sqft?: number;
  door_area_sqft?: number;
  corners?: number; // Number of outside corners
  trim_lf?: number; // Linear feet of trim needed
  stories?: number;
}

export interface SidingCalculationResult {
  calculation_summary: {
    gross_area_sqft: number;
    deductions_sqft: number;
    net_area_sqft: number;
    waste_factor: number;
    total_area_with_waste: number;
  };
  materials: MaterialLineItem[];
  totals: {
    total_materials_count: number;
    total_cost: number;
    total_price: number;
    cost_per_sqft: number;
    price_per_sqft: number;
    margin_percent: number;
  };
  recommendations: string[];
  warnings: string[];
}

// ============================================================================
// Intelligent Estimation Types
// ============================================================================

export interface EstimationInput {
  job_id?: string;
  estimate_id?: string;
  scope_of_work?: string; // Free text description
  custom_fields?: Record<string, any>;
  confidence_threshold?: number; // 0-1, default 0.7
}

export interface MeasurementExtraction {
  source: 'custom_fields' | 'line_items' | 'text_parsing' | 'user_input';
  field_name: string;
  value: number | string;
  confidence: number; // 0-1
  raw_text?: string;
}

export interface EstimationResult {
  job_info: {
    job_id?: string;
    estimate_id?: string;
    job_type?: string;
  };
  extraction_results: {
    roof_area_sqft?: MeasurementExtraction[];
    pitch?: MeasurementExtraction[];
    wall_area_sqft?: MeasurementExtraction[];
    other_measurements?: MeasurementExtraction[];
  };
  confidence_score: number; // 0-1
  materials: MaterialLineItem[];
  requires_manual_review: boolean;
  review_reasons: string[];
  totals: {
    total_cost: number;
    total_price: number;
    margin_percent: number;
  };
}

// ============================================================================
// Waste Factor Analysis Types
// ============================================================================

export interface WasteFactorInput {
  material_type: string;
  job_complexity?: 'simple' | 'moderate' | 'complex';
  historical_data?: boolean; // Use historical waste data
  crew_experience?: 'beginner' | 'intermediate' | 'expert';
  weather_conditions?: 'ideal' | 'normal' | 'challenging';
}

export interface WasteFactorResult {
  material_type: string;
  recommended_waste_factor: number; // Decimal: 0.10 = 10%
  industry_standard: number;
  company_historical: number | null;
  adjustments_applied: {
    reason: string;
    adjustment: number; // Positive or negative
  }[];
  confidence_level: 'low' | 'medium' | 'high';
  recommendations: string[];
}

// ============================================================================
// Order Optimization Types
// ============================================================================

export interface OrderOptimizationInput {
  materials: MaterialLineItem[];
  include_bulk_discounts?: boolean;
  preferred_suppliers?: string[];
  delivery_urgency?: 'standard' | 'rush' | 'next_day';
  budget_constraints?: {
    max_total_cost?: number;
    max_per_item_cost?: number;
  };
}

export interface BulkDiscountTier {
  min_quantity: number;
  discount_percent: number;
  description: string;
}

export interface PackagingRule {
  sku: string;
  units_per_package: number;
  min_order_quantity: number;
  package_uom: UnitOfMeasure;
}

export interface OrderOptimizationResult {
  optimized_materials: {
    original: MaterialLineItem;
    optimized: MaterialLineItem;
    savings: number;
    discount_applied?: BulkDiscountTier;
    packaging_adjustment?: {
      requested_qty: number;
      actual_qty: number;
      reason: string;
    };
  }[];
  totals: {
    original_cost: number;
    optimized_cost: number;
    total_savings: number;
    savings_percent: number;
  };
  supplier_recommendations: {
    supplier_name: string;
    materials_count: number;
    total_cost: number;
    estimated_delivery: string;
    reliability_score: number;
  }[];
  recommendations: string[];
}

// ============================================================================
// Material Comparison Types
// ============================================================================

export interface MaterialComparisonInput {
  base_material: string | MaterialSpecification;
  compare_to?: string[]; // SKUs or material names
  criteria?: ('cost' | 'quality' | 'durability' | 'availability')[];
  job_requirements?: {
    min_warranty_years?: number;
    max_weight_per_sqft?: number;
    color?: string;
  };
}

export interface MaterialAlternative {
  spec: MaterialSpecification;
  similarity_score: number; // 0-1
  cost_comparison: {
    cost_difference: number;
    cost_difference_percent: number;
    is_cheaper: boolean;
  };
  quality_rating: number; // 0-10
  pros: string[];
  cons: string[];
  recommendation: 'highly_recommended' | 'recommended' | 'acceptable' | 'not_recommended';
}

export interface MaterialComparisonResult {
  base_material: MaterialSpecification;
  alternatives: MaterialAlternative[];
  best_value: MaterialAlternative | null;
  best_quality: MaterialAlternative | null;
  best_budget: MaterialAlternative | null;
  summary: string;
}

// ============================================================================
// Error Types
// ============================================================================

export class CalculationError extends Error {
  constructor(
    message: string,
    public code: CalculationErrorCode,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'CalculationError';
  }
}

export enum CalculationErrorCode {
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_PITCH = 'INVALID_PITCH',
  INVALID_MATERIAL_TYPE = 'INVALID_MATERIAL_TYPE',
  INSUFFICIENT_DATA = 'INSUFFICIENT_DATA',
  CALCULATION_OVERFLOW = 'CALCULATION_OVERFLOW',
  SPEC_NOT_FOUND = 'SPEC_NOT_FOUND',
  API_ERROR = 'API_ERROR'
}
