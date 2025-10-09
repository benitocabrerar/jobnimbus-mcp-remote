/**
 * Permit Fees Constants
 * Connecticut permit fees and regulatory requirements
 * Based on 2024/2025 Connecticut state and local building codes
 */

import type { JobType } from '../types/calculations.types.js';

// ============================================================================
// Connecticut Base Permit Fees
// ============================================================================

/**
 * Base permit fees by job type (Connecticut average)
 * These are starting points; actual fees vary by municipality
 */
export const BASE_PERMIT_FEES: Record<JobType, {
  base_fee: number;
  calculation_method: 'flat' | 'percentage' | 'tiered';
  percentage_of_value?: number;
  notes: string;
}> = {
  roofing: {
    base_fee: 150,
    calculation_method: 'flat',
    notes: 'Most CT towns charge flat fee for residential re-roofing without structural changes'
  },
  siding: {
    base_fee: 200,
    calculation_method: 'flat',
    notes: 'Flat fee for siding replacement without structural changes'
  },
  windows: {
    base_fee: 100,
    calculation_method: 'tiered',
    notes: 'Fee increases with number of windows; some towns exempt simple replacements'
  },
  doors: {
    base_fee: 75,
    calculation_method: 'tiered',
    notes: 'Lower fee for simple door replacement; higher for structural changes'
  },
  gutters: {
    base_fee: 0,
    calculation_method: 'flat',
    notes: 'Most CT towns do not require permits for gutter installation'
  },
  general_construction: {
    base_fee: 250,
    calculation_method: 'percentage',
    percentage_of_value: 0.015, // 1.5% of project value
    notes: 'Calculated as percentage of project value, typically 1-2%'
  }
};

// ============================================================================
// Municipality-Specific Fees (Connecticut)
// ============================================================================

/**
 * Permit fees by major Connecticut cities/towns
 */
export const MUNICIPALITY_PERMIT_FEES: Record<string, {
  roofing_permit: number;
  siding_permit: number;
  window_permit: number;
  door_permit: number;
  electrical_permit?: number;
  plumbing_permit?: number;
  minimum_fee: number;
  percentage_based: boolean;
  percentage_rate?: number;
  notes?: string;
}> = {
  stamford: {
    roofing_permit: 150,
    siding_permit: 200,
    window_permit: 100,
    door_permit: 75,
    electrical_permit: 125,
    plumbing_permit: 125,
    minimum_fee: 75,
    percentage_based: false,
    notes: 'Stamford uses flat fees for most residential work'
  },
  guilford: {
    roofing_permit: 125,
    siding_permit: 175,
    window_permit: 90,
    door_permit: 75,
    electrical_permit: 100,
    plumbing_permit: 100,
    minimum_fee: 60,
    percentage_based: false,
    notes: 'Guilford has lower fees than larger cities'
  },
  bridgeport: {
    roofing_permit: 175,
    siding_permit: 225,
    window_permit: 125,
    door_permit: 100,
    electrical_permit: 150,
    plumbing_permit: 150,
    minimum_fee: 100,
    percentage_based: false
  },
  newhaven: {
    roofing_permit: 200,
    siding_permit: 250,
    window_permit: 150,
    door_permit: 125,
    electrical_permit: 175,
    plumbing_permit: 175,
    minimum_fee: 125,
    percentage_based: false,
    notes: 'New Haven has higher permit fees due to city size'
  },
  hartford: {
    roofing_permit: 225,
    siding_permit: 275,
    window_permit: 175,
    door_permit: 150,
    electrical_permit: 200,
    plumbing_permit: 200,
    minimum_fee: 150,
    percentage_based: false,
    notes: 'Capital city with higher permit fees'
  },
  default: {
    roofing_permit: 150,
    siding_permit: 200,
    window_permit: 100,
    door_permit: 75,
    electrical_permit: 125,
    plumbing_permit: 125,
    minimum_fee: 75,
    percentage_based: false,
    notes: 'Average Connecticut permit fees for unknown municipalities'
  }
};

// ============================================================================
// Tiered Permit Fees (Based on Project Value)
// ============================================================================

/**
 * Tiered fee structure for percentage-based permits
 * Used for larger construction projects
 */
export const TIERED_PERMIT_FEES = [
  {
    min_value: 0,
    max_value: 1000,
    fee: 50,
    description: 'Minimum permit fee for small repairs'
  },
  {
    min_value: 1001,
    max_value: 5000,
    fee: 100,
    description: 'Small project permit'
  },
  {
    min_value: 5001,
    max_value: 10000,
    fee: 150,
    description: 'Medium project permit'
  },
  {
    min_value: 10001,
    max_value: 25000,
    fee: 250,
    description: 'Large project permit'
  },
  {
    min_value: 25001,
    max_value: 50000,
    fee: 400,
    description: 'Major project permit'
  },
  {
    min_value: 50001,
    max_value: 100000,
    fee: 650,
    description: 'Large commercial/residential project'
  },
  {
    min_value: 100001,
    max_value: Infinity,
    percentage: 0.015, // 1.5% for projects over $100k
    description: 'Major construction - 1.5% of project value'
  }
];

// ============================================================================
// Additional Permits & Inspections
// ============================================================================

/**
 * Additional permits that may be required
 */
export const ADDITIONAL_PERMITS = {
  structural_changes: {
    fee: 200,
    description: 'Structural modification permit',
    required_when: 'Load-bearing walls affected or major structural changes'
  },
  electrical_work: {
    fee: 125,
    description: 'Electrical permit',
    required_when: 'Any electrical modifications or new circuits'
  },
  plumbing_work: {
    fee: 125,
    description: 'Plumbing permit',
    required_when: 'Any plumbing modifications'
  },
  hvac_work: {
    fee: 150,
    description: 'HVAC permit',
    required_when: 'Installing or modifying heating/cooling systems'
  },
  historic_district: {
    fee: 300,
    description: 'Historic district approval',
    required_when: 'Property is in designated historic district'
  },
  coastal_area: {
    fee: 250,
    description: 'Coastal Area Management permit',
    required_when: 'Property within coastal jurisdiction'
  },
  wetlands: {
    fee: 350,
    description: 'Wetlands permit',
    required_when: 'Property within wetlands buffer zone'
  }
};

// ============================================================================
// Inspection Fees
// ============================================================================

/**
 * Required inspection fees (typically included in permit, but listed separately for some towns)
 */
export const INSPECTION_FEES = {
  initial_inspection: {
    fee: 0, // Usually included in permit fee
    description: 'Initial inspection before work begins',
    typical_timing: '1-3 business days after permit issuance'
  },
  rough_inspection: {
    fee: 0, // Usually included
    description: 'Rough inspection during construction',
    typical_timing: 'Mid-project, before covering work'
  },
  final_inspection: {
    fee: 0, // Usually included
    description: 'Final inspection and certificate of completion',
    typical_timing: 'Upon project completion'
  },
  re_inspection: {
    fee: 75,
    description: 'Re-inspection fee for failed inspections',
    typical_timing: 'When corrections are needed'
  },
  expedited_inspection: {
    fee: 150,
    description: 'Rush inspection (24-48 hours)',
    typical_timing: 'Emergency or urgent projects'
  }
};

// ============================================================================
// Permit Processing Times
// ============================================================================

/**
 * Typical permit processing times in Connecticut
 */
export const PERMIT_PROCESSING_TIMES: Record<JobType, {
  standard_days: number;
  expedited_days: number;
  expedite_fee?: number;
  notes: string;
}> = {
  roofing: {
    standard_days: 3,
    expedited_days: 1,
    expedite_fee: 100,
    notes: 'Simple re-roofing permits typically approved quickly'
  },
  siding: {
    standard_days: 5,
    expedited_days: 2,
    expedite_fee: 100,
    notes: 'May require additional review for historic properties'
  },
  windows: {
    standard_days: 3,
    expedited_days: 1,
    expedite_fee: 75,
    notes: 'Replacement windows usually approved quickly'
  },
  doors: {
    standard_days: 3,
    expedited_days: 1,
    expedite_fee: 75,
    notes: 'Simple door replacement approved quickly'
  },
  gutters: {
    standard_days: 0,
    expedited_days: 0,
    notes: 'Most towns do not require permits for gutters'
  },
  general_construction: {
    standard_days: 10,
    expedited_days: 5,
    expedite_fee: 200,
    notes: 'Larger projects require plan review and engineering approval'
  }
};

// ============================================================================
// Required Documentation
// ============================================================================

/**
 * Documentation typically required for permit applications
 */
export const REQUIRED_DOCUMENTATION: Record<JobType, string[]> = {
  roofing: [
    'Completed permit application',
    'Site plan showing property boundaries',
    'Product specifications (shingles, underlayment)',
    'Contractor license and insurance',
    'Proof of workers compensation insurance'
  ],
  siding: [
    'Completed permit application',
    'Site plan',
    'Material specifications',
    'Color samples (if in historic district)',
    'Contractor license and insurance'
  ],
  windows: [
    'Completed permit application',
    'Window specifications and energy ratings',
    'Installation details',
    'Contractor license and insurance'
  ],
  doors: [
    'Completed permit application',
    'Door specifications',
    'Installation details',
    'Fire rating (if required)',
    'Contractor license and insurance'
  ],
  gutters: [
    'Usually no permit required',
    'Check with local building department'
  ],
  general_construction: [
    'Completed permit application',
    'Architectural drawings',
    'Engineering calculations (if structural)',
    'Site plan with setbacks',
    'Material specifications',
    'Energy code compliance',
    'Contractor license and insurance',
    'Proof of workers compensation'
  ]
};

// ============================================================================
// Exemptions & Special Cases
// ============================================================================

/**
 * Work that typically does NOT require permits in Connecticut
 */
export const PERMIT_EXEMPTIONS = {
  roofing_exemptions: [
    'Roof repairs under $500',
    'Emergency repairs (permit required within 48 hours)',
    'Replacing less than 25% of roof area in some towns'
  ],
  siding_exemptions: [
    'Minor repairs under $500',
    'Painting only (no structural changes)'
  ],
  window_exemptions: [
    'Same size replacement windows (some towns)',
    'Interior storm windows'
  ],
  door_exemptions: [
    'Same size replacement doors (some towns)',
    'Screen doors'
  ],
  gutters_exemptions: [
    'Gutter installation (most towns)',
    'Gutter cleaning and repairs'
  ]
};

// ============================================================================
// Certificate of Occupancy & Completion
// ============================================================================

/**
 * Certificate requirements and fees
 */
export const CERTIFICATE_FEES = {
  certificate_of_completion: {
    fee: 0, // Usually included in permit
    description: 'Certificate issued upon passing final inspection',
    processing_days: 1
  },
  certificate_of_occupancy: {
    fee: 100,
    description: 'Required for new construction or major renovations',
    processing_days: 3
  },
  temporary_certificate: {
    fee: 75,
    description: 'Temporary CO while final items completed',
    processing_days: 1,
    duration_days: 90
  }
};

// ============================================================================
// Penalty Fees
// ============================================================================

/**
 * Penalties for work without permits
 */
export const PENALTY_FEES = {
  work_without_permit: {
    multiplier: 2.0, // Double the normal permit fee
    description: 'Working without required permit',
    notes: 'May also require stop-work order and removal of completed work'
  },
  expired_permit: {
    renewal_fee: 50,
    description: 'Permit renewal fee',
    notes: 'Permits typically expire after 6-12 months'
  },
  failed_inspection: {
    first_reinspection: 0,
    additional_reinspections: 75,
    description: 'Re-inspection fees after first failure'
  }
};

// ============================================================================
// State-Specific Requirements (Connecticut)
// ============================================================================

/**
 * Connecticut state-specific requirements
 */
export const CONNECTICUT_REQUIREMENTS = {
  home_improvement_contractor_registration: {
    required: true,
    registration_fee: 100,
    renewal_period_years: 2,
    description: 'All home improvement contractors must register with CT DCP'
  },
  workers_compensation_insurance: {
    required: true,
    minimum_coverage: 100000,
    description: 'Required for all contractors with employees'
  },
  general_liability_insurance: {
    required: true,
    minimum_coverage: 500000,
    recommended_coverage: 1000000,
    description: 'Required for all contractors'
  },
  lead_paint_certification: {
    required_for_pre_1978_homes: true,
    certification_fee: 300,
    description: 'EPA RRP certification required for homes built before 1978'
  }
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate permit fee based on project value
 */
export function calculatePermitFeeByValue(projectValue: number): number {
  for (const tier of TIERED_PERMIT_FEES) {
    if (projectValue >= tier.min_value && projectValue <= tier.max_value) {
      if (tier.fee) {
        return tier.fee;
      } else if (tier.percentage) {
        return Math.max(projectValue * tier.percentage, 250); // Minimum $250 for percentage-based
      }
    }
  }
  return 250; // Default minimum
}

/**
 * Get municipality permit fees (case-insensitive)
 */
export function getMunicipalityFees(city?: string) {
  if (!city) return MUNICIPALITY_PERMIT_FEES.default;

  const normalizedCity = city.toLowerCase().replace(/\s+/g, '');
  const found = Object.keys(MUNICIPALITY_PERMIT_FEES).find(
    key => key.toLowerCase().replace(/\s+/g, '') === normalizedCity
  );

  return found ? MUNICIPALITY_PERMIT_FEES[found] : MUNICIPALITY_PERMIT_FEES.default;
}

/**
 * Check if permit is required for job type
 */
export function isPermitRequired(jobType: JobType, projectValue: number): boolean {
  if (jobType === 'gutters') return false;
  if (projectValue < 500) return false; // Minor repairs typically exempt
  return true;
}
