/**
 * Delete Work Order Tool - Soft delete work order in JobNimbus
 * Based on official JobNimbus API documentation (WorkOrders.txt)
 *
 * Endpoint: PUT /api1/v2/workorders/{id}
 * Body: {"is_active": false}
 *
 * Performs a soft delete by setting is_active to false. The work order
 * remains in the system but is marked as inactive.
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface DeleteWorkOrderInput {
  jnid: string;
}

export class DeleteWorkOrderTool extends BaseTool<DeleteWorkOrderInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'delete_work_order',
      description: 'WorkOrders: soft delete, deactivate, reactivatable',
      inputSchema: {
        type: 'object',
        properties: {
          jnid: {
            type: 'string',
            description: 'Work Order JNID to delete (required)',
          },
        },
        required: ['jnid'],
      },
    };
  }

  async execute(input: DeleteWorkOrderInput, context: ToolContext): Promise<any> {
    const { jnid } = input;

    if (!jnid) {
      return {
        success: false,
        error: 'Missing required parameter: jnid',
        _metadata: {
          api_endpoint: 'PUT /api1/v2/workorders/{id}',
          timestamp: new Date().toISOString(),
        },
      };
    }

    try {
      // Call JobNimbus API v2 with soft delete
      // Per documentation: PUT with {"is_active": false}
      const response = await this.client.put(
        context.apiKey,
        `v2/workorders/${jnid}`,
        {
          jnid: jnid,  // Required by JobNimbus API
          is_active: false,
        }
      );

      return {
        success: true,
        message: 'Work order deleted successfully (soft delete)',
        data: response.data,
        summary: {
          jnid: response.data.jnid,
          name: response.data.name || 'Unnamed Work Order',
          is_active: response.data.is_active,
          note: 'Soft delete - work order set to inactive but remains in system',
        },
        _metadata: {
          api_endpoint: `PUT /api1/v2/workorders/${jnid}`,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete work order',
        jnid: jnid,
        _metadata: {
          api_endpoint: `PUT /api1/v2/workorders/${jnid}`,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
}

export default new DeleteWorkOrderTool();
