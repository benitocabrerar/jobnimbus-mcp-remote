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
      description: 'Get specific job by ID. Automatically verifies and corrects attachment_count if suspicious values detected (>100).',
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

  async execute(input: GetJobInput, context: ToolContext): Promise<any> {
    // Get job data
    const result = await this.client.get(
      context.apiKey,
      `jobs/${input.job_id}`
    );
    const job = result.data;

    // Check if attachment_count needs verification
    const reportedCount = job.attachment_count || 0;
    const shouldVerify = input.verify_attachments || reportedCount > 100;

    if (shouldVerify && reportedCount > 0) {
      try {
        // Query actual attachments for this job
        const attachmentsResponse = await this.client.get(
          context.apiKey,
          'attachments',
          { related: input.job_id, size: 100 }
        );

        const attachments = attachmentsResponse.data?.results || attachmentsResponse.data?.attachments || [];
        const actualCount = attachments.length;

        // Add verification metadata
        const verification = {
          reported_attachment_count: reportedCount,
          actual_attachment_count: actualCount,
          verified: true,
          discrepancy: reportedCount !== actualCount,
          warning: reportedCount > 100 ? `Suspicious attachment_count (${reportedCount}). API may be counting all system files instead of job-specific files.` : null,
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
            warning: reportedCount > 100 ? `Suspicious attachment_count (${reportedCount}). Verification failed.` : null,
          },
        };
      }
    }

    // Return job as-is if no verification needed
    return job;
  }
}
