/**
 * Get Locations Tool
 * Retrieve account locations from JobNimbus /account/location endpoint
 *
 * Integrated with Redis cache system for performance optimization
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';
import { withCache } from '../../services/cacheService.js';
import { CACHE_PREFIXES, getTTL } from '../../config/cache.js';

interface GetLocationsInput {
  actor?: string;
}

/**
 * Generate deterministic cache identifier from input parameters
 */
function generateCacheIdentifier(input: GetLocationsInput): string {
  const actor = input.actor || 'default';
  return `all:${actor}`;
}

export class GetLocationsTool extends BaseTool<GetLocationsInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_locations',
      description: 'Retrieve all locations configured in the JobNimbus account. Locations represent physical business locations or service areas. This is account-level configuration data that rarely changes.',
      inputSchema: {
        type: 'object',
        properties: {
          actor: {
            type: 'string',
            description: 'Optional: User ID to act as for permission-based filtering',
          },
        },
      },
    };
  }

  async execute(input: GetLocationsInput, context: ToolContext): Promise<any> {
    const cacheIdentifier = generateCacheIdentifier(input);

    return await withCache(
      {
        entity: CACHE_PREFIXES.LOCATIONS,
        operation: CACHE_PREFIXES.LIST,
        identifier: cacheIdentifier,
      },
      getTTL('LOCATIONS_LIST'),
      async () => {
        const params: any = {};
        if (input.actor) params.actor = input.actor;

        const result = await this.client.get(context.apiKey, 'account/location', params);

        return {
          count: result.data?.results?.length || result.data?.length || 0,
          locations: result.data?.results || result.data || [],
        };
      }
    );
  }
}
