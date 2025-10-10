/**
 * Get Activities Tool
 * Enhanced with schedule filtering, activity type filtering, and sorting capabilities
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';
import { compactActivity, compactArray } from '../../utils/compactData.js';

interface GetActivitiesInput {
  from?: number;
  size?: number;
  date_from?: string;
  date_to?: string;
  scheduled_from?: string;
  scheduled_to?: string;
  has_schedule?: boolean;
  activity_type?: string;
  sort_by?: 'date_start' | 'date_end' | 'date_created' | 'date_updated';
  order?: 'asc' | 'desc';
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

export class GetActivitiesTool extends BaseTool<GetActivitiesInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_activities',
      description: 'Retrieve activities from JobNimbus with pagination, date filtering, scheduling filters, activity type filtering, and sorting',
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
          scheduled_from: {
            type: 'string',
            description: 'Filter activities scheduled on or after this date (date_start >= fecha, YYYY-MM-DD format)',
          },
          scheduled_to: {
            type: 'string',
            description: 'Filter activities scheduled on or before this date (date_start <= fecha, YYYY-MM-DD format)',
          },
          has_schedule: {
            type: 'boolean',
            description: 'Filter only activities with scheduled dates (date_start > 0)',
          },
          activity_type: {
            type: 'string',
            description: 'Filter by activity type (e.g., "Meeting", "Call", "Task")',
          },
          sort_by: {
            type: 'string',
            description: 'Field to sort by',
            enum: ['date_start', 'date_end', 'date_created', 'date_updated'],
          },
          order: {
            type: 'string',
            description: 'Sort order (asc or desc)',
            enum: ['asc', 'desc'],
          },
          include_full_details: {
            type: 'boolean',
            description: 'Return full activity details. Default: false (compact mode - RECOMMENDED to prevent token limit issues). WARNING: Setting to true with large result sets may cause Claude Desktop to crash. Only use for small queries (< 20 results).',
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
    const fromIndex = input.from || 0;
    const requestedSize = Math.min(input.size || 50, 100);
    const order = input.order || 'desc';

    // Determine if we need to fetch all activities for filtering/sorting
    const needsFullFetch =
      input.date_from ||
      input.date_to ||
      input.scheduled_from ||
      input.scheduled_to ||
      input.has_schedule !== undefined ||
      input.activity_type ||
      input.sort_by;

    if (needsFullFetch) {
      // Fetch all activities with pagination
      const batchSize = 100;
      const maxIterations = 50;
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
      let filteredActivities = this.filterByDateCreated(allActivities, input.date_from, input.date_to);

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
      const paginatedActivities = filteredActivities.slice(fromIndex, fromIndex + requestedSize);

      // Apply compaction if not requesting full details OR if result set is too large
      // Safety override: Force compact mode if more than 20 results to prevent token limit issues
      const forceCompact = paginatedActivities.length > 20;
      const useCompactMode = !input.include_full_details || forceCompact;

      const resultActivities = useCompactMode
        ? compactArray(paginatedActivities, compactActivity)
        : paginatedActivities;

      return {
        _code_version: 'v2.0-compact-mode-2025-10-10',
        count: paginatedActivities.length,
        total_filtered: filteredActivities.length,
        total_fetched: allActivities.length,
        iterations: iteration,
        from: fromIndex,
        size: requestedSize,
        has_more: fromIndex + paginatedActivities.length < filteredActivities.length,
        total_pages: Math.ceil(filteredActivities.length / requestedSize),
        current_page: Math.floor(fromIndex / requestedSize) + 1,
        date_filter_applied: !!(input.date_from || input.date_to),
        date_from: input.date_from,
        date_to: input.date_to,
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
    } else {
      // Simple pagination without filtering
      const params: any = {
        from: fromIndex,
        size: requestedSize,
      };

      const result = await this.client.get(context.apiKey, 'activities', params);
      const activities = result.data?.activity || [];

      // Apply compaction if not requesting full details OR if result set is too large
      // Safety override: Force compact mode if more than 20 results to prevent token limit issues
      const forceCompact = activities.length > 20;
      const useCompactMode = !input.include_full_details || forceCompact;

      const resultActivities = useCompactMode
        ? compactArray(activities, compactActivity)
        : activities;

      return {
        _code_version: 'v2.0-compact-mode-2025-10-10',
        count: activities.length,
        total_filtered: activities.length,
        from: fromIndex,
        size: requestedSize,
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
