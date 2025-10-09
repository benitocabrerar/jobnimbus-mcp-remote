/**
 * Waste Factor Constants
 * Industry-standard waste factors by material type and complexity
 */

import type { RoofComplexity, RoofMaterialType, SidingMaterialType } from '../types/calculations.types.js';

// ============================================================================
// Roofing Waste Factors
// ============================================================================

/**
 * Roofing waste factors by complexity level
 * Decimal format: 0.10 = 10% waste
 */
export const ROOFING_WASTE_FACTORS: Record<RoofComplexity, Record<string, number>> = {
  simple: {
    shingles: 0.10,           // 10% waste
    underlayment: 0.15,       // 15% waste (overlap)
    ice_and_water: 0.10,      // 10% waste
    drip_edge: 0.05,          // 5% waste
    ridge_cap: 0.10,          // 10% waste
    starter: 0.05,            // 5% waste
    valley_flashing: 0.10,    // 10% waste
    metal: 0.08,              // 8% waste
    tile: 0.12,               // 12% waste (breakage)
    slate: 0.15               // 15% waste (breakage)
  },
  moderate: {
    shingles: 0.15,           // 15% waste
    underlayment: 0.20,       // 20% waste
    ice_and_water: 0.15,      // 15% waste
    drip_edge: 0.10,          // 10% waste
    ridge_cap: 0.15,          // 15% waste
    starter: 0.10,            // 10% waste
    valley_flashing: 0.15,    // 15% waste
    metal: 0.12,              // 12% waste
    tile: 0.18,               // 18% waste
    slate: 0.20               // 20% waste
  },
  complex: {
    shingles: 0.20,           // 20% waste
    underlayment: 0.25,       // 25% waste
    ice_and_water: 0.20,      // 20% waste
    drip_edge: 0.15,          // 15% waste
    ridge_cap: 0.20,          // 20% waste
    starter: 0.15,            // 15% waste
    valley_flashing: 0.20,    // 20% waste
    metal: 0.15,              // 15% waste
    tile: 0.25,               // 25% waste
    slate: 0.30               // 30% waste
  }
};

/**
 * Get waste factor for roofing material
 * @param material_type Type of roofing material
 * @param complexity Roof complexity level
 * @returns Waste factor as decimal (0.10 = 10%)
 */
export function getRoofingWasteFactor(
  material_type: RoofMaterialType | string,
  complexity: RoofComplexity = 'moderate'
): number {
  // Map material type to waste category
  const wasteCategory = mapMaterialToWasteCategory(material_type);

  // Get waste factor from lookup table
  const wasteFactor = ROOFING_WASTE_FACTORS[complexity][wasteCategory];

  if (wasteFactor === undefined) {
    console.warn(`Unknown waste category: ${wasteCategory}, using default 15%`);
    return 0.15;
  }

  return wasteFactor;
}

/**
 * Map material type to waste category
 */
function mapMaterialToWasteCategory(material_type: string): string {
  const lowerType = material_type.toLowerCase();

  if (lowerType.includes('shingle')) return 'shingles';
  if (lowerType.includes('underlayment')) return 'underlayment';
  if (lowerType.includes('ice') || lowerType.includes('water')) return 'ice_and_water';
  if (lowerType.includes('drip')) return 'drip_edge';
  if (lowerType.includes('ridge')) return 'ridge_cap';
  if (lowerType.includes('starter')) return 'starter';
  if (lowerType.includes('valley')) return 'valley_flashing';
  if (lowerType.includes('metal')) return 'metal';
  if (lowerType.includes('tile')) return 'tile';
  if (lowerType.includes('slate')) return 'slate';

  return 'shingles'; // Default category
}

// ============================================================================
// Siding Waste Factors
// ============================================================================

/**
 * Siding waste factors by complexity and material type
 */
export const SIDING_WASTE_FACTORS: Record<string, Record<SidingMaterialType | string, number>> = {
  simple: {
    vinyl_horizontal: 0.10,
    vinyl_vertical: 0.12,
    fiber_cement: 0.15,
    wood_lap: 0.15,
    metal_panels: 0.10,
    brick_veneer: 0.05,
    stucco: 0.10
  },
  moderate: {
    vinyl_horizontal: 0.15,
    vinyl_vertical: 0.18,
    fiber_cement: 0.20,
    wood_lap: 0.20,
    metal_panels: 0.15,
    brick_veneer: 0.08,
    stucco: 0.15
  },
  complex: {
    vinyl_horizontal: 0.20,
    vinyl_vertical: 0.25,
    fiber_cement: 0.25,
    wood_lap: 0.25,
    metal_panels: 0.20,
    brick_veneer: 0.12,
    stucco: 0.20
  }
};

/**
 * Get waste factor for siding material
 */
export function getSidingWasteFactor(
  material_type: SidingMaterialType | string,
  complexity: 'simple' | 'moderate' | 'complex' = 'moderate'
): number {
  const wasteFactor = SIDING_WASTE_FACTORS[complexity][material_type];

  if (wasteFactor === undefined) {
    console.warn(`Unknown siding type: ${material_type}, using default 15%`);
    return 0.15;
  }

  return wasteFactor;
}

// ============================================================================
// Experience Adjustments
// ============================================================================

/**
 * Crew experience adjustments to base waste factors
 * Positive = increase waste, Negative = decrease waste
 */
export const CREW_EXPERIENCE_ADJUSTMENTS: Record<string, number> = {
  beginner: 0.05,      // +5% more waste
  intermediate: 0.00,  // No adjustment
  expert: -0.03        // -3% less waste
};

/**
 * Weather condition adjustments
 */
export const WEATHER_ADJUSTMENTS: Record<string, number> = {
  ideal: -0.02,        // -2% less waste
  normal: 0.00,        // No adjustment
  challenging: 0.05    // +5% more waste
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate adjusted waste factor with experience and weather
 */
export function getAdjustedWasteFactor(
  base_waste_factor: number,
  crew_experience?: 'beginner' | 'intermediate' | 'expert',
  weather_conditions?: 'ideal' | 'normal' | 'challenging'
): number {
  let adjusted = base_waste_factor;

  if (crew_experience) {
    adjusted += CREW_EXPERIENCE_ADJUSTMENTS[crew_experience] || 0;
  }

  if (weather_conditions) {
    adjusted += WEATHER_ADJUSTMENTS[weather_conditions] || 0;
  }

  // Ensure waste factor is at least 5% and at most 50%
  return Math.max(0.05, Math.min(0.50, adjusted));
}

/**
 * Get complexity level from job characteristics
 */
export function determineComplexity(characteristics: {
  valleys?: number;
  penetrations?: number;
  stories?: number;
  corners?: number;
}): RoofComplexity | 'simple' | 'moderate' | 'complex' {
  let complexity_score = 0;

  // Valleys add complexity
  if (characteristics.valleys && characteristics.valleys > 0) {
    complexity_score += characteristics.valleys;
  }

  // Penetrations add complexity
  if (characteristics.penetrations && characteristics.penetrations > 5) {
    complexity_score += Math.floor((characteristics.penetrations - 5) / 2);
  }

  // Multi-story adds complexity
  if (characteristics.stories && characteristics.stories > 1) {
    complexity_score += (characteristics.stories - 1) * 2;
  }

  // Many corners add complexity
  if (characteristics.corners && characteristics.corners > 8) {
    complexity_score += Math.floor((characteristics.corners - 8) / 3);
  }

  // Classify based on score
  if (complexity_score === 0) return 'simple';
  if (complexity_score <= 3) return 'moderate';
  return 'complex';
}
