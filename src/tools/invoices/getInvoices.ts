/**
 * Get Invoices Tool
 * Retrieve invoices from JobNimbus /invoices endpoint
 *
 * VERIFIED WORKING - This endpoint exists and returns invoice data
 * Integrated with Redis cache system for performance optimization
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';
import { withCache } from '../../services/cacheService.js';
import { CACHE_PREFIXES, getTTL } from '../../config/cache.js';

interface GetInvoicesInput {
  from?: number;
  size?: number;
  filter?: string;
  sort_field?: string;
  sort_direction?: 'asc' | 'desc';
  actor?: string;
}

/**
 * Generate deterministic cache identifier from input parameters
 */
function generateCacheIdentifier(input: GetInvoicesInput): string {
  const from = input.from || 0;
  const size = input.size || 50;
  const filter = input.filter || 'null';
  const sortField = input.sort_field || 'date_created';
  const sortDirection = input.sort_direction || 'desc';
  const actor = input.actor || 'null';

  return `${from}:${size}:${filter}:${sortField}:${sortDirection}:${actor}`;
}

export class GetInvoicesTool extends BaseTool<GetInvoicesInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_invoices',
      description: 'Retrieve invoices from JobNimbus. Invoices are billing documents for completed work. Supports pagination, filtering by related entities (jobs, contacts), and sorting. Returns invoice details including amounts, payment status, line items, and related records.',
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
          actor: {
            type: 'string',
            description: 'Optional: User ID to act as for permission-based filtering',
          },
        },
      },
    };
  }

  async execute(input: GetInvoicesInput, context: ToolContext): Promise<any> {
    const cacheIdentifier = generateCacheIdentifier(input);

    return await withCache(
      {
        entity: CACHE_PREFIXES.INVOICES,
        operation: CACHE_PREFIXES.LIST,
        identifier: cacheIdentifier,
      },
      getTTL('INVOICES_LIST'),
      async () => {
        const params: any = {
          from: input.from || 0,
          size: Math.min(input.size || 50, 1000),
        };

        if (input.filter) params.filter = input.filter;
        if (input.sort_field) params.sort_field = input.sort_field;
        if (input.sort_direction) params.sort_direction = input.sort_direction;
        if (input.actor) params.actor = input.actor;

        const result = await this.client.get(context.apiKey, 'invoices', params);

        return {
          count: result.data?.results?.length || 0,
          from: params.from,
          size: params.size,
          filter_applied: !!input.filter,
          sort_by: input.sort_field || 'date_created',
          sort_direction: input.sort_direction || 'desc',
          results: result.data?.results || result.data || [],
        };
      }
    );
  }
}
