/**
 * Get Jobs Tool
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface GetJobsInput {
  from?: number;
  size?: number;
  date_from?: string;
  date_to?: string;
}

export class GetJobsTool extends BaseTool<GetJobsInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_jobs',
      description: 'Retrieve jobs from JobNimbus with pagination and date filtering',
      inputSchema: {
        type: 'object',
        properties: {
          from: {
            type: 'number',
            description: 'Starting index for pagination (default: 0)',
          },
          size: {
            type: 'number',
            description: 'Number of records to retrieve (default: 50, max: 100)',
          },
          date_from: {
            type: 'string',
            description: 'Start date filter (YYYY-MM-DD format)',
          },
          date_to: {
            type: 'string',
            description: 'End date filter (YYYY-MM-DD format)',
          },
        },
      },
    };
  }

  async execute(input: GetJobsInput, context: ToolContext): Promise<any> {
    const params: any = {
      from: input.from || 0,
      size: Math.min(input.size || 50, 100),
    };

    if (input.date_from) {
      params.date_from = input.date_from;
    }

    if (input.date_to) {
      params.date_to = input.date_to;
    }

    const result = await this.client.get(context.apiKey, 'jobs', params);

    return result.data;
  }
}
