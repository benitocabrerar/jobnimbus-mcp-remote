/**
 * Delete Material Order Tool - Soft delete material order in JobNimbus
 * Based on official JobNimbus API documentation
 *
 * Endpoint: PUT /api1/v2/materialorders/<jnid>
 * Body: {"is_active": false}
 *
 * Note: This performs a soft delete by setting is_active to false.
 * The material order is not permanently deleted and can be reactivated.
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface DeleteMaterialOrderInput {
  jnid: string;
}

export class DeleteMaterialOrderTool extends BaseTool<DeleteMaterialOrderInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'delete_material_order',
      description: 'Soft delete a material order in JobNimbus by setting is_active to false. The material order is not permanently deleted and can be reactivated using update_material_order with is_active: true. Returns confirmation of deletion.',
      inputSchema: {
        type: 'object',
        properties: {
          jnid: {
            type: 'string',
            description: 'Material Order JNID to delete - Required',
          },
        },
        required: ['jnid'],
      },
    };
  }

  async execute(input: DeleteMaterialOrderInput, context: ToolContext): Promise<any> {
    try {
      // Soft delete by setting is_active to false
      const response = await this.client.put(
        context.apiKey,
        `v2/materialorders/${input.jnid}`,
        {
          is_active: false,
        }
      );

      return {
        success: true,
        message: 'Material order soft deleted successfully (is_active set to false)',
        jnid: input.jnid,
        data: response.data,
        _note: 'This is a soft delete. The material order can be reactivated using update_material_order with is_active: true',
        _metadata: {
          api_endpoint: `PUT /api1/v2/materialorders/${input.jnid}`,
          action: 'soft_delete',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete material order',
        jnid: input.jnid,
        _metadata: {
          api_endpoint: `PUT /api1/v2/materialorders/${input.jnid}`,
          action: 'soft_delete',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
}

export default new DeleteMaterialOrderTool();
