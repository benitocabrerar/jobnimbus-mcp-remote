/**
 * Get Material Specifications Tool - Simplified Implementation
 */

import { BaseTool } from '../baseTool.js';
import { ROOFING_MATERIAL_SPECS, ROOFING_ACCESSORIES } from '../../constants/roofing.constants.js';

export class GetMaterialSpecificationsTool extends BaseTool {
  get definition() {
    return {
      name: 'get_material_specifications',
      description: 'Get detailed material specifications by SKU or material name including coverage, dimensions, pricing, and supplier data',
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

  async execute(input: any) {
    const allSpecs = { ...ROOFING_MATERIAL_SPECS, ...ROOFING_ACCESSORIES };

    if (input.sku) {
      const spec = Object.values(allSpecs).find((s: any) => s.sku === input.sku);
      return { success: true, specification: spec || null };
    }

    if (input.material_name) {
      const spec = Object.values(allSpecs).find((s: any) =>
        s.name.toLowerCase().includes(input.material_name.toLowerCase())
      );
      return { success: true, specification: spec || null };
    }

    return {
      success: true,
      specifications: Object.values(allSpecs).slice(0, 20),
      total_count: Object.keys(allSpecs).length
    };
  }
}

export default () => new GetMaterialSpecificationsTool();
