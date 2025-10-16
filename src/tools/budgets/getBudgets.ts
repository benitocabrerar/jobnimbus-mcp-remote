/**
 * Get Budgets Tool (Legacy)
 * Retrieve budgets from JobNimbus /budgets endpoint
 *
 * LEGACY ENDPOINT - This is a legacy endpoint for viewing budgets
 * Integrated with Redis cache system for performance optimization
 *
 * Endpoint: GET /api1/budgets
 * Documentation: Budgets (Legacy).txt
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';
import { withCache } from '../../services/cacheService.js';
import { CACHE_PREFIXES, getTTL } from '../../config/cache.js';

interface GetBudgetsInput {
  from?: number;
  size?: number;
  filter?: string;
  sort_field?: string;
  sort_direction?: 'asc' | 'desc';
}

/**
 * Generate deterministic cache identifier from input parameters
 */
function generateCacheIdentifier(input: GetBudgetsInput): string {
  const from = input.from || 0;
  const size = input.size || 50;
  const filter = input.filter || 'null';
  const sortField = input.sort_field || 'date_created';
  const sortDirection = input.sort_direction || 'desc';

  return `${from}:${size}:${filter}:${sortField}:${sortDirection}`;
}

export class GetBudgetsTool extends BaseTool<GetBudgetsInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_budgets',
      description: 'Budgets: retrieve legacy endpoint, pagination, filtering, sorting',
      inputSchema: {
        type: 'object',
        properties: {
          from: {
            type: 'number',
            description: 'Starting index for pagination (default: 0)',
          },
          size: {
            type: 'number',
            description: 'Number of records to retrieve (default: 50, max: 1000)',
          },
          filter: {
            type: 'string',
            description: 'URL-encoded JSON filter using Elasticsearch syntax. Example: {"must":[{"term":{"related.id":"job123"}}]}',
          },
          sort_field: {
            type: 'string',
            description: 'Field to sort by (default: date_created)',
          },
          sort_direction: {
            type: 'string',
            description: 'Sort direction: asc or desc (default: desc)',
            enum: ['asc', 'desc'],
          },
        },
      },
    };
  }

  async execute(input: GetBudgetsInput, context: ToolContext): Promise<any> {
    const cacheIdentifier = generateCacheIdentifier(input);

    return await withCache(
      {
        entity: CACHE_PREFIXES.BUDGETS,
        operation: CACHE_PREFIXES.LIST,
        identifier: cacheIdentifier,
      instance: context.instance,
      },
      getTTL('BUDGETS_LIST'),
      async () => {
        const params: any = {
          from: input.from || 0,
          size: Math.min(input.size || 50, 1000),
        };

        if (input.filter) params.filter = input.filter;
        if (input.sort_field) params.sort_field = input.sort_field;
        if (input.sort_direction) params.sort_direction = input.sort_direction;

        const result = await this.client.get(context.apiKey, 'budgets', params);

        return {
          count: result.data?.results?.length || result.data?.length || 0,
          from: params.from,
          size: params.size,
          filter_applied: !!input.filter,
          sort_by: input.sort_field || 'date_created',
          sort_direction: input.sort_direction || 'desc',
          results: result.data?.results || result.data || [],
          _metadata: {
            api_endpoint: 'GET /api1/budgets',
            note: 'This is a legacy endpoint',
            cached: false,
            timestamp: new Date().toISOString(),
          },
        };
      }
    );
  }
}

export default new GetBudgetsTool();
