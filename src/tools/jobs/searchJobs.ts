/**
 * Search Jobs Tool
 * Enhanced with schedule filtering and sorting capabilities (synced with get_jobs)
 *
 * PHASE 2: Integrated Redis cache system for performance optimization
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';
import { compactJob, compactArray } from '../../utils/compactData.js';
import { getCurrentMonth } from '../../utils/dateHelpers.js';
import { withCache } from '../../services/cacheService.js';
import { CACHE_PREFIXES, getTTL } from '../../config/cache.js';

interface SearchJobsInput {
  query?: string;
  from?: number;
  size?: number;
  date_from?: string;
  date_to?: string;
  scheduled_from?: string;
  scheduled_to?: string;
  has_schedule?: boolean;
  sort_by?: 'date_start' | 'date_end' | 'date_created' | 'date_updated' | 'date_status_change';
  order?: 'asc' | 'desc';
  include_full_details?: boolean;
}

interface Job {
  jnid?: string;
  number?: number;
  date_start?: number;
  date_end?: number;
  date_created?: number;
  date_updated?: number;
  date_status_change?: number;
  [key: string]: any;
}

/**
 * Generate deterministic cache identifier from input parameters
 * Format: {query}:{from}:{size}:{date_from}:{date_to}:{scheduled_from}:{scheduled_to}:{has_schedule}:{sort_by}:{order}:{full_details}
 */
function generateCacheIdentifier(input: SearchJobsInput): string {
  const query = input.query || 'all';
  const from = input.from || 0;
  const size = input.size || 50;
  const dateFrom = input.date_from || 'null';
  const dateTo = input.date_to || 'null';
  const scheduledFrom = input.scheduled_from || 'null';
  const scheduledTo = input.scheduled_to || 'null';
  const hasSchedule = input.has_schedule === undefined ? 'null' : String(input.has_schedule);
  const sortBy = input.sort_by || 'null';
  const order = input.order || 'desc';
  const fullDetails = input.include_full_details ? 'full' : 'compact';

  return `${query}:${from}:${size}:${dateFrom}:${dateTo}:${scheduledFrom}:${scheduledTo}:${hasSchedule}:${sortBy}:${order}:${fullDetails}`;
}

export class SearchJobsTool extends BaseTool<SearchJobsInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'search_jobs',
      description: 'Search jobs by criteria with pagination, date filtering, scheduling filters, and sorting',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query (optional)',
          },
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
          scheduled_from: {
            type: 'string',
            description: 'Filter jobs scheduled on or after this date (date_start >= fecha, YYYY-MM-DD format)',
          },
          scheduled_to: {
            type: 'string',
            description: 'Filter jobs scheduled on or before this date (date_start <= fecha, YYYY-MM-DD format)',
          },
          has_schedule: {
            type: 'boolean',
            description: 'Filter only jobs with scheduled dates (date_start > 0)',
          },
          sort_by: {
            type: 'string',
            description: 'Field to sort by',
            enum: ['date_start', 'date_end', 'date_created', 'date_updated', 'date_status_change'],
          },
          order: {
            type: 'string',
            description: 'Sort order (asc or desc)',
            enum: ['asc', 'desc'],
          },
          include_full_details: {
            type: 'boolean',
            description: 'Return full job details. Default: false (compact mode with only essential fields). Set to true for complete job objects.',
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
   * Filter jobs by date_created
   */
  private filterByDateCreated(jobs: Job[], dateFrom?: string, dateTo?: string): Job[] {
    let filtered = jobs;

    if (dateFrom) {
      const fromTs = this.dateStringToUnix(dateFrom, true);
      filtered = filtered.filter(j => (j.date_created || 0) >= fromTs);
    }

    if (dateTo) {
      const toTs = this.dateStringToUnix(dateTo, false);
      filtered = filtered.filter(j => (j.date_created || 0) <= toTs);
    }

    return filtered;
  }

  /**
   * Filter jobs by scheduling parameters (date_start/date_end)
   */
  private filterBySchedule(
    jobs: Job[],
    scheduledFrom?: string,
    scheduledTo?: string,
    hasSchedule?: boolean
  ): Job[] {
    let filtered = jobs;

    // Filter by has_schedule first
    if (hasSchedule !== undefined) {
      if (hasSchedule) {
        filtered = filtered.filter(j => (j.date_start || 0) > 0);
      } else {
        filtered = filtered.filter(j => (j.date_start || 0) === 0);
      }
    }

    // Filter by scheduled_from
    if (scheduledFrom) {
      const scheduledFromTs = this.dateStringToUnix(scheduledFrom, true);
      filtered = filtered.filter(j => (j.date_start || 0) >= scheduledFromTs);
    }

    // Filter by scheduled_to
    if (scheduledTo) {
      const scheduledToTs = this.dateStringToUnix(scheduledTo, false);
      filtered = filtered.filter(j => {
        const dateStart = j.date_start || 0;
        return dateStart > 0 && dateStart <= scheduledToTs;
      });
    }

    return filtered;
  }

  /**
   * Sort jobs by specified field
   */
  private sortJobs(jobs: Job[], sortBy?: string, order: string = 'desc'): Job[] {
    if (!sortBy || jobs.length === 0) {
      return jobs;
    }

    const validFields = ['date_start', 'date_end', 'date_created', 'date_updated', 'date_status_change'];
    if (!validFields.includes(sortBy)) {
      return jobs;
    }

    const reverse = order === 'desc';

    return [...jobs].sort((a, b) => {
      const aVal = (a[sortBy] as number) || 0;
      const bVal = (b[sortBy] as number) || 0;
      return reverse ? bVal - aVal : aVal - bVal;
    });
  }

  async execute(input: SearchJobsInput, context: ToolContext): Promise<any> {
    // Generate cache identifier
    const cacheIdentifier = generateCacheIdentifier(input);

    // Wrap with cache layer (PHASE 2: Redis cache integration)
    return await withCache(
      {
        entity: CACHE_PREFIXES.JOBS,
        operation: CACHE_PREFIXES.SEARCH,
        identifier: cacheIdentifier,
      },
      getTTL('JOBS_SEARCH'),
      async () => {
        const fromIndex = input.from || 0;
        const requestedSize = Math.min(input.size || 50, 100);
        const order = input.order || 'desc';

    // Use current month as default if no date filters provided
    const currentMonth = getCurrentMonth();
    const dateFrom = input.date_from || currentMonth.date_from;
    const dateTo = input.date_to || currentMonth.date_to;

    // Determine if we need to fetch all jobs for filtering/sorting
    // Always do full fetch when dateFrom/dateTo have values to apply date filtering
    const needsFullFetch =
      dateFrom ||
      dateTo ||
      input.scheduled_from ||
      input.scheduled_to ||
      input.has_schedule !== undefined ||
      input.sort_by;

    if (needsFullFetch) {
      // Fetch all jobs with pagination
      const batchSize = 100;
      const maxIterations = 50;
      let allJobs: Job[] = [];
      let offset = 0;
      let iteration = 0;

      while (iteration < maxIterations) {
        const params: any = { size: batchSize, from: offset };
        if (input.query) {
          params.q = input.query;
        }

        const response = await this.client.get(context.apiKey, 'jobs', params);
        const batch = response.data?.results || [];

        if (batch.length === 0) {
          break;
        }

        allJobs = allJobs.concat(batch);
        offset += batchSize;
        iteration++;

        if (batch.length < batchSize) {
          break;
        }
      }

      // Apply date_created filtering
      let filteredJobs = this.filterByDateCreated(allJobs, dateFrom, dateTo);

      // Apply schedule filtering
      if (input.scheduled_from || input.scheduled_to || input.has_schedule !== undefined) {
        filteredJobs = this.filterBySchedule(
          filteredJobs,
          input.scheduled_from,
          input.scheduled_to,
          input.has_schedule
        );
      }

      // Apply sorting
      if (input.sort_by) {
        filteredJobs = this.sortJobs(filteredJobs, input.sort_by, order);
      }

      // Paginate
      const paginatedJobs = filteredJobs.slice(fromIndex, fromIndex + requestedSize);

      // Apply compaction if not requesting full details
      const resultJobs = input.include_full_details
        ? paginatedJobs
        : compactArray(paginatedJobs, compactJob);

      return {
        count: paginatedJobs.length,
        total_filtered: filteredJobs.length,
        total_fetched: allJobs.length,
        iterations: iteration,
        from: fromIndex,
        size: requestedSize,
        has_more: fromIndex + paginatedJobs.length < filteredJobs.length,
        total_pages: Math.ceil(filteredJobs.length / requestedSize),
        current_page: Math.floor(fromIndex / requestedSize) + 1,
        query: input.query,
        date_filter_applied: !!(dateFrom || dateTo),
        date_from: dateFrom,
        date_to: dateTo,
        schedule_filter_applied: !!(
          input.scheduled_from ||
          input.scheduled_to ||
          input.has_schedule !== undefined
        ),
        scheduled_from: input.scheduled_from,
        scheduled_to: input.scheduled_to,
        has_schedule: input.has_schedule,
        sort_applied: !!input.sort_by,
        sort_by: input.sort_by,
        order: order,
        compact_mode: !input.include_full_details,
        results: resultJobs,
      };
    } else {
      // Simple search without filtering
      const params: any = {
        from: fromIndex,
        size: requestedSize,
      };

      if (input.query) {
        params.q = input.query;
      }

      const result = await this.client.get(context.apiKey, 'jobs', params);
      const jobs = result.data?.results || [];

      // Apply compaction if not requesting full details
      const resultJobs = input.include_full_details
        ? jobs
        : compactArray(jobs, compactJob);

      return {
        count: jobs.length,
        total_filtered: jobs.length,
        from: fromIndex,
        size: requestedSize,
        has_more: false,
        query: input.query,
        date_filter_applied: false,
        schedule_filter_applied: false,
        sort_applied: false,
        compact_mode: !input.include_full_details,
        results: resultJobs,
      };
    }
      }
    );
  }
}
