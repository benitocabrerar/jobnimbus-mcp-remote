/**
 * Search Contacts Tool
 *
 * PHASE 2: Integrated Redis cache system for performance optimization
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';
import { getCurrentMonth } from '../../utils/dateHelpers.js';
import { withCache } from '../../services/cacheService.js';
import { CACHE_PREFIXES, getTTL } from '../../config/cache.js';

interface SearchContactsInput {
  query?: string;
  from?: number;
  size?: number;
  date_from?: string;
  date_to?: string;
}

/**
 * Generate deterministic cache identifier from input parameters
 * Format: {query}:{from}:{size}:{date_from}:{date_to}
 */
function generateCacheIdentifier(input: SearchContactsInput): string {
  const query = input.query || 'all';
  const from = input.from || 0;
  const size = input.size || 50;
  const dateFrom = input.date_from || 'null';
  const dateTo = input.date_to || 'null';

  return `${query}:${from}:${size}:${dateFrom}:${dateTo}`;
}

export class SearchContactsTool extends BaseTool<SearchContactsInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'search_contacts',
      description: 'Search contacts by criteria with pagination and date filtering',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query',
          },
          from: {
            type: 'number',
            description: 'Starting index for pagination (default: 0)',
          },
          size: {
            type: 'number',
            description: 'Number of records (default: 50, max: 100)',
          },
          date_from: {
            type: 'string',
            description: 'Start date filter (YYYY-MM-DD format)',
          },
          date_to: {
            type: 'string',
            description: 'End date filter (YYYY-MM-DD format)',
          },
        },
      },
    };
  }

  async execute(input: SearchContactsInput, context: ToolContext): Promise<any> {
    // Generate cache identifier
    const cacheIdentifier = generateCacheIdentifier(input);

    // Wrap with cache layer (PHASE 2: Redis cache integration)
    return await withCache(
      {
        entity: CACHE_PREFIXES.CONTACTS,
        operation: CACHE_PREFIXES.SEARCH,
        identifier: cacheIdentifier,
      },
      getTTL('CONTACTS_SEARCH'),
      async () => {
        // Use current month as default if no date filters provided
        const currentMonth = getCurrentMonth();
        const dateFrom = input.date_from || currentMonth.date_from;
        const dateTo = input.date_to || currentMonth.date_to;

        const params: any = {
          from: input.from || 0,
          size: Math.min(input.size || 50, 100),
        };

        if (input.query) params.q = input.query;
        if (dateFrom) params.date_from = dateFrom;
        if (dateTo) params.date_to = dateTo;

        const result = await this.client.get(context.apiKey, 'contacts/search', params);
        return result.data;
      }
    );
  }
}
