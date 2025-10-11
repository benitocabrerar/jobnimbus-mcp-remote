/**
 * Analyze Material Costs Tool
 * Comprehensive cost analysis for materials over a time period
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';
import {
  AnalyzeMaterialCostsInput,
  AnalyzeMaterialCostsOutput,
  MaterialAnalysisError,
  ErrorCode,
} from '../../types/materials.js';
import materialAnalyzer from '../../services/materials/MaterialAnalyzer.js';
import {
  validateDateRange,
  validatePositiveNumber,
  validateStringArray,
} from '../../utils/validation.js';
import { getCurrentMonth } from '../../utils/dateHelpers.js';

export class AnalyzeMaterialCostsTool extends BaseTool<
  AnalyzeMaterialCostsInput,
  AnalyzeMaterialCostsOutput
> {
  get definition(): MCPToolDefinition {
    return {
      name: 'analyze_material_costs',
      description:
        'Perform comprehensive cost analysis for materials over a specified time period. Provides statistical analysis, trend detection, high/low performers, and actionable recommendations for cost optimization and pricing strategies.',
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
          job_type: {
            type: 'string',
            description: 'Filter by specific job type (optional)',
          },
          material_categories: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by material categories (optional)',
          },
          min_usage_count: {
            type: 'number',
            description: 'Minimum usage count to include material in analysis (default: 1)',
          },
          include_trends: {
            type: 'boolean',
            description: 'Include trend analysis over time (default: false)',
          },
        },
      },
    };
  }

  protected validateInput(input: AnalyzeMaterialCostsInput): void {
    validateDateRange(input.date_from, input.date_to);

    if (input.material_categories) {
      validateStringArray(input.material_categories, 'material_categories');
    }

    if (input.min_usage_count !== undefined) {
      validatePositiveNumber(input.min_usage_count, 'min_usage_count', 1);
    }
  }

  async execute(
    input: AnalyzeMaterialCostsInput,
    context: ToolContext
  ): Promise<AnalyzeMaterialCostsOutput> {
    try {
      // Use current date as default if no date filters provided
      const currentMonth = getCurrentMonth();
      const inputWithDefaults = {
        ...input,
        date_from: input.date_from || currentMonth.date_from,
        date_to: input.date_to || currentMonth.date_to,
      };

      this.validateInput(inputWithDefaults);

      const result = await materialAnalyzer.analyzeMaterialCosts(context.apiKey, inputWithDefaults);

      return result;
    } catch (error) {
      if (error instanceof MaterialAnalysisError) {
        throw error;
      }

      throw new MaterialAnalysisError(
        `Failed to analyze material costs: ${error}`,
        ErrorCode.CALCULATION_ERROR,
        { input, error: String(error) }
      );
    }
  }
}

export default new AnalyzeMaterialCostsTool();
