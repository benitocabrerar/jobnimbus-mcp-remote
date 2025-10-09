/**
 * Additional Cost Calculator
 * Calculates non-material, non-labor costs (dumpsters, disposal, equipment, etc.)
 */

import type {
  AdditionalCostInput,
  AdditionalCostResult,
  AdditionalCostItem,
  JobType
} from '../../types/calculations.types.js';

import {
  DUMPSTER_COSTS,
  DUMPSTER_ADDITIONAL_FEES,
  DISPOSAL_COSTS,
  EQUIPMENT_RENTAL_COSTS,
  PROTECTION_COSTS,
  MISCELLANEOUS_COSTS,
  TYPICAL_ADDITIONAL_COSTS_BY_JOB,
  ACCESS_LOGISTICS_COSTS,
  recommendDumpsterSize,
  estimateDisposalWeight,
  estimateAdditionalCosts
} from '../../constants/additional-costs.constants.js';

// ============================================================================
// Main Calculator Class
// ============================================================================

export class AdditionalCostCalculator {
  /**
   * Calculate additional costs for a construction project
   */
  static calculate(input: AdditionalCostInput): AdditionalCostResult {
    // Validate input
    this.validateInput(input);

    // Get cost items
    const costItems = this.getCostItems(input);

    // Calculate breakdown
    const breakdown = this.calculateBreakdown(costItems);

    // Calculate total
    const totalAdditionalCosts = costItems.reduce((sum, item) => sum + item.total_cost, 0);

    // Get recommendations
    const recommendations = this.getRecommendations(input, costItems);

    return {
      cost_items: costItems,
      breakdown,
      total_additional_costs: Math.round(totalAdditionalCosts),
      recommendations
    };
  }

  /**
   * Validate input parameters
   */
  private static validateInput(input: AdditionalCostInput): void {
    if (!input.job_type) {
      throw new Error('Job type is required');
    }

    if (input.area_sqft !== undefined && input.area_sqft <= 0) {
      throw new Error('Area must be greater than 0');
    }
  }

  /**
   * Get all cost items for this project
   */
  private static getCostItems(input: AdditionalCostInput): AdditionalCostItem[] {
    const items: AdditionalCostItem[] = [];

    // 1. Dumpster costs
    if (this.isDumpsterRequired(input)) {
      items.push(...this.getDumpsterCosts(input));
    }

    // 2. Equipment rental costs
    items.push(...this.getEquipmentCosts(input));

    // 3. Protection materials
    if (input.protection_required !== false) { // Default to true
      items.push(...this.getProtectionCosts(input));
    }

    // 4. Access/logistics costs
    items.push(...this.getAccessCosts(input));

    // 5. Miscellaneous costs
    items.push(...this.getMiscellaneousCosts(input));

    return items;
  }

  /**
   * Check if dumpster is required
   */
  private static isDumpsterRequired(input: AdditionalCostInput): boolean {
    if (input.dumpster_required !== undefined) {
      return input.dumpster_required;
    }

    // Default based on job type
    return TYPICAL_ADDITIONAL_COSTS_BY_JOB[input.job_type].dumpster_required;
  }

  /**
   * Calculate dumpster and disposal costs
   */
  private static getDumpsterCosts(input: AdditionalCostInput): AdditionalCostItem[] {
    const items: AdditionalCostItem[] = [];
    const area_sqft = input.area_sqft || 1500;

    // Determine dumpster size
    const dumpsterSize = input.dumpster_size || recommendDumpsterSize(input.job_type, area_sqft);

    if (!dumpsterSize) return items; // No dumpster needed

    const dumpsterInfo = DUMPSTER_COSTS[dumpsterSize];

    // Base dumpster rental
    let dumpsterCost = dumpsterInfo.rental_cost;

    // Check for weight overage
    const estimatedWeight = estimateDisposalWeight(input.job_type, area_sqft, 1);
    const weightLimit = dumpsterInfo.weight_limit_tons;

    if (estimatedWeight > weightLimit) {
      const overage = estimatedWeight - weightLimit;
      const overageCost = overage * dumpsterInfo.overage_cost_per_ton;

      items.push({
        category: 'Dumpster Rental',
        description: `${dumpsterSize.replace('_', ' ')} dumpster (${dumpsterInfo.dimensions})`,
        quantity: 1,
        unit: 'rental',
        unit_cost: dumpsterInfo.rental_cost,
        total_cost: dumpsterInfo.rental_cost,
        notes: dumpsterInfo.typical_use
      });

      items.push({
        category: 'Dumpster Rental',
        description: `Weight overage (${overage.toFixed(1)} tons over ${weightLimit} ton limit)`,
        quantity: overage,
        unit: 'ton',
        unit_cost: dumpsterInfo.overage_cost_per_ton,
        total_cost: overageCost,
        notes: `Estimated ${estimatedWeight.toFixed(1)} tons total`
      });
    } else {
      items.push({
        category: 'Dumpster Rental',
        description: `${dumpsterSize.replace('_', ' ')} dumpster (${dumpsterInfo.dimensions})`,
        quantity: 1,
        unit: 'rental',
        unit_cost: dumpsterCost,
        total_cost: dumpsterCost,
        notes: `${dumpsterInfo.typical_use}. Weight limit: ${weightLimit} tons, estimated: ${estimatedWeight.toFixed(1)} tons`
      });
    }

    // Add permit fee if on street
    items.push({
      category: 'Dumpster Rental',
      description: 'Street placement permit (if required)',
      quantity: 1,
      unit: 'permit',
      unit_cost: DUMPSTER_ADDITIONAL_FEES.permit_fee.cost,
      total_cost: DUMPSTER_ADDITIONAL_FEES.permit_fee.cost,
      notes: DUMPSTER_ADDITIONAL_FEES.permit_fee.required_when
    });

    return items;
  }

  /**
   * Calculate equipment rental costs
   */
  private static getEquipmentCosts(input: AdditionalCostInput): AdditionalCostItem[] {
    const items: AdditionalCostItem[] = [];
    const rentalDays = input.equipment_rental_days || 7; // Default 7 days

    const jobDefaults = TYPICAL_ADDITIONAL_COSTS_BY_JOB[input.job_type];

    // Determine equipment needs based on access
    if (input.access_equipment) {
      switch (input.access_equipment) {
        case 'scaffolding':
          const scaffoldingCost = rentalDays <= 7
            ? EQUIPMENT_RENTAL_COSTS.scaffolding.cost_per_week
            : Math.ceil(rentalDays / 7) * EQUIPMENT_RENTAL_COSTS.scaffolding.cost_per_week;

          items.push({
            category: 'Equipment Rental',
            description: 'Scaffolding rental with setup',
            quantity: rentalDays,
            unit: 'days',
            unit_cost: scaffoldingCost / rentalDays,
            total_cost: scaffoldingCost + EQUIPMENT_RENTAL_COSTS.scaffolding.setup_fee,
            notes: `${EQUIPMENT_RENTAL_COSTS.scaffolding.description} - ${rentalDays} days`
          });
          break;

        case 'lift':
          const liftCost = rentalDays * EQUIPMENT_RENTAL_COSTS.aerial_lift.cost_per_day;
          items.push({
            category: 'Equipment Rental',
            description: 'Aerial lift rental',
            quantity: rentalDays,
            unit: 'days',
            unit_cost: EQUIPMENT_RENTAL_COSTS.aerial_lift.cost_per_day,
            total_cost: liftCost + EQUIPMENT_RENTAL_COSTS.aerial_lift.delivery_fee,
            notes: EQUIPMENT_RENTAL_COSTS.aerial_lift.description
          });
          break;

        case 'crane':
          items.push({
            category: 'Equipment Rental',
            description: 'Crane service for dumpster placement',
            quantity: 1,
            unit: 'service',
            unit_cost: EQUIPMENT_RENTAL_COSTS.dumpster_crane.cost_per_use,
            total_cost: EQUIPMENT_RENTAL_COSTS.dumpster_crane.cost_per_use,
            notes: EQUIPMENT_RENTAL_COSTS.dumpster_crane.description
          });
          break;
      }
    }

    // Standard equipment for job type
    if (input.job_type === 'roofing') {
      const compressorCost = rentalDays <= 7
        ? EQUIPMENT_RENTAL_COSTS.compressor_nail_guns.cost_per_week
        : Math.ceil(rentalDays / 7) * EQUIPMENT_RENTAL_COSTS.compressor_nail_guns.cost_per_week;

      items.push({
        category: 'Equipment Rental',
        description: 'Air compressor and roofing nailers',
        quantity: rentalDays,
        unit: 'days',
        unit_cost: compressorCost / rentalDays,
        total_cost: compressorCost,
        notes: EQUIPMENT_RENTAL_COSTS.compressor_nail_guns.description
      });
    }

    return items;
  }

  /**
   * Calculate protection material costs
   */
  private static getProtectionCosts(input: AdditionalCostInput): AdditionalCostItem[] {
    const items: AdditionalCostItem[] = [];
    const area_sqft = input.area_sqft || 1500;

    // Ground protection (landscaping, driveway)
    const protectionArea = Math.min(area_sqft * 0.3, 500); // 30% of project area, max 500 sqft
    const groundProtectionCost = (protectionArea / 100) * PROTECTION_COSTS.ground_protection.cost_per_100sqft;

    items.push({
      category: 'Protection Materials',
      description: 'Ground and landscaping protection',
      quantity: protectionArea,
      unit: 'sqft',
      unit_cost: PROTECTION_COSTS.ground_protection.cost_per_100sqft / 100,
      total_cost: groundProtectionCost,
      notes: PROTECTION_COSTS.ground_protection.description
    });

    // Window protection for exterior work
    if (['siding', 'roofing'].includes(input.job_type)) {
      const estimatedWindows = Math.ceil(area_sqft / 150); // 1 window per 150 sqft
      const windowProtectionCost = estimatedWindows * PROTECTION_COSTS.window_protection.cost_per_window;

      items.push({
        category: 'Protection Materials',
        description: 'Window protection',
        quantity: estimatedWindows,
        unit: 'windows',
        unit_cost: PROTECTION_COSTS.window_protection.cost_per_window,
        total_cost: windowProtectionCost,
        notes: PROTECTION_COSTS.window_protection.description
      });
    }

    return items;
  }

  /**
   * Calculate access and logistics costs
   */
  private static getAccessCosts(input: AdditionalCostInput): AdditionalCostItem[] {
    const items: AdditionalCostItem[] = [];

    // High elevation costs
    if (input.job_type === 'roofing' || input.job_type === 'siding') {
      const stories = 2; // Assume 2-story if not specified
      if (stories > 2) {
        const extraStories = stories - 2;
        const elevationCost = extraStories * ACCESS_LOGISTICS_COSTS.high_elevation.cost_per_story_over_2;

        items.push({
          category: 'Access & Logistics',
          description: `Additional cost for ${stories}-story building`,
          quantity: extraStories,
          unit: 'stories',
          unit_cost: ACCESS_LOGISTICS_COSTS.high_elevation.cost_per_story_over_2,
          total_cost: elevationCost,
          notes: ACCESS_LOGISTICS_COSTS.high_elevation.description
        });
      }
    }

    return items;
  }

  /**
   * Calculate miscellaneous costs
   */
  private static getMiscellaneousCosts(input: AdditionalCostInput): AdditionalCostItem[] {
    const items: AdditionalCostItem[] = [];

    // Cleanup supplies
    items.push({
      category: 'Miscellaneous',
      description: 'Cleanup supplies and magnetic sweep',
      quantity: 1,
      unit: 'job',
      unit_cost: MISCELLANEOUS_COSTS.cleanup_supplies.cost_per_job,
      total_cost: MISCELLANEOUS_COSTS.cleanup_supplies.cost_per_job,
      notes: MISCELLANEOUS_COSTS.cleanup_supplies.description
    });

    // Fuel surcharge (calculated as percentage of material costs, but we don't have that here)
    // Will be calculated in the complete pricing calculator

    return items;
  }

  /**
   * Calculate breakdown by category
   */
  private static calculateBreakdown(items: AdditionalCostItem[]): AdditionalCostResult['breakdown'] {
    const breakdown = {
      dumpster_rental: 0,
      disposal_fees: 0,
      equipment_rental: 0,
      protection_materials: 0,
      access_equipment: 0,
      miscellaneous: 0
    };

    for (const item of items) {
      switch (item.category) {
        case 'Dumpster Rental':
          breakdown.dumpster_rental += item.total_cost;
          break;
        case 'Disposal':
          breakdown.disposal_fees += item.total_cost;
          break;
        case 'Equipment Rental':
          breakdown.equipment_rental += item.total_cost;
          break;
        case 'Protection Materials':
          breakdown.protection_materials += item.total_cost;
          break;
        case 'Access & Logistics':
          breakdown.access_equipment += item.total_cost;
          break;
        case 'Miscellaneous':
          breakdown.miscellaneous += item.total_cost;
          break;
      }
    }

    return breakdown;
  }

  /**
   * Get recommendations
   */
  private static getRecommendations(input: AdditionalCostInput, items: AdditionalCostItem[]): string[] {
    const recommendations: string[] = [];

    // Dumpster recommendations
    const hasDumpster = items.some(item => item.category === 'Dumpster Rental');
    if (hasDumpster) {
      recommendations.push('Schedule dumpster delivery 1 day before project start');
      recommendations.push('Verify street placement permit requirements with local municipality');
      recommendations.push('Place dumpster on driveway or yard to avoid permit fees if possible');
    }

    // Equipment recommendations
    const hasEquipment = items.some(item => item.category === 'Equipment Rental');
    if (hasEquipment) {
      recommendations.push('Reserve equipment 1-2 weeks in advance during peak season');
      recommendations.push('Ensure proper insurance coverage for rented equipment');
    }

    // Protection recommendations
    recommendations.push('Use tarps and plywood to protect landscaping, AC units, and delicate surfaces');
    recommendations.push('Take before/after photos of protected areas');

    // Job-specific recommendations
    const jobDefaults = TYPICAL_ADDITIONAL_COSTS_BY_JOB[input.job_type];
    if (jobDefaults.notes) {
      recommendations.push(jobDefaults.notes);
    }

    return recommendations;
  }

  /**
   * Quick estimate of additional costs
   */
  static estimateQuick(
    jobType: JobType,
    area_sqft: number,
    materialLaborCost: number
  ): number {
    return estimateAdditionalCosts(jobType, area_sqft, materialLaborCost);
  }

  /**
   * Estimate dumpster size recommendation
   */
  static recommendDumpsterSize(jobType: JobType, area_sqft: number): string | null {
    const size = recommendDumpsterSize(jobType, area_sqft);
    return size ? size.replace('_', ' ').toUpperCase() : null;
  }

  /**
   * Estimate disposal weight
   */
  static estimateDisposalWeight(jobType: JobType, area_sqft: number, layers: number = 1): number {
    return estimateDisposalWeight(jobType, area_sqft, layers);
  }
}
