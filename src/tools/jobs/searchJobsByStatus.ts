/**
 * Search Jobs By Status Tool
 * Fast, direct status-based job search with compact results
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';
import { compactJob, compactArray } from '../../utils/compactData.js';

interface SearchJobsByStatusInput {
  status: string;
  limit?: number;
  include_full_details?: boolean;
}

interface Job {
  jnid?: string;
  number?: number;
  status_name?: string;
  [key: string]: any;
}

export class SearchJobsByStatusTool extends BaseTool<SearchJobsByStatusInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'search_jobs_by_status',
      description: 'Fast search for jobs by status. Returns quick, compact results.',
      inputSchema: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            description: 'Job status to search (e.g., "Lead", "Estimating", "Pending Customer Aproval", "Lost", "Paid & Closed", "Jobs In Progress")',
          },
          limit: {
            type: 'number',
            description: 'Maximum jobs to return (default: 20, max: 50)',
          },
          include_full_details: {
            type: 'boolean',
            description: 'Return full job details. Default: false (compact mode)',
          },
        },
        required: ['status'],
      },
    };
  }

  async execute(input: SearchJobsByStatusInput, context: ToolContext): Promise<any> {
    const limit = Math.min(input.limit || 20, 50);
    const searchStatus = input.status.toLowerCase().trim();

    // Fetch jobs efficiently (OPTIMIZED: Reduced from 20 to 5 iterations)
    const batchSize = 100;
    const maxIterations = 5; // Max 500 jobs (reduced from 2000 for token optimization)
    let allJobs: Job[] = [];
    let matchingJobs: Job[] = [];
    let iteration = 0;

    while (iteration < maxIterations && matchingJobs.length < limit) {
      const params = { size: batchSize, from: iteration * batchSize };
      const response = await this.client.get(context.apiKey, 'jobs', params);
      const batch = response.data?.results || [];

      if (batch.length === 0) break;

      // Filter by status
      const matches = batch.filter((job: Job) => {
        const jobStatus = (job.status_name || '').toLowerCase().trim();
        return jobStatus.includes(searchStatus) || searchStatus.includes(jobStatus);
      });

      matchingJobs = matchingJobs.concat(matches);
      allJobs = allJobs.concat(batch);
      iteration++;

      // Stop if we have enough matches
      if (matchingJobs.length >= limit) break;

      // Stop if no more jobs
      if (batch.length < batchSize) break;
    }

    // Limit results
    const limitedJobs = matchingJobs.slice(0, limit);

    // Apply compaction
    const useCompactMode = !input.include_full_details;
    const resultJobs = useCompactMode
      ? compactArray(limitedJobs, compactJob)
      : limitedJobs;

    return {
      _code_version: 'v1.0-fast-search',
      status_searched: input.status,
      total_found: matchingJobs.length,
      total_returned: limitedJobs.length,
      jobs_scanned: allJobs.length,
      iterations: iteration,
      has_more: matchingJobs.length > limit,
      compact_mode: useCompactMode,
      results: resultJobs,
    };
  }
}
