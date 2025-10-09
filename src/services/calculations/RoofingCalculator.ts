/**
 * Roofing Calculator Service
 * Calculates roofing materials based on industry standards
 */

import type {
  RoofingCalculationInput,
  RoofingCalculationResult,
  MaterialLineItem,
  RoofComplexity
} from '../../types/calculations.types.js';
import {
  getPitchMultiplier,
  ROOFING_MATERIAL_SPECS,
  ROOFING_ACCESSORIES,
  calculateShingleBundles,
  calculateRolls,
  calculateLinearMaterial
} from '../../constants/roofing.constants.js';
import { getRoofingWasteFactor, determineComplexity } from '../../constants/waste-factors.constants.js';

export class RoofingCalculator {
  /**
   * Calculate all materials needed for a roofing job
   */
  async calculateMaterials(input: RoofingCalculationInput): Promise<RoofingCalculationResult> {
    // Validate input
    this.validateInput(input);

    // Get pitch multiplier
    const pitchMultiplier = getPitchMultiplier(input.pitch);

    // Calculate adjusted area
    const adjustedAreaSqft = input.roof_area_sqft * pitchMultiplier;

    // Convert to roofing squares
    const baseSquares = adjustedAreaSqft / 100;

    // Determine complexity
    const complexity = input.roof_complexity || this.determineComplexityFromInput(input);

    // Get waste factor
    const includedWaste = input.include_waste !== false; // Default true
    const wasteFactor = includedWaste ? getRoofingWasteFactor(input.roof_type, complexity) : 0;

    // Calculate total squares with waste
    const totalSquares = baseSquares * (1 + wasteFactor);

    // Initialize materials array
    const materials: MaterialLineItem[] = [];

    // 1. Primary roofing material (shingles, metal, tile, etc.)
    const primaryMaterial = this.calculatePrimaryMaterial(input.roof_type, totalSquares);
    materials.push(primaryMaterial);

    // 2. Underlayment
    const underlayment = this.calculateUnderlayment(adjustedAreaSqft, wasteFactor);
    materials.push(underlayment);

    // 3. Ice & Water Shield
    if (input.eave_length_lf && input.eave_length_lf > 0) {
      const iceAndWater = this.calculateIceAndWater(input.eave_length_lf, wasteFactor);
      materials.push(iceAndWater);
    }

    // 4. Drip Edge
    const totalEdge = (input.eave_length_lf || 0) + (input.rake_length_lf || 0);
    if (totalEdge > 0) {
      const dripEdge = this.calculateDripEdge(totalEdge, wasteFactor);
      materials.push(dripEdge);
    }

    // 5. Ridge Cap
    if (input.ridge_length_lf && input.ridge_length_lf > 0) {
      const ridgeCap = this.calculateRidgeCap(input.ridge_length_lf, wasteFactor);
      materials.push(ridgeCap);
    }

    // 6. Valley Flashing
    if (input.valley_length_lf && input.valley_length_lf > 0) {
      const valleyFlashing = this.calculateValleyFlashing(input.valley_length_lf, wasteFactor);
      materials.push(valleyFlashing);
    }

    // 7. Starter Strip
    const starterLength = input.eave_length_lf || (Math.sqrt(adjustedAreaSqft) * 2); // Estimate if not provided
    const starterStrip = this.calculateStarterStrip(starterLength, wasteFactor);
    materials.push(starterStrip);

    // 8. Nails
    const nails = this.calculateNails(totalSquares);
    materials.push(nails);

    // 9. Pipe Boots
    if (input.penetrations && input.penetrations > 0) {
      const pipeBoots = this.calculatePipeBoots(input.penetrations);
      materials.push(pipeBoots);
    }

    // Calculate totals
    const totals = this.calculateTotals(materials, baseSquares);

    // Generate recommendations
    const recommendations = this.generateRecommendations(input, complexity, wasteFactor);

    // Generate warnings
    const warnings = this.generateWarnings(input, adjustedAreaSqft);

    return {
      calculation_summary: {
        input_area_sqft: input.roof_area_sqft,
        pitch_multiplier: pitchMultiplier,
        adjusted_area_sqft: adjustedAreaSqft,
        base_squares: baseSquares,
        total_squares: totalSquares,
        waste_factor: wasteFactor,
        complexity
      },
      materials,
      totals,
      recommendations,
      warnings
    };
  }

  // ============================================================================
  // Individual Material Calculations
  // ============================================================================

  private calculatePrimaryMaterial(roofType: string, totalSquares: number): MaterialLineItem {
    const spec = ROOFING_MATERIAL_SPECS[roofType as keyof typeof ROOFING_MATERIAL_SPECS];

    if (!spec) {
      throw new Error(`Unknown roof type: ${roofType}`);
    }

    let quantity: number;
    let description: string;

    if (roofType.includes('shingle')) {
      // Shingles: 3 bundles per square
      quantity = calculateShingleBundles(totalSquares);
      description = `${spec.name} - ${Math.ceil(totalSquares)} squares`;
    } else if (roofType.includes('metal') || roofType.includes('membrane')) {
      // Metal/Membrane: Calculate by coverage
      quantity = Math.ceil((totalSquares * 100) / spec.coverage_per_unit);
      description = `${spec.name} - ${quantity} sheets`;
    } else if (roofType.includes('tile') || roofType.includes('slate')) {
      // Tile/Slate: Calculate by piece
      quantity = Math.ceil(totalSquares * 100 / spec.coverage_per_unit);
      description = `${spec.name} - ${quantity} pieces`;
    } else {
      // Default calculation
      quantity = Math.ceil((totalSquares * 100) / spec.coverage_per_unit);
      description = spec.name;
    }

    return {
      sku: spec.sku,
      name: spec.name,
      description,
      material_type: spec.material_type,
      quantity,
      uom: spec.uom,
      unit_cost: spec.typical_unit_cost || 0,
      unit_price: spec.typical_unit_price || 0,
      total_cost: quantity * (spec.typical_unit_cost || 0),
      total_price: quantity * (spec.typical_unit_price || 0),
      coverage_sqft: totalSquares * 100
    };
  }

  private calculateUnderlayment(adjustedArea: number, wasteFactor: number): MaterialLineItem {
    const spec = ROOFING_ACCESSORIES.underlayment_synthetic;
    const areaWithWaste = adjustedArea * (1 + wasteFactor);
    const quantity = calculateRolls(areaWithWaste, spec.coverage_per_unit);

    return {
      sku: spec.sku,
      name: spec.name,
      description: `${quantity} rolls - covers ${Math.round(areaWithWaste)} sqft`,
      material_type: spec.material_type,
      quantity,
      uom: spec.uom,
      unit_cost: spec.typical_unit_cost || 0,
      unit_price: spec.typical_unit_price || 0,
      total_cost: quantity * (spec.typical_unit_cost || 0),
      total_price: quantity * (spec.typical_unit_price || 0),
      coverage_sqft: areaWithWaste,
      waste_factor: wasteFactor
    };
  }

  private calculateIceAndWater(eaveLength: number, wasteFactor: number): MaterialLineItem {
    const spec = ROOFING_ACCESSORIES.ice_and_water_shield;
    // Ice & Water typically covers 3 feet up from eave
    const area = eaveLength * 3 * (1 + wasteFactor);
    const quantity = calculateRolls(area, spec.coverage_per_unit);

    return {
      sku: spec.sku,
      name: spec.name,
      description: `${quantity} rolls - ${eaveLength} lf eave x 3ft coverage`,
      material_type: spec.material_type,
      quantity,
      uom: spec.uom,
      unit_cost: spec.typical_unit_cost || 0,
      unit_price: spec.typical_unit_price || 0,
      total_cost: quantity * (spec.typical_unit_cost || 0),
      total_price: quantity * (spec.typical_unit_price || 0),
      coverage_sqft: area
    };
  }

  private calculateDripEdge(totalEdge: number, wasteFactor: number): MaterialLineItem {
    const spec = ROOFING_ACCESSORIES.drip_edge_aluminum;
    const lengthWithWaste = totalEdge * (1 + wasteFactor);
    const quantity = calculateLinearMaterial(lengthWithWaste, spec.coverage_per_unit);

    return {
      sku: spec.sku,
      name: spec.name,
      description: `${quantity} pieces - ${Math.round(totalEdge)} lf`,
      material_type: spec.material_type,
      quantity,
      uom: spec.uom,
      unit_cost: spec.typical_unit_cost || 0,
      unit_price: spec.typical_unit_price || 0,
      total_cost: quantity * (spec.typical_unit_cost || 0),
      total_price: quantity * (spec.typical_unit_price || 0)
    };
  }

  private calculateRidgeCap(ridgeLength: number, wasteFactor: number): MaterialLineItem {
    const spec = ROOFING_ACCESSORIES.ridge_cap_shingles;
    const lengthWithWaste = ridgeLength * (1 + wasteFactor);
    const quantity = Math.ceil(lengthWithWaste / spec.coverage_per_unit);

    return {
      sku: spec.sku,
      name: spec.name,
      description: `${quantity} bundles - ${Math.round(ridgeLength)} lf ridge`,
      material_type: spec.material_type,
      quantity,
      uom: spec.uom,
      unit_cost: spec.typical_unit_cost || 0,
      unit_price: spec.typical_unit_price || 0,
      total_cost: quantity * (spec.typical_unit_cost || 0),
      total_price: quantity * (spec.typical_unit_price || 0)
    };
  }

  private calculateValleyFlashing(valleyLength: number, wasteFactor: number): MaterialLineItem {
    const spec = ROOFING_ACCESSORIES.valley_flashing;
    const lengthWithWaste = valleyLength * (1 + wasteFactor);
    const quantity = calculateLinearMaterial(lengthWithWaste, spec.coverage_per_unit);

    return {
      sku: spec.sku,
      name: spec.name,
      description: `${quantity} rolls - ${Math.round(valleyLength)} lf valley`,
      material_type: spec.material_type,
      quantity,
      uom: spec.uom,
      unit_cost: spec.typical_unit_cost || 0,
      unit_price: spec.typical_unit_price || 0,
      total_cost: quantity * (spec.typical_unit_cost || 0),
      total_price: quantity * (spec.typical_unit_price || 0)
    };
  }

  private calculateStarterStrip(eaveLength: number, wasteFactor: number): MaterialLineItem {
    const spec = ROOFING_ACCESSORIES.starter_strip;
    const lengthWithWaste = eaveLength * (1 + wasteFactor);
    const quantity = Math.ceil(lengthWithWaste / spec.coverage_per_unit);

    return {
      sku: spec.sku,
      name: spec.name,
      description: `${quantity} rolls - ${Math.round(eaveLength)} lf starter`,
      material_type: spec.material_type,
      quantity,
      uom: spec.uom,
      unit_cost: spec.typical_unit_cost || 0,
      unit_price: spec.typical_unit_price || 0,
      total_cost: quantity * (spec.typical_unit_cost || 0),
      total_price: quantity * (spec.typical_unit_price || 0)
    };
  }

  private calculateNails(totalSquares: number): MaterialLineItem {
    const spec = ROOFING_ACCESSORIES.roofing_nails_coil;
    // Estimate: 2 boxes per 10 squares
    const quantity = Math.max(1, Math.ceil(totalSquares / 5));

    return {
      sku: spec.sku,
      name: spec.name,
      description: `${quantity} boxes - ${Math.round(totalSquares)} squares`,
      material_type: spec.material_type,
      quantity,
      uom: spec.uom,
      unit_cost: spec.typical_unit_cost || 0,
      unit_price: spec.typical_unit_price || 0,
      total_cost: quantity * (spec.typical_unit_cost || 0),
      total_price: quantity * (spec.typical_unit_price || 0)
    };
  }

  private calculatePipeBoots(penetrations: number): MaterialLineItem {
    const spec = ROOFING_ACCESSORIES.pipe_boot;
    const quantity = penetrations;

    return {
      sku: spec.sku,
      name: spec.name,
      description: `${quantity} pipe boots`,
      material_type: spec.material_type,
      quantity,
      uom: spec.uom,
      unit_cost: spec.typical_unit_cost || 0,
      unit_price: spec.typical_unit_price || 0,
      total_cost: quantity * (spec.typical_unit_cost || 0),
      total_price: quantity * (spec.typical_unit_price || 0)
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private validateInput(input: RoofingCalculationInput): void {
    if (!input.roof_area_sqft || input.roof_area_sqft <= 0) {
      throw new Error('Roof area must be greater than 0');
    }

    if (!input.pitch) {
      throw new Error('Roof pitch is required');
    }

    if (!input.roof_type) {
      throw new Error('Roof type is required');
    }
  }

  private determineComplexityFromInput(input: RoofingCalculationInput): RoofComplexity {
    return determineComplexity({
      valleys: input.valley_length_lf ? Math.floor(input.valley_length_lf / 10) : 0,
      penetrations: input.penetrations || 0
    });
  }

  private calculateTotals(materials: MaterialLineItem[], baseSquares: number) {
    const total_cost = materials.reduce((sum, m) => sum + m.total_cost, 0);
    const total_price = materials.reduce((sum, m) => sum + m.total_price, 0);
    const margin = total_price - total_cost;
    const margin_percent = total_price > 0 ? (margin / total_price) * 100 : 0;

    return {
      total_materials_count: materials.length,
      total_cost,
      total_price,
      cost_per_square: baseSquares > 0 ? total_cost / baseSquares : 0,
      price_per_square: baseSquares > 0 ? total_price / baseSquares : 0,
      margin_percent
    };
  }

  private generateRecommendations(
    input: RoofingCalculationInput,
    complexity: RoofComplexity,
    wasteFactor: number
  ): string[] {
    const recommendations: string[] = [];

    if (complexity === 'complex') {
      recommendations.push('Complex roof design - consider adding extra time for installation');
      recommendations.push(`Increased waste factor (${(wasteFactor * 100).toFixed(0)}%) applied due to complexity`);
    }

    if (input.layers_to_remove && input.layers_to_remove > 0) {
      recommendations.push(`Plan for tear-off of ${input.layers_to_remove} existing layer(s)`);
    }

    if (input.penetrations && input.penetrations > 10) {
      recommendations.push('High number of penetrations - ensure proper flashing for each');
    }

    return recommendations;
  }

  private generateWarnings(input: RoofingCalculationInput, adjustedArea: number): string[] {
    const warnings: string[] = [];

    if (adjustedArea > 50000) {
      warnings.push('Very large roof area - verify measurements');
    }

    if (!input.ridge_length_lf && !input.valley_length_lf) {
      warnings.push('No ridge or valley lengths provided - accessories may need adjustment');
    }

    return warnings;
  }
}
