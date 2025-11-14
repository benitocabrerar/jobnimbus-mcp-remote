/**
 * Get Material Specifications Tool - Simplified Implementation
 */

import { BaseTool } from '../baseTool.js';
import { ROOFING_MATERIAL_SPECS, ROOFING_ACCESSORIES } from '../../constants/roofing.constants.js';

export class GetMaterialSpecificationsTool extends BaseTool {
  get definition() {
    return {
      name: 'get_material_specifications',
      description: 'Materials: specifications by SKU/name, coverage, dimensions, pricing',
      inputSchema: {
        type: 'object' as const,
        properties: {
          sku: { type: 'string', description: 'Material SKU code' },
          material_name: { type: 'string', description: 'Material name (alternative to SKU)' },
          category: { type: 'string', description: 'Material category filter' }
        }
      }
    };
  }

  async execute(input: any, context: any) {
    // Check if using new handle-based parameters for response optimization
    const useHandleResponse = this.hasNewParams(input);

    const allSpecs = { ...ROOFING_MATERIAL_SPECS, ...ROOFING_ACCESSORIES };
    let result: any;

    if (input.sku) {
      const spec = Object.values(allSpecs).find((s: any) => s.sku === input.sku);
      result = { success: true, specification: spec || null };
    } else if (input.material_name) {
      const spec = Object.values(allSpecs).find((s: any) =>
        s.name.toLowerCase().includes(input.material_name.toLowerCase())
      );
      result = { success: true, specification: spec || null };
    } else {
      result = {
        success: true,
        specifications: Object.values(allSpecs).slice(0, 20),
        total_count: Object.keys(allSpecs).length
      };
    }

    // Use handle-based response if requested
    if (useHandleResponse) {
      const envelope = await this.wrapResponse([result], input, context, {
        entity: 'material_specifications',
        maxRows: result.specification ? 1 : (result.specifications?.length || 0),
        pageInfo: {
          current_page: 1,
          total_pages: 1,
          has_more: false,
          total: result.specification ? 1 : (result.total_count || 0),
        },
      });

      return {
        ...envelope,
        query_metadata: {
          query_type: input.sku ? 'sku' : (input.material_name ? 'name' : 'all'),
          sku: input.sku || null,
          material_name: input.material_name || null,
          category: input.category || null,
          results_count: result.specification ? 1 : (result.specifications?.length || 0),
          data_freshness: 'real-time',
        },
      };
    }

    // Fallback to legacy response
    return result;
  }
}

export default () => new GetMaterialSpecificationsTool();
