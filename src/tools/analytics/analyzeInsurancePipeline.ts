/**
 * Analyze Insurance Pipeline Tool
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface AnalyzeInsurancePipelineInput {
  time_window_days?: number;
  analysis_depth?: string;
  include_predictions?: boolean;
  include_recommendations?: boolean;
  include_risk_analysis?: boolean;
  supplement_optimization?: boolean;
  benchmark_mode?: boolean;
}

export class AnalyzeInsurancePipelineTool extends BaseTool<AnalyzeInsurancePipelineInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'analyze_insurance_pipeline',
      description: 'Insurance pipeline analysis: claims, approvals, risk',
      inputSchema: {
        type: 'object',
        properties: {
          time_window_days: {
            type: 'number',
            description: 'Days to analyze (default: 90)',
          },
          analysis_depth: {
            type: 'string',
            description: 'Depth: quick, standard, deep, ultra',
          },
          include_predictions: {
            type: 'boolean',
            description: 'Include predictions',
          },
          include_recommendations: {
            type: 'boolean',
            description: 'Include recommendations',
          },
        },
      },
    };
  }

  async execute(input: AnalyzeInsurancePipelineInput, context: ToolContext): Promise<any> {
    // Check if using new handle-based parameters for response optimization
    const useHandleResponse = this.hasNewParams(input);

    const params: any = {
      ...input,
      time_window_days: input.time_window_days || 90,
      analysis_depth: input.analysis_depth || 'ultra',
    };

    // OPTIMIZATION (Week 2-3): Query Delegation Pattern
    // Calculate time window boundary for server-side filtering
    const timeWindowDays = params.time_window_days;
    const now = new Date();
    const startDate = new Date(now.getTime() - timeWindowDays * 24 * 60 * 60 * 1000);

    const queryFilter = JSON.stringify({
      must: [{
        range: {
          date_created: {
            gte: Math.floor(startDate.getTime() / 1000) // Unix timestamp in seconds
          }
        }
      }]
    });

    const jobs = await this.client.get(context.apiKey, 'jobs', {
      size: 50, // OPTIMIZED: Reduced from 100 for token efficiency
      filter: queryFilter,
      fields: ['jnid', 'number', 'date_created', 'record_type_name', 'status_name', 'sales_rep', 'custom_fields'], // JSONB Field Projection
    });

    const responseData = {
      summary: 'Insurance pipeline analysis',
      data: jobs.data,
      analysis_params: params,
    };

    // Use handle-based response if requested
    if (useHandleResponse) {
      const jobCount = jobs.data?.results?.length || 0;
      const envelope = await this.wrapResponse([responseData], input, context, {
        entity: 'insurance_pipeline',
        maxRows: jobCount,
        pageInfo: {
          current_page: 1,
          total_pages: 1,
          has_more: false,
        },
      });

      return {
        ...envelope,
        query_metadata: {
          time_window_days: timeWindowDays,
          analysis_depth: params.analysis_depth,
          total_jobs: jobCount,
          data_freshness: 'real-time',
        },
      };
    }

    // Fallback to legacy response
    return responseData;
  }
}
