/**
 * Labor Cost Calculator
 * Calculates labor costs for construction projects based on job type, area, and complexity
 */

import type {
  LaborCostInput,
  LaborCostResult,
  LaborCategory,
  JobType,
  LaborSkillLevel
} from '../../types/calculations.types.js';

import {
  LABOR_RATES,
  ROOFING_LABOR_CATEGORIES,
  SIDING_LABOR_CATEGORIES,
  WINDOWS_LABOR_CATEGORIES,
  DOORS_LABOR_CATEGORIES,
  GUTTERS_LABOR_CATEGORIES,
  LABOR_COMPLEXITY_MULTIPLIERS,
  ACCESS_DIFFICULTY_MULTIPLIERS,
  STORY_HEIGHT_ADJUSTMENTS,
  LABOR_PHASE_DISTRIBUTION,
  RECOMMENDED_CREW_SIZES
} from '../../constants/labor-rates.constants.js';

// ============================================================================
// Main Calculator Class
// ============================================================================

export class LaborCostCalculator {
  /**
   * Calculate labor costs for a construction project
   */
  static calculate(input: LaborCostInput): LaborCostResult {
    // Validate input
    this.validateInput(input);

    // Get labor categories based on job type
    const laborCategories = this.getLaborCategories(input);

    // Apply adjustments for complexity, access, stories
    const adjustedCategories = this.applyAdjustments(laborCategories, input);

    // Calculate summary metrics
    const summary = this.calculateSummary(adjustedCategories, input);

    // Calculate phase breakdown
    const breakdown = this.calculatePhaseBreakdown(adjustedCategories, input.job_type);

    // Get applied adjustments
    const adjustments = this.getAdjustmentsApplied(input);

    return {
      labor_categories: adjustedCategories,
      summary,
      breakdown_by_phase: breakdown,
      adjustments_applied: adjustments
    };
  }

  /**
   * Validate input parameters
   */
  private static validateInput(input: LaborCostInput): void {
    if (!input.job_type) {
      throw new Error('Job type is required');
    }

    if (input.area_sqft !== undefined && input.area_sqft <= 0) {
      throw new Error('Area must be greater than 0');
    }

    if (input.stories !== undefined && input.stories < 1) {
      throw new Error('Stories must be at least 1');
    }
  }

  /**
   * Get labor categories based on job type
   */
  private static getLaborCategories(input: LaborCostInput): LaborCategory[] {
    const categories: LaborCategory[] = [];

    // If custom categories provided, use them
    if (input.custom_labor_categories && input.custom_labor_categories.length > 0) {
      return this.processCustomCategories(input.custom_labor_categories);
    }

    // Otherwise, generate standard categories based on job type
    switch (input.job_type) {
      case 'roofing':
        return this.generateRoofingLaborCategories(input);

      case 'siding':
        return this.generateSidingLaborCategories(input);

      case 'windows':
        return this.generateWindowsLaborCategories(input);

      case 'doors':
        return this.generateDoorsLaborCategories(input);

      case 'gutters':
        return this.generateGuttersLaborCategories(input);

      case 'general_construction':
        return this.generateGeneralLaborCategories(input);

      default:
        throw new Error(`Unsupported job type: ${input.job_type}`);
    }
  }

  /**
   * Generate roofing labor categories
   */
  private static generateRoofingLaborCategories(input: LaborCostInput): LaborCategory[] {
    const categories: LaborCategory[] = [];
    const area_sqft = input.area_sqft || 1500; // Default 1500 sqft
    const squares = area_sqft / 100;

    for (const template of ROOFING_LABOR_CATEGORIES) {
      const hours = template.hours_per_square * squares;
      const hourlyRate = LABOR_RATES[template.skill_level];
      const totalLaborHours = hours * template.crew_size;
      const subtotal = hours * hourlyRate * template.crew_size;

      categories.push({
        category_name: template.category_name,
        description: template.description,
        skill_level: template.skill_level,
        hourly_rate: hourlyRate,
        estimated_hours: hours,
        crew_size: template.crew_size,
        total_labor_hours: totalLaborHours,
        subtotal,
        notes: template.notes ? [template.notes] : undefined
      });
    }

    return categories;
  }

  /**
   * Generate siding labor categories
   */
  private static generateSidingLaborCategories(input: LaborCostInput): LaborCategory[] {
    const categories: LaborCategory[] = [];
    const area_sqft = input.area_sqft || 2000;
    const hundreds = area_sqft / 100;

    for (const template of SIDING_LABOR_CATEGORIES) {
      const hours = template.hours_per_100_sqft * hundreds;
      const hourlyRate = LABOR_RATES[template.skill_level];
      const totalLaborHours = hours * template.crew_size;
      const subtotal = hours * hourlyRate * template.crew_size;

      categories.push({
        category_name: template.category_name,
        description: template.description,
        skill_level: template.skill_level,
        hourly_rate: hourlyRate,
        estimated_hours: hours,
        crew_size: template.crew_size,
        total_labor_hours: totalLaborHours,
        subtotal
      });
    }

    return categories;
  }

  /**
   * Generate windows labor categories
   */
  private static generateWindowsLaborCategories(input: LaborCostInput): LaborCategory[] {
    const categories: LaborCategory[] = [];
    // Estimate number of windows from area (rough estimate: 1 window per 150 sqft)
    const estimatedWindows = input.area_sqft ? Math.ceil(input.area_sqft / 150) : 5;

    for (const template of WINDOWS_LABOR_CATEGORIES) {
      const hours = template.hours_per_unit * estimatedWindows;
      const hourlyRate = LABOR_RATES[template.skill_level];
      const totalLaborHours = hours * template.crew_size;
      const subtotal = hours * hourlyRate * template.crew_size;

      categories.push({
        category_name: template.category_name,
        description: template.description,
        skill_level: template.skill_level,
        hourly_rate: hourlyRate,
        estimated_hours: hours,
        crew_size: template.crew_size,
        total_labor_hours: totalLaborHours,
        subtotal
      });
    }

    return categories;
  }

  /**
   * Generate doors labor categories
   */
  private static generateDoorsLaborCategories(input: LaborCostInput): LaborCategory[] {
    const categories: LaborCategory[] = [];
    // Estimate number of doors (default 2 for typical replacement)
    const estimatedDoors = 2;

    for (const template of DOORS_LABOR_CATEGORIES) {
      const hours = template.hours_per_unit * estimatedDoors;
      const hourlyRate = LABOR_RATES[template.skill_level];
      const totalLaborHours = hours * template.crew_size;
      const subtotal = hours * hourlyRate * template.crew_size;

      categories.push({
        category_name: template.category_name,
        description: template.description,
        skill_level: template.skill_level,
        hourly_rate: hourlyRate,
        estimated_hours: hours,
        crew_size: template.crew_size,
        total_labor_hours: totalLaborHours,
        subtotal
      });
    }

    return categories;
  }

  /**
   * Generate gutters labor categories
   */
  private static generateGuttersLaborCategories(input: LaborCostInput): LaborCategory[] {
    const categories: LaborCategory[] = [];
    // Estimate linear feet from area (rough: perimeter = sqrt(area) * 4)
    const estimatedLF = input.area_sqft ? Math.sqrt(input.area_sqft) * 4 : 150;
    const hundreds = estimatedLF / 100;

    for (const template of GUTTERS_LABOR_CATEGORIES) {
      const hours = template.hours_per_100_lf * hundreds;
      const hourlyRate = LABOR_RATES[template.skill_level];
      const totalLaborHours = hours * template.crew_size;
      const subtotal = hours * hourlyRate * template.crew_size;

      categories.push({
        category_name: template.category_name,
        description: template.description,
        skill_level: template.skill_level,
        hourly_rate: hourlyRate,
        estimated_hours: hours,
        crew_size: template.crew_size,
        total_labor_hours: totalLaborHours,
        subtotal
      });
    }

    return categories;
  }

  /**
   * Generate general construction labor categories
   */
  private static generateGeneralLaborCategories(input: LaborCostInput): LaborCategory[] {
    // For general construction, create a simplified breakdown
    const area_sqft = input.area_sqft || 1000;
    const complexity = input.complexity || 'moderate';

    // Estimate total hours based on complexity
    let baseHoursPerHundred = 8; // Base: 8 hours per 100 sqft
    if (complexity === 'simple') baseHoursPerHundred = 6;
    if (complexity === 'complex') baseHoursPerHundred = 12;

    const totalHours = (area_sqft / 100) * baseHoursPerHundred;

    // Distribute hours across phases
    const distribution = LABOR_PHASE_DISTRIBUTION.general_construction;

    return [
      {
        category_name: 'Preparation & Demolition',
        description: 'Site prep, demolition, material delivery',
        skill_level: 'general_labor',
        hourly_rate: LABOR_RATES.general_labor,
        estimated_hours: totalHours * distribution.preparation,
        crew_size: 2,
        total_labor_hours: totalHours * distribution.preparation * 2,
        subtotal: totalHours * distribution.preparation * LABOR_RATES.general_labor * 2
      },
      {
        category_name: 'Installation & Construction',
        description: 'Primary construction work',
        skill_level: 'skilled_installation',
        hourly_rate: LABOR_RATES.skilled_installation,
        estimated_hours: totalHours * distribution.installation,
        crew_size: 3,
        total_labor_hours: totalHours * distribution.installation * 3,
        subtotal: totalHours * distribution.installation * LABOR_RATES.skilled_installation * 3
      },
      {
        category_name: 'Finishing Work',
        description: 'Trim, paint, final details',
        skill_level: 'specialty_trade',
        hourly_rate: LABOR_RATES.specialty_trade,
        estimated_hours: totalHours * distribution.finishing,
        crew_size: 2,
        total_labor_hours: totalHours * distribution.finishing * 2,
        subtotal: totalHours * distribution.finishing * LABOR_RATES.specialty_trade * 2
      },
      {
        category_name: 'Cleanup & Inspection',
        description: 'Final cleanup and walkthrough',
        skill_level: 'general_labor',
        hourly_rate: LABOR_RATES.general_labor,
        estimated_hours: totalHours * distribution.cleanup,
        crew_size: 2,
        total_labor_hours: totalHours * distribution.cleanup * 2,
        subtotal: totalHours * distribution.cleanup * LABOR_RATES.general_labor * 2
      }
    ];
  }

  /**
   * Process custom labor categories
   */
  private static processCustomCategories(customCategories: Partial<LaborCategory>[]): LaborCategory[] {
    return customCategories.map(custom => {
      const hourlyRate = custom.hourly_rate || LABOR_RATES[custom.skill_level || 'skilled_installation'];
      const estimatedHours = custom.estimated_hours || 0;
      const crewSize = custom.crew_size || 2;
      const totalLaborHours = estimatedHours * crewSize;
      const subtotal = estimatedHours * hourlyRate * crewSize;

      return {
        category_name: custom.category_name || 'Custom Labor',
        description: custom.description || '',
        skill_level: custom.skill_level || 'skilled_installation',
        hourly_rate: hourlyRate,
        estimated_hours: estimatedHours,
        crew_size: crewSize,
        total_labor_hours: totalLaborHours,
        subtotal,
        notes: custom.notes
      };
    });
  }

  /**
   * Apply adjustments for complexity, access difficulty, stories
   */
  private static applyAdjustments(
    categories: LaborCategory[],
    input: LaborCostInput
  ): LaborCategory[] {
    let multiplier = 1.0;

    // Apply complexity multiplier
    if (input.complexity) {
      multiplier *= LABOR_COMPLEXITY_MULTIPLIERS[input.complexity];
    }

    // Apply access difficulty multiplier
    if (input.access_difficulty) {
      multiplier *= ACCESS_DIFFICULTY_MULTIPLIERS[input.access_difficulty];
    }

    // Apply story height adjustment
    if (input.stories && input.stories > 1) {
      const extraStories = input.stories - 1;
      const storyAdjustment = 1 + (extraStories * 0.15); // 15% per additional story
      multiplier *= storyAdjustment;
    }

    // Apply multiplier to all categories
    return categories.map(category => ({
      ...category,
      estimated_hours: category.estimated_hours * multiplier,
      total_labor_hours: category.total_labor_hours * multiplier,
      subtotal: category.subtotal * multiplier
    }));
  }

  /**
   * Calculate summary metrics
   */
  private static calculateSummary(
    categories: LaborCategory[],
    input: LaborCostInput
  ): LaborCostResult['summary'] {
    const totalHours = categories.reduce((sum, cat) => sum + cat.estimated_hours, 0);
    const totalLaborHours = categories.reduce((sum, cat) => sum + cat.total_labor_hours, 0);
    const totalCost = categories.reduce((sum, cat) => sum + cat.subtotal, 0);

    // Calculate average hourly rate (weighted by hours)
    let weightedSum = 0;
    let totalHoursForAvg = 0;
    for (const category of categories) {
      weightedSum += category.hourly_rate * category.estimated_hours;
      totalHoursForAvg += category.estimated_hours;
    }
    const averageHourlyRate = totalHoursForAvg > 0 ? weightedSum / totalHoursForAvg : 0;

    // Estimate duration in days (assuming 8 hour work day per crew member)
    const estimatedDurationDays = Math.ceil(totalLaborHours / 8);

    // Recommend crew size
    const jobSize = this.determineJobSize(input.area_sqft || 1500);
    const recommendedCrewSize = RECOMMENDED_CREW_SIZES[input.job_type][jobSize];

    return {
      total_hours: Math.round(totalHours * 10) / 10,
      total_labor_hours: Math.round(totalLaborHours * 10) / 10,
      average_hourly_rate: Math.round(averageHourlyRate),
      total_labor_cost: Math.round(totalCost),
      estimated_duration_days: estimatedDurationDays,
      recommended_crew_size: recommendedCrewSize
    };
  }

  /**
   * Calculate phase breakdown
   */
  private static calculatePhaseBreakdown(
    categories: LaborCategory[],
    jobType: JobType
  ): LaborCostResult['breakdown_by_phase'] {
    const phaseMap: Record<string, number> = {
      preparation: 0,
      installation: 0,
      finishing: 0,
      cleanup: 0
    };

    // Sum costs by phase based on category assignment
    const distribution = LABOR_PHASE_DISTRIBUTION[jobType];

    const totalCost = categories.reduce((sum, cat) => sum + cat.subtotal, 0);

    return {
      preparation: Math.round(totalCost * distribution.preparation),
      installation: Math.round(totalCost * distribution.installation),
      finishing: Math.round(totalCost * distribution.finishing),
      cleanup: Math.round(totalCost * distribution.cleanup)
    };
  }

  /**
   * Get adjustments applied
   */
  private static getAdjustmentsApplied(input: LaborCostInput): LaborCostResult['adjustments_applied'] {
    const adjustments: LaborCostResult['adjustments_applied'] = [];

    if (input.complexity && input.complexity !== 'moderate') {
      const multiplier = LABOR_COMPLEXITY_MULTIPLIERS[input.complexity];
      adjustments.push({
        reason: `${input.complexity} complexity`,
        adjustment_percent: (multiplier - 1) * 100,
        amount: 0 // Will be calculated at total level
      });
    }

    if (input.access_difficulty && input.access_difficulty !== 'easy') {
      const multiplier = ACCESS_DIFFICULTY_MULTIPLIERS[input.access_difficulty];
      adjustments.push({
        reason: `${input.access_difficulty} access`,
        adjustment_percent: (multiplier - 1) * 100,
        amount: 0
      });
    }

    if (input.stories && input.stories > 1) {
      const extraStories = input.stories - 1;
      adjustments.push({
        reason: `${extraStories} additional stor${extraStories > 1 ? 'ies' : 'y'}`,
        adjustment_percent: extraStories * 15,
        amount: 0
      });
    }

    return adjustments;
  }

  /**
   * Determine job size category
   */
  private static determineJobSize(area_sqft: number): 'small' | 'medium' | 'large' {
    if (area_sqft < 1500) return 'small';
    if (area_sqft < 3000) return 'medium';
    return 'large';
  }

  /**
   * Estimate labor cost quickly (simplified calculation)
   */
  static estimateQuick(
    jobType: JobType,
    area_sqft: number,
    complexity: 'simple' | 'moderate' | 'complex' = 'moderate'
  ): number {
    const result = this.calculate({
      job_type: jobType,
      area_sqft,
      complexity
    });

    return result.summary.total_labor_cost;
  }
}
