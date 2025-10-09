/**
 * Roofing Industry Constants
 * Pitch multipliers, material specifications, and coverage calculations
 */

import type { MaterialSpecification, RoofMaterialType } from '../types/calculations.types.js';

// ============================================================================
// Pitch Multipliers (Industry Standard)
// ============================================================================

/**
 * Pitch multiplier lookup table
 * Used to adjust flat area to actual sloped roof area
 * Source: National Roofing Contractors Association (NRCA)
 */
export const PITCH_MULTIPLIERS: Record<string, number> = {
  'flat': 1.000,
  '0/12': 1.000,
  '1/12': 1.003,
  '2/12': 1.014,
  '3/12': 1.031,
  '4/12': 1.054,
  '5/12': 1.083,
  '6/12': 1.118,
  '7/12': 1.158,
  '8/12': 1.202,
  '9/12': 1.250,
  '10/12': 1.302,
  '11/12': 1.357,
  '12/12': 1.414,
  '13/12': 1.474,
  '14/12': 1.537,
  '15/12': 1.601,
  '16/12': 1.667,
  '17/12': 1.734,
  '18/12': 1.803,
};

/**
 * Helper function to get pitch multiplier
 * Handles various input formats
 */
export function getPitchMultiplier(pitch: string): number {
  // Normalize pitch string
  const normalized = pitch.toLowerCase().trim().replace(/\s+/g, '');

  // Direct lookup
  if (PITCH_MULTIPLIERS[normalized]) {
    return PITCH_MULTIPLIERS[normalized];
  }

  // Try parsing as "X/12" or "X:12"
  const match = normalized.match(/^(\d+)(?:[/:])12$/);
  if (match) {
    const key = `${match[1]}/12`;
    return PITCH_MULTIPLIERS[key] || 1.000;
  }

  // Default to flat
  console.warn(`Unknown pitch format: ${pitch}, defaulting to flat (1.000)`);
  return 1.000;
}

// ============================================================================
// Roofing Material Specifications
// ============================================================================

export const ROOFING_MATERIAL_SPECS: Record<RoofMaterialType, MaterialSpecification> = {
  'architectural_shingles': {
    sku: 'SHNG-ARCH-001',
    name: 'Architectural Shingles - Premium Grade',
    material_type: 'architectural_shingles',
    coverage_per_unit: 33.33, // sq ft per bundle (100 sqft / 3 bundles)
    uom: 'bundle',
    weight_per_unit: 78, // lbs per bundle
    dimensions: {
      length: 36,
      width: 13,
      unit: 'inches'
    },
    typical_unit_cost: 95.00,
    typical_unit_price: 142.50,
    warranty_years: 30
  },
  '3tab_shingles': {
    sku: 'SHNG-3TAB-001',
    name: '3-Tab Shingles - Standard Grade',
    material_type: '3tab_shingles',
    coverage_per_unit: 33.33,
    uom: 'bundle',
    weight_per_unit: 60,
    dimensions: {
      length: 36,
      width: 12,
      unit: 'inches'
    },
    typical_unit_cost: 65.00,
    typical_unit_price: 97.50,
    warranty_years: 20
  },
  'metal_standing_seam': {
    sku: 'MTL-SS-001',
    name: 'Metal Standing Seam - Aluminum',
    material_type: 'metal_standing_seam',
    coverage_per_unit: 100, // sq ft per panel
    uom: 'sheet',
    weight_per_unit: 45,
    dimensions: {
      width: 16,
      unit: 'inches'
    },
    typical_unit_cost: 425.00,
    typical_unit_price: 637.50,
    warranty_years: 50
  },
  'metal_corrugated': {
    sku: 'MTL-CORR-001',
    name: 'Corrugated Metal Panel - Galvalume',
    material_type: 'metal_corrugated',
    coverage_per_unit: 100,
    uom: 'sheet',
    weight_per_unit: 38,
    dimensions: {
      width: 26,
      unit: 'inches'
    },
    typical_unit_cost: 185.00,
    typical_unit_price: 277.50,
    warranty_years: 40
  },
  'tile_concrete': {
    sku: 'TILE-CONC-001',
    name: 'Concrete Tile - Standard Profile',
    material_type: 'tile_concrete',
    coverage_per_unit: 1.0, // sq ft per tile
    uom: 'piece',
    weight_per_unit: 10,
    dimensions: {
      length: 16,
      width: 12,
      unit: 'inches'
    },
    typical_unit_cost: 3.50,
    typical_unit_price: 5.25,
    warranty_years: 50
  },
  'tile_clay': {
    sku: 'TILE-CLAY-001',
    name: 'Clay Tile - Mediterranean Style',
    material_type: 'tile_clay',
    coverage_per_unit: 1.0,
    uom: 'piece',
    weight_per_unit: 12,
    dimensions: {
      length: 16,
      width: 10,
      unit: 'inches'
    },
    typical_unit_cost: 5.00,
    typical_unit_price: 7.50,
    warranty_years: 100
  },
  'slate': {
    sku: 'SLATE-NAT-001',
    name: 'Natural Slate - Premium',
    material_type: 'slate',
    coverage_per_unit: 1.0,
    uom: 'piece',
    weight_per_unit: 15,
    dimensions: {
      length: 24,
      width: 12,
      unit: 'inches'
    },
    typical_unit_cost: 12.00,
    typical_unit_price: 18.00,
    warranty_years: 100
  },
  'flat_membrane_tpo': {
    sku: 'FLAT-TPO-001',
    name: 'TPO Membrane - 60 mil White',
    material_type: 'flat_membrane_tpo',
    coverage_per_unit: 100, // sq ft per roll
    uom: 'roll',
    weight_per_unit: 75,
    dimensions: {
      width: 10,
      length: 10,
      unit: 'feet'
    },
    typical_unit_cost: 180.00,
    typical_unit_price: 270.00,
    warranty_years: 20
  },
  'flat_membrane_epdm': {
    sku: 'FLAT-EPDM-001',
    name: 'EPDM Membrane - 60 mil Black',
    material_type: 'flat_membrane_epdm',
    coverage_per_unit: 100,
    uom: 'roll',
    weight_per_unit: 80,
    dimensions: {
      width: 10,
      length: 10,
      unit: 'feet'
    },
    typical_unit_cost: 150.00,
    typical_unit_price: 225.00,
    warranty_years: 25
  }
};

// ============================================================================
// Accessory Material Specifications
// ============================================================================

export const ROOFING_ACCESSORIES: Record<string, MaterialSpecification> = {
  'underlayment_felt_15lb': {
    sku: 'UND-FELT-15',
    name: '15lb Felt Underlayment',
    material_type: 'underlayment',
    coverage_per_unit: 400, // sq ft per roll (4' x 100')
    uom: 'roll',
    weight_per_unit: 60,
    dimensions: {
      width: 4,
      length: 100,
      unit: 'feet'
    },
    typical_unit_cost: 45.00,
    typical_unit_price: 67.50
  },
  'underlayment_synthetic': {
    sku: 'UND-SYNTH-001',
    name: 'Synthetic Underlayment',
    material_type: 'underlayment',
    coverage_per_unit: 1000, // sq ft per roll (4' x 250')
    uom: 'roll',
    weight_per_unit: 55,
    dimensions: {
      width: 4,
      length: 250,
      unit: 'feet'
    },
    typical_unit_cost: 120.00,
    typical_unit_price: 180.00
  },
  'ice_and_water_shield': {
    sku: 'ICE-WATER-001',
    name: 'Ice & Water Shield',
    material_type: 'ice_and_water',
    coverage_per_unit: 200, // sq ft per roll (2' x 100')
    uom: 'roll',
    weight_per_unit: 75,
    dimensions: {
      width: 2,
      length: 100,
      unit: 'feet'
    },
    typical_unit_cost: 125.00,
    typical_unit_price: 187.50
  },
  'drip_edge_aluminum': {
    sku: 'DRIP-ALU-001',
    name: 'Aluminum Drip Edge - 2"',
    material_type: 'drip_edge',
    coverage_per_unit: 10, // linear feet per piece
    uom: 'piece',
    weight_per_unit: 1.5,
    dimensions: {
      length: 10,
      unit: 'feet'
    },
    typical_unit_cost: 8.50,
    typical_unit_price: 12.75
  },
  'ridge_cap_shingles': {
    sku: 'RIDGE-CAP-001',
    name: 'Ridge Cap Shingles',
    material_type: 'ridge_cap',
    coverage_per_unit: 20, // linear feet per bundle
    uom: 'bundle',
    weight_per_unit: 25,
    typical_unit_cost: 55.00,
    typical_unit_price: 82.50
  },
  'starter_strip': {
    sku: 'START-STRIP-001',
    name: 'Starter Strip Shingles',
    material_type: 'starter',
    coverage_per_unit: 100, // linear feet per roll
    uom: 'roll',
    weight_per_unit: 35,
    typical_unit_cost: 65.00,
    typical_unit_price: 97.50
  },
  'valley_flashing': {
    sku: 'VALLEY-FLASH-001',
    name: 'Valley Flashing - 24" Aluminum',
    material_type: 'valley_flashing',
    coverage_per_unit: 50, // linear feet per roll
    uom: 'roll',
    weight_per_unit: 20,
    dimensions: {
      width: 24,
      length: 50,
      unit: 'feet'
    },
    typical_unit_cost: 85.00,
    typical_unit_price: 127.50
  },
  'roofing_nails_coil': {
    sku: 'NAIL-COIL-001',
    name: 'Coil Roofing Nails - 1.25"',
    material_type: 'nails',
    coverage_per_unit: 7200, // nails per box (120 nails per pound, 60 lbs per box)
    uom: 'box',
    weight_per_unit: 60,
    typical_unit_cost: 95.00,
    typical_unit_price: 142.50
  },
  'pipe_boot': {
    sku: 'BOOT-PIPE-001',
    name: 'Rubber Pipe Boot - Standard',
    material_type: 'penetration',
    coverage_per_unit: 1,
    uom: 'piece',
    weight_per_unit: 2,
    typical_unit_cost: 12.00,
    typical_unit_price: 18.00
  }
};

// ============================================================================
// Calculation Helpers
// ============================================================================

/**
 * Calculate bundles needed for shingles
 * @param squares Total roofing squares (including waste)
 * @returns Number of bundles needed (rounded up)
 */
export function calculateShingleBundles(squares: number): number {
  return Math.ceil(squares * 3); // 3 bundles per square
}

/**
 * Calculate rolls needed for underlayment
 * @param area_sqft Total area in square feet
 * @param coverage_per_roll Coverage per roll in sq ft
 * @returns Number of rolls needed (rounded up)
 */
export function calculateRolls(area_sqft: number, coverage_per_roll: number): number {
  return Math.ceil(area_sqft / coverage_per_roll);
}

/**
 * Calculate linear feet material needed
 * @param length_lf Linear feet needed
 * @param coverage_per_unit Coverage per unit in linear feet
 * @returns Number of units needed (rounded up)
 */
export function calculateLinearMaterial(length_lf: number, coverage_per_unit: number): number {
  return Math.ceil(length_lf / coverage_per_unit);
}
