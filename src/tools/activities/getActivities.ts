/**
 * Get Activities Tool
 * Enhanced with schedule filtering, activity type filtering, and sorting capabilities
 *
 * PHASE 3: Handle-based response system for token optimization
 * - Automatic response size detection and handle storage
 * - Verbosity levels: summary/compact/detailed/raw
 * - Field selection support
 * - Redis cache + handle storage integration
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext, BaseToolInput } from '../../types/index.js';
import { compactActivity, compactArray } from '../../utils/compactData.js';
import { getCurrentMonth } from '../../utils/dateHelpers.js';
import { withCache } from '../../services/cacheService.js';
import { CACHE_PREFIXES, getTTL } from '../../config/cache.js';

interface GetActivitiesInput extends BaseToolInput {
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

  // Activity filtering
  activity_type?: string;

  // Sorting
  sort_by?: 'date_start' | 'date_end' | 'date_created' | 'date_updated';
  order?: 'asc' | 'desc';

  // Legacy parameter (replaced by verbosity, but kept for backward compatibility)
  include_full_details?: boolean;
}

interface Activity {
  jnid?: string;
  date_start?: number;
  date_end?: number;
  date_created?: number;
  date_updated?: number;
  type?: string;
  [key: string]: any;
}

/**
 * Generate deterministic cache identifier from input parameters
 * Format: {from}:{size}:{page_size}:{verbosity}:{fields}:{date_from}:{date_to}:{scheduled_from}:{scheduled_to}:{has_schedule}:{activity_type}:{sort_by}:{order}:{full_details}
 *
 * CRITICAL: Must include verbosity and page_size to prevent returning wrong cached responses
 */
function generateCacheIdentifier(input: GetActivitiesInput): string {
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
  const activityType = input.activity_type || 'null';
  const sortBy = input.sort_by || 'null';
  const order = input.order || 'desc';
  const fullDetails = input.include_full_details ? 'full' : 'compact';

  return `${from}:${size}:${pageSize}:${verbosity}:${fields}:${dateFrom}:${dateTo}:${scheduledFrom}:${scheduledTo}:${hasSchedule}:${activityType}:${sortBy}:${order}:${fullDetails}`;
}

export class GetActivitiesTool extends BaseTool<GetActivitiesInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_activities',
      description: 'Get activities',
      inputSchema: {
        type: 'object',
        properties: {
          // NEW: Handle-based response control
          verbosity: {
            type: 'string',
            description: 'Detail level (default: compact)',
            enum: ['summary', 'compact', 'detailed', 'raw'],
          },
          fields: {
            type: 'string',
            description: 'Comma-separated fields to return',
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
            description: 'Start date for date_created (YYYY-MM-DD)',
          },
          date_to: {
            type: 'string',
            description: 'End date for date_created (YYYY-MM-DD)',
          },
          scheduled_from: {
            type: 'string',
            description: 'Filter date_start >= date (YYYY-MM-DD)',
          },
          scheduled_to: {
            type: 'string',
            description: 'Filter date_start <= date (YYYY-MM-DD)',
          },
          has_schedule: {
            type: 'boolean',
            description: 'Filter activities with date_start > 0',
          },
          activity_type: {
            type: 'string',
            description: 'Filter by activity type',
          },
          sort_by: {
            type: 'string',
            description: 'Sort field',
            enum: ['date_start', 'date_end', 'date_created', 'date_updated'],
          },
          order: {
            type: 'string',
            description: 'Sort order',
            enum: ['asc', 'desc'],
          },
          include_full_details: {
            type: 'boolean',
            description: 'DEPRECATED: Use verbosity instead',
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
   * Filter activities by date_created
   */
  private filterByDateCreated(activities: Activity[], dateFrom?: string, dateTo?: string): Activity[] {
    let filtered = activities;

    if (dateFrom) {
      const fromTs = this.dateStringToUnix(dateFrom, true);
      filtered = filtered.filter(a => (a.date_created || 0) >= fromTs);
    }

    if (dateTo) {
      const toTs = this.dateStringToUnix(dateTo, false);
      filtered = filtered.filter(a => (a.date_created || 0) <= toTs);
    }

    return filtered;
  }

  /**
   * Filter activities by scheduling parameters (date_start/date_end)
   */
  private filterBySchedule(
    activities: Activity[],
    scheduledFrom?: string,
    scheduledTo?: string,
    hasSchedule?: boolean
  ): Activity[] {
    let filtered = activities;

    // Filter by has_schedule first
    if (hasSchedule !== undefined) {
      if (hasSchedule) {
        filtered = filtered.filter(a => (a.date_start || 0) > 0);
      } else {
        filtered = filtered.filter(a => (a.date_start || 0) === 0);
      }
    }

    // Filter by scheduled_from
    if (scheduledFrom) {
      const scheduledFromTs = this.dateStringToUnix(scheduledFrom, true);
      filtered = filtered.filter(a => (a.date_start || 0) >= scheduledFromTs);
    }

    // Filter by scheduled_to
    if (scheduledTo) {
      const scheduledToTs = this.dateStringToUnix(scheduledTo, false);
      filtered = filtered.filter(a => {
        const dateStart = a.date_start || 0;
        return dateStart > 0 && dateStart <= scheduledToTs;
      });
    }

    return filtered;
  }

  /**
   * Filter activities by activity type
   */
  private filterByActivityType(activities: Activity[], activityType?: string): Activity[] {
    if (!activityType) {
      return activities;
    }

    const lowerType = activityType.toLowerCase();
    return activities.filter(a => {
      const type = (a.type || '').toLowerCase();
      return type.includes(lowerType);
    });
  }

  /**
   * Sort activities by specified field
   */
  private sortActivities(activities: Activity[], sortBy?: string, order: string = 'desc'): Activity[] {
    if (!sortBy || activities.length === 0) {
      return activities;
    }

    const validFields = ['date_start', 'date_end', 'date_created', 'date_updated'];
    if (!validFields.includes(sortBy)) {
      return activities;
    }

    const reverse = order === 'desc';

    return [...activities].sort((a, b) => {
      const aVal = (a[sortBy] as number) || 0;
      const bVal = (b[sortBy] as number) || 0;
      return reverse ? bVal - aVal : aVal - bVal;
    });
  }

  async execute(input: GetActivitiesInput, context: ToolContext): Promise<any> {
    // Generate cache identifier
    const cacheIdentifier = generateCacheIdentifier(input);

    // Wrap with cache layer (PHASE 2: Redis cache integration)
    return await withCache(
      {
        entity: CACHE_PREFIXES.ACTIVITIES,
        operation: CACHE_PREFIXES.LIST,
        identifier: cacheIdentifier,
      instance: context.instance,
      },
      getTTL('ACTIVITIES_LIST'),
      async () => {
        // Determine page size - prefer page_size (new) over size (legacy)
        const pageSize = input.page_size || input.size || 15;
        const fromIndex = input.from || 0;
        const order = input.order || 'desc';

    // Use current month as default if no date filters provided
    const currentMonth = getCurrentMonth();
    const dateFrom = input.date_from || currentMonth.date_from;
    const dateTo = input.date_to || currentMonth.date_to;

    // Determine if we need to fetch all activities for filtering/sorting
    // Always do full fetch when dateFrom/dateTo have values to apply date filtering
    const needsFullFetch =
      dateFrom ||
      dateTo ||
      input.scheduled_from ||
      input.scheduled_to ||
      input.has_schedule !== undefined ||
      input.activity_type ||
      input.sort_by;

    if (needsFullFetch) {
      // Fetch all activities with pagination
      const batchSize = 100;
      // OPTIMIZATION: Reduced from 20 to 5 iterations (max 500 activities = 75% reduction)
      const maxIterations = 5;
      let allActivities: Activity[] = [];
      let offset = 0;
      let iteration = 0;

      while (iteration < maxIterations) {
        const params = { size: batchSize, from: offset };
        const response = await this.client.get(context.apiKey, 'activities', params);
        const batch = response.data?.activity || [];

        if (batch.length === 0) {
          break;
        }

        allActivities = allActivities.concat(batch);
        offset += batchSize;
        iteration++;

        if (batch.length < batchSize) {
          break;
        }
      }

      // Apply date_created filtering
      let filteredActivities = this.filterByDateCreated(allActivities, dateFrom, dateTo);

      // Apply schedule filtering
      if (input.scheduled_from || input.scheduled_to || input.has_schedule !== undefined) {
        filteredActivities = this.filterBySchedule(
          filteredActivities,
          input.scheduled_from,
          input.scheduled_to,
          input.has_schedule
        );
      }

      // Apply activity type filtering
      if (input.activity_type) {
        filteredActivities = this.filterByActivityType(filteredActivities, input.activity_type);
      }

      // Apply sorting
      if (input.sort_by) {
        filteredActivities = this.sortActivities(filteredActivities, input.sort_by, order);
      }

      // Paginate
      const rawActivities = filteredActivities.slice(fromIndex, fromIndex + pageSize);
      const totalFiltered = filteredActivities.length;

      // Build page info
      const pageInfo = {
        has_more: fromIndex + rawActivities.length < totalFiltered,
        total: totalFiltered,
        current_page: Math.floor(fromIndex / pageSize) + 1,
        total_pages: Math.ceil(totalFiltered / pageSize),
      };

      // Check if using new handle-based parameters
      if (this.hasNewParams(input)) {
        // NEW BEHAVIOR: Use handle-based response system
        // ResponseBuilder expects the raw data array, not a wrapper object
        const envelope = await this.wrapResponse(rawActivities, input, context, {
          entity: 'activities',
          maxRows: pageSize,
          pageInfo,
        });

        // Add activities-specific metadata to the envelope
        return {
          ...envelope,
          query_metadata: {
            count: rawActivities.length,
            total_filtered: totalFiltered,
            total_fetched: allActivities.length,
            iterations: iteration,
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
            activity_type_filter_applied: !!input.activity_type,
            activity_type: input.activity_type,
            sort_applied: !!input.sort_by,
            sort_by: input.sort_by,
            order: order,
          },
        };
      } else {
        // LEGACY BEHAVIOR: Maintain backward compatibility
        const forceCompact = rawActivities.length > 10;
        const useCompactMode = !input.include_full_details || forceCompact;
        const resultActivities = useCompactMode
          ? compactArray(rawActivities, compactActivity)
          : rawActivities;

        return {
          _code_version: 'v2.0-compact-mode-2025-10-10',
          count: rawActivities.length,
          total_filtered: totalFiltered,
          total_fetched: allActivities.length,
          iterations: iteration,
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
          activity_type_filter_applied: !!input.activity_type,
          activity_type: input.activity_type,
          sort_applied: !!input.sort_by,
          sort_by: input.sort_by,
          order: order,
          compact_mode: useCompactMode,
          compact_mode_forced: forceCompact,
          activity: resultActivities,
        };
      }
    } else {
      // Simple pagination without filtering
      const params: any = {
        from: fromIndex,
        size: pageSize,
      };

      const result = await this.client.get(context.apiKey, 'activities', params);
      const rawActivities = result.data?.activity || [];
      const totalFiltered = rawActivities.length;

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
        const envelope = await this.wrapResponse(rawActivities, input, context, {
          entity: 'activities',
          maxRows: pageSize,
          pageInfo,
        });

        // Add activities-specific metadata to the envelope
        return {
          ...envelope,
          query_metadata: {
            count: rawActivities.length,
            total_filtered: totalFiltered,
            from: fromIndex,
            page_size: pageSize,
            date_filter_applied: false,
            schedule_filter_applied: false,
            activity_type_filter_applied: false,
            sort_applied: false,
          },
        };
      } else {
        // LEGACY BEHAVIOR: Maintain backward compatibility
        const forceCompact = rawActivities.length > 10;
        const useCompactMode = !input.include_full_details || forceCompact;
        const resultActivities = useCompactMode
          ? compactArray(rawActivities, compactActivity)
          : rawActivities;

        return {
          _code_version: 'v2.0-compact-mode-2025-10-10',
          count: rawActivities.length,
          total_filtered: totalFiltered,
          from: fromIndex,
          size: pageSize,
          has_more: false,
          date_filter_applied: false,
          schedule_filter_applied: false,
          activity_type_filter_applied: false,
          sort_applied: false,
          compact_mode: useCompactMode,
          compact_mode_forced: forceCompact,
          activity: resultActivities,
        };
      }
    }
      }
    );
  }
}
