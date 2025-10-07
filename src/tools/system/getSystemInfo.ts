/**
 * Get System Info Tool
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

export class GetSystemInfoTool extends BaseTool<{}, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_system_info',
      description: 'Get JobNimbus system information and configuration',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    };
  }

  async execute(input: {}, context: ToolContext): Promise<any> {
    // Return server and instance info
    return {
      instance: context.instance,
      server_version: '1.0.0',
      jobnimbus_connected: true,
    };
  }
}
