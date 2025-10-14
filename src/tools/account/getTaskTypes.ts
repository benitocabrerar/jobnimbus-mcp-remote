/**
 * Get Task Types Tool
 * Retrieve task types from JobNimbus /account/tasktype endpoint
 *
 * Integrated with Redis cache system for performance optimization
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';
import { withCache } from '../../services/cacheService.js';
import { CACHE_PREFIXES, getTTL } from '../../config/cache.js';

interface GetTaskTypesInput {
  actor?: string;
}

/**
 * Generate deterministic cache identifier from input parameters
 */
function generateCacheIdentifier(input: GetTaskTypesInput): string {
  const actor = input.actor || 'default';
  return `all:${actor}`;
}

export class GetTaskTypesTool extends BaseTool<GetTaskTypesInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_task_types',
      description: 'Retrieve all task types configured in the JobNimbus account. Task types define the categories of tasks (e.g., "Follow up", "Send estimate", "Schedule inspection") that can be assigned. This is account-level configuration data that rarely changes.',
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

  async execute(input: GetTaskTypesInput, context: ToolContext): Promise<any> {
    const cacheIdentifier = generateCacheIdentifier(input);

    return await withCache(
      {
        entity: CACHE_PREFIXES.TASK_TYPES,
        operation: CACHE_PREFIXES.LIST,
        identifier: cacheIdentifier,
      },
      getTTL('TASK_TYPES_LIST'),
      async () => {
        const params: any = {};
        if (input.actor) params.actor = input.actor;

        const result = await this.client.get(context.apiKey, 'account/tasktype', params);

        return {
          count: result.data?.results?.length || result.data?.length || 0,
          task_types: result.data?.results || result.data || [],
        };
      }
    );
  }
}
