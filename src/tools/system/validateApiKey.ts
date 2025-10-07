/**
 * Validate API Key Tool
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

export class ValidateApiKeyTool extends BaseTool<{}, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'validate_api_key',
      description: 'Validate JobNimbus API key and permissions',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    };
  }

  async execute(_input: {}, context: ToolContext): Promise<any> {
    const isValid = await this.client.validateApiKey(context.apiKey);

    return {
      valid: isValid,
      instance: context.instance,
    };
  }
}
