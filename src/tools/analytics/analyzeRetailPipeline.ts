/**
 * Analyze Retail Pipeline Tool
 *
 * IMPLEMENTATION GUIDANCE FOR CONVERSION RATE CALCULATIONS:
 *
 * When implementing conversion_rate tracking in this tool, you MUST use
 * financial validation to prevent false positives. Jobs marked as "won"
 * or "complete" should only count as conversions if they have backing
 * financial data.
 *
 * REQUIRED PATTERN:
 *
 * 1. Import the validation helper:
 *    import { validate_conversion_real } from '../../utils/conversionValidation.js';
 *
 * 2. Accumulate financial data for each job/rep:
 *    let jobRevenue = 0;
 *    let approvedEstimates = 0;
 *    // ... calculate from estimates
 *
 * 3. Validate before counting conversions:
 *    const validation = validate_conversion_real(jobRevenue, approvedEstimates);
 *    if (validation.hasFinancialData) {
 *      conversions++;  // Only count if financial data exists
 *    }
 *
 * 4. Add conversion_verified field to output:
 *    conversion_verified: validation.hasFinancialData
 *
 * FORMULA: conversion_rate = (jobs_with(invoice_total > 0 OR estimates_approved > 0)) / total_jobs
 *
 * See getSalesRepPerformance.ts and getPipelineForecasting.ts for complete examples.
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

export class AnalyzeRetailPipelineTool extends BaseTool<any, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'analyze_retail_pipeline',
      description: 'Retail pipeline analysis: sales conversion, forecasting',
      inputSchema: {
        type: 'object',
        properties: {
          time_window_days: { type: 'number', description: 'Days to analyze (default: 90)' },
          analysis_depth: { type: 'string', description: 'Analysis depth' },
        },
      },
    };
  }

  async execute(_input: any, context: ToolContext): Promise<any> {
    const jobs = await this.client.get(context.apiKey, 'jobs', { size: 100 });
    return { summary: 'Retail pipeline analysis', data: jobs.data };
  }
}
