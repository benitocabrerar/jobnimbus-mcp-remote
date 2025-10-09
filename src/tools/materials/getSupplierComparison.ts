/**
 * Get Supplier Comparison Tool
 * Compare supplier pricing and performance
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';
import {
  GetSupplierComparisonInput,
  GetSupplierComparisonOutput,
  MaterialAnalysisError,
  ErrorCode,
} from '../../types/materials.js';
import materialAnalyzer from '../../services/materials/MaterialAnalyzer.js';
import {
  validateDateRange,
  validatePositiveNumber,
  sanitizeString,
} from '../../utils/validation.js';

export class GetSupplierComparisonTool extends BaseTool<
  GetSupplierComparisonInput,
  GetSupplierComparisonOutput
> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_supplier_comparison',
      description:
        'Compare supplier pricing and performance for materials. Identify best and worst pricing, calculate potential savings, and get supplier recommendations. Includes price trend analysis and reliability scoring.',
      inputSchema: {
        type: 'object',
        properties: {
          date_from: {
            type: 'string',
            description: 'Start date for comparison (YYYY-MM-DD format)',
          },
          date_to: {
            type: 'string',
            description: 'End date for comparison (YYYY-MM-DD format)',
          },
          material_name: {
            type: 'string',
            description: 'Filter by specific material name (optional)',
          },
          sku: {
            type: 'string',
            description: 'Filter by material SKU (optional)',
          },
          category: {
            type: 'string',
            description: 'Filter by material category (optional)',
          },
          group_by_supplier: {
            type: 'boolean',
            description: 'Group results by supplier (default: true)',
          },
          min_purchases: {
            type: 'number',
            description: 'Minimum number of purchases to include supplier (default: 1)',
          },
        },
      },
    };
  }

  protected validateInput(input: GetSupplierComparisonInput): void {
    validateDateRange(input.date_from, input.date_to);

    if (input.min_purchases !== undefined) {
      validatePositiveNumber(input.min_purchases, 'min_purchases', 1);
    }

    if (input.material_name) {
      input.material_name = sanitizeString(input.material_name);
    }

    if (input.sku) {
      input.sku = sanitizeString(input.sku);
    }

    if (input.category) {
      input.category = sanitizeString(input.category);
    }
  }

  async execute(
    input: GetSupplierComparisonInput,
    context: ToolContext
  ): Promise<GetSupplierComparisonOutput> {
    try {
      this.validateInput(input);

      const result = await materialAnalyzer.getSupplierComparison(
        context.apiKey,
        input
      );

      return result;
    } catch (error) {
      if (error instanceof MaterialAnalysisError) {
        throw error;
      }

      throw new MaterialAnalysisError(
        `Failed to compare suppliers: ${error}`,
        ErrorCode.CALCULATION_ERROR,
        { input, error: String(error) }
      );
    }
  }
}

export default new GetSupplierComparisonTool();
