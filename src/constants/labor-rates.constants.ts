/**
 * Labor Rates Constants
 * Industry-standard labor rates and categories for construction projects
 * Based on 2024/2025 Connecticut market rates and NRCA guidelines
 */

import type { LaborSkillLevel, JobType } from '../types/calculations.types.js';

// ============================================================================
// Base Labor Rates by Skill Level
// ============================================================================

/**
 * Hourly labor rates by skill level (Connecticut market, 2024/2025)
 * Source: Labor Cost Analysis Report from Stamford JobNimbus data
 */
export const LABOR_RATES: Record<LaborSkillLevel, number> = {
  general_labor: 60,        // Tear-off, cleanup, material handling
  skilled_installation: 75, // Standard installation work
  specialty_trade: 85,      // Complex installations, flashing, valleys
  master_craftsman: 95      // Specialty work, problem-solving, supervision
};

// ============================================================================
// Roofing Labor Categories
// ============================================================================

export interface RoofingLaborCategory {
  category_name: string;
  description: string;
  skill_level: LaborSkillLevel;
  hours_per_square: number; // Hours per 100 sq ft
  crew_size: number;
  phase: 'preparation' | 'installation' | 'finishing' | 'cleanup';
  notes?: string;
}

/**
 * Roofing labor breakdown by activity
 * Hours per square (100 sq ft) based on industry standards
 */
export const ROOFING_LABOR_CATEGORIES: RoofingLaborCategory[] = [
  {
    category_name: 'Tear-off & Disposal',
    description: 'Remove existing shingles, felt, and debris',
    skill_level: 'general_labor',
    hours_per_square: 0.5,
    crew_size: 3,
    phase: 'preparation',
    notes: 'Add 0.2 hours per layer for multi-layer removal'
  },
  {
    category_name: 'Deck Inspection & Repair',
    description: 'Inspect and repair roof deck, replace damaged plywood',
    skill_level: 'skilled_installation',
    hours_per_square: 0.3,
    crew_size: 2,
    phase: 'preparation',
    notes: 'Additional time may be needed for extensive repairs'
  },
  {
    category_name: 'Underlayment Installation',
    description: 'Install ice & water shield and synthetic underlayment',
    skill_level: 'skilled_installation',
    hours_per_square: 0.4,
    crew_size: 2,
    phase: 'installation'
  },
  {
    category_name: 'Drip Edge Installation',
    description: 'Install drip edge along eaves and rakes',
    skill_level: 'skilled_installation',
    hours_per_square: 0.2,
    crew_size: 2,
    phase: 'installation',
    notes: 'Measured per linear foot of perimeter'
  },
  {
    category_name: 'Shingle Installation',
    description: 'Install architectural or 3-tab shingles',
    skill_level: 'skilled_installation',
    hours_per_square: 1.2,
    crew_size: 3,
    phase: 'installation',
    notes: 'Time varies by shingle type and complexity'
  },
  {
    category_name: 'Ridge Cap Installation',
    description: 'Install ridge cap shingles along ridges',
    skill_level: 'skilled_installation',
    hours_per_square: 0.3,
    crew_size: 2,
    phase: 'installation',
    notes: 'Per linear foot of ridge'
  },
  {
    category_name: 'Valley Flashing',
    description: 'Install valley flashing and shingles',
    skill_level: 'specialty_trade',
    hours_per_square: 0.5,
    crew_size: 2,
    phase: 'installation',
    notes: 'Per linear foot of valley'
  },
  {
    category_name: 'Penetration Flashing',
    description: 'Flash vents, pipes, chimneys, skylights',
    skill_level: 'specialty_trade',
    hours_per_square: 0.4,
    crew_size: 2,
    phase: 'finishing',
    notes: 'Time per penetration varies by type'
  },
  {
    category_name: 'Gutter Installation',
    description: 'Install new gutters and downspouts',
    skill_level: 'skilled_installation',
    hours_per_square: 0.3,
    crew_size: 2,
    phase: 'finishing',
    notes: 'Per linear foot of gutter'
  },
  {
    category_name: 'Cleanup & Final Inspection',
    description: 'Clean job site, magnetic sweep, final walkthrough',
    skill_level: 'general_labor',
    hours_per_square: 0.3,
    crew_size: 2,
    phase: 'cleanup'
  }
];

// ============================================================================
// Siding Labor Categories
// ============================================================================

export interface SidingLaborCategory {
  category_name: string;
  description: string;
  skill_level: LaborSkillLevel;
  hours_per_100_sqft: number;
  crew_size: number;
  phase: 'preparation' | 'installation' | 'finishing' | 'cleanup';
}

export const SIDING_LABOR_CATEGORIES: SidingLaborCategory[] = [
  {
    category_name: 'Old Siding Removal',
    description: 'Remove existing siding and dispose',
    skill_level: 'general_labor',
    hours_per_100_sqft: 1.5,
    crew_size: 3,
    phase: 'preparation'
  },
  {
    category_name: 'Sheathing Inspection & Repair',
    description: 'Inspect and repair wall sheathing',
    skill_level: 'skilled_installation',
    hours_per_100_sqft: 0.8,
    crew_size: 2,
    phase: 'preparation'
  },
  {
    category_name: 'House Wrap Installation',
    description: 'Install weather barrier and tape seams',
    skill_level: 'skilled_installation',
    hours_per_100_sqft: 0.5,
    crew_size: 2,
    phase: 'installation'
  },
  {
    category_name: 'Starter Strip Installation',
    description: 'Install starter strips and J-channels',
    skill_level: 'skilled_installation',
    hours_per_100_sqft: 0.6,
    crew_size: 2,
    phase: 'installation'
  },
  {
    category_name: 'Siding Installation',
    description: 'Install vinyl, fiber cement, or wood siding',
    skill_level: 'skilled_installation',
    hours_per_100_sqft: 2.5,
    crew_size: 3,
    phase: 'installation'
  },
  {
    category_name: 'Corner & Trim Installation',
    description: 'Install outside corners, inside corners, and trim',
    skill_level: 'specialty_trade',
    hours_per_100_sqft: 1.0,
    crew_size: 2,
    phase: 'finishing'
  },
  {
    category_name: 'Window & Door Trim',
    description: 'Install trim around windows and doors',
    skill_level: 'specialty_trade',
    hours_per_100_sqft: 0.8,
    crew_size: 2,
    phase: 'finishing'
  },
  {
    category_name: 'Cleanup & Final Inspection',
    description: 'Clean job site and final walkthrough',
    skill_level: 'general_labor',
    hours_per_100_sqft: 0.4,
    crew_size: 2,
    phase: 'cleanup'
  }
];

// ============================================================================
// Windows & Doors Labor Categories
// ============================================================================

export interface WindowDoorLaborCategory {
  category_name: string;
  description: string;
  skill_level: LaborSkillLevel;
  hours_per_unit: number;
  crew_size: number;
  phase: 'preparation' | 'installation' | 'finishing' | 'cleanup';
}

export const WINDOWS_LABOR_CATEGORIES: WindowDoorLaborCategory[] = [
  {
    category_name: 'Window Removal',
    description: 'Remove old windows and trim',
    skill_level: 'skilled_installation',
    hours_per_unit: 0.5,
    crew_size: 2,
    phase: 'preparation'
  },
  {
    category_name: 'Opening Preparation',
    description: 'Prepare rough opening, repair framing',
    skill_level: 'skilled_installation',
    hours_per_unit: 0.8,
    crew_size: 2,
    phase: 'preparation'
  },
  {
    category_name: 'Window Installation',
    description: 'Install new window, level, shim, secure',
    skill_level: 'specialty_trade',
    hours_per_unit: 1.5,
    crew_size: 2,
    phase: 'installation'
  },
  {
    category_name: 'Flashing & Waterproofing',
    description: 'Install flashing tape and sealants',
    skill_level: 'specialty_trade',
    hours_per_unit: 0.5,
    crew_size: 1,
    phase: 'installation'
  },
  {
    category_name: 'Interior & Exterior Trim',
    description: 'Install trim, casing, sill, paint/stain',
    skill_level: 'specialty_trade',
    hours_per_unit: 1.2,
    crew_size: 2,
    phase: 'finishing'
  },
  {
    category_name: 'Cleanup & Touch-up',
    description: 'Clean windows, touch-up paint, final inspection',
    skill_level: 'general_labor',
    hours_per_unit: 0.3,
    crew_size: 1,
    phase: 'cleanup'
  }
];

export const DOORS_LABOR_CATEGORIES: WindowDoorLaborCategory[] = [
  {
    category_name: 'Door Removal',
    description: 'Remove old door, frame, and trim',
    skill_level: 'skilled_installation',
    hours_per_unit: 1.0,
    crew_size: 2,
    phase: 'preparation'
  },
  {
    category_name: 'Opening Preparation',
    description: 'Prepare rough opening, adjust framing',
    skill_level: 'skilled_installation',
    hours_per_unit: 1.5,
    crew_size: 2,
    phase: 'preparation'
  },
  {
    category_name: 'Door Installation',
    description: 'Install pre-hung door unit, level, shim, secure',
    skill_level: 'specialty_trade',
    hours_per_unit: 2.5,
    crew_size: 2,
    phase: 'installation'
  },
  {
    category_name: 'Hardware Installation',
    description: 'Install lockset, deadbolt, hinges, weatherstripping',
    skill_level: 'specialty_trade',
    hours_per_unit: 1.0,
    crew_size: 1,
    phase: 'installation'
  },
  {
    category_name: 'Trim & Finishing',
    description: 'Install interior/exterior trim, paint/stain',
    skill_level: 'specialty_trade',
    hours_per_unit: 2.0,
    crew_size: 2,
    phase: 'finishing'
  },
  {
    category_name: 'Adjustments & Cleanup',
    description: 'Final adjustments, cleanup, inspection',
    skill_level: 'general_labor',
    hours_per_unit: 0.5,
    crew_size: 1,
    phase: 'cleanup'
  }
];

// ============================================================================
// Gutters Labor Categories
// ============================================================================

export interface GutterLaborCategory {
  category_name: string;
  description: string;
  skill_level: LaborSkillLevel;
  hours_per_100_lf: number; // Hours per 100 linear feet
  crew_size: number;
  phase: 'preparation' | 'installation' | 'finishing' | 'cleanup';
}

export const GUTTERS_LABOR_CATEGORIES: GutterLaborCategory[] = [
  {
    category_name: 'Old Gutter Removal',
    description: 'Remove existing gutters and downspouts',
    skill_level: 'general_labor',
    hours_per_100_lf: 1.0,
    crew_size: 2,
    phase: 'preparation'
  },
  {
    category_name: 'Fascia Inspection & Repair',
    description: 'Inspect and repair fascia boards',
    skill_level: 'skilled_installation',
    hours_per_100_lf: 1.5,
    crew_size: 2,
    phase: 'preparation'
  },
  {
    category_name: 'Gutter Installation',
    description: 'Install seamless gutters with proper slope',
    skill_level: 'specialty_trade',
    hours_per_100_lf: 2.5,
    crew_size: 2,
    phase: 'installation'
  },
  {
    category_name: 'Downspout Installation',
    description: 'Install downspouts, elbows, extensions',
    skill_level: 'skilled_installation',
    hours_per_100_lf: 1.5,
    crew_size: 2,
    phase: 'installation'
  },
  {
    category_name: 'Gutter Guards Installation',
    description: 'Install gutter protection system',
    skill_level: 'skilled_installation',
    hours_per_100_lf: 1.0,
    crew_size: 2,
    phase: 'finishing'
  },
  {
    category_name: 'Cleanup & Testing',
    description: 'Clean up, test water flow, final inspection',
    skill_level: 'general_labor',
    hours_per_100_lf: 0.5,
    crew_size: 2,
    phase: 'cleanup'
  }
];

// ============================================================================
// Labor Adjustment Multipliers
// ============================================================================

/**
 * Complexity multipliers for labor estimates
 */
export const LABOR_COMPLEXITY_MULTIPLIERS = {
  simple: 1.0,    // Straightforward job, few obstacles
  moderate: 1.25, // Standard complexity, some challenges
  complex: 1.6    // High complexity, multiple challenges
};

/**
 * Access difficulty multipliers
 */
export const ACCESS_DIFFICULTY_MULTIPLIERS = {
  easy: 1.0,      // Ground level or easy ladder access
  moderate: 1.15, // Standard roof access, 2-story
  difficult: 1.35 // Steep roof, 3+ stories, limited access
};

/**
 * Story height adjustments (additional hours per story above first)
 */
export const STORY_HEIGHT_ADJUSTMENTS = {
  additional_hours_per_story: 0.3, // Additional hours per 100 sqft per story
  minimum_stories: 1,
  maximum_stories_without_special_equipment: 3
};

// ============================================================================
// Labor Phase Distribution (% of total labor)
// ============================================================================

/**
 * Standard distribution of labor hours across project phases
 */
export const LABOR_PHASE_DISTRIBUTION: Record<JobType, {
  preparation: number;
  installation: number;
  finishing: number;
  cleanup: number;
}> = {
  roofing: {
    preparation: 0.20,  // 20% - tear-off, deck repair
    installation: 0.60, // 60% - underlayment, shingles, flashing
    finishing: 0.15,    // 15% - ridge cap, penetrations, gutters
    cleanup: 0.05       // 5% - cleanup, inspection
  },
  siding: {
    preparation: 0.25,  // 25% - removal, sheathing repair
    installation: 0.50, // 50% - house wrap, siding installation
    finishing: 0.20,    // 20% - corners, trim, paint
    cleanup: 0.05       // 5% - cleanup
  },
  windows: {
    preparation: 0.20,  // 20% - removal, opening prep
    installation: 0.45, // 45% - window install, flashing
    finishing: 0.30,    // 30% - trim, paint, touchup
    cleanup: 0.05       // 5% - cleanup
  },
  doors: {
    preparation: 0.25,  // 25% - removal, opening prep
    installation: 0.40, // 40% - door install, hardware
    finishing: 0.30,    // 30% - trim, paint, adjustments
    cleanup: 0.05       // 5% - cleanup
  },
  gutters: {
    preparation: 0.30,  // 30% - removal, fascia repair
    installation: 0.55, // 55% - gutter and downspout install
    finishing: 0.10,    // 10% - guards, extensions
    cleanup: 0.05       // 5% - cleanup, testing
  },
  general_construction: {
    preparation: 0.25,
    installation: 0.50,
    finishing: 0.20,
    cleanup: 0.05
  }
};

// ============================================================================
// Recommended Crew Sizes
// ============================================================================

/**
 * Recommended crew sizes by job type and project size
 */
export const RECOMMENDED_CREW_SIZES: Record<JobType, {
  small: number;  // < 15 squares or < 1000 sqft
  medium: number; // 15-30 squares or 1000-2000 sqft
  large: number;  // > 30 squares or > 2000 sqft
}> = {
  roofing: {
    small: 2,
    medium: 3,
    large: 4
  },
  siding: {
    small: 2,
    medium: 3,
    large: 4
  },
  windows: {
    small: 2,
    medium: 2,
    large: 3
  },
  doors: {
    small: 2,
    medium: 2,
    large: 2
  },
  gutters: {
    small: 2,
    medium: 2,
    large: 3
  },
  general_construction: {
    small: 2,
    medium: 3,
    large: 4
  }
};

// ============================================================================
// Labor Productivity Factors
// ============================================================================

/**
 * Weather and seasonal productivity factors
 */
export const SEASONAL_PRODUCTIVITY_FACTORS = {
  spring: 1.0,   // Ideal conditions
  summer: 0.9,   // Heat can reduce productivity
  fall: 1.0,     // Ideal conditions
  winter: 0.75   // Cold, snow, shorter days
};

/**
 * Time of day productivity (for scheduling optimization)
 */
export const TIME_OF_DAY_PRODUCTIVITY = {
  morning: 1.1,    // Peak productivity
  midday: 1.0,     // Standard productivity
  afternoon: 0.95, // Slight decline
  evening: 0.85    // Reduced productivity
};
