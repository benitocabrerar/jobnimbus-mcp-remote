/**
 * Create Contact Tool
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface CreateContactInput {
  name: string;
  email?: string;
  phone?: string;
  [key: string]: any;
}

export class CreateContactTool extends BaseTool<CreateContactInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'create_contact',
      description: 'Create new contact in JobNimbus',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Contact name',
          },
          email: {
            type: 'string',
            description: 'Contact email',
          },
          phone: {
            type: 'string',
            description: 'Contact phone',
          },
        },
        required: ['name'],
      },
    };
  }

  async execute(input: CreateContactInput, context: ToolContext): Promise<any> {
    const result = await this.client.post(context.apiKey, 'contacts', input);
    return result.data;
  }
}
