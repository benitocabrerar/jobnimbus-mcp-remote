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
    // Check if using new handle-based parameters for response optimization
    const useHandleResponse = this.hasNewParams(input);

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

      const successData = {
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

      // Use handle-based response if requested
      if (useHandleResponse) {
        const envelope = await this.wrapResponse([successData], input, context, {
          entity: 'estimate',
          maxRows: 1,
          pageInfo: {
            current_page: 1,
            total_pages: 1,
            has_more: false,
            total: 1,
          },
        });

        return {
          ...envelope,
          query_metadata: {
            operation: 'delete',
            estimate_jnid: input.jnid,
            action: 'soft_delete',
            is_active_set_to: false,
            can_reactivate: true,
            data_freshness: 'real-time',
            api_endpoint: `PUT /api1/v2/estimates/${input.jnid}`,
          },
        };
      }

      // Fallback to legacy response
      return successData;
    } catch (error) {
      const errorResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete estimate',
        jnid: input.jnid,
        _metadata: {
          api_endpoint: `PUT /api1/v2/estimates/${input.jnid}`,
          action: 'soft_delete',
          timestamp: new Date().toISOString(),
        },
      };

      // Use handle-based response if requested (even for errors)
      if (useHandleResponse) {
        const envelope = await this.wrapResponse([errorResponse], input, context, {
          entity: 'estimate',
          maxRows: 0,
          pageInfo: {
            current_page: 1,
            total_pages: 1,
            has_more: false,
            total: 0,
          },
        });

        return {
          ...envelope,
          query_metadata: {
            operation: 'delete',
            estimate_jnid: input.jnid,
            action: 'soft_delete',
            error: true,
            error_message: error instanceof Error ? error.message : 'Failed to delete estimate',
            data_freshness: 'real-time',
            api_endpoint: `PUT /api1/v2/estimates/${input.jnid}`,
          },
        };
      }

      // Fallback to legacy error response
      return errorResponse;
    }
  }
}

export default new DeleteEstimateTool();
