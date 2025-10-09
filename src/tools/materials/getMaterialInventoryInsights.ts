/**
 * Get Material Inventory Insights Tool
 * AI-powered inventory optimization and reorder recommendations
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';
import {
  GetMaterialInventoryInsightsInput,
  GetMaterialInventoryInsightsOutput,
  MaterialAnalysisError,
  ErrorCode,
} from '../../types/materials.js';
import materialAnalyzer from '../../services/materials/MaterialAnalyzer.js';
import {
  validateDateRange,
  validatePositiveNumber,
  sanitizeString,
} from '../../utils/validation.js';

export class GetMaterialInventoryInsightsTool extends BaseTool<
  GetMaterialInventoryInsightsInput,
  GetMaterialInventoryInsightsOutput
> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_material_inventory_insights',
      description:
        'Get AI-powered inventory insights and reorder recommendations. Analyzes usage patterns, cost volatility, and trends to provide intelligent alerts and suggested reorder schedules. Identifies low stock, high velocity, slow-moving, and inactive materials.',
      inputSchema: {
        type: 'object',
        properties: {
          date_from: {
            type: 'string',
            description: 'Start date for analysis (YYYY-MM-DD format)',
          },
          date_to: {
            type: 'string',
            description: 'End date for analysis (YYYY-MM-DD format)',
          },
          category: {
            type: 'string',
            description: 'Filter by material category (optional)',
          },
          low_stock_threshold: {
            type: 'number',
            description: 'Days of supply threshold for low stock alerts (default: 30)',
          },
          include_inactive: {
            type: 'boolean',
            description: 'Include inactive materials in analysis (default: true)',
          },
          min_usage_count: {
            type: 'number',
            description: 'Minimum usage count to include material (default: 1)',
          },
        },
      },
    };
  }

  protected validateInput(input: GetMaterialInventoryInsightsInput): void {
    validateDateRange(input.date_from, input.date_to);

    if (input.low_stock_threshold !== undefined) {
      validatePositiveNumber(input.low_stock_threshold, 'low_stock_threshold', 1);
    }

    if (input.min_usage_count !== undefined) {
      validatePositiveNumber(input.min_usage_count, 'min_usage_count', 1);
    }

    if (input.category) {
      input.category = sanitizeString(input.category);
    }
  }

  async execute(
    input: GetMaterialInventoryInsightsInput,
    context: ToolContext
  ): Promise<GetMaterialInventoryInsightsOutput> {
    try {
      this.validateInput(input);

      const result = await materialAnalyzer.getInventoryInsights(
        context.apiKey,
        input
      );

      return result;
    } catch (error) {
      if (error instanceof MaterialAnalysisError) {
        throw error;
      }

      throw new MaterialAnalysisError(
        `Failed to generate inventory insights: ${error}`,
        ErrorCode.CALCULATION_ERROR,
        { input, error: String(error) }
      );
    }
  }
}

export default new GetMaterialInventoryInsightsTool();
