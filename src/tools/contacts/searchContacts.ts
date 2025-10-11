/**
 * Search Contacts Tool
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';
import { getCurrentMonth } from '../../utils/dateHelpers.js';

interface SearchContactsInput {
  query?: string;
  from?: number;
  size?: number;
  date_from?: string;
  date_to?: string;
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
}
