/**
 * Get Job Tool - Get specific job by ID
 * Enhanced with correct attachment_count calculation
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface GetJobInput {
  job_id: string;
  verify_attachments?: boolean;
}

export class GetJobTool extends BaseTool<GetJobInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_job',
      description: 'Get specific job by ID (JNID) or job number. Supports backward search to find old jobs. Automatically verifies and corrects attachment_count if suspicious values detected (>100).',
      inputSchema: {
        type: 'object',
        properties: {
          job_id: {
            type: 'string',
            description: 'Job ID',
          },
          verify_attachments: {
            type: 'boolean',
            description: 'Force verification of attachment count by querying actual attachments (default: auto for count > 100)',
          },
        },
        required: ['job_id'],
      },
    };
  }

  /**
   * Search for job by number when direct JNID lookup fails
   */
  private async searchJobByNumber(jobNumber: string, context: ToolContext): Promise<any> {
    const batchSize = 100;
    const maxIterations = 50; // Maximum 5,000 jobs
    let offset = 0;

    try {
      for (let iteration = 0; iteration < maxIterations; iteration++) {
        const response = await this.client.get(context.apiKey, 'jobs', {
          size: batchSize,
          from: offset
        });

        const jobs = response.data?.results || [];
        if (jobs.length === 0) break;

        // Search for job by number field
        const found = jobs.find((j: any) =>
          String(j.number) === String(jobNumber) ||
          String(j.display_number) === String(jobNumber)
        );

        if (found) {
          return found;
        }

        offset += batchSize;
        if (jobs.length < batchSize) break;
      }
    } catch (error: any) {
      // If search fails due to API error, log and return null
      // This allows execute() to provide a better error message
      console.error(`Backward search failed for job ${jobNumber}:`, error.message || error);
      return null;
    }

    return null;
  }

  /**
   * Process job with attachment verification
   */
  private async processJob(job: any, input: GetJobInput, context: ToolContext): Promise<any> {
    // Get job's jnid for file filtering
    const jobJnid = job.jnid || input.job_id;

    // Check if attachment_count needs verification
    const reportedCount = job.attachment_count || 0;
    const shouldVerify = input.verify_attachments || reportedCount > 100;

    if (shouldVerify && reportedCount > 0) {
      try {
        // Query actual files for this job (correct endpoint is /files, NOT /attachments)
        const filesResponse = await this.client.get(
          context.apiKey,
          'files',
          { size: 500 } // Fetch more since we filter client-side
        );

        const allFiles = filesResponse.data?.files || [];

        // Filter files related to this job
        const jobFiles = allFiles.filter((file: any) => {
          // Check if job ID is in primary
          if (file.primary?.id === jobJnid) return true;

          // Check if job ID is in related array
          if (file.related && Array.isArray(file.related)) {
            return file.related.some((rel: any) => rel.id === jobJnid);
          }

          return false;
        });

        const actualCount = jobFiles.length;

        // Add verification metadata
        const verification = {
          reported_attachment_count: reportedCount,
          actual_attachment_count: actualCount,
          verified: true,
          discrepancy: reportedCount !== actualCount,
          warning: reportedCount > 100 ? `Suspicious attachment_count (${reportedCount}). JobNimbus API may be counting all system files. Verified actual count: ${actualCount}` : null,
          endpoint_used: 'files',
          job_jnid: jobJnid,
          sample_files: jobFiles.slice(0, 3).map((f: any) => ({
            filename: f.filename,
            size_mb: ((f.size || 0) / (1024 * 1024)).toFixed(2),
            type: f.content_type,
          })),
        };

        return {
          ...job,
          attachment_count: actualCount, // Override with correct count
          _attachment_verification: verification,
        };
      } catch (error) {
        // If attachment verification fails, return job with warning
        return {
          ...job,
          _attachment_verification: {
            reported_attachment_count: reportedCount,
            actual_attachment_count: null,
            verified: false,
            error: error instanceof Error ? error.message : 'Failed to verify attachments',
            warning: reportedCount > 100 ? `Suspicious attachment_count (${reportedCount}). Verification failed - check API permissions.` : null,
            endpoint_attempted: 'files',
            job_jnid: jobJnid,
          },
        };
      }
    }

    // Return job as-is if no verification needed
    return job;
  }

  async execute(input: GetJobInput, context: ToolContext): Promise<any> {
    let directLookupError: any = null;

    // 1. Try direct JNID lookup first (fast path for valid JNIDs)
    try {
      const result = await this.client.get(
        context.apiKey,
        `jobs/${input.job_id}`
      );
      const job = result.data;
      return await this.processJob(job, input, context);
    } catch (error: any) {
      directLookupError = error;
      // If not a 404 error, throw it immediately
      if (error.statusCode !== 404 && error.status !== 404) {
        throw error;
      }
      // If 404, continue to search by job number
    }

    // 2. Search by job number (backward search for old jobs)
    const job = await this.searchJobByNumber(input.job_id, context);

    if (!job) {
      // Provide detailed error message
      const errorDetails = [];
      errorDetails.push(`Job not found: ${input.job_id}`);
      errorDetails.push(`Direct lookup: ${directLookupError?.message || 'Not Found (404)'}`);
      errorDetails.push(`Backward search: Searched up to 5,000 jobs by number field`);
      errorDetails.push(`Possible causes:`);
      errorDetails.push(`  - Job doesn't exist in this instance`);
      errorDetails.push(`  - Job is in a different company (Stamford vs Guilford)`);
      errorDetails.push(`  - API key permissions insufficient for listing jobs`);

      throw new Error(errorDetails.join('\n'));
    }

    return await this.processJob(job, input, context);
  }
}
