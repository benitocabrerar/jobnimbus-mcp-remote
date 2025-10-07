/**
 * Auto-generate all remaining tools
 * This creates simple pass-through tools for all JobNimbus MCP functionality
 */

import { BaseTool } from './baseTool.js';
import { MCPToolDefinition, ToolContext } from '../types/index.js';

/**
 * Generic Tool Factory
 * Creates tools dynamically based on configuration
 */
export function createGenericTool(config: {
  name: string;
  description: string;
  endpoint?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  inputSchema?: any;
}): any {
  return class extends BaseTool<any, any> {
    get definition(): MCPToolDefinition {
      return {
        name: config.name,
        description: config.description,
        inputSchema: config.inputSchema || {
          type: 'object',
          properties: {},
        },
      };
    }

    async execute(input: any, context: ToolContext): Promise<any> {
      const endpoint = config.endpoint || config.name.replace(/_/g, '/');
      const method = config.method || 'GET';

      if (method === 'GET') {
        const result = await this.client.get(context.apiKey, endpoint, input);
        return result.data;
      } else if (method === 'POST') {
        const result = await this.client.post(context.apiKey, endpoint, input);
        return result.data;
      }

      return { success: false, error: 'Method not supported' };
    }
  };
}

/**
 * All tool definitions
 */
export const ALL_TOOLS_CONFIG = [
  // NOTE: ALL ANALYTICS TOOLS NOW HAVE DEDICATED IMPLEMENTATIONS
  // See src/tools/analytics/ and src/tools/index.ts
  // Remaining tools below are kept for legacy compatibility
];
