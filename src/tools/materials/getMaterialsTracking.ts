/**
 * Get Materials Tracking Tool
 * Comprehensive materials tracking with cost analysis, usage reporting, and inventory insights
 *
 * Consolidates:
 * - analyze_material_costs (costs)
 * - get_material_usage_report (usage)
 * - get_material_inventory_insights (inventory)
 *
 * All three tools share time-series analysis patterns and date range parameters.
 * Consolidated into single parameterized tool for better token efficiency.
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';
import {
  AnalyzeMaterialCostsInput,
  AnalyzeMaterialCostsOutput,
  GetMaterialUsageReportInput,
  GetMaterialUsageReportOutput,
  GetMaterialInventoryInsightsInput,
  GetMaterialInventoryInsightsOutput,
  MaterialAnalysisError,
  ErrorCode,
} from '../../types/materials.js';
import materialAnalyzer from '../../services/materials/MaterialAnalyzer.js';
import {
  validateDateRange,
  validatePositiveNumber,
  validateStringArray,
  validateAggregateBy,
  sanitizeString,
} from '../../utils/validation.js';
import { getCurrentMonth } from '../../utils/dateHelpers.js';

type MaterialsTrackingInput = {
  analysis_type: 'costs' | 'usage' | 'inventory';
  // Common parameters (all types)
  date_from?: string;
  date_to?: string;
  category?: string;
  // Costs-specific parameters
  job_type?: string;
  material_categories?: string[];
  min_usage_count?: number;
  include_trends?: boolean;
  // Usage-specific parameters
  material_name?: string;
  sku?: string;
  aggregate_by?: 'day' | 'week' | 'month';
  include_forecast?: boolean;
  // Inventory-specific parameters
  low_stock_threshold?: number;
  include_inactive?: boolean;
};

type MaterialsTrackingOutput =
  | (AnalyzeMaterialCostsOutput & { analysis_type: 'costs' })
  | (GetMaterialUsageReportOutput & { analysis_type: 'usage' })
  | (GetMaterialInventoryInsightsOutput & { analysis_type: 'inventory' })
  | { error: string; status: 'Failed'; analysis_type: string };

export class GetMaterialsTrackingTool extends BaseTool<
  MaterialsTrackingInput,
  MaterialsTrackingOutput
> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_materials_tracking',
      description: 'Materials: cost/usage/inventory tracking, trends, forecasting, optimization',
      inputSchema: {
        type: 'object',
        properties: {
          analysis_type: {
            type: 'string',
            enum: ['costs', 'usage', 'inventory'],
            description:
              'Type of analysis: ' +
              'costs (comprehensive cost analysis with trends and recommendations), ' +
              'usage (usage tracking over time with forecasting), ' +
              'inventory (AI-powered inventory optimization and reorder recommendations)',
          },
          // Common parameters
          date_from: {
            type: 'string',
            description:
              'Start date for analysis (YYYY-MM-DD format). Defaults to first day of current month.',
          },
          date_to: {
            type: 'string',
            description:
              'End date for analysis (YYYY-MM-DD format). Defaults to last day of current month.',
          },
          category: {
            type: 'string',
            description: 'Filter by material category (optional, applies to all analysis types)',
          },
          // Costs-specific parameters
          job_type: {
            type: 'string',
            description: '[Costs] Filter by specific job type (optional)',
          },
          material_categories: {
            type: 'array',
            items: { type: 'string' },
            description: '[Costs] Filter by material categories (optional)',
          },
          min_usage_count: {
            type: 'number',
            description:
              '[Costs/Inventory] Minimum usage count to include material in analysis (default: 1)',
          },
          include_trends: {
            type: 'boolean',
            description: '[Costs] Include trend analysis over time (default: false)',
          },
          // Usage-specific parameters
          material_name: {
            type: 'string',
            description: '[Usage] Filter by specific material name (optional)',
          },
          sku: {
            type: 'string',
            description: '[Usage] Filter by material SKU (optional)',
          },
          aggregate_by: {
            type: 'string',
            enum: ['day', 'week', 'month'],
            description:
              '[Usage] Time period for aggregation (default: month). Options: day, week, month',
          },
          include_forecast: {
            type: 'boolean',
            description:
              '[Usage] Include usage forecasting for next periods (default: false)',
          },
          // Inventory-specific parameters
          low_stock_threshold: {
            type: 'number',
            description:
              '[Inventory] Days of supply threshold for low stock alerts (default: 30)',
          },
          include_inactive: {
            type: 'boolean',
            description: '[Inventory] Include inactive materials in analysis (default: true)',
          },
        },
        required: ['analysis_type'],
      },
    };
  }

  async execute(
    input: MaterialsTrackingInput,
    context: ToolContext
  ): Promise<MaterialsTrackingOutput> {
    const analysisType = input.analysis_type;

    try {
      switch (analysisType) {
        case 'costs':
          return await this.analyzeCosts(input, context);
        case 'usage':
          return await this.analyzeUsage(input, context);
        case 'inventory':
          return await this.analyzeInventory(input, context);
        default:
          return {
            error: `Invalid analysis_type: ${analysisType}. Must be one of: costs, usage, inventory`,
            status: 'Failed',
            analysis_type: analysisType,
          };
      }
    } catch (error) {
      if (error instanceof MaterialAnalysisError) {
        throw error;
      }

      throw new MaterialAnalysisError(
        `Failed to execute materials tracking analysis: ${error}`,
        ErrorCode.CALCULATION_ERROR,
        { analysis_type: analysisType, input, error: String(error) }
      );
    }
  }

  /**
   * Analyze Material Costs
   * Comprehensive cost analysis with statistical insights and recommendations
   */
  private async analyzeCosts(
    input: MaterialsTrackingInput,
    context: ToolContext
  ): Promise<AnalyzeMaterialCostsOutput & { analysis_type: 'costs' }> {
    // Use current month as default
    const currentMonth = getCurrentMonth();
    const costInput: AnalyzeMaterialCostsInput = {
      date_from: input.date_from || currentMonth.date_from,
      date_to: input.date_to || currentMonth.date_to,
      job_type: input.job_type,
      material_categories: input.material_categories,
      min_usage_count: input.min_usage_count,
      include_trends: input.include_trends,
    };

    // Validate
    validateDateRange(costInput.date_from, costInput.date_to);
    if (costInput.material_categories) {
      validateStringArray(costInput.material_categories, 'material_categories');
    }
    if (costInput.min_usage_count !== undefined) {
      validatePositiveNumber(costInput.min_usage_count, 'min_usage_count', 1);
    }

    // Execute analysis
    const result = await materialAnalyzer.analyzeMaterialCosts(context.apiKey, costInput);

    return {
      ...result,
      analysis_type: 'costs',
    };
  }

  /**
   * Analyze Material Usage
   * Usage tracking with trends and forecasting
   */
  private async analyzeUsage(
    input: MaterialsTrackingInput,
    context: ToolContext
  ): Promise<GetMaterialUsageReportOutput & { analysis_type: 'usage' }> {
    // Use current month as default
    const currentMonth = getCurrentMonth();
    const usageInput: GetMaterialUsageReportInput = {
      date_from: input.date_from || currentMonth.date_from,
      date_to: input.date_to || currentMonth.date_to,
      material_name: input.material_name,
      sku: input.sku,
      category: input.category,
      aggregate_by: input.aggregate_by,
      include_forecast: input.include_forecast,
    };

    // Validate and sanitize
    validateDateRange(usageInput.date_from, usageInput.date_to);
    if (usageInput.aggregate_by) {
      validateAggregateBy(usageInput.aggregate_by);
    }
    if (usageInput.material_name) {
      usageInput.material_name = sanitizeString(usageInput.material_name);
    }
    if (usageInput.sku) {
      usageInput.sku = sanitizeString(usageInput.sku);
    }
    if (usageInput.category) {
      usageInput.category = sanitizeString(usageInput.category);
    }

    // Execute analysis
    const result = await materialAnalyzer.getMaterialUsageReport(
      context.apiKey,
      usageInput
    );

    return {
      ...result,
      analysis_type: 'usage',
    };
  }

  /**
   * Analyze Inventory
   * AI-powered inventory optimization with reorder recommendations
   */
  private async analyzeInventory(
    input: MaterialsTrackingInput,
    context: ToolContext
  ): Promise<GetMaterialInventoryInsightsOutput & { analysis_type: 'inventory' }> {
    // Use current month as default
    const currentMonth = getCurrentMonth();
    const inventoryInput: GetMaterialInventoryInsightsInput = {
      date_from: input.date_from || currentMonth.date_from,
      date_to: input.date_to || currentMonth.date_to,
      category: input.category,
      low_stock_threshold: input.low_stock_threshold,
      include_inactive: input.include_inactive,
      min_usage_count: input.min_usage_count,
    };

    // Validate and sanitize
    validateDateRange(inventoryInput.date_from, inventoryInput.date_to);
    if (inventoryInput.low_stock_threshold !== undefined) {
      validatePositiveNumber(
        inventoryInput.low_stock_threshold,
        'low_stock_threshold',
        1
      );
    }
    if (inventoryInput.min_usage_count !== undefined) {
      validatePositiveNumber(inventoryInput.min_usage_count, 'min_usage_count', 1);
    }
    if (inventoryInput.category) {
      inventoryInput.category = sanitizeString(inventoryInput.category);
    }

    // Execute analysis
    const result = await materialAnalyzer.getInventoryInsights(
      context.apiKey,
      inventoryInput
    );

    return {
      ...result,
      analysis_type: 'inventory',
    };
  }
}

export default new GetMaterialsTrackingTool();
