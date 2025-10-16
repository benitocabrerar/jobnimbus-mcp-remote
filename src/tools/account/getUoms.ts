/**
 * Get UoMs Tool - Retrieve Units of Measurement
 * Based on official JobNimbus API documentation
 *
 * Endpoint: GET /api1/utility/uoms
 *
 * Note: Returns array of Unit of Measurement strings (e.g., "SQ", "UOM1", etc.)
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';
import { withCache } from '../../services/cacheService.js';
import { CACHE_PREFIXES, getTTL } from '../../config/cache.js';

interface GetUomsInput {
  // No input parameters required
}

export class GetUomsTool extends BaseTool<GetUomsInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_uoms',
      description: 'Account: units of measurement, UoM codes, product/estimate usage',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    };
  }

  async execute(input: GetUomsInput, context: ToolContext): Promise<any> {
    // Wrap with cache layer
    return await withCache(
      {
        entity: CACHE_PREFIXES.ACCOUNT,
        operation: CACHE_PREFIXES.LIST,
        identifier: 'uoms',
      instance: context.instance,
      },
      getTTL('ACCOUNT_UOMS'),
      async () => {
        try {
          // Call JobNimbus API
          const response = await this.client.get(
            context.apiKey,
            'utility/uoms'
          );

          const uoms: string[] = response.data || [];

          return {
            success: true,
            data: {
              uoms: uoms,
            },
            summary: {
              total_count: uoms.length,
            },
            _metadata: {
              api_endpoint: 'GET /api1/utility/uoms',
              note: 'Returns array of UoM code strings',
              cached: false,
              timestamp: new Date().toISOString(),
            },
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to retrieve UoMs',
            _metadata: {
              api_endpoint: 'GET /api1/utility/uoms',
              timestamp: new Date().toISOString(),
            },
          };
        }
      }
    );
  }
}

export default new GetUomsTool();
