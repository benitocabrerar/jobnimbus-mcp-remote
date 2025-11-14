/**
 * Get Estimate Materials Tool
 * Retrieve and analyze materials from a specific estimate
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';
import {
  GetEstimateMaterialsInput,
  GetEstimateMaterialsOutput,
  MaterialAnalysisError,
  ErrorCode,
} from '../../types/materials.js';
import materialAnalyzer from '../../services/materials/MaterialAnalyzer.js';
import { validateEstimateId, validateItemType } from '../../utils/validation.js';

export class GetEstimateMaterialsTool extends BaseTool<
  GetEstimateMaterialsInput,
  GetEstimateMaterialsOutput
> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_estimate_materials',
      description: 'Materials: retrieve estimate materials, costs/quantities/margins, labor items',
      inputSchema: {
        type: 'object',
        properties: {
          estimate_id: {
            type: 'string',
            description: 'JobNimbus estimate ID (required)',
          },
          include_labor: {
            type: 'boolean',
            description: 'Include labor items in the analysis (default: false)',
          },
          filter_by_type: {
            type: 'string',
            enum: ['material', 'labor', 'all'],
            description: 'Filter items by type (default: material)',
          },
          include_cost_analysis: {
            type: 'boolean',
            description:
              'Include detailed cost analysis with high/low margin items (default: false)',
          },
        },
        required: ['estimate_id'],
      },
    };
  }

  protected validateInput(input: GetEstimateMaterialsInput): void {
    validateEstimateId(input.estimate_id);

    if (input.filter_by_type) {
      validateItemType(input.filter_by_type);
    }
  }

  async execute(
    input: GetEstimateMaterialsInput,
    context: ToolContext
  ): Promise<GetEstimateMaterialsOutput> {
    // Check if using new handle-based parameters for response optimization
    const useHandleResponse = this.hasNewParams(input);

    try {
      this.validateInput(input);

      // Determine if labor should be included
      const includeLabor =
        input.include_labor === true || input.filter_by_type === 'all';

      // Call material analyzer
      const result = await materialAnalyzer.analyzeEstimateMaterials(
        context.apiKey,
        input.estimate_id,
        includeLabor,
        input.include_cost_analysis || false
      );

      // Use handle-based response if requested
      if (useHandleResponse) {
        const envelope = await this.wrapResponse([result], input, context, {
          entity: 'estimate_materials',
          maxRows: result.materials?.length || 0,
          pageInfo: {
            current_page: 1,
            total_pages: 1,
            has_more: false,
            total: result.materials?.length || 0,
          },
        });

        return {
          ...envelope,
          query_metadata: {
            estimate_id: input.estimate_id,
            materials_count: result.materials?.length || 0,
            include_labor: includeLabor,
            filter_by_type: input.filter_by_type || 'material',
            include_cost_analysis: input.include_cost_analysis || false,
            total_cost: result.summary?.total_cost || 0,
            total_revenue: result.summary?.total_revenue || 0,
            total_margin: result.summary?.total_margin || 0,
            data_freshness: 'real-time',
          },
        } as any;
      }

      // Fallback to legacy response
      return result;
    } catch (error) {
      if (error instanceof MaterialAnalysisError) {
        // Use handle-based response for errors if requested
        if (useHandleResponse) {
          const errorResponse = {
            success: false,
            error: error.message,
            error_code: error.code,
            details: error.details,
          };

          const envelope = await this.wrapResponse([errorResponse], input, context, {
            entity: 'estimate_materials',
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
              estimate_id: input.estimate_id,
              error: true,
              error_message: error.message,
              error_code: error.code,
              data_freshness: 'real-time',
            },
          } as any;
        }

        throw error;
      }

      const genericError = new MaterialAnalysisError(
        `Failed to analyze estimate materials: ${error}`,
        ErrorCode.CALCULATION_ERROR,
        { estimate_id: input.estimate_id, error: String(error) }
      );

      // Use handle-based response for errors if requested
      if (useHandleResponse) {
        const errorResponse = {
          success: false,
          error: genericError.message,
          error_code: genericError.code,
          details: genericError.details,
        };

        const envelope = await this.wrapResponse([errorResponse], input, context, {
          entity: 'estimate_materials',
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
            estimate_id: input.estimate_id,
            error: true,
            error_message: genericError.message,
            error_code: genericError.code,
            data_freshness: 'real-time',
          },
        } as any;
      }

      throw genericError;
    }
  }
}

export default new GetEstimateMaterialsTool();
