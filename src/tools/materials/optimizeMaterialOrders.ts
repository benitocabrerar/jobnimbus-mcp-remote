/**
 * Optimize Material Orders Tool - Simplified Implementation
 */

import { BaseTool } from '../baseTool.js';
import { getBulkDiscount, roundToPackagingUnit } from '../../constants/packaging.constants.js';

export class OptimizeMaterialOrdersTool extends BaseTool {
  get definition() {
    return {
      name: 'optimize_material_orders',
      description: 'Materials: optimize orders, bulk discounts, packaging, supplier recommendations',
      inputSchema: {
        type: 'object' as const,
        properties: {
          materials: {
            type: 'array',
            description: 'Array of materials to optimize',
            items: {
              type: 'object',
              properties: {
                sku: { type: 'string' },
                quantity: { type: 'number' },
                unit_cost: { type: 'number' }
              }
            }
          }
        },
        required: ['materials']
      }
    };
  }

  async execute(input: any, context: any) {
    // Check if using new handle-based parameters for response optimization
    const useHandleResponse = this.hasNewParams(input);

    const optimized = input.materials.map((material: any) => {
      const packaging = roundToPackagingUnit(material.quantity, material.sku);
      const discount = getBulkDiscount('shingles', packaging.rounded_quantity);
      const discounted_cost = material.unit_cost * (1 - discount.discount_percent / 100);

      return {
        original: material,
        optimized: {
          ...material,
          quantity: packaging.rounded_quantity,
          unit_cost: discounted_cost,
          total_cost: packaging.rounded_quantity * discounted_cost
        },
        discount_applied: discount,
        savings: material.quantity * material.unit_cost - packaging.rounded_quantity * discounted_cost
      };
    });

    const total_savings = optimized.reduce((sum: number, m: any) => sum + (m.savings || 0), 0);
    const original_cost = input.materials.reduce((sum: number, m: any) => sum + m.quantity * m.unit_cost, 0);

    const result = {
      success: true,
      optimized_materials: optimized,
      totals: {
        original_cost,
        optimized_cost: optimized.reduce((sum: number, m: any) => sum + m.optimized.total_cost, 0),
        total_savings,
        savings_percent: (total_savings / original_cost * 100).toFixed(1)
      }
    };

    // Use handle-based response if requested
    if (useHandleResponse) {
      const envelope = await this.wrapResponse([result], input, context, {
        entity: 'optimized_material_orders',
        maxRows: optimized.length,
        pageInfo: {
          current_page: 1,
          total_pages: 1,
          has_more: false,
          total: optimized.length,
        },
      });

      return {
        ...envelope,
        query_metadata: {
          calculation_type: 'material_order_optimization',
          materials_count: input.materials.length,
          optimized_count: optimized.length,
          total_savings: total_savings,
          savings_percent: result.totals.savings_percent,
          data_freshness: 'real-time',
        },
      };
    }

    // Fallback to legacy response
    return result;
  }
}

export default () => new OptimizeMaterialOrdersTool();
