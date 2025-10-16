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

      return result;
    } catch (error) {
      if (error instanceof MaterialAnalysisError) {
        throw error;
      }

      throw new MaterialAnalysisError(
        `Failed to analyze estimate materials: ${error}`,
        ErrorCode.CALCULATION_ERROR,
        { estimate_id: input.estimate_id, error: String(error) }
      );
    }
  }
}

export default new GetEstimateMaterialsTool();
