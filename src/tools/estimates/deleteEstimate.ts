/**
 * Delete Estimate Tool - Soft delete estimate in JobNimbus
 * Based on official JobNimbus API documentation
 *
 * Endpoint: PUT /api1/v2/estimates/<jnid>
 * Body: {"jnid": "<jnid>", "is_active": false}
 *
 * Note: This performs a soft delete by setting is_active to false.
 * The estimate is not permanently deleted and can be reactivated using
 * update_estimate with is_active: true.
 *
 * CRITICAL: JobNimbus API v2 requires jnid in request body (not just URL path)
 * This was discovered during MaterialOrders implementation testing.
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface DeleteEstimateInput {
  jnid: string;
}

export class DeleteEstimateTool extends BaseTool<DeleteEstimateInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'delete_estimate',
      description: 'Delete estimate',
      inputSchema: {
        type: 'object',
        properties: {
          jnid: {
            type: 'string',
            description: 'Estimate JNID',
          },
        },
        required: ['jnid'],
      },
    };
  }

  async execute(input: DeleteEstimateInput, context: ToolContext): Promise<any> {
    try {
      // Soft delete by setting is_active to false
      // CRITICAL: Include jnid in body (JobNimbus API v2 requirement)
      const response = await this.client.put(
        context.apiKey,
        `v2/estimates/${input.jnid}`,
        {
          jnid: input.jnid,
          is_active: false,
        }
      );

      return {
        success: true,
        message: 'Estimate soft deleted successfully (is_active set to false)',
        jnid: input.jnid,
        data: response.data,
        _note: 'This is a soft delete. The estimate can be reactivated using update_estimate with is_active: true',
        _metadata: {
          api_endpoint: `PUT /api1/v2/estimates/${input.jnid}`,
          action: 'soft_delete',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete estimate',
        jnid: input.jnid,
        _metadata: {
          api_endpoint: `PUT /api1/v2/estimates/${input.jnid}`,
          action: 'soft_delete',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
}

export default new DeleteEstimateTool();
