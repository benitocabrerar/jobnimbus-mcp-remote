/**
 * Complete Pricing Calculator
 * Orchestrator that coordinates all pricing components and produces final client pricing
 */

import type {
  CompletePricingInput,
  CompletePricingResult,
  ProjectSummary,
  MaterialCostSummary,
  PricingBreakdown,
  ProfitAnalysis,
  RoofingCalculationInput,
  SidingCalculationInput,
  JobType
} from '../../types/calculations.types.js';

import { LaborCostCalculator } from './labor-cost-calculator.js';
import { PermitFeeCalculator } from './permit-fee-calculator.js';
import { AdditionalCostCalculator } from './additional-cost-calculator.js';

import {
  OVERHEAD_ALLOCATION,
  MINIMUM_JOB_PRICING,
  recommendMarkup,
  calculateNetProfit
} from '../../constants/pricing-markup.constants.js';

// ============================================================================
// Main Calculator Class
// ============================================================================

export class CompletePricingCalculator {
  /**
   * Calculate complete project pricing with all components
   */
  static calculate(input: CompletePricingInput): CompletePricingResult {
    // Validate input
    this.validateInput(input);

    // 1. Calculate Materials
    const materials = this.calculateMaterials(input);

    // 2. Calculate Labor
    const labor = this.calculateLabor(input, materials);

    // 3. Calculate Permits
    const permits = this.calculatePermits(input, materials, labor);

    // 4. Calculate Additional Costs
    const additionalCosts = this.calculateAdditionalCosts(input, materials, labor);

    // 5. Calculate Pricing & Markup
    const pricing = this.calculatePricing(input, materials, labor, permits, additionalCosts);

    // 6. Calculate Profit Analysis
    const profitAnalysis = this.calculateProfitAnalysis(pricing, materials, labor, permits, additionalCosts);

    // 7. Generate Project Summary
    const projectSummary = this.generateProjectSummary(input, materials, labor);

    // 8. Generate Recommendations & Warnings
    const recommendations = this.generateRecommendations(input, pricing, profitAnalysis);
    const warnings = this.generateWarnings(input, pricing, profitAnalysis);

    // 9. Metadata
    const metadata = {
      calculated_at: new Date().toISOString(),
      calculator_version: '1.0.0',
      industry_standards_applied: [
        'NRCA Roofing Standards',
        'RSMeans Construction Cost Data 2024/2025',
        'Connecticut Building Code 2024',
        'Industry Standard Markup 30-55%',
        'Target Margin 28-35%'
      ]
    };

    return {
      project_summary: projectSummary,
      cost_breakdown: {
        materials,
        labor,
        permits,
        additional_costs: additionalCosts
      },
      pricing,
      profit_analysis: profitAnalysis,
      recommendations,
      warnings,
      metadata
    };
  }

  /**
   * Validate complete pricing input
   */
  private static validateInput(input: CompletePricingInput): void {
    if (!input.materials_input) {
      throw new Error('Materials input is required');
    }
  }

  /**
   * Calculate materials (simplified - would use existing calculators in production)
   */
  private static calculateMaterials(input: CompletePricingInput): MaterialCostSummary {
    const materialsInput = input.materials_input as RoofingCalculationInput;

    // Simplified material cost estimation (would use proper calculators in production)
    const area = materialsInput.roof_area_sqft;
    const costPerSqft = 3.50; // Average material cost per sqft
    const subtotal = area * costPerSqft;
    const waste_factor = materialsInput.roof_complexity === 'complex' ? 0.15 : 0.10;
    const wasteAmount = subtotal * waste_factor;

    return {
      items: [], // Would be populated by actual calculator
      subtotal: Math.round(subtotal),
      waste_factor,
      waste_amount: Math.round(wasteAmount),
      total_with_waste: Math.round(subtotal + wasteAmount)
    };
  }

  /**
   * Calculate labor costs
   */
  private static calculateLabor(input: CompletePricingInput, materials: MaterialCostSummary): any {
    const materialsInput = input.materials_input as RoofingCalculationInput;
    const jobType = this.determineJobType(materialsInput);

    // Build labor input
    const laborInput = {
      job_type: jobType,
      area_sqft: materialsInput.roof_area_sqft,
      complexity: materialsInput.roof_complexity || 'moderate',
      stories: 2, // Default
      access_difficulty: 'moderate' as const,
      ...input.labor_input
    };

    return LaborCostCalculator.calculate(laborInput);
  }

  /**
   * Calculate permit fees
   */
  private static calculatePermits(input: CompletePricingInput, materials: MaterialCostSummary, labor: any): any {
    const materialsInput = input.materials_input as RoofingCalculationInput;
    const jobType = this.determineJobType(materialsInput);

    // Calculate project value for permit calculation
    const projectValue = materials.total_with_waste + labor.summary.total_labor_cost;

    // Build permit input
    const permitInput = {
      job_type: jobType,
      project_value: projectValue,
      ...input.permit_input
    };

    return PermitFeeCalculator.calculate(permitInput);
  }

  /**
   * Calculate additional costs
   */
  private static calculateAdditionalCosts(input: CompletePricingInput, materials: MaterialCostSummary, labor: any): any {
    const materialsInput = input.materials_input as RoofingCalculationInput;
    const jobType = this.determineJobType(materialsInput);

    // Build additional costs input
    const additionalInput = {
      job_type: jobType,
      area_sqft: materialsInput.roof_area_sqft,
      ...input.additional_costs_input
    };

    return AdditionalCostCalculator.calculate(additionalInput);
  }

  /**
   * Calculate pricing breakdown with markup/margin
   */
  private static calculatePricing(
    input: CompletePricingInput,
    materials: MaterialCostSummary,
    labor: any,
    permits: any,
    additionalCosts: any
  ): PricingBreakdown {
    // Calculate total hard costs
    const subtotal = materials.total_with_waste + labor.summary.total_labor_cost + permits.total_permit_fees + additionalCosts.total_additional_costs;

    // Determine markup
    const materialsInput = input.materials_input as RoofingCalculationInput;
    const jobType = this.determineJobType(materialsInput);
    const complexity = materialsInput.roof_complexity || 'moderate';

    let markupPercentage: number;
    let targetMarginPercentage: number | undefined;

    // Check for custom markup/margin preferences
    if (input.pricing_preferences?.markup_percentage !== undefined) {
      markupPercentage = input.pricing_preferences.markup_percentage;
    } else if (input.pricing_preferences?.target_margin_percentage !== undefined) {
      targetMarginPercentage = input.pricing_preferences.target_margin_percentage;
      // Convert margin to markup: Markup = Margin / (1 - Margin)
      markupPercentage = targetMarginPercentage / (1 - targetMarginPercentage);
    } else {
      // Use recommended markup
      const markupRec = recommendMarkup(jobType, complexity, []);
      markupPercentage = markupRec.final_markup;
    }

    // Calculate markup amount
    const markupAmount = subtotal * markupPercentage;

    // Calculate contingency if requested
    let contingencyPercentage: number | undefined;
    let contingencyAmount: number | undefined;

    if (input.pricing_preferences?.include_contingency) {
      contingencyPercentage = input.pricing_preferences.include_contingency;
      contingencyAmount = (subtotal + markupAmount) * contingencyPercentage;
    }

    // Calculate final price
    let finalPrice = subtotal + markupAmount + (contingencyAmount || 0);

    // Round to nearest $100 if requested
    if (input.pricing_preferences?.round_final_price !== false) {
      finalPrice = Math.round(finalPrice / 100) * 100;
    }

    // Check against minimum job pricing
    const minimumPrice = MINIMUM_JOB_PRICING[jobType].minimum_total_price;
    if (finalPrice < minimumPrice) {
      finalPrice = minimumPrice;
    }

    // Calculate per sqft metrics
    const area_sqft = materialsInput.roof_area_sqft;
    const costPerSqft = subtotal / area_sqft;
    const pricePerSqft = finalPrice / area_sqft;

    return {
      subtotal: Math.round(subtotal),
      markup_percentage: Math.round(markupPercentage * 100) / 100,
      markup_amount: Math.round(markupAmount),
      contingency_percentage: contingencyPercentage,
      contingency_amount: contingencyAmount ? Math.round(contingencyAmount) : undefined,
      final_price: Math.round(finalPrice),
      cost_per_sqft: Math.round(costPerSqft * 100) / 100,
      price_per_sqft: Math.round(pricePerSqft * 100) / 100
    };
  }

  /**
   * Calculate profit analysis
   */
  private static calculateProfitAnalysis(
    pricing: PricingBreakdown,
    materials: MaterialCostSummary,
    labor: any,
    permits: any,
    additionalCosts: any
  ): ProfitAnalysis {
    const totalHardCosts = pricing.subtotal;
    const totalRevenue = pricing.final_price;
    const grossProfit = totalRevenue - totalHardCosts;
    const grossMarginPercentage = (grossProfit / totalRevenue) * 100;

    // Calculate net profit (estimate with medium company overhead)
    const overheadPercentage = OVERHEAD_ALLOCATION.medium_company.percentage;
    const netProfitEstimate = calculateNetProfit(grossProfit, totalRevenue, overheadPercentage);
    const netMarginPercentage = (netProfitEstimate / totalRevenue) * 100;

    // Break-even point
    const breakEvenPoint = totalHardCosts / (1 - overheadPercentage);

    return {
      total_hard_costs: Math.round(totalHardCosts),
      total_revenue: Math.round(totalRevenue),
      gross_profit: Math.round(grossProfit),
      gross_margin_percentage: Math.round(grossMarginPercentage * 100) / 100,
      net_profit_estimate: Math.round(netProfitEstimate),
      net_margin_percentage: Math.round(netMarginPercentage * 100) / 100,
      break_even_point: Math.round(breakEvenPoint)
    };
  }

  /**
   * Generate project summary
   */
  private static generateProjectSummary(
    input: CompletePricingInput,
    materials: MaterialCostSummary,
    labor: any
  ): ProjectSummary {
    const materialsInput = input.materials_input as RoofingCalculationInput;
    const jobType = this.determineJobType(materialsInput);

    return {
      job_type: jobType,
      total_area_sqft: materialsInput.roof_area_sqft,
      complexity: materialsInput.roof_complexity || 'moderate',
      estimated_duration_days: labor.summary.estimated_duration_days,
      crew_size: labor.summary.recommended_crew_size,
      project_scope: this.generateScopeDescription(materialsInput)
    };
  }

  /**
   * Generate recommendations
   */
  private static generateRecommendations(
    input: CompletePricingInput,
    pricing: PricingBreakdown,
    profitAnalysis: ProfitAnalysis
  ): string[] {
    const recommendations: string[] = [];

    // Check margin health
    if (profitAnalysis.gross_margin_percentage < 25) {
      recommendations.push('⚠️ Gross margin is below target (25%). Consider increasing markup or reducing costs.');
    } else if (profitAnalysis.gross_margin_percentage > 35) {
      recommendations.push('✅ Excellent margin! Price is competitive with strong profitability.');
    }

    // Pricing strategy
    recommendations.push(`Recommended pricing strategy: Present ${pricing.final_price.toLocaleString()} as base price with premium options available.`);

    // Payment terms
    recommendations.push('Offer 3% cash discount or standard 50% deposit / 50% on completion terms.');

    // Warranty
    recommendations.push('Include comprehensive warranty in price - adds value and justifies premium pricing.');

    return recommendations;
  }

  /**
   * Generate warnings
   */
  private static generateWarnings(
    input: CompletePricingInput,
    pricing: PricingBreakdown,
    profitAnalysis: ProfitAnalysis
  ): string[] {
    const warnings: string[] = [];

    // Low margin warning
    if (profitAnalysis.gross_margin_percentage < 20) {
      warnings.push('⚠️ CRITICAL: Gross margin below 20%. Project may not be profitable after overhead.');
    }

    // Below break-even warning
    if (profitAnalysis.break_even_point && pricing.final_price < profitAnalysis.break_even_point) {
      warnings.push(`⚠️ CRITICAL: Price ($${pricing.final_price.toLocaleString()}) is below break-even point ($${profitAnalysis.break_even_point.toLocaleString()}). Project will lose money.`);
    }

    return warnings;
  }

  /**
   * Determine job type from materials input
   */
  private static determineJobType(materialsInput: RoofingCalculationInput | SidingCalculationInput): JobType {
    if ('roof_type' in materialsInput) {
      return 'roofing';
    } else if ('siding_type' in materialsInput) {
      return 'siding';
    }
    return 'general_construction';
  }

  /**
   * Generate scope description
   */
  private static generateScopeDescription(materialsInput: RoofingCalculationInput | SidingCalculationInput): string {
    if ('roof_type' in materialsInput) {
      const roofInput = materialsInput as RoofingCalculationInput;
      return `Complete roof replacement: ${roofInput.roof_area_sqft} sqft, ${roofInput.pitch} pitch, ${roofInput.roof_type} shingles`;
    }
    return 'Construction project';
  }
}
