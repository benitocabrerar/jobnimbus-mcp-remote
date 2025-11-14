/**
 * Get Estimates Tool
 * Enhanced with status filtering, sent/approved date filtering, and sorting capabilities
 *
 * PHASE 3: Handle-based response system for token optimization
 * - Automatic response size detection and handle storage
 * - Verbosity levels: summary/compact/detailed/raw
 * - Field selection support
 * - Redis cache + handle storage integration
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext, BaseToolInput } from '../../types/index.js';
import { getCurrentMonth } from '../../utils/dateHelpers.js';
import { compactEstimate, compactArray } from '../../utils/compactData.js';
import { withCache } from '../../services/cacheService.js';
import { CACHE_PREFIXES, getTTL } from '../../config/cache.js';

interface GetEstimatesInput extends BaseToolInput {
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
  sent_from?: string;
  sent_to?: string;
  approved_from?: string;
  approved_to?: string;
  has_approval?: boolean;

  // Status and sorting
  status?: string;
  sort_by?: 'date_sent' | 'date_approved' | 'date_created' | 'date_updated';
  order?: 'asc' | 'desc';

  // Legacy parameter (replaced by verbosity, but kept for backward compatibility)
  include_full_details?: boolean;
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

/**
 * Generate deterministic cache identifier from input parameters
 * Format: {from}:{size}:{page_size}:{verbosity}:{fields}:{date_from}:{date_to}:{sent_from}:{sent_to}:{approved_from}:{approved_to}:{has_approval}:{status}:{sort_by}:{order}:{full_details}
 *
 * CRITICAL: Must include verbosity and page_size to prevent returning wrong cached responses
 */
function generateCacheIdentifier(input: GetEstimatesInput): string {
  const from = input.from || 0;
  const size = input.size || 15;
  const pageSize = input.page_size || 'null';
  const verbosity = input.verbosity || 'null';
  const fields = input.fields || 'null';
  const dateFrom = input.date_from || 'null';
  const dateTo = input.date_to || 'null';
  const sentFrom = input.sent_from || 'null';
  const sentTo = input.sent_to || 'null';
  const approvedFrom = input.approved_from || 'null';
  const approvedTo = input.approved_to || 'null';
  const hasApproval = input.has_approval === undefined ? 'null' : String(input.has_approval);
  const status = input.status || 'null';
  const sortBy = input.sort_by || 'null';
  const order = input.order || 'desc';
  const fullDetails = input.include_full_details ? 'full' : 'compact';

  return `${from}:${size}:${pageSize}:${verbosity}:${fields}:${dateFrom}:${dateTo}:${sentFrom}:${sentTo}:${approvedFrom}:${approvedTo}:${hasApproval}:${status}:${sortBy}:${order}:${fullDetails}`;
}

export class GetEstimatesTool extends BaseTool<GetEstimatesInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_estimates',
      description: 'Get estimates with filters and sorting',
      inputSchema: {
        type: 'object',
        properties: {
          // NEW: Handle-based response control
          verbosity: {
            type: 'string',
            description: 'Detail level: summary/compact/detailed/raw (default: compact)',
            enum: ['summary', 'compact', 'detailed', 'raw'],
          },
          fields: {
            type: 'string',
            description: 'Fields to return (comma-separated)',
          },
          page_size: {
            type: 'number',
            description: 'Records per page (default: 20, max: 100)',
          },

          // Existing parameters
          from: {
            type: 'number',
            description: 'Pagination offset (default: 0)',
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
          sent_from: {
            type: 'string',
            description: 'Sent on/after date (YYYY-MM-DD)',
          },
          sent_to: {
            type: 'string',
            description: 'Sent on/before date (YYYY-MM-DD)',
          },
          approved_from: {
            type: 'string',
            description: 'Signed on/after date (YYYY-MM-DD)',
          },
          approved_to: {
            type: 'string',
            description: 'Signed on/before date (YYYY-MM-DD)',
          },
          has_approval: {
            type: 'boolean',
            description: 'Filter by approval status',
          },
          status: {
            type: 'string',
            description: 'Status filter',
          },
          sort_by: {
            type: 'string',
            description: 'Field to sort by',
            enum: ['date_sent', 'date_approved', 'date_created', 'date_updated'],
          },
          order: {
            type: 'string',
            description: 'Sort order',
            enum: ['asc', 'desc'],
          },
          include_full_details: {
            type: 'boolean',
            description: 'Return full details (DEPRECATED: use verbosity)',
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
    // Generate cache identifier
    const cacheIdentifier = generateCacheIdentifier(input);

    // Wrap with cache layer (PHASE 2: Redis cache integration)
    return await withCache(
      {
        entity: CACHE_PREFIXES.ESTIMATES,
        operation: CACHE_PREFIXES.LIST,
        identifier: cacheIdentifier,
      instance: context.instance,
      },
      getTTL('ESTIMATES_LIST'),
      async () => {
        // Determine page size - prefer page_size (new) over size (legacy)
        const pageSize = input.page_size || input.size || 15;
        const fromIndex = input.from || 0;
        const order = input.order || 'desc';

    // Use current date as default if no date filters provided
    const currentMonth = getCurrentMonth();
    const dateFrom = input.date_from || currentMonth.date_from;
    const dateTo = input.date_to || currentMonth.date_to;

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
      // OPTIMIZATION: Reduced from 20 to 5 iterations (max 500 estimates = 75% reduction)
      const maxIterations = 5;
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
      const rawEstimates = filteredEstimates.slice(fromIndex, fromIndex + pageSize);
      const totalFiltered = filteredEstimates.length;

      // Build page info
      const pageInfo = {
        has_more: fromIndex + rawEstimates.length < totalFiltered,
        total: totalFiltered,
        current_page: Math.floor(fromIndex / pageSize) + 1,
        total_pages: Math.ceil(totalFiltered / pageSize),
      };

      // Check if using new handle-based parameters
      if (this.hasNewParams(input)) {
        // NEW BEHAVIOR: Use handle-based response system
        // ResponseBuilder expects the raw data array, not a wrapper object
        const envelope = await this.wrapResponse(rawEstimates, input, context, {
          entity: 'estimates',
          maxRows: pageSize,
          pageInfo,
        });

        // Add estimates-specific metadata to the envelope
        return {
          ...envelope,
          query_metadata: {
            count: rawEstimates.length,
            total_filtered: totalFiltered,
            total_fetched: allEstimates.length,
            iterations: iteration,
            from: fromIndex,
            page_size: pageSize,
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
          },
        };
      } else {
        // LEGACY BEHAVIOR: Maintain backward compatibility
        const forceCompact = rawEstimates.length > 10;
        const useCompactMode = !input.include_full_details || forceCompact;
        const resultEstimates = useCompactMode
          ? compactArray(rawEstimates, compactEstimate)
          : rawEstimates;

        return {
          _code_version: 'v1.0-optimized-2025-10-10',
          count: rawEstimates.length,
          total_filtered: totalFiltered,
          total_fetched: allEstimates.length,
          iterations: iteration,
          from: fromIndex,
          size: pageSize,
          has_more: pageInfo.has_more,
          total_pages: pageInfo.total_pages,
          current_page: pageInfo.current_page,
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
          compact_mode: useCompactMode,
          compact_mode_forced: forceCompact,
          results: resultEstimates,
        };
      }
    } else {
      // Simple pagination without filtering
      const params: any = {
        from: fromIndex,
        size: pageSize,
      };

      const result = await this.client.get(context.apiKey, 'estimates', params);
      const rawEstimates = result.data?.results || [];
      const totalFiltered = rawEstimates.length;

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
        const envelope = await this.wrapResponse(rawEstimates, input, context, {
          entity: 'estimates',
          maxRows: pageSize,
          pageInfo,
        });

        // Add estimates-specific metadata to the envelope
        return {
          ...envelope,
          query_metadata: {
            count: rawEstimates.length,
            total_filtered: totalFiltered,
            from: fromIndex,
            page_size: pageSize,
            date_filter_applied: false,
            sent_date_filter_applied: false,
            approved_date_filter_applied: false,
            status_filter_applied: false,
            sort_applied: false,
          },
        };
      } else {
        // LEGACY BEHAVIOR: Maintain backward compatibility
        const forceCompact = rawEstimates.length > 10;
        const useCompactMode = !input.include_full_details || forceCompact;
        const resultEstimates = useCompactMode
          ? compactArray(rawEstimates, compactEstimate)
          : rawEstimates;

        return {
          _code_version: 'v1.0-optimized-2025-10-10',
          count: rawEstimates.length,
          total_filtered: totalFiltered,
          from: fromIndex,
          size: pageSize,
          has_more: false,
          date_filter_applied: false,
          sent_date_filter_applied: false,
          approved_date_filter_applied: false,
          status_filter_applied: false,
          sort_applied: false,
          compact_mode: useCompactMode,
          compact_mode_forced: forceCompact,
          results: resultEstimates,
        };
      }
    }
      }
    );
  }
}
