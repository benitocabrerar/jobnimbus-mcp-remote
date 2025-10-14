/**
 * Get All Tasks Tool
 * Retrieve tasks from JobNimbus with comprehensive filtering and pagination
 *
 * Endpoint: GET /api1/tasks
 * Based on JobNimbus API Documentation
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';
import { withCache } from '../../services/cacheService.js';
import { CACHE_PREFIXES, getTTL } from '../../config/cache.js';

interface GetTasksInput {
  from?: number;
  size?: number;
  include_full_details?: boolean;

  // Filters
  is_completed?: boolean;
  is_active?: boolean;
  is_archived?: boolean;
  record_type?: number;
  priority?: number;
  owner_id?: string;
  related_to?: string;
  date_start_from?: number;
  date_start_to?: number;
}

interface Task {
  jnid: string;
  recid: number;
  number: string;
  type: string;

  // Core
  title: string;
  description?: string;
  record_type: number;
  record_type_name: string;
  priority: number;

  // Dates
  date_start: number;
  date_end: number;
  date_created: number;
  date_updated: number;
  all_day: boolean;

  // Time
  actual_time: number;
  estimated_time: number;

  // Status
  is_completed: boolean;
  is_active: boolean;
  is_archived: boolean;
  hide_from_calendarview: boolean;
  hide_from_tasklist: boolean;

  // Relationships
  created_by: string;
  created_by_name: string;
  customer?: string;
  owners: Array<{id: string}>;
  subcontractors: any[];
  related: Array<{id: string; name?: string; number?: string; type?: string}>;
  location: {id: number};
  tags: any[];

  [key: string]: any;
}

interface CompactTask {
  jnid: string;
  number: string;
  title: string;
  record_type_name: string;
  priority: number;
  is_completed: boolean;
  date_start: string | null;
  date_end: string | null;
  owners_count: number;
  related_count: number;
  actual_time: number;
  estimated_time: number;
  created_by_name: string;
  description_preview?: string;
}

export class GetTasksTool extends BaseTool<GetTasksInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_tasks',
      description: 'Retrieve tasks from JobNimbus with comprehensive filtering and pagination. Supports filtering by completion status, activity status, record type, priority, owner, related entities, and date ranges. Returns compact summaries by default for efficient token usage.',
      inputSchema: {
        type: 'object',
        properties: {
          from: {
            type: 'number',
            description: 'Starting index for pagination (default: 0)',
          },
          size: {
            type: 'number',
            description: 'Number of records to retrieve (default: 10, max: 50). Use small values to prevent response saturation.',
          },
          include_full_details: {
            type: 'boolean',
            description: 'Return full task details. Default: false (compact mode - RECOMMENDED). Only use for small queries (< 10 results).',
          },
          is_completed: {
            type: 'boolean',
            description: 'Filter by completion status (true = completed tasks only, false = incomplete tasks only)',
          },
          is_active: {
            type: 'boolean',
            description: 'Filter by active status (true = active tasks only, false = deleted/inactive tasks only)',
          },
          is_archived: {
            type: 'boolean',
            description: 'Filter by archived status (true = archived tasks only, false = non-archived tasks only)',
          },
          record_type: {
            type: 'number',
            description: 'Filter by task record type ID',
          },
          priority: {
            type: 'number',
            description: 'Filter by priority level (0-5, where 0 is lowest)',
          },
          owner_id: {
            type: 'string',
            description: 'Filter tasks assigned to specific owner (user JNID)',
          },
          related_to: {
            type: 'string',
            description: 'Filter tasks related to specific entity (job, contact, etc. - provide JNID)',
          },
          date_start_from: {
            type: 'number',
            description: 'Filter tasks starting on or after this date (Unix timestamp in seconds)',
          },
          date_start_to: {
            type: 'number',
            description: 'Filter tasks starting on or before this date (Unix timestamp in seconds)',
          },
        },
      },
    };
  }

  /**
   * Compact task to essential fields
   */
  private compactTask(task: Task): CompactTask {
    const description = task.description || '';
    const descriptionPreview = description.length > 80
      ? description.substring(0, 80) + '...'
      : description;

    return {
      jnid: task.jnid,
      number: task.number,
      title: task.title,
      record_type_name: task.record_type_name,
      priority: task.priority,
      is_completed: task.is_completed,
      date_start: task.date_start ? this.formatTimestamp(task.date_start) : null,
      date_end: task.date_end ? this.formatTimestamp(task.date_end) : null,
      owners_count: task.owners.length,
      related_count: task.related.length,
      actual_time: task.actual_time,
      estimated_time: task.estimated_time,
      created_by_name: task.created_by_name,
      description_preview: descriptionPreview || undefined,
    };
  }

  /**
   * Format Unix timestamp to readable date
   */
  private formatTimestamp(timestamp: number): string {
    if (!timestamp || timestamp === 0) return 'N/A';
    try {
      return new Date(timestamp * 1000).toISOString().split('T')[0];
    } catch {
      return 'Invalid Date';
    }
  }

  async execute(input: GetTasksInput, context: ToolContext): Promise<any> {
    const fromIndex = input.from || 0;
    // OPTIMIZED: Default 10, max 50 (reduced from 50/100)
    const requestedSize = Math.min(input.size || 10, 50);

    // Build cache key based on filters
    const cacheKey = {
      entity: CACHE_PREFIXES.TASKS,
      operation: CACHE_PREFIXES.LIST,
      identifier: JSON.stringify({
        from: fromIndex,
        size: requestedSize,
        filters: {
          is_completed: input.is_completed,
          is_active: input.is_active,
          is_archived: input.is_archived,
          record_type: input.record_type,
          priority: input.priority,
          owner_id: input.owner_id,
          related_to: input.related_to,
          date_start_from: input.date_start_from,
          date_start_to: input.date_start_to,
        },
      }),
    };

    return await withCache(
      cacheKey,
      getTTL('TASKS_LIST'),
      async () => {
        // Fetch tasks from JobNimbus API
        const params: any = {
          from: fromIndex,
          size: requestedSize,
        };

        const result = await this.client.get(context.apiKey, 'tasks', params);
        let tasks: Task[] = result.data?.results || result.data || [];

        // Apply client-side filters
        const originalCount = tasks.length;

        if (input.is_completed !== undefined) {
          tasks = tasks.filter(t => t.is_completed === input.is_completed);
        }

        if (input.is_active !== undefined) {
          tasks = tasks.filter(t => t.is_active === input.is_active);
        }

        if (input.is_archived !== undefined) {
          tasks = tasks.filter(t => t.is_archived === input.is_archived);
        }

        if (input.record_type !== undefined) {
          tasks = tasks.filter(t => t.record_type === input.record_type);
        }

        if (input.priority !== undefined) {
          tasks = tasks.filter(t => t.priority === input.priority);
        }

        if (input.owner_id) {
          tasks = tasks.filter(t => t.owners.some(o => o.id === input.owner_id));
        }

        if (input.related_to) {
          tasks = tasks.filter(t => t.related.some(r => r.id === input.related_to));
        }

        if (input.date_start_from !== undefined) {
          tasks = tasks.filter(t => t.date_start >= input.date_start_from!);
        }

        if (input.date_start_to !== undefined) {
          tasks = tasks.filter(t => t.date_start <= input.date_start_to!);
        }

        // OPTIMIZED: Force compact mode if more than 10 results
        const forceCompact = tasks.length > 10;
        const useCompactMode = !input.include_full_details || forceCompact;

        const resultTasks = useCompactMode
          ? tasks.map(task => this.compactTask(task))
          : tasks;

        return {
          _code_version: 'v2.0-enhanced-2025-01-14',
          count: tasks.length,
          original_count: originalCount,
          filtered: originalCount !== tasks.length,
          from: fromIndex,
          size: requestedSize,
          has_more: originalCount === requestedSize,
          compact_mode: useCompactMode,
          compact_mode_forced: forceCompact,
          filters_applied: {
            is_completed: input.is_completed !== undefined,
            is_active: input.is_active !== undefined,
            is_archived: input.is_archived !== undefined,
            record_type: input.record_type !== undefined,
            priority: input.priority !== undefined,
            owner_id: !!input.owner_id,
            related_to: !!input.related_to,
            date_start_from: input.date_start_from !== undefined,
            date_start_to: input.date_start_to !== undefined,
          },
          results: resultTasks,
          _metadata: {
            api_endpoint: 'GET /api1/tasks',
            cached: false,
            timestamp: new Date().toISOString(),
          },
        };
      }
    );
  }
}
