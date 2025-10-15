/**
 * Get Jobs Tool
 * Enhanced with schedule filtering and sorting capabilities
 *
 * PHASE 3: Handle-based response system for token optimization
 * - Automatic response size detection and handle storage
 * - Verbosity levels: summary/compact/detailed/raw
 * - Field selection support
 * - Redis cache + handle storage integration
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext, BaseToolInput } from '../../types/index.js';
import { compactJob, compactArray } from '../../utils/compactData.js';
import { getCurrentMonth } from '../../utils/dateHelpers.js';
import { withCache } from '../../services/cacheService.js';
import { CACHE_PREFIXES, getTTL } from '../../config/cache.js';

interface GetJobsInput extends BaseToolInput {
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
  scheduled_from?: string;
  scheduled_to?: string;
  has_schedule?: boolean;

  // Sorting
  sort_by?: 'date_start' | 'date_end' | 'date_created' | 'date_updated' | 'date_status_change';
  order?: 'asc' | 'desc';

  // Legacy parameter (replaced by verbosity, but kept for backward compatibility)
  include_full_details?: boolean;
}

interface JobOwner {
  id: string;
}

interface JobLocation {
  id: number;
  parent_id?: number | null;
  name?: string;
}

interface JobGeo {
  lat: number;
  lon: number;
}

interface JobPrimary {
  id: string;
  name?: string;
  number?: string;
  type?: string;
}

/**
 * Complete Job interface matching JobNimbus API
 * Based on official JobNimbus API documentation
 */
interface Job {
  // Core identifiers
  jnid: string;
  recid: number;
  number?: string;
  display_number?: string;
  type: string;
  customer?: string;

  // Metadata
  created_by: string;
  created_by_name: string;
  date_created: number;
  date_updated: number;
  date_status_change?: number;

  // Ownership & Location
  owners: JobOwner[];
  subcontractors: any[];
  location: JobLocation;

  // Job Information
  name?: string;
  display_name?: string;
  description?: string;

  // Classification
  record_type: number;
  record_type_name: string;
  status?: number;
  status_name?: string;
  source?: number;
  source_name?: string;

  // Sales
  sales_rep?: string;
  sales_rep_name?: string;

  // Address
  address_line1?: string;
  address_line2?: string | null;
  city?: string;
  state_text?: string;
  country_name?: string;
  zip?: string;
  geo?: JobGeo;

  // Primary Contact/Customer
  primary?: JobPrimary;

  // Scheduling
  date_start?: number;
  date_end?: number;

  // Financial
  approved_estimate_total?: number;
  approved_invoice_total?: number;
  last_estimate?: number;
  last_invoice?: number;
  work_order_total?: number;

  // Attachments
  attachment_count?: number;

  // Status
  is_active?: boolean;
  is_archived?: boolean;

  // Additional
  tags?: any[];
  external_id?: string | null;

  // Allow additional fields from API
  [key: string]: any;
}

/**
 * Generate deterministic cache identifier from input parameters
 * Format: {from}:{size}:{page_size}:{verbosity}:{fields}:{date_from}:{date_to}:{scheduled_from}:{scheduled_to}:{has_schedule}:{sort_by}:{order}:{full_details}
 *
 * CRITICAL: Must include verbosity and page_size to prevent returning wrong cached responses
 */
function generateCacheIdentifier(input: GetJobsInput): string {
  const from = input.from || 0;
  const size = input.size || 15;
  const pageSize = input.page_size || 'null';
  const verbosity = input.verbosity || 'null';
  const fields = input.fields || 'null';
  const dateFrom = input.date_from || 'null';
  const dateTo = input.date_to || 'null';
  const scheduledFrom = input.scheduled_from || 'null';
  const scheduledTo = input.scheduled_to || 'null';
  const hasSchedule = input.has_schedule === undefined ? 'null' : String(input.has_schedule);
  const sortBy = input.sort_by || 'null';
  const order = input.order || 'desc';
  const fullDetails = input.include_full_details ? 'full' : 'compact';

  return `${from}:${size}:${pageSize}:${verbosity}:${fields}:${dateFrom}:${dateTo}:${scheduledFrom}:${scheduledTo}:${hasSchedule}:${sortBy}:${order}:${fullDetails}`;
}

export class GetJobsTool extends BaseTool<GetJobsInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_jobs',
      description: 'Retrieve jobs from JobNimbus with handle-based response optimization. IMPORTANT: By default returns compact summary (5 jobs, 15 fields each) with result_handle for full data retrieval. Use verbosity parameter to control detail level. Large responses (>25 KB) automatically stored in Redis with 15-min TTL - use fetch_by_handle to retrieve. Supports pagination, date filtering, scheduling filters, and sorting.',
      inputSchema: {
        type: 'object',
        properties: {
          // NEW: Handle-based response control
          verbosity: {
            type: 'string',
            description: 'Response detail level: "summary" (5 fields, max 5 jobs), "compact" (15 fields, max 20 jobs - DEFAULT), "detailed" (50 fields, max 50 jobs), "raw" (all fields). Compact mode prevents chat saturation.',
            enum: ['summary', 'compact', 'detailed', 'raw'],
          },
          fields: {
            type: 'string',
            description: 'Comma-separated field names to return. Example: "jnid,number,status_name,sales_rep_name,date_created,last_estimate". Overrides verbosity-based field selection.',
          },
          page_size: {
            type: 'number',
            description: 'Number of records per page (default: 20, max: 100). Replaces "size" parameter. Use with cursor for pagination.',
          },

          // Existing parameters
          from: {
            type: 'number',
            description: 'Starting index for pagination (default: 0). NOTE: Prefer page_size + cursor for large datasets.',
          },
          size: {
            type: 'number',
            description: 'Number of records to retrieve (default: 15, max: 50). DEPRECATED: Use page_size instead.',
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
            description: 'LEGACY: Return full job details. Default: false. DEPRECATED: Use verbosity="detailed" or verbosity="raw" instead.',
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

  async execute(input: GetJobsInput, context: ToolContext): Promise<any> {
    // Generate cache identifier
    const cacheIdentifier = generateCacheIdentifier(input);

    // Wrap with cache layer (PHASE 2: Redis cache integration)
    return await withCache(
      {
        entity: CACHE_PREFIXES.JOBS,
        operation: CACHE_PREFIXES.LIST,
        identifier: cacheIdentifier,
      },
      getTTL('JOBS_LIST'),
      async () => {
        // Determine page size - prefer page_size (new) over size (legacy)
        const pageSize = input.page_size || input.size || 15;
        const fromIndex = input.from || 0;
        const order = input.order || 'desc';

        // Use current month as default if no date filters provided
        const currentMonth = getCurrentMonth();
        const dateFrom = input.date_from || currentMonth.date_from;
        const dateTo = input.date_to || currentMonth.date_to;

        // Determine if we need to fetch all jobs for filtering/sorting
        const needsFullFetch =
          dateFrom ||
          dateTo ||
          input.scheduled_from ||
          input.scheduled_to ||
          input.has_schedule !== undefined ||
          input.sort_by;

        let rawJobs: Job[];
        let totalFiltered: number;
        let totalFetched = 0;
        let iterations = 0;

        if (needsFullFetch) {
          // Fetch all jobs with pagination
          const batchSize = 100;
          const maxIterations = 20;
          let allJobs: Job[] = [];
          let offset = 0;

          while (iterations < maxIterations) {
            const params = { size: batchSize, from: offset };
            const response = await this.client.get(context.apiKey, 'jobs', params);
            const batch = response.data?.results || [];

            if (batch.length === 0) {
              break;
            }

            allJobs = allJobs.concat(batch);
            offset += batchSize;
            iterations++;

            if (batch.length < batchSize) {
              break;
            }
          }

          totalFetched = allJobs.length;

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
          rawJobs = filteredJobs.slice(fromIndex, fromIndex + pageSize);
          totalFiltered = filteredJobs.length;
        } else {
          // Simple pagination without filtering
          const params: any = {
            from: fromIndex,
            size: pageSize,
          };

          const result = await this.client.get(context.apiKey, 'jobs', params);
          rawJobs = result.data?.results || [];
          totalFiltered = rawJobs.length;
        }

        // Build page info
        const pageInfo = {
          has_more: fromIndex + rawJobs.length < totalFiltered,
          total: totalFiltered,
          current_page: Math.floor(fromIndex / pageSize) + 1,
          total_pages: Math.ceil(totalFiltered / pageSize),
        };

        // Check if using new handle-based parameters
        if (this.hasNewParams(input)) {
          // NEW BEHAVIOR: Use handle-based response system
          // ResponseBuilder expects the raw data array, not a wrapper object
          const envelope = await this.wrapResponse(rawJobs, input, context, {
            entity: 'jobs',
            maxRows: pageSize,
            pageInfo,
          });

          // Add jobs-specific metadata to the envelope
          return {
            ...envelope,
            query_metadata: {
              count: rawJobs.length,
              total_filtered: totalFiltered,
              total_fetched: totalFetched || rawJobs.length,
              iterations: iterations,
              from: fromIndex,
              page_size: pageSize,
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
            },
          };
        } else {
          // LEGACY BEHAVIOR: Maintain backward compatibility
          const forceCompact = rawJobs.length > 10;
          const useCompactMode = !input.include_full_details || forceCompact;
          const resultJobs = useCompactMode
            ? compactArray(rawJobs, compactJob)
            : rawJobs;

          return {
            _code_version: 'v1.0-optimized-2025-10-10',
            count: rawJobs.length,
            total_filtered: totalFiltered,
            total_fetched: totalFetched || rawJobs.length,
            iterations: iterations,
            from: fromIndex,
            size: pageSize,
            has_more: pageInfo.has_more,
            total_pages: pageInfo.total_pages,
            current_page: pageInfo.current_page,
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
            compact_mode: useCompactMode,
            compact_mode_forced: forceCompact,
            results: resultJobs,
          };
        }
      }
    );
  }
}
