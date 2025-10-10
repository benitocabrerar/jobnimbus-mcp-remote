/**
 * Get Contacts Tool
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';
import { compactContact, compactArray } from '../../utils/compactData.js';
import { getCurrentDate } from '../../utils/dateHelpers.js';

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
            description: 'Number of records to retrieve (default: 50, max: 100)',
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

  async execute(input: GetContactsInput, context: ToolContext): Promise<any> {
    const fromIndex = input.from || 0;
    const requestedSize = Math.min(input.size || 50, 100);

    // Use current date as default if no date filters provided
    const currentDate = getCurrentDate();
    const dateFrom = input.date_from || currentDate;
    const dateTo = input.date_to || currentDate;

    const params: any = {
      from: fromIndex,
      size: requestedSize,
    };

    if (dateFrom) {
      params.date_from = dateFrom;
    }

    if (dateTo) {
      params.date_to = dateTo;
    }

    const result = await this.client.get(context.apiKey, 'contacts', params);
    const contacts = result.data?.results || [];

    // Apply compaction if not requesting full details
    const resultContacts = input.include_full_details
      ? contacts
      : compactArray(contacts, compactContact);

    return {
      count: contacts.length,
      from: fromIndex,
      size: requestedSize,
      date_filter_applied: !!(dateFrom || dateTo),
      date_from: dateFrom,
      date_to: dateTo,
      compact_mode: !input.include_full_details,
      results: resultContacts,
    };
  }
}
