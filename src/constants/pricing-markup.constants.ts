/**
 * Pricing & Markup Constants
 * Industry-standard markup percentages, profit margins, and pricing strategies
 * Based on construction industry best practices and Connecticut market conditions
 */

import type { JobType } from '../types/calculations.types.js';

// ============================================================================
// Standard Markup Percentages
// ============================================================================

/**
 * Standard markup percentages by job type
 * Markup = (Price - Cost) / Cost
 *
 * Example: If cost is $10,000 and markup is 40%, price = $14,000
 */
export const STANDARD_MARKUP_PERCENTAGES: Record<JobType, {
  minimum: number;
  standard: number;
  premium: number;
  notes: string;
}> = {
  roofing: {
    minimum: 0.30,   // 30% minimum for low-complexity jobs
    standard: 0.40,  // 40% standard markup
    premium: 0.55,   // 55% for complex or high-end jobs
    notes: 'Roofing has high liability; justify premium with warranty and quality'
  },
  siding: {
    minimum: 0.35,
    standard: 0.45,
    premium: 0.60,
    notes: 'Siding requires skilled labor and has aesthetic component'
  },
  windows: {
    minimum: 0.35,
    standard: 0.45,
    premium: 0.55,
    notes: 'Windows are high-value items; customers expect quality installation'
  },
  doors: {
    minimum: 0.35,
    standard: 0.45,
    premium: 0.55,
    notes: 'Entry doors are security-critical; justify premium pricing'
  },
  gutters: {
    minimum: 0.40,
    standard: 0.50,
    premium: 0.65,
    notes: 'Gutters have lower material cost; higher markup percentage needed'
  },
  general_construction: {
    minimum: 0.30,
    standard: 0.40,
    premium: 0.50,
    notes: 'Varies widely by scope; adjust based on complexity'
  }
};

// ============================================================================
// Target Profit Margins
// ============================================================================

/**
 * Target profit margins (Gross Margin)
 * Margin = (Price - Cost) / Price
 *
 * Example: If price is $14,000 and cost is $10,000, margin = 28.57%
 * Note: 40% markup = 28.57% margin, 50% markup = 33.33% margin
 */
export const TARGET_PROFIT_MARGINS: Record<JobType, {
  minimum_margin: number;
  target_margin: number;
  excellent_margin: number;
  break_even_margin: number;
}> = {
  roofing: {
    minimum_margin: 0.23,     // 23% = 30% markup
    target_margin: 0.29,      // 29% = 40% markup
    excellent_margin: 0.35,   // 35% = 55% markup
    break_even_margin: 0.15   // 15% = 17.6% markup (covers overhead only)
  },
  siding: {
    minimum_margin: 0.26,     // 26% = 35% markup
    target_margin: 0.31,      // 31% = 45% markup
    excellent_margin: 0.38,   // 38% = 60% markup
    break_even_margin: 0.15
  },
  windows: {
    minimum_margin: 0.26,
    target_margin: 0.31,
    excellent_margin: 0.35,
    break_even_margin: 0.15
  },
  doors: {
    minimum_margin: 0.26,
    target_margin: 0.31,
    excellent_margin: 0.35,
    break_even_margin: 0.15
  },
  gutters: {
    minimum_margin: 0.29,     // 29% = 40% markup
    target_margin: 0.33,      // 33% = 50% markup
    excellent_margin: 0.39,   // 39% = 65% markup
    break_even_margin: 0.15
  },
  general_construction: {
    minimum_margin: 0.23,
    target_margin: 0.29,
    excellent_margin: 0.33,
    break_even_margin: 0.15
  }
};

// ============================================================================
// Overhead Allocation
// ============================================================================

/**
 * Overhead costs as percentage of revenue
 * Overhead includes: office rent, utilities, insurance, admin salaries, marketing, etc.
 */
export const OVERHEAD_ALLOCATION = {
  small_company: {
    percentage: 0.15,  // 15% of revenue
    description: '1-3 crew company',
    typical_annual_overhead: 75000,
    notes: 'Lower overhead but less capacity'
  },
  medium_company: {
    percentage: 0.18,  // 18% of revenue
    description: '4-8 crew company',
    typical_annual_overhead: 180000,
    notes: 'Optimal efficiency with office support'
  },
  large_company: {
    percentage: 0.22,  // 22% of revenue
    description: '9+ crew company',
    typical_annual_overhead: 400000,
    notes: 'Higher overhead but greater market presence'
  }
};

/**
 * Overhead cost categories (typical breakdown)
 */
export const OVERHEAD_CATEGORIES = {
  office_rent: 0.25,           // 25% of overhead
  utilities_phone: 0.08,       // 8% of overhead
  insurance: 0.20,             // 20% of overhead (liability, workers comp, vehicle)
  admin_salaries: 0.30,        // 30% of overhead (office manager, bookkeeper)
  marketing_advertising: 0.10, // 10% of overhead
  vehicles_maintenance: 0.07   // 7% of overhead (office vehicles, maintenance)
};

// ============================================================================
// Profit Targets
// ============================================================================

/**
 * Net profit targets (after overhead)
 * Net Profit = Gross Profit - Overhead
 */
export const NET_PROFIT_TARGETS = {
  minimum: 0.08,    // 8% net profit minimum (survival mode)
  healthy: 0.12,    // 12% net profit (healthy business)
  excellent: 0.18,  // 18% net profit (excellent performance)
  target: 0.15      // 15% net profit target (balanced)
};

/**
 * Return on investment targets
 */
export const ROI_TARGETS = {
  minimum_acceptable: 0.15,  // 15% ROI
  target: 0.25,              // 25% ROI
  excellent: 0.40            // 40% ROI
};

// ============================================================================
// Pricing Strategies
// ============================================================================

/**
 * Pricing strategy modifiers based on market conditions
 */
export const PRICING_STRATEGY_MODIFIERS = {
  emergency_work: {
    multiplier: 1.5,  // 50% premium
    description: 'Emergency or urgent repairs',
    justification: 'After-hours work, expedited scheduling, immediate response'
  },
  off_season: {
    multiplier: 0.90,  // 10% discount
    description: 'Winter or slow season work',
    justification: 'Fill schedule gaps, maintain crew employment'
  },
  peak_season: {
    multiplier: 1.10,  // 10% premium
    description: 'Peak season (Spring/Summer)',
    justification: 'High demand, limited availability'
  },
  repeat_customer: {
    multiplier: 0.95,  // 5% loyalty discount
    description: 'Previous customer returning',
    justification: 'Relationship building, reduced marketing cost'
  },
  referral: {
    multiplier: 0.95,  // 5% referral discount
    description: 'Customer from referral',
    justification: 'Lower acquisition cost'
  },
  large_project: {
    multiplier: 0.92,  // 8% volume discount
    description: 'Large project (> $50k)',
    justification: 'Economy of scale, efficient resource use'
  },
  premium_materials: {
    multiplier: 1.05,  // 5% premium
    description: 'High-end or designer materials',
    justification: 'Specialized knowledge, careful installation'
  },
  warranty_extension: {
    additional_percentage: 0.03,  // 3% for extended warranty
    description: 'Extended warranty beyond standard',
    justification: 'Additional risk coverage and service commitment'
  }
};

// ============================================================================
// Competitive Positioning
// ============================================================================

/**
 * Pricing tiers for competitive positioning
 */
export const COMPETITIVE_PRICING_TIERS = {
  budget: {
    markup_multiplier: 0.85,   // 15% lower than standard
    description: 'Budget option',
    typical_customer: 'Price-sensitive, basic needs',
    limitations: 'Standard materials, basic warranty, limited customization',
    target_margin_reduction: 0.05  // Accept 5% lower margin
  },
  standard: {
    markup_multiplier: 1.0,
    description: 'Standard pricing',
    typical_customer: 'Quality-conscious, fair price expectations',
    limitations: 'Standard warranty, good materials, professional service',
    target_margin_reduction: 0.0
  },
  premium: {
    markup_multiplier: 1.20,   // 20% higher than standard
    description: 'Premium option',
    typical_customer: 'Quality-first, less price-sensitive',
    limitations: 'Extended warranty, premium materials, white-glove service',
    target_margin_increase: 0.05  // Target 5% higher margin
  }
};

// ============================================================================
// Payment Terms Adjustments
// ============================================================================

/**
 * Pricing adjustments based on payment terms
 */
export const PAYMENT_TERM_ADJUSTMENTS = {
  cash_payment: {
    discount: 0.03,  // 3% cash discount
    description: 'Full payment in cash',
    notes: 'Eliminates processing fees, immediate cash flow'
  },
  deposit_50_percent: {
    discount: 0.0,
    description: 'Standard 50% deposit, 50% on completion',
    notes: 'Standard industry practice'
  },
  net_30: {
    premium: 0.02,  // 2% premium
    description: 'Net 30 payment terms',
    notes: 'Covers cost of delayed payment'
  },
  financing: {
    premium: 0.05,  // 5% premium
    description: 'Contractor-arranged financing',
    notes: 'Covers financing costs and risk'
  }
};

// ============================================================================
// Risk-Based Pricing Adjustments
// ============================================================================

/**
 * Pricing adjustments based on project risk factors
 */
export const RISK_BASED_ADJUSTMENTS = {
  high_complexity: {
    adjustment: 0.15,  // 15% increase
    description: 'Highly complex project with significant challenges',
    risk_factors: ['Unusual design', 'Multiple obstacles', 'Tight schedule', 'Uncertain conditions']
  },
  difficult_customer: {
    adjustment: 0.10,  // 10% increase
    description: 'Customer with reputation for being difficult',
    risk_factors: ['History of disputes', 'Unrealistic expectations', 'Poor communication']
  },
  weather_dependent: {
    adjustment: 0.08,  // 8% increase
    description: 'Project highly weather-dependent with tight timeline',
    risk_factors: ['Winter work', 'Weather delays likely', 'Must complete by deadline']
  },
  permit_complexity: {
    adjustment: 0.05,  // 5% increase
    description: 'Complex permitting process expected',
    risk_factors: ['Historic district', 'Multiple agencies', 'Uncertain approval']
  },
  subcontractor_dependent: {
    adjustment: 0.07,  // 7% increase
    description: 'Heavy reliance on subcontractors',
    risk_factors: ['Specialized trades required', 'Coordination challenges', 'Schedule dependencies']
  }
};

// ============================================================================
// Minimum Job Pricing
// ============================================================================

/**
 * Minimum job pricing to ensure profitability
 */
export const MINIMUM_JOB_PRICING: Record<JobType, {
  minimum_total_price: number;
  minimum_margin_dollars: number;
  notes: string;
}> = {
  roofing: {
    minimum_total_price: 3500,
    minimum_margin_dollars: 800,
    notes: 'Minimum to cover overhead and mobilization'
  },
  siding: {
    minimum_total_price: 4000,
    minimum_margin_dollars: 1000,
    notes: 'Siding projects require significant setup'
  },
  windows: {
    minimum_total_price: 800,  // Per window
    minimum_margin_dollars: 250,
    notes: 'Per window minimum; batch discounts apply for multiple'
  },
  doors: {
    minimum_total_price: 1200,
    minimum_margin_dollars: 350,
    notes: 'Per door minimum'
  },
  gutters: {
    minimum_total_price: 1500,
    minimum_margin_dollars: 500,
    notes: 'Minimum for full gutter system'
  },
  general_construction: {
    minimum_total_price: 2000,
    minimum_margin_dollars: 500,
    notes: 'Varies by scope'
  }
};

// ============================================================================
// Contingency & Buffer
// ============================================================================

/**
 * Contingency percentages for unexpected costs
 */
export const CONTINGENCY_PERCENTAGES = {
  low_risk: 0.05,      // 5% for straightforward projects
  moderate_risk: 0.10, // 10% for standard projects
  high_risk: 0.15,     // 15% for complex projects
  very_high_risk: 0.25 // 25% for highly uncertain projects
};

/**
 * Time buffer for scheduling (to protect margin)
 */
export const TIME_BUFFERS = {
  simple_job: 0.10,     // 10% time buffer
  moderate_job: 0.20,   // 20% time buffer
  complex_job: 0.30     // 30% time buffer
};

// ============================================================================
// Financing & Payment Processing Costs
// ============================================================================

/**
 * Costs associated with payment processing
 */
export const PAYMENT_PROCESSING_COSTS = {
  credit_card: 0.025,     // 2.5% processing fee
  ach_bank_transfer: 0.005, // 0.5% processing fee
  check: 0.0,             // No processing fee
  cash: 0.0               // No processing fee
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert markup percentage to margin percentage
 * Formula: Margin = Markup / (1 + Markup)
 */
export function markupToMargin(markup: number): number {
  return markup / (1 + markup);
}

/**
 * Convert margin percentage to markup percentage
 * Formula: Markup = Margin / (1 - Margin)
 */
export function marginToMarkup(margin: number): number {
  return margin / (1 - margin);
}

/**
 * Calculate price from cost and markup
 */
export function calculatePriceFromMarkup(cost: number, markup: number): number {
  return cost * (1 + markup);
}

/**
 * Calculate price from cost and target margin
 */
export function calculatePriceFromMargin(cost: number, margin: number): number {
  return cost / (1 - margin);
}

/**
 * Calculate gross profit
 */
export function calculateGrossProfit(price: number, cost: number): number {
  return price - cost;
}

/**
 * Calculate gross margin percentage
 */
export function calculateGrossMargin(price: number, cost: number): number {
  if (price === 0) return 0;
  return (price - cost) / price;
}

/**
 * Calculate net profit after overhead
 */
export function calculateNetProfit(grossProfit: number, revenue: number, overheadPercentage: number): number {
  const overhead = revenue * overheadPercentage;
  return grossProfit - overhead;
}

/**
 * Calculate break-even price
 */
export function calculateBreakEvenPrice(cost: number, overheadPercentage: number): number {
  // Break-even = Cost / (1 - OverheadPercentage)
  return cost / (1 - overheadPercentage);
}

/**
 * Recommend markup based on job type and complexity
 */
export function recommendMarkup(
  jobType: JobType,
  complexity: 'simple' | 'moderate' | 'complex',
  riskFactors: string[] = []
): {
  base_markup: number;
  risk_adjustment: number;
  final_markup: number;
  explanation: string;
} {
  const baseMarkups = STANDARD_MARKUP_PERCENTAGES[jobType];

  // Select base markup by complexity
  let baseMarkup: number;
  if (complexity === 'simple') {
    baseMarkup = baseMarkups.minimum;
  } else if (complexity === 'complex') {
    baseMarkup = baseMarkups.premium;
  } else {
    baseMarkup = baseMarkups.standard;
  }

  // Calculate risk adjustment
  let riskAdjustment = 0;
  const riskExplanations: string[] = [];

  for (const riskFactor of riskFactors) {
    const riskKey = riskFactor.toLowerCase().replace(/\s+/g, '_') as keyof typeof RISK_BASED_ADJUSTMENTS;
    if (riskKey in RISK_BASED_ADJUSTMENTS) {
      riskAdjustment += RISK_BASED_ADJUSTMENTS[riskKey].adjustment;
      riskExplanations.push(RISK_BASED_ADJUSTMENTS[riskKey].description);
    }
  }

  const finalMarkup = baseMarkup + riskAdjustment;

  return {
    base_markup: baseMarkup,
    risk_adjustment: riskAdjustment,
    final_markup: finalMarkup,
    explanation: riskExplanations.length > 0
      ? `Base ${(baseMarkup * 100).toFixed(0)}% + ${(riskAdjustment * 100).toFixed(0)}% risk = ${(finalMarkup * 100).toFixed(0)}%`
      : `Standard ${(baseMarkup * 100).toFixed(0)}% markup for ${complexity} ${jobType}`
  };
}

/**
 * Calculate recommended price with all factors
 */
export function calculateRecommendedPrice(
  totalCost: number,
  jobType: JobType,
  options: {
    complexity?: 'simple' | 'moderate' | 'complex';
    riskFactors?: string[];
    paymentTerms?: keyof typeof PAYMENT_TERM_ADJUSTMENTS;
    pricingTier?: keyof typeof COMPETITIVE_PRICING_TIERS;
    includeContingency?: boolean;
  } = {}
): {
  base_price: number;
  adjustments: { reason: string; amount: number }[];
  final_price: number;
  margin_percentage: number;
} {
  const complexity = options.complexity || 'moderate';
  const riskFactors = options.riskFactors || [];

  // Get recommended markup
  const markupInfo = recommendMarkup(jobType, complexity, riskFactors);
  let basePrice = calculatePriceFromMarkup(totalCost, markupInfo.final_markup);

  const adjustments: { reason: string; amount: number }[] = [];

  // Apply pricing tier adjustment
  if (options.pricingTier) {
    const tier = COMPETITIVE_PRICING_TIERS[options.pricingTier];
    const adjustment = basePrice * (tier.markup_multiplier - 1);
    adjustments.push({
      reason: `${options.pricingTier} tier (${tier.description})`,
      amount: adjustment
    });
    basePrice += adjustment;
  }

  // Apply payment terms adjustment
  if (options.paymentTerms && options.paymentTerms in PAYMENT_TERM_ADJUSTMENTS) {
    const terms = PAYMENT_TERM_ADJUSTMENTS[options.paymentTerms];
    const adjustmentPercent = (terms as any).discount ? -(terms as any).discount : (terms as any).premium || 0;
    const adjustment = basePrice * adjustmentPercent;
    adjustments.push({
      reason: `Payment terms: ${terms.description}`,
      amount: adjustment
    });
    basePrice += adjustment;
  }

  // Apply contingency if requested
  if (options.includeContingency) {
    const contingencyPercent = complexity === 'complex'
      ? CONTINGENCY_PERCENTAGES.high_risk
      : complexity === 'simple'
        ? CONTINGENCY_PERCENTAGES.low_risk
        : CONTINGENCY_PERCENTAGES.moderate_risk;

    const contingencyAmount = basePrice * contingencyPercent;
    adjustments.push({
      reason: `Contingency (${(contingencyPercent * 100).toFixed(0)}%)`,
      amount: contingencyAmount
    });
    basePrice += contingencyAmount;
  }

  // Check against minimum job pricing
  const minimumPrice = MINIMUM_JOB_PRICING[jobType].minimum_total_price;
  if (basePrice < minimumPrice) {
    adjustments.push({
      reason: `Minimum job price for ${jobType}`,
      amount: minimumPrice - basePrice
    });
    basePrice = minimumPrice;
  }

  const marginPercentage = calculateGrossMargin(basePrice, totalCost);

  return {
    base_price: basePrice,
    adjustments,
    final_price: Math.round(basePrice / 100) * 100, // Round to nearest $100
    margin_percentage: marginPercentage
  };
}
