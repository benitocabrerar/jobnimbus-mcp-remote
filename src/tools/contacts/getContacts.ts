/**
 * Get Contacts Tool
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';
import { compactContact, compactArray } from '../../utils/compactData.js';
import { getCurrentMonth } from '../../utils/dateHelpers.js';

interface GetContactsInput {
  from?: number;
  size?: number;
  date_from?: string;
  date_to?: string;
  include_full_details?: boolean;
}

export class GetContactsTool extends BaseTool<GetContactsInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_contacts',
      description: 'Retrieve contacts from JobNimbus with pagination and date filtering',
      inputSchema: {
        type: 'object',
        properties: {
          from: {
            type: 'number',
            description: 'Starting index for pagination (default: 0)',
          },
          size: {
            type: 'number',
            description: 'Number of records to retrieve (default: 15, max: 50). Use small values to prevent response saturation.',
          },
          date_from: {
            type: 'string',
            description: 'Start date filter (YYYY-MM-DD format)',
          },
          date_to: {
            type: 'string',
            description: 'End date filter (YYYY-MM-DD format)',
          },
          include_full_details: {
            type: 'boolean',
            description: 'Return full contact details. Default: false (compact mode with only essential fields). Set to true for complete contact objects.',
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
    const fromIndex = input.from || 0;
    // OPTIMIZED: Reduced from 50 to 15 (default) and 100 to 50 (max) to prevent saturation
    const requestedSize = Math.min(input.size || 15, 50);

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
      const paginatedContacts = filteredContacts.slice(fromIndex, fromIndex + requestedSize);

      // OPTIMIZED: Force compact mode if more than 10 results to prevent saturation
      const forceCompact = paginatedContacts.length > 10;
      const useCompactMode = !input.include_full_details || forceCompact;

      // Apply compaction if not requesting full details
      const resultContacts = useCompactMode
        ? compactArray(paginatedContacts, compactContact)
        : paginatedContacts;

      return {
        _code_version: 'v1.0-optimized-2025-10-10',
        count: paginatedContacts.length,
        total_filtered: filteredContacts.length,
        total_fetched: allContacts.length,
        iterations: iteration,
        from: fromIndex,
        size: requestedSize,
        has_more: fromIndex + paginatedContacts.length < filteredContacts.length,
        total_pages: Math.ceil(filteredContacts.length / requestedSize),
        current_page: Math.floor(fromIndex / requestedSize) + 1,
        date_filter_applied: !!(dateFrom || dateTo),
        date_from: dateFrom,
        date_to: dateTo,
        compact_mode: useCompactMode,
        compact_mode_forced: forceCompact,
        results: resultContacts,
      };
    } else {
      // Simple pagination without filtering
      const params: any = {
        from: fromIndex,
        size: requestedSize,
      };

      const result = await this.client.get(context.apiKey, 'contacts', params);
      const contacts = result.data?.results || [];

      // OPTIMIZED: Force compact mode if more than 10 results
      const forceCompact = contacts.length > 10;
      const useCompactMode = !input.include_full_details || forceCompact;

      // Apply compaction if not requesting full details
      const resultContacts = useCompactMode
        ? compactArray(contacts, compactContact)
        : contacts;

      return {
        _code_version: 'v1.0-optimized-2025-10-10',
        count: contacts.length,
        total_filtered: contacts.length,
        from: fromIndex,
        size: requestedSize,
        has_more: false,
        date_filter_applied: false,
        compact_mode: useCompactMode,
        compact_mode_forced: forceCompact,
        results: resultContacts,
      };
    }
  }
}
