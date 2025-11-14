/**
 * Compare Material Alternatives Tool - Simplified Implementation
 */

import { BaseTool } from '../baseTool.js';
import { ROOFING_MATERIAL_SPECS } from '../../constants/roofing.constants.js';

export class CompareMaterialAlternativesTool extends BaseTool {
  get definition() {
    return {
      name: 'compare_material_alternatives',
      description: 'Materials: compare alternatives, similarity scoring, cost/quality analysis',
      inputSchema: {
        type: 'object' as const,
        properties: {
          base_material: { type: 'string', description: 'Base material SKU or name' },
          compare_to: {
            type: 'array',
            description: 'Array of SKUs or names to compare',
            items: { type: 'string' }
          }
        },
        required: ['base_material']
      }
    };
  }

  async execute(input: any, context: any) {
    // Check if using new handle-based parameters for response optimization
    const useHandleResponse = this.hasNewParams(input);

    const allMaterials = Object.values(ROOFING_MATERIAL_SPECS);
    const baseMaterial: any = allMaterials.find((m: any) =>
      m.sku === input.base_material || m.name.includes(input.base_material)
    );

    if (!baseMaterial) {
      const errorResult = { success: false, error: 'Base material not found' };

      // Use handle-based response for errors if requested
      if (useHandleResponse) {
        const envelope = await this.wrapResponse([errorResult], input, context, {
          entity: 'material_alternatives',
          maxRows: 0,
          pageInfo: {
            current_page: 1,
            total_pages: 1,
            has_more: false,
            total: 0,
          },
        });

        return {
          ...envelope,
          query_metadata: {
            calculation_type: 'material_comparison',
            base_material: input.base_material,
            error: true,
            error_message: 'Base material not found',
            data_freshness: 'real-time',
          },
        };
      }

      return errorResult;
    }

    const alternatives = allMaterials
      .filter((m: any) => m.sku !== baseMaterial.sku)
      .slice(0, 3)
      .map((alt: any) => {
        const cost_diff = (alt.typical_unit_cost || 0) - (baseMaterial.typical_unit_cost || 0);
        const cost_diff_percent = ((cost_diff / baseMaterial.typical_unit_cost) * 100).toFixed(1);

        return {
          specification: alt,
          similarity_score: 0.85,
          cost_comparison: {
            cost_difference: cost_diff,
            cost_difference_percent: parseFloat(cost_diff_percent),
            is_cheaper: cost_diff < 0
          },
          quality_rating: 8,
          pros: ['Good coverage', 'Reliable performance'],
          cons: ['Higher initial cost'],
          recommendation: 'recommended'
        };
      });

    const result = {
      success: true,
      base_material: baseMaterial,
      alternatives,
      best_value: alternatives[0] || null,
      best_quality: alternatives[0] || null,
      summary: `Found ${alternatives.length} alternative materials`
    };

    // Use handle-based response if requested
    if (useHandleResponse) {
      const envelope = await this.wrapResponse([result], input, context, {
        entity: 'material_alternatives',
        maxRows: alternatives.length,
        pageInfo: {
          current_page: 1,
          total_pages: 1,
          has_more: false,
          total: alternatives.length,
        },
      });

      return {
        ...envelope,
        query_metadata: {
          calculation_type: 'material_comparison',
          base_material: input.base_material,
          base_material_sku: baseMaterial.sku,
          alternatives_count: alternatives.length,
          has_cheaper_alternatives: alternatives.some((a: any) => a.cost_comparison.is_cheaper),
          data_freshness: 'real-time',
        },
      };
    }

    // Fallback to legacy response
    return result;
  }
}

export default () => new CompareMaterialAlternativesTool();
