/**
 * Additional Costs Constants
 * Non-material, non-labor costs for construction projects
 * Includes dumpsters, disposal, equipment rental, protection, and miscellaneous
 */

import type { JobType } from '../types/calculations.types.js';

// ============================================================================
// Dumpster Rental Costs
// ============================================================================

/**
 * Dumpster rental costs by size (Connecticut pricing, 2024/2025)
 * Includes delivery, pickup, and 7-day rental period
 */
export const DUMPSTER_COSTS = {
  '10_yard': {
    size_description: '10 cubic yards (12\' x 8\' x 4\')',
    capacity_sqft: 1000, // Suitable for projects up to 1000 sqft
    rental_cost: 300,
    weight_limit_tons: 2,
    overage_cost_per_ton: 75,
    typical_use: 'Small roof or siding job, 1-2 rooms',
    dimensions: '12\' L x 8\' W x 4\' H'
  },
  '20_yard': {
    size_description: '20 cubic yards (22\' x 8\' x 4\')',
    capacity_sqft: 2500, // Suitable for projects up to 2500 sqft
    rental_cost: 400,
    weight_limit_tons: 3,
    overage_cost_per_ton: 75,
    typical_use: 'Medium roof or siding job, 3-4 rooms',
    dimensions: '22\' L x 8\' W x 4\' H'
  },
  '30_yard': {
    size_description: '30 cubic yards (22\' x 8\' x 6\')',
    capacity_sqft: 4000, // Suitable for projects up to 4000 sqft
    rental_cost: 500,
    weight_limit_tons: 4,
    overage_cost_per_ton: 75,
    typical_use: 'Large roof or full house siding, 5+ rooms',
    dimensions: '22\' L x 8\' W x 6\' H'
  },
  '40_yard': {
    size_description: '40 cubic yards (22\' x 8\' x 8\')',
    capacity_sqft: 6000, // Suitable for projects up to 6000 sqft
    rental_cost: 650,
    weight_limit_tons: 5,
    overage_cost_per_ton: 75,
    typical_use: 'Very large project, commercial, or multi-unit',
    dimensions: '22\' L x 8\' W x 8\' H'
  }
};

/**
 * Additional dumpster fees
 */
export const DUMPSTER_ADDITIONAL_FEES = {
  extended_rental: {
    cost_per_day: 15,
    description: 'Fee for each day beyond initial 7-day period'
  },
  placement_difficulty: {
    cost: 50,
    description: 'Additional fee for difficult placement (tight spaces, long driveway)'
  },
  permit_fee: {
    cost: 50,
    description: 'Required if dumpster placed on public street',
    required_when: 'Street placement in most CT municipalities'
  },
  hazardous_materials: {
    multiplier: 2.0,
    description: 'Double fee for hazardous material disposal'
  }
};

// ============================================================================
// Disposal & Dump Fees
// ============================================================================

/**
 * Material disposal costs by type (per ton)
 * Connecticut landfill and transfer station fees
 */
export const DISPOSAL_COSTS = {
  general_construction_debris: {
    cost_per_ton: 80,
    description: 'General construction and demolition debris',
    typical_materials: ['Wood', 'Drywall', 'Insulation', 'General waste']
  },
  roofing_shingles: {
    cost_per_ton: 65,
    description: 'Asphalt roofing shingles',
    typical_materials: ['Asphalt shingles', 'Underlayment'],
    notes: 'Lower cost due to recycling programs'
  },
  metal_roofing: {
    cost_per_ton: -50, // Negative = revenue from scrap
    description: 'Metal roofing materials (scrap value)',
    typical_materials: ['Steel', 'Aluminum', 'Copper'],
    notes: 'Can generate revenue from scrap metal dealers'
  },
  vinyl_siding: {
    cost_per_ton: 85,
    description: 'Vinyl siding and trim',
    typical_materials: ['Vinyl siding', 'PVC trim']
  },
  wood_siding: {
    cost_per_ton: 70,
    description: 'Wood siding and trim',
    typical_materials: ['Wood siding', 'Wood trim', 'Plywood']
  },
  windows_doors: {
    cost_per_ton: 90,
    description: 'Old windows and doors',
    typical_materials: ['Glass', 'Vinyl frames', 'Wood frames', 'Hardware']
  },
  concrete_masonry: {
    cost_per_ton: 50,
    description: 'Concrete and masonry materials',
    typical_materials: ['Concrete', 'Brick', 'Block', 'Stone'],
    notes: 'Often recycled into aggregate'
  },
  hazardous_materials: {
    cost_per_ton: 250,
    description: 'Hazardous material disposal',
    typical_materials: ['Asbestos', 'Lead paint', 'Chemical waste'],
    notes: 'Requires special handling and certified disposal'
  }
};

/**
 * Material weight estimates (pounds per unit)
 */
export const MATERIAL_WEIGHT_ESTIMATES = {
  roofing: {
    architectural_shingles_per_square: 250, // lbs per 100 sqft
    tab3_shingles_per_square: 200, // 3-tab shingles
    underlayment_per_square: 30,
    old_roof_layers_multiplier: 1.0,
    total_weight_per_square: 280 // Average with all materials
  },
  siding: {
    vinyl_per_100sqft: 85,
    fiber_cement_per_100sqft: 200,
    wood_per_100sqft: 150,
    trim_per_lf: 2
  },
  windows: {
    standard_window_unit: 50,
    large_window_unit: 80,
    bay_window_unit: 150
  },
  doors: {
    interior_door: 50,
    exterior_door: 80,
    sliding_door: 150
  }
};

// ============================================================================
// Equipment Rental Costs
// ============================================================================

/**
 * Equipment rental costs (Connecticut rates, 2024/2025)
 */
export const EQUIPMENT_RENTAL_COSTS = {
  scaffolding: {
    cost_per_day: 75,
    cost_per_week: 300,
    cost_per_month: 900,
    setup_fee: 200,
    description: 'Frame scaffolding with platforms',
    typical_use: 'Multi-story buildings, difficult roof access',
    unit: 'Per section (5\' x 7\' x 6.5\')'
  },
  aerial_lift: {
    cost_per_day: 250,
    cost_per_week: 1000,
    cost_per_month: 3000,
    delivery_fee: 150,
    description: 'Boom lift or scissor lift',
    typical_use: 'High buildings, commercial work',
    unit: 'Per lift (30-40\' reach)'
  },
  ladder_jacks: {
    cost_per_day: 40,
    cost_per_week: 150,
    description: 'Ladder jack system with planks',
    typical_use: 'Simple 2-story siding or painting'
  },
  roofing_jack_system: {
    cost_per_day: 30,
    cost_per_week: 100,
    description: 'Roof jacks and planks',
    typical_use: 'Steep roof work'
  },
  compressor_nail_guns: {
    cost_per_day: 60,
    cost_per_week: 200,
    description: 'Air compressor and roofing nailers',
    typical_use: 'Roofing and siding installation'
  },
  power_tools: {
    cost_per_day: 40,
    cost_per_week: 125,
    description: 'Circular saw, miter saw, drills, etc.',
    typical_use: 'All construction work'
  },
  material_hoist: {
    cost_per_day: 100,
    cost_per_week: 400,
    description: 'Electric material hoist',
    typical_use: 'Multi-story material delivery'
  },
  roofing_conveyor: {
    cost_per_day: 150,
    cost_per_week: 500,
    description: 'Shingle conveyor belt',
    typical_use: 'Large roofing jobs, reduces labor'
  },
  dumpster_crane: {
    cost_per_use: 300,
    description: 'Crane service for dumpster placement',
    typical_use: 'Difficult access locations'
  }
};

// ============================================================================
// Protection & Safety Costs
// ============================================================================

/**
 * Protection materials and safety equipment costs
 */
export const PROTECTION_COSTS = {
  ground_protection: {
    cost_per_100sqft: 50,
    description: 'Tarps, plywood, or protective sheeting for landscaping, driveway, deck',
    typical_use: 'Protect valuable surfaces during work'
  },
  window_protection: {
    cost_per_window: 5,
    description: 'Plastic or cardboard window protection',
    typical_use: 'Protect windows during exterior work'
  },
  dust_barriers: {
    cost_per_100sqft: 30,
    description: 'Plastic sheeting and zipper doors for interior work',
    typical_use: 'Contain dust during interior demolition'
  },
  roof_tarp: {
    cost_per_square: 15,
    description: 'Emergency roof tarps',
    typical_use: 'Protect open roof during multi-day projects or weather delays'
  },
  safety_equipment: {
    fall_protection_per_worker: 200,
    first_aid_kit: 50,
    fire_extinguisher: 40,
    description: 'Personal protective equipment, harnesses, ropes, anchors'
  },
  temporary_fencing: {
    cost_per_10ft_section: 25,
    cost_per_day: 5,
    description: 'Temporary construction fencing',
    typical_use: 'Secure work area, protect pedestrians'
  }
};

// ============================================================================
// Miscellaneous Costs
// ============================================================================

/**
 * Other miscellaneous costs that may apply
 */
export const MISCELLANEOUS_COSTS = {
  temporary_utilities: {
    electricity_per_month: 150,
    water_per_month: 75,
    portable_toilet_per_month: 150,
    description: 'Temporary utility hookups and facilities'
  },
  fuel_surcharge: {
    percentage_of_materials: 0.03, // 3% of material costs
    description: 'Fuel surcharge for material delivery and job site travel'
  },
  cleanup_supplies: {
    cost_per_job: 75,
    description: 'Brooms, bags, cleaning supplies, magnetic sweeper'
  },
  signage: {
    yard_sign: 50,
    banner: 150,
    description: 'Job site signage for marketing'
  },
  photography: {
    before_after_photos: 100,
    drone_photos: 250,
    description: 'Professional photography for marketing'
  },
  porta_potty: {
    cost_per_week: 150,
    cost_per_month: 450,
    delivery_fee: 75,
    description: 'Portable toilet rental'
  },
  storage_container: {
    cost_per_month: 150,
    delivery_fee: 100,
    description: '20\' storage container for tools and materials'
  }
};

// ============================================================================
// Job-Type Specific Additional Costs
// ============================================================================

/**
 * Typical additional costs by job type
 */
export const TYPICAL_ADDITIONAL_COSTS_BY_JOB: Record<JobType, {
  dumpster_required: boolean;
  typical_dumpster_size: keyof typeof DUMPSTER_COSTS | null;
  equipment_needed: string[];
  protection_needed: string[];
  estimated_additional_cost_percentage: number; // % of material+labor
  notes: string;
}> = {
  roofing: {
    dumpster_required: true,
    typical_dumpster_size: '20_yard',
    equipment_needed: ['Roofing jack system', 'Compressor and nail guns', 'Ladder jacks'],
    protection_needed: ['Ground protection', 'Roof tarp (weather contingency)'],
    estimated_additional_cost_percentage: 0.08, // 8% of material+labor
    notes: 'Roofing generates significant debris; dumpster is essential'
  },
  siding: {
    dumpster_required: true,
    typical_dumpster_size: '30_yard',
    equipment_needed: ['Scaffolding or ladder jacks', 'Compressor and nail guns'],
    protection_needed: ['Ground protection', 'Window protection'],
    estimated_additional_cost_percentage: 0.10, // 10% of material+labor
    notes: 'Full siding replacement generates large volume of debris'
  },
  windows: {
    dumpster_required: false,
    typical_dumpster_size: null,
    equipment_needed: ['Ladder', 'Power tools'],
    protection_needed: ['Ground protection', 'Interior floor protection'],
    estimated_additional_cost_percentage: 0.04, // 4% of material+labor
    notes: 'Window debris is minimal; can use pickup truck for disposal'
  },
  doors: {
    dumpster_required: false,
    typical_dumpster_size: null,
    equipment_needed: ['Power tools', 'Ladder'],
    protection_needed: ['Floor protection'],
    estimated_additional_cost_percentage: 0.03, // 3% of material+labor
    notes: 'Minimal debris; typically hauled away in work vehicle'
  },
  gutters: {
    dumpster_required: false,
    typical_dumpster_size: null,
    equipment_needed: ['Ladder', 'Gutter machine (if seamless)'],
    protection_needed: ['Ground protection'],
    estimated_additional_cost_percentage: 0.05, // 5% of material+labor
    notes: 'Old gutters minimal waste; can be recycled if metal'
  },
  general_construction: {
    dumpster_required: true,
    typical_dumpster_size: '30_yard',
    equipment_needed: ['Scaffolding', 'Power tools', 'Material hoist'],
    protection_needed: ['Ground protection', 'Dust barriers', 'Window protection'],
    estimated_additional_cost_percentage: 0.12, // 12% of material+labor
    notes: 'Varies widely depending on scope; plan for contingency'
  }
};

// ============================================================================
// Access & Logistics Costs
// ============================================================================

/**
 * Additional costs based on site access and logistics
 */
export const ACCESS_LOGISTICS_COSTS = {
  difficult_access: {
    premium_percentage: 0.15, // 15% premium
    description: 'Difficult site access requiring extra time/equipment',
    examples: ['Steep driveway', 'No driveway access', 'Gated community', 'Urban location']
  },
  high_elevation: {
    cost_per_story_over_2: 200,
    description: 'Additional cost for buildings over 2 stories',
    notes: 'Requires additional safety equipment and slower work pace'
  },
  limited_parking: {
    parking_permit_cost: 100,
    description: 'Cost to obtain parking permits in urban areas'
  },
  hoa_requirements: {
    application_fee: 150,
    description: 'HOA application and approval fee',
    notes: 'Some HOAs charge review fees for exterior modifications'
  },
  historic_district: {
    application_fee: 200,
    consultant_fee: 500,
    description: 'Historic district approval process',
    notes: 'May require architectural review and special materials'
  }
};

// ============================================================================
// Insurance & Bonding Costs
// ============================================================================

/**
 * Insurance and bonding costs (typically built into overhead, but listed for reference)
 */
export const INSURANCE_BONDING_COSTS = {
  performance_bond: {
    percentage_of_contract: 0.01, // 1% for contracts under $100k
    minimum_cost: 500,
    description: 'Performance bond (may be required for commercial or municipal projects)'
  },
  builders_risk_insurance: {
    percentage_of_project_value: 0.005, // 0.5%
    description: 'Builders risk insurance for project duration'
  },
  additional_insured_certificate: {
    cost: 50,
    description: 'Certificate naming customer as additional insured'
  }
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Recommend dumpster size based on project area
 */
export function recommendDumpsterSize(jobType: JobType, area_sqft: number): keyof typeof DUMPSTER_COSTS | null {
  const jobDefaults = TYPICAL_ADDITIONAL_COSTS_BY_JOB[jobType];

  if (!jobDefaults.dumpster_required) return null;

  // Size based on area
  if (area_sqft <= 1000) return '10_yard';
  if (area_sqft <= 2500) return '20_yard';
  if (area_sqft <= 4000) return '30_yard';
  return '40_yard';
}

/**
 * Calculate disposal weight based on job type and area
 */
export function estimateDisposalWeight(jobType: JobType, area_sqft: number, layers: number = 1): number {
  const weights = MATERIAL_WEIGHT_ESTIMATES;

  switch (jobType) {
    case 'roofing':
      const squares = area_sqft / 100;
      return (weights.roofing.total_weight_per_square * squares * layers) / 2000; // Convert to tons

    case 'siding':
      return (weights.siding.vinyl_per_100sqft * (area_sqft / 100)) / 2000;

    case 'windows':
    case 'doors':
    case 'gutters':
      return 0.25; // Minimal waste (0.25 tons)

    default:
      return 1.0; // Default 1 ton for unknown types
  }
}

/**
 * Calculate total additional costs for a job
 */
export function estimateAdditionalCosts(
  jobType: JobType,
  area_sqft: number,
  materialLaborCost: number,
  options: {
    stories?: number;
    layers?: number;
    difficult_access?: boolean;
    rental_days?: number;
  } = {}
): number {
  const jobDefaults = TYPICAL_ADDITIONAL_COSTS_BY_JOB[jobType];

  // Base estimate: percentage of material+labor
  let totalCost = materialLaborCost * jobDefaults.estimated_additional_cost_percentage;

  // Add dumpster if required
  if (jobDefaults.dumpster_required) {
    const dumpsterSize = recommendDumpsterSize(jobType, area_sqft);
    if (dumpsterSize) {
      totalCost += DUMPSTER_COSTS[dumpsterSize].rental_cost;

      // Check for weight overage
      const estimatedWeight = estimateDisposalWeight(jobType, area_sqft, options.layers || 1);
      const dumpsterWeight = DUMPSTER_COSTS[dumpsterSize].weight_limit_tons;
      if (estimatedWeight > dumpsterWeight) {
        const overage = estimatedWeight - dumpsterWeight;
        totalCost += overage * DUMPSTER_COSTS[dumpsterSize].overage_cost_per_ton;
      }
    }
  }

  // Add story premium
  if (options.stories && options.stories > 2) {
    const extraStories = options.stories - 2;
    totalCost += extraStories * ACCESS_LOGISTICS_COSTS.high_elevation.cost_per_story_over_2;
  }

  // Add difficult access premium
  if (options.difficult_access) {
    totalCost += materialLaborCost * ACCESS_LOGISTICS_COSTS.difficult_access.premium_percentage;
  }

  return Math.round(totalCost);
}
