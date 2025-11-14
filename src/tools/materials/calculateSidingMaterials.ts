/**
 * Calculate Siding Materials Tool - Simplified Implementation
 */

import { BaseTool } from '../baseTool.js';

export class CalculateSidingMaterialsTool extends BaseTool {
  get definition() {
    return {
      name: 'calculate_siding_materials',
      description: 'Materials: siding calculations, wall area, window/door deductions',
      inputSchema: {
        type: 'object' as const,
        properties: {
          wall_area_sqft: { type: 'number', description: 'Total wall area in square feet' },
          siding_type: { type: 'string', description: 'Type of siding material' },
          window_area_sqft: { type: 'number', description: 'Total window area to deduct' },
          door_area_sqft: { type: 'number', description: 'Total door area to deduct' }
        },
        required: ['wall_area_sqft', 'siding_type']
      }
    };
  }

  async execute(input: any, context: any) {
    // Check if using new handle-based parameters for response optimization
    const useHandleResponse = this.hasNewParams(input);

    const net_area = input.wall_area_sqft - (input.window_area_sqft || 0) - (input.door_area_sqft || 0);
    const waste_factor = 0.15;
    const total_area = net_area * (1 + waste_factor);

    const result = {
      success: true,
      materials: [{
        name: `${input.siding_type} Siding`,
        quantity: Math.ceil(total_area / 100),
        uom: 'square',
        unit_cost: 250,
        unit_price: 375,
        total_cost: Math.ceil(total_area / 100) * 250,
        total_price: Math.ceil(total_area / 100) * 375
      }],
      totals: {
        net_area_sqft: net_area,
        total_area_with_waste: total_area,
        waste_factor
      }
    };

    // Use handle-based response if requested
    if (useHandleResponse) {
      const envelope = await this.wrapResponse([result], input, context, {
        entity: 'siding_materials',
        maxRows: result.materials.length,
        pageInfo: {
          current_page: 1,
          total_pages: 1,
          has_more: false,
          total: result.materials.length,
        },
      });

      return {
        ...envelope,
        query_metadata: {
          calculation_type: 'siding',
          siding_type: input.siding_type,
          wall_area_sqft: input.wall_area_sqft,
          net_area_sqft: net_area,
          waste_factor: waste_factor,
          total_area_sqft: total_area,
          materials_count: result.materials.length,
          data_freshness: 'real-time',
        },
      };
    }

    // Fallback to legacy response
    return result;
  }
}

export default () => new CalculateSidingMaterialsTool();
