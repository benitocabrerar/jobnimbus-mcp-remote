/**
 * Create Activity Tool
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface CreateActivityInput {
  type: string;
  description?: string;
  [key: string]: any;
}

export class CreateActivityTool extends BaseTool<CreateActivityInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'create_activity',
      description: 'Create activity',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            description: 'Activity type',
          },
          description: {
            type: 'string',
            description: 'Activity description',
          },
        },
        required: ['type'],
      },
    };
  }

  async execute(input: CreateActivityInput, context: ToolContext): Promise<any> {
    const result = await this.client.post(context.apiKey, 'activities', input);
    return result.data;
  }
}
