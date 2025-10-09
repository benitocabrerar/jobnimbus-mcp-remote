/**
 * Packaging and Bulk Discount Constants
 * Packaging rules, bulk discounts, and supplier information
 */

import type { PackagingRule, BulkDiscountTier } from '../types/calculations.types.js';

// ============================================================================
// Packaging Rules
// ============================================================================

/**
 * Packaging rules by SKU
 * Defines how materials are packaged and minimum order quantities
 */
export const PACKAGING_RULES: Record<string, PackagingRule> = {
  // Shingles
  'SHNG-ARCH-001': {
    sku: 'SHNG-ARCH-001',
    units_per_package: 1, // Bundle
    min_order_quantity: 3, // Minimum 1 square (3 bundles)
    package_uom: 'bundle'
  },
  'SHNG-3TAB-001': {
    sku: 'SHNG-3TAB-001',
    units_per_package: 1,
    min_order_quantity: 3,
    package_uom: 'bundle'
  },

  // Underlayment
  'UND-FELT-15': {
    sku: 'UND-FELT-15',
    units_per_package: 1, // Roll
    min_order_quantity: 1,
    package_uom: 'roll'
  },
  'UND-SYNTH-001': {
    sku: 'UND-SYNTH-001',
    units_per_package: 1,
    min_order_quantity: 1,
    package_uom: 'roll'
  },

  // Ice & Water Shield
  'ICE-WATER-001': {
    sku: 'ICE-WATER-001',
    units_per_package: 1,
    min_order_quantity: 1,
    package_uom: 'roll'
  },

  // Drip Edge - sold in bundles of 10 pieces
  'DRIP-ALU-001': {
    sku: 'DRIP-ALU-001',
    units_per_package: 10, // 10 pieces per bundle
    min_order_quantity: 10,
    package_uom: 'piece'
  },

  // Ridge Cap
  'RIDGE-CAP-001': {
    sku: 'RIDGE-CAP-001',
    units_per_package: 1,
    min_order_quantity: 1,
    package_uom: 'bundle'
  },

  // Starter Strip
  'START-STRIP-001': {
    sku: 'START-STRIP-001',
    units_per_package: 1,
    min_order_quantity: 1,
    package_uom: 'roll'
  },

  // Valley Flashing
  'VALLEY-FLASH-001': {
    sku: 'VALLEY-FLASH-001',
    units_per_package: 1,
    min_order_quantity: 1,
    package_uom: 'roll'
  },

  // Nails - sold by box
  'NAIL-COIL-001': {
    sku: 'NAIL-COIL-001',
    units_per_package: 1,
    min_order_quantity: 1,
    package_uom: 'box'
  },

  // Pipe Boots - sold in packs of 5
  'BOOT-PIPE-001': {
    sku: 'BOOT-PIPE-001',
    units_per_package: 5,
    min_order_quantity: 5,
    package_uom: 'piece'
  }
};

/**
 * Get packaging rule for SKU
 */
export function getPackagingRule(sku: string): PackagingRule | null {
  return PACKAGING_RULES[sku] || null;
}

/**
 * Round quantity up to nearest packaging unit
 * @param quantity Desired quantity
 * @param sku Material SKU
 * @returns Rounded quantity that meets packaging requirements
 */
export function roundToPackagingUnit(quantity: number, sku: string): {
  rounded_quantity: number;
  packages: number;
  adjustment: number;
} {
  const rule = getPackagingRule(sku);

  if (!rule) {
    return {
      rounded_quantity: Math.ceil(quantity),
      packages: Math.ceil(quantity),
      adjustment: Math.ceil(quantity) - quantity
    };
  }

  // Calculate packages needed
  const packages = Math.ceil(quantity / rule.units_per_package);

  // Ensure minimum order quantity
  const actual_packages = Math.max(
    packages,
    Math.ceil(rule.min_order_quantity / rule.units_per_package)
  );

  const rounded_quantity = actual_packages * rule.units_per_package;

  return {
    rounded_quantity,
    packages: actual_packages,
    adjustment: rounded_quantity - quantity
  };
}

// ============================================================================
// Bulk Discount Tiers
// ============================================================================

/**
 * Bulk discount tiers by category
 * Larger quantities = larger discounts
 */
export const BULK_DISCOUNT_TIERS: Record<string, BulkDiscountTier[]> = {
  // Shingles discounts (by squares)
  shingles: [
    { min_quantity: 1, discount_percent: 0, description: 'Standard price' },
    { min_quantity: 10, discount_percent: 3, description: '3% off 10+ squares' },
    { min_quantity: 20, discount_percent: 5, description: '5% off 20+ squares' },
    { min_quantity: 50, discount_percent: 8, description: '8% off 50+ squares' },
    { min_quantity: 100, discount_percent: 12, description: '12% off 100+ squares' }
  ],

  // Underlayment discounts (by rolls)
  underlayment: [
    { min_quantity: 1, discount_percent: 0, description: 'Standard price' },
    { min_quantity: 10, discount_percent: 5, description: '5% off 10+ rolls' },
    { min_quantity: 25, discount_percent: 10, description: '10% off 25+ rolls' },
    { min_quantity: 50, discount_percent: 15, description: '15% off 50+ rolls' }
  ],

  // Accessories discounts (generic)
  accessories: [
    { min_quantity: 1, discount_percent: 0, description: 'Standard price' },
    { min_quantity: 20, discount_percent: 5, description: '5% off 20+ units' },
    { min_quantity: 50, discount_percent: 10, description: '10% off 50+ units' }
  ],

  // Metal roofing discounts (by sheets)
  metal: [
    { min_quantity: 1, discount_percent: 0, description: 'Standard price' },
    { min_quantity: 20, discount_percent: 5, description: '5% off 20+ sheets' },
    { min_quantity: 50, discount_percent: 10, description: '10% off 50+ sheets' },
    { min_quantity: 100, discount_percent: 15, description: '15% off 100+ sheets' }
  ],

  // Tile discounts (by pieces)
  tile: [
    { min_quantity: 1, discount_percent: 0, description: 'Standard price' },
    { min_quantity: 100, discount_percent: 3, description: '3% off 100+ pieces' },
    { min_quantity: 500, discount_percent: 7, description: '7% off 500+ pieces' },
    { min_quantity: 1000, discount_percent: 12, description: '12% off 1000+ pieces' }
  ]
};

/**
 * Get applicable bulk discount
 * @param category Material category (shingles, underlayment, accessories, metal, tile)
 * @param quantity Quantity to purchase
 * @returns Best applicable discount tier
 */
export function getBulkDiscount(category: string, quantity: number): BulkDiscountTier {
  const tiers = BULK_DISCOUNT_TIERS[category] || BULK_DISCOUNT_TIERS.accessories;

  // Find the highest discount tier that applies
  let applicable_tier = tiers[0]; // Default to no discount

  for (const tier of tiers) {
    if (quantity >= tier.min_quantity) {
      applicable_tier = tier;
    } else {
      break; // Tiers are sorted ascending
    }
  }

  return applicable_tier;
}

/**
 * Map material type to discount category
 */
export function getMaterialDiscountCategory(material_type: string): string {
  const lowerType = material_type.toLowerCase();

  if (lowerType.includes('shingle')) return 'shingles';
  if (lowerType.includes('underlayment')) return 'underlayment';
  if (lowerType.includes('metal')) return 'metal';
  if (lowerType.includes('tile')) return 'tile';

  return 'accessories'; // Default category
}

/**
 * Calculate next discount tier threshold
 */
export function getNextDiscountThreshold(
  category: string,
  current_quantity: number
): { next_tier: BulkDiscountTier | null; additional_needed: number } {
  const tiers = BULK_DISCOUNT_TIERS[category] || BULK_DISCOUNT_TIERS.accessories;

  // Find next tier
  for (const tier of tiers) {
    if (current_quantity < tier.min_quantity) {
      return {
        next_tier: tier,
        additional_needed: tier.min_quantity - current_quantity
      };
    }
  }

  // Already at highest tier
  return {
    next_tier: null,
    additional_needed: 0
  };
}

// ============================================================================
// Supplier Information
// ============================================================================

export interface SupplierInfo {
  supplier_name: string;
  delivery_days: number;
  min_order_amount?: number; // Minimum order $ amount
  delivery_fee: number;
  free_delivery_threshold?: number; // Free delivery above this amount
  reliability_score: number; // 0-10
  preferred_categories: string[];
}

export const SUPPLIER_DATABASE: SupplierInfo[] = [
  {
    supplier_name: 'ABC Building Supply',
    delivery_days: 1,
    min_order_amount: 500,
    delivery_fee: 75,
    free_delivery_threshold: 2500,
    reliability_score: 9.5,
    preferred_categories: ['shingles', 'underlayment', 'accessories']
  },
  {
    supplier_name: 'Roofing Depot',
    delivery_days: 2,
    min_order_amount: 250,
    delivery_fee: 50,
    free_delivery_threshold: 2000,
    reliability_score: 8.8,
    preferred_categories: ['shingles', 'metal', 'tile']
  },
  {
    supplier_name: 'Pro Materials Direct',
    delivery_days: 1,
    delivery_fee: 100,
    free_delivery_threshold: 5000,
    reliability_score: 9.2,
    preferred_categories: ['metal', 'tile', 'premium']
  },
  {
    supplier_name: 'Local Lumber & Supply',
    delivery_days: 0, // Same day
    min_order_amount: 100,
    delivery_fee: 35,
    free_delivery_threshold: 1000,
    reliability_score: 8.0,
    preferred_categories: ['accessories', 'underlayment']
  }
];

/**
 * Get best supplier for order
 * @param order_total Total order amount
 * @param urgency Delivery urgency
 * @returns Recommended supplier
 */
export function getRecommendedSupplier(
  order_total: number,
  urgency: 'standard' | 'rush' | 'next_day' = 'standard'
): SupplierInfo {
  let candidates = [...SUPPLIER_DATABASE];

  // Filter by urgency
  if (urgency === 'next_day') {
    candidates = candidates.filter(s => s.delivery_days <= 1);
  } else if (urgency === 'rush') {
    candidates = candidates.filter(s => s.delivery_days <= 2);
  }

  // Score each supplier
  const scored = candidates.map(supplier => {
    let score = supplier.reliability_score;

    // Bonus for free delivery
    if (supplier.free_delivery_threshold && order_total >= supplier.free_delivery_threshold) {
      score += 2;
    }

    // Penalty for high delivery fee
    if (supplier.delivery_fee > 75) {
      score -= 1;
    }

    // Bonus for no minimum
    if (!supplier.min_order_amount || order_total >= supplier.min_order_amount) {
      score += 0.5;
    }

    return { supplier, score };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  return scored[0].supplier;
}
