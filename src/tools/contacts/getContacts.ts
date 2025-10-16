/**
 * Get Contacts Tool
 *
 * PHASE 3: Handle-based response system for token optimization
 * - Automatic response size detection and handle storage
 * - Verbosity levels: summary/compact/detailed/raw
 * - Field selection support
 * - Redis cache + handle storage integration
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext, BaseToolInput } from '../../types/index.js';
import { compactContact, compactArray } from '../../utils/compactData.js';
import { getCurrentMonth } from '../../utils/dateHelpers.js';
import { withCache } from '../../services/cacheService.js';
import { CACHE_PREFIXES, getTTL } from '../../config/cache.js';

interface GetContactsInput extends BaseToolInput {
  // Pagination
  from?: number;
  size?: number;
  page_size?: number;

  // Response control (Phase 3: Handle-based system)
  verbosity?: 'summary' | 'compact' | 'detailed' | 'raw';
  fields?: string;

  // Date filtering
  date_from?: string;
  date_to?: string;

  // Legacy parameter (replaced by verbosity, but kept for backward compatibility)
  include_full_details?: boolean;
}

/**
 * Generate deterministic cache identifier from input parameters
 * Format: {from}:{size}:{page_size}:{verbosity}:{fields}:{date_from}:{date_to}:{full_details}
 *
 * CRITICAL: Must include verbosity and page_size to prevent returning wrong cached responses
 */
function generateCacheIdentifier(input: GetContactsInput): string {
  const from = input.from || 0;
  const size = input.size || 15;
  const pageSize = input.page_size || 'null';
  const verbosity = input.verbosity || 'null';
  const fields = input.fields || 'null';
  const dateFrom = input.date_from || 'null';
  const dateTo = input.date_to || 'null';
  const fullDetails = input.include_full_details ? 'full' : 'compact';

  return `${from}:${size}:${pageSize}:${verbosity}:${fields}:${dateFrom}:${dateTo}:${fullDetails}`;
}

export class GetContactsTool extends BaseTool<GetContactsInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_contacts',
      description: 'Retrieve contacts with pagination and date filtering',
      inputSchema: {
        type: 'object',
        properties: {
          // NEW: Handle-based response control
          verbosity: {
            type: 'string',
            description: 'Detail level: summary/compact/detailed/raw',
            enum: ['summary', 'compact', 'detailed', 'raw'],
          },
          fields: {
            type: 'string',
            description: 'Comma-separated field names to return',
          },
          page_size: {
            type: 'number',
            description: 'Records per page (default: 20, max: 100)',
          },

          // Existing parameters
          from: {
            type: 'number',
            description: 'Starting index (default: 0)',
          },
          size: {
            type: 'number',
            description: 'Records to retrieve (default: 15, max: 50)',
          },
          date_from: {
            type: 'string',
            description: 'Start date (YYYY-MM-DD)',
          },
          date_to: {
            type: 'string',
            description: 'End date (YYYY-MM-DD)',
          },
          include_full_details: {
            type: 'boolean',
            description: 'Return full details (legacy, use verbosity)',
          },
        },
      },
    };
  }

  /**
   * Convert YYYY-MM-DD string to Unix timestamp
   */
  private dateStringToUnix(dateStr: string, isStartOfDay: boolean = true): number {
    const date = new Date(dateStr + 'T00:00:00Z');
    if (isStartOfDay) {
      return Math.floor(date.getTime() / 1000);
    } else {
      // End of day (23:59:59)
      return Math.floor(date.getTime() / 1000) + 86399;
    }
  }

  /**
   * Filter contacts by date_created
   */
  private filterByDateCreated(contacts: any[], dateFrom?: string, dateTo?: string): any[] {
    let filtered = contacts;

    if (dateFrom) {
      const fromTs = this.dateStringToUnix(dateFrom, true);
      filtered = filtered.filter(c => (c.date_created || 0) >= fromTs);
    }

    if (dateTo) {
      const toTs = this.dateStringToUnix(dateTo, false);
      filtered = filtered.filter(c => (c.date_created || 0) <= toTs);
    }

    return filtered;
  }

  async execute(input: GetContactsInput, context: ToolContext): Promise<any> {
    // Generate cache identifier
    const cacheIdentifier = generateCacheIdentifier(input);

    // Wrap with cache layer (PHASE 2: Redis cache integration)
    return await withCache(
      {
        entity: CACHE_PREFIXES.CONTACTS,
        operation: CACHE_PREFIXES.LIST,
        identifier: cacheIdentifier,
      },
      getTTL('CONTACTS_LIST'),
      async () => {
        // Determine page size - prefer page_size (new) over size (legacy)
        const pageSize = input.page_size || input.size || 15;
        const fromIndex = input.from || 0;

        // Use current month as default if no date filters provided
        const currentMonth = getCurrentMonth();
        const dateFrom = input.date_from || currentMonth.date_from;
        const dateTo = input.date_to || currentMonth.date_to;

        // Determine if we need to fetch all contacts for date filtering
        const needsFullFetch = dateFrom || dateTo;

    if (needsFullFetch) {
      // Fetch all contacts with pagination
      const batchSize = 100;
      // OPTIMIZED: Reduced from 50 to 20 iterations (max 2000 instead of 5000 records)
      const maxIterations = 20;
      let allContacts: any[] = [];
      let offset = 0;
      let iteration = 0;

      while (iteration < maxIterations) {
        const params = { size: batchSize, from: offset };
        const response = await this.client.get(context.apiKey, 'contacts', params);
        const batch = response.data?.results || [];

        if (batch.length === 0) {
          break;
        }

        allContacts = allContacts.concat(batch);
        offset += batchSize;
        iteration++;

        if (batch.length < batchSize) {
          break;
        }
      }

      // Apply date_created filtering
      let filteredContacts = this.filterByDateCreated(allContacts, dateFrom, dateTo);

      // Paginate
      const rawContacts = filteredContacts.slice(fromIndex, fromIndex + pageSize);
      const totalFiltered = filteredContacts.length;

      // Build page info
      const pageInfo = {
        has_more: fromIndex + rawContacts.length < totalFiltered,
        total: totalFiltered,
        current_page: Math.floor(fromIndex / pageSize) + 1,
        total_pages: Math.ceil(totalFiltered / pageSize),
      };

      // Check if using new handle-based parameters
      if (this.hasNewParams(input)) {
        // NEW BEHAVIOR: Use handle-based response system
        // ResponseBuilder expects the raw data array, not a wrapper object
        const envelope = await this.wrapResponse(rawContacts, input, context, {
          entity: 'contacts',
          maxRows: pageSize,
          pageInfo,
        });

        // Add contacts-specific metadata to the envelope
        return {
          ...envelope,
          query_metadata: {
            count: rawContacts.length,
            total_filtered: totalFiltered,
            total_fetched: allContacts.length,
            iterations: iteration,
            from: fromIndex,
            page_size: pageSize,
            date_filter_applied: !!(dateFrom || dateTo),
            date_from: dateFrom,
            date_to: dateTo,
          },
        };
      } else {
        // LEGACY BEHAVIOR: Maintain backward compatibility
        const forceCompact = rawContacts.length > 10;
        const useCompactMode = !input.include_full_details || forceCompact;
        const resultContacts = useCompactMode
          ? compactArray(rawContacts, compactContact)
          : rawContacts;

        return {
          _code_version: 'v1.0-optimized-2025-10-10',
          count: rawContacts.length,
          total_filtered: totalFiltered,
          total_fetched: allContacts.length,
          iterations: iteration,
          from: fromIndex,
          size: pageSize,
          has_more: pageInfo.has_more,
          total_pages: pageInfo.total_pages,
          current_page: pageInfo.current_page,
          date_filter_applied: !!(dateFrom || dateTo),
          date_from: dateFrom,
          date_to: dateTo,
          compact_mode: useCompactMode,
          compact_mode_forced: forceCompact,
          results: resultContacts,
        };
      }
    } else {
      // Simple pagination without filtering
      const params: any = {
        from: fromIndex,
        size: pageSize,
      };

      const result = await this.client.get(context.apiKey, 'contacts', params);
      const rawContacts = result.data?.results || [];
      const totalFiltered = rawContacts.length;

      // Build page info
      const pageInfo = {
        has_more: false,
        total: totalFiltered,
        current_page: 1,
        total_pages: 1,
      };

      // Check if using new handle-based parameters
      if (this.hasNewParams(input)) {
        // NEW BEHAVIOR: Use handle-based response system
        // ResponseBuilder expects the raw data array, not a wrapper object
        const envelope = await this.wrapResponse(rawContacts, input, context, {
          entity: 'contacts',
          maxRows: pageSize,
          pageInfo,
        });

        // Add contacts-specific metadata to the envelope
        return {
          ...envelope,
          query_metadata: {
            count: rawContacts.length,
            total_filtered: totalFiltered,
            from: fromIndex,
            page_size: pageSize,
            date_filter_applied: false,
          },
        };
      } else {
        // LEGACY BEHAVIOR: Maintain backward compatibility
        const forceCompact = rawContacts.length > 10;
        const useCompactMode = !input.include_full_details || forceCompact;
        const resultContacts = useCompactMode
          ? compactArray(rawContacts, compactContact)
          : rawContacts;

        return {
          _code_version: 'v1.0-optimized-2025-10-10',
          count: rawContacts.length,
          total_filtered: totalFiltered,
          from: fromIndex,
          size: pageSize,
          has_more: false,
          date_filter_applied: false,
          compact_mode: useCompactMode,
          compact_mode_forced: forceCompact,
          results: resultContacts,
        };
      }
    }
      }
    );
  }
}
