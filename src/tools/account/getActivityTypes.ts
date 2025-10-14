/**
 * Get Activity Types Tool
 * Retrieve activity types from JobNimbus /account/activitytype endpoint
 *
 * Integrated with Redis cache system for performance optimization
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';
import { withCache } from '../../services/cacheService.js';
import { CACHE_PREFIXES, getTTL } from '../../config/cache.js';

interface GetActivityTypesInput {
  actor?: string;
}

/**
 * Generate deterministic cache identifier from input parameters
 */
function generateCacheIdentifier(input: GetActivityTypesInput): string {
  const actor = input.actor || 'default';
  return `all:${actor}`;
}

export class GetActivityTypesTool extends BaseTool<GetActivityTypesInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_activity_types',
      description: 'Retrieve all activity types configured in the JobNimbus account. Activity types define the categories of activities (e.g., "Meeting", "Call", "Site Visit") that can be scheduled. This is account-level configuration data that rarely changes.',
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

  async execute(input: GetActivityTypesInput, context: ToolContext): Promise<any> {
    const cacheIdentifier = generateCacheIdentifier(input);

    return await withCache(
      {
        entity: CACHE_PREFIXES.ACTIVITY_TYPES,
        operation: CACHE_PREFIXES.LIST,
        identifier: cacheIdentifier,
      },
      getTTL('ACTIVITY_TYPES_LIST'),
      async () => {
        const params: any = {};
        if (input.actor) params.actor = input.actor;

        const result = await this.client.get(context.apiKey, 'account/activitytype', params);

        return {
          count: result.data?.results?.length || result.data?.length || 0,
          activity_types: result.data?.results || result.data || [],
        };
      }
    );
  }
}
