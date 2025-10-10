/**
 * Get Estimates Tool
 * Enhanced with status filtering, sent/approved date filtering, and sorting capabilities
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';
import { getCurrentDate } from '../../utils/dateHelpers.js';

interface GetEstimatesInput {
  from?: number;
  size?: number;
  date_from?: string;
  date_to?: string;
  sent_from?: string;
  sent_to?: string;
  approved_from?: string;
  approved_to?: string;
  has_approval?: boolean;
  status?: string;
  sort_by?: 'date_sent' | 'date_approved' | 'date_created' | 'date_updated';
  order?: 'asc' | 'desc';
}

interface Estimate {
  jnid?: string;
  date_sent?: number;
  date_signed?: number;
  date_created?: number;
  date_updated?: number;
  status?: number;
  status_name?: string;
  [key: string]: any;
}

export class GetEstimatesTool extends BaseTool<GetEstimatesInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_estimates',
      description: 'Retrieve estimates from JobNimbus with pagination, date filtering, status filtering, sent/approved date filtering, and sorting',
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
            description: 'Start date filter for date_created (YYYY-MM-DD format)',
          },
          date_to: {
            type: 'string',
            description: 'End date filter for date_created (YYYY-MM-DD format)',
          },
          sent_from: {
            type: 'string',
            description: 'Filter estimates sent on or after this date (date_sent >= fecha, YYYY-MM-DD format)',
          },
          sent_to: {
            type: 'string',
            description: 'Filter estimates sent on or before this date (date_sent <= fecha, YYYY-MM-DD format)',
          },
          approved_from: {
            type: 'string',
            description: 'Filter estimates signed on or after this date (date_signed >= fecha, YYYY-MM-DD format)',
          },
          approved_to: {
            type: 'string',
            description: 'Filter estimates signed on or before this date (date_signed <= fecha, YYYY-MM-DD format)',
          },
          has_approval: {
            type: 'boolean',
            description: 'Filter only estimates with approval/signed status (date_signed > 0)',
          },
          status: {
            type: 'string',
            description: 'Filter by estimate status (e.g., "pending", "approved", "rejected")',
          },
          sort_by: {
            type: 'string',
            description: 'Field to sort by',
            enum: ['date_sent', 'date_approved', 'date_created', 'date_updated'],
          },
          order: {
            type: 'string',
            description: 'Sort order (asc or desc)',
            enum: ['asc', 'desc'],
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
   * Filter estimates by date_created
   */
  private filterByDateCreated(estimates: Estimate[], dateFrom?: string, dateTo?: string): Estimate[] {
    let filtered = estimates;

    if (dateFrom) {
      const fromTs = this.dateStringToUnix(dateFrom, true);
      filtered = filtered.filter(e => (e.date_created || 0) >= fromTs);
    }

    if (dateTo) {
      const toTs = this.dateStringToUnix(dateTo, false);
      filtered = filtered.filter(e => (e.date_created || 0) <= toTs);
    }

    return filtered;
  }

  /**
   * Filter estimates by sent date (date_sent)
   */
  private filterBySentDate(
    estimates: Estimate[],
    sentFrom?: string,
    sentTo?: string
  ): Estimate[] {
    let filtered = estimates;

    if (sentFrom) {
      const sentFromTs = this.dateStringToUnix(sentFrom, true);
      filtered = filtered.filter(e => (e.date_sent || 0) >= sentFromTs);
    }

    if (sentTo) {
      const sentToTs = this.dateStringToUnix(sentTo, false);
      filtered = filtered.filter(e => {
        const dateSent = e.date_sent || 0;
        return dateSent > 0 && dateSent <= sentToTs;
      });
    }

    return filtered;
  }

  /**
   * Filter estimates by signed date (date_signed) and has_approval
   */
  private filterByApprovedDate(
    estimates: Estimate[],
    approvedFrom?: string,
    approvedTo?: string,
    hasApproval?: boolean
  ): Estimate[] {
    let filtered = estimates;

    // Filter by has_approval first (using date_signed)
    if (hasApproval !== undefined) {
      if (hasApproval) {
        filtered = filtered.filter(e => (e.date_signed || 0) > 0);
      } else {
        filtered = filtered.filter(e => (e.date_signed || 0) === 0);
      }
    }

    // Filter by approved_from (using date_signed)
    if (approvedFrom) {
      const approvedFromTs = this.dateStringToUnix(approvedFrom, true);
      filtered = filtered.filter(e => (e.date_signed || 0) >= approvedFromTs);
    }

    // Filter by approved_to (using date_signed)
    if (approvedTo) {
      const approvedToTs = this.dateStringToUnix(approvedTo, false);
      filtered = filtered.filter(e => {
        const dateSigned = e.date_signed || 0;
        return dateSigned > 0 && dateSigned <= approvedToTs;
      });
    }

    return filtered;
  }

  /**
   * Filter estimates by status
   */
  private filterByStatus(estimates: Estimate[], status?: string): Estimate[] {
    if (!status) {
      return estimates;
    }

    const lowerStatus = status.toLowerCase();
    return estimates.filter(e => {
      const estimateStatus = String(e.status_name || '').toLowerCase();
      return estimateStatus.includes(lowerStatus);
    });
  }

  /**
   * Sort estimates by specified field
   */
  private sortEstimates(estimates: Estimate[], sortBy?: string, order: string = 'desc'): Estimate[] {
    if (!sortBy || estimates.length === 0) {
      return estimates;
    }

    const validFields = ['date_sent', 'date_approved', 'date_created', 'date_updated'];
    if (!validFields.includes(sortBy)) {
      return estimates;
    }

    const reverse = order === 'desc';

    return [...estimates].sort((a, b) => {
      const aVal = (a[sortBy] as number) || 0;
      const bVal = (b[sortBy] as number) || 0;
      return reverse ? bVal - aVal : aVal - bVal;
    });
  }

  async execute(input: GetEstimatesInput, context: ToolContext): Promise<any> {
    const fromIndex = input.from || 0;
    const requestedSize = Math.min(input.size || 50, 100);
    const order = input.order || 'desc';

    // Use current date as default if no date filters provided
    const currentDate = getCurrentDate();
    const dateFrom = input.date_from || currentDate;
    const dateTo = input.date_to || currentDate;

    // Determine if we need to fetch all estimates for filtering/sorting
    const needsFullFetch =
      dateFrom ||
      dateTo ||
      input.sent_from ||
      input.sent_to ||
      input.approved_from ||
      input.approved_to ||
      input.has_approval !== undefined ||
      input.status ||
      input.sort_by;

    if (needsFullFetch) {
      // Fetch all estimates with pagination
      const batchSize = 100;
      const maxIterations = 50;
      let allEstimates: Estimate[] = [];
      let offset = 0;
      let iteration = 0;

      while (iteration < maxIterations) {
        const params = { size: batchSize, from: offset };
        const response = await this.client.get(context.apiKey, 'estimates', params);
        const batch = response.data?.results || [];

        if (batch.length === 0) {
          break;
        }

        allEstimates = allEstimates.concat(batch);
        offset += batchSize;
        iteration++;

        if (batch.length < batchSize) {
          break;
        }
      }

      // Apply date_created filtering
      let filteredEstimates = this.filterByDateCreated(allEstimates, dateFrom, dateTo);

      // Apply sent date filtering
      if (input.sent_from || input.sent_to) {
        filteredEstimates = this.filterBySentDate(
          filteredEstimates,
          input.sent_from,
          input.sent_to
        );
      }

      // Apply approved date filtering
      if (input.approved_from || input.approved_to || input.has_approval !== undefined) {
        filteredEstimates = this.filterByApprovedDate(
          filteredEstimates,
          input.approved_from,
          input.approved_to,
          input.has_approval
        );
      }

      // Apply status filtering
      if (input.status) {
        filteredEstimates = this.filterByStatus(filteredEstimates, input.status);
      }

      // Apply sorting
      if (input.sort_by) {
        filteredEstimates = this.sortEstimates(filteredEstimates, input.sort_by, order);
      }

      // Paginate
      const paginatedEstimates = filteredEstimates.slice(fromIndex, fromIndex + requestedSize);

      return {
        count: paginatedEstimates.length,
        total_filtered: filteredEstimates.length,
        total_fetched: allEstimates.length,
        iterations: iteration,
        from: fromIndex,
        size: requestedSize,
        has_more: fromIndex + paginatedEstimates.length < filteredEstimates.length,
        total_pages: Math.ceil(filteredEstimates.length / requestedSize),
        current_page: Math.floor(fromIndex / requestedSize) + 1,
        date_filter_applied: !!(dateFrom || dateTo),
        date_from: dateFrom,
        date_to: dateTo,
        sent_date_filter_applied: !!(input.sent_from || input.sent_to),
        sent_from: input.sent_from,
        sent_to: input.sent_to,
        approved_date_filter_applied: !!(
          input.approved_from ||
          input.approved_to ||
          input.has_approval !== undefined
        ),
        approved_from: input.approved_from,
        approved_to: input.approved_to,
        has_approval: input.has_approval,
        status_filter_applied: !!input.status,
        status: input.status,
        sort_applied: !!input.sort_by,
        sort_by: input.sort_by,
        order: order,
        results: paginatedEstimates,
      };
    } else {
      // Simple pagination without filtering
      const params: any = {
        from: fromIndex,
        size: requestedSize,
      };

      const result = await this.client.get(context.apiKey, 'estimates', params);
      const estimates = result.data?.results || [];

      return {
        count: estimates.length,
        total_filtered: estimates.length,
        from: fromIndex,
        size: requestedSize,
        has_more: false,
        date_filter_applied: false,
        sent_date_filter_applied: false,
        approved_date_filter_applied: false,
        status_filter_applied: false,
        sort_applied: false,
        results: estimates,
      };
    }
  }
}
