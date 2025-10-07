/**
 * Get Job Tool - Get specific job by ID
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface GetJobInput {
  job_id: string;
}

export class GetJobTool extends BaseTool<GetJobInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_job',
      description: 'Get specific job by ID',
      inputSchema: {
        type: 'object',
        properties: {
          job_id: {
            type: 'string',
            description: 'Job ID',
          },
        },
        required: ['job_id'],
      },
    };
  }

  async execute(input: GetJobInput, context: ToolContext): Promise<any> {
    const result = await this.client.get(
      context.apiKey,
      `jobs/${input.job_id}`
    );
    return result.data;
  }
}
