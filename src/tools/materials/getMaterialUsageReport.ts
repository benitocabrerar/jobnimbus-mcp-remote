/**
 * Get Material Usage Report Tool
 * Detailed usage reporting with trends and forecasting
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';
import {
  GetMaterialUsageReportInput,
  GetMaterialUsageReportOutput,
  MaterialAnalysisError,
  ErrorCode,
} from '../../types/materials.js';
import materialAnalyzer from '../../services/materials/MaterialAnalyzer.js';
import {
  validateDateRange,
  validateAggregateBy,
  sanitizeString,
} from '../../utils/validation.js';

export class GetMaterialUsageReportTool extends BaseTool<
  GetMaterialUsageReportInput,
  GetMaterialUsageReportOutput
> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_material_usage_report',
      description:
        'Generate detailed usage reports for materials with trend analysis and optional forecasting. Track usage patterns over time, identify seasonal trends, and predict future material needs. Supports daily, weekly, or monthly aggregation.',
      inputSchema: {
        type: 'object',
        properties: {
          date_from: {
            type: 'string',
            description: 'Start date for report (YYYY-MM-DD format)',
          },
          date_to: {
            type: 'string',
            description: 'End date for report (YYYY-MM-DD format)',
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
          aggregate_by: {
            type: 'string',
            enum: ['day', 'week', 'month'],
            description: 'Time period for aggregation (default: month)',
          },
          include_forecast: {
            type: 'boolean',
            description: 'Include usage forecasting for next periods (default: false)',
          },
        },
      },
    };
  }

  protected validateInput(input: GetMaterialUsageReportInput): void {
    validateDateRange(input.date_from, input.date_to);

    if (input.aggregate_by) {
      validateAggregateBy(input.aggregate_by);
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
    input: GetMaterialUsageReportInput,
    context: ToolContext
  ): Promise<GetMaterialUsageReportOutput> {
    try {
      this.validateInput(input);

      const result = await materialAnalyzer.getMaterialUsageReport(
        context.apiKey,
        input
      );

      return result;
    } catch (error) {
      if (error instanceof MaterialAnalysisError) {
        throw error;
      }

      throw new MaterialAnalysisError(
        `Failed to generate material usage report: ${error}`,
        ErrorCode.CALCULATION_ERROR,
        { input, error: String(error) }
      );
    }
  }
}

export default new GetMaterialUsageReportTool();
