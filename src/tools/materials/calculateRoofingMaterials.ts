/**
 * Calculate Roofing Materials Tool
 * Industry-standard roofing material calculations with pitch multipliers and waste factors
 */

import { BaseTool } from '../baseTool.js';
import { RoofingCalculator } from '../../services/calculations/RoofingCalculator.js';
import type { RoofingCalculationInput } from '../../types/calculations.types.js';

export class CalculateRoofingMaterialsTool extends BaseTool {
  private calculator = new RoofingCalculator();

  get definition() {
    return {
      name: 'calculate_roofing_materials',
      description: 'Materials: roofing calculations, pitch multipliers, waste factors, SKU/costs',
      inputSchema: {
        type: 'object' as const,
        properties: {
          roof_area_sqft: {
            type: 'number',
            description: 'Roof area in square feet (flat/horizontal measurement)'
          },
          pitch: {
            type: 'string',
            description: 'Roof pitch (e.g., "4/12", "6/12", "8/12"). Common residential: 4/12 to 8/12'
          },
          roof_type: {
            type: 'string',
            description: 'Type of roofing material',
            enum: [
              'architectural_shingles',
              '3tab_shingles',
              'metal_standing_seam',
              'metal_corrugated',
              'tile_concrete',
              'tile_clay',
              'slate',
              'flat_membrane_tpo',
              'flat_membrane_epdm'
            ]
          },
          roof_complexity: {
            type: 'string',
            description: 'Roof complexity level (affects waste factor)',
            enum: ['simple', 'moderate', 'complex']
          },
          include_waste: {
            type: 'boolean',
            description: 'Include waste factor in calculations (default: true)'
          },
          ridge_length_lf: {
            type: 'number',
            description: 'Ridge length in linear feet'
          },
          valley_length_lf: {
            type: 'number',
            description: 'Valley length in linear feet'
          },
          eave_length_lf: {
            type: 'number',
            description: 'Eave length in linear feet'
          },
          rake_length_lf: {
            type: 'number',
            description: 'Rake edge length in linear feet'
          },
          penetrations: {
            type: 'number',
            description: 'Number of roof penetrations (vents, chimneys, etc.)'
          },
          layers_to_remove: {
            type: 'number',
            description: 'Number of existing roofing layers to tear off'
          }
        },
        required: ['roof_area_sqft', 'pitch', 'roof_type']
      }
    };
  }

  async execute(input: RoofingCalculationInput, context: any) {
    try {
      // Calculate materials using RoofingCalculator service
      const result = await this.calculator.calculateMaterials(input);

      return {
        success: true,
        calculation_summary: result.calculation_summary,
        materials: result.materials,
        totals: result.totals,
        recommendations: result.recommendations,
        warnings: result.warnings,
        metadata: {
          calculated_at: new Date().toISOString(),
          instance: context.instanceName || 'unknown'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Calculation failed',
        details: error
      };
    }
  }
}

// Export default instance creator
export default () => new CalculateRoofingMaterialsTool();
